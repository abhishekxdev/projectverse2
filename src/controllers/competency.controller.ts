import { Request, Response, NextFunction } from 'express';
import {
  CompetencyService,
  competencyService,
} from '../services/competency.service';
import { successResponse, createdResponse } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import { NotFoundError, AppError } from '../utils/error';
import { HTTP_STATUS, ATTEMPT_STATUS } from '../config/constants';
import {
  SubmitAttemptInput,
  TriggerEvaluationInput,
} from '../schemas/competency.schema';

/**
 * Get competency assessment questions
 * GET /api/competency/questions
 */
export const getCompetencyQuestions = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { assessment, questions } =
      await competencyService.getAssessmentWithQuestions();
    successResponse(res, { assessment, questions });
  }
);

/**
 * Start a new competency attempt
 * POST /api/competency/attempts
 * assessmentId is optional - uses active assessment if not provided
 */
export const startAttempt = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const teacherId = req.user?.uid;
    if (!teacherId) {
      throw new NotFoundError('User not found');
    }

    const { assessmentId } = req.body || {};
    const attempt = await competencyService.startAttempt(
      teacherId,
      assessmentId // Optional - service will use active assessment if not provided
    );
    createdResponse(res, attempt);
  }
);

/**
 * Save attempt progress (auto-save)
 * PATCH /api/competency/attempts/:attemptId
 */
export const saveAttemptProgress = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const teacherId = req.user?.uid;
    if (!teacherId) {
      throw new NotFoundError('User not found');
    }

    const { attemptId } = req.params;
    const { answers } = req.body;

    await competencyService.saveProgress(teacherId, attemptId, answers);
    successResponse(res, { message: 'Progress saved' });
  }
);

/**
 * Submit a competency attempt for evaluation
 * POST /api/competency/submit
 * Auto-triggers evaluation after successful submission
 */
export const submitAttempt = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const teacherId = req.user?.uid;
    if (!teacherId) {
      throw new NotFoundError('User not found');
    }

    const input: SubmitAttemptInput = req.body;
    const attempt = await competencyService.submitAttempt(teacherId, input);

    // Auto-trigger evaluation after submission
    let evaluationResult = null;
    try {
      evaluationResult = await competencyService.triggerEvaluation(attempt.id);
    } catch (evalError) {
      // Log error but don't fail the submission - evaluation can be retried
      console.error('Auto-evaluation failed, will retry later:', evalError);
    }

    if (evaluationResult) {
      successResponse(res, {
        message: 'Assessment submitted and evaluated successfully.',
        attemptId: attempt.id,
        status: 'EVALUATED',
        result: {
          overallScore: evaluationResult.overallScore,
          proficiencyLevel: evaluationResult.proficiencyLevel,
        },
      });
    } else {
      successResponse(res, {
        message:
          'Assessment submitted successfully. Results will be available shortly.',
        attemptId: attempt.id,
        status: attempt.status,
      });
    }
  }
);

/**
 * Get competency result for the current user
 * GET /api/competency/result
 * Returns 200 for evaluated result, 202 for pending, 404 for no attempt
 */
export const getResult = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const teacherId = req.user?.uid;
    if (!teacherId) {
      throw new NotFoundError('User not found');
    }

    // First check if teacher has a result
    const result = await competencyService.getResult(teacherId);
    if (result) {
      successResponse(res, {
        status: 'OK',
        code: 'RESULT_AVAILABLE',
        data: result,
      });
      return;
    }

    // Check if there's a submitted attempt pending evaluation
    const attempts = await competencyService.getAttempts(teacherId);
    const submittedAttempt = attempts.find(
      (a) => a.status === ATTEMPT_STATUS.SUBMITTED
    );

    if (submittedAttempt) {
      // Result is pending - return 202
      res.status(HTTP_STATUS.ACCEPTED || 202).json({
        success: true,
        status: 'PENDING',
        code: 'RESULT_PENDING',
        message:
          'Your competency assessment has been submitted and is still being evaluated. Please check back in a few minutes.',
      });
      return;
    }

    // No result and no submitted attempt
    throw new AppError(
      'No competency assessment result found for this teacher. Please complete the competency assessment first.',
      HTTP_STATUS.NOT_FOUND,
      'NO_COMPETENCY_RESULT'
    );
  }
);

