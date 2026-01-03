import {
  CompetencyQuestion,
  QuestionAnswer,
  TeacherCompetencyAttempt,
  DomainScore,
  QuestionEvaluationResult,
  ProficiencyLevel,
} from '../types/competency.types';
import {
  DOMAIN_MICRO_PD_MAP,
  STRENGTH_THRESHOLD_PERCENT,
  PROFICIENCY_LEVELS,
  // PROFICIENCY_THRESHOLDS,
  COMPETENCY_QUESTION_TYPES,
} from '../config/constants';
import {
  EVALUATOR_SYSTEM_PROMPT,
  getShortAnswerEvaluationPrompt,
  getAudioEvaluationPrompt,
  getVideoEvaluationPrompt,
  getOverallFeedbackPrompt,
  AIEvaluationResponse,
} from '../prompts/evaluation.prompt';
import { logger } from '../utils/logger';
import { transcriptionService } from './transcription.service';
import { openai, AI_CONFIG } from '../config/openai-client';

// Fallback score percentage when AI fails
const FALLBACK_SCORE_PERCENT = 0.5;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

interface EvaluationResult {
  teacherId: string;
  attemptId: string;
  assessmentId: string;
  overallScore: number;
  proficiencyLevel: ProficiencyLevel;
  domainScores: DomainScore[];
  strengthDomains: string[];
  gapDomains: string[];
  recommendedMicroPDs: string[];
  questionResults: QuestionEvaluationResult[];
  rawFeedback: string;
}

/**
 * Sleep utility for retry delays
 */
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Clamp a score to valid range [0, maxScore]
 */
const clampScore = (score: number, maxScore: number): number => {
  if (isNaN(score) || score < 0) return 0;
  if (score > maxScore) return maxScore;
  return score;
};

/**
 * Parse AI response JSON safely
 */
const parseAIResponse = (
  text: string,
  maxScore: number
): AIEvaluationResponse => {
  try {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      score: clampScore(Number(parsed.score), maxScore),
      feedback: String(parsed.feedback || 'No feedback provided'),
    };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.warn('Failed to parse AI response', {
      text,
      errorMessage: error.message,
    });
    return {
      score: maxScore * FALLBACK_SCORE_PERCENT,
      feedback: 'Evaluation completed with fallback scoring.',
    };
  }
};

/**
 * Call OpenAI for evaluation with retry logic
 */
const callAIWithRetry = async (
  systemPrompt: string,
  userPrompt: string,
  maxScore: number,
  retries: number = MAX_RETRIES
): Promise<AIEvaluationResponse> => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await openai.responses.create({
        model: AI_CONFIG.model,
        input: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        temperature: 0.3,
        max_output_tokens: AI_CONFIG.maxEvaluationTokens,
      });
      const text = response.output_text ?? (response as any).output?.[0]?.content?.[0]?.text ?? '';

      return parseAIResponse(text, maxScore);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error(`AI evaluation attempt ${attempt + 1} failed`, error, {
        attempt,
      });

      if (attempt < retries) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
      }
    }
  }

  // All retries failed, return fallback
  logger.error('All AI evaluation attempts failed, using fallback score');
  return {
    score: maxScore * FALLBACK_SCORE_PERCENT,
    feedback:
      'Evaluation completed with fallback scoring due to AI service unavailability.',
  };
};

/**
 * Evaluate a single MCQ question locally
 */
const evaluateMCQ = (
  question: CompetencyQuestion,
  answer: QuestionAnswer
): QuestionEvaluationResult => {
  const isCorrect =
    answer.answer.trim().toLowerCase() ===
    question.correctOption?.trim().toLowerCase();

  return {
    questionId: question.id,
    domainKey: question.domainKey,
    type: question.type,
    score: isCorrect ? question.maxScore : 0,
    maxScore: question.maxScore,
    feedback: isCorrect
      ? 'Correct answer.'
      : `Incorrect. The correct answer was: ${question.correctOption}`,
  };
};

