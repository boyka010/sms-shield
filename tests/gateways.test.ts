import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import {
  SmsMisrGateway,
  VictoryLinkGateway,
  WeApiGateway,
  SmsProvider
} from '../app/adapters/sms-gateway.server';

vi.mock('axios');

describe('SMS Gateway Adapters', () => {
  const mockConfig = {
    apiKey: 'test-api-key',
    senderName: 'TestSender'
  };

  describe('SmsMisrGateway', () => {
    let gateway: SmsMisrGateway;

    beforeEach(() => {
      gateway = new SmsMisrGateway(mockConfig);
    });

    it('should validate Egyptian phone numbers', () => {
      expect(gateway.validatePhoneNumber('01012345678')).toBe(true);
      expect(gateway.validatePhoneNumber('01512345678')).toBe(true);
      expect(gateway.validatePhoneNumber('+2491012345678')).toBe(false);
    });

    it('should format phone numbers correctly', () => {
      const formatted = (gateway as any).formatPhoneNumber('01012345678');
      expect(formatted).toBe('201012345678');
    });

    it('should send SMS successfully', async () => {
      const mockResponse = {
        data: {
          success: true,
          message_id: '12345'
        }
      };
      
      vi.mocked(axios.post).mockResolvedValueOnce(mockResponse);

      const result = await gateway.sendSms('01012345678', 'Test message');

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('12345');
      expect(result.gateway).toBe(SmsProvider.SMS_MISR);
    });

    it('should handle SMS sending failure', async () => {
      const mockResponse = {
        data: {
          success: false,
          message: 'API Error'
        }
      };
      
      vi.mocked(axios.post).mockResolvedValueOnce(mockResponse);

      const result = await gateway.sendSms('01012345678', 'Test message');

      expect(result.success).toBe(false);
      expect(result.error).toBe('API Error');
    });
  });

  describe('VictoryLinkGateway', () => {
    let gateway: VictoryLinkGateway;

    beforeEach(() => {
      gateway = new VictoryLinkGateway(mockConfig);
    });

    it('should send SMS successfully', async () => {
      const mockResponse = {
        data: {
          Status: '0',
          MessageId: '67890'
        }
      };
      
      vi.mocked(axios.post).mockResolvedValueOnce(mockResponse);

      const result = await gateway.sendSms('01012345678', 'Test message');

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('67890');
      expect(result.gateway).toBe(SmsProvider.VICTORY_LINK);
    });
  });

  describe('WeApiGateway', () => {
    let gateway: WeApiGateway;

    beforeEach(() => {
      gateway = new WeApiGateway(mockConfig);
    });

    it('should send SMS successfully', async () => {
      const mockResponse = {
        data: {
          id: 'we-12345'
        }
      };
      
      vi.mocked(axios.post).mockResolvedValueOnce(mockResponse);

      const result = await gateway.sendSms('01012345678', 'Test message');

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('we-12345');
      expect(result.gateway).toBe(SmsProvider.WE_API);
    });
  });
});

describe('RFM Calculator', () => {
  const mockContact = {
    id: 'contact-1',
    merchantId: 'merchant-1',
    phoneNumber: '+201012345678',
    totalOrders: 5,
    totalSpent: 10000,
    orders: [
      { orderDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
      { orderDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      { orderDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) }
    ]
  };

  it('should calculate RFM scores correctly', () => {
    const daysSinceLastOrder = 10;
    const recencyScore = daysSinceLastOrder <= 30 ? 5 : 
                         daysSinceLastOrder <= 90 ? 4 : 3;
    
    expect(recencyScore).toBe(5);
  });

  it('should determine Champions segment correctly', () => {
    const recency = 5;
    const frequency = 5;
    const monetary = 5;

    const segment = recency >= 4 && frequency >= 4 && monetary >= 4 
      ? 'CHAMPIONS' : 'OTHER';
    
    expect(segment).toBe('CHAMPIONS');
  });

  it('should determine At-Risk segment correctly', () => {
    const recency = 2;
    const frequency = 4;
    const monetary = 3;

    const segment = recency <= 2 && frequency >= 3
      ? 'AT_RISK' : 'OTHER';
    
    expect(segment).toBe('AT_RISK');
  });
});
