import { Router } from 'express';
import {
  getCompetencyQuestions,
  startAttempt,
  saveAttemptProgress,
  submitAttempt,
  getResult,
  getAllResults,
  getMyAttempt,
  getAttempts,
  getAttempt,
  triggerEvaluation,
} from '../controllers/competency.controller';
import { authMiddleware } from '../middlewares/auth';
import { requireRoles, requireTeacher } from '../middlewares/role.guard';
import { requireNotSuspended } from '../middlewares/suspension';
import { validate } from '../middlewares/validate';
import { USER_ROLES } from '../config/constants';
import {
  submitAttemptSchema,
  startAttemptSchema,
  updateAttemptSchema,
  triggerEvaluationSchema,
} from '../schemas/competency.schema';

const router = Router();

/**
 * Access Control Matrix (Task 6):
 * - Authenticated Teacher: Full access
 * - Limited Access Teacher: Full access to competency endpoints
 * - Suspended Teacher: Blocked (403 USER_SUSPENDED)
 * - Non-Teacher Roles: Blocked (403 TEACHER_ONLY)
 * - Unauthenticated: Blocked (401 AUTH_REQUIRED)
 *
 * Middleware order: authMiddleware -> requireTeacher() -> requireNotSuspended
 */

// ============ Teacher Routes ============

// Get competency assessment questions
router.get(
  '/questions',
  authMiddleware,
  requireTeacher(),
  requireNotSuspended,
  getCompetencyQuestions
);

// Start a new attempt
router.post(
  '/attempts',
  authMiddleware,
  requireTeacher(),
  requireNotSuspended,
  validate(startAttemptSchema),
  startAttempt
);

// Get the teacher's single attempt (auto-fetch, no ID needed)
router.get(
  '/attempt',
  authMiddleware,
  requireTeacher(),
  requireNotSuspended,
  getMyAttempt
);

// Get all attempts for the current user (legacy)
router.get(
  '/attempts',
  authMiddleware,
  requireTeacher(),
  requireNotSuspended,
  getAttempts
);

// Get a specific attempt by ID (legacy)
router.get(
  '/attempts/:attemptId',
  authMiddleware,
  requireTeacher(),
  requireNotSuspended,
  getAttempt
);

// Save attempt progress (auto-save)
router.patch(
  '/attempts/:attemptId',
  authMiddleware,
  requireTeacher(),
  requireNotSuspended,
  validate(updateAttemptSchema),
  saveAttemptProgress
);

// Submit attempt for evaluation
router.post(
  '/submit',
  authMiddleware,
  requireTeacher(),
  requireNotSuspended,
  validate(submitAttemptSchema),
  submitAttempt
);

// Get latest result for the current user
router.get(
  '/result',
  authMiddleware,
  requireTeacher(),
  requireNotSuspended,
  getResult
);

// Get all results for the current user
router.get(
  '/results',
  authMiddleware,
  requireTeacher(),
  requireNotSuspended,
  getAllResults
);

// Trigger evaluation for the teacher's own submitted attempt
router.post(
  '/evaluate',
  authMiddleware,
  requireTeacher(),
  requireNotSuspended,
  triggerEvaluation
);

// ============ Admin/Background Worker Routes ============

// Trigger batch evaluation for submitted attempts (admin only)
router.post(
  '/evaluate/batch',
  authMiddleware,
  requireRoles([USER_ROLES.PLATFORM_ADMIN]),
  validate(triggerEvaluationSchema),
  triggerEvaluation
);

export default router;
