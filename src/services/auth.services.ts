import jwt, { SignOptions } from 'jsonwebtoken';
import { firestore } from 'firebase-admin';
import { auth as firebaseAuth } from '../config/firebase';
import {
  createUserRepository,
  UserProfile,
  UserRepository,
  ProfileReviewMetadata,
  didClaimsChange,
} from '../repositories/user.repository';
import {
  createSchoolRepository,
  SchoolRepository,
} from '../repositories/school.repository';
import {
  createSchoolJoinRequestRepository,
  SchoolJoinRequestRepository,
} from '../repositories/schoolJoinRequest.repository';
import { UserTier, UserRole, UserStatus } from '../types/user.types';
import {
  ConflictError,
  NotFoundError,
  AuthError,
  ForbiddenError,
} from '../utils/error';
import { logger } from '../utils/logger';
import { USER_TIERS, USER_ROLES, USER_STATUS } from '../config/constants';
import { isPublicRoleProfileComplete } from '../utils/profile';
import { notificationService } from './notification.service';

type PublicRole = 'teacher' | 'school';

const BACKEND_JWT_EXPIRES_IN = process.env.AUTH_JWT_EXPIRES_IN || '15m';
const BACKEND_JWT_ISSUER = process.env.AUTH_JWT_ISSUER || 'gurucool-ai-backend';

interface AuthClaimsPayload {
  uid: string;
  role: UserRole;
  schoolId: string | null;
  status: UserStatus;
}

export interface RegisterUserInput {
  firebaseUid: string;
  email: string;
  displayName?: string;
  username?: string;
  profile?: Record<string, unknown>;
  tier?: UserTier;
  role?: UserRole;
  schoolId?: string | null;
  status?: UserStatus;
}

export interface SyncUserProfileInput {
  uid: string;
  email?: string;
  displayName?: string;
}

export interface SignupCredentialsInput {
  email: string;
  password: string;
  role: PublicRole;
  displayName?: string;
  profile?: Record<string, unknown>;
}

export interface LoginCredentialsInput {
  email: string;
  password: string;
}

export interface CompleteOnboardingInput {
  uid: string;
  role: PublicRole;
  profile: Record<string, unknown>;
}

export interface UpdateProfileInput {
  displayName?: string;
  username?: string;
  profile?: Record<string, unknown>;
}

export class AuthService {
  private userRepo: UserRepository;
  private schoolRepo: SchoolRepository;
  private joinRequestRepo: SchoolJoinRequestRepository;

  constructor(
    userRepo?: UserRepository,
    schoolRepo?: SchoolRepository,
    joinRequestRepo?: SchoolJoinRequestRepository
  ) {
    this.userRepo = userRepo || createUserRepository();
    this.schoolRepo = schoolRepo || createSchoolRepository();
    this.joinRequestRepo = joinRequestRepo || createSchoolJoinRequestRepository();
  }

  private mapPublicRole(role: PublicRole): UserRole {
    return role === 'teacher'
      ? USER_ROLES.SCHOOL_TEACHER
      : USER_ROLES.SCHOOL_ADMIN;
  }

  private mapInternalRoleToPublic(role?: UserRole): PublicRole | undefined {
    if (role === USER_ROLES.SCHOOL_TEACHER) {
      return 'teacher';
    }
    if (role === USER_ROLES.SCHOOL_ADMIN) {
      return 'school';
    }
    return undefined;
  }

  private inferTierForRole(role: UserRole): UserTier {
    if (role === USER_ROLES.SCHOOL_ADMIN) return USER_TIERS.SCHOOL;
    return USER_TIERS.FREE;
  }

  private getJwtSecret(): string {
    const secret = process.env.AUTH_JWT_SECRET;
    if (!secret) {
      throw new Error('AUTH_JWT_SECRET is not configured');
    }
    return secret;
  }

  private getFirebaseApiKey(): string {
    const key = process.env.FIREBASE_API_KEY;
    if (!key) {
      throw new Error('FIREBASE_API_KEY is not configured');
    }
    return key;
  }

