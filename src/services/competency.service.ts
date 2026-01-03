/**
 * Competency Service
 * Business logic for competency assessments, attempts, and results
 */

import {
  createCompetencyRepository,
  CompetencyRepository,
} from '../repositories/competencyRepository';
import {
  // competencyEvaluationEngine,
  evaluateAttempt,
} from './competency.evaluation.service';
import { notificationService } from './notification.service';
import {
  CompetencyAssessment,
  CompetencyQuestion,
  TeacherCompetencyAttempt,
  TeacherCompetencyResult,
  QuestionAnswer,
  AttemptStatus,
  CompetencyResultResponse,
  SelectedQuestion,
  GroupedCompetencyQuestions,
  QuestionType,
} from '../types/competency.types';
import { ATTEMPT_STATUS, QUESTIONS_BY_TYPE, QUESTIONS_PER_DOMAIN } from '../config/constants';
import { NotFoundError, ConflictError, ValidationError } from '../utils/error';
import { logger } from '../utils/logger';
import { SubmitAttemptInput } from '../schemas/competency.schema';

export class CompetencyService {
  private repo: CompetencyRepository;

  constructor(repo?: CompetencyRepository) {
    this.repo = repo || createCompetencyRepository();
  }

  /**
   * Get the active competency assessment with its questions
   */
  async getAssessmentWithQuestions(): Promise<{
    assessment: CompetencyAssessment;
    questions: CompetencyQuestion[];
  }> {
    const assessment = await this.repo.getAssessment();
    if (!assessment || !assessment.active) {
      throw new NotFoundError('No active competency assessment found');
    }

    const questions = await this.repo.getQuestions(assessment.id);
    return { assessment, questions };
  }

  /**
   * Randomize and select questions for a teacher (Task 4)
   * Selects QUESTIONS_PER_DOMAIN questions from each domain
   */
  private async selectRandomQuestions(assessmentId: string): Promise<{
    selectedQuestions: SelectedQuestion[];
    questions: CompetencyQuestion[];
  }> {
    // Get all questions for the assessment
    const allQuestions = await this.repo.getQuestions(assessmentId);

    // Group questions by type
    const questionsByType = new Map<QuestionType, CompetencyQuestion[]>();
    for (const question of allQuestions) {
      const existing = questionsByType.get(question.type) || [];
      existing.push(question);
      questionsByType.set(question.type, existing);
    }

    const selectedQuestions: SelectedQuestion[] = [];
    const questions: CompetencyQuestion[] = [];
    let order = 1;

    // Select required number from each type
    for (const [type, requiredCount] of Object.entries(QUESTIONS_BY_TYPE)) {
      const typeQuestions = questionsByType.get(type as QuestionType) || [];

      if (typeQuestions.length === 0) {
        throw new ValidationError(
          `No ${type} questions available in assessment`,
          { type: [type], error: ['NO_QUESTIONS_AVAILABLE'] }
        );
      }

      if (typeQuestions.length < requiredCount) {
        throw new ValidationError(
          `Not enough ${type} questions: ${typeQuestions.length} available, ${requiredCount} required`,
          {
            type: [type],
            available: [String(typeQuestions.length)],
            required: [String(requiredCount)],
            error: ['INSUFFICIENT_QUESTIONS'],
          }
        );
      }

      // Shuffle and select the required count
      const shuffled = this.shuffleArray([...typeQuestions]);
      const selected = shuffled.slice(0, requiredCount);

      for (const question of selected) {
        selectedQuestions.push({
          questionId: question.id,
          order: order++,
        });
        questions.push(question);
      }
    }

    // Shuffle the final order for randomized sequence across types
    const shuffledSelection = this.shuffleArray(selectedQuestions);
    shuffledSelection.forEach((sq, idx) => {
      sq.order = idx + 1;
    });

    return { selectedQuestions: shuffledSelection, questions };
  }

