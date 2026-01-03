import { checkUserNotSuspended } from '../../../src/middlewares/suspension';
import { USER_STATUS } from '../../../src/config/constants';
import { ApiRequest } from '../../../src/types/api.types';
import { Response } from 'express';

describe('checkUserNotSuspended middleware', () => {
  const res = {} as Response;
  const next = jest.fn();

  beforeEach(() => {
    next.mockReset();
  });

  describe('suspended user access control', () => {
    it('allows GET requests for suspended users', async () => {
      const req = {
        method: 'GET',
        user: {
          id: 'user-1',
          email: 'user@example.com',
          status: USER_STATUS.ACTIVE,
          isSuspended: true,
        },
        params: {},
      } as unknown as ApiRequest;

      await checkUserNotSuspended(req, res, next);

      expect(next).toHaveBeenCalledWith(); // No error passed
    });

    it('blocks POST requests for suspended users', async () => {
      const req = {
        method: 'POST',
        user: {
          id: 'user-1',
          email: 'user@example.com',
          status: USER_STATUS.ACTIVE,
          isSuspended: true,
        },
        params: {},
      } as unknown as ApiRequest;

      await checkUserNotSuspended(req, res, next);

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe('USER_SUSPENDED_WRITE_BLOCKED');
    });

    it('blocks PUT requests for suspended users', async () => {
      const req = {
        method: 'PUT',
        user: {
          id: 'user-1',
          email: 'user@example.com',
          status: USER_STATUS.ACTIVE,
          isSuspended: true,
        },
        params: {},
      } as unknown as ApiRequest;

      await checkUserNotSuspended(req, res, next);

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe('USER_SUSPENDED_WRITE_BLOCKED');
    });

    it('blocks DELETE requests for suspended users', async () => {
      const req = {
        method: 'DELETE',
        user: {
          id: 'user-1',
          email: 'user@example.com',
          status: USER_STATUS.ACTIVE,
          isSuspended: true,
        },
        params: {},
      } as unknown as ApiRequest;

      await checkUserNotSuspended(req, res, next);

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe('USER_SUSPENDED_WRITE_BLOCKED');
    });

    it('allows all requests for non-suspended users', async () => {
      const req = {
        method: 'POST',
        user: {
          id: 'user-1',
          email: 'user@example.com',
          status: USER_STATUS.ACTIVE,
          isSuspended: false,
        },
        params: {},
      } as unknown as ApiRequest;

      await checkUserNotSuspended(req, res, next);

      expect(next).toHaveBeenCalledWith(); // No error passed
    });
  });

  describe('suspended school access control', () => {
    it('allows GET requests for users from suspended schools', async () => {
      const req = {
        method: 'GET',
        user: {
          id: 'user-1',
          email: 'user@example.com',
          status: USER_STATUS.ACTIVE,
          isSuspended: false,
        },
        schoolSuspended: true,
        params: {},
      } as unknown as ApiRequest;

      await checkUserNotSuspended(req, res, next);

      expect(next).toHaveBeenCalledWith(); // No error passed
    });

    it('passes through for non-school suspended users', async () => {
      const req = {
        method: 'POST',
        user: {
          id: 'user-1',
          email: 'user@example.com',
          status: USER_STATUS.ACTIVE,
          isSuspended: false,
        },
        params: {},
      } as unknown as ApiRequest;

      await checkUserNotSuspended(req, res, next);

      expect(next).toHaveBeenCalledWith(); // No error passed
    });
  });
});
