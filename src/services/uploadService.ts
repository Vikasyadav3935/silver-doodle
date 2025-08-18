import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { Request } from 'express';
import { prisma } from '@/server';
import { AppError } from '@/utils/AppError';
import { logger } from '@/utils/logger';
import { ActivityType } from '@prisma/client';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer configuration for memory storage
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // Check file type
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new AppError('Only image and video files are allowed', 400));
    }
  }
});

export class UploadService {
  async uploadProfilePhoto(userId: string, file: Express.Multer.File, isPrimary: boolean = false) {
    try {
      // Get user profile
      const profile = await prisma.profile.findUnique({
        where: { userId },
        include: { photos: true }
      });

      if (!profile) {
        throw new AppError('Profile not found', 404);
      }

      // Check photo limit (max 6 photos)
      if (profile.photos.length >= 6) {
        throw new AppError('Maximum 6 photos allowed', 400);
      }

      // Upload to Cloudinary
      const uploadResult = await this.uploadToCloudinary(file, 'profile_photos');

      // If this is set as primary, remove primary flag from other photos
      if (isPrimary) {
        await prisma.photo.updateMany({
          where: { profileId: profile.id },
          data: { isPrimary: false }
        });
      } else if (profile.photos.length === 0) {
        // If this is the first photo, make it primary
        isPrimary = true;
      }

      // Save photo to database
      const photo = await prisma.photo.create({
        data: {
          profileId: profile.id,
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
          isPrimary,
          order: profile.photos.length + 1
        }
      });

      // Update profile completeness
      const updatedCompleteness = this.calculateProfileCompleteness(profile, profile.photos.length + 1);
      await prisma.profile.update({
        where: { id: profile.id },
        data: { profileCompleteness: updatedCompleteness }
      });

      // Log activity
      await prisma.userActivity.create({
        data: {
          userId,
          type: ActivityType.PHOTO_UPLOAD,
          data: { photoId: photo.id, isPrimary }
        }
      });

      logger.info(`Photo uploaded for user ${userId}: ${photo.id}`);

      return {
        success: true,
        photo: {
          id: photo.id,
          url: photo.url,
          isPrimary: photo.isPrimary,
          order: photo.order
        }
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error uploading profile photo:', error);
      throw new AppError('Failed to upload photo', 500);
    }
  }

  async deleteProfilePhoto(userId: string, photoId: string) {
    try {
      const profile = await prisma.profile.findUnique({
        where: { userId },
        include: { photos: true }
      });

      if (!profile) {
        throw new AppError('Profile not found', 404);
      }

      const photo = profile.photos.find(p => p.id === photoId);
      if (!photo) {
        throw new AppError('Photo not found', 404);
      }

      // Delete from Cloudinary
      await cloudinary.uploader.destroy(photo.publicId);

      // Delete from database
      await prisma.photo.delete({
        where: { id: photoId }
      });

      // If deleted photo was primary, make another photo primary
      if (photo.isPrimary && profile.photos.length > 1) {
        const remainingPhotos = profile.photos.filter(p => p.id !== photoId);
        if (remainingPhotos.length > 0) {
          await prisma.photo.update({
            where: { id: remainingPhotos[0].id },
            data: { isPrimary: true }
          });
        }
      }

      // Reorder remaining photos
      const remainingPhotos = await prisma.photo.findMany({
        where: { profileId: profile.id },
        orderBy: { order: 'asc' }
      });

      await Promise.all(
        remainingPhotos.map((photo, index) =>
          prisma.photo.update({
            where: { id: photo.id },
            data: { order: index + 1 }
          })
        )
      );

      // Update profile completeness
      const updatedCompleteness = this.calculateProfileCompleteness(profile, remainingPhotos.length);
      await prisma.profile.update({
        where: { id: profile.id },
        data: { profileCompleteness: updatedCompleteness }
      });

      logger.info(`Photo deleted for user ${userId}: ${photoId}`);

      return {
        success: true,
        message: 'Photo deleted successfully'
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error deleting profile photo:', error);
      throw new AppError('Failed to delete photo', 500);
    }
  }

  async reorderPhotos(userId: string, photoIds: string[]) {
    try {
      const profile = await prisma.profile.findUnique({
        where: { userId },
        include: { photos: true }
      });

      if (!profile) {
        throw new AppError('Profile not found', 404);
      }

      // Validate that all photo IDs belong to the user
      const userPhotoIds = profile.photos.map(p => p.id);
      const invalidIds = photoIds.filter(id => !userPhotoIds.includes(id));
      
      if (invalidIds.length > 0) {
        throw new AppError('Some photos do not belong to this user', 400);
      }

      if (photoIds.length !== profile.photos.length) {
        throw new AppError('Must include all photos in reorder', 400);
      }

      // Update order for each photo
      await Promise.all(
        photoIds.map((photoId, index) =>
          prisma.photo.update({
            where: { id: photoId },
            data: { order: index + 1 }
          })
        )
      );

      logger.info(`Photos reordered for user ${userId}`);

      return {
        success: true,
        message: 'Photos reordered successfully'
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error reordering photos:', error);
      throw new AppError('Failed to reorder photos', 500);
    }
  }

  async setPrimaryPhoto(userId: string, photoId: string) {
    try {
      const profile = await prisma.profile.findUnique({
        where: { userId },
        include: { photos: true }
      });

      if (!profile) {
        throw new AppError('Profile not found', 404);
      }

      const photo = profile.photos.find(p => p.id === photoId);
      if (!photo) {
        throw new AppError('Photo not found', 404);
      }

      // Remove primary flag from all photos
      await prisma.photo.updateMany({
        where: { profileId: profile.id },
        data: { isPrimary: false }
      });

      // Set new primary photo
      await prisma.photo.update({
        where: { id: photoId },
        data: { isPrimary: true }
      });

      logger.info(`Primary photo set for user ${userId}: ${photoId}`);

      return {
        success: true,
        message: 'Primary photo updated successfully'
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error setting primary photo:', error);
      throw new AppError('Failed to set primary photo', 500);
    }
  }

  async uploadChatMedia(userId: string, file: Express.Multer.File) {
    try {
      // Determine folder based on file type
      const folder = file.mimetype.startsWith('image/') ? 'chat_images' : 'chat_videos';
      
      // Upload to Cloudinary
      const uploadResult = await this.uploadToCloudinary(file, folder);

      logger.info(`Chat media uploaded for user ${userId}`);

      return {
        success: true,
        media: {
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
          mediaType: file.mimetype,
          size: file.size
        }
      };
    } catch (error) {
      logger.error('Error uploading chat media:', error);
      throw new AppError('Failed to upload media', 500);
    }
  }

  private async uploadToCloudinary(file: Express.Multer.File, folder: string) {
    return new Promise<Record<string, any>>((resolve, reject) => {
      const options: Record<string, any> = {
        folder: folder,
        resource_type: 'auto',
        quality: 'auto:good',
        fetch_format: 'auto'
      };

      // Additional options for images
      if (file.mimetype.startsWith('image/')) {
        options.transformation = [
          { width: 1080, height: 1080, crop: 'limit' },
          { quality: 'auto:good' },
          { fetch_format: 'auto' }
        ];
      }

      // Additional options for videos
      if (file.mimetype.startsWith('video/')) {
        options.video = {
          width: 720,
          height: 720,
          crop: 'limit',
          quality: 'auto:good'
        };
      }

      cloudinary.uploader.upload_stream(
        options,
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result || {});
          }
        }
      ).end(file.buffer);
    });
  }

  private calculateProfileCompleteness(profile: Record<string, any>, photoCount: number): number {
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

    // Check basic fields
    fields.forEach(field => {
      if (profile[field]) {
        completeness += 100 / totalFields;
      }
    });

    // Check photos (at least 2 photos for full points)
    if (photoCount > 0) {
      const photoScore = Math.min(photoCount / 2, 1) * (100 / totalFields);
      completeness += photoScore;
    }

    // Check interests (this would need to be passed in or queried)
    // For now, assume some points for interests
    completeness += 100 / totalFields / 2; // Half points for interests

    return Math.round(completeness);
  }

  async getUploadStats(userId: string) {
    try {
      const profile = await prisma.profile.findUnique({
        where: { userId },
        include: { photos: true }
      });

      if (!profile) {
        throw new AppError('Profile not found', 404);
      }

      return {
        success: true,
        stats: {
          photoCount: profile.photos.length,
          maxPhotos: 6,
          hasProfilePhoto: profile.photos.some(p => p.isPrimary),
          profileCompleteness: profile.profileCompleteness
        }
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error getting upload stats:', error);
      throw new AppError('Failed to get upload stats', 500);
    }
  }
}