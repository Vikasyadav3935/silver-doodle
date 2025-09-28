import { prisma } from '@/server';
import { AppError } from '@/utils/AppError';
import { logger } from '@/utils/logger';
import { Gender, GenderPreference, QuestionType, ActivityType } from '@prisma/client';
import { AuditLogService, AuditEventType } from './auditLogService';

export class UserService {
  async getUserProfile(userId: string, requestingUserId?: string, includePrivateData: boolean = false) {
    try {
      // Check if requesting user is accessing their own profile
      const isOwnProfile = userId === requestingUserId;
      
      // Define what data to select based on ownership and privacy settings
      const selectFields = isOwnProfile || includePrivateData ? {
        id: true,
        phoneNumber: true,
        email: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
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
      } : {
        // Limited data for non-owners
        id: true,
        isVerified: true,
        profile: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            bio: true,
            occupation: true,
            education: true,
            height: true,
            city: true,
            country: true,
            isVerified: true,
            profileCompleteness: true,
            photos: {
              where: { isPrimary: true },
              take: 3,
              orderBy: { order: 'asc' }
            },
            interests: {
              select: {
                id: true,
                name: true,
                category: true
              }
            }
          }
        }
      };

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: selectFields
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Log profile access for audit
      if (requestingUserId && !isOwnProfile) {
        await AuditLogService.getInstance().logEvent({
          eventType: AuditEventType.PROFILE_VIEWED,
          userId: requestingUserId,
          targetUserId: userId,
          resourceType: 'user_profile',
          resourceId: userId,
          severity: 'LOW'
        });
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

      // Age validation removed - users can be any age

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
          minAge: 1,
          maxAge: 100,
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

  async deleteUser(userId: string, requestingUserId: string, isAdminAction: boolean = false) {
    try {
      // Verify resource ownership unless it's an admin action
      if (!isAdminAction && userId !== requestingUserId) {
        throw new AppError('Access denied: Can only delete your own account', 403);
      }

      // Check if user exists
      const userExists = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, phoneNumber: true }
      });

      if (!userExists) {
        throw new AppError('User not found', 404);
      }

      // Log the deletion attempt
      await AuditLogService.getInstance().logEvent({
        eventType: AuditEventType.USER_DELETED,
        userId: requestingUserId,
        targetUserId: userId !== requestingUserId ? userId : undefined,
        resourceType: 'user_account',
        resourceId: userId,
        details: { 
          isAdminAction,
          phoneNumber: userExists.phoneNumber 
        },
        severity: 'HIGH'
      });

      // Perform deletion with transaction for data integrity
      await prisma.$transaction(async (tx) => {
        // Soft delete approach - mark as deleted instead of hard delete
        // This preserves data integrity for audit purposes
        await tx.user.update({
          where: { id: userId },
          data: {
            phoneNumber: `deleted_${Date.now()}_${userExists.phoneNumber}`,
            email: null,
            isVerified: false
          }
        });

        // Update profile to mark as deleted
        await tx.profile.updateMany({
          where: { userId },
          data: {
            firstName: 'Deleted User',
            lastName: null,
            bio: null,
            isDiscoverable: false
          }
        });

        // Note: In a real scenario, you might want to implement a cleanup job
        // that runs periodically to permanently delete data after retention period
      });

      logger.info(`User deleted: ${userId} by ${requestingUserId}`, {
        deletedUserId: userId,
        requestingUserId,
        isAdminAction
      });

      return {
        success: true,
        message: 'User account deleted successfully'
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
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

  async getAllUsers(currentUserId: string, limit: number = 20, offset: number = 0) {
    try {
      // Limit the maximum number of users that can be fetched at once
      const maxLimit = 50;
      const safeLimit = Math.min(limit, maxLimit);

      const users = await prisma.user.findMany({
        where: {
          id: { not: currentUserId },
          profile: {
            isNot: null,
            is: {
              isDiscoverable: true // Only show discoverable profiles
            }
          },
          phoneNumber: { not: { startsWith: 'deleted_' } } // Exclude soft-deleted users
        },
        select: {
          id: true,
          isVerified: true,
          profile: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              bio: true,
              dateOfBirth: true, // We'll calculate age from this
              city: true,
              profileCompleteness: true,
              photos: {
                where: { isPrimary: true },
                take: 1,
                select: {
                  id: true,
                  url: true,
                  isPrimary: true
                }
              }
            }
          }
        },
        skip: offset,
        take: safeLimit,
        orderBy: { createdAt: 'desc' }
      });

      const formattedUsers = users.map(user => {
        // Calculate age from dateOfBirth
        let age: number | null = null;
        if (user.profile?.dateOfBirth) {
          const today = new Date();
          const birthDate = new Date(user.profile.dateOfBirth);
          age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
        }

        return {
          id: user.id,
          isVerified: user.isVerified,
          profile: user.profile ? {
            id: user.profile.id,
            firstName: user.profile.firstName,
            lastName: user.profile.lastName,
            bio: user.profile.bio?.substring(0, 100) + (user.profile.bio && user.profile.bio.length > 100 ? '...' : ''), // Truncate bio
            age, // Show calculated age instead of birth date
            city: user.profile.city,
            profileCompleteness: user.profile.profileCompleteness,
            photos: user.profile.photos || []
          } : null
        };
      }).filter(user => user.profile !== null); // Remove users without profiles

      // Log bulk data access for audit
      await AuditLogService.getInstance().logEvent({
        eventType: AuditEventType.BULK_DATA_ACCESS,
        userId: currentUserId,
        resourceType: 'user_profiles',
        details: { 
          recordCount: formattedUsers.length,
          limit: safeLimit,
          offset 
        },
        severity: 'MEDIUM'
      });

      return {
        success: true,
        users: formattedUsers,
        total: formattedUsers.length,
        hasMore: formattedUsers.length === safeLimit
      };
    } catch (error) {
      logger.error('Error fetching all users:', error);
      throw new AppError('Failed to fetch users', 500);
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