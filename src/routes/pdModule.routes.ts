import { Router } from 'express';
import {
  getModules,
  getModule,
  getQuestions,
  startAttempt,
  saveResponses,
  submitAttempt,
  getAttemptResult,
  triggerOwnEvaluation,
  triggerEvaluation,
} from '../controllers/pdModule.controller';
import { authMiddleware } from '../middlewares/auth';
import { requireTeacher, requireRoles } from '../middlewares/role.guard';
import { requireNotSuspended } from '../middlewares/suspension';
import { validate, validateParams } from '../middlewares/validate';
import { USER_ROLES } from '../config/constants';
import {
  moduleIdParamSchema,
  attemptIdParamSchema,
  saveResponsesSchema,
  submitAttemptSchema,
  triggerEvaluationSchema,
} from '../schemas/pdModule.schema';

const router = Router();

/**
 * Access Control:
 * - Authenticated Teacher: Full access to PD modules
 * - Suspended Teacher: Blocked (403 USER_SUSPENDED)
 * - Non-Teacher Roles: Blocked (403 TEACHER_ONLY)
 * - Unauthenticated: Blocked (401 AUTH_REQUIRED)
 */

// Base middleware for teacher routes
const teacherMiddleware = [
  authMiddleware,
  requireTeacher(),
  requireNotSuspended,
];

// ============ Module Routes ============

// Get all active modules
router.get('/modules', ...teacherMiddleware, getModules);

// Get a specific module
router.get(
  '/modules/:moduleId',
  ...teacherMiddleware,
  validateParams(moduleIdParamSchema),
  getModule
);

// Get questions for a module
router.get(
  '/modules/:moduleId/questions',
  ...teacherMiddleware,
  validateParams(moduleIdParamSchema),
  getQuestions
);

// Start a new attempt
router.post(
  '/modules/:moduleId/attempt/start',
  ...teacherMiddleware,
  validateParams(moduleIdParamSchema),
  startAttempt
);

// ============ Attempt Routes ============

// Save responses (auto-save)
router.post(
  '/attempts/:attemptId/responses',
  ...teacherMiddleware,
  validateParams(attemptIdParamSchema),
  validate(saveResponsesSchema),
  saveResponses
);

// Submit attempt for evaluation
router.post(
  '/attempts/:attemptId/submit',
  ...teacherMiddleware,
  validateParams(attemptIdParamSchema),
  validate(submitAttemptSchema),
  submitAttempt
);

// Get attempt result
router.get(
  '/attempts/:attemptId/result',
  ...teacherMiddleware,
  validateParams(attemptIdParamSchema),
  getAttemptResult
);

// Teacher triggers evaluation of their own attempt
router.post(
  '/attempts/:attemptId/evaluate',
  ...teacherMiddleware,
  validateParams(attemptIdParamSchema),
  triggerOwnEvaluation
);

// ============ Admin Routes ============

// Trigger evaluation (admin/background worker)
router.post(
  '/evaluate',
  authMiddleware,
  requireRoles([USER_ROLES.PLATFORM_ADMIN]),
  validate(triggerEvaluationSchema),
  triggerEvaluation
);

export default router;
