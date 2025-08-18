import axios from 'axios';
import { logger } from '../utils/logger';
import { AppError } from '../utils/AppError';

export class SmsService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.MERAOTP_API_KEY || '';
    this.baseUrl = 'https://meraotp.com/api/sms';

    if (!this.apiKey) {
      logger.warn('MeraOTP API key not provided. SMS service will be disabled.');
    }
  }

  async sendSMS(to: string, message: string): Promise<void> {
    try {
      if (!this.apiKey) {
        if (process.env.NODE_ENV === 'development') {
          logger.info(`[DEV] SMS to ${to}: ${message}`);
          return;
        }
        throw new AppError('SMS service is not configured', 500);
      }

      // Remove + and country code prefix if present, keep only last 10 digits for Indian numbers
      let phoneNumber = to.replace(/\+/g, '');
      if (phoneNumber.startsWith('91') && phoneNumber.length > 10) {
        phoneNumber = phoneNumber.slice(-10); // Get last 10 digits
      }

      const requestBody = {
        'api_key': this.apiKey,
        'sms_type': 'bulk',
        'mobile_number': phoneNumber,
        'message': message
      };

      const response = await axios.post(this.baseUrl, requestBody, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = response.data;

      if (result.success) {
        logger.info(`SMS sent successfully via MeraOTP. Response: ${result.message}`);
      } else {
        logger.error('Failed to send SMS via MeraOTP:', result.message);
        throw new AppError('Failed to send SMS', 500);
      }

    } catch (error: any) {
      logger.error('Error sending SMS via MeraOTP:', error.response?.data || error.message || error);
      throw new AppError('Failed to send SMS', 500);
    }
  }

  async sendOTPSMS(to: string): Promise<void> {
    try {
      if (!this.apiKey) {
        if (process.env.NODE_ENV === 'development') {
          logger.info(`[DEV] OTP SMS to ${to} - MeraOTP will generate OTP`);
          return;
        }
        throw new AppError('SMS service is not configured', 500);
      }

      // Remove + and country code prefix if present, keep only last 10 digits for Indian numbers
      let phoneNumber = to.replace(/\+/g, '');
      if (phoneNumber.startsWith('91') && phoneNumber.length > 10) {
        phoneNumber = phoneNumber.slice(-10); // Get last 10 digits
      }

      const requestBody = {
        'api_key': this.apiKey,
        'sms_type': 'otp',
        'mobile_number': phoneNumber,
        'message': '1234'
      };

      const response = await axios.post(this.baseUrl, requestBody, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = response.data;

      if (result.success) {
        logger.info(`OTP SMS sent successfully via MeraOTP. Phone: ${phoneNumber}, Response: ${result.message}`);
      } else {
        logger.error('Failed to send OTP SMS via MeraOTP:', result.message);
        throw new AppError('Failed to send OTP SMS', 500);
      }

    } catch (error: any) {
      logger.error('Error sending OTP SMS via MeraOTP:', error.response?.data || error.message || error);
      throw new AppError('Failed to send OTP SMS', 500);
    }
  }

  async validateOTP(phoneNumber: string, otp: string): Promise<boolean> {
    try {
      if (!this.apiKey) {
        if (process.env.NODE_ENV === 'development') {
          logger.info(`[DEV] Validating OTP for ${phoneNumber}: ${otp} - always returns true in dev`);
          return true;
        }
        throw new AppError('SMS service is not configured', 500);
      }

      // Remove + and country code prefix if present, keep only last 10 digits for Indian numbers
      let cleanPhoneNumber = phoneNumber.replace(/\+/g, '');
      if (cleanPhoneNumber.startsWith('91') && cleanPhoneNumber.length > 10) {
        cleanPhoneNumber = cleanPhoneNumber.slice(-10); // Get last 10 digits
      }

      const requestBody = {
        'api_key': this.apiKey,
        'mobile_number': cleanPhoneNumber,
        'otp': otp
      };

      const response = await axios.post('https://meraotp.com/api/sms-validate', requestBody, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = response.data;

      if (result.success) {
        logger.info(`OTP validation successful via MeraOTP. Phone: ${cleanPhoneNumber}, OTP: ${otp}`);
        return true;
      } else {
        logger.info(`OTP validation failed via MeraOTP. Phone: ${cleanPhoneNumber}, OTP: ${otp}, Message: ${result.message}`);
        return false;
      }

    } catch (error: any) {
      logger.error('Error validating OTP via MeraOTP:', error.response?.data || error.message || error);
      return false;
    }
  }
}