import { prisma } from '../server';
import { logger } from '../utils/logger';
import { AuthRequest } from '../types';

enum AuditEventType {
  // Authentication Events
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  LOGIN_FAILED = 'LOGIN_FAILED',
  PASSWORD_RESET = 'PASSWORD_RESET',
  
  // User Management Events
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',
  USER_SUSPENDED = 'USER_SUSPENDED',
  USER_REINSTATED = 'USER_REINSTATED',
  
  // Profile Events
  PROFILE_CREATED = 'PROFILE_CREATED',
  PROFILE_UPDATED = 'PROFILE_UPDATED',
  PROFILE_VIEWED = 'PROFILE_VIEWED',
  
  // Chat Events
  MESSAGE_SENT = 'MESSAGE_SENT',
  MESSAGE_DELETED = 'MESSAGE_DELETED',
  CONVERSATION_CREATED = 'CONVERSATION_CREATED',
  
  // Match Events
  LIKE_SENT = 'LIKE_SENT',
  MATCH_CREATED = 'MATCH_CREATED',
  PROFILE_BLOCKED = 'PROFILE_BLOCKED',
  PROFILE_REPORTED = 'PROFILE_REPORTED',
  
  // Admin Events
  ADMIN_LOGIN = 'ADMIN_LOGIN',
  ADMIN_ACTION = 'ADMIN_ACTION',
  DATA_EXPORT = 'DATA_EXPORT',
  SYSTEM_SETTINGS_CHANGED = 'SYSTEM_SETTINGS_CHANGED',
  
  // Security Events
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  
  // Data Events
  SENSITIVE_DATA_ACCESS = 'SENSITIVE_DATA_ACCESS',
  BULK_DATA_ACCESS = 'BULK_DATA_ACCESS',
  DATA_MODIFICATION = 'DATA_MODIFICATION'
}

