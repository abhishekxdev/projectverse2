import multer from 'multer';
import { Request } from 'express';
import { FileType, FILE_TYPE_CONFIGS } from '../types/upload.types';

/**
 * Multer Upload Middleware
 * Handles multipart file uploads with validation
 */

/**
 * Multer configuration with memory storage
 */
const storage = multer.memoryStorage();

/**
 * File filter function for Multer
 */
const createFileFilter = (fileType: FileType) => {
  return (
    req: Request,
    file: Express.Multer.File,
    callback: multer.FileFilterCallback
  ) => {
    const config = FILE_TYPE_CONFIGS[fileType];

    // Check MIME type
    if (config.allowedMimeTypes.includes(file.mimetype)) {
      callback(null, true);
    } else {
      callback(
        new Error(
          `Invalid file type. Allowed types: ${config.allowedMimeTypes.join(', ')}`
        )
      );
    }
  };
};

/**
 * Create Multer upload middleware for specific file type
 */
const createUploadMiddleware = (fileType: FileType) => {
  const config = FILE_TYPE_CONFIGS[fileType];

  return multer({
    storage,
    limits: {
      fileSize: config.maxSizeBytes,
    },
    fileFilter: createFileFilter(fileType),
  });
};

/**
 * Upload middleware instances for each file type
 */
export const uploadProfilePhoto = createUploadMiddleware(
  FileType.PROFILE_PHOTO
).single('file');

export const uploadCertificate = createUploadMiddleware(
  FileType.CERTIFICATE
).single('file');

export const uploadLogo = createUploadMiddleware(FileType.LOGO).single('file');

export const uploadMultipleCertificates = createUploadMiddleware(
  FileType.CERTIFICATE
).array('files', 5);

/**
 * Error handler for Multer errors
 */
export const handleMulterError = (
  error: any,
  req: Request,
  res: any,
  next: any
) => {
  if (error instanceof multer.MulterError) {
    // Multer-specific errors
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'File too large',
        message: error.message,
      });
    }

    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Too many files',
        message: error.message,
      });
    }

    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        error: 'Unexpected field',
        message: 'Unexpected file field in request',
      });
    }

    return res.status(400).json({
      error: 'Upload error',
      message: error.message,
    });
  }

  // Pass other errors to next middleware
  next(error);
};

/**
 * Middleware to check if file was uploaded
 */
export const requireFile = (req: Request, res: any, next: any) => {
  if (!req.file) {
    return res.status(400).json({
      error: 'No file provided',
      message: 'Please upload a file',
    });
  }
  next();
};

/**
 * Middleware to check if files were uploaded (for multiple files)
 */
export const requireFiles = (req: Request, res: any, next: any) => {
  if (!req.files || (Array.isArray(req.files) && req.files.length === 0)) {
    return res.status(400).json({
      error: 'No files provided',
      message: 'Please upload at least one file',
    });
  }
  next();
};
