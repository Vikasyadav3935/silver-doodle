import { Router, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { PersonalityService } from '@/services/personalityService';
import { authenticate, requireVerified } from '@/middlewares/auth';
import { AuthRequest } from '@/types';
import { AppError } from '@/utils/AppError';
import { generalLimiter } from '@/middlewares/rateLimiter';
import { InputSanitizer } from '@/middlewares/inputSanitization';

const router = Router();
const personalityService = new PersonalityService();

// Apply rate limiting and input sanitization
router.use(generalLimiter);
router.use(InputSanitizer.userInputSanitizer());

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

// Get all personality questions
router.get('/questions', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await personalityService.getPersonalityQuestions();
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// Submit personality questionnaire answers
router.post('/submit',
  authenticate,
  requireVerified,
  [
    body('answers')
      .isArray({ min: 1, max: 50 })
      .withMessage('Answers must be an array with 1-50 items'),
    body('answers.*.questionId')
      .isUUID()
      .withMessage('Each answer must have a valid question ID'),
    body('answers.*.selectedOption')
      .isString()
      .isLength({ min: 1, max: 500 })
      .withMessage('Selected option must be a non-empty string less than 500 characters'),
    body('answers.*.optionIndex')
      .isInt({ min: 0, max: 10 })
      .withMessage('Option index must be a number between 0 and 10')
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not found', 404);
      }

      const { answers } = req.body;
      const result = await personalityService.submitPersonalityAnswers(req.user.id, answers);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Get user's personality scores
router.get('/scores', 
  authenticate, 
  requireVerified, 
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not found', 404);
      }

      const result = await personalityService.getUserPersonalityScores(req.user.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Get compatibility score with another user
router.get('/compatibility/:userId',
  authenticate,
  requireVerified,
  [
    param('userId')
      .isUUID()
      .withMessage('Valid user ID required')
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not found', 404);
      }

      const { userId } = req.params;
      const result = await personalityService.calculateCompatibility(req.user.id, userId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Reset personality questionnaire (for retaking)
router.delete('/retake',
  authenticate,
  requireVerified,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not found', 404);
      }

      const result = await personalityService.resetPersonalityData(req.user.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Get personality insights and recommendations
router.get('/insights',
  authenticate,
  requireVerified,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not found', 404);
      }

      const result = await personalityService.getPersonalityInsights(req.user.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Get bulk compatibility scores for discovery
router.post('/bulk-compatibility',
  authenticate,
  requireVerified,
  [
    body('userIds')
      .isArray({ min: 1, max: 100 })
      .withMessage('User IDs must be an array with 1-100 items'),
    body('userIds.*')
      .isUUID()
      .withMessage('Each user ID must be a valid UUID')
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not found', 404);
      }

      const { userIds } = req.body;
      const result = await personalityService.calculateBulkCompatibility(req.user.id, userIds);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

export default router;