import { storageService } from './storage.service';
import {
  validateFile,
  validateContentType,
  validateMetadata,
} from '../utils/fileValidation';
import {
  FileType,
  UploadMetadata,
  UploadResponse,
  PresignedUrlResponse,
  DownloadUrlResponse,
} from '../types/upload.types';
import {
  s3UploadExpirySeconds,
  s3DownloadExpirySeconds,
} from '../config/s3.config';

/**
 * Upload Service
 * High-level upload operations with business logic
 */
class UploadService {
  /**
   * Upload file via Multer (server-side upload)
   */
  async uploadViaMulter(
    file: Express.Multer.File,
    fileType: FileType,
    userId: string,
    metadata?: UploadMetadata
  ): Promise<UploadResponse> {
    // Validate file
    const validation = validateFile(file, fileType);
    if (!validation.valid) {
      throw new Error(`File validation failed: ${validation.errors?.join(', ')}`);
    }

    // Validate metadata if required
    const metadataValidation = validateMetadata(metadata, fileType);
    if (!metadataValidation.valid) {
      throw new Error(
        `Metadata validation failed: ${metadataValidation.errors?.join(', ')}`
      );
    }

    // Generate S3 key
    const key = storageService.generateFileKey(
      fileType,
      userId,
      file.originalname,
      metadata
    );

    // Upload to S3
    const url = await storageService.uploadFile(
      file.buffer,
      key,
      file.mimetype
    );

    return { url, key };
  }

  /**
   * Request pre-signed URL for client-side upload
   */
  async requestPresignedUrl(
    fileType: FileType,
    fileName: string,
    contentType: string,
    userId: string,
    metadata?: UploadMetadata
  ): Promise<PresignedUrlResponse> {
    // Validate content type
    const validation = validateContentType(contentType, fileType);
    if (!validation.valid) {
      throw new Error(
        `Content type validation failed: ${validation.errors?.join(', ')}`
      );
    }

    // Validate metadata if required
    const metadataValidation = validateMetadata(metadata, fileType);
    if (!metadataValidation.valid) {
      throw new Error(
        `Metadata validation failed: ${metadataValidation.errors?.join(', ')}`
      );
    }

    // Generate S3 key
    const key = storageService.generateFileKey(
      fileType,
      userId,
      fileName,
      metadata
    );

    // Generate pre-signed upload URL
    const uploadUrl = await storageService.generatePresignedUploadUrl(
      key,
      contentType,
      s3UploadExpirySeconds
    );

    return {
      uploadUrl,
      key,
      expiresIn: s3UploadExpirySeconds,
    };
  }

  /**
   * Request download URL for a file
   */
  async requestDownloadUrl(
    key: string,
    userId: string
  ): Promise<DownloadUrlResponse> {
    // Verify user owns the file by checking key prefix
    if (!this.verifyOwnership(key, userId)) {
      throw new Error('Unauthorized: You do not have access to this file');
    }

    // Generate pre-signed download URL
    const downloadUrl = await storageService.generatePresignedDownloadUrl(
      key,
      s3DownloadExpirySeconds
    );

    return {
      downloadUrl,
      expiresIn: s3DownloadExpirySeconds,
    };
  }

  /**
   * Delete a file
   */
  async deleteFile(key: string, userId: string): Promise<void> {
    // Verify user owns the file
    if (!this.verifyOwnership(key, userId)) {
      throw new Error('Unauthorized: You do not have access to this file');
    }

    // Delete from S3
    await storageService.deleteFile(key);
  }

  /**
   * Verify user owns the file based on key prefix
   */
  private verifyOwnership(key: string, userId: string): boolean {
    // Check if the key contains the user's ID
    // Keys follow patterns like: profiles/{userId}/..., certificates/{userId}/..., etc.
    const pathParts = key.split('/');

    // For most file types, userId is the second part of the path
    // e.g., profiles/user123/photo.jpg or certificates/user123/cert.pdf
    if (pathParts.length >= 2) {
      return pathParts[1] === userId;
    }

    return false;
  }

  /**
   * Verify user owns assessment attempt
   * This should be enhanced to check against actual assessment attempt records
   */
  async verifyAssessmentAttemptOwnership(
    attemptId: string,
    userId: string
  ): Promise<boolean> {
    // TODO: Implement actual verification against competency attempt records
    // For now, we rely on key-based verification in verifyOwnership
    return true;
  }
}

export const uploadService = new UploadService();
