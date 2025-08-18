import { Socket, Server } from 'socket.io';
import { ChatService } from '../services/chatService';
import { logger } from '../utils/logger';
import { MessageType } from '@prisma/client';

const chatService = new ChatService();
const activeUsers = new Map<string, string>(); // userId -> socketId
const userRooms = new Map<string, Set<string>>(); // userId -> Set of room names

export const handleChatEvents = (socket: Socket, io: Server) => {
  const userId = socket.data.userId;

  // Store active user
  activeUsers.set(userId, socket.id);

  // Join user to their personal room for notifications
  socket.join(`user:${userId}`);

  // Handle joining a conversation room
  socket.on('join_conversation', async (data) => {
    try {
      const { conversationId } = data;

      if (!conversationId) {
        socket.emit('error', { message: 'Conversation ID is required' });
        return;
      }

      // Verify user has access to conversation
      const result = await chatService.getConversationById(conversationId, userId);
      
      if (!result.success) {
        socket.emit('error', { message: 'Access denied to conversation' });
        return;
      }

      // Join conversation room
      const roomName = `conversation:${conversationId}`;
      socket.join(roomName);

      // Track rooms for this user
      if (!userRooms.has(userId)) {
        userRooms.set(userId, new Set());
      }
      userRooms.get(userId)!.add(roomName);

      // Notify other users in conversation that user is online
      socket.to(roomName).emit('user_online', {
        userId: userId,
        timestamp: new Date()
      });

      socket.emit('joined_conversation', { conversationId });
      logger.info(`User ${userId} joined conversation ${conversationId}`);
    } catch (error) {
      logger.error('Error joining conversation:', error);
      socket.emit('error', { message: 'Failed to join conversation' });
    }
  });

  // Handle leaving a conversation room
  socket.on('leave_conversation', (data) => {
    try {
      const { conversationId } = data;

      if (!conversationId) {
        socket.emit('error', { message: 'Conversation ID is required' });
        return;
      }

      const roomName = `conversation:${conversationId}`;
      socket.leave(roomName);

      // Remove from user rooms tracking
      if (userRooms.has(userId)) {
        userRooms.get(userId)!.delete(roomName);
      }

      // Notify other users that user left
      socket.to(roomName).emit('user_offline', {
        userId: userId,
        timestamp: new Date()
      });

      socket.emit('left_conversation', { conversationId });
      logger.info(`User ${userId} left conversation ${conversationId}`);
    } catch (error) {
      logger.error('Error leaving conversation:', error);
      socket.emit('error', { message: 'Failed to leave conversation' });
    }
  });

  // Handle sending a message
  socket.on('send_message', async (data) => {
    try {
      const { conversationId, content, messageType = 'TEXT', mediaUrl, mediaType } = data;

      if (!conversationId) {
        socket.emit('error', { message: 'Conversation ID is required' });
        return;
      }

      // Send message using service
      const result = await chatService.sendMessage(conversationId, userId, {
        content,
        messageType: messageType as MessageType,
        mediaUrl,
        mediaType
      });

      if (result.success) {
        const roomName = `conversation:${conversationId}`;
        
        // Emit to all users in conversation room
        io.to(roomName).emit('new_message', {
          message: result.message,
          conversationId: conversationId
        });

        // Send push notification to offline users (would integrate with notification service)
        const otherUserId = result.message.receiverId;
        if (!activeUsers.has(otherUserId)) {
          // User is offline, send push notification
          io.to(`user:${otherUserId}`).emit('new_message_notification', {
            message: result.message,
            conversationId: conversationId
          });
        }

        logger.info(`Message sent in conversation ${conversationId} by user ${userId}`);
      } else {
        socket.emit('error', { message: 'Failed to send message' });
      }
    } catch (error) {
      logger.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Handle typing indicators
  socket.on('typing_start', (data) => {
    try {
      const { conversationId } = data;

      if (!conversationId) {
        return;
      }

      const roomName = `conversation:${conversationId}`;
      socket.to(roomName).emit('user_typing', {
        userId: userId,
        conversationId: conversationId,
        isTyping: true,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Error handling typing start:', error);
    }
  });

  socket.on('typing_stop', (data) => {
    try {
      const { conversationId } = data;

      if (!conversationId) {
        return;
      }

      const roomName = `conversation:${conversationId}`;
      socket.to(roomName).emit('user_typing', {
        userId: userId,
        conversationId: conversationId,
        isTyping: false,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Error handling typing stop:', error);
    }
  });

  // Handle message read status
  socket.on('mark_messages_read', async (data) => {
    try {
      const { conversationId, messageIds } = data;

      if (!conversationId) {
        socket.emit('error', { message: 'Conversation ID is required' });
        return;
      }

      const result = await chatService.markMessagesAsRead(conversationId, userId, messageIds);

      if (result.success) {
        const roomName = `conversation:${conversationId}`;
        
        // Notify other users that messages were read
        socket.to(roomName).emit('messages_read', {
          conversationId: conversationId,
          readByUserId: userId,
          messageIds: messageIds,
          timestamp: new Date()
        });

        socket.emit('messages_marked_read', { conversationId, messageIds });
      } else {
        socket.emit('error', { message: 'Failed to mark messages as read' });
      }
    } catch (error) {
      logger.error('Error marking messages as read:', error);
      socket.emit('error', { message: 'Failed to mark messages as read' });
    }
  });

  // Handle online status
  socket.on('update_online_status', (data) => {
    try {
      const { isOnline } = data;
      
      // Broadcast online status to all conversations user is part of
      if (userRooms.has(userId)) {
        userRooms.get(userId)!.forEach(roomName => {
          socket.to(roomName).emit('user_status_changed', {
            userId: userId,
            isOnline: isOnline,
            timestamp: new Date()
          });
        });
      }
    } catch (error) {
      logger.error('Error updating online status:', error);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    try {
      // Remove from active users
      activeUsers.delete(userId);

      // Notify all rooms that user is offline
      if (userRooms.has(userId)) {
        userRooms.get(userId)!.forEach(roomName => {
          socket.to(roomName).emit('user_offline', {
            userId: userId,
            timestamp: new Date()
          });
        });
        userRooms.delete(userId);
      }

      logger.info(`User ${userId} disconnected from chat`);
    } catch (error) {
      logger.error('Error handling disconnect:', error);
    }
  });

  // Send initial online status
  socket.emit('connected', {
    userId: userId,
    timestamp: new Date()
  });
};