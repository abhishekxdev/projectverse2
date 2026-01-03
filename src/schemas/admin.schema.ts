import { z } from 'zod';

/**
 * Schema for school registration
 */
export const schoolRegistrationSchema = z
  .object({
    name: z.string().min(2, 'School name must be at least 2 characters').max(100, 'School name must not exceed 100 characters'),
    adminEmail: z.string().email('Invalid email format'),
    seats: z.object({
      total: z
        .number()
        .int('Seat count must be an integer')
        .positive('Seat count must be positive')
        .max(10000, 'Seat count cannot exceed 10000'),
    }),
  })
  .strict();

/**
 * Schema for school updates (all fields optional)
 */
export const schoolUpdateSchema = z
  .object({
    name: z
      .string()
      .min(2, 'School name must be at least 2 characters')
      .max(100, 'School name must not exceed 100 characters')
      .optional(),
    seats: z
      .object({
        total: z
          .number()
          .int('Seat count must be an integer')
          .positive('Seat count must be positive')
          .max(10000, 'Seat count cannot exceed 10000'),
      })
      .optional(),
    status: z.enum(['active', 'suspended', 'deleted']).optional(),
  })
  .strict();

/**
 * Schema for single teacher invite
 */
export const teacherInviteSchema = z
  .object({
    email: z.string().email('Invalid email format'),
    schoolId: z.string().min(1, 'School ID is required'),
  })
  .strict();

/**
 * Schema for bulk teacher invites
 */
export const bulkInviteSchema = z
  .object({
    emails: z
      .array(z.string().email('Invalid email format'))
      .min(1, 'At least one email is required')
      .max(1000, 'Cannot invite more than 1000 teachers at once'),
    schoolId: z.string().min(1, 'School ID is required'),
  })
  .strict();

/**
 * Schema for creating assignments
 */
export const assignmentSchema = z
  .object({
    schoolId: z.string().min(1, 'School ID is required'),
    assessmentId: z.string().min(1, 'Assessment ID is required'),
    teacherIds: z
      .array(z.string())
      .min(1, 'At least one teacher must be assigned'),
    deadline: z.string().datetime('Invalid ISO 8601 datetime format').optional(),
  })
  .strict();

/**
 * Inferred TypeScript types from schemas
 */
export type SchoolRegistrationInput = z.infer<typeof schoolRegistrationSchema>;
export type SchoolUpdateInput = z.infer<typeof schoolUpdateSchema>;
export type TeacherInviteInput = z.infer<typeof teacherInviteSchema>;
export type BulkInviteInput = z.infer<typeof bulkInviteSchema>;
export type AssignmentInput = z.infer<typeof assignmentSchema>;