  private getIdentityToolkitBaseUrl(): string {
    const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
    return emulatorHost
      ? `http://${emulatorHost}/identitytoolkit.googleapis.com`
      : 'https://identitytoolkit.googleapis.com';
  }

  private buildClaimPayload(
    uid: string,
    user?: Partial<UserProfile>
  ): AuthClaimsPayload {
    const role = (user?.role as UserRole) ?? USER_ROLES.SCHOOL_TEACHER;
    const schoolId =
      (user?.schoolId as string | null | undefined) !== undefined
        ? (user?.schoolId as string | null)
        : null;
    const status =
      (user?.status as UserStatus | undefined) ?? USER_STATUS.ACTIVE;

    return {
      uid,
      role,
      schoolId,
      status,
    };
  }

  private async applyCustomClaims(
    uid: string,
    user?: Partial<UserProfile>
  ): Promise<{ claims: AuthClaimsPayload; updatedAt: string }> {
    const claims = this.buildClaimPayload(uid, user);
    const updatedAt = new Date().toISOString();
    await firebaseAuth.setCustomUserClaims(uid, claims);
    logger.info('Custom claims updated', {
      uid,
      role: claims.role,
      schoolId: claims.schoolId,
      status: claims.status,
    });
    return { claims, updatedAt };
  }

