import { S3Client } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * S3 Configuration
 * Validates and exports S3 client configuration
 *
 * Supports two authentication modes:
 * 1. IAM Role (EC2/ECS) - Just set AWS_REGION and AWS_S3_BUCKET_NAME
 * 2. Explicit credentials - Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
 *
 * S3 is optional - server will start without it but upload features will be disabled
 */

// Minimum required environment variables
const minRequiredVars = ['AWS_REGION', 'AWS_S3_BUCKET_NAME'];
const missingMinVars = minRequiredVars.filter((varName) => !process.env[varName]);

// Check for explicit credentials (for local development)
const hasExplicitCredentials =
  process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY;

// Flag to check if S3 is configured (minimum: region + bucket)
export const isS3Configured = missingMinVars.length === 0;

if (!isS3Configured) {
  console.warn(
    `[S3 Config] WARNING: Missing S3 environment variables: ${missingMinVars.join(', ')}. ` +
      'File upload features will be disabled. Set these variables to enable S3 uploads.'
  );
}

// S3 Configuration
// If explicit credentials are provided, use them (for local development)
// Otherwise, AWS SDK will use IAM role credentials (for EC2/ECS)
export const s3Config = isS3Configured
  ? hasExplicitCredentials
    ? {
        region: process.env.AWS_REGION!,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      }
    : {
        region: process.env.AWS_REGION!,
        // No credentials = AWS SDK uses IAM role or default credential chain
      }
  : null;

// Initialize S3 Client (only if configured)
export const s3Client = isS3Configured ? new S3Client(s3Config!) : null;

// S3 Bucket Name
export const s3BucketName = process.env.AWS_S3_BUCKET_NAME || '';

// Pre-signed URL expiry times (in seconds)
export const s3UploadExpirySeconds = parseInt(
  process.env.S3_UPLOAD_EXPIRY_SECONDS || '900',
  10
);
export const s3DownloadExpirySeconds = parseInt(
  process.env.S3_DOWNLOAD_EXPIRY_SECONDS || '3600',
  10
);

if (isS3Configured) {
  console.log(`S3 Configuration loaded successfully`);
  console.log(`- Region: ${s3Config!.region}`);
  console.log(`- Bucket: ${s3BucketName}`);
  console.log(`- Auth Mode: ${hasExplicitCredentials ? 'Explicit Credentials' : 'IAM Role/Default Chain'}`);
  console.log(`- Upload URL Expiry: ${s3UploadExpirySeconds}s`);
  console.log(`- Download URL Expiry: ${s3DownloadExpirySeconds}s`);
}
