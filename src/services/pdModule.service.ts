import { generateText } from 'ai';
import { client } from '../config/openai';
import {
  createPdModuleRepository,
  PdModuleRepository,
} from '../repositories/pdModuleRepository';
import { createTutorRepository } from '../repositories/tutorRepository';
import { notificationService } from './notification.service';
import {
  PdModule,
  PdQuestion,
  PdAttempt,
  PdQuestionAnswer,
  PdQuestionResult,
  PdModuleResponse,
  PdQuestionResponse,
  PdAttemptResponse,
  PdAttemptResultResponse,
  PdQuestionType,
} from '../types/pdModule.types';
import { COMPETENCY_QUESTION_TYPES } from '../config/constants';
import {
  NotFoundError,
  ConflictError,
  ForbiddenError,
  ValidationError,
} from '../utils/error';
import { logger } from '../utils/logger';
import { transcriptionService } from './transcription.service';

// Get the OpenAI model instance
const getModel = () => client('gpt-4o-mini');

// Fallback score percentage when AI fails
const FALLBACK_SCORE_PERCENT = 0.5;
const MAX_RETRIES = 2;
const DEFAULT_QUESTIONS_COUNT = 5;

export class PdModuleService {
  private repo: PdModuleRepository;
  private tutorRepo: ReturnType<typeof createTutorRepository>;

  constructor(repo?: PdModuleRepository) {
    this.repo = repo || createPdModuleRepository();
    this.tutorRepo = createTutorRepository();
  }

  // ============ Module Methods ============

  /**
   * Get all active PD modules
   */
  async getModules(): Promise<PdModuleResponse[]> {
    const modules = await this.repo.getActiveModules();
    return modules.map((m) => this.formatModuleResponse(m));
  }

  /**
   * Get a specific module by ID
   */
  async getModule(moduleId: string): Promise<PdModuleResponse> {
    const module = await this.repo.getModuleById(moduleId);
    if (!module) {
      throw new NotFoundError('Module not found');
    }
    return this.formatModuleResponse(module);
  }

  // ============ Question Methods ============

  /**
   * Get questions for a module (uses cached or generates new)
   */
  async getQuestions(
    teacherId: string,
    moduleId: string
  ): Promise<PdQuestionResponse[]> {
    // Check for active attempt with questions
    const activeAttempt = await this.repo.getActiveAttempt(teacherId, moduleId);
    if (activeAttempt) {
      const attemptQuestions = await this.repo.getQuestionsByAttempt(
        activeAttempt.id
      );
      if (attemptQuestions.length > 0) {
        return attemptQuestions.map((q) => this.formatQuestionResponse(q));
      }
    }

    // Get cached questions for module
    const cachedQuestions = await this.repo.getQuestionsByModule(moduleId);
    if (cachedQuestions.length > 0) {
      return cachedQuestions.map((q) => this.formatQuestionResponse(q));
    }

    // No questions found
    throw new NotFoundError('No questions available for this module');
  }

  /**
   * Generate AI questions for a module
   */
  async generateQuestions(
    moduleId: string,
    attemptId: string,
    count: number = DEFAULT_QUESTIONS_COUNT
  ): Promise<PdQuestion[]> {
    const module = await this.repo.getModuleById(moduleId);
    if (!module) {
      throw new NotFoundError('Module not found');
    }

    try {
      // Generate questions using AI
      const prompt = this.getQuestionGenerationPrompt(module, count);
      const { text } = await generateText({
        model: getModel() as unknown as Parameters<
          typeof generateText
        >[0]['model'],
        system:
          'You are an expert educator creating assessment questions for professional development modules.',
        prompt,
        temperature: 0.7,
        maxTokens: 2000,
      });

      // Parse AI response
      const questions = this.parseGeneratedQuestions(text, moduleId, attemptId);

      // Save questions
      const savedQuestions = await this.repo.createQuestions(questions);
      return savedQuestions;
    } catch (err) {
      logger.error(
        'Failed to generate AI questions, using fallback',
        err instanceof Error ? err : undefined,
        { moduleId }
      );

      // Fallback to cached questions
      const cached = await this.repo.getQuestionsByModule(moduleId);
      if (cached.length > 0) {
        // Copy cached questions for this attempt
        const attemptQuestions = cached.slice(0, count).map((q, idx) => ({
          moduleId: q.moduleId,
          attemptId,
          type: q.type,
          prompt: q.prompt,
          options: q.options,
          correctOption: q.correctOption,
          maxScore: q.maxScore,
          order: idx + 1,
          generatedByAi: false,
        }));
        return this.repo.createQuestions(attemptQuestions);
      }

      throw new Error('Failed to generate questions and no fallback available');
    }
  }