interface AuditLogEntry {
  eventType: AuditEventType;
  userId?: string;
  targetUserId?: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, any>;
  metadata?: {
    ip?: string;
    userAgent?: string;
    path?: string;
    method?: string;
    statusCode?: number;
    duration?: number;
  };
  timestamp: Date;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export class AuditLogService {
  private static instance: AuditLogService;
  private logQueue: AuditLogEntry[] = [];
  private isProcessing = false;
  private flushInterval: NodeJS.Timeout;

  constructor() {
    // Process logs every 5 seconds
    this.flushInterval = setInterval(() => {
      this.flushLogs();
    }, 5000);

    // Also flush on process exit
    process.on('SIGINT', () => {
      this.flushLogs();
    });
  }

  static getInstance(): AuditLogService {
    if (!AuditLogService.instance) {
      AuditLogService.instance = new AuditLogService();
    }
    return AuditLogService.instance;
  }

  async logEvent(entry: Omit<AuditLogEntry, 'timestamp'>): Promise<void> {
    const auditEntry: AuditLogEntry = {
      ...entry,
      timestamp: new Date()
    };

    // Add to queue for batch processing
    this.logQueue.push(auditEntry);

    // Also log to application logger for immediate visibility
    const logLevel = entry.severity === 'CRITICAL' ? 'error' : 
                     entry.severity === 'HIGH' ? 'warn' : 'info';
    
    logger[logLevel]('Audit Event', {
      eventType: entry.eventType,
      userId: entry.userId,
      severity: entry.severity,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      metadata: entry.metadata
    });

    // Flush immediately for critical events
    if (entry.severity === 'CRITICAL') {
      await this.flushLogs();
    }
  }

  private async flushLogs(): Promise<void> {
    if (this.isProcessing || this.logQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const logsToProcess = [...this.logQueue];
    this.logQueue = [];

    try {
      // Store in database using createMany for batch insert
      await prisma.audit_logs.createMany({
        data: logsToProcess.map(log => ({
          event_type: log.eventType,
          user_id: log.userId || null,
          target_user_id: log.targetUserId || null,
          resource_type: log.resourceType || null,
          resource_id: log.resourceId || null,
          details: log.details || {},
          metadata: log.metadata || {},
          timestamp: log.timestamp,
          severity: log.severity
        }))
      });

      logger.info(`Flushed ${logsToProcess.length} audit log entries`);
    } catch (error) {
      logger.error('Failed to flush audit logs:', error);
      // Put failed logs back in queue for retry
      this.logQueue.unshift(...logsToProcess);
    } finally {
      this.isProcessing = false;
    }
  }

  // Convenience methods for common events
  static async logAuth(eventType: AuditEventType.LOGIN | AuditEventType.LOGOUT | AuditEventType.LOGIN_FAILED, req: AuthRequest, userId?: string) {
    const service = AuditLogService.getInstance();
    await service.logEvent({
      eventType,
      userId,
      severity: eventType === AuditEventType.LOGIN_FAILED ? 'MEDIUM' : 'LOW',
      metadata: {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method
      }
    });
  }

  static async logDataAccess(userId: string, resourceType: string, resourceId: string, req: AuthRequest, isSensitive: boolean = false) {
    const service = AuditLogService.getInstance();
    await service.logEvent({
      eventType: isSensitive ? AuditEventType.SENSITIVE_DATA_ACCESS : AuditEventType.PROFILE_VIEWED,
      userId,
      resourceType,
      resourceId,
      severity: isSensitive ? 'MEDIUM' : 'LOW',
      metadata: {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method
      }
    });
  }

  static async logDataModification(userId: string, eventType: AuditEventType, resourceType: string, resourceId: string, req: AuthRequest, details?: Record<string, any>) {
    const service = AuditLogService.getInstance();
    await service.logEvent({
      eventType,
      userId,
      resourceType,
      resourceId,
      details,
      severity: ['USER_DELETED', 'DATA_EXPORT'].includes(eventType) ? 'HIGH' : 'MEDIUM',
      metadata: {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method
      }
    });
  }

  static async logSecurityEvent(eventType: AuditEventType, req: AuthRequest, details?: Record<string, any>, userId?: string) {
    const service = AuditLogService.getInstance();
    await service.logEvent({
      eventType,
      userId,
      details,
      severity: 'HIGH',
      metadata: {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method
      }
    });
  }

  static async logAdminAction(adminUserId: string, action: string, req: AuthRequest, targetUserId?: string, details?: Record<string, any>) {
    const service = AuditLogService.getInstance();
    await service.logEvent({
      eventType: AuditEventType.ADMIN_ACTION,
      userId: adminUserId,
      targetUserId,
      resourceType: 'admin_action',
      details: { action, ...details },
      severity: 'HIGH',
      metadata: {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method
      }
    });
  }

  // Method to query audit logs
  static async getAuditLogs(filters: {
    userId?: string;
    eventType?: AuditEventType;
    startDate?: Date;
    endDate?: Date;
    severity?: string;
    limit?: number;
    offset?: number;
  }) {
    const {
      userId,
      eventType,
      startDate,
      endDate,
      severity,
      limit = 100,
      offset = 0
    } = filters;

    const whereConditions: string[] = [];
    const params: any[] = [];

    if (userId) {
      whereConditions.push(`user_id = ?`);
      params.push(userId);
    }

    if (eventType) {
      whereConditions.push(`event_type = ?`);
      params.push(eventType);
    }

    if (startDate) {
      whereConditions.push(`timestamp >= ?`);
      params.push(startDate.toISOString());
    }

    if (endDate) {
      whereConditions.push(`timestamp <= ?`);
      params.push(endDate.toISOString());
    }

    if (severity) {
      whereConditions.push(`severity = ?`);
      params.push(severity);
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    const query = `
      SELECT * FROM audit_logs 
      ${whereClause}
      ORDER BY timestamp DESC 
      LIMIT ${limit} OFFSET ${offset}
    `;

    return await prisma.$queryRawUnsafe(query, ...params);
  }
}

export { AuditEventType };
export const auditLogger = AuditLogService.getInstance();