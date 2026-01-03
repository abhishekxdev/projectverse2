import crypto from 'crypto';
import { firestore } from 'firebase-admin';
import type { Auth, UserRecord } from 'firebase-admin/auth';
import { auth as firebaseAuth, getFirestore } from '../config/firebase';
import { USER_ROLES, USER_TIERS, USER_STATUS } from '../config/constants';
import {
  School,
  SchoolInvite,
  CreateSchoolInput,
  UpdateSchoolInput,
  SchoolRegistrationResponse,
} from '../types/school.types';
import {
  UserProfile,
  UserRepository,
  createUserRepository,
} from '../repositories/user.repository';
import {
  SchoolRepository,
  createSchoolRepository,
} from '../repositories/school.repository';
import {
  InviteRepository,
  createInviteRepository,
} from '../repositories/invite.repository';
import {
  NotFoundError,
  ConflictError,
  ValidationError,
  AuthError,
  TierLimitError,
} from '../utils/error';
import { logger } from '../utils/logger';
import { authService } from './auth.services';

export interface SchoolService {
  // School management
  registerSchool(
    name: string,
    adminEmail: string,
    seats: { total: number }
  ): Promise<SchoolRegistrationResponse>;
  listSchools(): Promise<School[]>;
  getSchoolDetails(
    schoolId: string
  ): Promise<School & { teacherCount: number }>;
  updateSchool(
    schoolId: string,
    adminId: string,
    data: UpdateSchoolInput
  ): Promise<School>;

  // Teacher management
  inviteTeacher(
    schoolId: string,
    adminId: string,
    email: string
  ): Promise<{ user?: UserProfile; invite?: SchoolInvite }>;
  bulkInviteTeachers(
    schoolId: string,
    adminId: string,
    emails: string[]
  ): Promise<{
    successful: { email: string; user?: UserProfile; invite?: SchoolInvite }[];
    failed: { email: string; error: string }[];
  }>;
  acceptInvite(inviteId: string, userId: string): Promise<UserProfile>;
  removeTeacher(
    schoolId: string,
    adminId: string,
    teacherId: string
  ): Promise<UserProfile>;
  getSchoolTeachers(schoolId: string): Promise<UserProfile[]>;
  getTeacherProgress(schoolId: string, teacherId?: string): Promise<any>;
}

type FirestoreTransaction = FirebaseFirestore.Transaction;

interface SchoolServiceDependencies {
  db?: FirebaseFirestore.Firestore;
  schoolRepo?: SchoolRepository;
  userRepo?: UserRepository;
  inviteRepo?: InviteRepository;
  authClient?: Auth;
  passwordGenerator?: () => string;
  authService?: typeof authService;
}

const isFirestore = (value: unknown): value is FirebaseFirestore.Firestore =>
  !!value &&
  typeof (value as FirebaseFirestore.Firestore).collection === 'function';

const normalizeEmail = (email: string): string => email.toLowerCase().trim();

const defaultPasswordGenerator = (): string => {
  const base = crypto
    .randomBytes(9)
    .toString('base64')
    .replace(/[^a-zA-Z0-9]/g, '');
  const body = (base.length >= 8 ? base.slice(0, 8) : `GC${base}`)
    .replace(/[^a-zA-Z0-9]/g, '')
    .padEnd(8, '0');
  return `${body}Aa1`;
};

const ensureSeatsAvailable = (school: School): void => {
  if (school.seats.used >= school.seats.total) {
    throw new TierLimitError(
      'No seats available for this school',
      school.seats.total,
      school.seats.used,
      'school'
    );
  }
};

const isInviteExpired = (
  expiresAt: FirebaseFirestore.Timestamp,
  now: FirebaseFirestore.Timestamp
): boolean => expiresAt.toMillis() <= now.toMillis();