  /**
   * Fisher-Yates shuffle algorithm
   */
  private shuffleArray<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Start a new attempt for a teacher with randomized questions
   * NOTE: Only ONE attempt per teacher is allowed (no reattempts)
   * @param teacherId - The teacher's user ID
   * @param assessmentId - Optional. If not provided, uses the active assessment
   */
  async startAttempt(
    teacherId: string,
    assessmentId?: string
  ): Promise<
    TeacherCompetencyAttempt & { questions?: GroupedCompetencyQuestions }
  > {
    // Get assessment - either by ID or fetch the active one
    let assessment: CompetencyAssessment | null;
    if (assessmentId) {
      assessment = await this.repo.getAssessmentById(assessmentId);
      if (!assessment || !assessment.active) {
        throw new NotFoundError('Assessment not found or inactive');
      }
    } else {
      assessment = await this.repo.getAssessment();
      if (!assessment || !assessment.active) {
        throw new NotFoundError('No active competency assessment found');
      }
    }
    const actualAssessmentId = assessment.id;

    // Check for ANY existing attempt (enforces single attempt per teacher rule)
    const existingAttempt = await this.repo.getAnyAttemptByTeacher(
      teacherId,
      actualAssessmentId
    );

    if (existingAttempt) {
      // If attempt is already evaluated or failed, teacher cannot reattempt
      if (existingAttempt.status === ATTEMPT_STATUS.EVALUATED) {
        throw new ConflictError(
          'You have already completed the competency assessment. Reattempts are not allowed.'
        );
      }
      if (existingAttempt.status === ATTEMPT_STATUS.FAILED) {
        throw new ConflictError(
          'Your previous attempt could not be evaluated. Please contact support.'
        );
      }
      if (existingAttempt.status === ATTEMPT_STATUS.SUBMITTED) {
        throw new ConflictError(
          'You have a pending submission awaiting evaluation'
        );
      }
      // Return existing in-progress attempt with its selected questions
      if (existingAttempt.selectedQuestions) {
        const questionIds = existingAttempt.selectedQuestions.map(
          (sq) => sq.questionId
        );
        const allQuestions = await this.repo.getQuestions(actualAssessmentId);
        const questions = allQuestions.filter((q) =>
          questionIds.includes(q.id)
        );
        // Sort by the stored order
        const orderMap = new Map(
          existingAttempt.selectedQuestions.map((sq) => [
            sq.questionId,
            sq.order,
          ])
        );
        questions.sort(
          (a, b) => (orderMap.get(a.id) || 0) - (orderMap.get(b.id) || 0)
        );

        const groupedQuestions = this.groupQuestionsByType(questions);
        return { ...existingAttempt, questions: groupedQuestions };
      }
      return existingAttempt;
    }

    // Select random questions for this attempt
    const { selectedQuestions, questions } = await this.selectRandomQuestions(
      actualAssessmentId
    );

    const attempt = await this.repo.createAttempt(
      teacherId,
      actualAssessmentId,
      [],
      selectedQuestions
    );
    const groupedQuestions = this.groupQuestionsByType(questions);
    return { ...attempt, questions: groupedQuestions };
  }

  /**
   * Save partial answers (auto-save during attempt)
   */
  async saveProgress(
    teacherId: string,
    attemptId: string,
    answers: QuestionAnswer[]
  ): Promise<void> {
    const attempt = await this.repo.getAttemptById(attemptId);
    if (!attempt) {
      throw new NotFoundError('Attempt not found');
    }
    if (attempt.teacherId !== teacherId) {
      throw new NotFoundError('Attempt not found');
    }
    if (attempt.status !== ATTEMPT_STATUS.IN_PROGRESS) {
      throw new ConflictError('Cannot update a submitted or evaluated attempt');
    }

    await this.repo.updateAttempt(attemptId, { answers });
  }

