import jwt from 'jsonwebtoken';
import { Socket } from 'socket.io';
import { prisma } from '../server';
import { logger } from '../utils/logger';
import { JwtPayload } from '../types';

export const socketAuth = async (socket: Socket, next: (err?: Error) => void) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    if (!process.env.JWT_SECRET) {
      return next(new Error('JWT secret not configured'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        phoneNumber: true,
        isVerified: true,
        profile: {
          select: {
            id: true,
            firstName: true,
            photos: {
              where: { isPrimary: true },
              take: 1,
              select: { url: true }
            }
          }
        }
      }
    });

    if (!user) {
      return next(new Error('User not found'));
    }

    if (!user.isVerified) {
      return next(new Error('User not verified'));
    }

    // Attach user data to socket
    socket.data = {
      userId: user.id,
      user: user
    };

    logger.info(`Socket authenticated for user: ${user.id}`);
    next();
  } catch (error) {
    logger.error('Socket authentication failed:', error);
    next(new Error('Authentication failed'));
  }
};