import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth';
import { requirePlatformAdmin } from '../middlewares/role.guard';
import { HTTP_STATUS } from '../config/constants';
import { validate } from '../middlewares/validate';
import {
  registrationSchema,
  backendSignupSchema,
  loginSchema,
  onboardingProfileSchema,
} from '../schemas/auth.schema';
import {
  register,
  getMe,
  updateProfile,
  exchangeToken,
  signupWithCredentials,
  loginWithCredentials,
} from '../controllers/auth.controller';

const authRouter = Router();

/**
 * POST /api/auth/signup
 * Backend-managed credential signup
 */
authRouter.post(
  '/signup',
  validate(backendSignupSchema),
  signupWithCredentials
);

/**
 * POST /api/auth/login
 * Backend-managed credential login
 */
authRouter.post('/login', validate(loginSchema), loginWithCredentials);

/**
 * POST /api/auth/register
 * Register a new user in Firestore after Firebase Auth signup
 * (Legacy endpoint - kept for backward compatibility)
 */
authRouter.post('/register', validate(registrationSchema), register);

/**
 * GET /api/auth/me
 * Get current authenticated user profile
 */
authRouter.get('/me', authMiddleware, getMe);

/**
 * PUT /api/auth/profile
 * Update user profile
 */
authRouter.put(
  '/profile',
  authMiddleware,
  validate(onboardingProfileSchema),
  updateProfile
);

/**
 * POST /api/auth/token
 * Exchange Firebase token for backend JWT
 */
authRouter.post('/token', authMiddleware, exchangeToken);

/**
 * Example protected admin-only route placeholder
 * GET /api/auth/admin/roles-check
 */
authRouter.get(
  '/admin/roles-check',
  authMiddleware,
  requirePlatformAdmin(),
  (req, res) => {
    return res
      .status(HTTP_STATUS.OK)
      .json({ success: true, data: { ok: true } });
  }
);

export default authRouter;