  // ============ Attempt Methods ============

  /**
   * Start a new attempt for a module
   */
  async startAttempt(
    teacherId: string,
    moduleId: string
  ): Promise<{ attempt: PdAttemptResponse; questions: PdQuestionResponse[] }> {
    const module = await this.repo.getModuleById(moduleId);
    if (!module || !module.active) {
      throw new NotFoundError('Module not found or inactive');
    }

    // Check for existing active attempt
    const existingAttempt = await this.repo.getActiveAttempt(
      teacherId,
      moduleId
    );
    if (existingAttempt) {
      const questions = await this.repo.getQuestionsByAttempt(
        existingAttempt.id
      );
      return {
        attempt: this.formatAttemptResponse(existingAttempt),
        questions: questions.map((q) => this.formatQuestionResponse(q)),
      };
    }

    // Check attempt limits
    const previousAttempts = await this.repo.getAttemptsByTeacherAndModule(
      teacherId,
      moduleId
    );

    // Check for cooldown after max failed attempts
    const failedAttempts = previousAttempts.filter(
      (a) => a.status === 'FAILED'
    );
    if (failedAttempts.length >= module.maxAttempts) {
      const lastFailed = failedAttempts[0];
      const cooldownEnd = new Date(
        lastFailed.evaluatedAt!.toDate().getTime() +
          module.cooldownHours * 60 * 60 * 1000
      );
      if (new Date() < cooldownEnd) {
        throw new ForbiddenError(
          `Module is locked. Please try again after ${cooldownEnd.toISOString()}`
        );
      }
    }

    // Check if already passed
    const passedAttempt = previousAttempts.find((a) => a.status === 'PASSED');
    if (passedAttempt) {
      throw new ConflictError('You have already passed this module');
    }

    // Create new attempt
    const attemptNumber = previousAttempts.length + 1;
    const attempt = await this.repo.createAttempt(
      teacherId,
      moduleId,
      attemptNumber
    );

    // Generate or get questions
    let questions: PdQuestion[];
    try {
      questions = await this.generateQuestions(
        moduleId,
        attempt.id,
        DEFAULT_QUESTIONS_COUNT
      );
    } catch {
      // If generation fails, use cached questions
      const cached = await this.repo.getQuestionsByModule(moduleId);
      if (cached.length === 0) {
        throw new NotFoundError('No questions available for this module');
      }
      questions = cached;
    }

    // Log event
    await this.repo.createEvent(
      teacherId,
      moduleId,
      'ATTEMPT_STARTED',
      attempt.id
    );

    return {
      attempt: this.formatAttemptResponse(attempt),
      questions: questions.map((q) => this.formatQuestionResponse(q)),
    };
  }

  /**
   * Save responses for an attempt
   */
  async saveResponses(
    teacherId: string,
    attemptId: string,
    responses: PdQuestionAnswer[]
  ): Promise<void> {
    const attempt = await this.repo.getAttemptById(attemptId);
    if (!attempt) {
      throw new NotFoundError('Attempt not found');
    }
    if (attempt.teacherId !== teacherId) {
      throw new ForbiddenError('You can only update your own attempts');
    }
    if (attempt.status !== 'IN_PROGRESS') {
      throw new ConflictError('Cannot update a submitted attempt');
    }

    await this.repo.saveResponses(attemptId, responses);

    // Log event
    await this.repo.createEvent(
      teacherId,
      attempt.moduleId,
      'RESPONSE_SAVED',
      attemptId
    );
  }

