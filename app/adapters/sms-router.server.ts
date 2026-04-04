import { PrismaClient } from '@prisma/client';
import {
  SmsGatewayAdapter,
  SmsMisrGateway,
  VictoryLinkGateway,
  WeApiGateway,
  SmsProvider,
  SmsGatewayResponse,
  SmsGatewayConfig
} from './sms-gateway.server';
import { encryptApiKey, decryptApiKey } from '../utils/security.server';

const prisma = new PrismaClient();

interface SmsRouterConfig {
  primaryGateway: SmsProvider;
  fallbackGateways: SmsProvider[];
  maxRetries: number;
}

export class SmsRouter {
  private gateways: Map<SmsProvider, SmsGatewayAdapter> = new Map();
  private config: SmsRouterConfig;
  private merchantId: string;

  constructor(merchantId: string, gateways: Map<SmsProvider, SmsGatewayAdapter>) {
    this.merchantId = merchantId;
    this.gateways = gateways;
    this.config = {
      primaryGateway: SmsProvider.SMS_MISR,
      fallbackGateways: [SmsProvider.VICTORY_LINK, SmsProvider.WE_API],
      maxRetries: 3
    };
  }

  static async create(merchantId: string): Promise<SmsRouter> {
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      include: { settings: true }
    });

    if (!merchant) {
      throw new Error('Merchant not found');
    }

    const gateways = new Map<SmsProvider, SmsGatewayAdapter>();
    
    const apiKeys = await prisma.apiKey.findMany({
      where: { merchantId }
    });

    for (const key of apiKeys) {
      try {
        if (key.encryptedKey && process.env.MASTER_KEY) {
          const decryptedKey = decryptApiKey(key.encryptedKey, process.env.MASTER_KEY);
          
          const config: SmsGatewayConfig = {
            apiKey: decryptedKey,
            senderName: 'SMS-Shield'
          };

          if (key.name.includes('smsmisr') || key.name.includes('misr')) {
            gateways.set(SmsProvider.SMS_MISR, new SmsMisrGateway(config));
          } else if (key.name.includes('victory')) {
            gateways.set(SmsProvider.VICTORY_LINK, new VictoryLinkGateway(config));
          } else if (key.name.includes('we')) {
            gateways.set(SmsProvider.WE_API, new WeApiGateway(config));
          }
        }
      } catch (error) {
        console.error(`Failed to initialize gateway for key ${key.name}:`, error);
      }
    }

    if (gateways.size === 0) {
      throw new Error('No SMS gateways configured');
    }

    return new SmsRouter(merchantId, gateways);
  }

  async sendSms(
    phoneNumber: string,
    message: string,
    contactId?: string,
    campaignId?: string,
    automationId?: string
  ): Promise<SmsGatewayResponse> {
    const gatewayOrder = [this.config.primaryGateway, ...this.config.fallbackGateways];
    
    const availableGateways = gatewayOrder.filter(gw => this.gateways.has(gw));
    
    if (availableGateways.length === 0) {
      return {
        success: false,
        error: 'No available gateways',
        gateway: this.config.primaryGateway
      };
    }

    let lastError: SmsGatewayResponse | null = null;
    let usedGateway: SmsProvider = this.config.primaryGateway;

    for (let attempt = 0; attempt < availableGateways.length; attempt++) {
      const gatewayProvider = availableGateways[attempt];
      const gateway = this.gateways.get(gatewayProvider);

      if (!gateway) continue;

      const result = await this.sendWithGateway(
        gateway,
        phoneNumber,
        message,
        gatewayProvider,
        contactId,
        campaignId,
        automationId
      );

      if (result.success) {
        return result;
      }

      lastError = result;
      usedGateway = gatewayProvider;

      console.warn(`Gateway ${gatewayProvider} failed, trying fallback`, result.error);
    }

    if (lastError) {
      await this.logFailedSms(
        phoneNumber,
        message,
        usedGateway,
        lastError.error || 'All gateways failed',
        contactId,
        campaignId,
        automationId
      );
    }

    return lastError || {
      success: false,
      error: 'All gateways failed',
      gateway: usedGateway
    };
  }

  private async sendWithGateway(
    gateway: SmsGatewayAdapter,
    phoneNumber: string,
    message: string,
    provider: SmsProvider,
    contactId?: string,
    campaignId?: string,
    automationId?: string
  ): Promise<SmsGatewayResponse> {
    const startTime = Date.now();
    
    try {
      const result = await gateway.sendSms(phoneNumber, message);
      
      await this.logSms(
        phoneNumber,
        message,
        provider,
        result,
        contactId,
        campaignId,
        automationId,
        Date.now() - startTime
      );

      if (result.success) {
        await this.updateJobSuccess(
          contactId,
          campaignId,
          automationId,
          result.messageId,
          result.cost
        );
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        gateway: provider
      };
    }
  }

  private async logSms(
    phoneNumber: string,
    message: string,
    gateway: SmsProvider,
    result: SmsGatewayResponse,
    contactId?: string,
    campaignId?: string,
    automationId?: string,
    processingTime?: number
  ): Promise<void> {
    try {
      await prisma.smsLog.create({
        data: {
          contactId: contactId || '',
          jobId: undefined,
          campaignId,
          automationId,
          gateway,
          direction: 'outbound',
          phoneNumber,
          message,
          status: result.success ? 'delivered' : 'failed',
          cost: result.cost,
          externalId: result.messageId,
          errorCode: result.errorCode,
          errorMessage: result.error
        }
      });
    } catch (error) {
      console.error('Failed to log SMS:', error);
    }
  }

  private async logFailedSms(
    phoneNumber: string,
    message: string,
    gateway: SmsProvider,
    error: string,
    contactId?: string,
    campaignId?: string,
    automationId?: string
  ): Promise<void> {
    console.error(`SMS failed for ${phoneNumber}:`, error);
  }

  private async updateJobSuccess(
    contactId?: string,
    campaignId?: string,
    automationId?: string,
    externalId?: string,
    cost?: number
  ): Promise<void> {
    if (!contactId) return;

    try {
      await prisma.smsJob.updateMany({
        where: {
          contactId,
          campaignId,
          automationId,
          status: 'PROCESSING'
        },
        data: {
          status: 'COMPLETED',
          processedAt: new Date(),
          deliveredAt: new Date(),
          externalId,
          cost
        }
      });
    } catch (error) {
      console.error('Failed to update job status:', error);
    }
  }

  async getGatewayBalance(provider?: SmsProvider): Promise<Map<SmsProvider, number>> {
    const balances = new Map<SmsProvider, number>();
    const targetProvider = provider || this.config.primaryGateway;
    
    const gateway = this.gateways.get(targetProvider);
    if (gateway) {
      const balance = await gateway.getBalance();
      balances.set(targetProvider, balance);
    }

    return balances;
  }

  async checkGatewaysHealth(): Promise<Map<SmsProvider, boolean>> {
    const health = new Map<SmsProvider, boolean>();
    
    for (const [provider, gateway] of this.gateways) {
      try {
        const balance = await gateway.getBalance();
        health.set(provider, balance > 0);
      } catch {
        health.set(provider, false);
      }
    }

    return health;
  }
}

export async function sendSmsWithFallback(
  merchantId: string,
  phoneNumber: string,
  message: string,
  contactId?: string,
  campaignId?: string,
  automationId?: string
): Promise<SmsGatewayResponse> {
  try {
    const router = await SmsRouter.create(merchantId);
    return await router.sendSms(
      phoneNumber,
      message,
      contactId,
      campaignId,
      automationId
    );
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Router initialization failed',
      gateway: SmsProvider.SMS_MISR
    };
  }
}
