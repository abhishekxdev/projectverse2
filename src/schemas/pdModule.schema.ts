/**
 * PD Module Validation Schemas
 */

import { z } from 'zod';

/**
 * Schema for module ID parameter
 */
export const moduleIdParamSchema = z.object({
  moduleId: z.string().min(1, 'Module ID is required'),
});

/**
 * Schema for attempt ID parameter
 */
export const attemptIdParamSchema = z.object({
  attemptId: z.string().min(1, 'Attempt ID is required'),
});

/**
 * Schema for saving responses
 */
export const saveResponsesSchema = z.object({
  responses: z
    .array(
      z.object({
        questionId: z.string().min(1),
        answer: z.string(),
      })
    )
    .min(1, 'At least one response is required'),
});

/**
 * Schema for submitting an attempt
 */
export const submitAttemptSchema = z.object({
  responses: z
    .array(
      z.object({
        questionId: z.string().min(1),
        answer: z.string(),
      })
    )
    .min(1, 'At least one response is required'),
});

/**
 * Schema for triggering evaluation
 */
export const triggerEvaluationSchema = z.object({
  attemptId: z.string().optional(),
  batchSize: z.number().min(1).max(50).optional(),
});

export type SaveResponsesInput = z.infer<typeof saveResponsesSchema>;
export type SubmitAttemptInput = z.infer<typeof submitAttemptSchema>;
