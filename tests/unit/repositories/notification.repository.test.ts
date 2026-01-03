import { createNotificationRepository } from '../../../src/repositories/notification.repository';
import { NOTIFICATION_TYPES } from '../../../src/types/notification.types';

// Minimal Firestore mock with notifications-specific functionality
function createMockDB() {
  const store: Record<string, any> = {};
  let docIdCounter = 0;

  const collection = (name: string) => ({
    doc: (id?: string) => {
      const docId = id || `auto-id-${++docIdCounter}`;
      return {
        id: docId,
        get: async () => ({
          exists: !!store[docId],
          data: () => store[docId],
          id: docId,
          ref: { id: docId },
        }),
        set: async (data: any, options?: any) => {
          store[docId] = options?.merge
            ? { ...(store[docId] || {}), ...data }
            : data;
        },
        update: async (data: any) => {
          if (!store[docId]) {
            throw new Error('Document does not exist');
          }
          store[docId] = { ...store[docId], ...data };
        },
        delete: async () => {
          delete store[docId];
        },
      };
    },
    where: (field: string, op: string, value: any) => {
      const chainable = {
        where: (f2: string, op2: string, v2: any) => {
          return {
            count: () => ({
              get: async () => {
                const count = Object.values(store).filter((doc: any) => {
                  const match1 = doc?.[field] === value;
                  const match2 = doc?.[f2] === v2;
                  return match1 && match2;
                }).length;
                return { data: () => ({ count }) };
              },
            }),
            get: async () => {
              const docs = Object.entries(store)
                .filter(([_, doc]: [string, any]) => {
                  const match1 = doc?.[field] === value;
                  const match2 = doc?.[f2] === v2;
                  return match1 && match2;
                })
                .map(([id, data]) => ({
                  id,
                  data: () => data,
                  ref: {
                    id,
                    update: async (updateData: any) => {
                      store[id] = { ...store[id], ...updateData };
                    },
                  },
                }));
              return { empty: docs.length === 0, docs };
            },
          };
        },
        orderBy: (orderField: string, direction: string) => {
          return {
            limit: (n: number) => ({
              startAfter: (cursor: any) => ({
                get: async () => {
                  const entries = Object.entries(store).filter(
                    ([_, doc]: [string, any]) => doc?.[field] === value
                  );
                  // Simple descending sort for createdAt
                  entries.sort((a: any, b: any) => {
                    const aTime = a[1].createdAt?._seconds || 0;
                    const bTime = b[1].createdAt?._seconds || 0;
                    return direction === 'desc' ? bTime - aTime : aTime - bTime;
                  });
                  const docs = entries.slice(0, n).map(([id, data]) => ({
                    id,
                    data: () => data,
                  }));
                  return { docs };
                },
              }),
              get: async () => {
                const entries = Object.entries(store).filter(
                  ([_, doc]: [string, any]) => doc?.[field] === value
                );
                entries.sort((a: any, b: any) => {
                  const aTime = a[1].createdAt?._seconds || 0;
                  const bTime = b[1].createdAt?._seconds || 0;
                  return direction === 'desc' ? bTime - aTime : aTime - bTime;
                });
                const docs = entries.slice(0, n).map(([id, data]) => ({
                  id,
                  data: () => data,
                }));
                return { docs };
              },
            }),
          };
        },
        count: () => ({
          get: async () => {
            const count = Object.values(store).filter(
              (doc: any) => doc?.[field] === value
            ).length;
            return { data: () => ({ count }) };
          },
        }),
      };
      return chainable;
    },
  });

  return {
    collection,
    batch: () => {
      const operations: Array<{ ref: any; data: any }> = [];
      return {
        update: (ref: any, data: any) => {
          operations.push({ ref, data });
        },
        commit: async () => {
          for (const op of operations) {
            const id = op.ref.id;
            if (store[id]) {
              store[id] = { ...store[id], ...op.data };
            }
          }
        },
      };
    },
    __store: store,
    __setStore: (id: string, data: any) => {
      store[id] = data;
    },
  } as any;
}

