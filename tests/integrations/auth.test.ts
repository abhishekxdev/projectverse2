import request from 'supertest';
import admin from 'firebase-admin';
import {
  setupEmulators,
  getTestFirebase,
  clearEmulatorData,
  createTestUser,
  exchangeCustomTokenForIdToken,
} from '../setup/firebase-emulator';
import {
  testUsers,
  validRegistrationPayloads,
  invalidRegistrationPayloads,
} from '../fixtures/mockData';

//! IMPORTANT: Setup emulators BEFORE importing app
// This sets environment variables that src/config/firebase.ts will detect
setupEmulators();

// Now import app (which initializes Firebase in emulator mode)
import app from '../../src/app';

describe('Auth E2E Tests', () => {
  let auth: admin.auth.Auth;
  let db: FirebaseFirestore.Firestore;

  beforeAll(async () => {
    // Get Firebase instances (already initialized by app import)
    const firebase = getTestFirebase();
    auth = firebase.auth;
    db = firebase.db;

    // Initial cleanup
    await clearEmulatorData();
  });

  beforeEach(async () => {
    // Clear all data before each test for isolation
    await clearEmulatorData();
  });

  afterAll(async () => {
    await clearEmulatorData();
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/auth/me - Get current user profile
  // ─────────────────────────────────────────────────────────────
  describe('GET /api/auth/me', () => {
    it('should return 401 without Authorization header', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 with empty Authorization header', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', '');

      expect(res.status).toBe(401);
    });

    it('should return 401 with malformed Authorization header (no Bearer)', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'some-token');

      expect(res.status).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      // Firebase emulator returns 401 for invalid tokens
      expect(res.status).toBe(401);
    });

    it('should return 404 when Firebase user exists but Firestore doc missing', async () => {
      // Create user in Auth only (not in Firestore)
      const userRecord = await auth.createUser({
        email: 'nodoc@test.com',
        password: 'testPassword123',
      });

      const customToken = await auth.createCustomToken(userRecord.uid);
      const idToken = await exchangeCustomTokenForIdToken(customToken);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${idToken}`);

      expect(res.status).toBe(404);
    });

    it('should return user profile with valid token', async () => {
      const testUser = await createTestUser(auth, db, testUsers.individual);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${testUser.idToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        email: testUsers.individual.email,
        role: testUsers.individual.role,
        tier: testUsers.individual.tier,
      });
    });

    it('should return correct role for school_admin', async () => {
      const testUser = await createTestUser(auth, db, testUsers.schoolAdmin);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${testUser.idToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe('school_admin');
    });

    it('should return correct tier info', async () => {
      const testUser = await createTestUser(auth, db, {
        ...testUsers.individual,
        tier: 'school',
      });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${testUser.idToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.tier).toBe('school');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // POST /api/auth/register - Register new user
  // ─────────────────────────────────────────────────────────────
  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      // First create user in Firebase Auth (simulating client-side signup)
      const userRecord = await auth.createUser({
        email: validRegistrationPayloads.basic.email,
        password: 'testPassword123',
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          ...validRegistrationPayloads.basic,
          firebaseUid: userRecord.uid,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        email: validRegistrationPayloads.basic.email,
        displayName: validRegistrationPayloads.basic.displayName,
        tier: 'free',
      });

      // Verify user document created in Firestore
      const userDoc = await db.collection('users').doc(userRecord.uid).get();
      expect(userDoc.exists).toBe(true);
    });

    it('should register user with profile data', async () => {
      const userRecord = await auth.createUser({
        email: validRegistrationPayloads.withProfile.email,
        password: 'testPassword123',
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          ...validRegistrationPayloads.withProfile,
          firebaseUid: userRecord.uid,
        });

      expect(res.status).toBe(201);

      // Verify profile data in Firestore
      const userDoc = await db.collection('users').doc(userRecord.uid).get();
      const data = userDoc.data();
      expect(data?.profile?.subjects).toEqual(['math', 'science']);
    });

    it('should return 400 with missing firebaseUid', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(invalidRegistrationPayloads.missingUid);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 with invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(invalidRegistrationPayloads.invalidEmail);

      expect(res.status).toBe(400);
    });

    it('should return 400 with short displayName', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(invalidRegistrationPayloads.shortDisplayName);

      expect(res.status).toBe(400);
    });

    it('should return 400 with extra fields (strict validation)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(invalidRegistrationPayloads.extraFields);

      expect(res.status).toBe(400);
    });

    it('should return existing user on duplicate registration (idempotent)', async () => {
      const userRecord = await auth.createUser({
        email: 'duplicate@test.com',
        password: 'testPassword123',
      });

      const payload = {
        firebaseUid: userRecord.uid,
        email: 'duplicate@test.com',
        displayName: 'Duplicate User',
      };

      // First registration
      const res1 = await request(app).post('/api/auth/register').send(payload);
      expect(res1.status).toBe(201);

      // Second registration (should be idempotent)
      const res2 = await request(app).post('/api/auth/register').send(payload);
      // Should return 200 or 201 with existing user data
      expect([200, 201]).toContain(res2.status);
    });

    it('should fail when Firebase user does not exist', async () => {
      const res = await request(app).post('/api/auth/register').send({
        firebaseUid: 'non-existent-uid',
        email: 'ghost@test.com',
        displayName: 'Ghost User',
      });

      // This could be 401 (AuthError) or 500 depending on how error is handled
      expect([401, 500]).toContain(res.status);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PUT /api/auth/profile - Update user profile
  // ─────────────────────────────────────────────────────────────
  describe('PUT /api/auth/profile', () => {
    it('should return 401 without auth', async () => {
      const res = await request(app)
        .put('/api/auth/profile')
        .send({
          subjects: ['math'],
        });

      expect(res.status).toBe(401);
    });

    it('should update profile successfully', async () => {
      const testUser = await createTestUser(auth, db, testUsers.individual);

      const res = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${testUser.idToken}`)
        .send({
          subjects: ['math', 'physics'],
          grades: ['10', '11'],
        });

      expect(res.status).toBe(200);

      // Verify update in Firestore
      const userDoc = await db.collection('users').doc(testUser.uid).get();
      const data = userDoc.data();
      expect(data?.profile?.subjects).toEqual(['math', 'physics']);
    });

    it('should reject invalid profile fields', async () => {
      const testUser = await createTestUser(auth, db, testUsers.individual);

      const res = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${testUser.idToken}`)
        .send({
          invalidField: 'should fail',
        });

      expect(res.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/auth/admin/roles-check - Admin role verification
  // ─────────────────────────────────────────────────────────────
  describe('GET /api/auth/admin/roles-check', () => {
    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/auth/admin/roles-check');

      expect(res.status).toBe(401);
    });

    it('should return 403 for individual user', async () => {
      const testUser = await createTestUser(auth, db, testUsers.individual);

      const res = await request(app)
        .get('/api/auth/admin/roles-check')
        .set('Authorization', `Bearer ${testUser.idToken}`);

      expect(res.status).toBe(403);
    });

    it('should return 403 for school_teacher', async () => {
      const testUser = await createTestUser(auth, db, testUsers.schoolTeacher);

      const res = await request(app)
        .get('/api/auth/admin/roles-check')
        .set('Authorization', `Bearer ${testUser.idToken}`);

      expect(res.status).toBe(403);
    });

    it('should return 403 for school_admin', async () => {
      const testUser = await createTestUser(auth, db, testUsers.schoolAdmin);

      const res = await request(app)
        .get('/api/auth/admin/roles-check')
        .set('Authorization', `Bearer ${testUser.idToken}`);

      expect(res.status).toBe(403);
    });

    it('should return 200 for platform_admin', async () => {
      const testUser = await createTestUser(auth, db, testUsers.platformAdmin);

      const res = await request(app)
        .get('/api/auth/admin/roles-check')
        .set('Authorization', `Bearer ${testUser.idToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ok).toBe(true);
    });
  });
});