/**
 * Get all competency results for the current user
 * GET /api/competency/results
 */
export const getAllResults = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const teacherId = req.user?.uid;
    if (!teacherId) {
      throw new NotFoundError('User not found');
    }

    const results = await competencyService.getAllResults(teacherId);
    successResponse(res, { results });
  }
);

/**
 * Get the teacher's attempt (auto-fetch since only one attempt allowed)
 * GET /api/competency/attempt
 */
export const getMyAttempt = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const teacherId = req.user?.uid;
    if (!teacherId) {
      throw new NotFoundError('User not found');
    }

    const attempts = await competencyService.getAttempts(teacherId);
    if (attempts.length === 0) {
      throw new AppError(
        'No attempt found. Please start the competency assessment first.',
        HTTP_STATUS.NOT_FOUND,
        'NO_ATTEMPT_FOUND'
      );
    }

    // Return the single attempt (most recent if multiple exist for some reason)
    const attempt = attempts[0];
    successResponse(res, attempt);
  }
);

/**
 * Get attempts for the current user (legacy - returns array)
 * GET /api/competency/attempts
 */
export const getAttempts = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const teacherId = req.user?.uid;
    if (!teacherId) {
      throw new NotFoundError('User not found');
    }

    const attempts = await competencyService.getAttempts(teacherId);
    successResponse(res, { attempts });
  }
);

/**
 * Get a specific attempt by ID (legacy)
 * GET /api/competency/attempts/:attemptId
 */
export const getAttempt = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const teacherId = req.user?.uid;
    if (!teacherId) {
      throw new NotFoundError('User not found');
    }

    const { attemptId } = req.params;
    const attempt = await competencyService.getAttempt(teacherId, attemptId);
    successResponse(res, attempt);
  }
);

/**
 * Trigger evaluation for submitted attempts
 * POST /api/competency/evaluate - Teacher triggers their own evaluation
 * POST /api/competency/evaluate/batch - Admin batch processing
 */
export const triggerEvaluation = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.uid;
    const userRole = req.user?.role;
    const input: TriggerEvaluationInput = req.body || {};

    // If teacher is calling, find and evaluate their submitted attempt
    if (userRole !== 'platform_admin') {
      if (!userId) {
        throw new NotFoundError('User not found');
      }

      // Get teacher's submitted attempt
      const attempts = await competencyService.getAttempts(userId);
      const submittedAttempt = attempts.find(
        (a) => a.status === ATTEMPT_STATUS.SUBMITTED
      );

      if (!submittedAttempt) {
        throw new AppError(
          'No submitted attempt found to evaluate. Please submit your assessment first.',
          HTTP_STATUS.NOT_FOUND,
          'NO_SUBMITTED_ATTEMPT'
        );
      }

      const result = await competencyService.triggerEvaluation(submittedAttempt.id);
      successResponse(res, {
        message: 'Evaluation completed',
        resultId: result.id,
        overallScore: result.overallScore,
        proficiencyLevel: result.proficiencyLevel,
      });
      return;
    }

    // Admin can evaluate specific attempt or batch process
    if (input.attemptId) {
      // Evaluate a specific attempt
      const result = await competencyService.triggerEvaluation(input.attemptId);
      successResponse(res, {
        message: 'Evaluation completed',
        resultId: result.id,
        overallScore: result.overallScore,
        proficiencyLevel: result.proficiencyLevel,
      });
    } else {
      // Process batch of submitted attempts
      const batchSize = input.batchSize || 10;
      const processedCount = await competencyService.processSubmittedAttempts(
        batchSize
      );
      successResponse(res, {
        message: `Processed ${processedCount} attempts`,
        processedCount,
      });
    }
  }
);
