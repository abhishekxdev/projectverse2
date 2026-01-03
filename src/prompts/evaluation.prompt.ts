/**
 * AI Evaluation Prompts for Competency Assessment
 * Contains prompts for evaluating SHORT_ANSWER, AUDIO, and VIDEO responses
 * Includes rubric scoring dimensions from TCDT_multisheet_with_rubric.md
 */

/**
 * Rubric scoring dimensions for SHORT_ANSWER responses (0-3 scale each)
 */
export const SHORT_ANSWER_RUBRIC = {
  DEPTH_OF_REFLECTION: {
    0: 'No response or irrelevant answer',
    1: 'Superficial response, minimal relevance',
    2: 'General insights with some application',
    3: 'Clear, detailed reflection with relevance',
  },
  GROWTH_ORIENTATION: {
    0: 'Shows no self-improvement or insight',
    1: 'Acknowledges problem but no clear learning',
    2: 'Demonstrates learning from experience',
    3: 'Demonstrates clear growth or change',
  },
  CLARITY_OF_THOUGHT: {
    0: 'Rambling or incoherent',
    1: 'Somewhat understandable but vague',
    2: 'Mostly clear, some minor issues',
    3: 'Well-organized and articulate',
  },
} as const;

/**
 * Rubric scoring dimensions for AUDIO/VIDEO roleplay responses (0-3 scale each)
 */
export const AUDIO_VIDEO_RUBRIC = {
  EMPATHY_AND_TONE: {
    0: 'Insensitive or dismissive tone',
    1: 'Limited empathy or forced tone',
    2: 'Generally warm and student-focused',
    3: 'Empathetic, calm, and appropriate',
  },
  INSTRUCTIONAL_LANGUAGE: {
    0: 'No instructional terms or strategy mentioned',
    1: 'Vague strategy mentioned with unclear terms',
    2: 'Some relevant instructional language',
    3: 'Effective use of educational vocabulary',
  },
  LOGICAL_STRUCTURE: {
    0: 'Completely illogical or unrelated',
    1: 'Weak logic or partial mismatch',
    2: 'Mostly logical flow with purpose',
    3: 'Well-structured response with sound logic',
  },
} as const;

/**
 * System prompt for the AI evaluator
 */
export const EVALUATOR_SYSTEM_PROMPT = `You are an expert educational assessment evaluator specializing in teacher competency evaluation.
Your role is to objectively score and provide constructive feedback on teacher responses.

Guidelines:
1. Score responses on a scale from 0 to the maximum score provided
2. Be fair, consistent, and objective in your evaluations
3. Use the rubric dimensions provided to guide your scoring
4. Consider the depth of understanding, practical application, and clarity of explanation
5. Provide specific, actionable feedback
6. Recognize both strengths and areas for improvement

Rubric-Based Scoring:
- For SHORT_ANSWER: Evaluate Depth of Reflection, Growth Orientation, and Clarity of Thought (0-3 each)
- For AUDIO/VIDEO: Evaluate Empathy & Tone, Instructional Language, and Logical Structure (0-3 each)
- Convert rubric scores to the final score proportionally

Response Format:
Always respond with valid JSON in the following format:
{
  "score": <number>,
  "feedback": "<string with constructive feedback>",
  "rubricScores": {
    "dimension1": <0-3>,
    "dimension2": <0-3>,
    "dimension3": <0-3>
  }
}`;

/**
 * Prompt for evaluating SHORT_ANSWER responses
 */
export const getShortAnswerEvaluationPrompt = (
  prompt: string,
  answer: string,
  maxScore: number,
  domainKey: string
): string => {
  return `Evaluate the following SHORT_ANSWER response for a teacher competency assessment.

Domain: ${domainKey}
Maximum Score: ${maxScore}

Question:
${prompt}

Teacher's Response:
${answer}

RUBRIC-BASED EVALUATION (Score each dimension 0-3):

1. DEPTH OF REFLECTION:
   - 0: No response or irrelevant answer
   - 1: Superficial response, minimal relevance
   - 2: General insights with some application
   - 3: Clear, detailed reflection with relevance

2. GROWTH ORIENTATION:
   - 0: Shows no self-improvement or insight
   - 1: Acknowledges problem but no clear learning
   - 2: Demonstrates learning from experience
   - 3: Demonstrates clear growth or change

3. CLARITY OF THOUGHT:
   - 0: Rambling or incoherent
   - 1: Somewhat understandable but vague
   - 2: Mostly clear, some minor issues
   - 3: Well-organized and articulate

Calculate final score: (sum of rubric scores / 9) * ${maxScore}

Provide your evaluation as JSON:
{
  "score": <calculated score 0-${maxScore}>,
  "feedback": "<constructive feedback addressing each dimension>",
  "rubricScores": {
    "depthOfReflection": <0-3>,
    "growthOrientation": <0-3>,
    "clarityOfThought": <0-3>
  }
}`;
};

