import axios from 'axios';
import { logger } from '../utils/logger';
import { AppError } from '../utils/AppError';

export class Msg91Service {
  private apiKey: string;
  private senderId: string;
  private baseUrl = 'https://api.msg91.com/api/v5';

  constructor() {
    this.apiKey = process.env.MSG91_API_KEY || '';
    this.senderId = process.env.MSG91_SENDER_ID || 'MSGIND';

    if (!this.apiKey) {
      logger.warn('MSG91 API key not provided. SMS service will be disabled.');
    }
  }

  private isValidIndianNumber(phoneNumber: string): boolean {
    // Remove any non-numeric characters except +
    const cleanNumber = phoneNumber.replace(/[^\d+]/g, '');
    
    // Check if it's a valid Indian number
    if (cleanNumber.startsWith('+91')) {
      return cleanNumber.length === 13; // +91 + 10 digits
    } else if (cleanNumber.startsWith('91')) {
      return cleanNumber.length === 12; // 91 + 10 digits
    } else if (cleanNumber.length === 10) {
      return true; // 10 digit number, assume Indian
    }
    
    return false;
  }

  private formatPhoneNumber(phoneNumber: string): string {
    // Remove any non-numeric characters except +
    let cleanNumber = phoneNumber.replace(/[^\d+]/g, '');
    
    // Add +91 if not present
    if (cleanNumber.startsWith('+91')) {
      return cleanNumber.substring(3); // MSG91 expects without +91
    } else if (cleanNumber.startsWith('91')) {
      return cleanNumber.substring(2); // Remove 91 prefix
    } else if (cleanNumber.length === 10) {
      return cleanNumber; // Already 10 digits
    }
    
    throw new AppError(`Invalid phone number format: ${phoneNumber}`, 400);
  }

  async sendSMS(to: string, message: string): Promise<void> {
    try {
      if (!this.apiKey) {
        if (process.env.NODE_ENV === 'development') {
          logger.info(`[DEV] MSG91 SMS to ${to}: ${message}`);
          return;
        }
        throw new AppError('MSG91 service is not configured', 500);
      }

      // Validate and format phone number
      if (!this.isValidIndianNumber(to)) {
        throw new AppError(`Invalid Indian phone number: ${to}`, 400);
      }

      const formattedNumber = this.formatPhoneNumber(to);

      const payload = {
        sender: this.senderId,
        route: '4', // Route 4 is for Transactional SMS
        country: '91',
        sms: [
          {
            message: message,
            to: [formattedNumber]
          }
        ]
      };

      const response = await axios.post(`${this.baseUrl}/sms`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'authkey': this.apiKey
        },
        timeout: 10000 // 10 second timeout
      });

      if (response.data && response.data.type === 'success') {
        logger.info(`MSG91 SMS sent successfully to ${to}. Request ID: ${response.data.request_id}`);
      } else {
        logger.error('MSG91 SMS failed:', response.data);
        throw new AppError('Failed to send SMS via MSG91', 500);
      }

    } catch (error: any) {
      logger.error('Error sending SMS via MSG91:', error);
      
      if (error.response) {
        // API error response
        const errorMsg = error.response.data?.message || error.response.data?.type || 'MSG91 API error';
        throw new AppError(`SMS sending failed: ${errorMsg}`, 500);
      } else if (error.request) {
        // Network error
        throw new AppError('Network error while sending SMS', 500);
      } else {
        // Other error
        throw new AppError(error.message || 'Failed to send SMS', 500);
      }
    }
  }

  async sendOTPSMS(to: string, code: string): Promise<void> {
    const message = `Your Connect verification code is: ${code}. Valid for 10 minutes. Don't share this code with anyone.`;
    await this.sendSMS(to, message);
  }

  // MSG91 specific OTP method using their template system (more reliable for OTP)
  async sendOTPViaTemplate(to: string, code: string, templateId?: string): Promise<void> {
    try {
      if (!this.apiKey) {
        if (process.env.NODE_ENV === 'development') {
          logger.info(`[DEV] MSG91 OTP to ${to}: ${code}`);
          return;
        }
        throw new AppError('MSG91 service is not configured', 500);
      }

      const formattedNumber = this.formatPhoneNumber(to);
      const otpTemplateId = templateId || process.env.MSG91_OTP_TEMPLATE_ID;

      if (!otpTemplateId) {
        // Fall back to regular SMS if no template
        await this.sendOTPSMS(to, code);
        return;
      }

      const payload = {
        template_id: otpTemplateId,
        sender: this.senderId,
        short_url: '0',
        mobiles: formattedNumber,
        otp: code // MSG91 will replace {{otp}} in template with this value
      };

      const response = await axios.post(`${this.baseUrl}/sms`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'authkey': this.apiKey
        },
        timeout: 10000
      });

      if (response.data && response.data.type === 'success') {
        logger.info(`MSG91 OTP sent successfully to ${to}. Request ID: ${response.data.request_id}`);
      } else {
        logger.error('MSG91 OTP failed:', response.data);
        throw new AppError('Failed to send OTP via MSG91', 500);
      }

    } catch (error: any) {
      logger.error('Error sending OTP via MSG91:', error);
      throw new AppError('Failed to send OTP', 500);
    }
  }

  // Check delivery status of sent SMS
  async checkDeliveryStatus(requestId: string): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/sms/status/${requestId}`, {
        headers: {
          'authkey': this.apiKey
        }
      });

      return response.data;
    } catch (error) {
      logger.error('Error checking MSG91 delivery status:', error);
      throw new AppError('Failed to check delivery status', 500);
    }
  }

  // Get account balance
  async getBalance(): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/user/getBalance`, {
        headers: {
          'authkey': this.apiKey
        }
      });

      return response.data;
    } catch (error) {
      logger.error('Error getting MSG91 balance:', error);
      throw new AppError('Failed to get balance', 500);
    }
  }
}