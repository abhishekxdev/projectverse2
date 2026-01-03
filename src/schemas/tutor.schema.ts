/**
 * AI Tutor Validation Schemas
 */

import { z } from 'zod';

/**
 * Schema for sending a message (request body)
 */
export const sendMessageBodySchema = z.object({
  message: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message cannot exceed 2000 characters'),
});

/**
 * Schema for generating learning path (request body)
 */
export const generateLearningPathSchema = z.object({
  resultId: z.string().optional(),
});

/**
 * Schema for session ID parameter
 */
export const sessionIdParamSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
});

export type SendMessageInput = z.infer<typeof sendMessageBodySchema>;
export type GenerateLearningPathInput = z.infer<
  typeof generateLearningPathSchema
>;
