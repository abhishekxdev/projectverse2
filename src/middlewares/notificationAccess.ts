import { NextFunction, Response } from 'express';
import { ApiRequest } from '../types/api.types';
import { USER_ROLES } from '../config/constants';
import { AuthRequiredError } from '../utils/error';
import { schoolAssociationMiddleware } from './schoolAssociation';

// Reuse the school association middleware to enforce same-school access for school-bound roles
const enforceSchoolAssociation = schoolAssociationMiddleware({
  resolveSchoolId: (req) =>
    req.user?.schoolId ??
    (req.body?.schoolId as string | undefined) ??
    (req.query?.schoolId as string | undefined) ??
    null,
});

export const notificationAccessGuard = (
  req: ApiRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return next(new AuthRequiredError());
  }

  if (
    req.user.role === USER_ROLES.SCHOOL_ADMIN ||
    req.user.role === USER_ROLES.SCHOOL_TEACHER
  ) {
    return enforceSchoolAssociation(req, res, next);
  }

  return next();
};
