import { prisma } from '@/server';
import { AppError } from '@/utils/AppError';
import { logger } from '@/utils/logger';
import { MessageType, ActivityType } from '@prisma/client';

export class ChatService {
  async getConversations(userId: string, limit: number = 20, offset: number = 0) {
    try {
      const conversations = await prisma.conversation.findMany({
        where: {
          OR: [
            { user1Id: userId },
            { user2Id: userId }
          ]
        },
        include: {
          user1: {
            include: {
              profile: {
                include: {
                  photos: {
                    where: { isPrimary: true },
                    take: 1
                  }
                }
              }
            }
          },
          user2: {
            include: {
              profile: {
                include: {
                  photos: {
                    where: { isPrimary: true },
                    take: 1
                  }
                }
              }
            }
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              sender: {
                select: {
                  id: true,
                  profile: {
                    select: {
                      firstName: true
                    }
                  }
                }
              }
            }
          },
          match: true
        },
        orderBy: [
          { lastMessageAt: 'desc' },
          { createdAt: 'desc' }
        ],
        skip: offset,
        take: limit
      });

      const formattedConversations = await Promise.all(
        conversations.map(async (conversation) => {
          const otherUser = conversation.user1Id === userId ? conversation.user2 : conversation.user1;
          const lastMessage = conversation.messages[0];
          
          // Calculate unread count
          const lastReadTime = conversation.user1Id === userId 
            ? conversation.user1LastRead 
            : conversation.user2LastRead;

          // Calculate unread count for this conversation
          const unreadCount = await prisma.message.count({
            where: {
              conversationId: conversation.id,
              receiverId: userId,
              isRead: false
            }
          });

          return {
            id: conversation.id,
            otherUser: {
              id: otherUser.id,
              profile: otherUser.profile
            },
            lastMessage: lastMessage ? {
              id: lastMessage.id,
              content: lastMessage.content,
              messageType: lastMessage.messageType,
              createdAt: lastMessage.createdAt,
              senderId: lastMessage.senderId,
              isOwn: lastMessage.senderId === userId
            } : null,
            lastMessageAt: conversation.lastMessageAt,
            isRead: lastReadTime ? lastMessage?.createdAt <= lastReadTime : false,
            unreadCount: unreadCount,
            createdAt: conversation.createdAt
          };
        })
      );

      return {
        success: true,
        conversations: formattedConversations,
        total: formattedConversations.length
      };
    } catch (error) {
      logger.error('Error getting conversations:', error);
      throw new AppError('Failed to get conversations', 500);
    }
  }

  async getConversationById(conversationId: string, userId: string) {
    try {
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          user1: {
            include: {
              profile: {
                include: {
                  photos: {
                    where: { isPrimary: true },
                    take: 1
                  }
                }
              }
            }
          },
          user2: {
            include: {
              profile: {
                include: {
                  photos: {
                    where: { isPrimary: true },
                    take: 1
                  }
                }
              }
            }
          },
          match: true
        }
      });

      if (!conversation) {
        throw new AppError('Conversation not found', 404);
      }

      // Check if user is part of conversation
      if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
        throw new AppError('Access denied', 403);
      }

      const otherUser = conversation.user1Id === userId ? conversation.user2 : conversation.user1;

      return {
        success: true,
        conversation: {
          id: conversation.id,
          otherUser: {
            id: otherUser.id,
            profile: otherUser.profile
          },
          createdAt: conversation.createdAt,
          lastMessageAt: conversation.lastMessageAt
        }
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error getting conversation:', error);
      throw new AppError('Failed to get conversation', 500);
    }
  }

  async getMessages(conversationId: string, userId: string, limit: number = 50, offset: number = 0) {
    try {
      // Verify user has access to conversation
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: {
          user1Id: true,
          user2Id: true
        }
      });

      if (!conversation) {
        throw new AppError('Conversation not found', 404);
      }

      if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
        throw new AppError('Access denied', 403);
      }

      const messages = await prisma.message.findMany({
        where: { conversationId },
        include: {
          sender: {
            select: {
              id: true,
              profile: {
                select: {
                  firstName: true,
                  photos: {
                    where: { isPrimary: true },
                    take: 1
                  }
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      });

      const formattedMessages = messages.reverse().map(message => ({
        id: message.id,
        content: message.content,
        messageType: message.messageType,
        mediaUrl: message.mediaUrl,
        mediaType: message.mediaType,
        senderId: message.senderId,
        receiverId: message.receiverId,
        isRead: message.isRead,
        readAt: message.readAt ? message.readAt.toISOString() : null,
        createdAt: message.createdAt.toISOString(),
        editedAt: message.editedAt ? message.editedAt.toISOString() : null,
        sender: {
          id: message.sender.id,
          firstName: message.sender.profile?.firstName,
          photo: message.sender.profile?.photos[0]?.url
        },
        isOwn: message.senderId === userId
      }));

      return {
        success: true,
        messages: formattedMessages,
        total: formattedMessages.length
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error getting messages:', error);
      throw new AppError('Failed to get messages', 500);
    }
  }

  async sendMessage(conversationId: string, senderId: string, messageData: {
    content?: string;
    messageType: MessageType;
    mediaUrl?: string;
    mediaType?: string;
  }) {
    try {
      // Verify conversation exists and user has access
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: {
          user1Id: true,
          user2Id: true
        }
      });

      if (!conversation) {
        throw new AppError('Conversation not found', 404);
      }

      if (conversation.user1Id !== senderId && conversation.user2Id !== senderId) {
        throw new AppError('Access denied', 403);
      }

      const receiverId = conversation.user1Id === senderId 
        ? conversation.user2Id 
        : conversation.user1Id;

      // Check if users are not blocked
      const isBlocked = await prisma.block.findFirst({
        where: {
          OR: [
            { senderId, receiverId },
            { senderId: receiverId, receiverId: senderId }
          ]
        }
      });

      if (isBlocked) {
        throw new AppError('Cannot send message to this user', 403);
      }

      // Validate message content
      if (messageData.messageType === MessageType.TEXT && !messageData.content?.trim()) {
        throw new AppError('Message content is required', 400);
      }

      if (messageData.messageType !== MessageType.TEXT && !messageData.mediaUrl) {
        throw new AppError('Media URL is required for media messages', 400);
      }

      // Create message
      const message = await prisma.message.create({
        data: {
          conversationId,
          senderId,
          receiverId,
          content: messageData.content?.trim(),
          messageType: messageData.messageType,
          mediaUrl: messageData.mediaUrl,
          mediaType: messageData.mediaType
        },
        include: {
          sender: {
            select: {
              id: true,
              profile: {
                select: {
                  firstName: true,
                  photos: {
                    where: { isPrimary: true },
                    take: 1
                  }
                }
              }
            }
          }
        }
      });

      // Update conversation last message timestamp
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: message.createdAt }
      });

      // Log activity
      await prisma.userActivity.create({
        data: {
          userId: senderId,
          type: ActivityType.MESSAGE_SENT,
          data: { 
            receiverId,
            conversationId,
            messageType: messageData.messageType
          }
        }
      });

      const formattedMessage = {
        id: message.id,
        content: message.content,
        messageType: message.messageType,
        mediaUrl: message.mediaUrl,
        mediaType: message.mediaType,
        senderId: message.senderId,
        receiverId: message.receiverId,
        isRead: message.isRead,
        readAt: message.readAt ? message.readAt.toISOString() : null,
        createdAt: message.createdAt.toISOString(),
        sender: {
          id: message.sender.id,
          firstName: message.sender.profile?.firstName,
          photo: message.sender.profile?.photos[0]?.url
        },
        isOwn: true
      };

      return {
        success: true,
        message: formattedMessage
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error sending message:', error);
      throw new AppError('Failed to send message', 500);
    }
  }

  async markMessagesAsRead(conversationId: string, userId: string, messageIds?: string[]) {
    try {
      // Verify user has access to conversation
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: {
          user1Id: true,
          user2Id: true
        }
      });

      if (!conversation) {
        throw new AppError('Conversation not found', 404);
      }

      if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
        throw new AppError('Access denied', 403);
      }

      const now = new Date();

      // Update specific messages or all unread messages
      const whereClause: any = {
        conversationId,
        receiverId: userId,
        isRead: false
      };

      if (messageIds && messageIds.length > 0) {
        whereClause.id = { in: messageIds };
      }

      await prisma.message.updateMany({
        where: whereClause,
        data: {
          isRead: true,
          readAt: now
        }
      });

      // Update conversation read timestamp
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          ...(conversation.user1Id === userId 
            ? { user1LastRead: now } 
            : { user2LastRead: now })
        }
      });

      return {
        success: true,
        message: 'Messages marked as read'
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error marking messages as read:', error);
      throw new AppError('Failed to mark messages as read', 500);
    }
  }

  async deleteMessage(messageId: string, userId: string) {
    try {
      const message = await prisma.message.findUnique({
        where: { id: messageId },
        select: {
          senderId: true,
          conversationId: true,
          createdAt: true
        }
      });

      if (!message) {
        throw new AppError('Message not found', 404);
      }

      if (message.senderId !== userId) {
        throw new AppError('Can only delete your own messages', 403);
      }

      // Check if message is too old to delete (e.g., older than 1 hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (message.createdAt < oneHourAgo) {
        throw new AppError('Cannot delete messages older than 1 hour', 400);
      }

      await prisma.message.delete({
        where: { id: messageId }
      });

      return {
        success: true,
        message: 'Message deleted successfully'
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error deleting message:', error);
      throw new AppError('Failed to delete message', 500);
    }
  }

  async getUnreadMessageCount(userId: string) {
    try {
      const unreadCount = await prisma.message.count({
        where: {
          receiverId: userId,
          isRead: false
        }
      });

      return {
        success: true,
        unreadCount
      };
    } catch (error) {
      logger.error('Error getting unread message count:', error);
      throw new AppError('Failed to get unread message count', 500);
    }
  }

  async searchMessages(conversationId: string, userId: string, query: string, limit: number = 20) {
    try {
      // Verify user has access to conversation
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: {
          user1Id: true,
          user2Id: true
        }
      });

      if (!conversation) {
        throw new AppError('Conversation not found', 404);
      }

      if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
        throw new AppError('Access denied', 403);
      }

      const messages = await prisma.message.findMany({
        where: {
          conversationId,
          messageType: MessageType.TEXT,
          content: {
            contains: query,
            mode: 'insensitive'
          }
        },
        include: {
          sender: {
            select: {
              id: true,
              profile: {
                select: {
                  firstName: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      const formattedMessages = messages.map(message => ({
        id: message.id,
        content: message.content,
        senderId: message.senderId,
        createdAt: message.createdAt,
        sender: {
          id: message.sender.id,
          firstName: message.sender.profile?.firstName
        },
        isOwn: message.senderId === userId
      }));

      return {
        success: true,
        messages: formattedMessages,
        total: formattedMessages.length
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error searching messages:', error);
      throw new AppError('Failed to search messages', 500);
    }
  }
}