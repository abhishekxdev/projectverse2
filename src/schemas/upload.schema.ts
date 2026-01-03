import { z } from 'zod';
import { FileType } from '../types/upload.types';

/**
 * Upload Validation Schemas
 */

/**
 * File type enum validation
 */
const fileTypeEnum = z.enum([
  FileType.PROFILE_PHOTO,
  FileType.CERTIFICATE,
  FileType.LOGO,
  FileType.ASSESSMENT_AUDIO,
  FileType.ASSESSMENT_VIDEO,
]);

/**
 * Upload metadata schema
 */
const uploadMetadataSchema = z
  .object({
    attemptId: z.string().optional(),
    questionId: z.string().optional(),
    schoolId: z.string().optional(),
  })
  .optional();

/**
 * Pre-signed URL request schema
 */
export const presignedUrlRequestSchema = z
  .object({
    fileType: fileTypeEnum,
    fileName: z.string().min(1, 'File name is required'),
    contentType: z.string().min(1, 'Content type is required'),
    metadata: uploadMetadataSchema,
  })
  .strict();

/**
 * Download URL request schema
 */
export const downloadUrlRequestSchema = z
  .object({
    key: z.string().min(1, 'S3 key is required'),
  })
  .strict();

/**
 * Delete file request schema
 */
export const deleteFileRequestSchema = z
  .object({
    key: z.string().min(1, 'S3 key is required'),
  })
  .strict();

/**
 * Type exports
 */
export type PresignedUrlRequestInput = z.infer<
  typeof presignedUrlRequestSchema
>;
export type DownloadUrlRequestInput = z.infer<typeof downloadUrlRequestSchema>;
export type DeleteFileRequestInput = z.infer<typeof deleteFileRequestSchema>;
