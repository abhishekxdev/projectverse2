import { NextFunction, Response } from 'express';
import { HTTP_STATUS, USER_STATUS } from '../config/constants';
import { ApiRequest } from '../types/api.types';
import { AppError } from '../utils/error';

const deny = (message: string, code: string) =>
  new AppError(message, HTTP_STATUS.FORBIDDEN, code);

export const requireApprovedProfile = (
  req: ApiRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const status = req.user?.status;
    if (!status) {
      throw new AppError(
        'Authentication required',
        HTTP_STATUS.UNAUTHORIZED,
        'AUTH_REQUIRED'
      );
    }

    // Note: Suspension is now handled by suspension middleware
    // which allows read access but blocks write access

    if (status === USER_STATUS.PENDING || status === USER_STATUS.DRAFT) {
      throw deny(
        'Profile approval required before accessing modules',
        'MODULE_ACCESS_DENIED'
      );
    }

    if (status === USER_STATUS.REJECTED) {
      throw deny(
        'Profile rejected. Please resubmit before accessing modules',
        'PROFILE_REJECTED'
      );
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

export const requireCredentialsAccess = (
  req: ApiRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const status = req.user?.status;
    if (!status) {
      throw new AppError(
        'Authentication required',
        HTTP_STATUS.UNAUTHORIZED,
        'AUTH_REQUIRED'
      );
    }

    // Note: Suspension is now handled by suspension middleware
    // which allows read access but blocks write access

    if (status === USER_STATUS.PENDING || status === USER_STATUS.DRAFT) {
      throw deny(
        'Credential access blocked until approval',
        'CREDENTIALS_ACCESS_DENIED'
      );
    }

    if (status === USER_STATUS.REJECTED) {
      throw deny(
        'Credential access blocked due to profile rejection',
        'CREDENTIALS_ACCESS_DENIED'
      );
    }

    return next();
  } catch (error) {
    return next(error);
  }
};
