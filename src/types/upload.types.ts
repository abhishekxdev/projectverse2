/**
 * Upload Types and Configurations
 */

/**
 * Supported file types for uploads
 */
export enum FileType {
  PROFILE_PHOTO = 'profile-photo',
  CERTIFICATE = 'certificate',
  LOGO = 'logo',
  ASSESSMENT_AUDIO = 'assessment-audio',
  ASSESSMENT_VIDEO = 'assessment-video',
}

/**
 * Upload metadata (optional contextual data)
 */
export interface UploadMetadata {
  attemptId?: string; // For assessment uploads
  questionId?: string; // For assessment uploads
  schoolId?: string; // For school-related uploads
}

/**
 * File type configuration
 */
export interface FileTypeConfig {
  allowedMimeTypes: string[];
  maxSizeBytes: number;
  pathPrefix: string;
  requiresMetadata?: string[]; // Required metadata fields
}

/**
 * Configuration mapping for each file type
 */
export const FILE_TYPE_CONFIGS: Record<FileType, FileTypeConfig> = {
  [FileType.PROFILE_PHOTO]: {
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    maxSizeBytes: 5 * 1024 * 1024, // 5MB
    pathPrefix: 'profiles',
  },
  [FileType.CERTIFICATE]: {
    allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
    pathPrefix: 'certificates',
  },
  [FileType.LOGO]: {
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/svg+xml',
    ],
    maxSizeBytes: 5 * 1024 * 1024, // 5MB
    pathPrefix: 'logos',
  },
  [FileType.ASSESSMENT_AUDIO]: {
    allowedMimeTypes: ['audio/mpeg', 'audio/wav', 'audio/webm', 'audio/mp4'],
    maxSizeBytes: 50 * 1024 * 1024, // 50MB
    pathPrefix: 'assessments',
    requiresMetadata: ['attemptId', 'questionId'],
  },
  [FileType.ASSESSMENT_VIDEO]: {
    allowedMimeTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
    maxSizeBytes: 100 * 1024 * 1024, // 100MB
    pathPrefix: 'assessments',
    requiresMetadata: ['attemptId', 'questionId'],
  },
};

/**
 * Request to generate pre-signed URL
 */
export interface PresignedUrlRequest {
  fileType: FileType;
  fileName: string;
  contentType: string;
  metadata?: UploadMetadata;
}

/**
 * Response containing pre-signed URL
 */
export interface PresignedUrlResponse {
  uploadUrl: string;
  key: string;
  expiresIn: number;
}

/**
 * Response for direct upload
 */
export interface UploadResponse {
  url: string;
  key: string;
}

/**
 * Response for download URL generation
 */
export interface DownloadUrlResponse {
  downloadUrl: string;
  expiresIn: number;
}

/**
 * File validation result
 */
export interface FileValidationResult {
  valid: boolean;
  errors?: string[];
}
