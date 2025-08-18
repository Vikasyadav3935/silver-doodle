import { prisma } from '@/server';
import { AppError } from '@/utils/AppError';
import { logger } from '@/utils/logger';
import { NotificationType } from '@prisma/client';

// Firebase Admin SDK would be imported here for push notifications
// import admin from 'firebase-admin';

export class NotificationService {
  async sendNotification(userId: string, notification: {
    type: NotificationType;
    title: string;
    message: string;
    data?: any;
  }) {
    try {
      // Save notification to database
      const savedNotification = await prisma.notification.create({
        data: {
          userId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data || {}
        }
      });

      // Send push notification if user has push tokens
      await this.sendPushNotification(userId, notification);

      // Send email notification if enabled and applicable
      if (this.shouldSendEmailNotification(notification.type)) {
        await this.sendEmailNotification(userId, notification);
      }

      return {
        success: true,
        notification: savedNotification
      };
    } catch (error) {
      logger.error('Error sending notification:', error);
      throw new AppError('Failed to send notification', 500);
    }
  }

  async sendPushNotification(userId: string, notification: {
    type: NotificationType;
    title: string;
    message: string;
    data?: any;
  }) {
    try {
      // Get user's push tokens
      const pushTokens = await prisma.pushToken.findMany({
        where: { userId },
        select: { token: true, platform: true }
      });

      if (pushTokens.length === 0) {
        logger.info(`No push tokens found for user ${userId}`);
        return;
      }

      // Check if user has push notifications enabled
      const settings = await prisma.userSettings.findUnique({
        where: { userId }
      });

      if (!settings?.pushNotifications) {
        logger.info(`Push notifications disabled for user ${userId}`);
        return;
      }

      // Check specific notification type settings
      if (!this.isNotificationTypeEnabled(notification.type, settings)) {
        logger.info(`Notification type ${notification.type} disabled for user ${userId}`);
        return;
      }

      // Send push notification using FCM (Firebase Cloud Messaging)
      // This is a placeholder - you would integrate with Firebase Admin SDK
      const tokens = pushTokens.map(pt => pt.token);
      
      // Example FCM payload
      const message = {
        notification: {
          title: notification.title,
          body: notification.message,
        },
        data: {
          type: notification.type,
          ...notification.data
        },
        tokens
      };

      // In a real implementation:
      // const response = await admin.messaging().sendMulticast(message);
      
      logger.info(`Push notification sent to ${tokens.length} devices for user ${userId}`);
    } catch (error) {
      logger.error('Error sending push notification:', error);
      // Don't throw error - push notification failure shouldn't break the flow
    }
  }

