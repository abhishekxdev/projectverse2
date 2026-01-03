import { firestore } from 'firebase-admin';
import { getFirestore } from '../config/firebase';
import { USER_STATUS } from '../config/constants';
import { NotFoundError } from '../utils/error';
import { createSchoolRepository } from './school.repository';
import { createUserRepository, UserProfile } from './user.repository';
import { School, SchoolStatus } from '../types/school.types';

const USERS_COLLECTION = 'users';
const SCHOOLS_COLLECTION = 'schools';
const AUDIT_COLLECTION = 'suspension_audit_logs';

type SuspendPayload = {
  actorId: string;
  reason: string;
};

type UnsuspendPayload = {
  actorId: string;
};

type SuspensionAuditRecord = {
  entityType: 'school' | 'user';
  entityId: string;
  action: 'suspend' | 'unsuspend';
  actorId: string;
  reason?: string;
  duplicate?: boolean;
  timestamp: FirebaseFirestore.Timestamp;
};

export interface SuspensionStatus {
  status: SchoolStatus | (typeof USER_STATUS)[keyof typeof USER_STATUS];
  suspendedBy?: string;
  suspendedAt?: FirebaseFirestore.Timestamp;
  reason?: string;
}

export interface SuspensionRepository {
  suspendSchool(schoolId: string, payload: SuspendPayload): Promise<School>;
  unsuspendSchool(schoolId: string, payload: UnsuspendPayload): Promise<School>;
  suspendTeacher(userId: string, payload: SuspendPayload): Promise<UserProfile>;
  unsuspendTeacher(
    userId: string,
    payload: UnsuspendPayload
  ): Promise<UserProfile>;
  getSuspensionStatus(
    entityType: 'school' | 'user',
    entityId: string
  ): Promise<SuspensionStatus | null>;
}