  /**
   * Submit an attempt for evaluation
   * NOTE: Only ONE attempt per teacher is allowed (no reattempts)
   * @param teacherId - The teacher's user ID
   * @param input - Submit input with answers. assessmentId is optional - uses active assessment if not provided
   */
  async submitAttempt(
    teacherId: string,
    input: SubmitAttemptInput
  ): Promise<TeacherCompetencyAttempt> {
    // Get assessment - either by ID or fetch the active one
    let assessment: CompetencyAssessment | null;
    if (input.assessmentId) {
      assessment = await this.repo.getAssessmentById(input.assessmentId);
      if (!assessment || !assessment.active) {
        throw new NotFoundError('Assessment not found or inactive');
      }
    } else {
      assessment = await this.repo.getAssessment();
      if (!assessment || !assessment.active) {
        throw new NotFoundError('No active competency assessment found');
      }
    }
    const actualAssessmentId = assessment.id;

    // Check for any existing attempt (enforces single attempt per teacher rule)
    let attempt = await this.repo.getAnyAttemptByTeacher(
      teacherId,
      actualAssessmentId
    );

    if (attempt) {
      // If attempt is already evaluated or failed, teacher cannot submit again
      if (attempt.status === ATTEMPT_STATUS.EVALUATED) {
        throw new ConflictError(
          'You have already completed the competency assessment. Reattempts are not allowed.'
        );
      }
      if (attempt.status === ATTEMPT_STATUS.FAILED) {
        throw new ConflictError(
          'Your previous attempt could not be evaluated. Please contact support.'
        );
      }
      if (attempt.status === ATTEMPT_STATUS.SUBMITTED) {
        throw new ConflictError(
          'You already have a pending submission awaiting evaluation'
        );
      }

      // Validate answers against selected questions for this attempt
      const selectedQuestionIds = attempt.selectedQuestions
        ? new Set(attempt.selectedQuestions.map((sq) => sq.questionId))
        : null;

      if (selectedQuestionIds) {
        // Validate all selected questions have answers
        const answeredIds = new Set(input.answers.map((a) => a.questionId));
        const missingQuestions = Array.from(selectedQuestionIds).filter(
          (qId) => !answeredIds.has(qId)
        );
        if (missingQuestions.length > 0) {
          throw new ValidationError('Missing answers for some questions', {
            missing: missingQuestions,
          });
        }

        // Check for invalid question IDs in answers
        const invalidAnswers = input.answers.filter(
          (a) => !selectedQuestionIds.has(a.questionId)
        );
        if (invalidAnswers.length > 0) {
          throw new ValidationError('Invalid question IDs in answers', {
            invalid: invalidAnswers.map((a) => a.questionId),
          });
        }
      }

      // Update existing in-progress attempt
      await this.repo.submitAttempt(attempt.id, input.answers);

      // Log SUBMIT event (Task 5: Audit Trail)
      await this.repo.createEvent(teacherId, attempt.id, 'SUBMIT');

      // Trigger notification (Task 5: Notifications)
      try {
        await notificationService.triggerCompetencySubmittedNotification(
          teacherId,
          attempt.id
        );
      } catch (err) {
        logger.error(
          'Failed to send competency submitted notification',
          err instanceof Error ? err : undefined,
          {
            teacherId,
            attemptId: attempt.id,
          }
        );
      }

      return {
        ...attempt,
        answers: input.answers,
        status: ATTEMPT_STATUS.SUBMITTED as AttemptStatus,
      };
    }

    // If no existing attempt, create a new one with selected questions and submit
    const { selectedQuestions } = await this.selectRandomQuestions(
      actualAssessmentId
    );

    attempt = await this.repo.createAttempt(
      teacherId,
      actualAssessmentId,
      input.answers,
      selectedQuestions
    );
    await this.repo.submitAttempt(attempt.id, input.answers);

    // Log SUBMIT event (Task 5: Audit Trail)
    await this.repo.createEvent(teacherId, attempt.id, 'SUBMIT');

    // Trigger notification (Task 5: Notifications)
    try {
      await notificationService.triggerCompetencySubmittedNotification(
        teacherId,
        attempt.id
      );
    } catch (err) {
      logger.error(
        'Failed to send competency submitted notification',
        err instanceof Error ? err : undefined,
        {
          teacherId,
          attemptId: attempt.id,
        }
      );
    }

    return {
      ...attempt,
      status: ATTEMPT_STATUS.SUBMITTED as AttemptStatus,
    };
  }

