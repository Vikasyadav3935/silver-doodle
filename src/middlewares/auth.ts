import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../server';
import { AppError } from '../utils/AppError';
import { AuthRequest, JwtPayload } from '../types';

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  console.log('🔐 AUTH: Authentication middleware called');
  
  try {
    const authHeader = req.headers.authorization;
    console.log('🔐 AUTH: Auth header present:', !!authHeader);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('🔐 AUTH: ERROR - No valid auth header');
      throw new AppError('Access token is required', 401);
    }

    const token = authHeader.substring(7);
    console.log('🔐 AUTH: Token extracted, length:', token.length);

    if (!process.env.JWT_SECRET) {
      console.log('🔐 AUTH: ERROR - JWT secret not configured');
      throw new AppError('JWT secret is not configured', 500);
    }

    console.log('🔐 AUTH: Verifying JWT token...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;
    console.log('🔐 AUTH: Token verified, user ID:', decoded.userId);

    console.log('🔐 AUTH: Looking up user in database...');
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        phoneNumber: true,
        isVerified: true,
      }
    });

    console.log('🔐 AUTH: Database query result:', user ? 'User found' : 'User not found');
    
    if (!user) {
      console.log('🔐 AUTH: ERROR - User not found in database');
      throw new AppError('User not found', 404);
    }

    console.log('🔐 AUTH: User authenticated successfully:', user.id);
    req.user = user;
    next();
  } catch (error) {
    console.log('🔐 AUTH: ERROR in authentication:', error);
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError('Invalid token', 401));
    } else {
      next(error);
    }
  }
};

export const requireVerified = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user?.isVerified) {
    next(new AppError('Phone number verification required', 403));
    return;
  }
  next();
};

export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.substring(7);

    if (!process.env.JWT_SECRET) {
      next();
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        phoneNumber: true,
        isVerified: true,
      }
    });

    if (user) {
      req.user = user;
    }

    next();
  } catch (error) {
    // If optional auth fails, continue without user
    next();
  }
};