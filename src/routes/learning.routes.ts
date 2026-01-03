/**
 * Learning Path Routes
 * Implements Task 8: Learning Path Generation
 */

import { Router } from 'express';
import {
  generateLearningPath,
  getLearningPath,
  getLearningPathPreview,
  unlockNextModule,
} from '../controllers/tutor.controller';
import { authMiddleware } from '../middlewares/auth';
import { requireTeacher } from '../middlewares/role.guard';
import { requireNotSuspended } from '../middlewares/suspension';
import { validate } from '../middlewares/validate';
import { generateLearningPathSchema } from '../schemas/tutor.schema';
import { requireTutorAccess } from '../middlewares/tier.guard';

const router = Router();

/**
 * Access Control Matrix:
 * - Approved Teacher (status=active): Can use all learning path features
 * - Unapproved Teacher (pending/draft/rejected): Can only access preview endpoint
 * - Suspended Teacher: Blocked (403 USER_SUSPENDED)
 * - Non-Teacher Roles: Blocked (403 TEACHER_ONLY)
 * - Unauthenticated: Blocked (401 AUTH_REQUIRED)
 */

// Base middleware for all routes
const baseMiddleware = [authMiddleware, requireTeacher(), requireNotSuspended];

// ============ Learning Path Routes ============

// Get learning path preview (available to limited access teachers)
router.get('/preview', ...baseMiddleware, getLearningPathPreview);

// Get full learning path
router.get('/', ...baseMiddleware, requireTutorAccess, getLearningPath);

// Generate learning path from competency result
router.post(
  '/generate',
  ...baseMiddleware,
  requireTutorAccess,
  validate(generateLearningPathSchema),
  generateLearningPath
);

// Unlock next module
router.post(
  '/unlock-next',
  ...baseMiddleware,
  requireTutorAccess,
  unlockNextModule
);

export default router;
