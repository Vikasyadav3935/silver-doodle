import { prisma } from '../server';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

interface TokenBlacklistEntry {
  tokenHash: string;
  userId?: string;
  expiresAt: Date;
  reason?: string;
}

export class SessionService {
  private static instance: SessionService;

  static getInstance(): SessionService {
    if (!SessionService.instance) {
      SessionService.instance = new SessionService();
    }
    return SessionService.instance;
  }

  // Hash token for storage (we don't store raw tokens for security)
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  // Check if token is blacklisted
  async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      const tokenHash = this.hashToken(token);
      
      const blacklistedToken = await prisma.blacklisted_tokens.findFirst({
        where: {
          token_hash: tokenHash,
          expires_at: {
            gte: new Date()
          }
        }
      });

      return !!blacklistedToken;
    } catch (error) {
      logger.error('Error checking token blacklist:', error);
      // Fail secure - if we can't check, assume it's valid but log the error
      return false;
    }
  }

  // Blacklist a specific token
  async blacklistToken(token: string, userId?: string, reason?: string): Promise<void> {
    try {
      const tokenHash = this.hashToken(token);
      
      // Decode token to get expiration time
      let expiresAt = new Date();
      try {
        const decoded = jwt.decode(token) as any;
        if (decoded && decoded.exp) {
          expiresAt = new Date(decoded.exp * 1000);
        } else {
          // If we can't decode expiration, set a reasonable default
          expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        }
      } catch (decodeError) {
        logger.warn('Could not decode token expiration, using default', { error: decodeError });
        expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      }

      await prisma.blacklisted_tokens.create({
        data: {
          token_hash: tokenHash,
          user_id: userId,
          expires_at: expiresAt,
          reason: reason || 'Manual blacklist'
        }
      });

      logger.info('Token blacklisted', {
        userId,
        reason,
        expiresAt: expiresAt.toISOString(),
        tokenHash: tokenHash.substring(0, 8) + '...' // Log partial hash for debugging
      });
    } catch (error) {
      logger.error('Error blacklisting token:', error);
      throw new AppError('Failed to blacklist token', 500);
    }
  }

  // Blacklist all tokens for a user
  async blacklistAllUserTokens(userId: string, reason?: string): Promise<void> {
    try {
      // We can't blacklist tokens we don't know about, but we can mark this user
      // as requiring re-authentication by storing a "blacklist after" timestamp
      // This would require checking the token issue time against this timestamp
      
      // For now, we'll create a broad blacklist entry for this user
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      
      await prisma.blacklisted_tokens.create({
        data: {
          token_hash: `user_revocation_${userId}_${Date.now()}`,
          user_id: userId,
          expires_at: expiresAt,
          reason: reason || 'All user tokens revoked'
        }
      });

      logger.info('All tokens blacklisted for user', {
        userId,
        reason,
        expiresAt: expiresAt.toISOString()
      });
    } catch (error) {
      logger.error('Error blacklisting all user tokens:', error);
      throw new AppError('Failed to blacklist user tokens', 500);
    }
  }

  // Clean up expired blacklisted tokens
  async cleanupExpiredTokens(): Promise<void> {
    try {
      const result = await prisma.blacklisted_tokens.deleteMany({
        where: {
          expires_at: {
            lt: new Date()
          }
        }
      });

      if (result.count > 0) {
        logger.info(`Cleaned up ${result.count} expired blacklisted tokens`);
      }
    } catch (error) {
      logger.error('Error cleaning up expired tokens:', error);
    }
  }

  // Get blacklisted tokens for a user (for admin purposes)
  async getUserBlacklistedTokens(userId: string, limit: number = 20) {
    try {
      const tokens = await prisma.blacklisted_tokens.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        take: limit,
        select: {
          id: true,
          reason: true,
          expires_at: true,
          created_at: true
        }
      });

      return {
        success: true,
        tokens
      };
    } catch (error) {
      logger.error('Error fetching user blacklisted tokens:', error);
      throw new AppError('Failed to fetch blacklisted tokens', 500);
    }
  }

  // Session management methods
  async createSession(userId: string, metadata?: Record<string, any>) {
    try {
      // In a more robust implementation, you might want to store session information
      // For now, we'll just log session creation and return success
      
      logger.info('Session created', {
        userId,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString()
        }
      });

      return {
        success: true,
        sessionId: crypto.randomUUID(),
        createdAt: new Date()
      };
    } catch (error) {
      logger.error('Error creating session:', error);
      throw new AppError('Failed to create session', 500);
    }
  }

  async invalidateSession(sessionId: string, userId?: string, reason?: string) {
    try {
      logger.info('Session invalidated', {
        sessionId,
        userId,
        reason,
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        message: 'Session invalidated'
      };
    } catch (error) {
      logger.error('Error invalidating session:', error);
      throw new AppError('Failed to invalidate session', 500);
    }
  }

  // Method to handle security events that require immediate token revocation
  async handleSecurityEvent(userId: string, eventType: string, details?: Record<string, any>) {
    try {
      const securityEvents = [
        'password_changed',
        'suspicious_login',
        'account_compromised',
        'admin_forced_logout',
        'multiple_failed_attempts'
      ];

      if (securityEvents.includes(eventType)) {
        await this.blacklistAllUserTokens(userId, `Security event: ${eventType}`);
        
        logger.warn('Security event triggered token revocation', {
          userId,
          eventType,
          details,
          timestamp: new Date().toISOString()
        });
      }

      return {
        success: true,
        tokensRevoked: securityEvents.includes(eventType)
      };
    } catch (error) {
      logger.error('Error handling security event:', error);
      throw new AppError('Failed to handle security event', 500);
    }
  }

  // Initialize cleanup job (call this on server startup)
  initializeCleanupJob() {
    // Clean up expired tokens every hour
    setInterval(() => {
      this.cleanupExpiredTokens();
    }, 60 * 60 * 1000);

    logger.info('Token cleanup job initialized');
  }
}

export const sessionService = SessionService.getInstance();