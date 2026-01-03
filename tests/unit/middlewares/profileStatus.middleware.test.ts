import {
  requireApprovedProfile,
  requireCredentialsAccess,
} from '../../../src/middlewares/profileStatus';
import { USER_STATUS } from '../../../src/config/constants';
import { ApiRequest } from '../../../src/types/api.types';

const buildRequest = (status?: string): Partial<ApiRequest> => ({
  user: status
    ? ({
        id: 'user-1',
        email: 'user@example.com',
        tier: 'free',
        role: 'school_teacher',
        status,
      } as any)
    : undefined,
});

describe('profileStatus middlewares', () => {
  const res = {} as any;
  const next = jest.fn();

  beforeEach(() => {
    next.mockReset();
  });

  it('blocks pending user from approved profile middleware', () => {
    const req = buildRequest(USER_STATUS.PENDING) as ApiRequest;
    requireApprovedProfile(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('MODULE_ACCESS_DENIED');
  });

  it('allows active user through approved profile middleware', () => {
    const req = buildRequest(USER_STATUS.ACTIVE) as ApiRequest;
    requireApprovedProfile(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('blocks pending user from credentials access middleware', () => {
    const req = buildRequest(USER_STATUS.PENDING) as ApiRequest;
    requireCredentialsAccess(req, res, next);

    const error = next.mock.calls[0][0];
    expect(error.code).toBe('CREDENTIALS_ACCESS_DENIED');
  });
});
