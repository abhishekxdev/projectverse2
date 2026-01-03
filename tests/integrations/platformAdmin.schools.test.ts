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

describe('Platform Admin Schools Integration', () => {
  let auth: admin.auth.Auth;
  let db: FirebaseFirestore.Firestore;

  const seedSchool = async (
    id: string,
    name: string,
    overrides: Partial<Record<string, any>> = {}
  ) => {
    await db
      .collection('schools')
      .doc(id)
      .set({
        id,
        name,
        adminId: overrides.adminId ?? `admin-${id}`,
        teacherLimit: overrides.teacherLimit ?? 10,
        seats:
          overrides.seats ??
          ({
            total: overrides.teacherLimit ?? 10,
            used: 0,
          } as { total: number; used: number }),
        status: overrides.status ?? 'active',
        verificationStatus: overrides.verificationStatus ?? 'verified',
        admins: overrides.admins ?? [`admin-${id}`],
        nameLower: name.toLowerCase(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...overrides,
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

  it('allows platform admin to list all schools', async () => {
    const adminUser = await createTestUser(auth, db, testUsers.platformAdmin);
    await seedSchool('school_alpha', 'Alpha Academy');
    await seedSchool('school_beta', 'Beta Academy');

    const res = await request(app)
      .get('/api/platform-admin/schools')
      .set('Authorization', `Bearer ${adminUser.idToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.map((s: any) => s.id).sort()).toEqual([
      'school_alpha',
      'school_beta',
    ]);
  });

  it('allows platform admin to update school seat totals without altering usage', async () => {
    const adminUser = await createTestUser(auth, db, testUsers.platformAdmin);
    await seedSchool('school_alpha', 'Alpha Academy', {
      teacherLimit: 5,
      seats: { total: 5, used: 2 },
    });

    const res = await request(app)
      .put('/api/platform-admin/schools/school_alpha/seats')
      .set('Authorization', `Bearer ${adminUser.idToken}`)
      .send({ totalSeats: 12 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.seats.total).toBe(12);
    expect(res.body.data.seats.used).toBe(2);
    expect(res.body.data.teacherLimit).toBe(12);
  });

  it('rejects reducing seats below current usage', async () => {
    const adminUser = await createTestUser(auth, db, testUsers.platformAdmin);
    await seedSchool('school_alpha', 'Alpha Academy', {
      teacherLimit: 5,
      seats: { total: 5, used: 4 },
    });

    const res = await request(app)
      .put('/api/platform-admin/schools/school_alpha/seats')
      .set('Authorization', `Bearer ${adminUser.idToken}`)
      .send({ totalSeats: 3 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects non-platform admins from accessing school list', async () => {
    const schoolAdmin = await createTestUser(auth, db, testUsers.schoolAdmin);

    const res = await request(app)
      .get('/api/platform-admin/schools')
      .set('Authorization', `Bearer ${schoolAdmin.idToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ROLE_FORBIDDEN');
  });
});
