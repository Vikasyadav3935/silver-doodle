import { prisma } from '@/server';
import { AppError } from '@/utils/AppError';
import { logger } from '@/utils/logger';
import { Gender, GenderPreference, QuestionType, ActivityType } from '@prisma/client';

export class UserService {
  async getUserProfile(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          profile: {
            include: {
              photos: {
                orderBy: { order: 'asc' }
              },
              interests: true,
              preferences: true,
              answers: {
                include: {
                  question: true
                }
              }
            }
          },
          settings: true
        }
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      return {
        success: true,
        user
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error fetching user profile:', error);
      throw new AppError('Failed to fetch user profile', 500);
    }
  }

  async createProfile(userId: string, profileData: {
    firstName: string;
    lastName?: string;
    email?: string;
    dateOfBirth?: Date;
    gender?: Gender;
    bio?: string;
    occupation?: string;
    company?: string;
    education?: string;
    height?: number;
    interests?: string[];
    latitude?: number;
    longitude?: number;
    city?: string;
    state?: string;
    country?: string;
  }) {
    try {
      // Check if profile already exists
      const existingProfile = await prisma.profile.findUnique({
        where: { userId }
      });

      if (existingProfile) {
        throw new AppError('Profile already exists', 400);
      }

      // Calculate age only if dateOfBirth is provided
      if (profileData.dateOfBirth) {
        const age = new Date().getFullYear() - profileData.dateOfBirth.getFullYear();
        if (age < 18) {
          throw new AppError('You must be at least 18 years old', 400);
        }
      }

      const { interests, email, ...otherData } = profileData;

      // Update user email if provided
      if (email) {
        await prisma.user.update({
          where: { id: userId },
          data: { email }
        });
      }

      // Create profile
      const profile = await prisma.profile.create({
        data: {
          ...otherData,
          userId,
          profileCompleteness: this.calculateProfileCompleteness(profileData)
        }
      });

      // Add interests if provided
      if (interests && interests.length > 0) {
        const interestRecords = await Promise.all(
          interests.map(async (interestName) => {
            let interest = await prisma.interest.findUnique({
              where: { name: interestName }
            });

            if (!interest) {
              interest = await prisma.interest.create({
                data: { name: interestName }
              });
            }

            return interest;
          })
        );

        await prisma.profile.update({
          where: { id: profile.id },
          data: {
            interests: {
              connect: interestRecords.map(interest => ({ id: interest.id }))
            }
          }
        });
      }

      // Create default settings
      await prisma.userSettings.create({
        data: {
          userId
        }
      });

      // Create default match preferences
      await prisma.matchPreference.create({
        data: {
          profileId: profile.id,
          minAge: 18,
          maxAge: 50,
          maxDistance: 50,
          genderPreference: GenderPreference.ALL
        }
      });

      // Log activity
      await prisma.userActivity.create({
        data: {
          userId,
          type: ActivityType.PROFILE_UPDATE,
          data: { action: 'profile_created' }
        }
      });

      logger.info(`Profile created for user: ${userId}`);

      return {
        success: true,
        profile: await prisma.profile.findUnique({
          where: { id: profile.id },
          include: {
            photos: true,
            interests: true,
            preferences: true
          }
        })
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error creating profile:', error);
      throw new AppError('Failed to create profile', 500);
    }
  }

  async updateProfile(userId: string, updates: Record<string, any>) {
    try {
      const profile = await prisma.profile.findUnique({
        where: { userId }
      });

      if (!profile) {
        throw new AppError('Profile not found', 404);
      }

      const { interests, ...otherUpdates } = updates;

      // Update profile
      const updatedProfile = await prisma.profile.update({
        where: { userId },
        data: {
          ...otherUpdates,
          profileCompleteness: this.calculateProfileCompleteness({
            ...profile,
            ...otherUpdates
          })
        }
      });

      // Update interests if provided
      if (interests && Array.isArray(interests)) {
        // Remove all current interests
        await prisma.profile.update({
          where: { id: profile.id },
          data: {
            interests: {
              set: []
            }
          }
        });

        // Add new interests
        const interestRecords = await Promise.all(
          interests.map(async (interestName: string) => {
            let interest = await prisma.interest.findUnique({
              where: { name: interestName }
            });

            if (!interest) {
              interest = await prisma.interest.create({
                data: { name: interestName }
              });
            }

            return interest;
          })
        );

        await prisma.profile.update({
          where: { id: profile.id },
          data: {
            interests: {
              connect: interestRecords.map(interest => ({ id: interest.id }))
            }
          }
        });
      }

      // Log activity
      await prisma.userActivity.create({
        data: {
          userId,
          type: ActivityType.PROFILE_UPDATE,
          data: { updates: Object.keys(updates) }
        }
      });

      return {
        success: true,
        profile: await prisma.profile.findUnique({
          where: { id: updatedProfile.id },
          include: {
            photos: true,
            interests: true,
            preferences: true
          }
        })
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error updating profile:', error);
      throw new AppError('Failed to update profile', 500);
    }
  }

  async updateSettings(userId: string, settings: Record<string, any>) {
    try {
      const updatedSettings = await prisma.userSettings.upsert({
        where: { userId },
        update: settings,
        create: {
          userId,
          ...settings
        }
      });

      return {
        success: true,
        settings: updatedSettings
      };
    } catch (error) {
      logger.error('Error updating settings:', error);
      throw new AppError('Failed to update settings', 500);
    }
  }

  async deleteUser(userId: string) {
    try {
      // Delete user and all related data (cascade will handle most)
      await prisma.user.delete({
        where: { id: userId }
      });

      logger.info(`User deleted: ${userId}`);

      return {
        success: true,
        message: 'User deleted successfully'
      };
    } catch (error) {
      logger.error('Error deleting user:', error);
      throw new AppError('Failed to delete user', 500);
    }
  }

  async getUserStats(userId: string) {
    try {
      const [
        likesReceived,
        likesSent,
        matches,
        conversations
      ] = await Promise.all([
        prisma.like.count({ where: { receiverId: userId } }),
        prisma.like.count({ where: { senderId: userId } }),
        prisma.match.count({
          where: {
            OR: [
              { user1Id: userId },
              { user2Id: userId }
            ]
          }
        }),
        prisma.conversation.count({
          where: {
            OR: [
              { user1Id: userId },
              { user2Id: userId }
            ]
          }
        })
      ]);

      return {
        success: true,
        stats: {
          likesReceived,
          likesSent,
          matches,
          conversations
        }
      };
    } catch (error) {
      logger.error('Error fetching user stats:', error);
      throw new AppError('Failed to fetch user stats', 500);
    }
  }

  private calculateProfileCompleteness(profileData: Record<string, any>): number {
    const fields = [
      'firstName',
      'bio',
      'occupation',
      'education',
      'height',
      'city'
    ];

    let completeness = 0;
    const totalFields = fields.length + 2; // +2 for photos and interests

    fields.forEach(field => {
      if (profileData[field]) {
        completeness += 100 / totalFields;
      }
    });

    // Add points for photos (assumed to be checked elsewhere)
    // completeness += (hasPhotos ? 100 / totalFields : 0);
    
    // Add points for interests (assumed to be checked elsewhere)
    // completeness += (hasInterests ? 100 / totalFields : 0);

    return Math.round(completeness);
  }
}