export function createSchoolService(
  optionsOrDb: FirebaseFirestore.Firestore | SchoolServiceDependencies = {}
): SchoolService {
  const options: SchoolServiceDependencies = isFirestore(optionsOrDb)
    ? { db: optionsOrDb }
    : optionsOrDb;

  const dbInstance = options.db ?? getFirestore();
  const schoolRepo = options.schoolRepo ?? createSchoolRepository(dbInstance);
  const userRepo = options.userRepo ?? createUserRepository(dbInstance);
  const inviteRepo = options.inviteRepo ?? createInviteRepository(dbInstance);
  const authClient = options.authClient ?? firebaseAuth;
  const authSvc = options.authService ?? authService;
  const generatePassword =
    options.passwordGenerator ?? defaultPasswordGenerator;

  const ensureAdminPermission = async (
    adminId: string,
    schoolId: string,
    tx?: FirestoreTransaction
  ): Promise<UserProfile> => {
    const user = await userRepo.getUserById(
      adminId,
      tx ? { transaction: tx } : undefined
    );

    if (
      !user ||
      user.role !== USER_ROLES.SCHOOL_ADMIN ||
      user.schoolId !== schoolId
    ) {
      throw new AuthError('Only school admins can perform this action');
    }

    return user;
  };

  const getSchoolOrThrow = async (
    schoolId: string,
    tx?: FirestoreTransaction
  ): Promise<School> => {
    const school = await schoolRepo.getSchoolById(
      schoolId,
      tx ? { transaction: tx } : undefined
    );

    if (!school) {
      throw new NotFoundError('School not found');
    }

    return school;
  };

  const inviteTeacherInternal = async (
    schoolId: string,
    adminId: string,
    email: string,
    options?: { skipInitialPermission?: boolean }
  ): Promise<{ user?: UserProfile; invite?: SchoolInvite }> => {
    const normalizedEmail = normalizeEmail(email);

    if (!options?.skipInitialPermission) {
      await ensureAdminPermission(adminId, schoolId);
    }

    const existingUserDoc = await userRepo.getUserDocumentByEmail(
      normalizedEmail
    );

    if (existingUserDoc) {
      const bridgedUser = await dbInstance.runTransaction(async (tx) => {
        await ensureAdminPermission(adminId, schoolId, tx);
        const school = await getSchoolOrThrow(schoolId, tx);
        ensureSeatsAvailable(school);

        const userRecord = await userRepo.getUserById(existingUserDoc.id, {
          transaction: tx,
        });

        if (!userRecord) {
          throw new NotFoundError('User not found');
        }

        if (userRecord.schoolId && userRecord.schoolId !== schoolId) {
          throw new ConflictError('User already belongs to another school');
        }

        if (userRecord.schoolId === schoolId) {
          throw new ConflictError('User already belongs to this school');
        }

        const updatedUser = await userRepo.updateUser(
          existingUserDoc.id,
          {
            tier: USER_TIERS.SCHOOL,
            role: USER_ROLES.SCHOOL_TEACHER,
            schoolId,
          },
          { transaction: tx }
        );

        await schoolRepo.updateSchoolSeats(schoolId, school.seats.used + 1, {
          transaction: tx,
        });

        return updatedUser;
      });

      await authService.syncClaimsFromUser(existingUserDoc.id);
      return { user: bridgedUser };
    }

    const invite = await dbInstance.runTransaction(async (tx) => {
      await ensureAdminPermission(adminId, schoolId, tx);
      const school = await getSchoolOrThrow(schoolId, tx);
      ensureSeatsAvailable(school);

      return inviteRepo.createInvite(schoolId, normalizedEmail, adminId, {
        transaction: tx,
      });
    });

    return { invite };
  };

  return {
    async registerSchool(
      name: string,
      adminEmail: string,
      seats: { total: number }
    ) {
      if (!name || name.trim().length < 2) {
        throw new ValidationError('School name must be at least 2 characters');
      }

      if (!adminEmail || !adminEmail.includes('@')) {
        throw new ValidationError('Valid admin email is required');
      }

      if (!seats?.total || seats.total <= 0) {
        throw new ValidationError('Seat total must be a positive number');
      }

      const trimmedName = name.trim();
      const normalizedEmail = normalizeEmail(adminEmail);

      const existingAdmin = await userRepo.getUserDocumentByEmail(
        normalizedEmail
      );
      if (existingAdmin) {
        throw new ConflictError('Admin email already exists in the system');
      }

      let adminRecord: UserRecord | null = null;
      const temporaryPassword = generatePassword();

      try {
        adminRecord = await authClient.createUser({
          email: normalizedEmail,
          password: temporaryPassword,
          displayName: `${trimmedName} Admin`.slice(0, 100),
        });
      } catch (error: any) {
        if (error?.code === 'auth/email-already-exists') {
          throw new ConflictError('Admin email already exists');
        }
        logger.error(
          'Failed to provision admin user for school',
          error as Error,
          {
            email: normalizedEmail,
          }
        );
        throw error;
      }

      try {
        const school = await dbInstance.runTransaction(async (tx) => {
          // PHASE 1: All reads first (Firestore requirement)
          const existingSchool = await schoolRepo.getSchoolByName(trimmedName, {
            transaction: tx,
          });
          if (existingSchool) {
            throw new ConflictError('School name already exists');
          }

          // Check if user document already exists (read before write)
          const userRef = dbInstance.collection('users').doc(adminRecord!.uid);
          const userSnap = await tx.get(userRef);
          if (userSnap.exists) {
            throw new ConflictError('User document already exists');
          }

          // PHASE 2: All writes after reads
          const schoolInput: CreateSchoolInput = {
            name: trimmedName,
            adminId: adminRecord!.uid,
            adminEmail: normalizedEmail,
            teacherLimit: seats.total,
            seats: {
              total: seats.total,
              used: 0,
            },
            admins: [adminRecord!.uid],
            status: 'active',
            verificationStatus: 'pending',
            contactEmail: normalizedEmail,
          };

          const createdSchool = await schoolRepo.createSchool(schoolInput, {
            transaction: tx,
          });

          // Write user document directly (skip existence check since we did it above)
          const now = firestore.Timestamp.now();
          const userDoc = {
            email: normalizedEmail,
            displayName: adminRecord!.displayName || `${trimmedName} Admin`,
            tier: USER_TIERS.SCHOOL,
            role: USER_ROLES.SCHOOL_ADMIN,
            schoolId: createdSchool.id,
            profile: {},
            usage: {},
            status: USER_STATUS.ACTIVE,
            createdAt: now,
            updatedAt: now,
          };
          tx.set(userRef, userDoc);

          return createdSchool;
        });

        await authService.syncClaimsFromUser(adminRecord.uid);

        logger.info('School registered successfully', {
          schoolId: school.id,
          adminId: adminRecord.uid,
        });

        return {
          school,
          admin: {
            uid: adminRecord.uid,
            email: normalizedEmail,
            temporaryPassword,
          },
        };
      } catch (error) {
        if (adminRecord) {
          await authClient.deleteUser(adminRecord.uid).catch((rollbackError) =>
            logger.warn(
              'Failed to rollback admin account after school registration failure',
              {
                adminId: adminRecord?.uid,
                error: (rollbackError as Error).message,
              }
            )
          );
        }
        throw error;
      }
    },

    async listSchools() {
      return await schoolRepo.getAllSchools();
    },

    async getSchoolDetails(schoolId: string) {
      const school = await getSchoolOrThrow(schoolId);
      const teachers = await schoolRepo.getSchoolTeachers(schoolId);

      return {
        ...school,
        teacherCount: teachers.length,
      };
    },

    async updateSchool(
      schoolId: string,
      adminId: string,
      data: UpdateSchoolInput
    ) {
      await ensureAdminPermission(adminId, schoolId);

      const school = await getSchoolOrThrow(schoolId);

      const updatePayload: UpdateSchoolInput = { ...data };

      if (data.seats?.total !== undefined) {
        if (data.seats.total < school.seats.used) {
          throw new ValidationError(
            'Seat total cannot be less than current usage'
          );
        }

        updatePayload.seats = {
          total: data.seats.total,
          used: school.seats.used,
        };
        updatePayload.teacherLimit = data.seats.total;
      }

      if (data.name) {
        updatePayload.name = data.name.trim();
      }

      return await schoolRepo.updateSchool(schoolId, updatePayload);
    },

    async inviteTeacher(schoolId: string, adminId: string, email: string) {
      if (!email || !email.includes('@')) {
        throw new ValidationError('Valid email is required');
      }

      return await inviteTeacherInternal(schoolId, adminId, email);
    },

    async bulkInviteTeachers(
      schoolId: string,
      adminId: string,
      emails: string[]
    ) {
      await ensureAdminPermission(adminId, schoolId);

      const summary = {
        successful: [] as {
          email: string;
          user?: UserProfile;
          invite?: SchoolInvite;
        }[],
        failed: [] as { email: string; error: string }[],
      };

      for (const email of emails) {
        try {
          if (!email || !email.includes('@')) {
            throw new ValidationError('Invalid email format');
          }

          const result = await inviteTeacherInternal(schoolId, adminId, email, {
            skipInitialPermission: true,
          });

          summary.successful.push({ email, ...result });
        } catch (error) {
          summary.failed.push({
            email,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return summary;
    },

    async acceptInvite(inviteId: string, userId: string) {
      const updatedUser = await dbInstance.runTransaction(async (tx) => {
        const invite = await inviteRepo.getInviteById(inviteId, {
          transaction: tx,
        });

        if (!invite) {
          throw new NotFoundError('Invite not found');
        }

        if (invite.status !== 'pending') {
          throw new ValidationError('Invite is no longer valid');
        }

        const now = firestore.Timestamp.now();
        const expiresAt = invite.expiresAt as FirebaseFirestore.Timestamp;
        if (isInviteExpired(expiresAt, now)) {
          throw new ValidationError('Invite has expired');
        }

        const school = await getSchoolOrThrow(invite.schoolId, tx);
        ensureSeatsAvailable(school);

        const user = await userRepo.getUserById(userId, {
          transaction: tx,
        });
        if (!user) {
          throw new NotFoundError('User not found');
        }

        if (user.schoolId && user.schoolId !== invite.schoolId) {
          throw new ConflictError('User already belongs to another school');
        }

        const bridgedUser = await userRepo.updateUser(
          userId,
          {
            tier: USER_TIERS.SCHOOL,
            role: USER_ROLES.SCHOOL_TEACHER,
            schoolId: invite.schoolId,
          },
          { transaction: tx }
        );

        await schoolRepo.updateSchoolSeats(
          invite.schoolId,
          school.seats.used + 1,
          { transaction: tx }
        );

        await inviteRepo.updateInviteStatus(inviteId, 'accepted', {
          transaction: tx,
        });

        return bridgedUser;
      });

      await authSvc.syncClaimsFromUser(userId);
      return updatedUser;
    },

    async removeTeacher(schoolId: string, adminId: string, teacherId: string) {
      await ensureAdminPermission(adminId, schoolId);

      const updatedTeacher = await dbInstance.runTransaction(async (tx) => {
        await ensureAdminPermission(adminId, schoolId, tx);

        const teacher = await userRepo.getUserById(teacherId, {
          transaction: tx,
        });
        if (!teacher || teacher.schoolId !== schoolId) {
          throw new NotFoundError('Teacher not found in this school');
        }

        const school = await getSchoolOrThrow(schoolId, tx);
        const nextUsed = Math.max(0, school.seats.used - 1);

        const user = await userRepo.updateUser(
          teacherId,
          {
            tier: USER_TIERS.FREE,
            role: USER_ROLES.SCHOOL_TEACHER,
            schoolId: null,
          },
          { transaction: tx }
        );

        await schoolRepo.updateSchoolSeats(schoolId, nextUsed, {
          transaction: tx,
        });

        return user;
      });

      await authSvc.syncClaimsFromUser(teacherId);
      return updatedTeacher;
    },

    async getSchoolTeachers(schoolId: string) {
      await getSchoolOrThrow(schoolId);
      return await schoolRepo.getSchoolTeachers(schoolId);
    },

    async getTeacherProgress(schoolId: string, teacherId?: string) {
      if (teacherId) {
        const teacher = await userRepo.getUserById(teacherId);
        if (!teacher || teacher.schoolId !== schoolId) {
          throw new NotFoundError('Teacher not found in this school');
        }

        return {
          teacher,
          competencyScores: {},
          moduleProgress: [],
          assessmentResults: [],
        };
      }

      const teachers = await schoolRepo.getSchoolTeachers(schoolId);
      return {
        teachers,
        summary: {
          totalTeachers: teachers.length,
          averageCompetency: {},
          completionRates: {},
        },
      };
    },
  };
}
