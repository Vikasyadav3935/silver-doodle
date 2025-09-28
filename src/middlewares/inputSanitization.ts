import { Request, Response, NextFunction } from 'express';
import DOMPurify from 'isomorphic-dompurify';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';

const SUSPICIOUS_PATTERNS = [
  // SQL Injection patterns
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
  // XSS patterns
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  // NoSQL injection patterns
  /\$where/gi,
  /\$ne/gi,
  // Path traversal
  /\.\.\//g,
  /\.\.\\/g,
  // Command injection
  /[;&|`]/g
];

interface SanitizationOptions {
  maxLength?: number;
  allowHtml?: boolean;
  stripTags?: boolean;
  checkSuspicious?: boolean;
}

class InputSanitizer {
  private static sanitizeString(
    value: string, 
    options: SanitizationOptions = {}
  ): string {
    const {
      maxLength = 10000,
      allowHtml = false,
      stripTags = true,
      checkSuspicious = true
    } = options;

    // Check for null/undefined
    if (typeof value !== 'string') {
      return '';
    }

    // Length check
    if (value.length > maxLength) {
      throw new AppError(`Input too long. Maximum ${maxLength} characters allowed.`, 400);
    }

    // Check for suspicious patterns
    if (checkSuspicious) {
      for (const pattern of SUSPICIOUS_PATTERNS) {
        if (pattern.test(value)) {
          logger.warn('Suspicious input detected', {
            pattern: pattern.source,
            input: value.substring(0, 100) + '...',
            timestamp: new Date().toISOString()
          });
          throw new AppError('Invalid input detected', 400);
        }
      }
    }

    let sanitized = value;

    // HTML sanitization
    if (!allowHtml && stripTags) {
      sanitized = DOMPurify.sanitize(sanitized, { ALLOWED_TAGS: [] });
    } else if (allowHtml) {
      sanitized = DOMPurify.sanitize(sanitized, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
        ALLOWED_ATTR: []
      });
    }

    // Trim whitespace
    sanitized = sanitized.trim();

    // Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, ' ');

    return sanitized;
  }

  private static sanitizeObject(obj: any, options: SanitizationOptions = {}): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.sanitizeString(obj, options);
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item, options));
    }

    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        // Sanitize the key as well
        const sanitizedKey = this.sanitizeString(key, { maxLength: 100, stripTags: true });
        sanitized[sanitizedKey] = this.sanitizeObject(value, options);
      }
      return sanitized;
    }

    return obj;
  }

  static middleware(options: SanitizationOptions = {}) {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        // Sanitize body
        if (req.body) {
          req.body = InputSanitizer.sanitizeObject(req.body, options);
        }

        // Sanitize query parameters
        if (req.query) {
          req.query = InputSanitizer.sanitizeObject(req.query, options);
        }

        // Sanitize URL parameters
        if (req.params) {
          req.params = InputSanitizer.sanitizeObject(req.params, options);
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  }

  // Specific sanitizers for different content types
  static userInputSanitizer() {
    return this.middleware({
      maxLength: 1000,
      allowHtml: false,
      stripTags: true,
      checkSuspicious: true
    });
  }

  static bioSanitizer() {
    return this.middleware({
      maxLength: 500,
      allowHtml: true, // Allow basic formatting in bio
      stripTags: false,
      checkSuspicious: true
    });
  }

  static messageSanitizer() {
    return this.middleware({
      maxLength: 1000,
      allowHtml: false,
      stripTags: true,
      checkSuspicious: true
    });
  }

  static searchSanitizer() {
    return this.middleware({
      maxLength: 100,
      allowHtml: false,
      stripTags: true,
      checkSuspicious: true
    });
  }

  static adminInputSanitizer() {
    return this.middleware({
      maxLength: 2000,
      allowHtml: true,
      stripTags: false,
      checkSuspicious: true
    });
  }
}

// Validation helpers
export const validateUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 320; // Max email length
};

export const validatePhoneNumber = (phone: string): boolean => {
  // Basic international phone number validation
  const phoneRegex = /^\+?[1-9]\d{6,14}$/;
  return phoneRegex.test(phone.replace(/\s+/g, ''));
};

export const validateAge = (dateOfBirth: Date): boolean => {
  const today = new Date();
  const age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = today.getMonth() - dateOfBirth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) {
    age--;
  }
  
  return age >= 18 && age <= 100; // Reasonable age range
};

export { InputSanitizer };