  /**
   * Submit an attempt for evaluation
   * Auto-triggers evaluation after successful submission
   */
  async submitAttempt(
    teacherId: string,
    attemptId: string,
    responses: PdQuestionAnswer[]
  ): Promise<PdAttemptResponse & { result?: PdAttemptResultResponse }> {
    const attempt = await this.repo.getAttemptById(attemptId);
    if (!attempt) {
      throw new NotFoundError('Attempt not found');
    }
    if (attempt.teacherId !== teacherId) {
      throw new ForbiddenError('You can only submit your own attempts');
    }
    if (attempt.status !== 'IN_PROGRESS') {
      throw new ConflictError('Attempt has already been submitted');
    }

    // Validate responses
    const questions = await this.repo.getQuestionsByAttempt(attemptId);
    if (questions.length === 0) {
      // Fallback to module questions
      const moduleQuestions = await this.repo.getQuestionsByModule(
        attempt.moduleId
      );
      if (moduleQuestions.length === 0) {
        throw new ValidationError('No questions found for this attempt', {});
      }
    }

    // Submit
    await this.repo.submitAttempt(attemptId, responses);

    // Log event
    await this.repo.createEvent(
      teacherId,
      attempt.moduleId,
      'ATTEMPT_SUBMITTED',
      attemptId
    );

    // Auto-trigger evaluation
    let evaluationResult: PdAttemptResultResponse | undefined;
    try {
      logger.info('Auto-triggering PD evaluation after submit', {
        attemptId,
        teacherId,
      });
      evaluationResult = await this.evaluateAttempt(attemptId);
      logger.info('PD evaluation completed successfully', {
        attemptId,
        score: evaluationResult.score,
        passed: evaluationResult.passed,
      });
    } catch (err) {
      logger.error(
        'Auto-evaluation failed after submit, result will be pending',
        err instanceof Error ? err : undefined,
        { teacherId, attemptId }
      );
      // Still send notification that it's submitted
      try {
        await notificationService.createNotification({
          userId: teacherId,
          type: 'pd_attempt_submitted',
          title: 'PD Assessment Submitted',
          message:
            'Your PD module assessment has been submitted. Results will be available shortly.',
          metadata: { attemptId, moduleId: attempt.moduleId },
        });
      } catch (notifErr) {
        logger.error(
          'Failed to send PD submission notification',
          notifErr instanceof Error ? notifErr : undefined,
          { teacherId, attemptId }
        );
      }
    }

    if (evaluationResult) {
      return {
        ...this.formatAttemptResponse(attempt),
        status: evaluationResult.passed ? 'PASSED' : 'FAILED',
        result: evaluationResult,
      };
    }

    return {
      ...this.formatAttemptResponse(attempt),
      status: 'SUBMITTED',
    };
  }

  /**
   * Teacher can trigger evaluation of their own submitted attempt
   */
  async triggerOwnEvaluation(
    teacherId: string,
    attemptId: string
  ): Promise<PdAttemptResultResponse> {
    const attempt = await this.repo.getAttemptById(attemptId);
    if (!attempt) {
      throw new NotFoundError('Attempt not found');
    }
    if (attempt.teacherId !== teacherId) {
      throw new ForbiddenError('You can only evaluate your own attempts');
    }
    if (attempt.status === 'IN_PROGRESS') {
      throw new ConflictError(
        'Please submit the attempt before requesting evaluation'
      );
    }
    if (['PASSED', 'FAILED', 'EVALUATED'].includes(attempt.status)) {
      // Already evaluated, just return the result
      return this.getAttemptResult(teacherId, attemptId);
    }

    logger.info('Teacher triggered own evaluation', { teacherId, attemptId });
    return this.evaluateAttempt(attemptId);
  }

  /**
   * Get attempt result
   */
  async getAttemptResult(
    teacherId: string,
    attemptId: string
  ): Promise<PdAttemptResultResponse> {
    const attempt = await this.repo.getAttemptById(attemptId);
    if (!attempt) {
      throw new NotFoundError('Attempt not found');
    }
    if (attempt.teacherId !== teacherId) {
      throw new ForbiddenError('You can only view your own results');
    }
    if (!['PASSED', 'FAILED', 'EVALUATED'].includes(attempt.status)) {
      throw new ConflictError('Attempt has not been evaluated yet');
    }

    return {
      attemptId: attempt.id,
      moduleId: attempt.moduleId,
      score: attempt.score || 0,
      passed: attempt.passed || false,
      questionResults: (attempt.questionResults || []).map((r) => ({
        questionId: r.questionId,
        score: r.score,
        maxScore: r.maxScore,
        feedback: r.feedback,
      })),
      evaluatedAt: attempt.evaluatedAt?.toDate().toISOString() || '',
    };
  }

