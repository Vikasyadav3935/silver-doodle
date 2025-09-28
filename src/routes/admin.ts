import { Router, Request, Response, NextFunction } from 'express';
import { query, param, body, validationResult } from 'express-validator';
import { prisma } from '@/server';
import { authenticate } from '@/middlewares/auth';
import { AuthRequest } from '@/types';
import { AppError } from '@/utils/AppError';
import { logger } from '@/utils/logger';
import { loadUserRole, requireAdmin, requireSuperAdmin, Permission } from '@/middlewares/rbac';
import { adminLimiter } from '@/middlewares/rateLimiter';
import { InputSanitizer } from '@/middlewares/inputSanitization';
import { AuditLogService, AuditEventType } from '@/services/auditLogService';

const router = Router();

// Validation middleware
const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// Apply rate limiting and input sanitization to all admin routes
router.use(adminLimiter);
router.use(InputSanitizer.adminInputSanitizer());
router.use(authenticate);
router.use(loadUserRole);

// Get platform statistics
router.get('/stats',
  requireAdmin,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // Log admin access
      await AuditLogService.logAdminAction(
        req.user!.id,
        'VIEW_PLATFORM_STATS',
        req
      );

      const [
        totalUsers,
        activeUsers,
        totalMatches,
        totalMessages,
        totalReports,
        subscriptions
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({
          where: {
            updatedAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
            }
          }
        }),
        prisma.match.count(),
        prisma.message.count(),
        prisma.report.count(),
        prisma.subscription.groupBy({
          by: ['plan'],
          _count: { plan: true }
        })
      ]);

      const subscriptionStats = subscriptions.reduce((acc, item) => {
        acc[item.plan] = item._count.plan;
        return acc;
      }, {} as Record<string, number>);

      res.status(200).json({
        success: true,
        stats: {
          users: {
            total: totalUsers,
            active: activeUsers,
            growth: Math.round((activeUsers / totalUsers) * 100)
          },
          engagement: {
            totalMatches,
            totalMessages,
            avgMessagesPerMatch: totalMatches > 0 ? Math.round(totalMessages / totalMatches) : 0
          },
          moderation: {
            totalReports,
            pendingReports: 0 // Would need to count pending reports
          },
          subscriptions: subscriptionStats
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get users with pagination and filters
router.get('/users',
  authenticate,
  requireAdmin,
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('search')
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage('Search must be between 1 and 100 characters'),
    query('status')
      .optional()
      .isIn(['verified', 'unverified', 'banned'])
      .withMessage('Status must be verified, unverified, or banned')
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { page = 1, limit = 20, search, status } = req.query;
      const offset = (Number(page) - 1) * Number(limit);

      const whereClause: any = {};

      if (search) {
        whereClause.OR = [
          { phoneNumber: { contains: search as string } },
          { email: { contains: search as string, mode: 'insensitive' } },
          {
            profile: {
              firstName: { contains: search as string, mode: 'insensitive' }
            }
          }
        ];
      }

      if (status === 'verified') {
        whereClause.isVerified = true;
      } else if (status === 'unverified') {
        whereClause.isVerified = false;
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where: whereClause,
          include: {
            profile: {
              select: {
                firstName: true,
                lastName: true,
                dateOfBirth: true,
                city: true,
                profileCompleteness: true
              }
            },
            subscription: {
              select: {
                plan: true,
                status: true,
                endDate: true
              }
            },
            _count: {
              select: {
                sentMessages: true,
                receivedMessages: true,
                sentLikes: true,
                receivedLikes: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: Number(limit)
        }),
        prisma.user.count({ where: whereClause })
      ]);

      res.status(200).json({
        success: true,
        users: users.map(user => ({
          id: user.id,
          phoneNumber: user.phoneNumber,
          email: user.email,
          isVerified: user.isVerified,
          createdAt: user.createdAt,
          profile: user.profile,
          subscription: user.subscription,
          activity: user._count
        })),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get reports with filtering
router.get('/reports',
  authenticate,
  requireAdmin,
  [
    query('status')
      .optional()
      .isIn(['PENDING', 'INVESTIGATING', 'RESOLVED', 'DISMISSED'])
      .withMessage('Invalid status'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { status, limit = 50 } = req.query;

      const whereClause: any = {};
      if (status) {
        whereClause.status = status;
      }

      const reports = await prisma.report.findMany({
        where: whereClause,
        include: {
          sender: {
            include: {
              profile: {
                select: {
                  firstName: true,
                  lastName: true
                }
              }
            }
          },
          receiver: {
            include: {
              profile: {
                select: {
                  firstName: true,
                  lastName: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: Number(limit)
      });

      res.status(200).json({
        success: true,
        reports: reports.map(report => ({
          id: report.id,
          reason: report.reason,
          description: report.description,
          status: report.status,
          createdAt: report.createdAt,
          sender: {
            id: report.sender.id,
            name: `${report.sender.profile?.firstName} ${report.sender.profile?.lastName || ''}`.trim()
          },
          receiver: {
            id: report.receiver.id,
            name: `${report.receiver.profile?.firstName} ${report.receiver.profile?.lastName || ''}`.trim()
          }
        }))
      });
    } catch (error) {
      next(error);
    }
  }
);

// Update report status
router.put('/reports/:reportId',
  authenticate,
  requireAdmin,
  [
    param('reportId')
      .isUUID()
      .withMessage('Valid report ID is required'),
    body('status')
      .isIn(['INVESTIGATING', 'RESOLVED', 'DISMISSED'])
      .withMessage('Invalid status')
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { reportId } = req.params;
      const { status } = req.body;

      const report = await prisma.report.update({
        where: { id: reportId },
        data: { status }
      });

      logger.info(`Report ${reportId} status updated to ${status} by admin`);

      res.status(200).json({
        success: true,
        report
      });
    } catch (error) {
      next(error);
    }
  }
);

// Create system notification for all users
router.post('/notifications/broadcast',
  authenticate,
  requireAdmin,
  [
    body('title')
      .isLength({ min: 1, max: 100 })
      .withMessage('Title must be between 1 and 100 characters'),
    body('message')
      .isLength({ min: 1, max: 500 })
      .withMessage('Message must be between 1 and 500 characters')
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { title, message } = req.body;

      // Get all user IDs
      const users = await prisma.user.findMany({
        select: { id: true },
        where: { isVerified: true }
      });

      // Create notifications for all users
      const notifications = users.map(user => ({
        userId: user.id,
        type: 'SYSTEM' as const,
        title,
        message,
        data: {}
      }));

      await prisma.notification.createMany({
        data: notifications
      });

      logger.info(`Broadcast notification sent to ${users.length} users`);

      res.status(200).json({
        success: true,
        message: `Notification sent to ${users.length} users`
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get system metrics
router.get('/metrics',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // Get daily active users for the last 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      const dailyActiveUsers = await prisma.userActivity.groupBy({
        by: ['userId'],
        where: {
          createdAt: {
            gte: sevenDaysAgo
          }
        },
        _count: { userId: true }
      });

      // Get match success rate
      const [totalLikes, totalMatches] = await Promise.all([
        prisma.like.count(),
        prisma.match.count()
      ]);

      const matchSuccessRate = totalLikes > 0 ? (totalMatches / totalLikes) * 100 : 0;

      // Get revenue metrics (simplified)
      const totalRevenue = await prisma.payment.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amount: true }
      });

      res.status(200).json({
        success: true,
        metrics: {
          dailyActiveUsers: dailyActiveUsers.length,
          matchSuccessRate: Math.round(matchSuccessRate * 100) / 100,
          totalRevenue: totalRevenue._sum.amount || 0,
          period: '7 days'
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;