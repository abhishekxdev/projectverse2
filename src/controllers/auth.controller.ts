import { Response, NextFunction } from 'express';
import { ApiRequest } from '../types/api.types';
import { authService } from '../services/auth.services';
import { successResponse, createdResponse } from '../utils/response';
import {
  RegistrationInput,
  BackendSignupInput,
  LoginInput,
  OnboardingProfileInput,
} from '../schemas/auth.schema';
import { logger } from '../utils/logger';
import { AuthResponsePayload } from '../types/api.types';
import { USER_STATUS } from '../config/constants';

/**
 * Handle user registration
 * POST /api/auth/register
 */
export const register = async (
  req: ApiRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const input: RegistrationInput = req.body;

    // Register user in Firestore
    const user = await authService.registerUser({
      firebaseUid: input.firebaseUid,
      email: input.email,
      displayName: input.displayName,
      profile: input.profile,
      schoolId: input.schoolId, // Optional: user can select to join a school
    });

    logger.info('User registered via API', { uid: input.firebaseUid });

    return createdResponse(res, {
      uid: input.firebaseUid,
      email: user.email,
      displayName: user.displayName,
      tier: user.tier,
      createdAt: user.createdAt,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Backend-managed signup with credentials
 * POST /api/auth/signup
 */
export const signupWithCredentials = async (
  req: ApiRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const input: BackendSignupInput = req.body;
    const result = await authService.signupWithCredentials(input);
    const response: AuthResponsePayload = {
      token: result.token,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      user: result.user,
    };
    return createdResponse(res, response);
  } catch (error) {
    next(error);
  }
};

/**
 * Backend-managed login with credentials
 * POST /api/auth/login
 */
export const loginWithCredentials = async (
  req: ApiRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const input: LoginInput = req.body;
    const result = await authService.loginWithCredentials(input);
    const response: AuthResponsePayload = {
      token: result.token,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      user: result.user,
    };
    return successResponse(res, response);
  } catch (error) {
    next(error);
  }
};

/**
 * Get current authenticated user
 * GET /api/auth/me
 */
export const getMe = async (
  req: ApiRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      logger.warn('getMe called without authenticated user');
      throw new Error('User not authenticated');
    }

    // Get fresh user data from Firestore
    const user = await authService.getCurrentUser(req.user.uid);

    // Map user status to approval status for clearer API response
    const getApprovalStatus = (status: string) => {
      switch (status) {
        case 'pending':
          return 'pending';
        case 'active':
          return user.profileCompleted ? 'approved' : undefined;
        case 'rejected':
          return 'rejected';
        default:
          return undefined;
      }
    };

    return successResponse(res, {
      uid: req.user.uid,
      email: user.email,
      displayName: user.displayName,
      username: user.username,
      profile: user.profile,
      status: user.status,
      profileCompleted: user.profileCompleted ?? false,
      approvalStatus: getApprovalStatus(user.status),
      tier: req.user.tier,
      role: req.user.role,
      usage: req.usage,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user profile
 * PUT /api/auth/profile
 */
export const updateProfile = async (
  req: ApiRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      logger.warn('updateProfile called without authenticated user');
      throw new Error('User not authenticated');
    }

    const payload: OnboardingProfileInput = req.body;

    const updatedUser = await authService.completeOnboarding({
      uid: req.user.uid,
      role: payload.role,
      profile: payload.profile,
    });

    logger.info('User onboarding/profile completed via API', {
      uid: req.user.uid,
      status: updatedUser.status,
    });

    return successResponse(res, {
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Exchange Firebase token for backend JWT with embedded claims
 * POST /api/auth/token
 */
export const exchangeToken = async (
  req: ApiRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      logger.warn('exchangeToken called without authenticated user');
      throw new Error('User not authenticated');
    }

    const rawHeader =
      (req.headers.authorization ||
        (req.headers.Authorization as string | undefined)) ??
      '';
    const firebaseIdToken = rawHeader.startsWith('Bearer ')
      ? rawHeader.split(' ')[1]
      : undefined;

    const { token, claims } = await authService.generateBackendJwt(
      req.user.uid
    );

    return successResponse(res, {
      jwt: token,
      firebaseIdToken,
      role: claims.role,
      schoolId: claims.schoolId,
      status: claims.status,
      claimsUpdatedAt: req.claimsUpdatedAt,
    });
  } catch (error) {
    next(error);
  }
};
