import crypto from 'crypto';
import axios, { AxiosInstance, AxiosError } from 'axios';

export interface SmsGatewayResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  errorCode?: string;
  cost?: number;
  gateway: SmsProvider;
}

export interface SmsGatewayConfig {
  apiKey: string;
  senderName: string;
  baseUrl?: string;
}

export enum SmsProvider {
  SMS_MISR = 'SMS_MISR',
  VICTORY_LINK = 'VICTORY_LINK',
  WE_API = 'WE_API'
}

export abstract class SmsGatewayAdapter {
  protected config: SmsGatewayConfig;
  protected client: AxiosInstance;
  protected provider: SmsProvider;

  constructor(config: SmsGatewayConfig, provider: SmsProvider) {
    this.config = config;
    this.provider = provider;
    
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SMS-Shield/1.0'
      }
    });
  }

  abstract sendSms(phoneNumber: string, message: string): Promise<SmsGatewayResponse>;
  
  abstract getBalance(): Promise<number>;
  
  abstract validatePhoneNumber(phoneNumber: string): boolean;

  protected formatPhoneNumber(phoneNumber: string): string {
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    if (cleaned.startsWith('20')) {
      return cleaned;
    }
    
    if (cleaned.startsWith('0')) {
      return '20' + cleaned.slice(1);
    }
    
    return '20' + cleaned;
  }

  protected handleError(error: unknown): SmsGatewayResponse {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<any>;
      
      if (axiosError.response) {
        return {
          success: false,
          error: axiosError.response.data?.message || 'Gateway API error',
          errorCode: axiosError.response.status.toString(),
          gateway: this.provider
        };
      }
      
      if (axiosError.code === 'ECONNABORTED') {
        return {
          success: false,
          error: 'Request timeout',
          errorCode: 'TIMEOUT',
          gateway: this.provider
        };
      }
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorCode: 'UNKNOWN',
      gateway: this.provider
    };
  }
}

export class SmsMisrGateway extends SmsGatewayAdapter {
  constructor(config: SmsGatewayConfig) {
    super(config, SmsProvider.SMS_MISR);
    
    this.client = axios.create({
      baseURL: config.baseUrl || 'https://smsmisr.com',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async sendSms(phoneNumber: string, message: string): Promise<SmsGatewayResponse> {
    try {
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      
      const payload = {
        method: 'send',
        apiKey: this.config.apiKey,
        sender: this.config.senderName,
        phone: formattedPhone,
        message: message
      };

      const response = await this.client.post('/api/v1/send', payload);
      
      if (response.data?.success === true || response.data?.code === 200) {
        return {
          success: true,
          messageId: response.data?.message_id?.toString(),
          gateway: SmsProvider.SMS_MISR,
          cost: this.calculateCost(message)
        };
      }

      return {
        success: false,
        error: response.data?.message || 'SMS Misr API error',
        errorCode: response.data?.code?.toString(),
        gateway: SmsProvider.SMS_MISR
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getBalance(): Promise<number> {
    try {
      const response = await this.client.post('/api/v1/balance', {
        apiKey: this.config.apiKey
      });

      return response.data?.balance || 0;
    } catch {
      return 0;
    }
  }

  validatePhoneNumber(phoneNumber: string): boolean {
    const egyptianPhoneRegex = /^(?:\+20|0)?(10|11|12|15)\d{8}$/;
    return egyptianPhoneRegex.test(phoneNumber.replace(/\s/g, ''));
  }

  private calculateCost(message: string): number {
    const segments = Math.ceil(message.length / 160);
    return segments * 0.25;
  }
}

export class VictoryLinkGateway extends SmsGatewayAdapter {
  constructor(config: SmsGatewayConfig) {
    super(config, SmsProvider.VICTORY_LINK);
    
    this.client = axios.create({
      baseURL: config.baseUrl || 'https://sms.victorylink.com.eg',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async sendSms(phoneNumber: string, message: string): Promise<SmsGatewayResponse> {
    try {
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      
      const payload = {
        username: this.config.apiKey,
        password: this.config.senderName,
        source: this.config.senderName,
        destination: formattedPhone,
        message: message
      };

      const response = await this.client.post('/api/send', payload);
      
      if (response.data?.Status === '0' || response.data?.success) {
        return {
          success: true,
          messageId: response.data?.MessageId || response.data?.id?.toString(),
          gateway: SmsProvider.VICTORY_LINK,
          cost: this.calculateCost(message)
        };
      }

      return {
        success: false,
        error: response.data?.Message || 'Victory Link API error',
        errorCode: response.data?.Status,
        gateway: SmsProvider.VICTORY_LINK
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getBalance(): Promise<number> {
    try {
      const response = await this.client.post('/api/balance', {
        username: this.config.apiKey,
        password: this.config.senderName
      });

      return response.data?.balance || 0;
    } catch {
      return 0;
    }
  }

  validatePhoneNumber(phoneNumber: string): boolean {
    const egyptianPhoneRegex = /^(?:\+20|0)?(10|11|12|15)\d{8}$/;
    return egyptianPhoneRegex.test(phoneNumber.replace(/\s/g, ''));
  }

  private calculateCost(message: string): number {
    const segments = Math.ceil(message.length / 160);
    return segments * 0.20;
  }
}

export class WeApiGateway extends SmsGatewayAdapter {
  constructor(config: SmsGatewayConfig) {
    super(config, SmsProvider.WE_API);
    
    this.client = axios.create({
      baseURL: config.baseUrl || 'https://api.we.com.eg',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      }
    });
  }

  async sendSms(phoneNumber: string, message: string): Promise<SmsGatewayResponse> {
    try {
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      
      const payload = {
        to: formattedPhone,
        from: this.config.senderName,
        text: message
      };

      const response = await this.client.post('/sms/send', payload);
      
      if (response.data?.id) {
        return {
          success: true,
          messageId: response.data.id,
          gateway: SmsProvider.WE_API,
          cost: this.calculateCost(message)
        };
      }

      return {
        success: false,
        error: response.data?.error || 'WE API error',
        gateway: SmsProvider.WE_API
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getBalance(): Promise<number> {
    try {
      const response = await this.client.get('/sms/balance');
      return response.data?.credits || 0;
    } catch {
      return 0;
    }
  }

  validatePhoneNumber(phoneNumber: string): boolean {
    const egyptianPhoneRegex = /^(?:\+20|0)?(10|11|12|15)\d{8}$/;
    return egyptianPhoneRegex.test(phoneNumber.replace(/\s/g, ''));
  }

  private calculateCost(message: string): number {
    const segments = Math.ceil(message.length / 160);
    return segments * 0.15;
  }
}
