import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../server';
import { AppError } from '../utils/AppError';
import { AuthRequest, JwtPayload } from '../types';
import { sessionService } from '../services/sessionService';
import { AuditLogService, AuditEventType } from '../services/auditLogService';

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      await AuditLogService.logSecurityEvent(
        AuditEventType.UNAUTHORIZED_ACCESS,
        req,
        { reason: 'Missing or invalid authorization header' }
      );
      throw new AppError('Access token is required', 401);
    }

    const token = authHeader.substring(7);

    if (!process.env.JWT_SECRET) {
      throw new AppError('JWT secret is not configured', 500);
    }

    // Check if token is blacklisted
    const isBlacklisted = await sessionService.isTokenBlacklisted(token);
    if (isBlacklisted) {
      await AuditLogService.logSecurityEvent(
        AuditEventType.UNAUTHORIZED_ACCESS,
        req,
        { reason: 'Blacklisted token used' }
      );
      throw new AppError('Token has been revoked', 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;

    const user = await prisma.user.findFirst({
      where: { 
        id: decoded.userId,
        phoneNumber: { not: { startsWith: 'deleted_' } } // Exclude soft-deleted users
      },
      select: {
        id: true,
        phoneNumber: true,
        isVerified: true,
      }
    });
    
    if (!user) {
      await AuditLogService.logSecurityEvent(
        AuditEventType.UNAUTHORIZED_ACCESS,
        req,
        { reason: 'User not found or deleted', userId: decoded.userId }
      );
      throw new AppError('User not found', 404);
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new AppError('Token has expired', 401));
    } else if (error instanceof jwt.JsonWebTokenError) {
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