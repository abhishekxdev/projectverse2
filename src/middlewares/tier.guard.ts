import { NextFunction, Response } from 'express';
import { ApiRequest } from '../types/api.types';
import {
  AuthRequiredError,
  TierLimitError,
  ForbiddenError,
} from '../utils/error';
import { USER_TIERS, USER_STATUS, HTTP_STATUS } from '../config/constants';

interface TierLimitViolationMeta {
  code: string;
  limitType: string;
  current: number;
  allowed: number;
  upgrade?: { recommendedTier: string };
}

const unlimited = (n: number) => n < 0;

/**
 * Assessment limit enforcement middleware
 */
export const enforceAssessmentLimit = (
  req: ApiRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    if (!req.tier || !req.usage) return next();
    const allowed = req.tier.limits.assessmentsPerMonth;
    const current = req.usage.assessmentsTakenMonth;
    if (!unlimited(allowed) && current >= allowed) {
      const meta: TierLimitViolationMeta = {
        code: 'TIER_LIMIT_ASSESSMENT',
        limitType: 'assessmentsPerMonth',
        current,
        allowed,
        upgrade: { recommendedTier: USER_TIERS.SCHOOL },
      };
      const err = new TierLimitError(
        'Assessment limit reached',
        allowed,
        current,
        req.tier.tier
      );
      (err as any).details = meta;
      throw err;
    }
    next();
  } catch (e) {
    next(e);
  }
};

/**
 * Tutor message limit enforcement middleware
 */
export const enforceTutorMessageLimit = (
  req: ApiRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    if (!req.tier || !req.usage) return next();
    const allowed = req.tier.limits.tutorMessagesPerMonth;
    const current = req.usage.tutorMessagesMonth;
    if (!unlimited(allowed) && current >= allowed) {
      const meta: TierLimitViolationMeta = {
        code: 'TIER_LIMIT_TUTOR_MESSAGES',
        limitType: 'tutorMessagesPerMonth',
        current,
        allowed,
        upgrade: { recommendedTier: USER_TIERS.SCHOOL },
      };
      const err = new TierLimitError(
        'Tutor message limit reached',
        allowed,
        current,
        req.tier.tier
      );
      (err as any).details = meta;
      throw err;
    }
    next();
  } catch (e) {
    next(e);
  }
};

/**
 * Module access guard – call with module access level string
 */
export const enforceModuleAccess = (requiredAccess: string) => {
  return (req: ApiRequest, _res: Response, next: NextFunction) => {
    try {
      if (!req.tier) return next();
      const accessible = req.tier.limits.modulesAccessible as readonly string[];
      if (!accessible.includes(requiredAccess)) {
        const err = new ForbiddenError('Module requires upgrade');
        (err as any).code = 'TIER_MODULE_UPGRADE_REQUIRED';
        (err as any).details = {
          requiredAccess,
          currentTier: req.tier.tier,
          upgrade: { recommendedTier: USER_TIERS.SCHOOL },
        };
        throw err;
      }
      next();
    } catch (e) {
      next(e);
    }
  };
};

/**
 * Tutor access guard
 * Blocks unapproved teachers (non-active status) from AI Tutor endpoints
 */
export const requireTutorAccess = (
  req: ApiRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const status = req.user?.status;
    if (!status) {
      throw new AuthRequiredError(
        'Authentication required for AI Tutor access.'
      );
    }

    if (status !== USER_STATUS.ACTIVE) {
      const err = new ForbiddenError(
        'AI Tutor is available after school/admin approval.',
        HTTP_STATUS.FORBIDDEN,
        'AI_TUTOR_NOT_AVAILABLE'
      );
      (err as any).details = { status };
      throw err;
    }
    next();
  } catch (e) {
    next(e);
  }
};