/**
 * Prompt for evaluating AUDIO responses (requires transcription)
 */
export const getAudioEvaluationPrompt = (
  prompt: string,
  transcription: string,
  maxScore: number,
  domainKey: string
): string => {
  return `Evaluate the following AUDIO roleplay response (transcribed) for a teacher competency assessment.

Domain: ${domainKey}
Maximum Score: ${maxScore}

Scenario/Prompt:
${prompt}

Teacher's Response (Transcribed):
${transcription}

RUBRIC-BASED EVALUATION (Score each dimension 0-3):

1. EMPATHY & TONE:
   - 0: Insensitive or dismissive tone
   - 1: Limited empathy or forced tone
   - 2: Generally warm and student-focused
   - 3: Empathetic, calm, and appropriate

2. INSTRUCTIONAL LANGUAGE:
   - 0: No instructional terms or strategy mentioned
   - 1: Vague strategy mentioned with unclear terms
   - 2: Some relevant instructional language
   - 3: Effective use of educational vocabulary

3. LOGICAL STRUCTURE:
   - 0: Completely illogical or unrelated
   - 1: Weak logic or partial mismatch
   - 2: Mostly logical flow with purpose
   - 3: Well-structured response with sound logic

Note: This response was provided as an audio recording. Evaluate based on the content of the transcription.

Calculate final score: (sum of rubric scores / 9) * ${maxScore}

Provide your evaluation as JSON:
{
  "score": <calculated score 0-${maxScore}>,
  "feedback": "<constructive feedback addressing each dimension>",
  "rubricScores": {
    "empathyAndTone": <0-3>,
    "instructionalLanguage": <0-3>,
    "logicalStructure": <0-3>
  }
}`;
};

/**
 * Prompt for evaluating VIDEO responses
 */
export const getVideoEvaluationPrompt = (
  prompt: string,
  description: string,
  maxScore: number,
  domainKey: string
): string => {
  return `Evaluate the following VIDEO roleplay response (transcribed audio) for a teacher competency assessment.

Domain: ${domainKey}
Maximum Score: ${maxScore}

Scenario/Prompt:
${prompt}

Video Content (Transcribed Audio):
${description}

RUBRIC-BASED EVALUATION (Score each dimension 0-3):

1. EMPATHY & TONE:
   - 0: Insensitive or dismissive tone
   - 1: Limited empathy or forced tone
   - 2: Generally warm and student-focused
   - 3: Empathetic, calm, and appropriate

2. INSTRUCTIONAL LANGUAGE:
   - 0: No instructional terms or strategy mentioned
   - 1: Vague strategy mentioned with unclear terms
   - 2: Some relevant instructional language
   - 3: Effective use of educational vocabulary

3. LOGICAL STRUCTURE:
   - 0: Completely illogical or unrelated
   - 1: Weak logic or partial mismatch
   - 2: Mostly logical flow with purpose
   - 3: Well-structured response with sound logic

Note: This is the transcribed audio from a video submission. Evaluate based on the verbal content.

Calculate final score: (sum of rubric scores / 9) * ${maxScore}

Provide your evaluation as JSON:
{
  "score": <calculated score 0-${maxScore}>,
  "feedback": "<constructive feedback addressing each dimension>",
  "rubricScores": {
    "empathyAndTone": <0-3>,
    "instructionalLanguage": <0-3>,
    "logicalStructure": <0-3>
  }
}`;
};

/**
 * Prompt for generating overall feedback summary
 */
export const getOverallFeedbackPrompt = (
  domainScores: Array<{ domainKey: string; scorePercent: number }>,
  strengthDomains: string[],
  gapDomains: string[]
): string => {
  return `Generate a concise overall feedback summary for a teacher's competency assessment results.

Domain Scores:
${domainScores
  .map((d) => `- ${d.domainKey}: ${d.scorePercent.toFixed(1)}%`)
  .join('\n')}

Strength Domains (≥90%): ${
    strengthDomains.length > 0 ? strengthDomains.join(', ') : 'None'
  }
Gap Domains (<90%): ${gapDomains.length > 0 ? gapDomains.join(', ') : 'None'}

Provide a brief (2-3 sentences), encouraging yet constructive summary that:
1. Acknowledges areas of strength
2. Identifies key areas for professional development
3. Maintains a positive, growth-oriented tone

Respond with JSON: { "feedback": "<summary string>" }`;
};

/**
 * Interface for AI evaluation response
 */
export interface AIEvaluationResponse {
  score: number;
  feedback: string;
}

/**
 * Interface for overall feedback response
 */
export interface AIOverallFeedbackResponse {
  feedback: string;
}
