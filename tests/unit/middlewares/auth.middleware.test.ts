import { authMiddleware } from '../../../src/middlewares/auth';
import {
  AuthRequiredError,
  AuthTokenInvalidError,
  AuthUserNotFoundError,
} from '../../../src/utils/error';
import { ApiRequest } from '../../../src/types/api.types';

const mockSyncClaimsFromUser = jest.fn();

jest.mock('../../../src/config/firebase', () => {
  return {
    auth: { verifyIdToken: jest.fn() },
    db: {
      collection: jest.fn(),
    },
  };
});

jest.mock('../../../src/services/auth.services', () => ({
  authService: {
    syncClaimsFromUser: jest.fn(),
  },
}));

const { auth: firebaseAuth, db } = require('../../../src/config/firebase');
const { authService } = require('../../../src/services/auth.services');

authService.syncClaimsFromUser = mockSyncClaimsFromUser;

const buildReq = (header?: string): ApiRequest => {
  return {
    headers: header ? { authorization: header } : {},
  } as any;
};

const run = async (req: ApiRequest) => {
  const res: any = {};
  let error: any;
  await authMiddleware(req, res, (err?: any) => {
    if (err) error = err;
  });
  return { req, error };
};

const mockUserDoc = (data: Record<string, any>) => {
  const getMock = jest.fn().mockResolvedValue({
    exists: true,
    id: 'u1',
    data: () => data,
  });
  (db.collection as jest.Mock).mockReturnValue({
    doc: () => ({ get: getMock }),
  });
  return getMock;
};

describe('authMiddleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSyncClaimsFromUser.mockReset();
  });

  it('attaches user context when claims are present', async () => {
    (firebaseAuth.verifyIdToken as jest.Mock).mockResolvedValue({
      uid: 'u1',
      email: 't@e.com',
      role: 'school_admin',
      schoolId: 'school_alpha',
      status: 'active',
    });
    mockUserDoc({
      role: 'school_admin',
      tier: 'school',
      email: 't@e.com',
      schoolId: 'school_alpha',
      status: 'active',
      usage: { assessmentsTakenMonth: 1, tutorMessagesMonth: 2 },
    });

    const { req, error } = await run(buildReq('Bearer valid'));

    expect(error).toBeUndefined();
    expect(req.user?.role).toBe('school_admin');
    expect(req.schoolId).toBe('school_alpha');
    expect(req.status).toBe('active');
    expect(req.tier?.tier).toBe('school');
    expect(req.usage?.tutorMessagesMonth).toBe(2);
    expect(mockSyncClaimsFromUser).not.toHaveBeenCalled();
  });

  it('refreshes claims when missing from token', async () => {
    (firebaseAuth.verifyIdToken as jest.Mock).mockResolvedValue({
      uid: 'u1',
      email: 't@e.com',
    });
    mockUserDoc({
      role: 'school_teacher',
      tier: 'school',
      email: 't@e.com',
      schoolId: 'school_alpha',
      status: 'active',
      usage: {},
    });
    mockSyncClaimsFromUser.mockResolvedValue({
      updatedAt: '2025-12-09T00:00:00.000Z',
    });

    const { req, error } = await run(buildReq('Bearer valid'));

    expect(error).toBeUndefined();
    expect(mockSyncClaimsFromUser).toHaveBeenCalledWith('u1');
    expect(req.claimsUpdatedAt).toBe('2025-12-09T00:00:00.000Z');
    expect(req.role).toBe('school_teacher');
  });

  it('fails on missing header', async () => {
    const { error } = await run(buildReq());
    expect(error).toBeInstanceOf(AuthRequiredError);
  });

  it('fails on malformed header', async () => {
    const { error } = await run(buildReq('Bad token'));
    expect(error).toBeInstanceOf(AuthTokenInvalidError);
  });

  it('fails when user doc missing', async () => {
    (firebaseAuth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: 'u2' });
    const getMock = jest.fn().mockResolvedValue({ exists: false });
    (db.collection as jest.Mock).mockReturnValue({
      doc: () => ({ get: getMock }),
    });

    const { error } = await run(buildReq('Bearer valid'));
    expect(error).toBeInstanceOf(AuthUserNotFoundError);
  });

  it('fails on invalid token', async () => {
    (firebaseAuth.verifyIdToken as jest.Mock).mockRejectedValue(
      new Error('invalid')
    );
    const { error } = await run(buildReq('Bearer bad'));
    expect(error).toBeInstanceOf(AuthTokenInvalidError);
  });

  it('allows suspended users through with isSuspended field set', async () => {
    (firebaseAuth.verifyIdToken as jest.Mock).mockResolvedValue({
      uid: 'u3',
      email: 's@e.com',
      role: 'school_teacher',
      schoolId: 'school_alpha',
      status: 'suspended',
    });
    mockUserDoc({
      role: 'school_teacher',
      tier: 'school',
      email: 's@e.com',
      schoolId: 'school_alpha',
      status: 'suspended',
      isSuspended: true,
      usage: {},
    });

    const { error, req } = await run(buildReq('Bearer valid'));
    expect(error).toBeUndefined();
    expect(req.user?.status).toBe('suspended');
    expect(req.user?.isSuspended).toBe(true);
  });
});
