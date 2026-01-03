import { z } from 'zod';

/**
 * Schema for validating notification list query parameters
 * GET /api/notifications
 */
export const notificationQuerySchema = z
  .object({
    query: z
      .object({
        limit: z
          .string()
          .optional()
          .transform((val) => (val ? parseInt(val, 10) : 20))
          .refine((val) => val >= 1 && val <= 100, {
            message: 'Limit must be between 1 and 100',
          }),
        startAfter: z.string().optional(),
      })
      .strict()
      .optional()
      .default({}),
  })
  .strict();

/**
 * Schema for validating mark-as-read request
 * PUT /api/notifications/:id/read
 */
export const markAsReadSchema = z
  .object({
    params: z
      .object({
        id: z.string().min(1, 'Notification ID is required'),
      })
      .strict(),
  })
  .strict();

/**
 * Schema for validating delete notification request
 * DELETE /api/notifications/:id
 */
export const deleteNotificationSchema = z
  .object({
    params: z
      .object({
        id: z.string().min(1, 'Notification ID is required'),
      })
      .strict(),
  })
  .strict();

// Inferred types for use in controllers
export type NotificationQueryInput = z.infer<typeof notificationQuerySchema>;
export type MarkAsReadInput = z.infer<typeof markAsReadSchema>;
export type DeleteNotificationInput = z.infer<typeof deleteNotificationSchema>;