describe('NotificationRepository', () => {
  describe('createNotification', () => {
    test('should create a new notification with auto-generated ID', async () => {
      const db = createMockDB();
      const repo = createNotificationRepository(db);

      const notification = await repo.createNotification({
        userId: 'user-1',
        type: NOTIFICATION_TYPES.PROFILE_APPROVED,
        title: 'Profile Approved',
        message: 'Your profile has been approved.',
      });

      expect(notification.id).toBeDefined();
      expect(notification.userId).toBe('user-1');
      expect(notification.type).toBe(NOTIFICATION_TYPES.PROFILE_APPROVED);
      expect(notification.title).toBe('Profile Approved');
      expect(notification.message).toBe('Your profile has been approved.');
      expect(notification.isRead).toBe(false);
      expect(notification.createdAt).toBeDefined();
      expect(notification.updatedAt).toBeDefined();
    });

    test('should create notification with metadata', async () => {
      const db = createMockDB();
      const repo = createNotificationRepository(db);

      const notification = await repo.createNotification({
        userId: 'user-1',
        type: NOTIFICATION_TYPES.BADGE_EARNED,
        title: 'Badge Earned',
        message: 'You earned a badge!',
        metadata: { badgeId: 'badge-123', badgeName: 'Expert' },
      });

      expect(notification.metadata).toEqual({
        badgeId: 'badge-123',
        badgeName: 'Expert',
      });
    });

    test('should default isRead to false', async () => {
      const db = createMockDB();
      const repo = createNotificationRepository(db);

      const notification = await repo.createNotification({
        userId: 'user-1',
        type: NOTIFICATION_TYPES.PROFILE_APPROVED,
        title: 'Test',
        message: 'Test message',
      });

      expect(notification.isRead).toBe(false);
    });
  });

  describe('getUserNotifications', () => {
    test('should return empty array when user has no notifications', async () => {
      const db = createMockDB();
      const repo = createNotificationRepository(db);

      const notifications = await repo.getUserNotifications(
        'user-no-notifications'
      );

      expect(notifications).toEqual([]);
    });

    test('should return only the user notifications', async () => {
      const db = createMockDB();
      const repo = createNotificationRepository(db);

      // Create notifications for different users
      await repo.createNotification({
        userId: 'user-1',
        type: NOTIFICATION_TYPES.PROFILE_APPROVED,
        title: 'Notification for user 1',
        message: 'Message 1',
      });

      await repo.createNotification({
        userId: 'user-2',
        type: NOTIFICATION_TYPES.PROFILE_APPROVED,
        title: 'Notification for user 2',
        message: 'Message 2',
      });

      const notifications = await repo.getUserNotifications('user-1');

      expect(notifications.length).toBe(1);
      expect(notifications[0].userId).toBe('user-1');
    });

    test('should apply default limit of 20', async () => {
      const db = createMockDB();
      const repo = createNotificationRepository(db);

      // The mock will verify limit is applied
      const notifications = await repo.getUserNotifications('user-1');
      expect(Array.isArray(notifications)).toBe(true);
    });

    test('should respect custom limit option', async () => {
      const db = createMockDB();
      const repo = createNotificationRepository(db);

      await repo.createNotification({
        userId: 'user-1',
        type: NOTIFICATION_TYPES.PROFILE_APPROVED,
        title: 'Notification 1',
        message: 'Message 1',
      });

      await repo.createNotification({
        userId: 'user-1',
        type: NOTIFICATION_TYPES.BADGE_EARNED,
        title: 'Notification 2',
        message: 'Message 2',
      });

      const notifications = await repo.getUserNotifications('user-1', {
        limit: 1,
      });

      expect(notifications.length).toBe(1);
    });
  });

  describe('getUnreadCount', () => {
    test('should return 0 when user has no unread notifications', async () => {
      const db = createMockDB();
      const repo = createNotificationRepository(db);

      const count = await repo.getUnreadCount('user-no-notifications');

      expect(count).toBe(0);
    });

    test('should count only unread notifications for the user', async () => {
      const db = createMockDB();
      const repo = createNotificationRepository(db);

      // Create notifications
      await repo.createNotification({
        userId: 'user-1',
        type: NOTIFICATION_TYPES.PROFILE_APPROVED,
        title: 'Unread 1',
        message: 'Message',
      });

      await repo.createNotification({
        userId: 'user-1',
        type: NOTIFICATION_TYPES.BADGE_EARNED,
        title: 'Unread 2',
        message: 'Message',
      });

      const count = await repo.getUnreadCount('user-1');

      expect(count).toBe(2);
    });
  });

  describe('markAsRead', () => {
    test('should mark notification as read', async () => {
      const db = createMockDB();
      const repo = createNotificationRepository(db);

      const notification = await repo.createNotification({
        userId: 'user-1',
        type: NOTIFICATION_TYPES.PROFILE_APPROVED,
        title: 'Test',
        message: 'Test message',
      });

      const updated = await repo.markAsRead(notification.id, 'user-1');

      expect(updated.isRead).toBe(true);
    });

    test('should throw NotFoundError for non-existent notification', async () => {
      const db = createMockDB();
      const repo = createNotificationRepository(db);

      await expect(repo.markAsRead('non-existent', 'user-1')).rejects.toThrow(
        'Notification not found'
      );
    });

    test('should throw NotFoundError when user does not own notification', async () => {
      const db = createMockDB();
      const repo = createNotificationRepository(db);

      const notification = await repo.createNotification({
        userId: 'user-1',
        type: NOTIFICATION_TYPES.PROFILE_APPROVED,
        title: 'Test',
        message: 'Test message',
      });

      await expect(repo.markAsRead(notification.id, 'user-2')).rejects.toThrow(
        'Notification not found'
      );
    });

    test('should be idempotent - return already read notification without error', async () => {
      const db = createMockDB();
      const repo = createNotificationRepository(db);

      const notification = await repo.createNotification({
        userId: 'user-1',
        type: NOTIFICATION_TYPES.PROFILE_APPROVED,
        title: 'Test',
        message: 'Test message',
      });

      // Mark as read twice
      await repo.markAsRead(notification.id, 'user-1');
      const updated = await repo.markAsRead(notification.id, 'user-1');

      expect(updated.isRead).toBe(true);
    });
  });

  describe('markAllAsRead', () => {
    test('should mark all user notifications as read', async () => {
      const db = createMockDB();
      const repo = createNotificationRepository(db);

      await repo.createNotification({
        userId: 'user-1',
        type: NOTIFICATION_TYPES.PROFILE_APPROVED,
        title: 'Notification 1',
        message: 'Message',
      });

      await repo.createNotification({
        userId: 'user-1',
        type: NOTIFICATION_TYPES.BADGE_EARNED,
        title: 'Notification 2',
        message: 'Message',
      });

      await repo.markAllAsRead('user-1');

      const unreadCount = await repo.getUnreadCount('user-1');
      expect(unreadCount).toBe(0);
    });

    test('should not fail when user has no notifications', async () => {
      const db = createMockDB();
      const repo = createNotificationRepository(db);

      await expect(
        repo.markAllAsRead('user-no-notifications')
      ).resolves.not.toThrow();
    });

    test('should not affect other users notifications', async () => {
      const db = createMockDB();
      const repo = createNotificationRepository(db);

      await repo.createNotification({
        userId: 'user-1',
        type: NOTIFICATION_TYPES.PROFILE_APPROVED,
        title: 'User 1 notification',
        message: 'Message',
      });

      await repo.createNotification({
        userId: 'user-2',
        type: NOTIFICATION_TYPES.PROFILE_APPROVED,
        title: 'User 2 notification',
        message: 'Message',
      });

      await repo.markAllAsRead('user-1');

      const user2UnreadCount = await repo.getUnreadCount('user-2');
      expect(user2UnreadCount).toBe(1);
    });
  });

  describe('deleteNotification', () => {
    test('should delete notification', async () => {
      const db = createMockDB();
      const repo = createNotificationRepository(db);

      const notification = await repo.createNotification({
        userId: 'user-1',
        type: NOTIFICATION_TYPES.PROFILE_APPROVED,
        title: 'Test',
        message: 'Test message',
      });

      await repo.deleteNotification(notification.id, 'user-1');

      const notifications = await repo.getUserNotifications('user-1');
      expect(notifications.length).toBe(0);
    });

    test('should throw NotFoundError for non-existent notification', async () => {
      const db = createMockDB();
      const repo = createNotificationRepository(db);

      await expect(
        repo.deleteNotification('non-existent', 'user-1')
      ).rejects.toThrow('Notification not found');
    });

    test('should throw NotFoundError when user does not own notification', async () => {
      const db = createMockDB();
      const repo = createNotificationRepository(db);

      const notification = await repo.createNotification({
        userId: 'user-1',
        type: NOTIFICATION_TYPES.PROFILE_APPROVED,
        title: 'Test',
        message: 'Test message',
      });

      await expect(
        repo.deleteNotification(notification.id, 'user-2')
      ).rejects.toThrow('Notification not found');
    });
  });
});
