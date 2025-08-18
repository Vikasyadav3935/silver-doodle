import { Router, Request, Response, NextFunction } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { NotificationService } from '@/services/notificationService';
import { authenticate, requireVerified } from '@/middlewares/auth';
import { AuthRequest } from '@/types';
import { AppError } from '@/utils/AppError';

const router = Router();
const notificationService = new NotificationService();

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

// Get user notifications
router.get('/',
  authenticate,
  requireVerified,
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be a non-negative integer'),
    query('unreadOnly')
      .optional()
      .isBoolean()
      .withMessage('unreadOnly must be a boolean')
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not found', 404);
      }

      const { limit = 20, offset = 0, unreadOnly = false } = req.query;
      
      const result = await notificationService.getUserNotifications(
        req.user.id,
        Number(limit),
        Number(offset),
        Boolean(unreadOnly)
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Mark notifications as read
router.put('/read',
  authenticate,
  requireVerified,
  [
    body('notificationIds')
      .optional()
      .isArray()
      .withMessage('Notification IDs must be an array'),
    body('notificationIds.*')
      .optional()
      .isUUID()
      .withMessage('Each notification ID must be a valid UUID')
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not found', 404);
      }

      const { notificationIds } = req.body;
      
      const result = await notificationService.markNotificationsAsRead(
        req.user.id,
        notificationIds
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Delete a notification
router.delete('/:notificationId',
  authenticate,
  requireVerified,
  [
    param('notificationId')
      .isUUID()
      .withMessage('Valid notification ID is required')
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not found', 404);
      }

      const { notificationId } = req.params;
      
      const result = await notificationService.deleteNotification(
        req.user.id,
        notificationId
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Add push token
router.post('/push-token',
  authenticate,
  requireVerified,
  [
    body('token')
      .isLength({ min: 1, max: 500 })
      .withMessage('Valid push token is required'),
    body('platform')
      .isIn(['ios', 'android', 'web'])
      .withMessage('Platform must be ios, android, or web')
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not found', 404);
      }

      const { token, platform } = req.body;
      
      const result = await notificationService.addPushToken(
        req.user.id,
        token,
        platform
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Remove push token
router.delete('/push-token',
  authenticate,
  requireVerified,
  [
    body('token')
      .isLength({ min: 1, max: 500 })
      .withMessage('Valid push token is required')
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { token } = req.body;
      
      const result = await notificationService.removePushToken(token);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Get notification statistics
router.get('/stats',
  authenticate,
  requireVerified,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not found', 404);
      }

      const result = await notificationService.getNotificationStats(req.user.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Test notification (development only)
router.post('/test',
  authenticate,
  requireVerified,
  [
    body('title')
      .isLength({ min: 1, max: 100 })
      .withMessage('Title is required and must be less than 100 characters'),
    body('message')
      .isLength({ min: 1, max: 500 })
      .withMessage('Message is required and must be less than 500 characters'),
    body('type')
      .optional()
      .isIn(['NEW_MATCH', 'NEW_MESSAGE', 'NEW_LIKE', 'SUPER_LIKE', 'PROFILE_VIEW', 'SYSTEM'])
      .withMessage('Invalid notification type')
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // Only allow in development environment
      if (process.env.NODE_ENV === 'production') {
        throw new AppError('Test notifications not available in production', 403);
      }

      if (!req.user?.id) {
        throw new AppError('User not found', 404);
      }

      const { title, message, type = 'SYSTEM', data } = req.body;
      
      const result = await notificationService.sendNotification(req.user.id, {
        type,
        title,
        message,
        data
      });

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

export default router;