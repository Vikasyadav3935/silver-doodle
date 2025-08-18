import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { AuthService } from '@/services/authService';
import { authenticate } from '@/middlewares/auth';
import { AuthRequest } from '@/types';
import { AppError } from '@/utils/AppError';
import { OtpPurpose } from '@prisma/client';

const router = Router();
const authService = new AuthService();

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

// Send OTP
router.post('/send-otp',
  [
    body('phoneNumber')
      .isMobilePhone('any')
      .withMessage('Please provide a valid phone number'),
    body('purpose')
      .optional()
      .isIn(['PHONE_VERIFICATION', 'PASSWORD_RESET', 'EMAIL_VERIFICATION'])
      .withMessage('Invalid OTP purpose')
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { phoneNumber, purpose = 'PHONE_VERIFICATION' } = req.body;
      
      const result = await authService.sendOTP(
        phoneNumber, 
        purpose as OtpPurpose
      );
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Verify OTP
router.post('/verify-otp',
  [
    body('phoneNumber')
      .isMobilePhone('any')
      .withMessage('Please provide a valid phone number'),
    body('code')
      .isLength({ min: 4, max: 4 })
      .withMessage('OTP must be 4 digits'),
    body('purpose')
      .optional()
      .isIn(['PHONE_VERIFICATION', 'PASSWORD_RESET', 'EMAIL_VERIFICATION'])
      .withMessage('Invalid OTP purpose')
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { phoneNumber, code, purpose = 'PHONE_VERIFICATION' } = req.body;
      
      const result = await authService.verifyOTP(
        phoneNumber, 
        code, 
        purpose as OtpPurpose
      );
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Resend OTP
router.post('/resend-otp',
  [
    body('phoneNumber')
      .isMobilePhone('any')
      .withMessage('Please provide a valid phone number'),
    body('purpose')
      .optional()
      .isIn(['PHONE_VERIFICATION', 'PASSWORD_RESET', 'EMAIL_VERIFICATION'])
      .withMessage('Invalid OTP purpose')
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { phoneNumber, purpose = 'PHONE_VERIFICATION' } = req.body;
      
      const result = await authService.resendOTP(
        phoneNumber, 
        purpose as OtpPurpose
      );
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Refresh token
router.post('/refresh-token', authenticate, async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.id) {
      throw new AppError('User not found', 404);
    }

    const result = await authService.refreshToken(req.user.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// Logout
router.post('/logout', authenticate, async (req: AuthRequest, res, next) => {
  try {
    if (!req.user?.id) {
      throw new AppError('User not found', 404);
    }

    const result = await authService.logout(req.user.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// Get current user
router.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) {
      throw new AppError('User not found', 404);
    }

    // Fetch complete user data with profile and questions
    const user = await authService.getCurrentUser(req.user.id);
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
});

export default router;