/**
 * Evaluate a SHORT_ANSWER question using AI
 */
const evaluateShortAnswer = async (
  question: CompetencyQuestion,
  answer: QuestionAnswer
): Promise<QuestionEvaluationResult> => {
  const prompt = getShortAnswerEvaluationPrompt(
    question.prompt,
    answer.answer,
    question.maxScore,
    question.domainKey
  );

  const result = await callAIWithRetry(
    EVALUATOR_SYSTEM_PROMPT,
    prompt,
    question.maxScore
  );

  return {
    questionId: question.id,
    domainKey: question.domainKey,
    type: question.type,
    score: result.score,
    maxScore: question.maxScore,
    feedback: result.feedback,
  };
};

/**
 * Evaluate an AUDIO question using AI (answer contains S3 URL)
 */
const evaluateAudio = async (
  question: CompetencyQuestion,
  answer: QuestionAnswer
): Promise<QuestionEvaluationResult> => {
  let transcription: string;

  try {
    // Transcribe audio from S3 URL
    logger.info('Transcribing audio for evaluation', {
      questionId: question.id,
      url: answer.answer,
    });

    transcription = await transcriptionService.transcribeAudio(answer.answer);

    logger.info('Audio transcription successful', {
      questionId: question.id,
      transcriptionLength: transcription.length,
    });
  } catch (error) {
    // Log error and return 0 score with helpful feedback
    logger.error(
      'Audio transcription failed',
      error instanceof Error ? error : new Error(String(error)),
      {
        questionId: question.id,
      }
    );

    return {
      questionId: question.id,
      domainKey: question.domainKey,
      type: question.type,
      score: 0,
      maxScore: question.maxScore,
      feedback:
        'Unable to transcribe audio. Please ensure audio is clear and try again.',
    };
  }

  // Evaluate transcription with AI
  const prompt = getAudioEvaluationPrompt(
    question.prompt,
    transcription,
    question.maxScore,
    question.domainKey
  );

  const result = await callAIWithRetry(
    EVALUATOR_SYSTEM_PROMPT,
    prompt,
    question.maxScore
  );

  return {
    questionId: question.id,
    domainKey: question.domainKey,
    type: question.type,
    score: result.score,
    maxScore: question.maxScore,
    feedback: result.feedback,
  };
};

/**
 * Evaluate a VIDEO question using AI (answer contains S3 URL)
 */
const evaluateVideo = async (
  question: CompetencyQuestion,
  answer: QuestionAnswer
): Promise<QuestionEvaluationResult> => {
  let transcription: string;

  try {
    // Transcribe video (extract audio then transcribe) from S3 URL
    logger.info('Transcribing video for evaluation', {
      questionId: question.id,
      url: answer.answer,
    });

    transcription = await transcriptionService.transcribeVideo(answer.answer);

    logger.info('Video transcription successful', {
      questionId: question.id,
      transcriptionLength: transcription.length,
    });
  } catch (error) {
    // Log error and return 0 score with helpful feedback
    logger.error(
      'Video transcription failed',
      error instanceof Error ? error : new Error(String(error)),
      {
        questionId: question.id,
      }
    );

    return {
      questionId: question.id,
      domainKey: question.domainKey,
      type: question.type,
      score: 0,
      maxScore: question.maxScore,
      feedback:
        'Unable to process video. Please ensure video has clear audio and try again.',
    };
  }

  // Evaluate transcription with AI
  const prompt = getVideoEvaluationPrompt(
    question.prompt,
    transcription,
    question.maxScore,
    question.domainKey
  );

  const result = await callAIWithRetry(
    EVALUATOR_SYSTEM_PROMPT,
    prompt,
    question.maxScore
  );

  return {
    questionId: question.id,
    domainKey: question.domainKey,
    type: question.type,
    score: result.score,
    maxScore: question.maxScore,
    feedback: result.feedback,
  };
};

