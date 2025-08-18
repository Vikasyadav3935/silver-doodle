import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { SubscriptionService } from '@/services/subscriptionService';
import { authenticate, requireVerified } from '@/middlewares/auth';
import { AuthRequest } from '@/types';
import { AppError } from '@/utils/AppError';
import { BoostType } from '@prisma/client';

const router = Router();
const subscriptionService = new SubscriptionService();

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

// Get subscription plans
router.get('/plans', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await subscriptionService.getSubscriptionPlans();
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// Get user's current subscription
router.get('/subscription',
  authenticate,
  requireVerified,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not found', 404);
      }

      const result = await subscriptionService.getUserSubscription(req.user.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Create subscription (checkout)
router.post('/subscription',
  authenticate,
  requireVerified,
  [
    body('planId')
      .isIn(['premium', 'gold'])
      .withMessage('Plan ID must be premium or gold')
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not found', 404);
      }

      const { planId } = req.body;
      const result = await subscriptionService.createSubscription(req.user.id, planId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Cancel subscription
router.delete('/subscription',
  authenticate,
  requireVerified,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not found', 404);
      }

      const result = await subscriptionService.cancelSubscription(req.user.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Purchase boost
router.post('/boost',
  authenticate,
  requireVerified,
  [
    body('type')
      .isIn(['PROFILE_BOOST', 'LOCATION_BOOST'])
      .withMessage('Boost type must be PROFILE_BOOST or LOCATION_BOOST'),
    body('duration')
      .optional()
      .isInt({ min: 15, max: 180 })
      .withMessage('Duration must be between 15 and 180 minutes')
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not found', 404);
      }

      const { type, duration = 30 } = req.body;
      const result = await subscriptionService.purchaseBoost(
        req.user.id,
        type as BoostType,
        Number(duration)
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Get active boosts
router.get('/boosts',
  authenticate,
  requireVerified,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not found', 404);
      }

      const result = await subscriptionService.getActiveBoosts(req.user.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Check feature access
router.get('/features/:feature',
  authenticate,
  requireVerified,
  [
    param('feature')
      .isIn([
        'unlimited_likes',
        'who_liked_you',
        'super_likes',
        'rewinds',
        'boosts',
        'premium_filters',
        'read_receipts',
        'online_status',
        'top_picks'
      ])
      .withMessage('Invalid feature name')
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not found', 404);
      }

      const { feature } = req.params;
      const hasAccess = await subscriptionService.checkFeatureAccess(req.user.id, feature);
      
      res.status(200).json({
        success: true,
        hasAccess,
        feature
      });
    } catch (error) {
      next(error);
    }
  }
);

// Stripe webhook handler
router.post('/webhook',
  // Raw body middleware for webhook signature verification
  (req: Request, res: Response, next: NextFunction) => {
    req.body = req.body; // In production, you'd need raw body parsing
    next();
  },
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const signature = req.headers['stripe-signature'] as string;
      const body = JSON.stringify(req.body);

      await subscriptionService.processWebhook(body, signature);
      res.status(200).json({ received: true });
    } catch (error) {
      next(error);
    }
  }
);

// Get pricing information
router.get('/pricing', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pricing = {
      success: true,
      pricing: {
        subscriptions: {
          premium: {
            monthly: 9.99,
            currency: 'USD'
          },
          gold: {
            monthly: 19.99,
            currency: 'USD'
          }
        },
        oneTime: {
          profileBoost30min: 4.99,
          profileBoost60min: 7.99,
          locationBoost30min: 2.99,
          locationBoost60min: 4.99,
          superLikes5pack: 4.99,
          superLikes15pack: 12.99,
          superLikes30pack: 19.99
        }
      }
    };

    res.status(200).json(pricing);
  } catch (error) {
    next(error);
  }
});

// Purchase super likes pack
router.post('/super-likes',
  authenticate,
  requireVerified,
  [
    body('pack')
      .isIn(['5', '15', '30'])
      .withMessage('Pack must be 5, 15, or 30')
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not found', 404);
      }

      const { pack } = req.body;
      const packSize = Number(pack);
      
      let price: number;
      switch (packSize) {
        case 5:
          price = 4.99;
          break;
        case 15:
          price = 12.99;
          break;
        case 30:
          price = 19.99;
          break;
        default:
          throw new AppError('Invalid pack size', 400);
      }

      // This would integrate with Stripe for payment processing
      // For now, we'll simulate a successful purchase
      
      res.status(200).json({
        success: true,
        message: `${packSize} super likes purchased successfully`,
        pack: packSize,
        price
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get payment history
router.get('/history',
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

      // This would fetch payment history from the database
      // For now, return empty history
      res.status(200).json({
        success: true,
        payments: [],
        total: 0
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;