import {
  FileType,
  FILE_TYPE_CONFIGS,
  FileValidationResult,
} from '../types/upload.types';

/**
 * File Validation Utilities
 */

/**
 * Validate file MIME type against allowed types
 */
export function validateFileType(
  mimetype: string,
  allowedTypes: string[]
): boolean {
  return allowedTypes.includes(mimetype);
}

/**
 * Validate file size against maximum allowed size
 */
export function validateFileSize(
  sizeBytes: number,
  maxSizeBytes: number
): boolean {
  return sizeBytes <= maxSizeBytes;
}

/**
 * Convert bytes to human-readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Validate file against file type configuration
 */
export function validateFile(
  file: Express.Multer.File | { mimetype: string; size: number },
  fileType: FileType
): FileValidationResult {
  const config = FILE_TYPE_CONFIGS[fileType];
  const errors: string[] = [];

  // Validate MIME type
  if (!validateFileType(file.mimetype, config.allowedMimeTypes)) {
    errors.push(
      `Invalid file type. Allowed types: ${config.allowedMimeTypes.join(', ')}`
    );
  }

  // Validate file size
  if (!validateFileSize(file.size, config.maxSizeBytes)) {
    errors.push(
      `File size exceeds limit. Maximum size: ${formatBytes(
        config.maxSizeBytes
      )}, uploaded: ${formatBytes(file.size)}`
    );
  }

  // Check for empty files
  if (file.size === 0) {
    errors.push('File is empty');
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Validate content type for pre-signed URL requests
 */
export function validateContentType(
  contentType: string,
  fileType: FileType
): FileValidationResult {
  const config = FILE_TYPE_CONFIGS[fileType];
  const errors: string[] = [];

  if (!validateFileType(contentType, config.allowedMimeTypes)) {
    errors.push(
      `Invalid content type. Allowed types: ${config.allowedMimeTypes.join(
        ', '
      )}`
    );
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Validate required metadata for file type
 */
export function validateMetadata(
  metadata: any,
  fileType: FileType
): FileValidationResult {
  const config = FILE_TYPE_CONFIGS[fileType];
  const errors: string[] = [];

  if (config.requiresMetadata) {
    for (const field of config.requiresMetadata) {
      if (!metadata || !metadata[field]) {
        errors.push(`Missing required metadata field: ${field}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}