  private async signInWithPassword(email: string, password: string) {
    const apiKey = this.getFirebaseApiKey();
    const url = `${this.getIdentityToolkitBaseUrl()}/v1/accounts:signInWithPassword?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });

    const payload = (await response.json()) as any;

    if (!response.ok) {
      const message = payload?.error?.message ?? 'Authentication failed';
      if (message === 'EMAIL_NOT_FOUND' || message === 'INVALID_PASSWORD') {
        throw new AuthError('Invalid credentials');
      }
      throw new AuthError(message);
    }

    return {
      token: payload.idToken as string,
      refreshToken: payload.refreshToken as string,
      expiresIn: payload.expiresIn as string,
      uid: payload.localId as string,
    };
  }

  private async createFirebaseUserWithPassword(input: SignupCredentialsInput) {
    try {
      const existing = await firebaseAuth
        .getUserByEmail(input.email)
        .catch(() => null);
      if (existing) {
        throw new ConflictError('Email already in use');
      }

      return await firebaseAuth.createUser({
        email: input.email,
        password: input.password,
        displayName: input.displayName,
      });
    } catch (error: any) {
      const message = error?.message || '';
      if (message.includes('EMAIL_EXISTS')) {
        throw new ConflictError('Email already in use');
      }
      throw error;
    }
  }

  private toAuthEnvelope(uid: string, user: UserProfile) {
    return {
      id: uid,
      email: user.email || '',
      role: (user.role as UserRole) ?? USER_ROLES.SCHOOL_TEACHER,
      status: (user.status as UserStatus) ?? USER_STATUS.PENDING,
      profileCompleted: user.profileCompleted ?? false,
      profile: user.profile,
    };
  }

  /**
   * Create a school document for a school admin during onboarding
   */
  private async createSchoolForAdmin(
    adminUid: string,
    user: UserProfile,
    profile: Record<string, unknown>
  ): Promise<string> {
    const schoolName = (profile.schoolName as string).trim();

    // Default seat count for new schools
    const defaultSeats = 50;

    // Build optional fields
    const schoolAddress = profile.schoolAddress as string | undefined;
    const logo = profile.logo as string | undefined;
    const phone = profile.phone as string | undefined;

    const schoolData: Parameters<SchoolRepository['createSchool']>[0] = {
      name: schoolName,
      adminId: adminUid,
      adminEmail: user.email || '',
      teacherLimit: defaultSeats,
      seats: {
        total: defaultSeats,
        used: 0,
      },
      admins: [adminUid],
      status: 'pending',
      verificationStatus: 'pending',
      contactEmail: (profile.officialSchoolEmail as string) || user.email || '',
    };

    // Add optional fields if present
    if (schoolAddress) schoolData.address = schoolAddress;
    if (logo) schoolData.logo = logo;
    if (phone) schoolData.contactPhone = phone;

    const school = await this.schoolRepo.createSchool(schoolData);

    logger.info('School document created for admin', {
      schoolId: school.id,
      schoolName,
      adminUid,
    });

    return school.id;
  }

  public async syncClaimsFromUser(uid: string) {
    const user = await this.userRepo.getUserById(uid);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return this.applyCustomClaims(uid, user);
  }

  public async generateBackendJwt(uid: string) {
    const user = await this.userRepo.getUserById(uid);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    const claims = this.buildClaimPayload(uid, user);
    const options: SignOptions = {
      expiresIn: BACKEND_JWT_EXPIRES_IN as SignOptions['expiresIn'],
      issuer: BACKEND_JWT_ISSUER,
      subject: uid,
    };

    // Cast claims to JwtPayload to satisfy `jsonwebtoken` overload resolution
    const token = jwt.sign(
      claims as jwt.JwtPayload,
      this.getJwtSecret(),
      options
    );

    return { token, claims };
  }

  /**
   * Register a new user in Firestore
   * This should be called after Firebase Authentication creates the user
   */
  async registerUser(input: RegisterUserInput): Promise<UserProfile> {
    try {
      if (input.role === USER_ROLES.PLATFORM_ADMIN) {
        throw new ForbiddenError(
          'Platform admin accounts cannot be created via API'
        );
      }

      // Verify the Firebase UID exists
      const firebaseUser = await firebaseAuth.getUser(input.firebaseUid);
      if (!firebaseUser) {
        throw new AuthError('Firebase user not found');
      }

      // Check if user already exists (idempotent behavior)
      const existingUser = await this.userRepo.getUserById(input.firebaseUid);
      if (existingUser) {
        await this.applyCustomClaims(input.firebaseUid, existingUser);
        logger.info('User already registered, returning existing profile', {
          uid: input.firebaseUid,
        });
        return existingUser;
      }

      // Check if username is taken (if provided)
      if (input.username) {
        const userByUsername = await this.userRepo.getUserByUsername(
          input.username
        );
        if (userByUsername) {
          throw new ConflictError('Username already taken');
        }
      }

      // Create user in Firestore
      const user = await this.userRepo.createUser({
        uid: input.firebaseUid,
        email: input.email,
        displayName: input.displayName,
        username: input.username,
        profile: input.profile,
        tier: input.tier || USER_TIERS.FREE,
        role: input.role || USER_ROLES.SCHOOL_TEACHER,
        schoolId: input.schoolId || null,
        status: input.status || USER_STATUS.ACTIVE,
      });

      await this.applyCustomClaims(input.firebaseUid, user);

      logger.info('User registered successfully', { uid: input.firebaseUid });
      return user;
    } catch (error) {
      if (error instanceof ConflictError) {
        throw error;
      }
      if (error instanceof AuthError) {
        throw error;
      }
      logger.error('Failed to register user', error as Error, {
        firebaseUid: input.firebaseUid,
      });
      throw error;
    }
  }

  async signupWithCredentials(input: SignupCredentialsInput): Promise<{
    token: string;
    refreshToken: string;
    expiresIn: string;
    user: ReturnType<AuthService['toAuthEnvelope']>;
  }> {
    const role = this.mapPublicRole(input.role);
    const tier = this.inferTierForRole(role);

    const firebaseUser = await this.createFirebaseUserWithPassword(input);

    const user = await this.userRepo.createUser({
      uid: firebaseUser.uid,
      email: input.email,
      displayName: input.displayName,
      profile: input.profile,
      role,
      tier,
      schoolId: role === USER_ROLES.SCHOOL_ADMIN ? null : null,
      status: USER_STATUS.PENDING,
      profileCompleted: false,
    });

    await this.applyCustomClaims(firebaseUser.uid, user);

    const signIn = await this.signInWithPassword(input.email, input.password);

    return {
      token: signIn.token,
      refreshToken: signIn.refreshToken,
      expiresIn: signIn.expiresIn,
      user: this.toAuthEnvelope(firebaseUser.uid, user),
    };
  }

  async loginWithCredentials(input: LoginCredentialsInput): Promise<{
    token: string;
    refreshToken: string;
    expiresIn: string;
    user: ReturnType<AuthService['toAuthEnvelope']>;
  }> {
    const signIn = await this.signInWithPassword(input.email, input.password);

    const user = await this.userRepo.getUserById(signIn.uid);
    if (!user) {
      throw new AuthError('User not found');
    }

    return {
      token: signIn.token,
      refreshToken: signIn.refreshToken,
      expiresIn: signIn.expiresIn,
      user: this.toAuthEnvelope(signIn.uid, user),
    };
  }

  async completeOnboarding(input: CompleteOnboardingInput) {
    const user = await this.userRepo.getUserById(input.uid);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (user.status === USER_STATUS.SUSPENDED) {
      throw new ForbiddenError('Suspended users cannot complete onboarding');
    }

    // Merge the existing profile with the new profile data
    const updatedProfile = { ...(user.profile ?? {}), ...input.profile };

    // Check if the profile is complete based on role requirements
    const profileCompleted = isPublicRoleProfileComplete(
      input.role,
      updatedProfile
    );

    const updates: Partial<UserProfile> = {
      profile: updatedProfile,
      profileCompleted,
      // Note: status is NOT changed here. Status remains as-is (e.g., PENDING)
      // and will only change to ACTIVE when an admin approves the profile.
    };

    let updatedUser = await this.userRepo.updateUser(input.uid, updates);
    await this.applyCustomClaims(input.uid, updatedUser);

    // For teachers: automatically create school join request if schoolId is provided
    if (input.role === 'teacher') {
      const schoolId = input.profile.schoolId as string | undefined;

      if (schoolId) {
        // Check if school exists in database
        const school = await this.schoolRepo.getSchoolById(schoolId);

        if (school) {
          // School exists - create a join request for school admin approval
          try {
            // Check if there's already a pending request
            const existingRequest = await this.joinRequestRepo.getPendingRequestByUserAndSchool(
              input.uid,
              schoolId
            );

            if (!existingRequest) {
              await this.joinRequestRepo.createRequest({
                userId: input.uid,
                userEmail: user.email || '',
                userDisplayName: user.displayName,
                schoolId,
                message: 'Auto-generated request from onboarding',
              });
              logger.info('School join request created during onboarding', {
                uid: input.uid,
                schoolId,
              });
            }
          } catch (error) {
            // Log but don't fail onboarding if join request creation fails
            logger.error('Failed to create school join request during onboarding', error as Error, {
              uid: input.uid,
              schoolId,
            });
          }
        } else {
          // School doesn't exist - profile will remain pending for platform admin approval
          logger.info('Teacher onboarding: school not found, awaiting platform admin approval', {
            uid: input.uid,
            schoolId,
          });
        }
      }
    }

    // For school admins: create school and submit profile for platform admin approval
    logger.info('Checking school admin onboarding condition', {
      inputRole: input.role,
      profileCompleted,
      hasSchoolName: !!input.profile.schoolName,
      existingSchoolId: updatedUser.schoolId,
    });
    if (input.role === 'school' && profileCompleted) {
      // Create school document if it doesn't exist
      const schoolName = input.profile.schoolName as string | undefined;
      if (schoolName && !updatedUser.schoolId) {
        const schoolId = await this.createSchoolForAdmin(input.uid, updatedUser, input.profile);

        // Update user with schoolId
        updatedUser = await this.userRepo.updateUser(input.uid, {
          schoolId,
          tier: USER_TIERS.SCHOOL,
        });

        logger.info('School created during onboarding', {
          uid: input.uid,
          schoolId,
          schoolName,
        });

        // Update claims with new schoolId
        await this.applyCustomClaims(input.uid, updatedUser);
      }

      // Only submit for platform admin approval if not already pending
      // Note: Status is already PENDING from signup, so this block typically won't execute
      // This is intentional - school admins remain in PENDING status until platform admin approves
      try {
        if (updatedUser.status !== USER_STATUS.PENDING && profileCompleted) {
          const now = firestore.Timestamp.now();
          const metadata: ProfileReviewMetadata = {
            submittedBy: input.uid,
            submittedAt: now,
          };

          // Update status to PENDING for platform admin approval
          updatedUser = await this.userRepo.updateProfileStatus(
            input.uid,
            USER_STATUS.PENDING,
            metadata
          );

          // Update custom claims with new status
          await this.applyCustomClaims(input.uid, updatedUser);

          // Trigger notification for platform admin
          await notificationService.triggerProfileSubmittedNotification(input.uid);

          logger.info('School admin profile submitted for platform admin approval', {
            uid: input.uid,
          });
        }
      } catch (error) {
        // Log but don't fail onboarding if approval notification fails
        logger.error('Failed to trigger profile approval notification', error as Error, {
          uid: input.uid,
        });
      }
    }

    return this.toAuthEnvelope(input.uid, updatedUser);
  }

  /**
   * Sync user profile between Firebase Auth and Firestore
   * Used to harmonize data when there are discrepancies
   */
  async syncUserProfile(input: SyncUserProfileInput): Promise<UserProfile> {
    try {
      // Get Firebase Auth user
      const firebaseUser = await firebaseAuth.getUser(input.uid);
      if (!firebaseUser) {
        throw new NotFoundError('Firebase user not found');
      }

      // Get Firestore user
      const firestoreUser = await this.userRepo.getUserById(input.uid);

      // If user doesn't exist in Firestore, create them
      if (!firestoreUser) {
        logger.info('Creating Firestore user during sync', { uid: input.uid });
        const created = await this.userRepo.createUser({
          uid: input.uid,
          email: input.email || firebaseUser.email || '',
          displayName: input.displayName || firebaseUser.displayName,
          tier: USER_TIERS.FREE,
          role: USER_ROLES.SCHOOL_TEACHER,
          schoolId: null,
          status: USER_STATUS.ACTIVE,
        });
        await this.applyCustomClaims(input.uid, created);
        return created;
      }

      // Update Firestore with latest Firebase Auth data if provided
      const updates: Partial<UserProfile> = {};
      if (input.email && input.email !== firestoreUser.email) {
        updates.email = input.email;
      }
      if (
        input.displayName &&
        input.displayName !== firestoreUser.displayName
      ) {
        updates.displayName = input.displayName;
      }

      if (Object.keys(updates).length > 0) {
        logger.info('Syncing user profile updates', {
          uid: input.uid,
          updates,
        });
        return await this.userRepo.updateUser(input.uid, updates);
      }

      return firestoreUser;
    } catch (error) {
      logger.error('Failed to sync user profile', error as Error, {
        uid: input.uid,
      });
      throw error;
    }
  }

  /**
   * Get current user profile by UID
   */
  async getCurrentUser(uid: string): Promise<UserProfile> {
    try {
      const user = await this.userRepo.getUserById(uid);
      if (!user) {
        throw new NotFoundError('User not found');
      }
      return user;
    } catch (error) {
      logger.error('Failed to get current user', error as Error, { uid });
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(
    uid: string,
    updates: UpdateProfileInput
  ): Promise<UserProfile> {
    try {
      // Check if username is being changed and if it's available
      if (updates.username) {
        const existingUser = await this.userRepo.getUserByUsername(
          updates.username
        );
        if (existingUser) {
          // Check if it's not the current user
          const currentUser = await this.userRepo.getUserById(uid);
          if (currentUser && currentUser.username !== updates.username) {
            throw new ConflictError('Username already taken');
          }
        }
      }

      const updatedUser = await this.userRepo.updateUser(uid, updates);
      if (didClaimsChange(updates)) {
        await this.applyCustomClaims(uid, updatedUser);
      }
      logger.info('User profile updated successfully', { uid });
      return updatedUser;
    } catch (error) {
      if (error instanceof ConflictError || error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Failed to update user profile', error as Error, { uid });
      throw error;
    }
  }
}

// singleton instance
export const authService = new AuthService();
