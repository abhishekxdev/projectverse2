import { z } from 'zod';

// Schema for CompetencyAssessment
export const competencyAssessmentSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  active: z.boolean(),
});

// Schema for CompetencyQuestion
export const competencyQuestionSchema = z
  .object({
    id: z.string().min(1),
    assessmentId: z.string().min(1),
    domainKey: z.string().min(1, 'DOMAIN_KEY_REQUIRED'), // Enforce non-empty
    type: z.enum(['MCQ', 'SHORT_ANSWER', 'AUDIO', 'VIDEO']),
    prompt: z.string().min(1),
    options: z.array(z.string()).optional(), // Only for MCQ
    correctOption: z.string().optional(), // Only for MCQ
    maxScore: z.number().positive(), // > 0
    order: z.number().int().positive(),
  })
  .refine((data) => {
    if (data.type === 'MCQ') {
      return (
        data.options &&
        data.options.length > 0 &&
        data.correctOption &&
        data.options.includes(data.correctOption)
      );
    }
    return !data.options && !data.correctOption; // No options/correctOption for non-MCQ
  }, 'INVALID_CORRECT_OPTION');

// Schema for import payload (array of questions)
export const importCompetencyQuestionsSchema = z
  .array(competencyQuestionSchema)
  .refine((questions) => {
    const orders = questions.map((q) => q.order);
    return orders.length === new Set(orders).size; // Unique order
  }, 'DUPLICATE_ORDER');

// Schema for a single question answer
export const questionAnswerSchema = z.object({
  questionId: z.string().min(1, 'Question ID is required'),
  answer: z.string().min(1, 'Answer is required'),
});

// Schema for submitting an attempt
// assessmentId is optional - if not provided, uses the active assessment
export const submitAttemptSchema = z.object({
  assessmentId: z.string().min(1).optional(),
  answers: z
    .array(questionAnswerSchema)
    .min(1, 'At least one answer is required'),
});

// Schema for starting an attempt
// assessmentId is optional - if not provided, uses the active assessment
export const startAttemptSchema = z.object({
  assessmentId: z.string().min(1).optional(),
});

// Schema for updating an in-progress attempt
export const updateAttemptSchema = z.object({
  answers: z.array(questionAnswerSchema).optional(),
});

// Schema for triggering evaluation (admin/background worker)
export const triggerEvaluationSchema = z.object({
  attemptId: z.string().min(1, 'Attempt ID is required').optional(),
  batchSize: z.number().int().positive().max(100).optional().default(10),
});

// Inferred types for use in controllers/services
export type CompetencyAssessmentInput = z.infer<
  typeof competencyAssessmentSchema
>;
export type CompetencyQuestionInput = z.infer<typeof competencyQuestionSchema>;
export type ImportCompetencyQuestionsInput = z.infer<
  typeof importCompetencyQuestionsSchema
>;
export type QuestionAnswerInput = z.infer<typeof questionAnswerSchema>;
export type SubmitAttemptInput = z.infer<typeof submitAttemptSchema>;
export type StartAttemptInput = z.infer<typeof startAttemptSchema>;
export type UpdateAttemptInput = z.infer<typeof updateAttemptSchema>;
export type TriggerEvaluationInput = z.infer<typeof triggerEvaluationSchema>;