  /**
   * Evaluate an attempt
   */
  async evaluateAttempt(attemptId: string): Promise<PdAttemptResultResponse> {
    const attempt = await this.repo.getAttemptById(attemptId);
    if (!attempt) {
      throw new NotFoundError('Attempt not found');
    }
    if (attempt.status !== 'SUBMITTED') {
      throw new ConflictError('Attempt is not ready for evaluation');
    }

    const module = await this.repo.getModuleById(attempt.moduleId);
    if (!module) {
      throw new NotFoundError('Module not found');
    }

    // Get questions
    let questions = await this.repo.getQuestionsByAttempt(attemptId);
    if (questions.length === 0) {
      questions = await this.repo.getQuestionsByModule(attempt.moduleId);
    }

    // Create answer map
    const answerMap = new Map(
      attempt.responses.map((r) => [r.questionId, r.answer])
    );

    // Evaluate each question
    const questionResults: PdQuestionResult[] = [];
    let totalScore = 0;
    let maxScore = 0;

    for (const question of questions) {
      const answer = answerMap.get(question.id) || '';
      const result = await this.evaluateQuestion(question, answer);
      questionResults.push(result);
      totalScore += result.score;
      maxScore += result.maxScore;
    }

    // Calculate percentage and pass/fail
    const scorePercent = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
    const passed = scorePercent >= module.passingScore;

    // Save evaluation
    await this.repo.evaluateAttempt(
      attemptId,
      questionResults,
      Math.round(scorePercent * 100) / 100,
      passed
    );

    // Log events
    await this.repo.createEvent(
      attempt.teacherId,
      attempt.moduleId,
      'ATTEMPT_EVALUATED',
      attemptId,
      { score: scorePercent, passed }
    );

    await this.repo.createEvent(
      attempt.teacherId,
      attempt.moduleId,
      passed ? 'MODULE_PASSED' : 'MODULE_FAILED',
      attemptId
    );

    // If passed, unlock next module in learning path
    if (passed) {
      try {
        const learningPath = await this.tutorRepo.getLearningPathByTeacher(
          attempt.teacherId
        );
        if (learningPath) {
          // Mark current module as completed
          await this.tutorRepo.completeModule(
            learningPath.id,
            attempt.moduleId
          );
          // Unlock next module
          await this.tutorRepo.unlockNextModule(learningPath.id);

          // Send notification
          await notificationService.createNotification({
            userId: attempt.teacherId,
            type: 'pd_module_passed',
            title: 'Module Completed!',
            message: `Congratulations! You passed the PD module with ${scorePercent.toFixed(
              0
            )}%!`,
            metadata: {
              attemptId,
              moduleId: attempt.moduleId,
              score: scorePercent,
            },
          });
        }
      } catch (err) {
        logger.error(
          'Failed to update learning path',
          err instanceof Error ? err : undefined,
          { teacherId: attempt.teacherId, attemptId }
        );
      }
    } else {
      try {
        await notificationService.createNotification({
          userId: attempt.teacherId,
          type: 'pd_module_failed',
          title: 'Assessment Result',
          message: `You scored ${scorePercent.toFixed(0)}%. ${
            module.passingScore
          }% is required to pass. You can retry.`,
          metadata: {
            attemptId,
            moduleId: attempt.moduleId,
            score: scorePercent,
            passingScore: module.passingScore,
          },
        });
      } catch (err) {
        logger.error(
          'Failed to send failure notification',
          err instanceof Error ? err : undefined,
          { teacherId: attempt.teacherId, attemptId }
        );
      }
    }

    return {
      attemptId: attempt.id,
      moduleId: attempt.moduleId,
      score: Math.round(scorePercent * 100) / 100,
      passed,
      questionResults: questionResults.map((r) => ({
        questionId: r.questionId,
        score: r.score,
        maxScore: r.maxScore,
        feedback: r.feedback,
      })),
      evaluatedAt: new Date().toISOString(),
    };
  }

