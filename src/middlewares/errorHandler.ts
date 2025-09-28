import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { Prisma } from '@prisma/client';
import { AuthRequest } from '../types';
import { AuditLogService, AuditEventType } from '../services/auditLogService';

export const errorHandler = async (
  error: Error,
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  let err = { ...error };
  err.message = error.message;

  // Log error with request context
  const errorContext = {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    body: req.method !== 'GET' ? req.body : undefined,
    query: req.query,
    params: req.params
  };

  logger.error('Request error occurred', errorContext);

  // Determine error severity and log security events
  const isSecurity = isSecurityError(error);
  const isServer = isServerError(error);
  const statusCode = getErrorStatusCode(error);

  // Log security events for audit
  if (isSecurity && req.user?.id) {
    await AuditLogService.logSecurityEvent(
      AuditEventType.SUSPICIOUS_ACTIVITY,
      req,
      { error: error.message, errorType: error.name },
      req.user.id
    );
  }

  // Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    let message = 'Database error';
    let code = 500;

    switch (error.code) {
      case 'P2002':
        message = 'This information is already in use';
        code = 409; // Conflict
        break;
      case 'P2014':
        message = 'Invalid identifier provided';
        code = 400;
        break;
      case 'P2003':
        message = 'Invalid data provided';
        code = 400;
        break;
      case 'P2025':
        message = 'The requested resource was not found';
        code = 404;
        break;
      case 'P1001':
      case 'P1008':
      case 'P1017':
        message = 'Database connection error';
        code = 503; // Service Unavailable
        break;
      default:
        logger.error('Unhandled Prisma error:', { code: error.code, message: error.message });
        message = 'A database error occurred';
        code = 500;
    }

    err = new AppError(message, code);
  }

  // Prisma validation errors
  if (error instanceof Prisma.PrismaClientValidationError) {
    const message = 'Invalid data format provided';
    err = new AppError(message, 400);
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    err = new AppError('Authentication failed', 401);
  }

  if (error.name === 'TokenExpiredError') {
    err = new AppError('Session has expired', 401);
  }

  // Validation errors
  if (error.name === 'ValidationError') {
    err = new AppError('Input validation failed', 400);
  }

  // Rate limiting errors
  if (error.message?.includes('Too many requests')) {
    err = new AppError('Too many requests, please try again later', 429);
  }

  // Cast/format errors
  if (error.name === 'CastError') {
    err = new AppError('Invalid resource identifier', 400);
  }

  // Prepare response
  const errorResponse: any = {
    success: false,
    error: (err as AppError).message || 'An error occurred',
    timestamp: new Date().toISOString(),
    path: req.path
  };

  // Add additional info based on environment and error type
  if (process.env.NODE_ENV === 'development') {
    errorResponse.details = {
      originalError: error.message,
      stack: error.stack?.split('\n').slice(0, 10), // Limit stack trace
      statusCode
    };
  }

  // Don't expose internal errors in production
  if (isServer && process.env.NODE_ENV === 'production') {
    errorResponse.error = 'Internal server error occurred';
  }

  // Add rate limit headers for 429 errors
  if (statusCode === 429) {
    res.set('Retry-After', '60'); // Suggest retry after 60 seconds
  }

  res.status(statusCode).json(errorResponse);
};

// Helper functions
function isSecurityError(error: Error): boolean {
  const securityErrors = [
    'JsonWebTokenError',
    'TokenExpiredError',
    'UnauthorizedError',
    'ForbiddenError'
  ];
  
  return securityErrors.includes(error.name) || 
         error.message?.toLowerCase().includes('unauthorized') ||
         error.message?.toLowerCase().includes('forbidden') ||
         error.message?.toLowerCase().includes('access denied');
}

function isServerError(error: Error): boolean {
  return error.name === 'Error' && !error.message?.includes('validation');
}

function getErrorStatusCode(error: Error): number {
  if (error instanceof AppError) {
    return error.statusCode;
  }

  // Default status codes based on error types
  const statusMap: Record<string, number> = {
    'JsonWebTokenError': 401,
    'TokenExpiredError': 401,
    'ValidationError': 400,
    'CastError': 400,
    'MongoError': 500,
    'PrismaClientKnownRequestError': 500,
    'PrismaClientValidationError': 400
  };

  return statusMap[error.name] || 500;
}