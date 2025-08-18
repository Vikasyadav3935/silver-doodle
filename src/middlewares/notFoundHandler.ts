import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';

export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const message = `Route ${req.originalUrl} not found`;
  next(new AppError(message, 404));
};