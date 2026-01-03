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

describe('School Admin Guard Integration', () => {
  let auth: admin.auth.Auth;
  let db: FirebaseFirestore.Firestore;

  const seedSchool = async (id: string, adminId: string) => {
    await db
      .collection('schools')
      .doc(id)
      .set({
        id,
        name: id,
        adminId,
        admins: [adminId],
        contactEmail: `${id}@test.com`,
        seats: { total: 10, used: 0 },
        teacherLimit: 10,
        status: 'active',
        verificationStatus: 'pending',
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

  it('allows a school admin to access their own school resources', async () => {
    const adminUser = await createTestUser(auth, db, testUsers.schoolAdmin);
    await seedSchool(testUsers.schoolAdmin.schoolId as string, adminUser.uid);

    const res = await request(app)
      .get('/api/admin/school/teachers')
      .query({ schoolId: testUsers.schoolAdmin.schoolId })
      .set('Authorization', `Bearer ${adminUser.idToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('rejects school admins attempting to access another school', async () => {
    const adminUser = await createTestUser(auth, db, testUsers.schoolAdmin);
    await seedSchool('school_alpha', adminUser.uid);
    await seedSchool('school_beta', 'other-admin');

    const res = await request(app)
      .get('/api/admin/school/teachers')
      .query({ schoolId: 'school_beta' })
      .set('Authorization', `Bearer ${adminUser.idToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CROSS_SCHOOL_ACCESS_DENIED');
  });

  it('rejects teachers trying to hit admin-only routes', async () => {
    const teacherUser = await createTestUser(auth, db, testUsers.schoolTeacher);
    await seedSchool(testUsers.schoolTeacher.schoolId as string, 'some-admin');

    const res = await request(app)
      .get('/api/admin/school/teachers')
      .query({ schoolId: testUsers.schoolTeacher.schoolId })
      .set('Authorization', `Bearer ${teacherUser.idToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ROLE_FORBIDDEN');
  });

  it('allows platform admins to bypass school association when requested', async () => {
    const adminUser = await createTestUser(auth, db, testUsers.platformAdmin);
    await seedSchool('school_beta', 'other-admin');

    const res = await request(app)
      .get('/api/admin/school/teachers')
      .query({ schoolId: 'school_beta' })
      .set('Authorization', `Bearer ${adminUser.idToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
