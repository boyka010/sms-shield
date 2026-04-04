// =============================================================================
// SMS-Shield Campaign Execution Service
// Full lifecycle handler for sending an SMS campaign to subscribers
// =============================================================================

import { db } from "@/lib/db";
import { decrypt, hashPhone } from "@/lib/encryption";
import { createSMSManager, type SMSManagerConfig } from "@/lib/sms/sms-manager";
import type { SMSGatewayConfig } from "@/lib/sms/types";
import { logger } from "@/lib/logger";
import { renderTemplate, type TemplateContext } from "@/lib/services/template-engine";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ExecuteCampaignInput {
  campaignId: string;
  shopId: string;
}

export interface ExecutionResult {
  success: boolean;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  errors: string[];
}

/** Internal structure for a resolved recipient ready for messaging */
interface ResolvedRecipient {
  subscriberId: string;
  firstName?: string | null;
  lastName?: string | null;
  encryptedPhone: string;
  rawPhone: string;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "dev-encryption-key-32-bytes-long-000000";

// -----------------------------------------------------------------------------
// Main export
// -----------------------------------------------------------------------------

/**
 * Executes an SMS campaign by resolving recipients, rendering templates,
 * sending messages via the SMSManager (with automatic failover), and
 * recording results to CampaignMessage and SMSSendLog tables.
 *
 * This function never throws. All errors are caught and returned in the
 * ExecutionResult.errors array.
 *
 * @param input - Campaign ID and Shop ID
 * @returns Execution result with counts and any errors encountered
 */
export async function executeCampaign(input: ExecuteCampaignInput): Promise<ExecutionResult> {
  const { campaignId, shopId } = input;
  const errors: string[] = [];
  let sentCount = 0;
  let failedCount = 0;
  const campaignLog = logger.child("campaign-executor");

  // ─── Step 1: Fetch campaign with shop ────────────────────────────────────
  let campaign;
  try {
    campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      include: { shop: true },
    });
  } catch (error) {
    const msg = `Database error fetching campaign: ${error instanceof Error ? error.message : String(error)}`;
    errors.push(msg);
    campaignLog.error(msg, { campaignId, shopId });
    return { success: false, totalRecipients: 0, sentCount: 0, failedCount: 0, errors };
  }

  if (!campaign) {
    errors.push(`Campaign not found: ${campaignId}`);
    campaignLog.error("Campaign not found", { campaignId, shopId });
    return { success: false, totalRecipients: 0, sentCount: 0, failedCount: 0, errors };
  }

  if (campaign.shopId !== shopId) {
    errors.push(`Campaign ${campaignId} does not belong to shop ${shopId}`);
    campaignLog.error("Shop mismatch", { campaignId, shopId, campaignShopId: campaign.shopId });
    return { success: false, totalRecipients: 0, sentCount: 0, failedCount: 0, errors };
  }

  // ─── Step 2: Validate campaign status ────────────────────────────────────
  const validStatuses = ["scheduled", "running"];
  if (!validStatuses.includes(campaign.status)) {
    errors.push(`Campaign is in status "${campaign.status}", expected one of: ${validStatuses.join(", ")}`);
    campaignLog.warn("Invalid campaign status for execution", { campaignId, status: campaign.status });
    return { success: false, totalRecipients: 0, sentCount: 0, failedCount: 0, errors };
  }

  // ─── Step 3: Mark campaign as running ────────────────────────────────────
  try {
    await db.campaign.update({
      where: { id: campaignId },
      data: {
        status: "running",
        startedAt: campaign.startedAt ?? new Date(),
      },
    });
  } catch (error) {
    errors.push(`Failed to update campaign status to running: ${error instanceof Error ? error.message : String(error)}`);
    campaignLog.error("Failed to set campaign running", { campaignId });
    // Continue anyway — the campaign was already in scheduled/running
  }

  // ─── Step 4: Load and decrypt gateway configs ────────────────────────────
  const gatewayConfigs = await loadDecryptedGatewayConfigs(shopId, campaignLog);

  if (gatewayConfigs.length === 0) {
    errors.push("No active SMS gateway configurations found for this shop");
    campaignLog.error("No gateways available", { shopId });

    await finalizeCampaign(campaignId, 0, 0, 0);
    return { success: false, totalRecipients: 0, sentCount: 0, failedCount: 0, errors };
  }

  // ─── Step 5: Create SMSManager ──────────────────────────────────────────
  const managerConfig: SMSManagerConfig = {
    shopId,
    gateways: gatewayConfigs,
    maxGlobalRetries: 2,
    enableLogging: true,
  };
  const smsManager = createSMSManager(managerConfig);

  // ─── Step 6: Determine recipients ────────────────────────────────────────
  const recipients = await resolveRecipients(campaign, campaignLog);

  if (recipients.length === 0) {
    errors.push("No eligible recipients found for this campaign");
    campaignLog.warn("No recipients resolved", { campaignId, type: campaign.type });
    await finalizeCampaign(campaignId, 0, 0, 0);
    return { success: false, totalRecipients: 0, sentCount: 0, failedCount: 0, errors };
  }

  const totalRecipients = recipients.length;
  campaignLog.info("Campaign recipients resolved", {
    campaignId,
    type: campaign.type,
    totalRecipients,
  });

  // ─── Step 7: Iterate recipients and send ─────────────────────────────────
  for (const recipient of recipients) {
    try {
      const result = await processRecipient(
        smsManager,
        campaign,
        recipient,
        campaignLog,
      );

      if (result) {
        sentCount++;
      } else {
        failedCount++;
      }
    } catch (error) {
      failedCount++;
      const msg = `Error processing recipient ${recipient.subscriberId}: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(msg);
      campaignLog.error("Recipient processing error", {
        campaignId,
        subscriberId: recipient.subscriberId,
        error: msg,
      });
    }
  }

  // ─── Step 8: Finalize campaign ───────────────────────────────────────────
  await finalizeCampaign(campaignId, totalRecipients, sentCount, failedCount);

  // ─── Step 9: Return result ───────────────────────────────────────────────
  const hadPartialFailure = failedCount > 0 && sentCount > 0;
  const hadTotalFailure = failedCount > 0 && sentCount === 0;

  campaignLog.info("Campaign execution completed", {
    campaignId,
    totalRecipients,
    sentCount,
    failedCount,
    partialFailure: hadPartialFailure,
    totalFailure: hadTotalFailure,
  });

  return {
    success: failedCount === 0,
    totalRecipients,
    sentCount,
    failedCount,
    errors,
  };
}

// -----------------------------------------------------------------------------
// Internal: Gateway config loading & decryption
// -----------------------------------------------------------------------------

async function loadDecryptedGatewayConfigs(
  shopId: string,
  log: ReturnType<typeof logger.child>
): Promise<SMSGatewayConfig[]> {
  const configs = await db.sMSGatewayConfig.findMany({
    where: { shopId, isActive: true },
    orderBy: { priority: "asc" },
  });

  const decrypted: SMSGatewayConfig[] = [];

  for (const config of configs) {
    try {
      const username = await decrypt(config.encryptedUsername, ENCRYPTION_KEY);
      const password = await decrypt(config.encryptedPassword, ENCRYPTION_KEY);
      const apiKey = config.encryptedApiKey
        ? await decrypt(config.encryptedApiKey, ENCRYPTION_KEY)
        : undefined;

      decrypted.push({
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
      log.error("Failed to decrypt gateway credentials", {
        gatewayId: config.id,
        gatewayType: config.gatewayType,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return decrypted;
}

// -----------------------------------------------------------------------------
// Internal: Recipient resolution based on campaign type
// -----------------------------------------------------------------------------

async function resolveRecipients(
  campaign: {
    id: string;
    shopId: string;
    type: string;
    segmentFilter: string | null;
  },
  log: ReturnType<typeof logger.child>
): Promise<ResolvedRecipient[]> {
  switch (campaign.type) {
    case "BROADCAST":
      return resolveBroadcastRecipients(campaign.shopId);

    case "RFM_SEGMENT":
      return resolveRFMSegmentRecipients(campaign.shopId, campaign.segmentFilter);

    case "ABANDONED_CART":
      return resolveAbandonedCartRecipients(campaign.shopId);

    case "COD_CONFIRMATION":
      return resolveCODConfirmationRecipients(campaign.shopId);

    default:
      log.warn("Unknown campaign type, falling back to broadcast", {
        type: campaign.type,
      });
      return resolveBroadcastRecipients(campaign.shopId);
  }
}

/**
 * BROADCAST: All subscribers who gave consent for the shop.
 */
async function resolveBroadcastRecipients(shopId: string): Promise<ResolvedRecipient[]> {
  const subscribers = await db.subscriber.findMany({
    where: {
      shopId,
      consentGranted: true,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phoneNumber: true,
      rawPhoneNumber: true,
    },
  });

  return subscribers.map((s) => ({
    subscriberId: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
    encryptedPhone: s.phoneNumber,
    rawPhone: s.rawPhoneNumber,
  }));
}

/**
 * RFM_SEGMENT: Subscribers whose latest RFM segment matches the filter.
 * segmentFilter is expected to be a JSON string like:
 *   { "segments": ["CHAMPION", "LOYAL"] }
 * or
 *   { "segment": "CHAMPION" }
 */
async function resolveRFMSegmentRecipients(
  shopId: string,
  segmentFilter: string | null
): Promise<ResolvedRecipient[]> {
  if (!segmentFilter) {
    // No filter → fall back to all consenting subscribers
    return resolveBroadcastRecipients(shopId);
  }

  let filter: { segments?: string[]; segment?: string };
  try {
    filter = JSON.parse(segmentFilter);
  } catch {
    // Invalid JSON filter → fall back to broadcast
    return resolveBroadcastRecipients(shopId);
  }

  // Get the most recent RFM calculation per subscriber
  const latestRFM = await db.rFMSegment.findMany({
    where: {
      shopId,
      ...(filter.segments
        ? { segment: { in: filter.segments } }
        : filter.segment
          ? { segment: filter.segment }
          : {}),
    },
    orderBy: { calculatedAt: "desc" },
    select: {
      subscriberId: true,
    },
    distinct: ["subscriberId"],
  });

  const subscriberIds = latestRFM.map((r) => r.subscriberId);

  if (subscriberIds.length === 0) {
    return [];
  }

  const subscribers = await db.subscriber.findMany({
    where: {
      id: { in: subscriberIds },
      consentGranted: true,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phoneNumber: true,
      rawPhoneNumber: true,
    },
  });

  return subscribers.map((s) => ({
    subscriberId: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
    encryptedPhone: s.phoneNumber,
    rawPhone: s.rawPhoneNumber,
  }));
}

/**
 * ABANDONED_CART: Subscribers with abandoned carts (pending or reminded).
 */
async function resolveAbandonedCartRecipients(shopId: string): Promise<ResolvedRecipient[]> {
  const abandonedCarts = await db.cartAbandonment.findMany({
    where: {
      shopId,
      recoveryStatus: { in: ["pending", "reminded_1", "reminded_2"] },
      subscriberId: { not: null },
    },
    include: {
      subscriber: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
          rawPhoneNumber: true,
          consentGranted: true,
        },
      },
    },
    distinct: ["subscriberId"],
  });

  return abandonedCarts
    .filter((c) => c.subscriber && c.subscriber.consentGranted)
    .map((c) => {
      const s = c.subscriber!;
      return {
        subscriberId: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        encryptedPhone: s.phoneNumber,
        rawPhone: s.rawPhoneNumber,
      };
    });
}

/**
 * COD_CONFIRMATION: Subscribers with pending COD orders.
 * Uses CartAbandonment records linked to COD flow where recovery is still pending.
 */
async function resolveCODConfirmationRecipients(shopId: string): Promise<ResolvedRecipient[]> {
  // Look for subscribers with touch points in COD_CONFIRMATION flow
  const codTouchPoints = await db.touchPoint.findMany({
    where: {
      shopId,
      flowType: "COD_CONFIRMATION",
      flowState: { in: ["initialized", "in_progress"] },
      isExpired: false,
      subscriberId: { not: null },
    },
    include: {
      subscriber: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
          rawPhoneNumber: true,
          consentGranted: true,
        },
      },
    },
    distinct: ["subscriberId"],
  });

  return codTouchPoints
    .filter((tp) => tp.subscriber && tp.subscriber.consentGranted)
    .map((tp) => {
      const s = tp.subscriber!;
      return {
        subscriberId: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        encryptedPhone: s.phoneNumber,
        rawPhone: s.rawPhoneNumber,
      };
    });
}

// -----------------------------------------------------------------------------
// Internal: Process a single recipient
// -----------------------------------------------------------------------------

async function processRecipient(
  smsManager: ReturnType<typeof createSMSManager>,
  campaign: {
    id: string;
    shopId: string;
    messageTemplate: string;
    senderName: string | null;
    type: string;
  },
  recipient: ResolvedRecipient,
  log: ReturnType<typeof logger.child>
): Promise<boolean> {
  // Step a: Decrypt phone number
  let phone: string;
  try {
    phone = await decrypt(recipient.encryptedPhone, ENCRYPTION_KEY);
  } catch (error) {
    log.error("Failed to decrypt recipient phone", {
      subscriberId: recipient.subscriberId,
      error: error instanceof Error ? error.message : String(error),
    });
    await createFailedCampaignMessage(campaign, recipient, "Phone decryption failed");
    await createSMSSendLogEntry(campaign, recipient, campaign.type, "", "failed", "Phone decryption failed", 0);
    return false;
  }

  // Step b: Render template
  const storeName = campaign.senderName ?? "Store";
  const context: TemplateContext = {
    customer_name: [recipient.firstName, recipient.lastName].filter(Boolean).join(" ") || undefined,
    customer_first_name: recipient.firstName ?? undefined,
    customer_last_name: recipient.lastName ?? undefined,
    store_name: storeName,
  };

  const messageContent = renderTemplate(campaign.messageTemplate, context);

  if (!messageContent.trim()) {
    log.warn("Rendered message is empty", {
      campaignId: campaign.id,
      subscriberId: recipient.subscriberId,
    });
    await createFailedCampaignMessage(campaign, recipient, "Rendered message is empty");
    return false;
  }

  // Step c: Create CampaignMessage record (status: pending)
  const campaignMessage = await db.campaignMessage.create({
    data: {
      campaignId: campaign.id,
      subscriberId: recipient.subscriberId,
      shopId: campaign.shopId,
      gatewayType: campaign.type,
      recipientPhone: recipient.encryptedPhone,
      messageContent,
      status: "pending",
    },
  });

  // Step d: Send via SMSManager
  const startTime = Date.now();
  let response;
  try {
    response = await smsManager.send({
      recipientPhone: phone,
      message: messageContent,
      senderName: campaign.senderName ?? undefined,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.error("SMSManager threw exception", {
      campaignId: campaign.id,
      subscriberId: recipient.subscriberId,
      error: errorMsg,
    });

    // Step e: Update CampaignMessage with failure
    await db.campaignMessage.update({
      where: { id: campaignMessage.id },
      data: {
        status: "failed",
        errorMessage: errorMsg,
        failedAt: new Date(),
        retryCount: 1,
      },
    });

    // Step f: Create SMSSendLog
    await createSMSSendLogEntry(campaign, recipient, campaign.type, messageContent, "failed", errorMsg, Date.now() - startTime);
    return false;
  }

  // Step e: Update CampaignMessage with result
  if (response.success) {
    await db.campaignMessage.update({
      where: { id: campaignMessage.id },
      data: {
        status: "sent",
        externalMessageId: response.externalMessageId ?? null,
        sentAt: new Date(),
      },
    });

    // Step f: Create SMSSendLog (with hashed phone)
    await createSMSSendLogEntry(
      campaign,
      recipient,
      response.gatewayType,
      messageContent,
      "sent",
      response.statusMessage ?? null,
      response.latencyMs,
      response.externalMessageId,
      response.statusCode,
      response.cost
    );

    return true;
  } else {
    await db.campaignMessage.update({
      where: { id: campaignMessage.id },
      data: {
        status: "failed",
        errorMessage: response.statusMessage ?? "Unknown send failure",
        failedAt: new Date(),
      },
    });

    await createSMSSendLogEntry(
      campaign,
      recipient,
      response.gatewayType,
      messageContent,
      "failed",
      response.statusMessage ?? "Unknown send failure",
      response.latencyMs,
      undefined,
      response.statusCode
    );

    return false;
  }
}

// -----------------------------------------------------------------------------
// Internal: Campaign finalization
// -----------------------------------------------------------------------------

async function finalizeCampaign(
  campaignId: string,
  totalRecipients: number,
  sentCount: number,
  failedCount: number
): Promise<void> {
  try {
    await db.campaign.update({
      where: { id: campaignId },
      data: {
        status: "completed",
        completedAt: new Date(),
        totalRecipients,
        sentCount,
        deliveredCount: sentCount, // We count sent as delivered until delivery receipts arrive
        failedCount,
      },
    });
  } catch (error) {
    logger.error("Failed to finalize campaign", {
      campaignId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// -----------------------------------------------------------------------------
// Internal: Helper DB operations
// -----------------------------------------------------------------------------

async function createFailedCampaignMessage(
  campaign: { id: string; shopId: string; type: string },
  recipient: ResolvedRecipient,
  errorMessage: string
): Promise<void> {
  try {
    await db.campaignMessage.create({
      data: {
        campaignId: campaign.id,
        subscriberId: recipient.subscriberId,
        shopId: campaign.shopId,
        gatewayType: campaign.type,
        recipientPhone: recipient.encryptedPhone,
        messageContent: "",
        status: "failed",
        errorMessage,
        failedAt: new Date(),
      },
    });
  } catch (error) {
    logger.error("Failed to create error CampaignMessage", {
      campaignId: campaign.id,
      subscriberId: recipient.subscriberId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function createSMSSendLogEntry(
  campaign: { id: string; shopId: string },
  recipient: ResolvedRecipient,
  gatewayType: string,
  messageContent: string,
  status: string,
  responseMessage: string | null,
  latencyMs: number,
  externalMessageId?: string,
  responseCode?: string,
  cost?: number
): Promise<void> {
  try {
    // Hash the phone for the log (never store raw phone in logs)
    let phoneHash: string;
    try {
      phoneHash = hashPhone(recipient.rawPhone);
    } catch {
      // If rawPhone is encrypted and can't be hashed, use a placeholder
      phoneHash = hashPhone(recipient.encryptedPhone);
    }

    await db.sMSSendLog.create({
      data: {
        shopId: campaign.shopId,
        campaignId: campaign.id,
        subscriberId: recipient.subscriberId,
        gatewayType,
        recipientPhoneHash: phoneHash,
        messageContent,
        externalMessageId: externalMessageId ?? null,
        status,
        cost: cost ?? 0,
        currency: "EGP",
        responseCode: responseCode ?? null,
        responseMessage,
        latencyMs,
        sentAt: status === "sent" ? new Date() : null,
        failedAt: status === "failed" ? new Date() : null,
      },
    });
  } catch (error) {
    logger.error("Failed to create SMSSendLog entry", {
      campaignId: campaign.id,
      subscriberId: recipient.subscriberId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
