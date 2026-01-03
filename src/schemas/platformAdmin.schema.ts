import { z } from 'zod';

export const platformAdminSeatUpdateSchema = z
  .object({
    totalSeats: z
      .number()
      .int('Total seats must be an integer')
      .positive('Total seats must be positive')
      .max(10000, 'Total seats cannot exceed 10000'),
  })
  .strict();

export type PlatformAdminSeatUpdateInput = z.infer<
  typeof platformAdminSeatUpdateSchema
>;
