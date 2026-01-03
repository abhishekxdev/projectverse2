import { schoolAssociationMiddleware } from '../../../src/middlewares/schoolAssociation';
import {
  AuthRequiredError,
  CrossSchoolAccessError,
  AccountSuspendedError,
} from '../../../src/utils/error';
import { ApiRequest } from '../../../src/types/api.types';
import { USER_ROLES, USER_STATUS } from '../../../src/config/constants';

jest.mock('../../../src/repositories/user.repository', () => {
  const getUserById = jest.fn();
  return {
    createUserRepository: jest.fn(() => ({
      getUserById,
    })),
    __getUserByIdMock: getUserById,
  };
});

const {
  __getUserByIdMock,
}: {
  __getUserByIdMock: jest.Mock;
} = require('../../../src/repositories/user.repository');

const mockGetUserById = __getUserByIdMock;

const buildReq = (overrides: Partial<ApiRequest> = {}): ApiRequest => {
  return {
    user: overrides.user,
    params: overrides.params || {},
    body: overrides.body || {},
    query: overrides.query || {},
  } as ApiRequest;
};

const runMiddleware = async (
  req: ApiRequest,
  options?: Parameters<typeof schoolAssociationMiddleware>[0]
) => {
  const middleware = schoolAssociationMiddleware(options);
  const res: any = {};
  let error: any;
  await middleware(req, res, (err?: any) => {
    if (err) error = err;
  });
  return { req, error };
};

describe('schoolAssociationMiddleware', () => {
  beforeEach(() => {
    mockGetUserById.mockReset();
  });

  it('throws when user context missing', async () => {
    const { error } = await runMiddleware(buildReq());
    expect(error).toBeInstanceOf(AuthRequiredError);
  });

  it('allows matching school for admins', async () => {
    const req = buildReq({
      user: {
        uid: 'admin-1',
        role: USER_ROLES.SCHOOL_ADMIN,
        schoolId: 'school_alpha',
      } as any,
      params: { schoolId: 'school_alpha' },
    });

    const { error } = await runMiddleware(req);
    expect(error).toBeUndefined();
    expect(req.schoolId).toBe('school_alpha');
    expect(mockGetUserById).not.toHaveBeenCalled();
  });

  it('throws when school context missing', async () => {
    const req = buildReq({
      user: {
        uid: 'admin-1',
        role: USER_ROLES.SCHOOL_ADMIN,
        schoolId: null,
      } as any,
    });
    const { error } = await runMiddleware(req);
    expect(error).toBeInstanceOf(CrossSchoolAccessError);
  });

  it('rejects mismatched school access', async () => {
    const req = buildReq({
      user: {
        uid: 'admin-1',
        role: USER_ROLES.SCHOOL_ADMIN,
        schoolId: 'school_alpha',
      } as any,
      params: { schoolId: 'school_beta' },
    });

    const { error } = await runMiddleware(req);
    expect(error).toBeInstanceOf(CrossSchoolAccessError);
  });

  it('allows platform admins to bypass by default', async () => {
    const req = buildReq({
      user: {
        uid: 'platform-1',
        role: USER_ROLES.PLATFORM_ADMIN,
        schoolId: null,
      } as any,
      query: { schoolId: 'school_alpha' },
    });

    const { error } = await runMiddleware(req);
    expect(error).toBeUndefined();
    expect(req.schoolId).toBe('school_alpha');
    expect(mockGetUserById).not.toHaveBeenCalled();
  });

  it('enforces bypass opt-out for platform admins', async () => {
    const req = buildReq({
      user: {
        uid: 'platform-1',
        role: USER_ROLES.PLATFORM_ADMIN,
        schoolId: null,
      } as any,
      query: { schoolId: 'school_alpha' },
    });

    const { error } = await runMiddleware(req, {
      allowPlatformAdminBypass: false,
    });
    expect(error).toBeInstanceOf(CrossSchoolAccessError);
  });

  it('revalidates teacher membership against repository', async () => {
    mockGetUserById.mockResolvedValue({
      schoolId: 'school_alpha',
      status: USER_STATUS.ACTIVE,
    });

    const req = buildReq({
      user: {
        uid: 'teacher-1',
        role: USER_ROLES.SCHOOL_TEACHER,
        schoolId: 'school_alpha',
      } as any,
      params: { schoolId: 'school_alpha' },
    });

    const { error } = await runMiddleware(req);
    expect(error).toBeUndefined();
    expect(mockGetUserById).toHaveBeenCalledWith('teacher-1');
  });

  it('denies teachers no longer assigned to the school', async () => {
    mockGetUserById.mockResolvedValue({
      schoolId: 'school_beta',
      status: USER_STATUS.ACTIVE,
    });

    const req = buildReq({
      user: {
        uid: 'teacher-1',
        role: USER_ROLES.SCHOOL_TEACHER,
        schoolId: 'school_alpha',
      } as any,
      params: { schoolId: 'school_alpha' },
    });

    const { error } = await runMiddleware(req);
    expect(error).toBeInstanceOf(CrossSchoolAccessError);
  });

  it('blocks suspended teachers even if membership matches', async () => {
    mockGetUserById.mockResolvedValue({
      schoolId: 'school_alpha',
      status: USER_STATUS.SUSPENDED,
    });

    const req = buildReq({
      user: {
        uid: 'teacher-1',
        role: USER_ROLES.SCHOOL_TEACHER,
        schoolId: 'school_alpha',
      } as any,
      params: { schoolId: 'school_alpha' },
    });

    const { error } = await runMiddleware(req);
    expect(error).toBeInstanceOf(AccountSuspendedError);
  });
});
