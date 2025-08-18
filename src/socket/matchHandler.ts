import { Socket, Server } from 'socket.io';
import { MatchService } from '../services/matchService';
import { logger } from '../utils/logger';

const matchService = new MatchService();

export const handleMatchEvents = (socket: Socket, io: Server) => {
  const userId = socket.data.userId;

  // Handle like action
  socket.on('like_user', async (data) => {
    try {
      const { targetUserId } = data;

      if (!targetUserId) {
        socket.emit('error', { message: 'Target user ID is required' });
        return;
      }

      const result = await matchService.likeProfile(userId, targetUserId);

      if (result.success) {
        socket.emit('like_sent', {
          targetUserId: targetUserId,
          isMatch: result.isMatch,
          message: result.message
        });

        // If it's a match, notify both users
        if (result.isMatch) {
          // Notify the current user
          socket.emit('new_match', {
            matchedUserId: targetUserId,
            timestamp: new Date()
          });

          // Notify the target user if they're online
          io.to(`user:${targetUserId}`).emit('new_match', {
            matchedUserId: userId,
            timestamp: new Date()
          });

          // Also send notification about the like
          io.to(`user:${targetUserId}`).emit('new_like', {
            likedByUserId: userId,
            isMatch: true,
            timestamp: new Date()
          });

          logger.info(`New match created between ${userId} and ${targetUserId}`);
        } else {
          // Just notify the target user about the like
          io.to(`user:${targetUserId}`).emit('new_like', {
            likedByUserId: userId,
            isMatch: false,
            timestamp: new Date()
          });
        }

        logger.info(`User ${userId} liked user ${targetUserId}`);
      } else {
        socket.emit('error', { message: 'Failed to send like' });
      }
    } catch (error) {
      logger.error('Error handling like:', error);
      socket.emit('error', { message: 'Failed to send like' });
    }
  });

  // Handle super like action
  socket.on('super_like_user', async (data) => {
    try {
      const { targetUserId } = data;

      if (!targetUserId) {
        socket.emit('error', { message: 'Target user ID is required' });
        return;
      }

      const result = await matchService.superLike(userId, targetUserId);

      if (result.success) {
        socket.emit('super_like_sent', {
          targetUserId: targetUserId,
          message: result.message
        });

        // Notify target user about super like
        io.to(`user:${targetUserId}`).emit('new_super_like', {
          superLikedByUserId: userId,
          timestamp: new Date()
        });

        logger.info(`User ${userId} super liked user ${targetUserId}`);
      } else {
        socket.emit('error', { message: 'Failed to send super like' });
      }
    } catch (error) {
      logger.error('Error handling super like:', error);
      socket.emit('error', { message: 'Failed to send super like' });
    }
  });

  // Handle pass action
  socket.on('pass_user', async (data) => {
    try {
      const { targetUserId } = data;

      if (!targetUserId) {
        socket.emit('error', { message: 'Target user ID is required' });
        return;
      }

      const result = await matchService.passProfile(userId, targetUserId);

      if (result.success) {
        socket.emit('pass_sent', {
          targetUserId: targetUserId,
          message: result.message
        });

        logger.info(`User ${userId} passed on user ${targetUserId}`);
      } else {
        socket.emit('error', { message: 'Failed to pass user' });
      }
    } catch (error) {
      logger.error('Error handling pass:', error);
      socket.emit('error', { message: 'Failed to pass user' });
    }
  });

  // Handle getting discovery profiles in real-time
  socket.on('get_discovery_profiles', async (data) => {
    try {
      const { limit = 10, filters = {} } = data;

      const result = await matchService.getDiscoveryProfiles(userId, limit, filters);

      if (result.success) {
        socket.emit('discovery_profiles', {
          profiles: result.profiles,
          total: result.total,
          timestamp: new Date()
        });
      } else {
        socket.emit('error', { message: 'Failed to get discovery profiles' });
      }
    } catch (error) {
      logger.error('Error getting discovery profiles:', error);
      socket.emit('error', { message: 'Failed to get discovery profiles' });
    }
  });

  // Handle profile boost notifications
  socket.on('profile_boosted', (data) => {
    try {
      // This would be called when a user activates a boost
      socket.emit('boost_activated', {
        timestamp: new Date(),
        message: 'Your profile is now boosted!'
      });

      logger.info(`User ${userId} activated profile boost`);
    } catch (error) {
      logger.error('Error handling profile boost:', error);
    }
  });

  // Handle location updates for discovery
  socket.on('update_location', async (data) => {
    try {
      const { latitude, longitude } = data;

      if (!latitude || !longitude) {
        socket.emit('error', { message: 'Latitude and longitude are required' });
        return;
      }

      // Update user location in database (this would be handled by user service)
      // For now, just acknowledge the update
      socket.emit('location_updated', {
        latitude,
        longitude,
        timestamp: new Date()
      });

      logger.info(`User ${userId} updated location to ${latitude}, ${longitude}`);
    } catch (error) {
      logger.error('Error updating location:', error);
      socket.emit('error', { message: 'Failed to update location' });
    }
  });

  // Handle match-related notifications
  socket.on('get_match_notifications', async () => {
    try {
      // This would get unread match-related notifications
      // For now, just send empty response
      socket.emit('match_notifications', {
        notifications: [],
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Error getting match notifications:', error);
      socket.emit('error', { message: 'Failed to get notifications' });
    }
  });

  logger.info(`Match events handler initialized for user ${userId}`);
};