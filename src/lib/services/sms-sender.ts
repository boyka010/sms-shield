// =============================================================================
// SMS-Shield SMS Sender Service
// Lightweight service for single and bulk SMS sends outside of campaign flows
// =============================================================================

import { db } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { hashPhone } from "@/lib/encryption";
import { createSMSManager, type SMSManagerConfig } from "@/lib/sms/sms-manager";
import type { SMSGatewayConfig, SMSMessageResponse } from "@/lib/sms/types";
import { logger } from "@/lib/logger";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface SMSSendResult {
  success: boolean;
  recipientPhone: string;
  externalMessageId?: string;
  gatewayType?: string;
  statusMessage?: string;
  latencyMs?: number;
}

export interface SMSSendBulkResult {
  success: boolean;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  results: SMSSendResult[];
}

export interface SendSingleSMSInput {
  shopId: string;
  recipientPhone: string;
  message: string;
  senderName?: string;
  campaignId?: string;
  subscriberId?: string;
}

export interface SendBulkSMSInput {
  shopId: string;
  recipientPhones: string[];
  message: string;
  senderName?: string;
  campaignId?: string;
}

// -----------------------------------------------------------------------------
// Internal helpers
// -----------------------------------------------------------------------------

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "dev-encryption-key-32-bytes-long-000000";

/**
 * Loads and decrypts the shop's active SMS gateway configurations.
 * Returns an array of decrypted SMSGatewayConfig objects ready for SMSManager.
 */
