import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

import { PrismaClient } from '@prisma/client';
import { logger } from './utils/logger';
import { dbService } from './utils/database';
import { errorHandler } from './middlewares/errorHandler';
import { notFoundHandler } from './middlewares/notFoundHandler';
import { socketAuth } from './middlewares/socketAuth';

// Routes
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import profileRoutes from './routes/profile';
import matchRoutes from './routes/match';
import chatRoutes from './routes/chat';
import uploadRoutes from './routes/upload';
import paymentRoutes from './routes/payment';
import notificationRoutes from './routes/notification';
import adminRoutes from './routes/admin';

// Socket handlers
import { handleChatEvents } from './socket/chatHandler';
import { handleMatchEvents } from './socket/matchHandler';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:19006'],
    methods: ['GET', 'POST']
  }
});

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  log: ['warn', 'error']
});

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests from this IP, please try again later.'
});

// Middlewares
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:19006'],
  credentials: true
}));
app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const dbHealthy = await dbService.healthCheck(prisma);
    const status = dbHealthy ? 'OK' : 'DEGRADED';
    
    res.status(dbHealthy ? 200 : 503).json({ 
      status, 
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      database: dbHealthy ? 'connected' : 'disconnected'
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      database: 'error'
    });
  }
});

// Socket.IO authentication
io.use(socketAuth);

// Socket event handlers
io.on('connection', (socket) => {
  logger.info(`User connected: ${socket.data.userId}`);

  handleChatEvents(socket, io);
  handleMatchEvents(socket, io);

  socket.on('disconnect', () => {
    logger.info(`User disconnected: ${socket.data.userId}`);
  });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📊 Health check: http://localhost:${PORT}/api/health`);
  
  // Keep database connection alive with periodic queries
  setInterval(async () => {
    await dbService.keepAlive(prisma);
  }, 5 * 60 * 1000); // Every 5 minutes
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

export { io };