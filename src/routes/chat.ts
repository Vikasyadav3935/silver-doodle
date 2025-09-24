import { Router, Request, Response, NextFunction } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { ChatService } from '@/services/chatService';
import { authenticate, requireVerified } from '@/middlewares/auth';
import { AuthRequest } from '@/types';
import { AppError } from '@/utils/AppError';
import { MessageType } from '@prisma/client';

const router = Router();
const chatService = new ChatService();

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

// Get user's conversations
router.get('/conversations',
  authenticate,
  requireVerified,
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be a non-negative integer')
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not found', 404);
      }

      const { limit = 20, offset = 0 } = req.query;
      const result = await chatService.getConversations(
        req.user.id,
        Number(limit),
        Number(offset)
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Get specific conversation
router.get('/conversations/:conversationId',
  authenticate,
  requireVerified,
  [
    param('conversationId')
      .isUUID()
      .withMessage('Valid conversation ID is required')
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not found', 404);
      }

      const { conversationId } = req.params;
      const result = await chatService.getConversationById(conversationId, req.user.id);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Get messages in a conversation
router.get('/conversations/:conversationId/messages',
  authenticate,
  requireVerified,
  [
    param('conversationId')
      .isUUID()
      .withMessage('Valid conversation ID is required'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be a non-negative integer')
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not found', 404);
      }

      const { conversationId } = req.params;
      const { limit = 50, offset = 0 } = req.query;
      
      const result = await chatService.getMessages(
        conversationId,
        req.user.id,
        Number(limit),
        Number(offset)
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Send a message
router.post('/conversations/:conversationId/messages',
  authenticate,
  requireVerified,
  [
    param('conversationId')
      .isUUID()
      .withMessage('Valid conversation ID is required'),
    body('messageType')
      .isIn(['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'LOCATION', 'GIF'])
      .withMessage('Valid message type is required'),
    body('content')
      .optional()
      .isLength({ min: 1, max: 1000 })
      .withMessage('Content must be between 1 and 1000 characters'),
    body('mediaUrl')
      .optional()
      .isURL()
      .withMessage('Valid media URL is required'),
    body('mediaType')
      .optional()
      .isString()
      .withMessage('Media type must be a string')
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not found', 404);
      }

      const { conversationId } = req.params;
      const { messageType, content, mediaUrl, mediaType } = req.body;

      const result = await chatService.sendMessage(conversationId, req.user.id, {
        content,
        messageType: messageType as MessageType,
        mediaUrl,
        mediaType
      });

      // Emit socket event for real-time messaging (only to other users)
      if (result.success && result.message) {
        const { io } = require('../server');
        const roomName = `conversation:${conversationId}`;

        // Emit to the room, socket handler will filter out sender
        io.to(roomName).emit('new_message', {
          message: result.message,
          conversationId: conversationId,
          senderId: req.user.id
        });
      }

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Mark messages as read
router.put('/conversations/:conversationId/read',
  authenticate,
  requireVerified,
  [
    param('conversationId')
      .isUUID()
      .withMessage('Valid conversation ID is required'),
    body('messageIds')
      .optional()
      .isArray()
      .withMessage('Message IDs must be an array'),
    body('messageIds.*')
      .optional()
      .isUUID()
      .withMessage('Each message ID must be a valid UUID')
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not found', 404);
      }

      const { conversationId } = req.params;
      const { messageIds } = req.body;

      const result = await chatService.markMessagesAsRead(
        conversationId,
        req.user.id,
        messageIds
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Delete a message
router.delete('/messages/:messageId',
  authenticate,
  requireVerified,
  [
    param('messageId')
      .isUUID()
      .withMessage('Valid message ID is required')
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not found', 404);
      }

      const { messageId } = req.params;
      const result = await chatService.deleteMessage(messageId, req.user.id);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Get unread message count
router.get('/unread-count',
  authenticate,
  requireVerified,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not found', 404);
      }

      const result = await chatService.getUnreadMessageCount(req.user.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Search messages in a conversation
router.get('/conversations/:conversationId/search',
  authenticate,
  requireVerified,
  [
    param('conversationId')
      .isUUID()
      .withMessage('Valid conversation ID is required'),
    query('q')
      .isLength({ min: 1, max: 100 })
      .withMessage('Search query must be between 1 and 100 characters'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50')
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not found', 404);
      }

      const { conversationId } = req.params;
      const { q: query, limit = 20 } = req.query;

      const result = await chatService.searchMessages(
        conversationId,
        req.user.id,
        query as string,
        Number(limit)
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Create or get conversation with a user
router.post('/conversations',
  authenticate,
  requireVerified,
  [
    body('userId')
      .isUUID()
      .withMessage('Valid user ID is required')
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError('User not found', 404);
      }

      const { userId } = req.body;
      
      if (userId === req.user.id) {
        throw new AppError('Cannot create conversation with yourself', 400);
      }

      const result = await chatService.createOrGetConversation(req.user.id, userId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

export default router;