import request from 'supertest';
import app from '../../src/app';
import { getFirestore } from '../../src/config/firebase';
import { getAuth } from 'firebase-admin/auth';
import { USER_ROLES, USER_STATUS } from '../../src/config/constants';

describe('School Admin Suspension Tests', () => {
  let schoolAdminToken: string;
  let schoolAdminId: string;
  let schoolId: string;
  let teacherId: string;
  let teacherToken: string;
  let otherSchoolId: string;
  let otherSchoolTeacherId: string;

  const db = getFirestore();
  const auth = getAuth();

  beforeAll(async () => {
    // Create school 1
    const school1Ref = await db.collection('schools').add({
      name: 'Test School 1',
      status: 'active',
      seats: { total: 100, occupied: 0 },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    schoolId = school1Ref.id;

    // Create school admin
    const adminUser = await auth.createUser({
      email: 'schooladmin@test.com',
      password: 'Test123!',
      displayName: 'School Admin',
    });
    schoolAdminId = adminUser.uid;

    await db.collection('users').doc(schoolAdminId).set({
      email: 'schooladmin@test.com',
      role: USER_ROLES.SCHOOL_ADMIN,
      schoolId: schoolId,
      status: USER_STATUS.ACTIVE,
      profile: {
        firstName: 'School',
        lastName: 'Admin',
        schoolEmail: 'admin@school.edu',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Get school admin token
    const adminTokenResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: 'schooladmin@test.com', password: 'Test123!' });
    schoolAdminToken = adminTokenResponse.body.data.token;

    // Create teacher in school 1
    const teacherUser = await auth.createUser({
      email: 'teacher1@test.com',
      password: 'Test123!',
      displayName: 'Teacher One',
    });
    teacherId = teacherUser.uid;

    await db.collection('users').doc(teacherId).set({
      email: 'teacher1@test.com',
      role: USER_ROLES.SCHOOL_TEACHER,
      schoolId: schoolId,
      status: USER_STATUS.ACTIVE,
      profile: {
        firstName: 'Teacher',
        lastName: 'One',
        schoolEmail: 'teacher1@school.edu',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Get teacher token
    const teacherTokenResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: 'teacher1@test.com', password: 'Test123!' });
    teacherToken = teacherTokenResponse.body.data.token;

    // Create school 2 and teacher in it (for cross-school test)
    const school2Ref = await db.collection('schools').add({
      name: 'Test School 2',
      status: 'active',
      seats: { total: 50, occupied: 0 },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    otherSchoolId = school2Ref.id;

    const otherTeacherUser = await auth.createUser({
      email: 'teacher2@test.com',
      password: 'Test123!',
      displayName: 'Teacher Two',
    });
    otherSchoolTeacherId = otherTeacherUser.uid;

    await db.collection('users').doc(otherSchoolTeacherId).set({
      email: 'teacher2@test.com',
      role: USER_ROLES.SCHOOL_TEACHER,
      schoolId: otherSchoolId,
      status: USER_STATUS.ACTIVE,
      profile: {
        firstName: 'Teacher',
        lastName: 'Two',
        schoolEmail: 'teacher2@school2.edu',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterAll(async () => {
    // Clean up
    await db.collection('users').doc(schoolAdminId).delete();
    await db.collection('users').doc(teacherId).delete();
    await db.collection('users').doc(otherSchoolTeacherId).delete();
    await db.collection('schools').doc(schoolId).delete();
    await db.collection('schools').doc(otherSchoolId).delete();
    await auth.deleteUser(schoolAdminId);
    await auth.deleteUser(teacherId);
    await auth.deleteUser(otherSchoolTeacherId);

    // Clean up audit logs
    const auditLogs = await db.collection('suspension_audit_logs').get();
    for (const doc of auditLogs.docs) {
      await doc.ref.delete();
    }
  });

  describe('POST /api/admin/school/teachers/:id/suspend', () => {
    it('should allow school admin to suspend teacher in their school', async () => {
      const response = await request(app)
        .post(`/api/admin/school/teachers/${teacherId}/suspend`)
        .set('Authorization', `Bearer ${schoolAdminToken}`)
        .send({ reason: 'Violating school policy regarding attendance' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe(USER_STATUS.SUSPENDED);
      expect(response.body.data.suspension.reason).toBe(
        'Violating school policy regarding attendance'
      );

      // Verify in database
      const teacherDoc = await db.collection('users').doc(teacherId).get();
      const teacherData = teacherDoc.data();
      expect(teacherData?.status).toBe(USER_STATUS.SUSPENDED);
    });

    it('should reject suspension without reason', async () => {
      const response = await request(app)
        .post(`/api/admin/school/teachers/${teacherId}/suspend`)
        .set('Authorization', `Bearer ${schoolAdminToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject suspension with too short reason', async () => {
      const response = await request(app)
        .post(`/api/admin/school/teachers/${teacherId}/suspend`)
        .set('Authorization', `Bearer ${schoolAdminToken}`)
        .send({ reason: 'Short' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject cross-school suspension attempt', async () => {
      const response = await request(app)
        .post(`/api/admin/school/teachers/${otherSchoolTeacherId}/suspend`)
        .set('Authorization', `Bearer ${schoolAdminToken}`)
        .send({ reason: 'Attempting cross-school suspension' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('only suspend teachers in your school');
    });

    it('should reject suspension by non-admin', async () => {
      const response = await request(app)
        .post(`/api/admin/school/teachers/${teacherId}/suspend`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ reason: 'Unauthorized suspension attempt' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/admin/school/teachers/:id/unsuspend', () => {
    beforeEach(async () => {
      // Ensure teacher is suspended before unsuspend tests
      await db.collection('users').doc(teacherId).update({
        status: USER_STATUS.SUSPENDED,
        suspension: {
          suspendedBy: schoolAdminId,
          suspendedAt: new Date(),
          reason: 'Test suspension',
          originalStatus: USER_STATUS.ACTIVE,
        },
      });
    });

    it('should allow school admin to unsuspend teacher in their school', async () => {
      const response = await request(app)
        .post(`/api/admin/school/teachers/${teacherId}/unsuspend`)
        .set('Authorization', `Bearer ${schoolAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe(USER_STATUS.ACTIVE);
      expect(response.body.data.suspension).toBeUndefined();

      // Verify in database
      const teacherDoc = await db.collection('users').doc(teacherId).get();
      const teacherData = teacherDoc.data();
      expect(teacherData?.status).toBe(USER_STATUS.ACTIVE);
      expect(teacherData?.suspension).toBeUndefined();
    });

    it('should reject cross-school unsuspension attempt', async () => {
      // Suspend the other school's teacher first
      await db.collection('users').doc(otherSchoolTeacherId).update({
        status: USER_STATUS.SUSPENDED,
        suspension: {
          suspendedBy: 'some-admin-id',
          suspendedAt: new Date(),
          reason: 'Test suspension',
          originalStatus: USER_STATUS.ACTIVE,
        },
      });

      const response = await request(app)
        .post(`/api/admin/school/teachers/${otherSchoolTeacherId}/unsuspend`)
        .set('Authorization', `Bearer ${schoolAdminToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('only unsuspend teachers in your school');
    });

    it('should reject unsuspending teacher suspended due to school suspension', async () => {
      // Update teacher to be suspended due to school suspension
      await db.collection('users').doc(teacherId).update({
        status: USER_STATUS.SUSPENDED,
        suspension: {
          suspendedBy: 'platform-admin-id',
          suspendedAt: new Date(),
          reason: 'School suspended: School violated policy',
          originalStatus: USER_STATUS.ACTIVE,
        },
      });

      const response = await request(app)
        .post(`/api/admin/school/teachers/${teacherId}/unsuspend`)
        .set('Authorization', `Bearer ${schoolAdminToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('school suspension');
      expect(response.body.error.message).toContain('Contact platform admin');
    });
  });
});
