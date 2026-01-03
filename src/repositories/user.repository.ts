import { firestore } from 'firebase-admin';
import { getFirestore } from '../config/firebase';
import {
  USER_ROLES,
  USER_TIERS,
  USER_STATUS,
  HTTP_STATUS,
} from '../config/constants';
import {
  UserRole,
  UserTier,
  UserStatus,
  ApprovalStatus,
  ProficiencyLevel,
  GradeLevel,
  Subject,
  SchoolAdminRole,
  UserProfile,
  ProfileReviewMetadata,
  SuspensionMetadata,
} from '../types/user.types';
import { AppError, ConflictError, NotFoundError } from '../utils/error';

// Re-export types for convenience
export type {
  UserRole,
  UserTier,
  UserStatus,
  ApprovalStatus,
  ProficiencyLevel,
  GradeLevel,
  Subject,
  SchoolAdminRole,
  UserProfile,
  ProfileReviewMetadata,
  SuspensionMetadata,
};

export type UpdateUsagePayload = Record<string, number>;

const COLLECTION = 'users';

type TransactionOptions = { transaction?: FirebaseFirestore.Transaction };

const CLAIM_FIELDS: Array<keyof UserProfile> = ['role', 'schoolId', 'status'];

const normalizeUserProfile = (
  data?: FirebaseFirestore.DocumentData | UserProfile | null
): UserProfile => {
  const profile = (data || {}) as UserProfile;
  const profileReview = profile.profileReview as
    | ProfileReviewMetadata
    | undefined;
  return {
    ...profile,
    schoolId: profile.schoolId ?? null,
    status: (profile.status as UserStatus | undefined) ?? USER_STATUS.ACTIVE,
    profileCompleted: profile.profileCompleted ?? false,
    profileReview: profileReview ? { ...profileReview } : undefined,
    suspension: profile.suspension ?? null,
  };
};

export const didClaimsChange = (data: Partial<UserProfile>): boolean => {
  return CLAIM_FIELDS.some((field) => data[field] !== undefined);
};

export interface UserRepository {
  createUser(
    data: {
      uid: string;
      email: string;
      displayName?: string;
      username?: string;
      profile?: Record<string, unknown>;
      tier?: UserTier;
      role?: UserRole;
      schoolId?: string | null;
      status?: UserStatus;
      profileCompleted?: boolean;
    },
    options?: TransactionOptions
  ): Promise<UserProfile>;
  getUserById(
    uid: string,
    options?: TransactionOptions
  ): Promise<UserProfile | null>;
  getUserByEmail(
    email: string,
    options?: TransactionOptions
  ): Promise<UserProfile | null>;
  getUserDocumentByEmail(
    email: string,
    options?: TransactionOptions
  ): Promise<{ id: string; data: UserProfile } | null>;
  getUserByUsername(username: string): Promise<UserProfile | null>;
  updateUser(
    uid: string,
    data: Partial<UserProfile>,
    options?: TransactionOptions
  ): Promise<UserProfile>;
  updateUsage(uid: string, usageData: UpdateUsagePayload): Promise<UserProfile>;
  getUsersBySchool(
    schoolId: string,
    options?: { limit?: number; startAfter?: string }
  ): Promise<UserProfile[]>;
  updateProfileStatus(
    uid: string,
    nextStatus: UserStatus,
    metadata?: Partial<ProfileReviewMetadata>,
    options?: TransactionOptions
  ): Promise<UserProfile>;
  getUsersByStatus(
    status: UserStatus,
    options?: { limit?: number; startAfter?: string }
  ): Promise<UserProfile[]>;
  getPendingProfiles(options?: {
    limit?: number;
    startAfter?: string;
    role?: string;
  }): Promise<UserProfile[]>;
  getAllTeachers(options?: {
    page?: number;
    limit?: number;
    approvedByPlatformAdmin?: boolean;
  }): Promise<UserProfile[]>;
  countTeachers(options?: {
    approvedByPlatformAdmin?: boolean;
  }): Promise<number>;
}

