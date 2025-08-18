import { Router, Request, Response, NextFunction } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { MatchService } from '@/services/matchService';
import { authenticate, requireVerified } from '@/middlewares/auth';
import { AuthRequest } from '@/types';
import { AppError } from '@/utils/AppError';

const router = Router();
const matchService = new MatchService();

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

// Get discovery profiles
router.get('/discovery',
  authenticate,
  requireVerified,
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50'),
    query('minAge')
      .optional()
      .isInt({ min: 18, max: 100 })
      .withMessage('Min age must be between 18 and 100'),
    query('maxAge')
      .optional()
      .isInt({ min: 18, max: 100 })
      .withMessage('Max age must be between 18 and 100'),
    query('maxDistance')
      .optional()
      .isInt({ min: 1, max: 500 })
      .withMessage('Max distance must be between 1 and 500 km')
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not found', 404);
      }

      const { limit = 10, minAge, maxAge, maxDistance } = req.query;

      const filters: any = {};
      if (minAge) filters.minAge = Number(minAge);
      if (maxAge) filters.maxAge = Number(maxAge);
      if (maxDistance) filters.maxDistance = Number(maxDistance);

      const result = await matchService.getDiscoveryProfiles(
        req.user.id, 
        Number(limit),
        filters
      );
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Like a profile
router.post('/like',
  authenticate,
  requireVerified,
  [
    body('userId')
      .isUUID()
      .withMessage('Valid user ID is required')
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not found', 404);
      }

      const { userId } = req.body;
      const result = await matchService.likeProfile(req.user.id, userId);
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Pass a profile
router.post('/pass',
  authenticate,
  requireVerified,
  [
    body('userId')
      .isUUID()
      .withMessage('Valid user ID is required')
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not found', 404);
      }

      const { userId } = req.body;
      const result = await matchService.passProfile(req.user.id, userId);
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Super like a profile
router.post('/super-like',
  authenticate,
  requireVerified,
  [
    body('userId')
      .isUUID()
      .withMessage('Valid user ID is required')
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not found', 404);
      }

      const { userId } = req.body;
      const result = await matchService.superLike(req.user.id, userId);
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Get who liked you
router.get('/who-liked-me',
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
      .withMessage('Offset must be a non-negative integer')
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not found', 404);
      }

      const { limit = 20, offset = 0 } = req.query;
      const result = await matchService.getWhoLikedYou(
        req.user.id, 
        Number(limit),
        Number(offset)
      );
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Get matches
router.get('/matches',
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
      .withMessage('Offset must be a non-negative integer')
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not found', 404);
      }

      const { limit = 20, offset = 0 } = req.query;
      const result = await matchService.getMatches(
        req.user.id, 
        Number(limit),
        Number(offset)
      );
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Undo last action (premium feature)
router.post('/undo',
  authenticate,
  requireVerified,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // This would be a premium feature
      // Implementation would involve tracking user actions and reversing the last one
      
      res.status(501).json({
        success: false,
        message: 'Undo feature not implemented yet'
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;