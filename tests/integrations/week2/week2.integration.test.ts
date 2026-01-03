import request from 'supertest';

const submitProfileForApprovalMock = jest
  .fn()
  .mockResolvedValue({ status: 'pending' });
const listPendingProfilesMock = jest
  .fn()
  .mockResolvedValue([{ id: 'user-1', status: 'pending' }]);
const approveProfileMock = jest.fn().mockResolvedValue({ status: 'active' });
const rejectProfileMock = jest.fn().mockResolvedValue({ status: 'rejected' });

jest.mock('../../../src/services/profileApproval.service', () => ({
  createProfileApprovalService: jest.fn(() => ({
    submitProfileForApproval: submitProfileForApprovalMock,
    listPendingProfiles: listPendingProfilesMock,
    approveProfile: approveProfileMock,
    rejectProfile: rejectProfileMock,
  })),
}));

const suspendSchoolMock = jest
  .fn()
  .mockResolvedValue({ id: 'school-1', status: 'suspended' });
const unsuspendSchoolMock = jest
  .fn()
  .mockResolvedValue({ id: 'school-1', status: 'active' });
const suspendTeacherMock = jest
  .fn()
  .mockResolvedValue({ id: 'user-2', status: 'suspended' });
const unsuspendTeacherMock = jest
  .fn()
  .mockResolvedValue({ id: 'user-2', status: 'active' });

jest.mock('../../../src/services/suspension.service', () => ({
  createSuspensionService: jest.fn(() => ({
    suspendSchool: suspendSchoolMock,
    unsuspendSchool: unsuspendSchoolMock,
    suspendTeacher: suspendTeacherMock,
    unsuspendTeacher: unsuspendTeacherMock,
  })),
}));

const submitLeadMock = jest.fn().mockResolvedValue({ id: 'lead-1' });
const listLeadsMock = jest.fn().mockResolvedValue({
  items: [],
  total: 0,
  page: 1,
  pageSize: 20,
  hasMore: false,
});
const updateLeadStatusMock = jest
  .fn()
  .mockResolvedValue({ id: 'lead-1', status: 'contacted' });

jest.mock('../../../src/services/lead.service', () => ({
  createLeadService: jest.fn(() => ({
    submitUpgradeRequest: submitLeadMock,
    listUpgradeRequests: listLeadsMock,
    updateLeadStatus: updateLeadStatusMock,
  })),
}));

const authMiddlewareStub = jest.fn((req: any, _res: any, next: any) => {
  const role = (req.headers['x-test-role'] as string) || 'school_teacher';
  const status = (req.headers['x-test-status'] as string) || 'active';
  const userId = (req.headers['x-test-user'] as string) || 'user-1';
  req.user = {
    id: userId,
    email: `${userId}@example.com`,
    role,
    tier: 'free',
    status,
    schoolId: req.headers['x-test-school'] || null,
  };
  next();
});

jest.mock('../../../src/middlewares/auth', () => ({
  authMiddleware: (req: any, res: any, next: any) =>
    authMiddlewareStub(req, res, next),
  optionalAuthMiddleware: (_req: any, _res: any, next: any) => next(),
}));

import app from '../../../src/app';

describe('Week 2 governance integrations', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('submits profile for approval', async () => {
    const response = await request(app)
      .post('/api/profile/submit-approval')
      .set('x-test-role', 'school_teacher')
      .set('x-test-user', 'teacher-1');

    expect(response.status).toBe(200);
    expect(submitProfileForApprovalMock).toHaveBeenCalled();
    expect(response.body.data.status).toBe('pending');
  });

  it('lists pending approvals for admins', async () => {
    const response = await request(app)
      .get('/api/admin/approvals/pending')
      .set('x-test-role', 'platform_admin');

    expect(response.status).toBe(200);
    expect(listPendingProfilesMock).toHaveBeenCalled();
  });

  it('approves pending profile', async () => {
    const response = await request(app)
      .put('/api/admin/approvals/user-1/approve')
      .set('x-test-role', 'platform_admin');

    expect(response.status).toBe(200);
    expect(approveProfileMock).toHaveBeenCalledWith({
      userId: 'user-1',
      reviewerId: 'user-1',
    });
  });

  it('suspends school via platform admin endpoint', async () => {
    const response = await request(app)
      .post('/api/platform-admin/schools/school-1/suspend')
      .set('x-test-role', 'platform_admin')
      .send({ reason: 'Policy' });

    expect(response.status).toBe(200);
    expect(suspendSchoolMock).toHaveBeenCalled();
  });

  it('captures upgrade lead publicly', async () => {
    const response = await request(app)
      .post('/api/leads/upgrade-request')
      .send({
        email: 'principal@school.edu',
        school: 'Test High School',
      });

    expect(response.status).toBe(201);
    expect(submitLeadMock).toHaveBeenCalled();
    expect(response.body.data.leadId).toBe('lead-1');
  });

  it('lists leads for platform admin', async () => {
    const response = await request(app)
      .get('/api/platform-admin/leads')
      .set('x-test-role', 'platform_admin');

    expect(response.status).toBe(200);
    expect(listLeadsMock).toHaveBeenCalled();
  });
});
