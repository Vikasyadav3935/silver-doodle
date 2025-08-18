import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../server';
import { AppError } from '../utils/AppError';
import { SmsService } from './smsService';
import { logger } from '../utils/logger';
import { dbService } from '../utils/database';
import { OtpPurpose } from '@prisma/client';

export class AuthService {
  private smsService: SmsService;

  constructor() {
    this.smsService = new SmsService();
  }

  async sendOTP(phoneNumber: string, purpose: OtpPurpose = OtpPurpose.PHONE_VERIFICATION) {
    try {
      // Send OTP via MeraOTP (they generate and manage the OTP)
      await this.smsService.sendOTPSMS(phoneNumber);
      logger.info(`OTP SMS sent successfully to ${phoneNumber} via MeraOTP`);
      
      return {
        success: true,
        message: 'OTP sent successfully'
      };
    } catch (error) {
      logger.error('Error sending OTP:', error);
      throw new AppError('Failed to send OTP', 500);
    }
  }

  async verifyOTP(phoneNumber: string, code: string, purpose: OtpPurpose = OtpPurpose.PHONE_VERIFICATION) {
    try {
      logger.info(`Verifying OTP for ${phoneNumber}, code: ${code}, purpose: ${purpose}`);

      // Validate OTP with MeraOTP first
      const isValidOTP = await this.smsService.validateOTP(phoneNumber, code);

      if (!isValidOTP) {
        logger.error(`OTP validation failed for phone: ${phoneNumber}, code: ${code}`);
        throw new AppError('Invalid or expired OTP', 400);
      }

      logger.info(`OTP validation successful for ${phoneNumber}`);

      // Find or create user after successful OTP validation
      let user = await dbService.withRetry(async () => {
        return await prisma.user.findUnique({
          where: { phoneNumber }
        });
      });

      if (!user) {
        user = await dbService.withRetry(async () => {
          return await prisma.user.create({
            data: { 
              phoneNumber,
              isVerified: true 
            }
          });
        });
        logger.info(`New user created: ${user.id}`);
      } else {
        // Update existing user verification status
        user = await prisma.user.update({
          where: { id: user.id },
          data: { isVerified: true }
        });
        logger.info(`User verification updated: ${user.id}`);
      }

      // Generate JWT token
      const token = this.generateToken(user.id);

      logger.info(`Phone verified and token generated for user: ${user.id}`);

      return {
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            phoneNumber: user.phoneNumber,
            isVerified: user.isVerified
          }
        }
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error verifying OTP:', error);
      throw new AppError('Failed to verify OTP', 500);
    }
  }

  async resendOTP(phoneNumber: string, purpose: OtpPurpose = OtpPurpose.PHONE_VERIFICATION) {
    try {
      // Simple rate limiting could be implemented here with Redis if needed
      // For now, just resend the OTP
      return await this.sendOTP(phoneNumber, purpose);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error resending OTP:', error);
      throw new AppError('Failed to resend OTP', 500);
    }
  }

  async getCurrentUser(userId: string) {
    try {
      const user = await dbService.withRetry(async () => {
        return await prisma.user.findUnique({
          where: { id: userId },
          include: {
            profile: {
              include: {
                interests: true,
                photos: true,
                answers: {
                  include: {
                    question: true
                  }
                }
              }
            },
            settings: true
          }
        });
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      return user;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error fetching current user:', error);
      throw new AppError('Failed to fetch user data', 500);
    }
  }

  private generateToken(userId: string): string {
    if (!process.env.JWT_SECRET) {
      throw new AppError('JWT secret is not configured', 500);
    }

    const options: SignOptions = {
      expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any
    };
    
    return jwt.sign(
      { userId },
      process.env.JWT_SECRET as string,
      options
    );
  }

  async refreshToken(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          phoneNumber: true,
          isVerified: true
        }
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      const token = this.generateToken(user.id);

      return {
        success: true,
        data: {
          token,
          user
        }
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error refreshing token:', error);
      throw new AppError('Failed to refresh token', 500);
    }
  }

  async logout(userId: string) {
    try {
      // Here you could implement token blacklisting if needed
      // For now, we'll just log the logout event
      
      await prisma.userActivity.create({
        data: {
          userId,
          type: 'LOGOUT'
        }
      });

      logger.info(`User logged out: ${userId}`);

      return {
        success: true,
        message: 'Logged out successfully'
      };
    } catch (error) {
      logger.error('Error during logout:', error);
      throw new AppError('Failed to logout', 500);
    }
  }
}