export function createSuspensionRepository(
  db: FirebaseFirestore.Firestore = getFirestore()
): SuspensionRepository {
  const userRepo = createUserRepository(db);
  const schoolRepo = createSchoolRepository(db);
  const usersCol = db.collection(USERS_COLLECTION);
  const schoolsCol = db.collection(SCHOOLS_COLLECTION);
  const auditCol = db.collection(AUDIT_COLLECTION);

  const writeAuditRecord = (
    tx: FirebaseFirestore.Transaction,
    record: SuspensionAuditRecord
  ) => {
    const docRef = auditCol.doc();
    tx.set(docRef, record, { merge: false });
  };

  return {
    async suspendSchool(schoolId, payload) {
      const now = firestore.Timestamp.now();
      await db.runTransaction(async (tx) => {
        const ref = schoolsCol.doc(schoolId);
        const snap = await tx.get(ref);

        if (!snap.exists) {
          throw new NotFoundError('School not found');
        }

        const school = snap.data() as School;
        const duplicate = school.status === 'suspended';
        const updates: Partial<School> = duplicate
          ? {}
          : {
              status: 'suspended',
              suspendedBy: payload.actorId,
              suspendedAt: now,
              suspensionReason: payload.reason,
              updatedAt: now,
            };

        if (!duplicate) {
          tx.set(ref, updates, { merge: true });

          // Suspend all teachers in this school
          const teachersQuery = await usersCol
            .where('schoolId', '==', schoolId)
            .where('role', 'in', ['school_teacher', 'school_admin'])
            .get();

          teachersQuery.docs.forEach((teacherDoc) => {
            const teacherData = teacherDoc.data() as UserProfile;
            if (teacherData.status !== USER_STATUS.SUSPENDED) {
              const teacherUpdates: Partial<UserProfile> = {
                status: USER_STATUS.SUSPENDED as any,
                suspension: {
                  suspendedBy: payload.actorId,
                  suspendedAt: now,
                  reason: `School suspended: ${payload.reason}`,
                  originalStatus: teacherData.status, // Preserve original status
                },
                updatedAt: now,
              };
              tx.set(teacherDoc.ref, teacherUpdates, { merge: true });

              // Audit log for each teacher suspension
              writeAuditRecord(tx, {
                entityType: 'user',
                entityId: teacherDoc.id,
                action: 'suspend',
                actorId: payload.actorId,
                reason: `School suspended: ${payload.reason}`,
                duplicate: false,
                timestamp: now,
              });
            }
          });
        }

        writeAuditRecord(tx, {
          entityType: 'school',
          entityId: schoolId,
          action: 'suspend',
          actorId: payload.actorId,
          reason: payload.reason,
          duplicate,
          timestamp: now,
        });
      });

      const updated = await schoolRepo.getSchoolById(schoolId);
      if (!updated) {
        throw new NotFoundError('School not found');
      }
      return updated;
    },

    async unsuspendSchool(schoolId, payload) {
      const now = firestore.Timestamp.now();
      await db.runTransaction(async (tx) => {
        const ref = schoolsCol.doc(schoolId);
        const snap = await tx.get(ref);

        if (!snap.exists) {
          throw new NotFoundError('School not found');
        }

        const school = snap.data() as School;
        const wasSuspended = school.status === 'suspended';

        if (wasSuspended) {
          const updates = {
            status: 'active',
            suspendedBy: firestore.FieldValue.delete(),
            suspendedAt: firestore.FieldValue.delete(),
            suspensionReason: firestore.FieldValue.delete(),
            isSuspended: firestore.FieldValue.delete(),
            updatedAt: now,
          };
          tx.update(ref, updates);

          // Unsuspend teachers that were suspended due to school suspension
          const teachersQuery = await usersCol
            .where('schoolId', '==', schoolId)
            .where('role', 'in', ['school_teacher', 'school_admin'])
            .get();

          teachersQuery.docs.forEach((teacherDoc) => {
            const teacherData = teacherDoc.data() as UserProfile;
            // Only unsuspend if they were suspended due to school suspension
            if (
              teacherData.status === USER_STATUS.SUSPENDED &&
              teacherData.suspension?.reason?.startsWith('School suspended:')
            ) {
              // Restore original status if available, otherwise default to ACTIVE
              const originalStatus =
                teacherData.suspension?.originalStatus || USER_STATUS.ACTIVE;

              const teacherUpdates = {
                status: originalStatus as any,
                suspension: firestore.FieldValue.delete(),
                isSuspended: firestore.FieldValue.delete(),
                updatedAt: now,
              };
              tx.update(teacherDoc.ref, teacherUpdates);

              // Audit log for each teacher unsuspension
              writeAuditRecord(tx, {
                entityType: 'user',
                entityId: teacherDoc.id,
                action: 'unsuspend',
                actorId: payload.actorId,
                timestamp: now,
              });
            }
          });
        }

        writeAuditRecord(tx, {
          entityType: 'school',
          entityId: schoolId,
          action: 'unsuspend',
          actorId: payload.actorId,
          timestamp: now,
        });
      });

      const updated = await schoolRepo.getSchoolById(schoolId);
      if (!updated) {
        throw new NotFoundError('School not found');
      }
      return updated;
    },

    async suspendTeacher(userId, payload) {
      const now = firestore.Timestamp.now();
      await db.runTransaction(async (tx) => {
        const ref = usersCol.doc(userId);
        const snap = await tx.get(ref);

        if (!snap.exists) {
          throw new NotFoundError('User not found');
        }

        const user = snap.data() as UserProfile;
        const duplicate = user.status === USER_STATUS.SUSPENDED;

        if (!duplicate) {
          const updates: Partial<UserProfile> = {
            status: USER_STATUS.SUSPENDED as any,
            suspension: {
              suspendedBy: payload.actorId,
              suspendedAt: now,
              reason: payload.reason,
              originalStatus: user.status, // Preserve original status
            },
            updatedAt: now,
          };
          tx.set(ref, updates, { merge: true });
        }

        writeAuditRecord(tx, {
          entityType: 'user',
          entityId: userId,
          action: 'suspend',
          actorId: payload.actorId,
          reason: payload.reason,
          duplicate,
          timestamp: now,
        });
      });

      const updated = await userRepo.getUserById(userId);
      if (!updated) {
        throw new NotFoundError('User not found');
      }
      return updated;
    },

    async unsuspendTeacher(userId, payload) {
      const now = firestore.Timestamp.now();
      await db.runTransaction(async (tx) => {
        const ref = usersCol.doc(userId);
        const snap = await tx.get(ref);

        if (!snap.exists) {
          throw new NotFoundError('User not found');
        }

        const user = snap.data() as UserProfile;
        const wasSuspended = user.status === USER_STATUS.SUSPENDED;

        if (wasSuspended) {
          // Restore original status if available, otherwise default to ACTIVE
          const originalStatus =
            user.suspension?.originalStatus || USER_STATUS.ACTIVE;

          const updates = {
            status: originalStatus as any,
            suspension: firestore.FieldValue.delete(),
            isSuspended: firestore.FieldValue.delete(),
            updatedAt: now,
          };
          tx.update(ref, updates);
        }

        writeAuditRecord(tx, {
          entityType: 'user',
          entityId: userId,
          action: 'unsuspend',
          actorId: payload.actorId,
          timestamp: now,
        });
      });

      const updated = await userRepo.getUserById(userId);
      if (!updated) {
        throw new NotFoundError('User not found');
      }
      return updated;
    },

    async getSuspensionStatus(entityType, entityId) {
      if (entityType === 'school') {
        const school = await schoolRepo.getSchoolById(entityId);
        if (!school) return null;
        return {
          status: school.status,
          suspendedBy: (school as any).suspendedBy ?? undefined,
          suspendedAt: (school as any).suspendedAt ?? undefined,
          reason: (school as any).suspensionReason ?? undefined,
        };
      }

      const user = await userRepo.getUserById(entityId);
      if (!user) return null;
      return {
        status: user.status,
        suspendedBy: user.suspension?.suspendedBy,
        suspendedAt: user.suspension?.suspendedAt,
        reason: user.suspension?.reason,
      };
    },
  };
}
