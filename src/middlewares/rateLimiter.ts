import { Request, Response, NextFunction } from 'express';
import { AppError } from '@/utils/AppError';
import { logger } from '@/utils/logger';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
    blocked?: boolean;
    blockUntil?: number;
  };
}

class RateLimiter {
  private store: RateLimitStore = {};
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  private cleanup() {
    const now = Date.now();
    Object.keys(this.store).forEach(key => {
      const entry = this.store[key];
      if (entry.resetTime < now && (!entry.blockUntil || entry.blockUntil < now)) {
        delete this.store[key];
      }
    });
  }

  createLimiter(options: {
    windowMs: number;
    maxRequests: number;
    keyGenerator?: (req: Request) => string;
    skipSuccessfulRequests?: boolean;
    blockDuration?: number; // Duration to block after exceeding limit
    message?: string;
  }) {
    return (req: Request, res: Response, next: NextFunction) => {
      const key = options.keyGenerator ? options.keyGenerator(req) : (req.ip || 'unknown');
      const now = Date.now();
      const windowStart = now - options.windowMs;

      if (!this.store[key]) {
        this.store[key] = {
          count: 0,
          resetTime: now + options.windowMs
        };
      }

      const entry = this.store[key];

      // Check if currently blocked
      if (entry.blocked && entry.blockUntil && now < entry.blockUntil) {
        const remainingTime = Math.ceil((entry.blockUntil - now) / 1000);
        logger.warn(`Rate limit exceeded and blocked for ${key}`, {
          key,
          remainingBlockTime: remainingTime,
          userAgent: req.get('User-Agent'),
          path: req.path
        });
        throw new AppError(
          `Too many requests. Blocked for ${remainingTime} more seconds.`,
          429
        );
      }

      // Reset window if expired
      if (now > entry.resetTime) {
        entry.count = 0;
        entry.resetTime = now + options.windowMs;
        entry.blocked = false;
        entry.blockUntil = undefined;
      }

      // Check if limit exceeded
      if (entry.count >= options.maxRequests) {
        entry.blocked = true;
        entry.blockUntil = now + (options.blockDuration || 300000); // Default 5 min block

        logger.error(`Rate limit exceeded for ${key}`, {
          key,
          count: entry.count,
          limit: options.maxRequests,
          window: options.windowMs,
          userAgent: req.get('User-Agent'),
          path: req.path
        });

        throw new AppError(
          options.message || 'Too many requests, please try again later.',
          429
        );
      }

      // Increment counter
      entry.count++;

      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': options.maxRequests.toString(),
        'X-RateLimit-Remaining': Math.max(0, options.maxRequests - entry.count).toString(),
        'X-RateLimit-Reset': new Date(entry.resetTime).toISOString()
      });

      next();
    };
  }

  // Create different rate limiters for different endpoints
  static createAuthLimiter() {
    const limiter = new RateLimiter();
    return limiter.createLimiter({
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 10,
      blockDuration: 30 * 60 * 1000, // 30 minutes block
      keyGenerator: (req) => (req.ip || 'unknown') + ':auth',
      message: 'Too many authentication attempts, please try again later.'
    });
  }

  static createGeneralLimiter() {
    const limiter = new RateLimiter();
    return limiter.createLimiter({
      windowMs: 1 * 60 * 1000, // 1 minute
      maxRequests: 100,
      blockDuration: 5 * 60 * 1000, // 5 minutes block
      keyGenerator: (req) => req.ip || 'unknown',
      message: 'Too many requests, please try again later.'
    });
  }

  static createAdminLimiter() {
    const limiter = new RateLimiter();
    return limiter.createLimiter({
      windowMs: 1 * 60 * 1000, // 1 minute
      maxRequests: 20,
      blockDuration: 10 * 60 * 1000, // 10 minutes block
      keyGenerator: (req) => (req.ip || 'unknown') + ':admin',
      message: 'Too many admin requests, please try again later.'
    });
  }

  static createUploadLimiter() {
    const limiter = new RateLimiter();
    return limiter.createLimiter({
      windowMs: 10 * 60 * 1000, // 10 minutes
      maxRequests: 50,
      blockDuration: 20 * 60 * 1000, // 20 minutes block
      keyGenerator: (req) => (req.ip || 'unknown') + ':upload',
      message: 'Too many upload requests, please try again later.'
    });
  }

  static createSearchLimiter() {
    const limiter = new RateLimiter();
    return limiter.createLimiter({
      windowMs: 1 * 60 * 1000, // 1 minute
      maxRequests: 30,
      blockDuration: 5 * 60 * 1000, // 5 minutes block
      keyGenerator: (req) => (req.ip || 'unknown') + ':search',
      message: 'Too many search requests, please try again later.'
    });
  }
}

export { RateLimiter };
export const authLimiter = RateLimiter.createAuthLimiter();
export const generalLimiter = RateLimiter.createGeneralLimiter();
export const adminLimiter = RateLimiter.createAdminLimiter();
export const uploadLimiter = RateLimiter.createUploadLimiter();
export const searchLimiter = RateLimiter.createSearchLimiter();