import request from 'supertest';
import admin from 'firebase-admin';
import {
  setupEmulators,
  getTestFirebase,
  clearEmulatorData,
  createTestUser,
} from '../setup/firebase-emulator';
import { testUsers } from '../fixtures/mockData';

setupEmulators();

import app from '../../src/app';

describe('Platform Admin List Teachers Integration', () => {
  let auth: admin.auth.Auth;
  let db: FirebaseFirestore.Firestore;

  const seedTeacher = async (id: string, email: string, schoolId?: string) => {
    await db
      .collection('users')
      .doc(id)
      .set({
        id,
        email,
        role: 'school_teacher',
        tier: 'school',
        status: 'active',
        schoolId: schoolId ?? null,
        profileCompleted: true,
        firstName: `Teacher ${id}`,
        lastName: 'Test',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
  };

  beforeAll(async () => {
    const firebase = getTestFirebase();
    auth = firebase.auth;
    db = firebase.db;
    await clearEmulatorData();
  });

  beforeEach(async () => {
    await clearEmulatorData();
  });

  afterAll(async () => {
    await clearEmulatorData();
  });

  it('allows platform admin to list all teachers', async () => {
    const adminUser = await createTestUser(auth, db, testUsers.platformAdmin);
    await seedTeacher('teacher1', 'teacher1@test.com', 'school_alpha');
    await seedTeacher('teacher2', 'teacher2@test.com', 'school_beta');

    const res = await request(app)
      .get('/api/platform-admin/teachers')
      .set('Authorization', `Bearer ${adminUser.idToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toBeDefined();
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.total).toBe(2);
  });

  it('returns paginated results with custom page and limit', async () => {
    const adminUser = await createTestUser(auth, db, testUsers.platformAdmin);
    for (let i = 1; i <= 5; i++) {
      await seedTeacher(`teacher${i}`, `teacher${i}@test.com`);
    }

    const res = await request(app)
      .get('/api/platform-admin/teachers')
      .query({ page: 1, limit: 2 })
      .set('Authorization', `Bearer ${adminUser.idToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.limit).toBe(2);
    expect(res.body.meta.total).toBe(5);
    expect(res.body.meta.totalPages).toBe(3);
    expect(res.body.meta.hasNext).toBe(true);
    expect(res.body.meta.hasPrev).toBe(false);
  });

  it('returns empty array when no teachers exist', async () => {
    const adminUser = await createTestUser(auth, db, testUsers.platformAdmin);

    const res = await request(app)
      .get('/api/platform-admin/teachers')
      .set('Authorization', `Bearer ${adminUser.idToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.meta.total).toBe(0);
  });

  it('rejects school admin access with 403', async () => {
    const schoolAdmin = await createTestUser(auth, db, testUsers.schoolAdmin);

    const res = await request(app)
      .get('/api/platform-admin/teachers')
      .set('Authorization', `Bearer ${schoolAdmin.idToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ROLE_FORBIDDEN');
  });

  it('rejects teacher access with 403', async () => {
    const teacher = await createTestUser(auth, db, testUsers.schoolTeacher);

    const res = await request(app)
      .get('/api/platform-admin/teachers')
      .set('Authorization', `Bearer ${teacher.idToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ROLE_FORBIDDEN');
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/platform-admin/teachers');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_REQUIRED');
  });
});
