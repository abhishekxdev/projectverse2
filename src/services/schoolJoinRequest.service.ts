import { getFirestore, auth as firebaseAuth } from '../config/firebase';
import {
  createSchoolJoinRequestRepository,
  SchoolJoinRequestRepository,
} from '../repositories/schoolJoinRequest.repository';
import {
  createUserRepository,
  UserRepository,
} from '../repositories/user.repository';
import {
  createSchoolRepository,
  SchoolRepository,
} from '../repositories/school.repository';
import {
  JoinRequestStatusView,
  JoinRequestWithProfile,
  SchoolJoinRequest,
} from '../types/schoolJoinRequest.types';
import {
  AppError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
  TierLimitError,
} from '../utils/error';
import { HTTP_STATUS, USER_ROLES, USER_STATUS } from '../config/constants';
import { logger } from '../utils/logger';
import { notificationService } from './notification.service';

export interface SchoolJoinRequestService {
  submitJoinRequest(
    userId: string,
    userEmail: string,
    userDisplayName: string | undefined,
    schoolId: string,
    message?: string
  ): Promise<SchoolJoinRequest>;

  listPendingForSchool(schoolId: string): Promise<JoinRequestWithProfile[]>;

  getRequestStatus(
    userId: string,
    schoolId: string
  ): Promise<JoinRequestStatusView | null>;

  approveRequest(
    requestId: string,
    reviewerId: string,
    reviewerSchoolId: string
  ): Promise<SchoolJoinRequest>;

  rejectRequest(
    requestId: string,
    reviewerId: string,
    reviewerSchoolId: string,
    reason: string
  ): Promise<SchoolJoinRequest>;
}