  /**
   * Process submitted attempts (background worker)
   */
  async processSubmittedAttempts(batchSize: number = 10): Promise<number> {
    const attempts = await this.repo.getAttemptsByStatus(
      'SUBMITTED',
      batchSize
    );
    let processed = 0;

    for (const attempt of attempts) {
      try {
        await this.evaluateAttempt(attempt.id);
        processed++;
      } catch (err) {
        logger.error(
          'Failed to evaluate PD attempt',
          err instanceof Error ? err : undefined,
          { attemptId: attempt.id }
        );
      }
    }

    return processed;
  }

  // ============ Private Helpers ============

  private async evaluateQuestion(
    question: PdQuestion,
    answer: string
  ): Promise<PdQuestionResult> {
    if (!answer) {
      return {
        questionId: question.id,
        type: question.type,
        score: 0,
        maxScore: question.maxScore,
        feedback: 'No answer provided.',
      };
    }

    switch (question.type) {
      case COMPETENCY_QUESTION_TYPES.MCQ:
        return this.evaluateMCQ(question, answer);
      case COMPETENCY_QUESTION_TYPES.SHORT_ANSWER:
        return this.evaluateShortAnswer(question, answer);
      case COMPETENCY_QUESTION_TYPES.AUDIO:
        return this.evaluateAudio(question, answer);
      case COMPETENCY_QUESTION_TYPES.VIDEO:
        return this.evaluateVideo(question, answer);
      default:
        return {
          questionId: question.id,
          type: question.type,
          score: 0,
          maxScore: question.maxScore,
          feedback: 'Unknown question type.',
        };
    }
  }

  private evaluateMCQ(question: PdQuestion, answer: string): PdQuestionResult {
    const isCorrect =
      answer.trim().toLowerCase() ===
      question.correctOption?.trim().toLowerCase();

    return {
      questionId: question.id,
      type: question.type,
      score: isCorrect ? question.maxScore : 0,
      maxScore: question.maxScore,
      feedback: isCorrect
        ? 'Correct!'
        : `Incorrect. The correct answer was: ${question.correctOption}`,
    };
  }

  private async evaluateShortAnswer(
    question: PdQuestion,
    answer: string
  ): Promise<PdQuestionResult> {
    try {
      const prompt = `
Evaluate this short answer response for a professional development module:

Question: ${question.prompt}
Answer: ${answer}
Maximum Score: ${question.maxScore}

Evaluate based on:
1. Correctness and accuracy
2. Depth of understanding
3. Practical application

Respond in JSON format:
{ "score": <number 0 to ${question.maxScore}>, "feedback": "<brief feedback>" }
`;

      const { text } = await generateText({
        model: getModel() as unknown as Parameters<
          typeof generateText
        >[0]['model'],
        prompt,
        temperature: 0.3,
        maxTokens: 300,
      });

      const parsed = this.parseEvaluationResponse(text, question.maxScore);
      return {
        questionId: question.id,
        type: question.type,
        score: parsed.score,
        maxScore: question.maxScore,
        feedback: parsed.feedback,
      };
    } catch (err) {
      logger.error(
        'Short answer evaluation failed',
        err instanceof Error ? err : undefined,
        { questionId: question.id }
      );
      return {
        questionId: question.id,
        type: question.type,
        score: question.maxScore * FALLBACK_SCORE_PERCENT,
        maxScore: question.maxScore,
        feedback: 'Evaluation completed with default scoring.',
      };
    }
  }

  private async evaluateAudio(
    question: PdQuestion,
    answer: string
  ): Promise<PdQuestionResult> {
    try {
      const transcription = await transcriptionService.transcribeAudio(answer);
      return this.evaluateShortAnswer(
        { ...question, type: 'SHORT_ANSWER' as PdQuestionType },
        transcription
      );
    } catch (err) {
      logger.error(
        'Audio evaluation failed',
        err instanceof Error ? err : undefined,
        { questionId: question.id }
      );
      return {
        questionId: question.id,
        type: question.type,
        score: 0,
        maxScore: question.maxScore,
        feedback: 'Unable to process audio response.',
      };
    }
  }

