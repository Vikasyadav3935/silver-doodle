import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { Prisma } from '@prisma/client';

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let err = { ...error };
  err.message = error.message;

  // Log error
  logger.error(error);

  // Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    let message = 'Database error';
    let statusCode = 500;

    switch (error.code) {
      case 'P2002':
        message = 'Duplicate field value entered';
        statusCode = 400;
        break;
      case 'P2014':
        message = 'Invalid ID provided';
        statusCode = 400;
        break;
      case 'P2003':
        message = 'Invalid input data';
        statusCode = 400;
        break;
      case 'P2025':
        message = 'Record not found';
        statusCode = 404;
        break;
    }

    err = new AppError(message, statusCode);
  }

  // Prisma validation errors
  if (error instanceof Prisma.PrismaClientValidationError) {
    const message = 'Invalid data provided';
    err = new AppError(message, 400);
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    err = new AppError(message, 401);
  }

  if (error.name === 'TokenExpiredError') {
    const message = 'Token expired';
    err = new AppError(message, 401);
  }

  // Validation errors
  if (error.name === 'ValidationError') {
    const message = 'Validation failed';
    err = new AppError(message, 400);
  }

  // Cast error for wrong ObjectId
  if (error.name === 'CastError') {
    const message = 'Resource not found';
    err = new AppError(message, 404);
  }

  res.status((err as any).statusCode || 500).json({
    success: false,
    error: err.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
};