import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth';
import { notificationAccessGuard } from '../middlewares/notificationAccess';
import { validate } from '../middlewares/validate';
import {
  notificationQuerySchema,
  markAsReadSchema,
  deleteNotificationSchema,
} from '../schemas/notification.schema';
import {
  getNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from '../controllers/notification.controller';

const notificationRouter = Router();

notificationRouter.use(authMiddleware, notificationAccessGuard);

/**
 * GET /api/notifications
 * Get paginated list of user's notifications
 */
notificationRouter.get(
  '/',
  validate(notificationQuerySchema),
  getNotifications
);

/**
 * GET /api/notifications/unread-count
 * Get count of unread notifications
 */
notificationRouter.get('/unread-count', getUnreadCount);

/**
 * PUT /api/notifications/:id/read
 * Mark a single notification as read
 */
notificationRouter.put(
  '/:id/read',
  validate(markAsReadSchema),
  markNotificationAsRead
);

/**
 * PUT /api/notifications/read-all
 * Mark all user's notifications as read
 */
notificationRouter.put('/read-all', markAllNotificationsAsRead);

/**
 * DELETE /api/notifications/:id
 * Delete a notification
 */
notificationRouter.delete(
  '/:id',
  validate(deleteNotificationSchema),
  deleteNotification
);

export default notificationRouter;
