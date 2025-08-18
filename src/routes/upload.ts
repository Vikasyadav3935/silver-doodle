import { Router, Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { UploadService, upload } from '@/services/uploadService';
import { authenticate, requireVerified } from '@/middlewares/auth';
import { AuthRequest } from '@/types';
import { AppError } from '@/utils/AppError';

const router = Router();
const uploadService = new UploadService();

// Validation middleware
const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// Upload profile photo
router.post('/profile-photo',
  authenticate,
  requireVerified,
  upload.single('photo'),
  [
    body('isPrimary')
      .optional()
      .isBoolean()
      .withMessage('isPrimary must be a boolean')
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not found', 404);
      }

      if (!req.file) {
        throw new AppError('Photo file is required', 400);
      }

      const isPrimary = req.body.isPrimary === 'true' || req.body.isPrimary === true;
      
      const result = await uploadService.uploadProfilePhoto(
        req.user.id,
        req.file,
        isPrimary
      );

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Delete profile photo
router.delete('/profile-photo/:photoId',
  authenticate,
  requireVerified,
  [
    param('photoId')
      .isUUID()
      .withMessage('Valid photo ID is required')
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not found', 404);
      }

      const { photoId } = req.params;
      const result = await uploadService.deleteProfilePhoto(req.user.id, photoId);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Reorder profile photos
router.put('/profile-photos/reorder',
  authenticate,
  requireVerified,
  [
    body('photoIds')
      .isArray({ min: 1 })
      .withMessage('Photo IDs array is required'),
    body('photoIds.*')
      .isUUID()
      .withMessage('Each photo ID must be a valid UUID')
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not found', 404);
      }

      const { photoIds } = req.body;
      const result = await uploadService.reorderPhotos(req.user.id, photoIds);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Set primary profile photo
router.put('/profile-photo/:photoId/primary',
  authenticate,
  requireVerified,
  [
    param('photoId')
      .isUUID()
      .withMessage('Valid photo ID is required')
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not found', 404);
      }

      const { photoId } = req.params;
      const result = await uploadService.setPrimaryPhoto(req.user.id, photoId);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Upload chat media (images/videos for messages)
router.post('/chat-media',
  authenticate,
  requireVerified,
  upload.single('media'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not found', 404);
      }

      if (!req.file) {
        throw new AppError('Media file is required', 400);
      }

      const result = await uploadService.uploadChatMedia(req.user.id, req.file);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Get upload statistics
router.get('/stats',
  authenticate,
  requireVerified,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not found', 404);
      }

      const result = await uploadService.getUploadStats(req.user.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Upload multiple profile photos at once
router.post('/profile-photos/batch',
  authenticate,
  requireVerified,
  upload.array('photos', 6), // Max 6 photos
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not found', 404);
      }

      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        throw new AppError('At least one photo file is required', 400);
      }

      const files = req.files as Express.Multer.File[];
      const uploadPromises = files.map((file, index) =>
        uploadService.uploadProfilePhoto(req.user!.id, file, index === 0)
      );

      const results = await Promise.all(uploadPromises);
      const photos = results.map(result => result.photo);

      res.status(201).json({
        success: true,
        photos,
        message: `${photos.length} photos uploaded successfully`
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get presigned URLs for direct upload (alternative approach)
router.post('/presigned-url',
  authenticate,
  requireVerified,
  [
    body('fileType')
      .isIn(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'])
      .withMessage('Invalid file type'),
    body('fileName')
      .isLength({ min: 1, max: 255 })
      .withMessage('Valid file name is required'),
    body('uploadType')
      .isIn(['profile_photo', 'chat_media'])
      .withMessage('Invalid upload type')
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not found', 404);
      }

      // This would generate presigned URLs for direct client uploads
      // Implementation would depend on your cloud storage provider
      
      res.status(501).json({
        success: false,
        message: 'Presigned URL generation not implemented yet'
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;