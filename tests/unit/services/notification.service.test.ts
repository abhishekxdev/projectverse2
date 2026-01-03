import { firestore } from 'firebase-admin';
import { NotificationService } from '../../../src/services/notification.service';
import { NotificationRepository } from '../../../src/repositories/notification.repository';
import {
  NOTIFICATION_TYPES,
  Notification,
} from '../../../src/types/notification.types';

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock notification repository
const mockNotificationRepo: jest.Mocked<NotificationRepository> = {
  createNotification: jest.fn(),
  getUserNotifications: jest.fn(),
  getUnreadCount: jest.fn(),
  markAsRead: jest.fn(),
  markAllAsRead: jest.fn(),
  deleteNotification: jest.fn(),
};

const buildTimestamp = () => firestore.Timestamp.fromDate(new Date());

const createMockNotification = (
  overrides: Partial<Notification> = {}
): Notification => ({
  id: 'notif-1',
  userId: 'user-1',
  type: NOTIFICATION_TYPES.PROFILE_APPROVED,
  title: 'Profile Approved',
  message: 'Your profile has been approved.',
  isRead: false,
  metadata: {},
  createdAt: buildTimestamp(),
  updatedAt: buildTimestamp(),
  ...overrides,
});

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationService(mockNotificationRepo);
  });

  describe('createNotification', () => {
    it('should create notification via repository', async () => {
      const mockNotification = createMockNotification();

      mockNotificationRepo.createNotification.mockResolvedValue(
        mockNotification
      );

      const result = await service.createNotification({
        userId: 'user-1',
        type: NOTIFICATION_TYPES.PROFILE_APPROVED,
        title: 'Profile Approved',
        message: 'Your profile has been approved.',
      });

      expect(mockNotificationRepo.createNotification).toHaveBeenCalledWith({
        userId: 'user-1',
        type: NOTIFICATION_TYPES.PROFILE_APPROVED,
        title: 'Profile Approved',
        message: 'Your profile has been approved.',
      });
      expect(result).toEqual(mockNotification);
    });

    it('should throw error if repository fails', async () => {
      mockNotificationRepo.createNotification.mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        service.createNotification({
          userId: 'user-1',
          type: NOTIFICATION_TYPES.PROFILE_APPROVED,
          title: 'Test',
          message: 'Test message',
        })
      ).rejects.toThrow('Database error');
    });
  });

  describe('getUserNotifications', () => {
    it('should get user notifications with default limit of 20', async () => {
      const mockNotifications = [
        createMockNotification({
          title: 'Notification 1',
          message: 'Message 1',
        }),
      ];

      mockNotificationRepo.getUserNotifications.mockResolvedValue(
        mockNotifications
      );

      const result = await service.getUserNotifications('user-1');

      expect(mockNotificationRepo.getUserNotifications).toHaveBeenCalledWith(
        'user-1',
        {
          limit: 20,
        }
      );
      expect(result).toEqual(mockNotifications);
    });

    it('should respect custom limit option', async () => {
      mockNotificationRepo.getUserNotifications.mockResolvedValue([]);

      await service.getUserNotifications('user-1', { limit: 10 });

      expect(mockNotificationRepo.getUserNotifications).toHaveBeenCalledWith(
        'user-1',
        {
          limit: 10,
        }
      );
    });

    it('should pass startAfter option for pagination', async () => {
      mockNotificationRepo.getUserNotifications.mockResolvedValue([]);

      await service.getUserNotifications('user-1', {
        limit: 10,
        startAfter: 'cursor-id',
      });

      expect(mockNotificationRepo.getUserNotifications).toHaveBeenCalledWith(
        'user-1',
        {
          limit: 10,
          startAfter: 'cursor-id',
        }
      );
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count from repository', async () => {
      mockNotificationRepo.getUnreadCount.mockResolvedValue(5);

      const result = await service.getUnreadCount('user-1');

      expect(mockNotificationRepo.getUnreadCount).toHaveBeenCalledWith(
        'user-1'
      );
      expect(result).toBe(5);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const mockNotification = createMockNotification({
        title: 'Test',
        message: 'Test message',
        isRead: true,
      });

      mockNotificationRepo.markAsRead.mockResolvedValue(mockNotification);

      const result = await service.markAsRead('notif-1', 'user-1');

      expect(mockNotificationRepo.markAsRead).toHaveBeenCalledWith(
        'notif-1',
        'user-1'
      );
      expect(result.isRead).toBe(true);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      mockNotificationRepo.markAllAsRead.mockResolvedValue(undefined);

      await service.markAllAsRead('user-1');

      expect(mockNotificationRepo.markAllAsRead).toHaveBeenCalledWith('user-1');
    });
  });

  describe('deleteNotification', () => {
    it('should delete notification', async () => {
      mockNotificationRepo.deleteNotification.mockResolvedValue(undefined);

      await service.deleteNotification('notif-1', 'user-1');

      expect(mockNotificationRepo.deleteNotification).toHaveBeenCalledWith(
        'notif-1',
        'user-1'
      );
    });
  });

  // Event Trigger Helper Tests
  describe('triggerProfileApprovedNotification', () => {
    it('should create profile approved notification', async () => {
      const mockNotification = createMockNotification({
        message:
          'Congratulations! Your profile has been approved. You now have full access to the platform.',
      });

      mockNotificationRepo.createNotification.mockResolvedValue(
        mockNotification
      );

      await service.triggerProfileApprovedNotification('user-1');

      expect(mockNotificationRepo.createNotification).toHaveBeenCalledWith({
        userId: 'user-1',
        type: NOTIFICATION_TYPES.PROFILE_APPROVED,
        title: 'Profile Approved',
        message:
          'Congratulations! Your profile has been approved. You now have full access to the platform.',
      });
    });
  });

  describe('triggerProfileRejectedNotification', () => {
    it('should create profile rejected notification with reason', async () => {
      const mockNotification = createMockNotification({
        type: NOTIFICATION_TYPES.PROFILE_REJECTED,
        title: 'Profile Rejected',
        message:
          'Your profile was not approved. Reason: Incomplete information',
        metadata: { rejectionReason: 'Incomplete information' },
      });

      mockNotificationRepo.createNotification.mockResolvedValue(
        mockNotification
      );

      await service.triggerProfileRejectedNotification(
        'user-1',
        'Incomplete information'
      );

      expect(mockNotificationRepo.createNotification).toHaveBeenCalledWith({
        userId: 'user-1',
        type: NOTIFICATION_TYPES.PROFILE_REJECTED,
        title: 'Profile Rejected',
        message:
          'Your profile was not approved. Reason: Incomplete information',
        metadata: { rejectionReason: 'Incomplete information' },
      });
    });
  });

  describe('triggerBadgeEarnedNotification', () => {
    it('should create badge earned notification', async () => {
      const mockNotification = createMockNotification({
        type: NOTIFICATION_TYPES.BADGE_EARNED,
        title: 'Badge Earned: Expert',
        message: 'Congratulations! You have earned the "Expert" badge.',
        metadata: { badgeId: 'badge-123', badgeName: 'Expert' },
      });

      mockNotificationRepo.createNotification.mockResolvedValue(
        mockNotification
      );

      await service.triggerBadgeEarnedNotification(
        'user-1',
        'badge-123',
        'Expert'
      );

      expect(mockNotificationRepo.createNotification).toHaveBeenCalledWith({
        userId: 'user-1',
        type: NOTIFICATION_TYPES.BADGE_EARNED,
        title: 'Badge Earned: Expert',
        message: 'Congratulations! You have earned the "Expert" badge.',
        metadata: { badgeId: 'badge-123', badgeName: 'Expert' },
      });
    });
  });

  describe('triggerSuspensionNotification', () => {
    it('should create suspension notification with reason', async () => {
      const mockNotification = createMockNotification({
        type: NOTIFICATION_TYPES.SUSPENSION,
        title: 'Account Suspended',
        message: 'Your account has been suspended. Reason: Policy violation',
        metadata: { suspensionReason: 'Policy violation' },
      });

      mockNotificationRepo.createNotification.mockResolvedValue(
        mockNotification
      );

      await service.triggerSuspensionNotification('user-1', 'Policy violation');

      expect(mockNotificationRepo.createNotification).toHaveBeenCalledWith({
        userId: 'user-1',
        type: NOTIFICATION_TYPES.SUSPENSION,
        title: 'Account Suspended',
        message: 'Your account has been suspended. Reason: Policy violation',
        metadata: { suspensionReason: 'Policy violation' },
      });
    });
  });

  describe('triggerUnsuspensionNotification', () => {
    it('should create unsuspension notification', async () => {
      const mockNotification = createMockNotification({
        type: NOTIFICATION_TYPES.UNSUSPENSION,
        title: 'Account Reactivated',
        message:
          'Your account has been reactivated. You now have full access to the platform.',
      });

      mockNotificationRepo.createNotification.mockResolvedValue(
        mockNotification
      );

      await service.triggerUnsuspensionNotification('user-1');

      expect(mockNotificationRepo.createNotification).toHaveBeenCalledWith({
        userId: 'user-1',
        type: NOTIFICATION_TYPES.UNSUSPENSION,
        title: 'Account Reactivated',
        message:
          'Your account has been reactivated. You now have full access to the platform.',
      });
    });
  });

  describe('triggerAssignmentNotification', () => {
    it('should create assignment notifications for multiple users', async () => {
      const mockNotification = createMockNotification({
        type: NOTIFICATION_TYPES.ASSIGNMENT_CREATED,
        title: 'New Assignment',
        message: 'You have been assigned: "Math Quiz"',
        metadata: { assignmentId: 'assign-1', assessmentTitle: 'Math Quiz' },
      });

      mockNotificationRepo.createNotification.mockResolvedValue(
        mockNotification
      );

      await service.triggerAssignmentNotification(
        ['user-1', 'user-2', 'user-3'],
        'assign-1',
        'Math Quiz'
      );

      expect(mockNotificationRepo.createNotification).toHaveBeenCalledTimes(3);
      expect(mockNotificationRepo.createNotification).toHaveBeenCalledWith({
        userId: 'user-1',
        type: NOTIFICATION_TYPES.ASSIGNMENT_CREATED,
        title: 'New Assignment',
        message: 'You have been assigned: "Math Quiz"',
        metadata: { assignmentId: 'assign-1', assessmentTitle: 'Math Quiz' },
      });
    });

    it('should handle empty userIds array', async () => {
      await service.triggerAssignmentNotification([], 'assign-1', 'Math Quiz');

      expect(mockNotificationRepo.createNotification).not.toHaveBeenCalled();
    });
  });

  describe('triggerPDCompletedNotification', () => {
    it('should create PD completed notification', async () => {
      const mockNotification = createMockNotification({
        type: NOTIFICATION_TYPES.PD_COMPLETED,
        title: 'Module Completed',
        message: 'You have completed the module: "Teaching Strategies".',
        metadata: { moduleId: 'module-1', moduleTitle: 'Teaching Strategies' },
      });

      mockNotificationRepo.createNotification.mockResolvedValue(
        mockNotification
      );

      await service.triggerPDCompletedNotification(
        'user-1',
        'module-1',
        'Teaching Strategies'
      );

      expect(mockNotificationRepo.createNotification).toHaveBeenCalledWith({
        userId: 'user-1',
        type: NOTIFICATION_TYPES.PD_COMPLETED,
        title: 'Module Completed',
        message:
          'Congratulations! You have completed the "Teaching Strategies" module.',
        metadata: { moduleId: 'module-1', moduleTitle: 'Teaching Strategies' },
      });
    });
  });
});
