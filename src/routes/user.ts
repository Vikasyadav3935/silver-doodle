import { Router, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { UserService } from '@/services/userService';
import { authenticate, requireVerified } from '@/middlewares/auth';
import { AuthRequest } from '@/types';
import { AppError } from '@/utils/AppError';
import { Gender } from '@prisma/client';

const router = Router();
const userService = new UserService();

// Validation middleware
const validateRequest = (req: AuthRequest, res: Response, next: NextFunction) => {
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

// Get current user profile
router.get('/profile', authenticate, requireVerified, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) {
      throw new AppError('User not found', 404);
    }

    const result = await userService.getUserProfile(req.user.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// Create user profile
router.post('/profile',
  authenticate,
  requireVerified,
  [
    body('firstName')
      .isLength({ min: 1, max: 50 })
      .withMessage('First name is required and must be less than 50 characters'),
    body('lastName')
      .optional()
      .isLength({ max: 50 })
      .withMessage('Last name must be less than 50 characters'),
    body('dateOfBirth')
      .optional()
      .isISO8601()
      .withMessage('Valid date of birth required if provided'),
    body('gender')
      .optional()
      .isIn(['MALE', 'FEMALE', 'NON_BINARY', 'OTHER'])
      .withMessage('Valid gender required if provided'),
    body('bio')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Bio must be less than 500 characters'),
    body('occupation')
      .optional()
      .isLength({ max: 100 })
      .withMessage('Occupation must be less than 100 characters'),
    body('company')
      .optional()
      .isLength({ max: 100 })
      .withMessage('Company must be less than 100 characters'),
    body('education')
      .optional()
      .isLength({ max: 100 })
      .withMessage('Education must be less than 100 characters'),
    body('height')
      .optional()
      .isInt({ min: 100, max: 300 })
      .withMessage('Height must be between 100 and 300 cm'),
    body('interests')
      .optional()
      .isArray({ max: 20 })
      .withMessage('Maximum 20 interests allowed'),
    body('latitude')
      .optional()
      .isFloat({ min: -90, max: 90 })
      .withMessage('Valid latitude required'),
    body('longitude')
      .optional()
      .isFloat({ min: -180, max: 180 })
      .withMessage('Valid longitude required')
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not found', 404);
      }

      const profileData = {
        ...req.body,
        ...(req.body.dateOfBirth && { dateOfBirth: new Date(req.body.dateOfBirth) }),
        ...(req.body.gender && { gender: req.body.gender as Gender })
      };

      const result = await userService.createProfile(req.user.id, profileData);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Update user profile
router.put('/profile',
  authenticate,
  requireVerified,
  [
    body('firstName')
      .optional()
      .isLength({ min: 1, max: 50 })
      .withMessage('First name must be less than 50 characters'),
    body('lastName')
      .optional()
      .isLength({ max: 50 })
      .withMessage('Last name must be less than 50 characters'),
    body('bio')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Bio must be less than 500 characters'),
    body('occupation')
      .optional()
      .isLength({ max: 100 })
      .withMessage('Occupation must be less than 100 characters'),
    body('company')
      .optional()
      .isLength({ max: 100 })
      .withMessage('Company must be less than 100 characters'),
    body('education')
      .optional()
      .isLength({ max: 100 })
      .withMessage('Education must be less than 100 characters'),
    body('height')
      .optional()
      .isInt({ min: 100, max: 300 })
      .withMessage('Height must be between 100 and 300 cm'),
    body('interests')
      .optional()
      .isArray({ max: 20 })
      .withMessage('Maximum 20 interests allowed'),
    body('latitude')
      .optional()
      .isFloat({ min: -90, max: 90 })
      .withMessage('Valid latitude required'),
    body('longitude')
      .optional()
      .isFloat({ min: -180, max: 180 })
      .withMessage('Valid longitude required')
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not found', 404);
      }

      const result = await userService.updateProfile(req.user.id, req.body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Get user settings
router.get('/settings', authenticate, requireVerified, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) {
      throw new AppError('User not found', 404);
    }

    const result = await userService.getUserProfile(req.user.id);
    res.status(200).json({
      success: true,
      settings: result.user.settings
    });
  } catch (error) {
    next(error);
  }
});

// Update user settings
router.put('/settings',
  authenticate,
  requireVerified,
  [
    body('emailNotifications').optional().isBoolean(),
    body('pushNotifications').optional().isBoolean(),
    body('newMatchNotifications').optional().isBoolean(),
    body('messageNotifications').optional().isBoolean(),
    body('likeNotifications').optional().isBoolean(),
    body('superLikeNotifications').optional().isBoolean(),
    body('showAge').optional().isBoolean(),
    body('showDistance').optional().isBoolean(),
    body('showOnlineStatus').optional().isBoolean(),
    body('hideFromContacts').optional().isBoolean(),
    body('discoveryEnabled').optional().isBoolean()
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not found', 404);
      }

      const result = await userService.updateSettings(req.user.id, req.body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Get user stats
router.get('/stats', authenticate, requireVerified, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) {
      throw new AppError('User not found', 404);
    }

    const result = await userService.getUserStats(req.user.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// Delete user account
router.delete('/account', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) {
      throw new AppError('User not found', 404);
    }

    const result = await userService.deleteUser(req.user.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

export default router;