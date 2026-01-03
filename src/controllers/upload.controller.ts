import { Request, Response } from 'express';
import { uploadService } from '../services/upload.service';
import { FileType } from '../types/upload.types';
import {
  presignedUrlRequestSchema,
  downloadUrlRequestSchema,
  deleteFileRequestSchema,
} from '../schemas/upload.schema';

/**
 * Upload Controller
 * Handles file upload requests
 */

/**
 * Upload file via Multer (multipart upload)
 */
export const uploadFile = async (req: Request, res: Response) => {
  try {
    // File is already validated and parsed by Multer middleware
    if (!req.file) {
      return res.status(400).json({
        error: 'No file provided',
        message: 'Please upload a file',
      });
    }

    // Get file type from route parameter or request body
    const fileType = req.params.fileType as FileType;

    // Get user ID from authenticated user
    const userId = (req as any).user?.id || (req as any).user?.uid;
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    // Get metadata from request body (if any)
    const metadata = req.body.metadata ? JSON.parse(req.body.metadata) : undefined;

    // Upload file
    const result = await uploadService.uploadViaMulter(
      req.file,
      fileType,
      userId,
      metadata
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: 'Upload failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Generate pre-signed URL for client-side upload
 */
export const generatePresignedUrl = async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validation = presignedUrlRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors.map((e) => e.message),
      });
    }

    const { fileType, fileName, contentType, metadata } = validation.data;

    // Get user ID from authenticated user
    const userId = (req as any).user?.id || (req as any).user?.uid;
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    // Generate pre-signed URL
    const result = await uploadService.requestPresignedUrl(
      fileType,
      fileName,
      contentType,
      userId,
      metadata
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Pre-signed URL generation error:', error);
    res.status(500).json({
      error: 'Failed to generate upload URL',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Generate download URL for a file
 */
export const getDownloadUrl = async (req: Request, res: Response) => {
  try {
    // Validate query parameters
    const validation = downloadUrlRequestSchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors.map((e) => e.message),
      });
    }

    const { key } = validation.data;

    // Get user ID from authenticated user
    const userId = (req as any).user?.id || (req as any).user?.uid;
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    // Generate download URL
    const result = await uploadService.requestDownloadUrl(key, userId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Download URL generation error:', error);

    // Check for unauthorized error
    if (
      error instanceof Error &&
      error.message.includes('Unauthorized')
    ) {
      return res.status(403).json({
        error: 'Forbidden',
        message: error.message,
      });
    }

    res.status(500).json({
      error: 'Failed to generate download URL',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Delete a file
 */
export const deleteFile = async (req: Request, res: Response) => {
  try {
    // Validate query parameters
    const validation = deleteFileRequestSchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors.map((e) => e.message),
      });
    }

    const { key } = validation.data;

    // Get user ID from authenticated user
    const userId = (req as any).user?.id || (req as any).user?.uid;
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    // Delete file
    await uploadService.deleteFile(key, userId);

    res.status(204).send();
  } catch (error) {
    console.error('File deletion error:', error);

    // Check for unauthorized error
    if (
      error instanceof Error &&
      error.message.includes('Unauthorized')
    ) {
      return res.status(403).json({
        error: 'Forbidden',
        message: error.message,
      });
    }

    res.status(500).json({
      error: 'Failed to delete file',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
