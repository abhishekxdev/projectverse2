import { NextFunction, Response } from 'express';
import { ApiRequest } from '../types/api.types';
import {
  AuthRequiredError,
  CrossSchoolAccessError,
  AccountSuspendedError,
} from '../utils/error';
import { USER_ROLES, USER_STATUS } from '../config/constants';
import { createUserRepository } from '../repositories/user.repository';
import { logger } from '../utils/logger';

export type SchoolIdResolver = (req: ApiRequest) => string | null | undefined;

interface SchoolAssociationOptions {
  resolveSchoolId?: SchoolIdResolver;
  allowPlatformAdminBypass?: boolean;
}

const defaultResolver: SchoolIdResolver = (req) => {
  if (req.params?.schoolId) return req.params.schoolId;
  if (req.body?.schoolId) return req.body.schoolId;
  if (req.query?.schoolId) return req.query.schoolId as string;
  return req.user?.schoolId ?? null;
};

const userRepo = createUserRepository();

export const schoolAssociationMiddleware = (
  options?: SchoolAssociationOptions
) => {
  return async (req: ApiRequest, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AuthRequiredError();
      }

      const targetSchoolId =
        options?.resolveSchoolId?.(req) ?? defaultResolver(req);

      if (!targetSchoolId) {
        throw new CrossSchoolAccessError('School context is required');
      }

      if (
        req.user.role === USER_ROLES.PLATFORM_ADMIN &&
        options?.allowPlatformAdminBypass !== false
      ) {
        req.schoolId = targetSchoolId;
        return next();
      }

      const userSchoolId = req.user.schoolId;
      if (!userSchoolId) {
        throw new CrossSchoolAccessError('User is not assigned to a school');
      }

      if (userSchoolId !== targetSchoolId) {
        throw new CrossSchoolAccessError();
      }

      if (req.user.role === USER_ROLES.SCHOOL_TEACHER) {
        const latest = await userRepo.getUserById(req.user.uid);
        if (!latest || latest.schoolId !== targetSchoolId) {
          throw new CrossSchoolAccessError();
        }
        if (latest.status === USER_STATUS.SUSPENDED) {
          throw new AccountSuspendedError();
        }
      }

      req.schoolId = targetSchoolId;
      next();
    } catch (error) {
      if (
        !(error instanceof CrossSchoolAccessError) &&
        !(error instanceof AccountSuspendedError) &&
        !(error instanceof AuthRequiredError)
      ) {
        logger.warn('Failed school association check', {
          error: (error as Error).message,
          userId: req.user?.uid,
        });
      }
      next(error);
    }
  };
};
