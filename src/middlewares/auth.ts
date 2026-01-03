import { NextFunction, Response } from 'express';
import { auth as firebaseAuth, db } from '../config/firebase';
import {
  AuthRequiredError,
  AuthTokenInvalidError,
  AuthUserNotFoundError,
} from '../utils/error';
import {
  TIER_LIMITS,
  USER_ROLES,
  USER_STATUS,
  USER_TIERS,
} from '../config/constants';
import { ApiRequest } from '../types/api.types';
import {
  UserDocument,
  TierInfo,
  UserUsageCounters,
  UserRole,
  UserStatus,
} from '../types/user.types';
import { authService } from '../services/auth.services';
import { logger } from '../utils/logger';

/**
 * Extracts bearer token from Authorization header
 */
const extractToken = (req: ApiRequest): string => {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || typeof header !== 'string' || header.trim().length === 0) {
    throw new AuthRequiredError('Authorization header missing');
  }
  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
    throw new AuthTokenInvalidError('Malformed Authorization header');
  }
  return parts[1];
};

/**
 * Firebase authentication & user context middleware
 * - Verifies Firebase ID token
 * - Loads user document
 * - Attaches user, tier info, and usage counters to request
 */
export const authMiddleware = async (
  req: ApiRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const token = extractToken(req);

    let decoded;
    try {
      decoded = await firebaseAuth.verifyIdToken(token);
    } catch (tokenError: any) {
      throw new AuthTokenInvalidError(
        tokenError.message || 'Invalid authentication token'
      );
    }

    const uid = decoded.uid;

    const userSnap = await db.collection('users').doc(uid).get();
    if (!userSnap.exists) {
      throw new AuthUserNotFoundError('User record not found');
    }
    const data = userSnap.data() || {};

    const roleFromDoc = (data.role as UserRole) ?? USER_ROLES.SCHOOL_TEACHER;
    const tierFromDoc = (data.tier as UserDocument['tier']) ?? USER_TIERS.FREE;
    const schoolIdFromDoc =
      (data.schoolId as string | null | undefined) ?? null;
    const statusFromDoc =
      (data.status as UserStatus | undefined) ?? USER_STATUS.ACTIVE;

    const roleClaim = decoded.role as UserRole | undefined;
    const statusClaimPresent = Object.prototype.hasOwnProperty.call(
      decoded,
      'status'
    );
    const statusClaim = statusClaimPresent
      ? (decoded.status as UserStatus | undefined) ?? USER_STATUS.ACTIVE
      : undefined;
    const schoolClaimPresent = Object.prototype.hasOwnProperty.call(
      decoded,
      'schoolId'
    );
    const schoolClaim = schoolClaimPresent
      ? (decoded.schoolId as string | null | undefined) ?? null
      : undefined;

    const claimsMissing =
      typeof roleClaim === 'undefined' ||
      !statusClaimPresent ||
      !schoolClaimPresent;

    const claimsMismatch =
      !claimsMissing &&
      (roleClaim !== roleFromDoc ||
        statusClaim !== statusFromDoc ||
        schoolClaim !== schoolIdFromDoc);

    if (claimsMissing || claimsMismatch) {
      logger.info('Refreshing Firebase custom claims', {
        uid,
        claimsMissing,
        claimsMismatch,
      });
      const { updatedAt } = await authService.syncClaimsFromUser(uid);
      req.claimsUpdatedAt = updatedAt;
    }

    const effectiveRole =
      !claimsMissing && !claimsMismatch && roleClaim ? roleClaim : roleFromDoc;
    const effectiveSchoolId =
      !claimsMismatch && schoolClaimPresent
        ? (schoolClaim as string | null)
        : schoolIdFromDoc;
    const effectiveStatus =
      !claimsMismatch && !claimsMissing && statusClaimPresent
        ? (statusClaim as UserStatus)
        : statusFromDoc;

    // Note: Suspension blocking is now handled by the suspension middleware
    // which allows read operations but blocks write operations for suspended users

    const user: UserDocument = {
      id: userSnap.id,
      uid,
      role: effectiveRole,
      tier: tierFromDoc,
      email: (data.email as string) || decoded.email || '',
      status: effectiveStatus,
      isSuspended: effectiveStatus === USER_STATUS.SUSPENDED,
      schoolId: effectiveSchoolId,
      profile: data.profile,
      usage: data.usage || {},
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };

    const limits = TIER_LIMITS[user.tier] || TIER_LIMITS[USER_TIERS.FREE];
    const tier: TierInfo = {
      tier: user.tier,
      limits,
    };

    const usage: UserUsageCounters = {
      assessmentsTakenMonth: user.usage?.assessmentsTakenMonth || 0,
      tutorMessagesMonth: user.usage?.tutorMessagesMonth || 0,
    };

    req.user = user;
    req.tier = tier;
    req.usage = usage;
    req.role = user.role;
    req.schoolId = user.schoolId ?? null;
    req.status = user.status;

    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Optional helper to skip auth for public routes while retaining types
 */
export const optionalAuthMiddleware = (
  req: ApiRequest,
  _res: Response,
  next: NextFunction
) => {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || typeof header !== 'string') return next();
  authMiddleware(req, _res, (err?: any) => {
    // swallow auth errors for optional routes
    return next();
  });
};
