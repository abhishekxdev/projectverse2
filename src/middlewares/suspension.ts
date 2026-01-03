import { NextFunction, Response } from 'express';
import { HTTP_STATUS, USER_STATUS } from '../config/constants';
import { ApiRequest } from '../types/api.types';
import { AppError } from '../utils/error';
import { createSuspensionRepository } from '../repositories/suspension.repository';

const suspensionRepository = createSuspensionRepository();

const suspendedWriteError = (message: string, code: string) =>
  new AppError(message, HTTP_STATUS.FORBIDDEN, code);

const isWriteOperation = (method: string): boolean => {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
};

const resolveSchoolId = (req: ApiRequest): string | undefined => {
  if (typeof req.params?.schoolId === 'string') {
    return req.params.schoolId;
  }
  if (typeof req.params?.id === 'string') {
    return req.params.id;
  }
  if (typeof req.body?.schoolId === 'string') {
    return req.body.schoolId;
  }
  return req.user?.schoolId ?? undefined;
};

export const checkSchoolSuspension = async (
  req: ApiRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = resolveSchoolId(req);
    if (!schoolId) {
      return next();
    }

    const status = await suspensionRepository.getSuspensionStatus(
      'school',
      schoolId
    );

    // If school is suspended and this is a write operation, block it
    if (status?.status === 'suspended' && isWriteOperation(req.method)) {
      throw suspendedWriteError(
        'School is suspended - read-only access granted',
        'SCHOOL_SUSPENDED_WRITE_BLOCKED'
      );
    }

    // Add suspension info to request for use in controllers
    if (status?.status === 'suspended') {
      req.schoolSuspended = true;
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

export const checkUserSuspension = async (
  req: ApiRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    // Check if user is directly suspended and this is a write operation
    // Use status as single source of truth
    const userIsSuspended = req.user?.status === USER_STATUS.SUSPENDED;
    if (userIsSuspended && isWriteOperation(req.method)) {
      throw suspendedWriteError(
        'Account is suspended - read-only access granted',
        'USER_SUSPENDED_WRITE_BLOCKED'
      );
    }

    // Check if user's school is suspended (for teachers/school admins)
    if (req.user?.schoolId && isWriteOperation(req.method)) {
      const schoolStatus = await suspensionRepository.getSuspensionStatus(
        'school',
        req.user.schoolId
      );
      if (schoolStatus?.status === 'suspended') {
        throw suspendedWriteError(
          'Your school is suspended - read-only access granted',
          'SCHOOL_SUSPENDED_WRITE_BLOCKED'
        );
      }
    }

    const userId =
      typeof req.params?.userId === 'string' ? req.params.userId : undefined;
    if (userId) {
      const status = await suspensionRepository.getSuspensionStatus(
        'user',
        userId
      );
      if (
        status?.status === USER_STATUS.SUSPENDED &&
        isWriteOperation(req.method)
      ) {
        throw suspendedWriteError(
          'User is suspended - read-only access granted',
          'USER_SUSPENDED_WRITE_BLOCKED'
        );
      }
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

// Keep legacy middleware names for backward compatibility
export const checkSchoolNotSuspended = checkSchoolSuspension;
export const checkUserNotSuspended = checkUserSuspension;

/**
 * Strict suspension check for competency endpoints (Task 6)
 * Blocks ALL access for suspended users, not just write operations
 */
export const requireNotSuspended = async (
  req: ApiRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const userIsSuspended = req.user?.status === USER_STATUS.SUSPENDED;
    if (userIsSuspended) {
      throw new AppError(
        'Your account is currently suspended and cannot access competency features.',
        HTTP_STATUS.FORBIDDEN,
        'USER_SUSPENDED'
      );
    }

    return next();
  } catch (error) {
    return next(error);
  }
};