export function createSchoolJoinRequestService(deps?: {
  joinRequestRepository?: SchoolJoinRequestRepository;
  userRepository?: UserRepository;
  schoolRepository?: SchoolRepository;
  db?: FirebaseFirestore.Firestore;
}): SchoolJoinRequestService {
  const db = deps?.db ?? getFirestore();
  const joinRequestRepository =
    deps?.joinRequestRepository ?? createSchoolJoinRequestRepository(db);
  const userRepository = deps?.userRepository ?? createUserRepository(db);
  const schoolRepository = deps?.schoolRepository ?? createSchoolRepository(db);

  const withStatusFlags = (
    request: SchoolJoinRequest | null
  ): JoinRequestStatusView | null => {
    if (!request) return null;
    return {
      ...request,
      isPending: request.status === 'pending',
      isApproved: request.status === 'approved',
      isRejected: request.status === 'rejected',
    };
  };

  return {
    async submitJoinRequest(
      userId,
      userEmail,
      userDisplayName,
      schoolId,
      message
    ) {
      // Check if school exists
      const school = await schoolRepository.getSchoolById(schoolId);
      if (!school) {
        throw new NotFoundError('School not found');
      }

      // Check if user already has a school
      const user = await userRepository.getUserById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      if (user.schoolId) {
        throw new ConflictError('User already belongs to a school');
      }

      // Check if there's already a pending request
      const existingRequest =
        await joinRequestRepository.getPendingRequestByUserAndSchool(
          userId,
          schoolId
        );

      if (existingRequest) {
        throw new ConflictError(
          'A pending join request already exists for this school'
        );
      }

      // Create the join request
      const request = await joinRequestRepository.createRequest({
        userId,
        userEmail,
        userDisplayName,
        schoolId,
        message,
      });

      logger.info('Join request created', {
        requestId: request.id,
        userId,
        schoolId,
      });

      return request;
    },

    async listPendingForSchool(schoolId) {
      const requests = await joinRequestRepository.getRequestsBySchool(
        schoolId,
        'pending'
      );

      const enriched = await Promise.all(
        requests.map(async (req) => {
          const user = await userRepository
            .getUserById(req.userId)
            .catch((error) => {
              logger.warn('Failed to fetch user for join request', {
                userId: req.userId,
                requestId: req.id,
                error: error instanceof Error ? error.message : String(error),
              });
              return null;
            });

          return {
            ...withStatusFlags(req)!,
            user,
          } as JoinRequestWithProfile;
        })
      );

      return enriched;
    },

    async getRequestStatus(userId, schoolId) {
      const request =
        await joinRequestRepository.getLatestRequestByUserAndSchool(
          userId,
          schoolId
        );
      return withStatusFlags(request);
    },

    async approveRequest(requestId, reviewerId, reviewerSchoolId) {
      const request = await joinRequestRepository.getRequestById(requestId);

      if (!request) {
        throw new NotFoundError('Join request not found');
      }

      if (request.status !== 'pending') {
        throw new AppError(
          'Request has already been processed',
          HTTP_STATUS.CONFLICT,
          'REQUEST_ALREADY_PROCESSED'
        );
      }

      // Verify school admin can only approve requests for their school
      if (request.schoolId !== reviewerSchoolId) {
        throw new ForbiddenError(
          'You can only approve requests for your own school'
        );
      }

      // Get school to check seat availability
      const school = await schoolRepository.getSchoolById(request.schoolId);
      if (!school) {
        throw new NotFoundError('School not found');
      }

      // Check if seats are available
      if (school.seats.used >= school.seats.total) {
        throw new TierLimitError(
          'No seats available for this school',
          school.seats.total,
          school.seats.used,
          'school'
        );
      }

      // Update request status
      const updated = await joinRequestRepository.updateRequestStatus(
        requestId,
        'approved',
        reviewerId
      );

      // Update user's schoolId AND status to ACTIVE
      const updatedUser = await userRepository.updateUser(request.userId, {
        schoolId: request.schoolId,
        role: USER_ROLES.SCHOOL_TEACHER,
        status: USER_STATUS.ACTIVE,
      });

      // Update school's used seats
      try {
        await schoolRepository.updateSchoolSeats(
          request.schoolId,
          school.seats.used + 1
        );
        logger.info('School seats updated after join request approval', {
          schoolId: request.schoolId,
          previousUsed: school.seats.used,
          newUsed: school.seats.used + 1,
        });
      } catch (error) {
        logger.error('Failed to update school seats after join request approval', error as Error, {
          schoolId: request.schoolId,
          userId: request.userId,
        });
      }

      // Sync Firebase custom claims so auth middleware recognizes the changes
      try {
        await firebaseAuth.setCustomUserClaims(request.userId, {
          uid: request.userId,
          role: updatedUser.role,
          schoolId: updatedUser.schoolId,
          status: updatedUser.status,
        });
        logger.info('Firebase claims synced after join request approval', {
          userId: request.userId,
          schoolId: request.schoolId,
        });
      } catch (error) {
        logger.error('Failed to sync Firebase claims after join request approval', error as Error, {
          userId: request.userId,
          schoolId: request.schoolId,
        });
      }

      // Trigger notification for user
      try {
        await notificationService.triggerProfileApprovedNotification(request.userId);
      } catch (error) {
        logger.error('Failed to send approval notification', error as Error, {
          userId: request.userId,
        });
      }

      return updated;
    },

    async rejectRequest(requestId, reviewerId, reviewerSchoolId, reason) {
      if (!reason || reason.trim().length === 0) {
        throw new AppError(
          'Rejection reason is required',
          HTTP_STATUS.BAD_REQUEST,
          'REASON_REQUIRED'
        );
      }

      const request = await joinRequestRepository.getRequestById(requestId);

      if (!request) {
        throw new NotFoundError('Join request not found');
      }

      if (request.status !== 'pending') {
        throw new AppError(
          'Request has already been processed',
          HTTP_STATUS.CONFLICT,
          'REQUEST_ALREADY_PROCESSED'
        );
      }

      // Verify school admin can only reject requests for their school
      if (request.schoolId !== reviewerSchoolId) {
        throw new ForbiddenError(
          'You can only reject requests for your own school'
        );
      }

      // Update request status
      const updated = await joinRequestRepository.updateRequestStatus(
        requestId,
        'rejected',
        reviewerId,
        reason.trim()
      );

      // TODO: Trigger notification for user
      // await notificationService.triggerJoinRequestRejectedNotification(request.userId, reason);

      return updated;
    },
  };
}

// Default instance
export const schoolJoinRequestService = createSchoolJoinRequestService();
