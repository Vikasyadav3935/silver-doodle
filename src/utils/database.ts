import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

export class DatabaseService {
  private static instance: DatabaseService;
  private retryCount = 0;
  private maxRetries = 3;
  private retryDelay = 1000; // 1 second

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await operation();
        if (attempt > 1) {
          logger.info(`Database operation succeeded on attempt ${attempt}`);
        }
        return result;
      } catch (error: any) {
        lastError = error;
        
        // Check if it's a connection error
        if (this.isConnectionError(error)) {
          logger.warn(`Database connection attempt ${attempt} failed: ${error.message}`);
          
          if (attempt < this.maxRetries) {
            const delay = this.retryDelay * attempt;
            logger.info(`Retrying in ${delay}ms...`);
            await this.sleep(delay);
            continue;
          }
        } else {
          // For non-connection errors, don't retry
          throw error;
        }
      }
    }

    logger.error(`Database operation failed after ${this.maxRetries} attempts`);
    throw lastError!;
  }

  private isConnectionError(error: any): boolean {
    const connectionErrorCodes = ['P1001', 'P1008', 'P1017'];
    const connectionErrorMessages = [
      'Can\'t reach database server',
      'Operations timed out',
      'Server has closed the connection',
      'Connection is not open',
      'Connection terminated unexpectedly'
    ];

    if (error.code && connectionErrorCodes.includes(error.code)) {
      return true;
    }

    if (error.message) {
      const message = error.message.toLowerCase();
      return connectionErrorMessages.some(msg => 
        message.includes(msg.toLowerCase())
      );
    }

    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async healthCheck(prisma: PrismaClient): Promise<boolean> {
    try {
      await this.withRetry(async () => {
        await prisma.$queryRaw`SELECT 1`;
      });
      return true;
    } catch (error) {
      logger.error('Database health check failed:', error);
      return false;
    }
  }

  async keepAlive(prisma: PrismaClient): Promise<void> {
    try {
      await this.withRetry(async () => {
        await prisma.$queryRaw`SELECT 1`;
      });
    } catch (error) {
      logger.error('Database keep-alive failed:', error);
    }
  }
}

export const dbService = DatabaseService.getInstance();