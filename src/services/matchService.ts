import { prisma } from '@/server';
import { AppError } from '@/utils/AppError';
import { logger } from '@/utils/logger';
import { ActivityType, Gender, GenderPreference } from '@prisma/client';
import { PersonalityService } from './personalityService';

interface DiscoveryFilters {
  minAge?: number;
  maxAge?: number;
  maxDistance?: number;
  excludeUserIds?: string[];
}

export class MatchService {
  private personalityService: PersonalityService;

  constructor() {
    this.personalityService = new PersonalityService();
  }
  async getDiscoveryProfiles(userId: string, limit: number = 10, filters?: DiscoveryFilters) {
    try {
      // Get current user's profile and preferences
      const currentUser = await prisma.profile.findUnique({
        where: { userId },
        include: {
          preferences: true,
          interests: true
        }
      });

      if (!currentUser) {
        throw new AppError('Profile not found', 404);
      }

      if (!currentUser.isDiscoverable) {
        throw new AppError('Discovery is disabled', 400);
      }

      const preferences = currentUser.preferences;
      if (!preferences) {
        throw new AppError('Match preferences not set', 400);
      }

      // Get users that current user has already interacted with
      const [likedUsers, passedUsers, blockedUsers] = await Promise.all([
        prisma.like.findMany({
          where: { senderId: userId },
          select: { receiverId: true }
        }),
        prisma.pass.findMany({
          where: { senderId: userId },
          select: { receiverId: true }
        }),
        prisma.block.findMany({
          where: { senderId: userId },
          select: { receiverId: true }
        })
      ]);

      const excludedUserIds = [
        userId,
        ...likedUsers.map(l => l.receiverId),
        ...passedUsers.map(p => p.receiverId),
        ...blockedUsers.map(b => b.receiverId),
        ...(filters?.excludeUserIds || [])
      ];

      // Build query conditions
      const whereConditions: any = {
        userId: { notIn: excludedUserIds },
        isDiscoverable: true
      };

      // Gender preference filter
      if (preferences.genderPreference !== GenderPreference.ALL) {
        whereConditions.gender = preferences.genderPreference === GenderPreference.MALE 
          ? Gender.MALE 
          : Gender.FEMALE;
      }

      // Age filter
      const now = new Date();
      const minBirthDate = new Date(now.getFullYear() - preferences.maxAge - 1, now.getMonth(), now.getDate());
      const maxBirthDate = new Date(now.getFullYear() - preferences.minAge, now.getMonth(), now.getDate());
      
      whereConditions.dateOfBirth = {
        gte: minBirthDate,
        lte: maxBirthDate
      };

      // Additional filters
      if (filters?.minAge || filters?.maxAge) {
        if (filters.maxAge) {
          const filterMinBirth = new Date(now.getFullYear() - filters.maxAge - 1, now.getMonth(), now.getDate());
          whereConditions.dateOfBirth.gte = filterMinBirth;
        }
        if (filters.minAge) {
          const filterMaxBirth = new Date(now.getFullYear() - filters.minAge, now.getMonth(), now.getDate());
          whereConditions.dateOfBirth.lte = filterMaxBirth;
        }
      }

      // Get potential matches
      const potentialMatches = await prisma.profile.findMany({
        where: whereConditions,
        include: {
          photos: {
            orderBy: { order: 'asc' }
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
        take: limit * 3 // Get more to filter by distance and calculate compatibility
      });

      // Calculate compatibility scores and filter by distance
      const profilesWithScores = await Promise.all(
        potentialMatches.map(async (profile) => {
          let compatibility = 50; // Default compatibility score
          
          // Try to get personality-based compatibility score
          try {
            const personalityCompatibility = await this.personalityService.calculateCompatibility(
              currentUser.userId, 
              profile.userId
            );
            if (personalityCompatibility.success && personalityCompatibility.compatibilityScore) {
              compatibility = personalityCompatibility.compatibilityScore.overallScore;
            } else {
              // Fallback to basic compatibility if personality scores aren't available
              compatibility = await this.calculateBasicCompatibility(currentUser, profile);
            }
          } catch (error) {
            // Fallback to basic compatibility if personality calculation fails
            compatibility = await this.calculateBasicCompatibility(currentUser, profile);
          }
          
          let distance: number | null = null;

          // Calculate distance if both profiles have location
          if (
            currentUser.latitude && 
            currentUser.longitude && 
            profile.latitude && 
            profile.longitude
          ) {
            distance = this.calculateDistance(
              currentUser.latitude,
              currentUser.longitude,
              profile.latitude,
              profile.longitude
            );
          }

          return {
            ...profile,
            compatibility,
            distance,
            // Remove sensitive data
            latitude: undefined,
            longitude: undefined
          };
        })
      );

      // Filter by distance if specified
      const filteredProfiles = profilesWithScores.filter(profile => {
        if (filters?.maxDistance && profile.distance !== null) {
          return profile.distance <= filters.maxDistance;
        }
        if (preferences.maxDistance && profile.distance !== null) {
          return profile.distance <= preferences.maxDistance;
        }
        return true;
      });

      // Sort by compatibility score and limit results
      const sortedProfiles = filteredProfiles
        .sort((a, b) => b.compatibility - a.compatibility)
        .slice(0, limit);

      return {
        success: true,
        profiles: sortedProfiles,
        total: sortedProfiles.length
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error getting discovery profiles:', error);
      throw new AppError('Failed to get discovery profiles', 500);
    }
  }

  async likeProfile(senderId: string, receiverId: string) {
    try {
      if (senderId === receiverId) {
        throw new AppError('Cannot like your own profile', 400);
      }

      // Check if already liked
      const existingLike = await prisma.like.findUnique({
        where: {
          senderId_receiverId: {
            senderId,
            receiverId
          }
        }
      });

      if (existingLike) {
        throw new AppError('Profile already liked', 400);
      }

      // Check for blocks
      const isBlocked = await this.checkIfBlocked(senderId, receiverId);
      if (isBlocked) {
        throw new AppError('Cannot like this profile', 400);
      }

      // Create like
      await prisma.like.create({
        data: {
          senderId,
          receiverId
        }
      });

      // Check if it's a match (mutual like)
      const mutualLike = await prisma.like.findUnique({
        where: {
          senderId_receiverId: {
            senderId: receiverId,
            receiverId: senderId
          }
        }
      });

      let isMatch = false;
      let matchData = null;
      if (mutualLike) {
        // Create match
        const [user1Id, user2Id] = [senderId, receiverId].sort();
        
        const match = await prisma.match.create({
          data: {
            user1Id,
            user2Id
          }
        });

        // Create conversation
        const conversation = await prisma.conversation.create({
          data: {
            matchId: match.id,
            user1Id,
            user2Id
          }
        });

        isMatch = true;
        matchData = {
          id: match.id,
          conversationId: conversation.id
        };

        // Log match activity for both users
        await Promise.all([
          prisma.userActivity.create({
            data: {
              userId: senderId,
              type: ActivityType.MATCH_CREATED,
              data: { matchedUserId: receiverId }
            }
          }),
          prisma.userActivity.create({
            data: {
              userId: receiverId,
              type: ActivityType.MATCH_CREATED,
              data: { matchedUserId: senderId }
            }
          })
        ]);
      }

      // Log like activity
      await prisma.userActivity.create({
        data: {
          userId: senderId,
          type: ActivityType.LIKE_SENT,
          data: { likedUserId: receiverId }
        }
      });

      return {
        success: true,
        isMatch,
        match: matchData,
        message: isMatch ? 'It\'s a match!' : 'Like sent successfully'
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error liking profile:', error);
      throw new AppError('Failed to like profile', 500);
    }
  }

  async passProfile(senderId: string, receiverId: string) {
    try {
      if (senderId === receiverId) {
        throw new AppError('Cannot pass your own profile', 400);
      }

      // Check if already passed
      const existingPass = await prisma.pass.findUnique({
        where: {
          senderId_receiverId: {
            senderId,
            receiverId
          }
        }
      });

      if (existingPass) {
        return { success: true, message: 'Profile already passed' };
      }

      // Create pass
      await prisma.pass.create({
        data: {
          senderId,
          receiverId
        }
      });

      return {
        success: true,
        message: 'Profile passed successfully'
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error passing profile:', error);
      throw new AppError('Failed to pass profile', 500);
    }
  }

  async superLike(senderId: string, receiverId: string) {
    try {
      if (senderId === receiverId) {
        throw new AppError('Cannot super like your own profile', 400);
      }

      // Check if already super liked
      const existingSuperLike = await prisma.superLike.findUnique({
        where: {
          senderId_receiverId: {
            senderId,
            receiverId
          }
        }
      });

      if (existingSuperLike) {
        throw new AppError('Profile already super liked', 400);
      }

      // Check for blocks
      const isBlocked = await this.checkIfBlocked(senderId, receiverId);
      if (isBlocked) {
        throw new AppError('Cannot super like this profile', 400);
      }

      // Check if user has super likes remaining (premium feature check would go here)
      
      // Create super like
      await prisma.superLike.create({
        data: {
          senderId,
          receiverId
        }
      });

      // Also create a regular like
      const likeExists = await prisma.like.findUnique({
        where: {
          senderId_receiverId: {
            senderId,
            receiverId
          }
        }
      });

      if (!likeExists) {
        await prisma.like.create({
          data: {
            senderId,
            receiverId
          }
        });
      }

      // Log activity
      await prisma.userActivity.create({
        data: {
          userId: senderId,
          type: ActivityType.SUPER_LIKE_SENT,
          data: { superLikedUserId: receiverId }
        }
      });

      return {
        success: true,
        isMatch: false, // Super likes don't create immediate matches
        match: null,
        message: 'Super like sent successfully'
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error super liking profile:', error);
      throw new AppError('Failed to send super like', 500);
    }
  }

  async getWhoLikedYou(userId: string, limit: number = 20, offset: number = 0) {
    try {
      const likes = await prisma.like.findMany({
        where: { receiverId: userId },
        include: {
          sender: {
            include: {
              profile: {
                include: {
                  photos: {
                    where: { isPrimary: true },
                    take: 1
                  },
                  interests: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      });

      const profiles = likes
        .filter(like => like.sender.profile)
        .map(like => ({
          ...like.sender.profile,
          likedAt: like.createdAt,
          user: {
            id: like.sender.id,
            isVerified: like.sender.isVerified
          }
        }));

      const total = await prisma.like.count({
        where: { receiverId: userId }
      });

      return {
        success: true,
        profiles,
        total
      };
    } catch (error) {
      logger.error('Error getting who liked you:', error);
      throw new AppError('Failed to get who liked you', 500);
    }
  }

  async getMatches(userId: string, limit: number = 20, offset: number = 0) {
    try {
      const matches = await prisma.match.findMany({
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
          conversation: {
            include: {
              messages: {
                orderBy: { createdAt: 'desc' },
                take: 1
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      });

      const formattedMatches = matches.map(match => {
        const otherUser = match.user1Id === userId ? match.user2 : match.user1;
        const lastMessage = match.conversation?.messages[0];

        return {
          id: match.id,
          user: {
            id: otherUser.id,
            profile: otherUser.profile
          },
          matchedAt: match.createdAt,
          conversation: match.conversation ? {
            id: match.conversation.id,
            lastMessage: lastMessage ? {
              id: lastMessage.id,
              content: lastMessage.content,
              messageType: lastMessage.messageType,
              createdAt: lastMessage.createdAt,
              senderId: lastMessage.senderId
            } : null,
            lastMessageAt: match.conversation.lastMessageAt
          } : null
        };
      });

      const total = await prisma.match.count({
        where: {
          OR: [
            { user1Id: userId },
            { user2Id: userId }
          ]
        }
      });

      return {
        success: true,
        matches: formattedMatches,
        total
      };
    } catch (error) {
      logger.error('Error getting matches:', error);
      throw new AppError('Failed to get matches', 500);
    }
  }

  private async calculateBasicCompatibility(user1: Record<string, any>, user2: Record<string, any>): Promise<number> {
    let score = 0;
    const factors = [];

    // Interest matching (40% of score)
    const user1Interests = user1.interests.map((i: any) => i.name);
    const user2Interests = user2.interests.map((i: any) => i.name);
    const commonInterests = user1Interests.filter((interest: string) => 
      user2Interests.includes(interest)
    );
    
    if (user1Interests.length > 0 && user2Interests.length > 0) {
      const interestScore = (commonInterests.length * 2) / 
        (user1Interests.length + user2Interests.length);
      score += interestScore * 40;
      factors.push({ type: 'interests', score: interestScore * 40 });
    }

    // Age compatibility (20% of score)
    const user1Age = new Date().getFullYear() - new Date(user1.dateOfBirth).getFullYear();
    const user2Age = new Date().getFullYear() - new Date(user2.dateOfBirth).getFullYear();
    const ageDiff = Math.abs(user1Age - user2Age);
    const ageScore = Math.max(0, (10 - ageDiff) / 10) * 20;
    score += ageScore;
    factors.push({ type: 'age', score: ageScore });

    // Education/Career compatibility (20% of score)
    if (user1.education && user2.education) {
      const educationScore = user1.education === user2.education ? 15 : 
        (user1.education.toLowerCase().includes(user2.education.toLowerCase()) || 
         user2.education.toLowerCase().includes(user1.education.toLowerCase())) ? 10 : 5;
      score += educationScore;
      factors.push({ type: 'education', score: educationScore });
    }

    // Profile completeness (10% of score)
    const completenessScore = (user1.profileCompleteness + user2.profileCompleteness) / 20;
    score += completenessScore;
    factors.push({ type: 'completeness', score: completenessScore });

    // Location proximity (10% of score) - calculated elsewhere
    
    return Math.min(100, Math.round(score));
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    return Math.round(distance * 10) / 10;
  }

  private async checkIfBlocked(user1Id: string, user2Id: string): Promise<boolean> {
    const block = await prisma.block.findFirst({
      where: {
        OR: [
          { senderId: user1Id, receiverId: user2Id },
          { senderId: user2Id, receiverId: user1Id }
        ]
      }
    });

    return !!block;
  }
}