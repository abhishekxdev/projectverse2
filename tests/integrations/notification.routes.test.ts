import request from 'supertest';
import admin from 'firebase-admin';
import {
  setupEmulators,
  getTestFirebase,
  clearEmulatorData,
  createTestUser,
} from '../setup/firebase-emulator';
import { testUsers } from '../fixtures/mockData';

//! IMPORTANT: Setup emulators BEFORE importing app
setupEmulators();

// Now import app (which initializes Firebase in emulator mode)
import app from '../../src/app';

describe('Notification API E2E Tests', () => {
  let auth: admin.auth.Auth;
  let db: FirebaseFirestore.Firestore;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    const firebase = getTestFirebase();
    auth = firebase.auth;
    db = firebase.db;
    await clearEmulatorData();
  });

  beforeEach(async () => {
    await clearEmulatorData();
    // Create a test user for notification tests
    testUser = await createTestUser(auth, db, testUsers.individual);
  });

  afterAll(async () => {
    await clearEmulatorData();
  });

  /**
   * Helper function to create a notification directly in Firestore
   */
  const createTestNotification = async (
    userId: string,
    overrides: Partial<{
      type: string;
      title: string;
      message: string;
      isRead: boolean;
      metadata: Record<string, any>;
    }> = {}
  ) => {
    const notificationData = {
      userId,
      type: overrides.type || 'profile_approved',
      title: overrides.title || 'Test Notification',
      message: overrides.message || 'This is a test notification.',
      isRead: overrides.isRead ?? false,
      metadata: overrides.metadata || {},
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const ref = await db.collection('notifications').add(notificationData);
    return { id: ref.id, ...notificationData };
  };

  // ─────────────────────────────────────────────────────────────
  // GET /api/notifications - List notifications
  // ─────────────────────────────────────────────────────────────
  describe('GET /api/notifications', () => {
    it('should return 401 without Authorization header', async () => {
      const res = await request(app).get('/api/notifications');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return empty array when user has no notifications', async () => {
      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${testUser.idToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('should return user notifications', async () => {
      // Create test notifications
      await createTestNotification(testUser.uid, { title: 'Notification 1' });
      await createTestNotification(testUser.uid, { title: 'Notification 2' });

      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${testUser.idToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);
    });

    it('should not return other users notifications', async () => {
      // Create another user
      const otherUser = await createTestUser(auth, db, {
        ...testUsers.individual,
        email: 'other@test.com',
      });

      // Create notifications for both users
      await createTestNotification(testUser.uid, { title: 'My Notification' });
      await createTestNotification(otherUser.uid, {
        title: 'Other Notification',
      });

      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${testUser.idToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].title).toBe('My Notification');
    });

    it('should respect limit query parameter', async () => {
      // Create multiple notifications
      await createTestNotification(testUser.uid, { title: 'Notification 1' });
      await createTestNotification(testUser.uid, { title: 'Notification 2' });
      await createTestNotification(testUser.uid, { title: 'Notification 3' });

      const res = await request(app)
        .get('/api/notifications?limit=2')
        .set('Authorization', `Bearer ${testUser.idToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
    });

    it('should support pagination with startAfter', async () => {
      // Create notifications
      const notif1 = await createTestNotification(testUser.uid, {
        title: 'Notification 1',
      });

      await createTestNotification(testUser.uid, { title: 'Notification 2' });

      const res = await request(app)
        .get(`/api/notifications?limit=1&startAfter=${notif1.id}`)
        .set('Authorization', `Bearer ${testUser.idToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(1);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/notifications/unread-count - Get unread count
  // ─────────────────────────────────────────────────────────────
  describe('GET /api/notifications/unread-count', () => {
    it('should return 401 without Authorization header', async () => {
      const res = await request(app).get('/api/notifications/unread-count');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 0 when user has no notifications', async () => {
      const res = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${testUser.idToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.count).toBe(0);
    });

    it('should return correct unread count', async () => {
      // Create unread notifications
      await createTestNotification(testUser.uid, { isRead: false });
      await createTestNotification(testUser.uid, { isRead: false });
      await createTestNotification(testUser.uid, { isRead: true });

      const res = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${testUser.idToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(2);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PUT /api/notifications/:id/read - Mark notification as read
  // ─────────────────────────────────────────────────────────────
  describe('PUT /api/notifications/:id/read', () => {
    it('should return 401 without Authorization header', async () => {
      const res = await request(app).put('/api/notifications/some-id/read');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should mark notification as read', async () => {
      const notification = await createTestNotification(testUser.uid, {
        isRead: false,
      });

      const res = await request(app)
        .put(`/api/notifications/${notification.id}/read`)
        .set('Authorization', `Bearer ${testUser.idToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isRead).toBe(true);
    });

    it('should return 404 for non-existent notification', async () => {
      const res = await request(app)
        .put('/api/notifications/non-existent-id/read')
        .set('Authorization', `Bearer ${testUser.idToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return 404 when trying to mark other users notification as read', async () => {
      // Create another user with their notification
      const otherUser = await createTestUser(auth, db, {
        ...testUsers.individual,
        email: 'other2@test.com',
      });
      const otherNotification = await createTestNotification(otherUser.uid);

      const res = await request(app)
        .put(`/api/notifications/${otherNotification.id}/read`)
        .set('Authorization', `Bearer ${testUser.idToken}`);

      expect(res.status).toBe(404);
    });

    it('should be idempotent - marking already read notification succeeds', async () => {
      const notification = await createTestNotification(testUser.uid, {
        isRead: true,
      });

      const res = await request(app)
        .put(`/api/notifications/${notification.id}/read`)
        .set('Authorization', `Bearer ${testUser.idToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isRead).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PUT /api/notifications/read-all - Mark all notifications as read
  // ─────────────────────────────────────────────────────────────
  describe('PUT /api/notifications/read-all', () => {
    it('should return 401 without Authorization header', async () => {
      const res = await request(app).put('/api/notifications/read-all');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should mark all notifications as read', async () => {
      // Create unread notifications
      await createTestNotification(testUser.uid, { isRead: false });
      await createTestNotification(testUser.uid, { isRead: false });

      const res = await request(app)
        .put('/api/notifications/read-all')
        .set('Authorization', `Bearer ${testUser.idToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify all are read
      const countRes = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${testUser.idToken}`);

      expect(countRes.body.data.count).toBe(0);
    });

    it('should succeed even when user has no notifications', async () => {
      const res = await request(app)
        .put('/api/notifications/read-all')
        .set('Authorization', `Bearer ${testUser.idToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should not affect other users notifications', async () => {
      // Create another user with notifications
      const otherUser = await createTestUser(auth, db, {
        ...testUsers.individual,
        email: 'other3@test.com',
      });
      await createTestNotification(otherUser.uid, { isRead: false });

      // Mark current user's notifications as read
      await createTestNotification(testUser.uid, { isRead: false });
      await request(app)
        .put('/api/notifications/read-all')
        .set('Authorization', `Bearer ${testUser.idToken}`);

      // Verify other user still has unread notifications
      const otherRes = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${otherUser.idToken}`);

      expect(otherRes.body.data.count).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // DELETE /api/notifications/:id - Delete notification
  // ─────────────────────────────────────────────────────────────
  describe('DELETE /api/notifications/:id', () => {
    it('should return 401 without Authorization header', async () => {
      const res = await request(app).delete('/api/notifications/some-id');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should delete notification', async () => {
      const notification = await createTestNotification(testUser.uid);

      const res = await request(app)
        .delete(`/api/notifications/${notification.id}`)
        .set('Authorization', `Bearer ${testUser.idToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify notification is deleted
      const getRes = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${testUser.idToken}`);

      expect(getRes.body.data.length).toBe(0);
    });

    it('should return 404 for non-existent notification', async () => {
      const res = await request(app)
        .delete('/api/notifications/non-existent-id')
        .set('Authorization', `Bearer ${testUser.idToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return 404 when trying to delete other users notification', async () => {
      // Create another user with their notification
      const otherUser = await createTestUser(auth, db, {
        ...testUsers.individual,
        email: 'other4@test.com',
      });
      const otherNotification = await createTestNotification(otherUser.uid);

      const res = await request(app)
        .delete(`/api/notifications/${otherNotification.id}`)
        .set('Authorization', `Bearer ${testUser.idToken}`);

      expect(res.status).toBe(404);
    });
  });
});
