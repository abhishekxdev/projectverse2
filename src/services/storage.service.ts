import {
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  s3Client,
  s3BucketName,
  s3UploadExpirySeconds,
  s3DownloadExpirySeconds,
  isS3Configured,
} from '../config/s3.config';
import { FileType, FILE_TYPE_CONFIGS, UploadMetadata } from '../types/upload.types';

/**
 * Storage Service
 * Low-level S3 operations for file storage
 */
class StorageService {
  /**
   * Check if S3 is configured and throw error if not
   */
  private ensureS3Configured(): void {
    if (!isS3Configured || !s3Client) {
      throw new Error(
        'S3 is not configured. File upload features are disabled. ' +
          'Please configure AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET_NAME environment variables.'
      );
    }
  }
  /**
   * Generate S3 key based on file type and user context
   */
  generateFileKey(
    fileType: FileType,
    userId: string,
    fileName: string,
    metadata?: UploadMetadata
  ): string {
    const config = FILE_TYPE_CONFIGS[fileType];
    const timestamp = Date.now();
    const fileExtension = this.getFileExtension(fileName);

    // Generate prefix based on file type
    let prefix = config.pathPrefix;

    // Build path based on file type
    switch (fileType) {
      case FileType.PROFILE_PHOTO:
        return `${prefix}/${userId}/photo-${timestamp}${fileExtension}`;

      case FileType.CERTIFICATE:
        return `${prefix}/${userId}/cert-${timestamp}${fileExtension}`;

      case FileType.LOGO:
        // Use schoolId if provided, otherwise userId
        const schoolId = metadata?.schoolId || userId;
        return `${prefix}/${schoolId}/logo-${timestamp}${fileExtension}`;

      case FileType.ASSESSMENT_AUDIO:
      case FileType.ASSESSMENT_VIDEO:
        if (!metadata?.attemptId || !metadata?.questionId) {
          throw new Error(
            'attemptId and questionId are required for assessment uploads'
          );
        }
        const mediaType =
          fileType === FileType.ASSESSMENT_AUDIO ? 'audio' : 'video';
        return `${prefix}/${userId}/${metadata.attemptId}/${mediaType}-${metadata.questionId}${fileExtension}`;

      default:
        return `${prefix}/${userId}/${timestamp}${fileExtension}`;
    }
  }

  /**
   * Extract file extension from filename
   */
  private getFileExtension(fileName: string): string {
    const lastDot = fileName.lastIndexOf('.');
    return lastDot !== -1 ? fileName.substring(lastDot) : '';
  }

  /**
   * Upload file buffer to S3
   */
  async uploadFile(
    buffer: Buffer,
    key: string,
    contentType: string
  ): Promise<string> {
    this.ensureS3Configured();
    try {
      const command = new PutObjectCommand({
        Bucket: s3BucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      });

      await s3Client!.send(command);

      // Return the S3 URL (not accessible without signed URL since bucket is private)
      return `https://${s3BucketName}.s3.amazonaws.com/${key}`;
    } catch (error) {
      console.error('Error uploading file to S3:', error);
      throw new Error(
        `Failed to upload file to S3: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate pre-signed URL for uploading
   */
  async generatePresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = s3UploadExpirySeconds
  ): Promise<string> {
    this.ensureS3Configured();
    try {
      const command = new PutObjectCommand({
        Bucket: s3BucketName,
        Key: key,
        ContentType: contentType,
      });

      const signedUrl = await getSignedUrl(s3Client!, command, { expiresIn });
      return signedUrl;
    } catch (error) {
      console.error('Error generating pre-signed upload URL:', error);
      throw new Error(
        `Failed to generate upload URL: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate pre-signed URL for downloading
   */
  async generatePresignedDownloadUrl(
    key: string,
    expiresIn: number = s3DownloadExpirySeconds
  ): Promise<string> {
    this.ensureS3Configured();
    try {
      const command = new GetObjectCommand({
        Bucket: s3BucketName,
        Key: key,
      });

      const signedUrl = await getSignedUrl(s3Client!, command, { expiresIn });
      return signedUrl;
    } catch (error) {
      console.error('Error generating pre-signed download URL:', error);
      throw new Error(
        `Failed to generate download URL: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Download file from S3 as Buffer
   */
  async downloadFile(key: string): Promise<Buffer> {
    this.ensureS3Configured();
    try {
      const command = new GetObjectCommand({
        Bucket: s3BucketName,
        Key: key,
      });

      const response = await s3Client!.send(command);

      // Convert stream to Buffer
      if (!response.Body) {
        throw new Error('No file content received from S3');
      }

      const chunks: Uint8Array[] = [];
      const stream = response.Body as any;

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      return Buffer.concat(chunks);
    } catch (error) {
      console.error('Error downloading file from S3:', error);
      throw new Error(
        `Failed to download file from S3: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete file from S3
   */
  async deleteFile(key: string): Promise<void> {
    this.ensureS3Configured();
    try {
      const command = new DeleteObjectCommand({
        Bucket: s3BucketName,
        Key: key,
      });

      await s3Client!.send(command);
    } catch (error) {
      console.error('Error deleting file from S3:', error);
      // Don't throw error for delete operations (idempotent)
      // File might not exist, which is fine
    }
  }
}

export const storageService = new StorageService();
