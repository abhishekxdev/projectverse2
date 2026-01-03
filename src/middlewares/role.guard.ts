import { NextFunction, Response } from 'express';
import { ApiRequest } from '../types/api.types';
import { RoleForbiddenError, AuthRequiredError } from '../utils/error';
import { UserRole } from '../types/user.types';
import { USER_ROLES } from '../config/constants';

/**
 * Factory returning middleware enforcing allowed roles
 */
export const requireRoles = (allowed: UserRole[]) => {
  return (req: ApiRequest, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AuthRequiredError();
      }
      const role = req.user.role as UserRole;
      if (!allowed.includes(role)) {
        throw new RoleForbiddenError(allowed);
      }
      req.role = role;
      next();
    } catch (e) {
      next(e);
    }
  };
};

export const requireTeacher = () => requireRoles([USER_ROLES.SCHOOL_TEACHER]);

export const requireSchoolAdmin = () => requireRoles([USER_ROLES.SCHOOL_ADMIN]);

export const requirePlatformAdmin = () =>
  requireRoles([USER_ROLES.PLATFORM_ADMIN]);

export const requireAnyAdmin = () =>
  requireRoles([USER_ROLES.SCHOOL_ADMIN, USER_ROLES.PLATFORM_ADMIN]);