/**
 * Evaluate a single question based on its type
 */
const evaluateQuestion = async (
  question: CompetencyQuestion,
  answer: QuestionAnswer
): Promise<QuestionEvaluationResult> => {
  switch (question.type) {
    case COMPETENCY_QUESTION_TYPES.MCQ:
      return evaluateMCQ(question, answer);
    case COMPETENCY_QUESTION_TYPES.SHORT_ANSWER:
      return evaluateShortAnswer(question, answer);
    case COMPETENCY_QUESTION_TYPES.AUDIO:
      return evaluateAudio(question, answer);
    case COMPETENCY_QUESTION_TYPES.VIDEO:
      return evaluateVideo(question, answer);
    default:
      logger.warn(`Unknown question type: ${question.type}`);
      return {
        questionId: question.id,
        domainKey: question.domainKey,
        type: question.type,
        score: 0,
        maxScore: question.maxScore,
        feedback: 'Unknown question type',
      };
  }
};

/**
 * Calculate domain scores from question results
 */
const calculateDomainScores = (
  questionResults: QuestionEvaluationResult[]
): DomainScore[] => {
  const domainMap = new Map<string, { raw: number; max: number }>();

  for (const result of questionResults) {
    const existing = domainMap.get(result.domainKey) || { raw: 0, max: 0 };
    domainMap.set(result.domainKey, {
      raw: existing.raw + result.score,
      max: existing.max + result.maxScore,
    });
  }

  const domainScores: DomainScore[] = [];
  for (const [domainKey, scores] of domainMap.entries()) {
    if (scores.max === 0) {
      logger.warn(`Domain ${domainKey} has no questions (maxScore = 0)`);
      continue;
    }
    domainScores.push({
      domainKey,
      rawScore: scores.raw,
      maxScore: scores.max,
      scorePercent: (scores.raw / scores.max) * 100,
    });
  }

  return domainScores;
};

/**
 * Determine proficiency level based on overall score percentage
 * Bands from AI_Tutor_Routing_Logic.md:
 * - 0-39%: Beginner (High-Priority Gap)
 * - 40-59%: Developing (Core Skill Builder)
 * - 60-79%: Proficient (Enhancement Track)
 * - 80-100%: Advanced (PD Ambassador Pipeline)
 */
const determineProficiencyLevel = (scorePercent: number): ProficiencyLevel => {
  if (scorePercent >= 80)
    return PROFICIENCY_LEVELS.ADVANCED as ProficiencyLevel;
  if (scorePercent >= 60)
    return PROFICIENCY_LEVELS.PROFICIENT as ProficiencyLevel;
  if (scorePercent >= 40)
    return PROFICIENCY_LEVELS.DEVELOPING as ProficiencyLevel;
  return PROFICIENCY_LEVELS.BEGINNER as ProficiencyLevel;
};

/**
 * Apply 90% rule to determine strength and gap domains
 */
const categorizeDomainsBy90Rule = (
  domainScores: DomainScore[]
): { strengthDomains: string[]; gapDomains: string[] } => {
  const strengthDomains: string[] = [];
  const gapDomains: string[] = [];

  for (const domain of domainScores) {
    if (domain.scorePercent >= STRENGTH_THRESHOLD_PERCENT) {
      strengthDomains.push(domain.domainKey);
    } else {
      gapDomains.push(domain.domainKey);
    }
  }

  return { strengthDomains, gapDomains };
};

/**
 * Get recommended Micro PDs for gap domains
 */
const getRecommendedMicroPDs = (gapDomains: string[]): string[] => {
  const recommendations = new Set<string>();

  for (const domain of gapDomains) {
    const microPDs = DOMAIN_MICRO_PD_MAP[domain] || [];
    microPDs.forEach((pd) => recommendations.add(pd));
  }

  return Array.from(recommendations);
};

/**
 * Generate overall feedback using AI
 */