async function loadDecryptedGatewayConfigs(
  shopId: string
): Promise<SMSGatewayConfig[]> {
  const configs = await db.sMSGatewayConfig.findMany({
    where: {
      shopId,
      isActive: true,
    },
    orderBy: { priority: "asc" },
  });

  if (configs.length === 0) {
    logger.warn("No active SMS gateway configs found for shop", { shopId });
    return [];
  }

  const decryptedConfigs: SMSGatewayConfig[] = [];

  for (const config of configs) {
    try {
      const username = await decrypt(config.encryptedUsername, ENCRYPTION_KEY);
      const password = await decrypt(config.encryptedPassword, ENCRYPTION_KEY);
      const apiKey = config.encryptedApiKey
        ? await decrypt(config.encryptedApiKey, ENCRYPTION_KEY)
        : undefined;

      decryptedConfigs.push({
        id: config.id,
        shopId: config.shopId,
        gatewayType: config.gatewayType as SMSGatewayConfig["gatewayType"],
        username,
        password,
        apiKey,
        senderName: config.senderName,
        isActive: config.isActive,
        priority: config.priority,
      });
    } catch (error) {
      logger.error("Failed to decrypt gateway credentials", {
        shopId,
        gatewayId: config.id,
        gatewayType: config.gatewayType,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return decryptedConfigs;
}

/**
 * Creates an SMSManager instance with the shop's decrypted gateway configs.
 */
async function createManager(shopId: string): Promise<ReturnType<typeof createSMSManager> | null> {
  const gateways = await loadDecryptedGatewayConfigs(shopId);

  if (gateways.length === 0) {
    return null;
  }

  const managerConfig: SMSManagerConfig = {
    shopId,
    gateways,
    maxGlobalRetries: 2,
    enableLogging: true,
  };

  return createSMSManager(managerConfig);
}

/**
 * Maps an SMSMessageResponse to an SMSSendResult.
 */
function mapToResult(response: SMSMessageResponse): SMSSendResult {
  return {
    success: response.success,
    recipientPhone: response.recipientPhone,
    externalMessageId: response.externalMessageId,
    gatewayType: response.gatewayType,
    statusMessage: response.statusMessage,
    latencyMs: response.latencyMs,
  };
}

/**
 * Creates an SMSSendLog entry for auditing and analytics.
 */
async function createSendLog(params: {
  shopId: string;
  campaignId?: string;
  subscriberId?: string;
  recipientPhone: string;
  gatewayType: string;
  messageContent: string;
  response: SMSMessageResponse;
}): Promise<void> {
  const phoneHash = hashPhone(params.recipientPhone);

  await db.sMSSendLog.create({
    data: {
      shopId: params.shopId,
      campaignId: params.campaignId ?? null,
      subscriberId: params.subscriberId ?? null,
      gatewayType: params.gatewayType,
      recipientPhoneHash: phoneHash,
      messageContent: params.messageContent,
      externalMessageId: params.response.externalMessageId ?? null,
      status: params.response.success ? "sent" : "failed",
      cost: params.response.cost ?? 0,
      currency: params.response.currency ?? "EGP",
      responseCode: params.response.statusCode ?? null,
      responseMessage: params.response.statusMessage ?? null,
      latencyMs: params.response.latencyMs,
      sentAt: params.response.success ? new Date() : null,
      failedAt: params.response.success ? null : new Date(),
    },
  });
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Sends a single SMS message to a recipient.
 *
 * Loads the shop's gateway configs, creates an SMSManager, sends the message,
 * logs the result to SMSSendLog, and returns the outcome.
 *
 * @param input - The SMS send input including shopId, phone, and message
 * @returns An SMSSendResult with the send outcome
 */
export async function sendSingleSMS(input: SendSingleSMSInput): Promise<SMSSendResult> {
  const { shopId, recipientPhone, message, senderName, campaignId, subscriberId } = input;

  logger.info("Sending single SMS", {
    shopId,
    recipientPhone: recipientPhone.slice(0, 4) + "****" + recipientPhone.slice(-4),
    hasCampaign: !!campaignId,
    hasSubscriber: !!subscriberId,
  });

  const manager = await createManager(shopId);

  if (!manager) {
    logger.error("Cannot send SMS: no active gateways", { shopId });

    // Still log the failed attempt
    try {
      await createSendLog({
        shopId,
        campaignId,
        subscriberId,
        recipientPhone,
        gatewayType: "SMS_MISR",
        messageContent: message,
        response: {
          success: false,
          recipientPhone,
          gatewayType: "SMS_MISR",
          statusMessage: "No active SMS gateways configured",
          latencyMs: 0,
          timestamp: new Date(),
          retryable: false,
        },
      });
    } catch (logError) {
      logger.error("Failed to create send log", {
        error: logError instanceof Error ? logError.message : String(logError),
      });
    }

    return {
      success: false,
      recipientPhone,
      statusMessage: "No active SMS gateways configured",
    };
  }

  try {
    const response = await manager.send({
      recipientPhone,
      message,
      senderName,
    });

    // Log to SMSSendLog for auditing
    await createSendLog({
      shopId,
      campaignId,
      subscriberId,
      recipientPhone,
      gatewayType: response.gatewayType,
      messageContent: message,
      response,
    });

    if (response.success) {
      logger.info("Single SMS sent successfully", {
        shopId,
        externalMessageId: response.externalMessageId,
        gatewayType: response.gatewayType,
        latencyMs: response.latencyMs,
      });
    } else {
      logger.warn("Single SMS send failed", {
        shopId,
        gatewayType: response.gatewayType,
        statusMessage: response.statusMessage,
        retryable: response.retryable,
      });
    }

    return mapToResult(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Unexpected error sending single SMS", {
      shopId,
      error: errorMessage,
    });

    return {
      success: false,
      recipientPhone,
      statusMessage: `Unexpected error: ${errorMessage}`,
    };
  }
}

/**
 * Sends an SMS message to multiple recipients in bulk.
 *
 * Uses SMSManager's batch send with automatic failover. Each result is
 * logged to SMSSendLog for auditing.
 *
 * @param input - The bulk SMS send input including shopId, phones array, and message
 * @returns An SMSSendBulkResult with per-recipient outcomes
 */
export async function sendBulkSMS(input: SendBulkSMSInput): Promise<SMSSendBulkResult> {
  const { shopId, recipientPhones, message, senderName, campaignId } = input;

  logger.info("Sending bulk SMS", {
    shopId,
    recipientCount: recipientPhones.length,
    hasCampaign: !!campaignId,
  });

  if (recipientPhones.length === 0) {
    return {
      success: true,
      totalRecipients: 0,
      sentCount: 0,
      failedCount: 0,
      results: [],
    };
  }

  const manager = await createManager(shopId);

  if (!manager) {
    logger.error("Cannot send bulk SMS: no active gateways", { shopId });

    const failedResults: SMSSendResult[] = recipientPhones.map((phone) => ({
      success: false,
      recipientPhone: phone,
      statusMessage: "No active SMS gateways configured",
    }));

    return {
      success: false,
      totalRecipients: recipientPhones.length,
      sentCount: 0,
      failedCount: recipientPhones.length,
      results: failedResults,
    };
  }

  try {
    const batchResponse = await manager.sendBatch({
      recipientPhone: recipientPhones[0] ?? "",
      recipients: recipientPhones,
      message,
      senderName,
    });

    // Log each result to SMSSendLog
    for (const result of batchResponse.results) {
      try {
        await createSendLog({
          shopId,
          campaignId,
          recipientPhone: result.recipientPhone,
          gatewayType: result.gatewayType,
          messageContent: message,
          response: result,
        });
      } catch (logError) {
        logger.error("Failed to create bulk send log entry", {
          error: logError instanceof Error ? logError.message : String(logError),
          recipientPhone: result.recipientPhone.slice(0, 4) + "****",
        });
      }
    }

    logger.info("Bulk SMS send completed", {
      shopId,
      totalRecipients: batchResponse.totalRecipients,
      successfulCount: batchResponse.successfulCount,
      failedCount: batchResponse.failedCount,
      gatewayType: batchResponse.gatewayType,
      totalLatencyMs: batchResponse.totalLatencyMs,
    });

    return {
      success: batchResponse.failedCount === 0,
      totalRecipients: batchResponse.totalRecipients,
      sentCount: batchResponse.successfulCount,
      failedCount: batchResponse.failedCount,
      results: batchResponse.results.map(mapToResult),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Unexpected error sending bulk SMS", {
      shopId,
      error: errorMessage,
    });

    const failedResults: SMSSendResult[] = recipientPhones.map((phone) => ({
      success: false,
      recipientPhone: phone,
      statusMessage: `Unexpected error: ${errorMessage}`,
    }));

    return {
      success: false,
      totalRecipients: recipientPhones.length,
      sentCount: 0,
      failedCount: recipientPhones.length,
      results: failedResults,
    };
  }
}
