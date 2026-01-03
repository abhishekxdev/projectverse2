import { firestore } from 'firebase-admin';
import { createProfileApprovalService } from '../../../src/services/profileApproval.service';
import {
  ProfileReviewMetadata,
  UserProfile,
  UserRepository,
} from '../../../src/repositories/user.repository';
import { USER_STATUS } from '../../../src/config/constants';
import { AppError } from '../../../src/utils/error';

jest.mock('../../../src/services/notification.service', () => ({
  notificationService: {
    triggerProfileSubmittedNotification: jest.fn().mockResolvedValue(undefined),
    triggerProfileApprovedNotification: jest.fn().mockResolvedValue(undefined),
    triggerProfileRejectedNotification: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockUserRepository = (): jest.Mocked<UserRepository> => ({
  createUser: jest.fn(),
  getUserById: jest.fn(),
  getUserByEmail: jest.fn(),
  getUserDocumentByEmail: jest.fn(),
  getUserByUsername: jest.fn(),
  updateUser: jest.fn(),
  updateUsage: jest.fn(),
  getUsersBySchool: jest.fn(),
  updateProfileStatus: jest.fn(),
  getUsersByStatus: jest.fn(),
  getPendingProfiles: jest.fn(),
});

const timestamp = () => firestore.Timestamp.fromDate(new Date());

const buildUser = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  email: 'teacher@example.com',
  status: USER_STATUS.DRAFT,
  suspension: null,
  usage: {},
  profile: {},
  ...overrides,
});

describe('ProfileApprovalService', () => {
  const auditCollectionMock = {
    doc: jest.fn(() => ({ set: jest.fn().mockResolvedValue(undefined) })),
  };
  const dbMock = {
    collection: jest.fn(() => auditCollectionMock),
  } as unknown as FirebaseFirestore.Firestore;

  let repo: jest.Mocked<UserRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = mockUserRepository();
  });

  describe('submitProfileForApproval', () => {
    it('transitions draft user to pending and writes metadata', async () => {
      const user = buildUser({ status: USER_STATUS.DRAFT });
      const updated: UserProfile = {
        ...user,
        status: USER_STATUS.PENDING,
        profileReview: {
          submittedBy: 'user-1',
          submittedAt: timestamp(),
        } as ProfileReviewMetadata,
      };

      repo.getUserById.mockResolvedValue(user);
      repo.updateProfileStatus.mockResolvedValue(updated);

      const service = createProfileApprovalService({
        userRepository: repo,
        db: dbMock,
      });

      const result = await service.submitProfileForApproval({
        userId: 'user-1',
        actorId: 'user-1',
      });

      expect(repo.updateProfileStatus).toHaveBeenCalledWith(
        'user-1',
        USER_STATUS.PENDING,
        expect.objectContaining({ submittedBy: 'user-1' })
      );
      expect(result.status).toBe(USER_STATUS.PENDING);
    });
  });

  describe('approveProfile', () => {
    it('throws when user not pending', async () => {
      const user = buildUser({ status: USER_STATUS.ACTIVE });
      repo.getUserById.mockResolvedValue(user);

      const service = createProfileApprovalService({
        userRepository: repo,
        db: dbMock,
      });

      await expect(
        service.approveProfile({
          userId: 'user-1',
          reviewerId: 'admin-1',
          reviewerRole: 'platform_admin',
        })
      ).rejects.toBeInstanceOf(AppError);
      expect(repo.updateProfileStatus).not.toHaveBeenCalled();
    });
  });

  describe('rejectProfile', () => {
    it('requires reason', async () => {
      const user = buildUser({ status: USER_STATUS.PENDING });
      repo.getUserById.mockResolvedValue(user);

      const service = createProfileApprovalService({
        userRepository: repo,
        db: dbMock,
      });

      await expect(
        service.rejectProfile({
          userId: 'user-1',
          reviewerId: 'admin-1',
          reviewerRole: 'platform_admin',
        })
      ).rejects.toThrow('Rejection reason required');
    });
  });
});