  private async evaluateVideo(
    question: PdQuestion,
    answer: string
  ): Promise<PdQuestionResult> {
    try {
      const transcription = await transcriptionService.transcribeVideo(answer);
      return this.evaluateShortAnswer(
        { ...question, type: 'SHORT_ANSWER' as PdQuestionType },
        transcription
      );
    } catch (err) {
      logger.error(
        'Video evaluation failed',
        err instanceof Error ? err : undefined,
        { questionId: question.id }
      );
      return {
        questionId: question.id,
        type: question.type,
        score: 0,
        maxScore: question.maxScore,
        feedback: 'Unable to process video response.',
      };
    }
  }

  private parseEvaluationResponse(
    text: string,
    maxScore: number
  ): { score: number; feedback: string } {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const score = Math.min(Math.max(0, Number(parsed.score)), maxScore);
        return {
          score: isNaN(score) ? maxScore * FALLBACK_SCORE_PERCENT : score,
          feedback: String(parsed.feedback || 'No feedback provided.'),
        };
      }
    } catch {
      // Ignore parse errors
    }
    return {
      score: maxScore * FALLBACK_SCORE_PERCENT,
      feedback: 'Evaluation completed.',
    };
  }

  private getQuestionGenerationPrompt(module: PdModule, count: number): string {
    return `
Generate ${count} assessment questions for a professional development module:

Module: ${module.title}
Domain: ${module.domainKey}
Description: ${module.description}

Create a mix of question types:
- 3 multiple choice questions (MCQ) with 4 options
- 2 short answer questions

Format as JSON array:
[
  {
    "type": "MCQ",
    "prompt": "Question text",
    "options": ["A", "B", "C", "D"],
    "correctOption": "A",
    "maxScore": 1
  },
  {
    "type": "SHORT_ANSWER",
    "prompt": "Question text",
    "maxScore": 5
  }
]

Questions should assess practical understanding of the module content.
`;
  }

  private parseGeneratedQuestions(
    text: string,
    moduleId: string,
    attemptId: string
  ): Array<Omit<PdQuestion, 'id' | 'createdAt'>> {
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No JSON array found');

      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.map((q: Record<string, unknown>, idx: number) => ({
        moduleId,
        attemptId,
        type: q.type as PdQuestionType,
        prompt: String(q.prompt),
        options: Array.isArray(q.options) ? q.options : undefined,
        correctOption: q.correctOption ? String(q.correctOption) : undefined,
        maxScore: Number(q.maxScore) || 1,
        order: idx + 1,
        generatedByAi: true,
      }));
    } catch (err) {
      logger.error(
        'Failed to parse generated questions',
        err instanceof Error ? err : undefined
      );
      throw new Error('Failed to parse AI-generated questions');
    }
  }

  private formatModuleResponse(module: PdModule): PdModuleResponse {
    return {
      id: module.id,
      title: module.title,
      description: module.description,
      domainKey: module.domainKey,
      passingScore: module.passingScore,
      maxAttempts: module.maxAttempts,
    };
  }

  private formatQuestionResponse(question: PdQuestion): PdQuestionResponse {
    return {
      id: question.id,
      type: question.type,
      prompt: question.prompt,
      options: question.options,
      maxScore: question.maxScore,
      order: question.order,
    };
  }

  private formatAttemptResponse(attempt: PdAttempt): PdAttemptResponse {
    return {
      id: attempt.id,
      moduleId: attempt.moduleId,
      attemptNumber: attempt.attemptNumber,
      status: attempt.status,
      score: attempt.score,
      passed: attempt.passed,
      createdAt: attempt.createdAt.toDate().toISOString(),
      submittedAt: attempt.submittedAt?.toDate().toISOString(),
      evaluatedAt: attempt.evaluatedAt?.toDate().toISOString(),
    };
  }
}

// Export singleton instance
export const pdModuleService = new PdModuleService();
