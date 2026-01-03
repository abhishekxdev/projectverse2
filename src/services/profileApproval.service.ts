import { firestore } from 'firebase-admin';
import { getFirestore } from '../config/firebase';
import { USER_STATUS, HTTP_STATUS, USER_ROLES } from '../config/constants';
import {
  createUserRepository,
  ProfileReviewMetadata,
  UserRepository,
  UserProfile,
} from '../repositories/user.repository';
import {
  createSchoolRepository,
  SchoolRepository,
} from '../repositories/school.repository';
import {
  createSchoolJoinRequestRepository,
  SchoolJoinRequestRepository,
} from '../repositories/schoolJoinRequest.repository';
import { UserStatus } from '../types/user.types';
import { notificationService } from './notification.service';
import { AppError, NotFoundError, ForbiddenError } from '../utils/error';
import { logger } from '../utils/logger';

const AUDIT_COLLECTION = 'profile_approval_audit';

type AuditAction = 'submitted' | 'approved' | 'rejected';

type AuditEntry = {
  userId: string;
  actorId: string;
  action: AuditAction;
  metadata?: Record<string, unknown>;
  createdAt: FirebaseFirestore.Timestamp;
};

export interface SubmitApprovalPayload {
  userId: string;
  actorId: string;
}

export interface ReviewApprovalPayload {
  userId: string;
  reviewerId: string;
  reviewerRole: string;
  reviewerSchoolId?: string | null;
  reason?: string;
}

export interface ProfileApprovalService {
  submitProfileForApproval(
    payload: SubmitApprovalPayload
  ): Promise<UserProfile>;
  approveProfile(payload: ReviewApprovalPayload): Promise<UserProfile>;
  rejectProfile(payload: ReviewApprovalPayload): Promise<UserProfile>;
  listPendingProfiles(options?: {
    limit?: number;
    startAfter?: string;
    role?: string;
  }): Promise<UserProfile[]>;
}

