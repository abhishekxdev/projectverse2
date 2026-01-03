import {
  createNotificationRepository,
  NotificationRepository,
} from '../repositories/notification.repository';
import {
  Notification,
  CreateNotificationInput,
  NotificationQueryOptions,
  NOTIFICATION_TYPES,
} from '../types/notification.types';
import { logger } from '../utils/logger';

/**
 * Notification service for managing user notifications
 * Provides business logic layer with event trigger helpers
 */
export class NotificationService {
  private notificationRepo: NotificationRepository;

  constructor(notificationRepo?: NotificationRepository) {
    this.notificationRepo = notificationRepo || createNotificationRepository();
  }

  /**
   * Create a new notification
   */
  async createNotification(
    data: CreateNotificationInput
  ): Promise<Notification> {
    try {
      const notification = await this.notificationRepo.createNotification(data);
      logger.info('Notification created', {
        notificationId: notification.id,
        userId: data.userId,
        type: data.type,
      });
      return notification;
    } catch (error) {
      logger.error(
        'Failed to create notification',
        error instanceof Error ? error : undefined,
        { userId: data.userId, type: data.type }
      );
      throw error;
    }
  }

  /**
   * Get user's notifications with pagination
   * Default limit is 20
   */
  async getUserNotifications(
    userId: string,
    options?: NotificationQueryOptions
  ): Promise<Notification[]> {
    const limit = options?.limit ?? 20;
    return this.notificationRepo.getUserNotifications(userId, {
      ...options,
      limit,
    });
  }

  /**
   * Get count of unread notifications for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepo.getUnreadCount(userId);
  }

  /**
   * Mark a single notification as read
   */
  async markAsRead(
    notificationId: string,
    userId: string
  ): Promise<Notification> {
    const notification = await this.notificationRepo.markAsRead(
      notificationId,
      userId
    );
    logger.info('Notification marked as read', {
      notificationId,
      userId,
    });
    return notification;
  }

  /**
   * Mark all user's notifications as read
   */
  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepo.markAllAsRead(userId);
    logger.info('All notifications marked as read', { userId });
  }

  /**
   * Delete a notification
   */
  async deleteNotification(
    notificationId: string,
    userId: string
  ): Promise<void> {
    await this.notificationRepo.deleteNotification(notificationId, userId);
    logger.info('Notification deleted', { notificationId, userId });
  }

  // ============================================
  // Event Trigger Helpers
  // ============================================

  /**
   * Trigger notification when user profile is approved
   */
  async triggerProfileApprovedNotification(userId: string): Promise<void> {
    await this.createNotification({
      userId,
      type: NOTIFICATION_TYPES.PROFILE_APPROVED,
      title: 'Profile Approved',
      message:
        'Congratulations! Your profile has been approved. You now have full access to the platform.',
    });
  }

  /**
   * Trigger notification when a user submits their profile for approval
   */
  async triggerProfileSubmittedNotification(userId: string): Promise<void> {
    await this.createNotification({
      userId,
      type: NOTIFICATION_TYPES.PROFILE_SUBMITTED,
      title: 'Profile Submitted',
      message:
        'Your profile has been submitted for review. We will notify you once a decision is made.',
    });
  }

  /**
   * Trigger notification when user profile is rejected
   */
  async triggerProfileRejectedNotification(
    userId: string,
    reason: string
  ): Promise<void> {
    await this.createNotification({
      userId,
      type: NOTIFICATION_TYPES.PROFILE_REJECTED,
      title: 'Profile Rejected',
      message: `Your profile was not approved. Reason: ${reason}`,
      metadata: { rejectionReason: reason },
    });
  }

  /**
   * Trigger notification when user earns a badge
   */
  async triggerBadgeEarnedNotification(
    userId: string,
    badgeId: string,
    badgeName: string
  ): Promise<void> {
    await this.createNotification({
      userId,
      type: NOTIFICATION_TYPES.BADGE_EARNED,
      title: `Badge Earned: ${badgeName}`,
      message: `Congratulations! You have earned the "${badgeName}" badge.`,
      metadata: { badgeId, badgeName },
    });
  }

  /**
   * Trigger notification when user is suspended
   */
  async triggerSuspensionNotification(
    userId: string,
    reason: string
  ): Promise<void> {
    await this.createNotification({
      userId,
      type: NOTIFICATION_TYPES.SUSPENSION,
      title: 'Account Suspended',
      message: `Your account has been suspended. Reason: ${reason}`,
      metadata: { suspensionReason: reason },
    });
  }

  /**
   * Trigger notification when user is unsuspended
   */
  async triggerUnsuspensionNotification(userId: string): Promise<void> {
    await this.createNotification({
      userId,
      type: NOTIFICATION_TYPES.UNSUSPENSION,
      title: 'Account Reactivated',
      message:
        'Your account has been reactivated. You now have full access to the platform.',
    });
  }

  /**
   * Trigger notification when assignment is created for users
   */
  async triggerAssignmentNotification(
    userIds: string[],
    assignmentId: string,
    assessmentTitle: string
  ): Promise<void> {
    const promises = userIds.map((userId) =>
      this.createNotification({
        userId,
        type: NOTIFICATION_TYPES.ASSIGNMENT_CREATED,
        title: 'New Assignment',
        message: `You have been assigned: "${assessmentTitle}"`,
        metadata: { assignmentId, assessmentTitle },
      })
    );

    await Promise.all(promises);
    logger.info('Assignment notifications sent', {
      userCount: userIds.length,
      assignmentId,
    });
  }

  /**
   * Trigger notification when PD module is completed
   */
  async triggerPDCompletedNotification(
    userId: string,
    moduleId: string,
    moduleTitle: string
  ): Promise<void> {
    await this.createNotification({
      userId,
      type: NOTIFICATION_TYPES.PD_COMPLETED,
      title: 'Module Completed',
      message: `Congratulations! You have completed the "${moduleTitle}" module.`,
      metadata: { moduleId, moduleTitle },
    });
  }

  // ============================================
  // Competency Assessment Notification Triggers (Task 5)
  // ============================================

  /**
   * Trigger notification when competency assessment is submitted
   */
  async triggerCompetencySubmittedNotification(
    userId: string,
    attemptId: string
  ): Promise<void> {
    await this.createNotification({
      userId,
      type: NOTIFICATION_TYPES.COMPETENCY_SUBMITTED,
      title: 'Assessment Submitted',
      message:
        'Your competency assessment has been submitted successfully. Results will be available shortly.',
      metadata: { attemptId },
    });
  }

  /**
   * Trigger notification when competency assessment is evaluated
   */
  async triggerCompetencyEvaluatedNotification(
    userId: string,
    attemptId: string,
    resultId: string,
    overallScore: number,
    proficiencyLevel: string
  ): Promise<void> {
    await this.createNotification({
      userId,
      type: NOTIFICATION_TYPES.COMPETENCY_EVALUATED,
      title: 'Assessment Results Ready',
      message: `Your competency assessment has been evaluated. You achieved a ${proficiencyLevel} level with a score of ${overallScore.toFixed(
        1
      )}%.`,
      metadata: { attemptId, resultId, overallScore, proficiencyLevel },
    });
  }
}

// Singleton instance
export const notificationService = new NotificationService();
