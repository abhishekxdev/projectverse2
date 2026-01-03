import { Response, NextFunction } from 'express';
import { ApiRequest } from '../types/api.types';
import { notificationService } from '../services/notification.service';
import { successResponse } from '../utils/response';
import { HTTP_STATUS } from '../config/constants';
import { AuthRequiredError } from '../utils/error';

/**
 * Get notifications for authenticated user
 * GET /api/notifications
 */
export const getNotifications = async (
  req: ApiRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new AuthRequiredError();
    }

    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : 20;
    const startAfter = req.query.startAfter as string | undefined;

    const notifications = await notificationService.getUserNotifications(
      req.user.uid,
      { limit, startAfter }
    );

    const hasMore = notifications.length === limit;

    return successResponse(res, notifications, HTTP_STATUS.OK, {
      limit,
      hasNext: hasMore,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get unread notification count for authenticated user
 * GET /api/notifications/unread-count
 */
export const getUnreadCount = async (
  req: ApiRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new AuthRequiredError();
    }

    const count = await notificationService.getUnreadCount(req.user.uid);

    return successResponse(res, { count });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark a single notification as read
 * PUT /api/notifications/:id/read
 */
export const markNotificationAsRead = async (
  req: ApiRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new AuthRequiredError();
    }

    const { id } = req.params;
    const notification = await notificationService.markAsRead(id, req.user.uid);

    return successResponse(res, notification);
  } catch (error) {
    next(error);
  }
};

/**
 * Mark all notifications as read for authenticated user
 * PUT /api/notifications/read-all
 */
export const markAllNotificationsAsRead = async (
  req: ApiRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new AuthRequiredError();
    }

    await notificationService.markAllAsRead(req.user.uid);

    return successResponse(res, {
      message: 'All notifications marked as read',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a notification
 * DELETE /api/notifications/:id
 */
export const deleteNotification = async (
  req: ApiRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new AuthRequiredError();
    }

    const { id } = req.params;
    await notificationService.deleteNotification(id, req.user.uid);

    return successResponse(res, {
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
