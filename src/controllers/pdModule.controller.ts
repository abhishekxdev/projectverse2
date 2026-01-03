import { Request, Response } from 'express';
import { pdModuleService } from '../services/pdModule.service';
import { asyncHandler } from '../utils/asyncHandler';
import { successResponse, createdResponse } from '../utils/response';

/**
 * Get all active PD modules
 * GET /api/pd/modules
 */
export const getModules = asyncHandler(async (_req: Request, res: Response) => {
  const modules = await pdModuleService.getModules();
  successResponse(res, { modules });
});

/**
 * Get a specific module
 * GET /api/pd/modules/:moduleId
 */
export const getModule = asyncHandler(async (req: Request, res: Response) => {
  const { moduleId } = req.params;
  const module = await pdModuleService.getModule(moduleId);
  successResponse(res, module);
});

/**
 * Get questions for a module
 * GET /api/pd/modules/:moduleId/questions
 */
export const getQuestions = asyncHandler(
  async (req: Request, res: Response) => {
    const teacherId = req.user!.uid;
    const { moduleId } = req.params;
    const questions = await pdModuleService.getQuestions(teacherId, moduleId);
    successResponse(res, { questions });
  }
);

/**
 * Start a new attempt for a module
 * POST /api/pd/modules/:moduleId/attempt/start
 */
export const startAttempt = asyncHandler(
  async (req: Request, res: Response) => {
    const teacherId = req.user!.uid;
    const { moduleId } = req.params;
    const result = await pdModuleService.startAttempt(teacherId, moduleId);
    createdResponse(res, result);
  }
);

/**
 * Save responses for an attempt
 * POST /api/pd/attempts/:attemptId/responses
 */
export const saveResponses = asyncHandler(
  async (req: Request, res: Response) => {
    const teacherId = req.user!.uid;
    const { attemptId } = req.params;
    const { responses } = req.body;
    await pdModuleService.saveResponses(teacherId, attemptId, responses);
    successResponse(res, { message: 'Responses saved' });
  }
);

/**
 * Submit an attempt for evaluation
 * POST /api/pd/attempts/:attemptId/submit
 */
export const submitAttempt = asyncHandler(
  async (req: Request, res: Response) => {
    const teacherId = req.user!.uid;
    const { attemptId } = req.params;
    const { responses } = req.body;
    const attempt = await pdModuleService.submitAttempt(
      teacherId,
      attemptId,
      responses
    );
    successResponse(res, {
      message: 'Assessment submitted successfully',
      attempt,
    });
  }
);

/**
 * Get result for an attempt
 * GET /api/pd/attempts/:attemptId/result
 */
export const getAttemptResult = asyncHandler(
  async (req: Request, res: Response) => {
    const teacherId = req.user!.uid;
    const { attemptId } = req.params;
    const result = await pdModuleService.getAttemptResult(teacherId, attemptId);
    successResponse(res, result);
  }
);

/**
 * Teacher triggers evaluation of their own attempt
 * POST /api/pd/attempts/:attemptId/evaluate
 */
export const triggerOwnEvaluation = asyncHandler(
  async (req: Request, res: Response) => {
    const teacherId = req.user!.uid;
    const { attemptId } = req.params;
    const result = await pdModuleService.triggerOwnEvaluation(
      teacherId,
      attemptId
    );
    successResponse(res, {
      message: 'Evaluation completed',
      result,
    });
  }
);

/**
 * Trigger evaluation for submitted attempts (admin/background worker)
 * POST /api/pd/evaluate
 */
export const triggerEvaluation = asyncHandler(
  async (req: Request, res: Response) => {
    const { batchSize, attemptId } = req.body;

    if (attemptId) {
      // Evaluate specific attempt
      const result = await pdModuleService.evaluateAttempt(attemptId);
      successResponse(res, {
        message: 'Evaluation completed',
        result,
      });
    } else {
      // Process batch
      const processedCount = await pdModuleService.processSubmittedAttempts(
        batchSize || 10
      );
      successResponse(res, {
        message: `Processed ${processedCount} attempts`,
        processedCount,
      });
    }
  }
);
