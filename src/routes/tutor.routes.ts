import { Router } from 'express';
import {
  startSession,
  endSession,
  getSession,
  getSessions,
  sendMessage,
  getMessageHistory,
} from '../controllers/tutor.controller';
import { authMiddleware } from '../middlewares/auth';
import { requireTeacher } from '../middlewares/role.guard';
import { requireNotSuspended } from '../middlewares/suspension';
import { validate } from '../middlewares/validate';
import { validateParams } from '../middlewares/validate';
import {
  sendMessageBodySchema,
  sessionIdParamSchema,
} from '../schemas/tutor.schema';
import { requireTutorAccess } from '../middlewares/tier.guard';

const router = Router();

/**
 * Access Control Matrix (Task 8):
 * - Approved Teacher (status=active): Full access to tutor features
 * - Unapproved Teacher (pending/draft/rejected): Blocked (403 AI_TUTOR_NOT_AVAILABLE)
 * - Suspended Teacher: Blocked (403 USER_SUSPENDED)
 * - Non-Teacher Roles: Blocked (403 TEACHER_ONLY)
 * - Unauthenticated: Blocked (401 AUTH_REQUIRED)
 */

// All routes require authenticated teacher who is not suspended
const tutorMiddleware = [
  authMiddleware,
  requireTeacher(),
  requireNotSuspended,
  requireTutorAccess,
];

// ============ Session Routes ============

// Start a new AI tutor session
router.post('/session', ...tutorMiddleware, startSession);

// Get all sessions for current teacher
router.get('/sessions', ...tutorMiddleware, getSessions);

// Get a specific session
router.get(
  '/session/:sessionId',
  ...tutorMiddleware,
  validateParams(sessionIdParamSchema),
  getSession
);

// End a session
router.post(
  '/session/:sessionId/end',
  ...tutorMiddleware,
  validateParams(sessionIdParamSchema),
  endSession
);

// ============ Chat Routes ============

// Send a message in a session
router.post(
  '/session/:sessionId/message',
  ...tutorMiddleware,
  validateParams(sessionIdParamSchema),
  validate(sendMessageBodySchema),
  sendMessage
);

// Get message history for a session
router.get(
  '/session/:sessionId/messages',
  ...tutorMiddleware,
  validateParams(sessionIdParamSchema),
  getMessageHistory
);

export default router;
