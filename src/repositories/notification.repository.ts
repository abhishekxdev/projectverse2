import { firestore } from 'firebase-admin';
import { getFirestore } from '../config/firebase';
import { NotFoundError } from '../utils/error';
import {
  Notification,
  CreateNotificationInput,
  NotificationQueryOptions,
} from '../types/notification.types';

const COLLECTION = 'notifications';

/**
 * Normalize notification data from Firestore document
 */
const normalizeNotification = (
  id: string,
  data: FirebaseFirestore.DocumentData
): Notification => {
  return {
    id,
    userId: data.userId,
    type: data.type,
    title: data.title,
    message: data.message,
    isRead: data.isRead ?? false,
    metadata: data.metadata,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
};

/**
 * Notification repository interface
 */
export interface NotificationRepository {
  /**
   * Create a new notification
   */
  createNotification(data: CreateNotificationInput): Promise<Notification>;

  /**
   * Get user's notifications with pagination
   */
  getUserNotifications(
    userId: string,
    options?: NotificationQueryOptions
  ): Promise<Notification[]>;

  /**
   * Get count of unread notifications for a user
   */
  getUnreadCount(userId: string): Promise<number>;

  /**
   * Mark a single notification as read
   */
  markAsRead(notificationId: string, userId: string): Promise<Notification>;

  /**
   * Mark all user's notifications as read
   */
  markAllAsRead(userId: string): Promise<void>;

  /**
   * Delete a notification
   */
  deleteNotification(notificationId: string, userId: string): Promise<void>;
}

/**
 * Factory function to create a notification repository instance
 */
export function createNotificationRepository(
  db: FirebaseFirestore.Firestore = getFirestore()
): NotificationRepository {
  const col = db.collection(COLLECTION);
  const hasTransactions = typeof (db as any).runTransaction === 'function';

  const runTransaction = async <T>(
    fn: (tx: FirebaseFirestore.Transaction) => Promise<T>
  ): Promise<T> => {
    if (hasTransactions) {
      return db.runTransaction(fn);
    }

    const shimTx = {
      async get(target: { get: () => Promise<any> }) {
        return target.get();
      },
      async getAll(...targets: Array<{ get: () => Promise<any> }>) {
        return Promise.all(targets.map((ref) => ref.get()));
      },
      update(ref: { update: (data: any) => Promise<void> }, data: any) {
        return ref.update(data);
      },
      delete(ref: { delete: () => Promise<void> }) {
        return ref.delete();
      },
      set(
        ref: { set: (data: any, options?: any) => Promise<void> },
        data: any,
        options?: any
      ) {
        return ref.set(data, options);
      },
      create(
        ref: { create?: (data: any) => Promise<void>; set: (data: any, options?: any) => Promise<void> },
        data: any
      ) {
        if (typeof ref.create === 'function') {
          return ref.create(data);
        }
        return ref.set(data, { merge: false });
      },
    } as unknown as FirebaseFirestore.Transaction;

    return fn(shimTx);
  };

  return {
    async createNotification(
      data: CreateNotificationInput
    ): Promise<Notification> {
      const now = firestore.Timestamp.now();
      const ref = col.doc(); // Auto-generate ID

      const notificationDoc = {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        isRead: false,
        metadata: data.metadata ?? {},
        createdAt: now,
        updatedAt: now,
      };

      await ref.set(notificationDoc);

      return normalizeNotification(ref.id, notificationDoc);
    },

    async getUserNotifications(
      userId: string,
      options?: NotificationQueryOptions
    ): Promise<Notification[]> {
      const limit = options?.limit ?? 20;

      let query: FirebaseFirestore.Query = col
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(limit);

      // Handle cursor-based pagination
      if (options?.startAfter) {
        const cursorDoc = await col.doc(options.startAfter).get();
        if (cursorDoc.exists) {
          query = query.startAfter(cursorDoc);
        }
      }

      const snapshot = await query.get();
      return snapshot.docs.map((doc) =>
        normalizeNotification(doc.id, doc.data())
      );
    },

    async getUnreadCount(userId: string): Promise<number> {
      const snapshot = await col
        .where('userId', '==', userId)
        .where('isRead', '==', false)
        .count()
        .get();

      return snapshot.data().count;
    },

    async markAsRead(
      notificationId: string,
      userId: string
    ): Promise<Notification> {
      return runTransaction(async (tx) => {
        const ref = col.doc(notificationId);
        const doc = await tx.get(ref);

        if (!doc.exists) {
          throw new NotFoundError('Notification not found');
        }

        const data = doc.data()!;
        if (data.userId !== userId) {
          throw new NotFoundError('Notification not found');
        }

        if (data.isRead) {
          return normalizeNotification(doc.id, data);
        }

        const now = firestore.Timestamp.now();
        tx.update(ref, {
          isRead: true,
          updatedAt: now,
        });

        return normalizeNotification(doc.id, {
          ...data,
          isRead: true,
          updatedAt: now,
        });
      });
    },

    async markAllAsRead(userId: string): Promise<void> {
      await runTransaction(async (tx) => {
        const now = firestore.Timestamp.now();
        const unreadQuery = col
          .where('userId', '==', userId)
          .where('isRead', '==', false);

        const snapshot = await tx.get(unreadQuery);
        if (snapshot.empty) {
          return;
        }

        snapshot.docs.forEach((doc) =>
          tx.update(doc.ref, {
            isRead: true,
            updatedAt: now,
          })
        );
      });
    },

    async deleteNotification(
      notificationId: string,
      userId: string
    ): Promise<void> {
      await runTransaction(async (tx) => {
        const ref = col.doc(notificationId);
        const doc = await tx.get(ref);

        if (!doc.exists) {
          throw new NotFoundError('Notification not found');
        }

        const data = doc.data()!;
        if (data.userId !== userId) {
          throw new NotFoundError('Notification not found');
        }

        tx.delete(ref);
      });
    },
  };
}