  async sendEmailNotification(userId: string, notification: {
    type: NotificationType;
    title: string;
    message: string;
    data?: any;
  }) {
    try {
      // Get user's email and settings
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          settings: true,
          profile: true
        }
      });

      if (!user || !user.email) {
        return;
      }

      if (!user.settings?.emailNotifications) {
        return;
      }

      // This would integrate with your email service (SendGrid, Mailgun, etc.)
      // For now, just log the email that would be sent
      logger.info(`Email notification would be sent to ${user.email}: ${notification.title} - ${notification.message}`);
    } catch (error) {
      logger.error('Error sending email notification:', error);
      // Don't throw error - email failure shouldn't break the flow
    }
  }

  async getUserNotifications(userId: string, limit: number = 20, offset: number = 0, unreadOnly: boolean = false) {
    try {
      const whereClause: any = { userId };
      
      if (unreadOnly) {
        whereClause.isRead = false;
      }

      const notifications = await prisma.notification.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      });

      const total = await prisma.notification.count({ where: whereClause });
      const unreadCount = await prisma.notification.count({
        where: { userId, isRead: false }
      });

      return {
        success: true,
        notifications,
        total,
        unreadCount
      };
    } catch (error) {
      logger.error('Error getting user notifications:', error);
      throw new AppError('Failed to get notifications', 500);
    }
  }

  async markNotificationsAsRead(userId: string, notificationIds?: string[]) {
    try {
      const whereClause: any = { userId };
      
      if (notificationIds && notificationIds.length > 0) {
        whereClause.id = { in: notificationIds };
      }

      await prisma.notification.updateMany({
        where: whereClause,
        data: {
          isRead: true,
          readAt: new Date()
        }
      });

      return {
        success: true,
        message: 'Notifications marked as read'
      };
    } catch (error) {
      logger.error('Error marking notifications as read:', error);
      throw new AppError('Failed to mark notifications as read', 500);
    }
  }

  async deleteNotification(userId: string, notificationId: string) {
    try {
      const notification = await prisma.notification.findFirst({
        where: { id: notificationId, userId }
      });

      if (!notification) {
        throw new AppError('Notification not found', 404);
      }

      await prisma.notification.delete({
        where: { id: notificationId }
      });

      return {
        success: true,
        message: 'Notification deleted'
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error deleting notification:', error);
      throw new AppError('Failed to delete notification', 500);
    }
  }

  async addPushToken(userId: string, token: string, platform: string) {
    try {
      await prisma.pushToken.upsert({
        where: { token },
        update: { userId, platform, updatedAt: new Date() },
        create: { userId, token, platform }
      });

      return {
        success: true,
        message: 'Push token added'
      };
    } catch (error) {
      logger.error('Error adding push token:', error);
      throw new AppError('Failed to add push token', 500);
    }
  }

  async removePushToken(token: string) {
    try {
      await prisma.pushToken.deleteMany({
        where: { token }
      });

      return {
        success: true,
        message: 'Push token removed'
      };
    } catch (error) {
      logger.error('Error removing push token:', error);
      throw new AppError('Failed to remove push token', 500);
    }
  }

  // Specific notification methods for different events
  async sendNewMatchNotification(userId: string, matchedUserId: string) {
    try {
      const matchedUser = await prisma.profile.findUnique({
        where: { userId: matchedUserId },
        select: { firstName: true }
      });

      if (!matchedUser) return;

      await this.sendNotification(userId, {
        type: NotificationType.NEW_MATCH,
        title: 'New Match! 💖',
        message: `You matched with ${matchedUser.firstName}!`,
        data: { matchedUserId }
      });
    } catch (error) {
      logger.error('Error sending new match notification:', error);
    }
  }

  async sendNewMessageNotification(userId: string, senderId: string, conversationId: string) {
    try {
      const sender = await prisma.profile.findUnique({
        where: { userId: senderId },
        select: { firstName: true }
      });

      if (!sender) return;

      await this.sendNotification(userId, {
        type: NotificationType.NEW_MESSAGE,
        title: `${sender.firstName} sent you a message`,
        message: 'Tap to view',
        data: { senderId, conversationId }
      });
    } catch (error) {
      logger.error('Error sending new message notification:', error);
    }
  }

  async sendNewLikeNotification(userId: string, likerId: string) {
    try {
      const liker = await prisma.profile.findUnique({
        where: { userId: likerId },
        select: { firstName: true }
      });

      if (!liker) return;

      await this.sendNotification(userId, {
        type: NotificationType.NEW_LIKE,
        title: 'Someone likes you! ❤️',
        message: `${liker.firstName} liked your profile`,
        data: { likerId }
      });
    } catch (error) {
      logger.error('Error sending new like notification:', error);
    }
  }

  async sendSuperLikeNotification(userId: string, superLikerId: string) {
    try {
      const superLiker = await prisma.profile.findUnique({
        where: { userId: superLikerId },
        select: { firstName: true }
      });

      if (!superLiker) return;

      await this.sendNotification(userId, {
        type: NotificationType.SUPER_LIKE,
        title: 'Super Like! ⭐',
        message: `${superLiker.firstName} super liked you!`,
        data: { superLikerId }
      });
    } catch (error) {
      logger.error('Error sending super like notification:', error);
    }
  }

  async sendProfileViewNotification(userId: string, viewerId: string) {
    try {
      const viewer = await prisma.profile.findUnique({
        where: { userId: viewerId },
        select: { firstName: true }
      });

      if (!viewer) return;

      await this.sendNotification(userId, {
        type: NotificationType.PROFILE_VIEW,
        title: 'Profile View 👀',
        message: `${viewer.firstName} viewed your profile`,
        data: { viewerId }
      });
    } catch (error) {
      logger.error('Error sending profile view notification:', error);
    }
  }

  async sendSystemNotification(userId: string, title: string, message: string, data?: any) {
    try {
      await this.sendNotification(userId, {
        type: NotificationType.SYSTEM,
        title,
        message,
        data
      });
    } catch (error) {
      logger.error('Error sending system notification:', error);
    }
  }

  private shouldSendEmailNotification(type: NotificationType): boolean {
    // Define which notification types should also send email
    const emailNotificationTypes = [
      NotificationType.NEW_MATCH,
      NotificationType.NEW_MESSAGE,
      NotificationType.NEW_LIKE,
      NotificationType.SUPER_LIKE,
      NotificationType.PROFILE_VIEW,
      NotificationType.SYSTEM
    ];
    
    return emailNotificationTypes.includes(type);
  }

  private isNotificationTypeEnabled(type: NotificationType, settings: Record<string, any>): boolean {
    switch (type) {
      case NotificationType.NEW_MATCH:
        return settings.newMatchNotifications;
      case NotificationType.NEW_MESSAGE:
        return settings.messageNotifications;
      case NotificationType.NEW_LIKE:
        return settings.likeNotifications;
      case NotificationType.SUPER_LIKE:
        return settings.superLikeNotifications;
      default:
        return true; // Enable by default for unknown types
    }
  }

  async getNotificationStats(userId: string) {
    try {
      const [total, unread, byType] = await Promise.all([
        prisma.notification.count({ where: { userId } }),
        prisma.notification.count({ where: { userId, isRead: false } }),
        prisma.notification.groupBy({
          by: ['type'],
          where: { userId },
          _count: { type: true }
        })
      ]);

      const typeStats = byType.reduce((acc, item) => {
        acc[item.type] = item._count.type;
        return acc;
      }, {} as Record<string, number>);

      return {
        success: true,
        stats: {
          total,
          unread,
          byType: typeStats
        }
      };
    } catch (error) {
      logger.error('Error getting notification stats:', error);
      throw new AppError('Failed to get notification stats', 500);
    }
  }
}