export function createUserRepository(
  db: FirebaseFirestore.Firestore = getFirestore()
): UserRepository {
  const col = db.collection(COLLECTION);

  return {
    async createUser(data, options) {
      const ref = col.doc(data.uid);
      const now = firestore.Timestamp.now();

      const userDoc: UserProfile = {
        email: data.email,
        profile: data.profile ?? {},
        tier: data.tier ?? USER_TIERS.FREE,
        role: data.role ?? USER_ROLES.SCHOOL_TEACHER,
        schoolId: data.schoolId ?? null,
        usage: {},
        status: data.status ?? USER_STATUS.ACTIVE,
        profileCompleted: data.profileCompleted ?? false,
        createdAt: now,
        updatedAt: now,
      };

      // NOTE: Backfill legacy user documents with `status` and `schoolId` before enabling
      // strict claim enforcement so suspended accounts are consistently recognized.

      if (data.displayName !== undefined) {
        userDoc.displayName = data.displayName;
      }
      if (data.username !== undefined) {
        userDoc.username = data.username;
      }

      if (options?.transaction) {
        const snap = await options.transaction.get(ref);
        if (snap.exists) {
          throw new ConflictError('User already exists');
        }
        options.transaction.set(ref, userDoc, { merge: false });
        return normalizeUserProfile(userDoc);
      }

      const existing = await ref.get();
      if (existing.exists) {
        throw new ConflictError('User already exists');
      }

      await ref.set(userDoc, { merge: false });
      return normalizeUserProfile(userDoc);
    },

    async getUserById(uid, options) {
      const ref = col.doc(uid);
      const snap = options?.transaction
        ? await options.transaction.get(ref)
        : await ref.get();
      return snap.exists ? normalizeUserProfile(snap.data()) : null;
    },

    async getUserByEmail(email, options) {
      const doc = await this.getUserDocumentByEmail(email, options);
      return doc ? normalizeUserProfile(doc.data) : null;
    },

    async getUserDocumentByEmail(email, options) {
      const normalizedEmail = email.toLowerCase().trim();
      const query = col.where('email', '==', normalizedEmail).limit(1);
      const q = options?.transaction
        ? await options.transaction.get(query)
        : await query.get();
      if (q.empty) return null;
      const doc = q.docs[0];
      return {
        id: doc.id,
        data: normalizeUserProfile(doc.data()),
      };
    },

    async getUserByUsername(username) {
      const q = await col.where('username', '==', username).limit(1).get();
      if (q.empty) return null;
      return normalizeUserProfile(q.docs[0].data());
    },

    async updateUser(uid, data, options) {
      const ref = col.doc(uid);
      const now = firestore.Timestamp.now();

      if (options?.transaction) {
        const snap = await options.transaction.get(ref);
        if (!snap.exists) {
          throw new NotFoundError('User not found');
        }
        const patch = { ...data, updatedAt: now } as Partial<UserProfile>;
        options.transaction.set(ref, patch, { merge: true });
        const merged = {
          ...(snap.data() as UserProfile),
          ...patch,
        };
        return normalizeUserProfile(merged);
      }

      const snap = await ref.get();
      if (!snap.exists) throw new NotFoundError('User not found');
      const patch = { ...data, updatedAt: now } as Partial<UserProfile>;
      await ref.set(patch, { merge: true });
      const updated = await ref.get();
      return normalizeUserProfile(updated.data());
    },

    async updateProfileStatus(uid, nextStatus, metadata, options) {
      const ref = col.doc(uid);
      const applyUpdate = async (
        tx: FirebaseFirestore.Transaction
      ): Promise<UserProfile> => {
        const snap = await tx.get(ref);
        if (!snap.exists) {
          throw new NotFoundError('User not found');
        }

        const existing = normalizeUserProfile(snap.data());
        const now = firestore.Timestamp.now();
        const resolvedMetadata = metadata ?? {};
        const inferredActor =
          resolvedMetadata.lastActionBy ||
          resolvedMetadata.approvedBy ||
          resolvedMetadata.rejectedBy ||
          resolvedMetadata.submittedBy;
        const nextProfileReview: ProfileReviewMetadata = {
          ...(existing.profileReview ?? {}),
          ...resolvedMetadata,
          lastActionBy: inferredActor,
          lastActionAt: resolvedMetadata.lastActionAt ?? now,
        };

        const updates: Partial<UserProfile> = {
          status: nextStatus,
          profileReview: nextProfileReview,
          updatedAt: now,
        };

        tx.set(ref, updates, { merge: true });

        return normalizeUserProfile({
          ...existing,
          ...updates,
        });
      };

      try {
        if (options?.transaction) {
          return await applyUpdate(options.transaction);
        }

        return await db.runTransaction(async (transaction) =>
          applyUpdate(transaction)
        );
      } catch (error) {
        const message = (error as Error)?.message ?? '';
        if (message.includes('ABORTED') || message.includes('409')) {
          throw new AppError(
            'Profile status update conflicted, please retry',
            HTTP_STATUS.CONFLICT,
            'RETRY_TRANSACTION'
          );
        }
        throw error;
      }
    },

    async getUsersByStatus(status, options) {
      let query: FirebaseFirestore.Query = col
        .where('status', '==', status)
        .orderBy('updatedAt', 'desc');

      if (options?.startAfter) {
        const cursor = await col.doc(options.startAfter).get();
        if (cursor.exists) {
          query = query.startAfter(cursor);
        }
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const q = await query.get();
      return q.docs.map((doc) =>
        normalizeUserProfile({ id: doc.id, ...doc.data() })
      );
    },

    async getPendingProfiles(options) {
      let query: FirebaseFirestore.Query = col
        .where('status', '==', USER_STATUS.PENDING)
        .where('profileCompleted', '==', true)
        .orderBy('updatedAt', 'desc');

      if (options?.role) {
        query = query.where('role', '==', options.role);
      }

      if (options?.startAfter) {
        const cursor = await col.doc(options.startAfter).get();
        if (cursor.exists) {
          query = query.startAfter(cursor);
        }
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const q = await query.get();
      const pending = q.docs.map((doc) =>
        normalizeUserProfile({ id: doc.id, ...doc.data() })
      );

      return pending.sort((a, b) => {
        const aTime = a.profileReview?.submittedAt
          ? a.profileReview.submittedAt.toMillis()
          : a.updatedAt
          ? a.updatedAt.toMillis()
          : 0;
        const bTime = b.profileReview?.submittedAt
          ? b.profileReview.submittedAt.toMillis()
          : b.updatedAt
          ? b.updatedAt.toMillis()
          : 0;
        return bTime - aTime;
      });
    },

    async updateUsage(uid, usageData) {
      // Perform atomic increments inside a transaction
      await db.runTransaction(async (tx) => {
        const ref = col.doc(uid);
        const snap = await tx.get(ref);
        if (!snap.exists) throw new Error('NotFoundError');
        const updates: Record<string, FirebaseFirestore.FieldValue> = {};
        for (const [key, inc] of Object.entries(usageData)) {
          updates[`usage.${key}`] = firestore.FieldValue.increment(inc);
        }
        updates['updatedAt'] = firestore.Timestamp.now();
        tx.set(ref, updates, { merge: true });
      });
      const updated = await col.doc(uid).get();
      return normalizeUserProfile(updated.data());
    },

    async getUsersBySchool(schoolId, options) {
      let query: FirebaseFirestore.Query = col
        .where('schoolId', '==', schoolId)
        .orderBy('createdAt', 'desc');
      if (options?.limit) query = query.limit(options.limit);
      // Note: startAfter expects a value; for simplicity we skip cursor until needed
      const q = await query.get();
      return q.docs.map((d) => normalizeUserProfile({ id: d.id, ...d.data() }));
    },

    async getAllTeachers(options) {
      const page = options?.page ?? 1;
      const limit = options?.limit ?? 20;
      const offset = (page - 1) * limit;

      let query: FirebaseFirestore.Query = col.where(
        'role',
        '==',
        USER_ROLES.SCHOOL_TEACHER
      );

      if (options?.approvedByPlatformAdmin) {
        query = query
          .where('status', '==', USER_STATUS.ACTIVE)
          .where(
            'profileReview.approvedByRole',
            '==',
            USER_ROLES.PLATFORM_ADMIN
          );
      }

      query = query.orderBy('createdAt', 'desc');

      // Firestore doesn't support offset natively; we fetch offset + limit and skip
      const fetchLimit = offset + limit;
      query = query.limit(fetchLimit);

      const snapshot = await query.get();
      const docs = snapshot.docs.slice(offset, offset + limit);

      return docs.map((doc) =>
        normalizeUserProfile({ id: doc.id, ...doc.data() })
      );
    },

    async countTeachers(options) {
      let query: FirebaseFirestore.Query = col.where(
        'role',
        '==',
        USER_ROLES.SCHOOL_TEACHER
      );

      if (options?.approvedByPlatformAdmin) {
        query = query
          .where('status', '==', USER_STATUS.ACTIVE)
          .where(
            'profileReview.approvedByRole',
            '==',
            USER_ROLES.PLATFORM_ADMIN
          );
      }

      const snapshot = await query.count().get();
      return snapshot.data().count;
    },
  };
}
