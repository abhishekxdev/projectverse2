import { Router } from 'express';
import {
  uploadFile,
  generatePresignedUrl,
  getDownloadUrl,
  deleteFile,
} from '../controllers/upload.controller';
import {
  uploadProfilePhoto,
  uploadCertificate,
  uploadLogo,
  requireFile,
  handleMulterError,
} from '../middlewares/upload.middleware';
import { authMiddleware } from '../middlewares/auth';
import { FileType } from '../types/upload.types';

const router = Router();

/**
 * Upload Routes
 * All routes require authentication
 */

// Multer upload endpoints (server-side upload)
router.post(
  '/profile-photo',
  authMiddleware,
  (req, res, next) => {
    uploadProfilePhoto(req, res, (err: unknown) => {
      if (err) return handleMulterError(err as Error, req, res, next);
      next();
    });
  },
  requireFile,
  (req, res) => {
    req.params.fileType = FileType.PROFILE_PHOTO;
    return uploadFile(req, res);
  }
);

router.post(
  '/certificate',
  authMiddleware,
  (req, res, next) => {
    uploadCertificate(req, res, (err: unknown) => {
      if (err) return handleMulterError(err as Error, req, res, next);
      next();
    });
  },
  requireFile,
  (req, res) => {
    req.params.fileType = FileType.CERTIFICATE;
    return uploadFile(req, res);
  }
);

router.post(
  '/logo',
  authMiddleware,
  (req, res, next) => {
    uploadLogo(req, res, (err: unknown) => {
      if (err) return handleMulterError(err as Error, req, res, next);
      next();
    });
  },
  requireFile,
  (req, res) => {
    req.params.fileType = FileType.LOGO;
    return uploadFile(req, res);
  }
);

// Pre-signed URL generation endpoint (for client-side upload)
router.post('/presigned-url', authMiddleware, generatePresignedUrl);

// Download URL generation endpoint
router.get('/download-url', authMiddleware, getDownloadUrl);

// File deletion endpoint
router.delete('/', authMiddleware, deleteFile);

export default router;