  /**
   * Get a teacher's latest result
   */
  async getResult(teacherId: string): Promise<CompetencyResultResponse | null> {
    const result = await this.repo.getResultByTeacherId(teacherId);
    if (!result) {
      return null;
    }

    return this.formatResultResponse(result);
  }

  /**
   * Get all results for a teacher
   */
  async getAllResults(teacherId: string): Promise<CompetencyResultResponse[]> {
    const results = await this.repo.getAllResultsByTeacher(teacherId);
    return results.map((r) => this.formatResultResponse(r));
  }

  /**
   * Format result for API response
   */
  private formatResultResponse(
    result: TeacherCompetencyResult
  ): CompetencyResultResponse {
    return {
      teacherId: result.teacherId,
      overallScore: result.overallScore,
      proficiencyLevel: result.proficiencyLevel,
      domainScores: result.domainScores.map((d) => ({
        domainKey: d.domainKey,
        scorePercent: d.scorePercent,
      })),
      strengthDomains: result.strengthDomains,
      gapDomains: result.gapDomains,
      recommendedMicroPDs: result.recommendedMicroPDs,
      rawFeedback: result.rawFeedback,
      createdAt: result.createdAt.toDate().toISOString(),
    };
  }

  /**
   * Process submitted attempts (background worker function)
   * Returns the number of attempts processed
   */
  async processSubmittedAttempts(batchSize: number = 10): Promise<number> {
    const attempts = await this.repo.getAttemptsByStatus(
      ATTEMPT_STATUS.SUBMITTED as AttemptStatus,
      batchSize
    );

    if (attempts.length === 0) {
      logger.info('No submitted attempts to process');
      return 0;
    }

    logger.info(`Processing ${attempts.length} submitted attempts`);

    let processedCount = 0;

    for (const attempt of attempts) {
      try {
        await this.evaluateAndSaveResult(attempt);
        processedCount++;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error(`Failed to evaluate attempt ${attempt.id}`, error, {
          attemptId: attempt.id,
        });
        // Increment retry count
        const newRetryCount = (attempt.retryCount || 0) + 1;
        if (newRetryCount >= 3) {
          // Mark as failed after 3 retries
          await this.repo.updateAttempt(attempt.id, {
            status: ATTEMPT_STATUS.FAILED as AttemptStatus,
            retryCount: newRetryCount,
          });
          logger.error(
            `Attempt ${attempt.id} marked as FAILED after 3 retries`
          );
        } else {
          // Update retry count for next attempt
          await this.repo.updateAttempt(attempt.id, {
            retryCount: newRetryCount,
          });
        }
      }
    }

    logger.info(`Processed ${processedCount}/${attempts.length} attempts`);
    return processedCount;
  }