const generateOverallFeedback = async (
  domainScores: DomainScore[],
  strengthDomains: string[],
  gapDomains: string[]
): Promise<string> => {
  try {
    const prompt = getOverallFeedbackPrompt(
      domainScores.map((d) => ({
        domainKey: d.domainKey,
        scorePercent: d.scorePercent,
      })),
      strengthDomains,
      gapDomains
    );

    const response = await openai.responses.create({
      model: AI_CONFIG.model,
      input: [
        {
          role: 'system',
          content: EVALUATOR_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.5,
      max_output_tokens: 300,
    });

    const text = response.output_text ?? (response as any).output?.[0]?.content?.[0]?.text ?? '';

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.feedback || 'Assessment completed.';
    }
    return 'Assessment completed.';
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('Failed to generate overall feedback', error);
    const strengthText =
      strengthDomains.length > 0
        ? `Strong performance in ${strengthDomains.join(', ')}.`
        : '';
    const gapText =
      gapDomains.length > 0
        ? `Areas for improvement: ${gapDomains.join(', ')}.`
        : '';
    return `${strengthText} ${gapText}`.trim() || 'Assessment completed.';
  }
};

/**
 * Main evaluation function - evaluates a complete attempt
 */
export const evaluateAttempt = async (
  attempt: TeacherCompetencyAttempt,
  questions: CompetencyQuestion[]
): Promise<EvaluationResult> => {
  logger.info(`Starting evaluation for attempt ${attempt.id}`);

  // Create a map of answers by questionId for quick lookup
  const answerMap = new Map(attempt.answers.map((a) => [a.questionId, a]));

  // Evaluate each question
  const questionResults: QuestionEvaluationResult[] = [];

  for (const question of questions) {
    const answer = answerMap.get(question.id);
    if (!answer) {
      // No answer provided for this question - score as 0
      questionResults.push({
        questionId: question.id,
        domainKey: question.domainKey,
        type: question.type,
        score: 0,
        maxScore: question.maxScore,
        feedback: 'No answer provided.',
      });
      continue;
    }

    const result = await evaluateQuestion(question, answer);
    questionResults.push(result);
  }

  // Calculate domain scores
  const domainScores = calculateDomainScores(questionResults);

  // Calculate overall score
  const totalRaw = questionResults.reduce((sum, r) => sum + r.score, 0);
  const totalMax = questionResults.reduce((sum, r) => sum + r.maxScore, 0);
  const overallScorePercent = totalMax > 0 ? (totalRaw / totalMax) * 100 : 0;

  // Determine proficiency level
  const proficiencyLevel = determineProficiencyLevel(overallScorePercent);

  // Apply 90% rule
  const { strengthDomains, gapDomains } =
    categorizeDomainsBy90Rule(domainScores);

  // Get recommended Micro PDs
  const recommendedMicroPDs = getRecommendedMicroPDs(gapDomains);

  // Generate overall feedback
  const rawFeedback = await generateOverallFeedback(
    domainScores,
    strengthDomains,
    gapDomains
  );

  logger.info(`Evaluation completed for attempt ${attempt.id}`, {
    overallScore: overallScorePercent,
    proficiencyLevel,
    strengthCount: strengthDomains.length,
    gapCount: gapDomains.length,
  });

  return {
    teacherId: attempt.teacherId,
    attemptId: attempt.id,
    assessmentId: attempt.assessmentId,
    overallScore: Math.round(overallScorePercent * 100) / 100,
    proficiencyLevel,
    domainScores,
    strengthDomains,
    gapDomains,
    recommendedMicroPDs,
    questionResults,
    rawFeedback,
  };
};

export const competencyEvaluationEngine = {
  evaluate: evaluateAttempt,
  evaluateMCQ,
  evaluateShortAnswer,
  evaluateAudio,
  evaluateVideo,
  calculateDomainScores,
  determineProficiencyLevel,
  categorizeDomainsBy90Rule,
  getRecommendedMicroPDs,
};