export function createProfileApprovalService(deps?: {
  userRepository?: UserRepository;
  db?: FirebaseFirestore.Firestore;
  schoolRepository?: SchoolRepository;
  joinRequestRepository?: SchoolJoinRequestRepository;
}): ProfileApprovalService {
  const db = deps?.db ?? getFirestore();
  const userRepository = deps?.userRepository ?? createUserRepository(db);
  const schoolRepository = deps?.schoolRepository ?? createSchoolRepository(db);
  const joinRequestRepository = deps?.joinRequestRepository ?? createSchoolJoinRequestRepository(db);
  const auditCollection = db.collection(AUDIT_COLLECTION);

  const writeAudit = async (entry: AuditEntry): Promise<void> => {
    await auditCollection.doc().set(entry, { merge: false });
  };

  const assertUserExists = async (userId: string): Promise<UserProfile> => {
    const user = await userRepository.getUserById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return user;
  };

  const ensureStatus = (user: UserProfile, expected: UserStatus) => {
    if (user.status !== expected) {
      throw new AppError(
        `Invalid profile status transition from ${user.status} to ${expected}`,
        HTTP_STATUS.CONFLICT,
        'INVALID_TRANSITION'
      );
    }
  };

  const ensureReason = (reason?: string) => {
    if (!reason || reason.trim().length === 0) {
      throw new AppError(
        'Rejection reason required',
        HTTP_STATUS.BAD_REQUEST,
        'REASON_REQUIRED'
      );
    }
  };

  const ensureReviewerCanApprove = (
    reviewer: { role: string; schoolId?: string | null },
    targetUser: UserProfile
  ) => {
    // Platform admin can approve any profile
    if (reviewer.role === USER_ROLES.PLATFORM_ADMIN) {
      return;
    }

    // School admin can only approve users who belong to their school
    if (reviewer.role === USER_ROLES.SCHOOL_ADMIN) {
      if (!targetUser.schoolId) {
        throw new ForbiddenError(
          'School admin can only approve users who have selected to join a school'
        );
      }
      if (targetUser.schoolId !== reviewer.schoolId) {
        throw new ForbiddenError(
          'School admin can only approve users from their own school'
        );
      }
      return;
    }

    throw new ForbiddenError('Insufficient permissions to approve profiles');
  };

  return {
    async submitProfileForApproval({ userId, actorId }) {
      const user = await assertUserExists(userId);
      if (user.status === USER_STATUS.SUSPENDED) {
        throw new AppError(
          'Suspended users cannot submit profiles for approval',
          HTTP_STATUS.FORBIDDEN,
          'USER_SUSPENDED'
        );
      }

      if (user.status === USER_STATUS.PENDING) {
        return user;
      }

      const now = firestore.Timestamp.now();
      const metadata: ProfileReviewMetadata = {
        submittedBy: actorId,
        submittedAt: now,
      };

      const updated = await userRepository.updateProfileStatus(
        userId,
        USER_STATUS.PENDING,
        metadata
      );

      await writeAudit({
        userId,
        actorId,
        action: 'submitted',
        metadata: { previousStatus: user.status },
        createdAt: now,
      });

      await notificationService.triggerProfileSubmittedNotification(userId);
      return updated;
    },

    async approveProfile({
      userId,
      reviewerId,
      reviewerRole,
      reviewerSchoolId,
    }) {
      const user = await assertUserExists(userId);
      ensureStatus(user, USER_STATUS.PENDING);
      ensureReviewerCanApprove(
        { role: reviewerRole, schoolId: reviewerSchoolId },
        user
      );

      const now = firestore.Timestamp.now();
      const metadata: ProfileReviewMetadata = {
        approvedBy: reviewerId,
        approvedByRole: reviewerRole,
        approvedAt: now,
      };

      const updated = await userRepository.updateProfileStatus(
        userId,
        USER_STATUS.ACTIVE,
        metadata
      );

      // If the approved user is a school admin, activate and verify their school
      if (user.role === USER_ROLES.SCHOOL_ADMIN && user.schoolId) {
        try {
          await schoolRepository.updateSchool(user.schoolId, {
            status: 'active',
            verificationStatus: 'verified',
          });
        } catch (error) {
          logger.error(
            'Failed to update school status during profile approval',
            error as Error,
            {
              userId,
              schoolId: user.schoolId,
            }
          );
        }
      }

      await writeAudit({
        userId,
        actorId: reviewerId,
        action: 'approved',
        metadata: { previousStatus: user.status },
        createdAt: now,
      });

      await notificationService.triggerProfileApprovedNotification(userId);
      return updated;
    },

    async rejectProfile({
      userId,
      reviewerId,
      reviewerRole,
      reviewerSchoolId,
      reason,
    }) {
      ensureReason(reason);
      const user = await assertUserExists(userId);
      ensureStatus(user, USER_STATUS.PENDING);
      ensureReviewerCanApprove(
        { role: reviewerRole, schoolId: reviewerSchoolId },
        user
      );

      const now = firestore.Timestamp.now();
      const metadata: ProfileReviewMetadata = {
        rejectedBy: reviewerId,
        rejectedAt: now,
        rejectionReason: reason?.trim(),
      };

      const updated = await userRepository.updateProfileStatus(
        userId,
        USER_STATUS.REJECTED,
        metadata
      );

      // If the rejected user is a school admin, zero out the school's seat allocation
      if (user.role === USER_ROLES.SCHOOL_ADMIN && user.schoolId) {
        try {
          await schoolRepository.updateSchool(user.schoolId, {
            verificationStatus: 'rejected',
            teacherLimit: 0,
            seats: { total: 0, used: 0 },
          });
        } catch (error) {
          logger.error(
            'Failed to zero seats for rejected school',
            error as Error,
            {
              userId,
              schoolId: user.schoolId,
            }
          );
        }
      }

      await writeAudit({
        userId,
        actorId: reviewerId,
        action: 'rejected',
        metadata: { reason: reason?.trim(), previousStatus: user.status },
        createdAt: now,
      });

      await notificationService.triggerProfileRejectedNotification(
        userId,
        reason!.trim()
      );
      return updated;
    },

    async listPendingProfiles(options) {
      // Get all pending profiles
      const pendingProfiles = await userRepository.getPendingProfiles(options);

      // Filter out teachers who have a pending join request to a school
      // These should only be approved by school admin, not platform admin
      const filteredProfiles = await Promise.all(
        pendingProfiles.map(async (profile) => {
          // If user is a teacher and has a schoolId in their profile (not top-level)
          // they might have a pending join request
          const profileSchoolId = (profile.profile as Record<string, unknown>)?.schoolId as string | undefined;

          if (profile.role === USER_ROLES.SCHOOL_TEACHER && profileSchoolId && !profile.schoolId) {
            // Check if they have a pending join request
            try {
              const pendingRequest = await joinRequestRepository.getPendingRequestByUserAndSchool(
                (profile as UserProfile & { id?: string }).id || '',
                profileSchoolId
              );
              if (pendingRequest) {
                // This user should be approved by school admin, not platform admin
                return null;
              }
            } catch (error) {
              logger.warn('Failed to check pending join request', {
                userId: (profile as UserProfile & { id?: string }).id,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }
          return profile;
        })
      );

      // Remove null entries (teachers with pending join requests)
      return filteredProfiles.filter((p): p is UserProfile => p !== null);
    },
  };
}
