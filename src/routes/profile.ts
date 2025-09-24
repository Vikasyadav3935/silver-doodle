import { Router, Request, Response, NextFunction } from 'express';
import { param, body, query, validationResult } from 'express-validator';
import { prisma } from '@/server';
import { authenticate, requireVerified } from '@/middlewares/auth';
import { AuthRequest } from '@/types';
import { AppError } from '@/utils/AppError';
import { logger } from '@/utils/logger';
import { GenderPreference, ActivityType } from '@prisma/client';

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

// Get profile by ID
router.get('/:userId',
  authenticate,
  requireVerified,
  [
    param('userId').isUUID().withMessage('Valid user ID is required')
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const currentUserId = req.user?.id;

      // Check if user is blocked
      const isBlocked = await prisma.block.findFirst({
        where: {
          OR: [
            { senderId: currentUserId, receiverId: userId },
            { senderId: userId, receiverId: currentUserId }
          ]
        }
      });

      if (isBlocked) {
        throw new AppError('Profile not accessible', 403);
      }

      const profile = await prisma.profile.findUnique({
        where: { userId },
        include: {
          photos: {
            orderBy: { order: 'asc' }
          },
          interests: true,
          answers: {
            include: {
              question: true
            }
          },
          user: {
            select: {
              id: true,
              phoneNumber: false,
              isVerified: true,
              createdAt: true
            }
          }
        }
      });

      if (!profile) {
        throw new AppError('Profile not found', 404);
      }

      // Calculate distance if both users have location
      const currentUserProfile = await prisma.profile.findUnique({
        where: { userId: currentUserId },
        select: { latitude: true, longitude: true }
      });

      let distance: number | null = null;
      if (
        profile.latitude && 
        profile.longitude && 
        currentUserProfile?.latitude && 
        currentUserProfile?.longitude
      ) {
        distance = calculateDistance(
          profile.latitude,
          profile.longitude,
          currentUserProfile.latitude,
          currentUserProfile.longitude
        );
      }

      // Log profile view activity
      if (currentUserId && currentUserId !== userId) {
        await prisma.userActivity.create({
          data: {
            userId: currentUserId,
            type: ActivityType.PROFILE_VIEW,
            data: { viewedUserId: userId }
          }
        });
      }

      res.status(200).json({
        success: true,
        profile: {
          ...profile,
          distance,
          // Don't expose sensitive information
          latitude: undefined,
          longitude: undefined,
          user: {
            ...profile.user,
            phoneNumber: undefined
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get match preferences
router.get('/:userId/preferences',
  authenticate,
  requireVerified,
  [
    param('userId').isUUID().withMessage('Valid user ID is required')
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const currentUserId = req.user?.id;

      // Only allow users to view their own preferences
      if (currentUserId !== userId) {
        throw new AppError('Access denied', 403);
      }

      const profile = await prisma.profile.findUnique({
        where: { userId },
        include: {
          preferences: true
        }
      });

      if (!profile) {
        throw new AppError('Profile not found', 404);
      }

      res.status(200).json({
        success: true,
        preferences: profile.preferences
      });
    } catch (error) {
      next(error);
    }
  }
);

// Update match preferences
router.put('/:userId/preferences',
  authenticate,
  requireVerified,
  [
    param('userId').isUUID().withMessage('Valid user ID is required'),
    body('minAge')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Min age must be between 1 and 100'),
    body('maxAge')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Max age must be between 1 and 100'),
    body('maxDistance')
      .optional()
      .isInt({ min: 1, max: 500 })
      .withMessage('Max distance must be between 1 and 500 km'),
    body('genderPreference')
      .optional()
      .isIn(['MALE', 'FEMALE', 'ALL'])
      .withMessage('Invalid gender preference')
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const currentUserId = req.user?.id;

      // Only allow users to update their own preferences
      if (currentUserId !== userId) {
        throw new AppError('Access denied', 403);
      }

      const profile = await prisma.profile.findUnique({
        where: { userId },
        include: { preferences: true }
      });

      if (!profile) {
        throw new AppError('Profile not found', 404);
      }

      const { minAge, maxAge, maxDistance, genderPreference } = req.body;

      // Validate age range
      if (minAge && maxAge && minAge > maxAge) {
        throw new AppError('Min age cannot be greater than max age', 400);
      }

      const updatedPreferences = await prisma.matchPreference.upsert({
        where: { profileId: profile.id },
        update: {
          ...(minAge !== undefined && { minAge }),
          ...(maxAge !== undefined && { maxAge }),
          ...(maxDistance !== undefined && { maxDistance }),
          ...(genderPreference && { genderPreference: genderPreference as GenderPreference })
        },
        create: {
          profileId: profile.id,
          minAge: minAge || 18,
          maxAge: maxAge || 100,
          maxDistance: maxDistance || 100,
          genderPreference: (genderPreference as GenderPreference) || GenderPreference.ALL
        }
      });

      res.status(200).json({
        success: true,
        preferences: updatedPreferences
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get available interests
router.get('/interests/all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const interests = await prisma.interest.findMany({
      orderBy: { name: 'asc' },
      take: 100 // Limit to prevent large responses
    });

    res.status(200).json({
      success: true,
      interests
    });
  } catch (error) {
    next(error);
  }
});

// Search profiles
router.get('/search/profiles',
  authenticate,
  requireVerified,
  [
    query('query')
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage('Search query must be between 1 and 100 characters'),
    query('minAge')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Min age must be between 1 and 100'),
    query('maxAge')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Max age must be between 1 and 100'),
    query('maxDistance')
      .optional()
      .isInt({ min: 1, max: 500 })
      .withMessage('Max distance must be between 1 and 500 km'),
    query('interests')
      .optional()
      .custom((value) => {
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed);
          } catch {
            return false;
          }
        }
        return Array.isArray(value);
      })
      .withMessage('Interests must be an array'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50')
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const currentUserId = req.user?.id;
      const {
        query: searchQuery,
        minAge,
        maxAge,
        maxDistance,
        interests: interestsParam,
        page = 1,
        limit = 20
      } = req.query;

      const offset = (Number(page) - 1) * Number(limit);

      // Get current user's location for distance calculation
      const currentUserProfile = await prisma.profile.findUnique({
        where: { userId: currentUserId },
        select: { latitude: true, longitude: true }
      });

      const whereClause: any = {
        userId: { not: currentUserId },
        isDiscoverable: true
      };

      // Add search query filter
      if (searchQuery) {
        whereClause.OR = [
          { firstName: { contains: searchQuery as string, mode: 'insensitive' } },
          { occupation: { contains: searchQuery as string, mode: 'insensitive' } },
          { bio: { contains: searchQuery as string, mode: 'insensitive' } }
        ];
      }

      // Add age filters
      if (minAge || maxAge) {
        const now = new Date();
        if (maxAge) {
          const minBirthDate = new Date(now.getFullYear() - Number(maxAge) - 1, now.getMonth(), now.getDate());
          whereClause.dateOfBirth = { gte: minBirthDate };
        }
        if (minAge) {
          const maxBirthDate = new Date(now.getFullYear() - Number(minAge), now.getMonth(), now.getDate());
          whereClause.dateOfBirth = {
            ...whereClause.dateOfBirth,
            lte: maxBirthDate
          };
        }
      }

      // Add interests filter
      if (interestsParam) {
        const interests = typeof interestsParam === 'string' 
          ? JSON.parse(interestsParam as string) 
          : interestsParam;
        
        if (Array.isArray(interests) && interests.length > 0) {
          whereClause.interests = {
            some: {
              name: { in: interests }
            }
          };
        }
      }

      const profiles = await prisma.profile.findMany({
        where: whereClause,
        include: {
          photos: {
            orderBy: { order: 'asc' },
            take: 1 // Only get primary photo for search results
          },
          interests: true,
          user: {
            select: {
              id: true,
              isVerified: true,
              createdAt: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: Number(limit)
      });

      // Calculate distances and filter by maxDistance if specified
      const profilesWithDistance = profiles
        .map(profile => {
          let distance: number | null = null;
          
          if (
            profile.latitude && 
            profile.longitude && 
            currentUserProfile?.latitude && 
            currentUserProfile?.longitude
          ) {
            distance = calculateDistance(
              profile.latitude,
              profile.longitude,
              currentUserProfile.latitude,
              currentUserProfile.longitude
            );
          }

          return {
            ...profile,
            distance,
            // Remove sensitive data
            latitude: undefined,
            longitude: undefined
          };
        })
        .filter(profile => {
          if (maxDistance && profile.distance !== null) {
            return profile.distance <= Number(maxDistance);
          }
          return true;
        });

      const totalCount = await prisma.profile.count({ where: whereClause });

      res.status(200).json({
        success: true,
        profiles: profilesWithDistance,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: totalCount,
          totalPages: Math.ceil(totalCount / Number(limit))
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Helper function to calculate distance between two points
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in kilometers
  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

export default router;