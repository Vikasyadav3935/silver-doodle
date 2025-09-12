import AWS from 'aws-sdk';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME!;
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN!;

export interface S3UploadResult {
  key: string;
  url: string;
  cloudFrontUrl: string;
}

export interface UploadOptions {
  folder?: string;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

class S3Service {
  /**
   * Upload image to S3 with automatic compression and optimization
   */
  async uploadImage(
    buffer: Buffer,
    originalName: string,
    options: UploadOptions = {}
  ): Promise<S3UploadResult> {
    try {
      const {
        folder = 'uploads',
        maxWidth = 1080,
        maxHeight = 1080,
        quality = 85
      } = options;

      // Generate unique filename
      const fileExtension = originalName.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${uuidv4()}.${fileExtension}`;
      const key = `${folder}/${fileName}`;

      // Optimize image using Sharp
      const optimizedBuffer = await sharp(buffer)
        .resize(maxWidth, maxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality })
        .toBuffer();

      // Upload to S3
      const uploadParams = {
        Bucket: BUCKET_NAME,
        Key: key,
        Body: optimizedBuffer,
        ContentType: `image/${fileExtension === 'png' ? 'png' : 'jpeg'}`,
        CacheControl: 'max-age=31536000' // 1 year cache
      };

      const result = await s3.upload(uploadParams).promise();

      return {
        key,
        url: result.Location,
        cloudFrontUrl: `https://${CLOUDFRONT_DOMAIN}/${key}`
      };
    } catch (error) {
      console.error('S3 upload error:', error);
      throw new Error(`Failed to upload image to S3: ${error}`);
    }
  }

  /**
   * Upload profile photo with specific optimizations
   */
  async uploadProfilePhoto(
    buffer: Buffer,
    originalName: string,
    userId: string
  ): Promise<S3UploadResult> {
    return this.uploadImage(buffer, originalName, {
      folder: `profile-photos/${userId}`,
      maxWidth: 1080,
      maxHeight: 1080,
      quality: 90
    });
  }

  /**
   * Upload chat media (images)
   */
  async uploadChatImage(
    buffer: Buffer,
    originalName: string,
    conversationId: string
  ): Promise<S3UploadResult> {
    return this.uploadImage(buffer, originalName, {
      folder: `chat-media/${conversationId}`,
      maxWidth: 1080,
      maxHeight: 1080,
      quality: 85
    });
  }

  /**
   * Upload video to S3 (no compression, just upload)
   */
  async uploadVideo(
    buffer: Buffer,
    originalName: string,
    options: UploadOptions = {}
  ): Promise<S3UploadResult> {
    try {
      const { folder = 'videos' } = options;
      
      const fileExtension = originalName.split('.').pop()?.toLowerCase() || 'mp4';
      const fileName = `${uuidv4()}.${fileExtension}`;
      const key = `${folder}/${fileName}`;

      const uploadParams = {
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: `video/${fileExtension}`,
        CacheControl: 'max-age=31536000'
      };

      const result = await s3.upload(uploadParams).promise();

      return {
        key,
        url: result.Location,
        cloudFrontUrl: `https://${CLOUDFRONT_DOMAIN}/${key}`
      };
    } catch (error) {
      console.error('S3 video upload error:', error);
      throw new Error(`Failed to upload video to S3: ${error}`);
    }
  }

  /**
   * Upload chat video
   */
  async uploadChatVideo(
    buffer: Buffer,
    originalName: string,
    conversationId: string
  ): Promise<S3UploadResult> {
    return this.uploadVideo(buffer, originalName, {
      folder: `chat-videos/${conversationId}`
    });
  }

  /**
   * Delete file from S3
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const deleteParams = {
        Bucket: BUCKET_NAME,
        Key: key
      };

      await s3.deleteObject(deleteParams).promise();
    } catch (error) {
      console.error('S3 delete error:', error);
      throw new Error(`Failed to delete file from S3: ${error}`);
    }
  }

  /**
   * Generate presigned URL for direct client uploads
   */
  async generatePresignedUrl(
    key: string,
    contentType: string,
    expiresIn: number = 3600
  ): Promise<string> {
    try {
      const params = {
        Bucket: BUCKET_NAME,
        Key: key,
        ContentType: contentType,
        Expires: expiresIn
      };

      return s3.getSignedUrl('putObject', params);
    } catch (error) {
      console.error('Presigned URL error:', error);
      throw new Error(`Failed to generate presigned URL: ${error}`);
    }
  }

  /**
   * Generate presigned URL for profile photo upload
   */
  async generateProfilePhotoPresignedUrl(
    userId: string,
    fileName: string,
    contentType: string
  ): Promise<{ uploadUrl: string; key: string; cloudFrontUrl: string }> {
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'jpg';
    const uniqueFileName = `${uuidv4()}.${fileExtension}`;
    const key = `profile-photos/${userId}/${uniqueFileName}`;

    const uploadUrl = await this.generatePresignedUrl(key, contentType);

    return {
      uploadUrl,
      key,
      cloudFrontUrl: `https://${CLOUDFRONT_DOMAIN}/${key}`
    };
  }

  /**
   * Batch upload multiple images
   */
  async batchUploadImages(
    files: Array<{ buffer: Buffer; originalName: string }>,
    options: UploadOptions = {}
  ): Promise<S3UploadResult[]> {
    const uploadPromises = files.map(file =>
      this.uploadImage(file.buffer, file.originalName, options)
    );

    return Promise.all(uploadPromises);
  }

  /**
   * Get CloudFront URL from S3 key
   */
  getCloudFrontUrl(key: string): string {
    return `https://${CLOUDFRONT_DOMAIN}/${key}`;
  }

  /**
   * Extract S3 key from CloudFront URL
   */
  extractKeyFromUrl(url: string): string {
    if (url.includes(CLOUDFRONT_DOMAIN)) {
      return url.split(`${CLOUDFRONT_DOMAIN}/`)[1];
    }
    if (url.includes('amazonaws.com')) {
      return url.split(`${BUCKET_NAME}/`)[1];
    }
    return url;
  }

  /**
   * Convert S3 direct URL to CloudFront URL
   */
  convertToCloudFrontUrl(url: string): string {
    if (!url) return url;
    
    // If already a CloudFront URL, return as is
    if (url.includes(CLOUDFRONT_DOMAIN)) {
      return url;
    }
    
    // If it's an S3 direct URL, convert to CloudFront
    if (url.includes('amazonaws.com')) {
      const key = url.split(`${BUCKET_NAME}/`)[1];
      return `https://${CLOUDFRONT_DOMAIN}/${key}`;
    }
    
    return url;
  }
}

export default new S3Service();