  /**
   * Evaluate a single attempt and save result (idempotent)
   */
  async evaluateAndSaveResult(
    attempt: TeacherCompetencyAttempt
  ): Promise<TeacherCompetencyResult> {
    // Check if result already exists (idempotency)
    const existingResult = await this.repo.getResultByAttemptId(attempt.id);
    if (existingResult) {
      logger.info(
        `Result already exists for attempt ${attempt.id}, skipping evaluation`
      );
      // Ensure attempt is marked as evaluated
      if (attempt.status !== ATTEMPT_STATUS.EVALUATED) {
        await this.repo.updateAttempt(attempt.id, {
          status: ATTEMPT_STATUS.EVALUATED as AttemptStatus,
        });
      }
      return existingResult;
    }

    // Get questions for evaluation - use selected questions if available
    let questions: CompetencyQuestion[];
    if (attempt.selectedQuestions && attempt.selectedQuestions.length > 0) {
      const selectedIds = new Set(
        attempt.selectedQuestions.map((sq) => sq.questionId)
      );
      const allQuestions = await this.repo.getQuestions(attempt.assessmentId);
      questions = allQuestions.filter((q) => selectedIds.has(q.id));
    } else {
      questions = await this.repo.getQuestions(attempt.assessmentId);
    }

    if (questions.length === 0) {
      throw new Error(
        `No questions found for assessment ${attempt.assessmentId}`
      );
    }

    // Run evaluation
    const evaluationResult = await evaluateAttempt(attempt, questions);

    // Save result
    const result = await this.repo.createResult({
      teacherId: evaluationResult.teacherId,
      attemptId: evaluationResult.attemptId,
      assessmentId: evaluationResult.assessmentId,
      overallScore: evaluationResult.overallScore,
      proficiencyLevel: evaluationResult.proficiencyLevel,
      domainScores: evaluationResult.domainScores,
      strengthDomains: evaluationResult.strengthDomains,
      gapDomains: evaluationResult.gapDomains,
      recommendedMicroPDs: evaluationResult.recommendedMicroPDs,
      questionResults: evaluationResult.questionResults,
      rawFeedback: evaluationResult.rawFeedback,
    });

    // Update attempt status to EVALUATED
    await this.repo.updateAttempt(attempt.id, {
      status: ATTEMPT_STATUS.EVALUATED as AttemptStatus,
    });

    // Log EVALUATED event (Task 5: Audit Trail)
    await this.repo.createEvent(attempt.teacherId, attempt.id, 'EVALUATED', {
      resultId: result.id,
      overallScore: result.overallScore,
      proficiencyLevel: result.proficiencyLevel,
    });

    // Trigger notification (Task 5: Notifications)
    try {
      await notificationService.triggerCompetencyEvaluatedNotification(
        attempt.teacherId,
        attempt.id,
        result.id,
        result.overallScore,
        result.proficiencyLevel
      );
    } catch (err) {
      logger.error(
        'Failed to send competency evaluated notification',
        err instanceof Error ? err : undefined,
        {
          teacherId: attempt.teacherId,
          attemptId: attempt.id,
          resultId: result.id,
        }
      );
    }

    logger.info(`Successfully evaluated attempt ${attempt.id}`, {
      resultId: result.id,
      overallScore: result.overallScore,
      proficiencyLevel: result.proficiencyLevel,
    });

    return result;
  }

  /**
   * Manually trigger evaluation for a specific attempt (admin function)
   */
  async triggerEvaluation(attemptId: string): Promise<TeacherCompetencyResult> {
    const attempt = await this.repo.getAttemptById(attemptId);
    if (!attempt) {
      throw new NotFoundError('Attempt not found');
    }

    if (attempt.status === ATTEMPT_STATUS.IN_PROGRESS) {
      throw new ConflictError('Cannot evaluate an in-progress attempt');
    }

    return this.evaluateAndSaveResult(attempt);
  }

  /**
   * Get attempt by ID
   */
  async getAttempt(
    teacherId: string,
    attemptId: string
  ): Promise<TeacherCompetencyAttempt> {
    const attempt = await this.repo.getAttemptById(attemptId);
    if (!attempt || attempt.teacherId !== teacherId) {
      throw new NotFoundError('Attempt not found');
    }
    return attempt;
  }

  /**
   * Get all attempts for a teacher
   */
  async getAttempts(teacherId: string): Promise<TeacherCompetencyAttempt[]> {
    return this.repo.getAttemptsByTeacher(teacherId);
  }

  /**
   * Group questions by type
   * @param questions - The questions to group
   * @returns An object with the questions grouped by type
   */

  private groupQuestionsByType(questions: CompetencyQuestion[]): {
    MCQ: CompetencyQuestion[];
    SHORT_ANSWER: CompetencyQuestion[];
    AUDIO: CompetencyQuestion[];
    VIDEO: CompetencyQuestion[];
  } {
    return {
      MCQ: questions.filter((q) => q.type === 'MCQ'),
      SHORT_ANSWER: questions.filter((q) => q.type === 'SHORT_ANSWER'),
      AUDIO: questions.filter((q) => q.type === 'AUDIO'),
      VIDEO: questions.filter((q) => q.type === 'VIDEO'),
    };
  }
}

// Export singleton instance
export const competencyService = new CompetencyService();
