/**
 * AI Tutor Controller
 * HTTP handlers for AI tutor endpoints
 */

import { Request, Response } from 'express';
import { tutorService } from '../services/tutor.service';
import { asyncHandler } from '../utils/asyncHandler';
import { successResponse, createdResponse } from '../utils/response';
import { HTTP_STATUS } from '../config/constants';

/**
 * Start a new AI tutor session
 * POST /api/tutor/session
 */
export const startSession = asyncHandler(async (req: Request, res: Response) => {
  const teacherId = req.user!.uid;
  const session = await tutorService.startSession(teacherId);
  createdResponse(res, session);
});

/**
 * End an AI tutor session
 * POST /api/tutor/session/:sessionId/end
 */
export const endSession = asyncHandler(async (req: Request, res: Response) => {
  const teacherId = req.user!.uid;
  const { sessionId } = req.params;
  await tutorService.endSession(teacherId, sessionId);
  successResponse(res, { message: 'Session ended successfully' });
});

/**
 * Get a specific session
 * GET /api/tutor/session/:sessionId
 */
export const getSession = asyncHandler(async (req: Request, res: Response) => {
  const teacherId = req.user!.uid;
  const { sessionId } = req.params;
  const session = await tutorService.getSession(teacherId, sessionId);
  successResponse(res, session);
});

/**
 * Get all sessions for the current teacher
 * GET /api/tutor/sessions
 */
export const getSessions = asyncHandler(async (req: Request, res: Response) => {
  const teacherId = req.user!.uid;
  const sessions = await tutorService.getSessions(teacherId);
  successResponse(res, { sessions });
});

/**
 * Send a message in a session
 * POST /api/tutor/session/:sessionId/message
 */
export const sendMessage = asyncHandler(async (req: Request, res: Response) => {
  const teacherId = req.user!.uid;
  const { sessionId } = req.params;
  const { message } = req.body;

  const result = await tutorService.sendMessage(teacherId, sessionId, message);
  successResponse(res, result);
});

/**
 * Get message history for a session
 * GET /api/tutor/session/:sessionId/messages
 */
export const getMessageHistory = asyncHandler(
  async (req: Request, res: Response) => {
    const teacherId = req.user!.uid;
    const { sessionId } = req.params;
    const messages = await tutorService.getMessageHistory(teacherId, sessionId);
    successResponse(res, { messages });
  }
);

/**
 * Generate learning path from competency result
 * POST /api/learning-path/generate
 */
export const generateLearningPath = asyncHandler(
  async (req: Request, res: Response) => {
    const teacherId = req.user!.uid;
    const { resultId } = req.body;
    const path = await tutorService.generateLearningPath(teacherId, resultId);
    createdResponse(res, path);
  }
);

/**
 * Get learning path for current teacher
 * GET /api/learning-path
 */
export const getLearningPath = asyncHandler(
  async (req: Request, res: Response) => {
    const teacherId = req.user!.uid;
    const path = await tutorService.getLearningPath(teacherId);
    if (!path) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        code: 'NO_LEARNING_PATH',
        message: 'No learning path found. Complete the competency assessment first.',
      });
      return;
    }
    successResponse(res, path);
  }
);

/**
 * Get learning path preview (for limited access teachers)
 * GET /api/learning-path/preview
 */
export const getLearningPathPreview = asyncHandler(
  async (req: Request, res: Response) => {
    const teacherId = req.user!.uid;
    const preview = await tutorService.getLearningPathPreview(teacherId);
    if (!preview) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        code: 'NO_COMPETENCY_RESULT',
        message:
          'No competency result found. Complete the assessment to see your learning path.',
      });
      return;
    }
    successResponse(res, preview);
  }
);

/**
 * Unlock next module in learning path
 * POST /api/learning-path/unlock-next
 */
export const unlockNextModule = asyncHandler(
  async (req: Request, res: Response) => {
    const teacherId = req.user!.uid;
    const path = await tutorService.unlockNextModule(teacherId);
    successResponse(res, path);
  }
);
