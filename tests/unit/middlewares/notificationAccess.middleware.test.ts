import { NextFunction, Response } from 'express';
import { ApiRequest } from '../../../src/types/api.types';
import { AuthRequiredError } from '../../../src/utils/error';
import { USER_ROLES } from '../../../src/config/constants';

const mockInnerMiddleware = jest.fn(
  (_req: ApiRequest, _res: Response, next: NextFunction) => next()
);
const mockSchoolAssociationFactory = jest.fn(
  (_options?: any) => mockInnerMiddleware
);

jest.mock('../../../src/middlewares/schoolAssociation', () => ({
  schoolAssociationMiddleware: jest.fn((options?: any) =>
    mockSchoolAssociationFactory(options)
  ),
}));

const {
  notificationAccessGuard,
} = require('../../../src/middlewares/notificationAccess');

describe('notificationAccessGuard', () => {
  const buildReq = (overrides: Partial<ApiRequest> = {}): ApiRequest =>
    ({
      user: overrides.user,
      body: overrides.body || {},
      query: overrides.query || {},
    } as ApiRequest);

  const runGuard = async (req: ApiRequest) => {
    const res = {} as Response;
    let capturedError: any;
    await notificationAccessGuard(req, res, (err?: any) => {
      if (err) capturedError = err;
    });
    return capturedError;
  };

  beforeEach(() => {
    mockInnerMiddleware.mockClear();
    mockSchoolAssociationFactory.mockClear();
  });

  it('throws AuthRequiredError when user context missing', async () => {
    const error = await runGuard(buildReq());
    expect(error).toBeInstanceOf(AuthRequiredError);
  });

  it('passes through for individual users without invoking school guard', async () => {
    const error = await runGuard(
      buildReq({
        user: {
          uid: 'ind-1',
          role: USER_ROLES.INDIVIDUAL,
        } as any,
      })
    );

    expect(error).toBeUndefined();
    expect(mockInnerMiddleware).not.toHaveBeenCalled();
  });

  it('enforces school association for school admins', async () => {
    const error = await runGuard(
      buildReq({
        user: {
          uid: 'admin-1',
          role: USER_ROLES.SCHOOL_ADMIN,
          schoolId: 'school_alpha',
        } as any,
      })
    );

    expect(error).toBeUndefined();
    expect(mockInnerMiddleware).toHaveBeenCalledTimes(1);
  });
});
