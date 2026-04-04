import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { encrypt } from '@/lib/encryption';
import { success, error, getRequestBody } from '@/lib/api/helpers';

// ── Encryption key ─────────────────────────────────────────────────────────────

const ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY ??
  'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';

// ── Valid gateway types ────────────────────────────────────────────────────────

const VALID_GATEWAY_TYPES = ['SMS_MISR', 'VICTORY_LINK', 'WE_API'] as const;

// ── Masking helpers ────────────────────────────────────────────────────────────

/**
 * Masks a sensitive string, showing only the first and last 2 characters.
 * Returns '****' if the string is too short.
 */
function maskCredential(value: string): string {
  if (!value || value.length <= 4) return '****';
  return value.slice(0, 2) + '*'.repeat(Math.max(value.length - 4, 4)) + value.slice(-2);
}

// ── GET /api/gateways ─────────────────────────────────────────────────────────
//
// Get gateway configurations for a shop.
// Returns gateway configs without decrypted credentials.
//

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const shopId = searchParams.get('shopId');
    if (!shopId) {
      return error('shopId query parameter is required', 400);
    }

    const gateways = await db.sMSGatewayConfig.findMany({
      where: { shopId },
      select: {
        id: true,
        shopId: true,
        gatewayType: true,
        encryptedUsername: true,
        encryptedPassword: true,
        encryptedApiKey: true,
        senderName: true,
        isActive: true,
        priority: true,
        lastHealthCheckAt: true,
        healthStatus: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { priority: 'asc' },
    });

    // Mask all credentials before returning
    const maskedGateways = gateways.map((gw) => ({
      id: gw.id,
      shopId: gw.shopId,
      gatewayType: gw.gatewayType,
      maskedUsername: maskCredential(gw.encryptedUsername),
      maskedPassword: '****',
      hasApiKey: !!gw.encryptedApiKey,
      maskedApiKey: gw.encryptedApiKey ? maskCredential(gw.encryptedApiKey) : null,
      senderName: gw.senderName,
      isActive: gw.isActive,
      priority: gw.priority,
      lastHealthCheckAt: gw.lastHealthCheckAt,
      healthStatus: gw.healthStatus,
      createdAt: gw.createdAt,
      updatedAt: gw.updatedAt,
    }));

    return success(maskedGateways);
  } catch (err) {
    console.error('[gateways:GET] Error fetching gateway configs', err);
    return error('Failed to fetch gateway configurations', 500);
  }
}

// ── POST /api/gateways ────────────────────────────────────────────────────────
//
// Add a new gateway configuration.
// Encrypts credentials before storage.
//

export async function POST(request: NextRequest) {
  try {
    const body = await getRequestBody<{
      shopId: string;
      gatewayType: string;
      username: string;
      password: string;
      apiKey?: string;
      senderName: string;
      priority?: number;
    }>(request);

    const { shopId, gatewayType, username, password, apiKey, senderName, priority } = body;

    // Validate required fields
    if (!shopId) {
      return error('shopId is required', 400);
    }

    if (!gatewayType) {
      return error('gatewayType is required', 400);
    }

    if (!VALID_GATEWAY_TYPES.includes(gatewayType as (typeof VALID_GATEWAY_TYPES)[number])) {
      return error(
        `Invalid gatewayType: ${gatewayType}. Allowed: ${VALID_GATEWAY_TYPES.join(', ')}`,
        400
      );
    }

    if (!username) {
      return error('username is required', 400);
    }

    if (!password) {
      return error('password is required', 400);
    }

    if (!senderName) {
      return error('senderName is required', 400);
    }

    // Verify shop exists
    const shop = await db.shop.findUnique({
      where: { id: shopId },
    });

    if (!shop) {
      return error('Shop not found', 404);
    }

    // Check for duplicate gateway type per shop
    const existing = await db.sMSGatewayConfig.findUnique({
      where: {
        shopId_gatewayType: {
          shopId,
          gatewayType,
        },
      },
    });

    if (existing) {
      return error(
        `A ${gatewayType} gateway configuration already exists for this shop. Use PUT to update it.`,
        409
      );
    }

    // Encrypt credentials
    let encryptedUsername: string;
    let encryptedPassword: string;
    let encryptedApiKey: string | null = null;

    try {
      encryptedUsername = await encrypt(username, ENCRYPTION_KEY);
      encryptedPassword = await encrypt(password, ENCRYPTION_KEY);

      if (apiKey) {
        encryptedApiKey = await encrypt(apiKey, ENCRYPTION_KEY);
      }
    } catch (encryptErr) {
      console.error('[gateways:POST] Encryption failed', encryptErr);
      return error('Failed to encrypt gateway credentials', 500);
    }

    // Create gateway config
    const gateway = await db.sMSGatewayConfig.create({
      data: {
        shopId,
        gatewayType,
        encryptedUsername,
        encryptedPassword,
        encryptedApiKey,
        senderName,
        priority: priority ?? 0,
      },
    });

    return success({
      id: gateway.id,
      shopId: gateway.shopId,
      gatewayType: gateway.gatewayType,
      maskedUsername: maskCredential(encryptedUsername),
      maskedPassword: '****',
      hasApiKey: !!encryptedApiKey,
      senderName: gateway.senderName,
      isActive: gateway.isActive,
      priority: gateway.priority,
      createdAt: gateway.createdAt,
    }, 201);
  } catch (err) {
    console.error('[gateways:POST] Error creating gateway config', err);
    return error('Failed to create gateway configuration', 500);
  }
}

// ── PUT /api/gateways ─────────────────────────────────────────────────────────
//
// Update a gateway configuration.
// Re-encrypts any changed credentials.
//

export async function PUT(request: NextRequest) {
  try {
    const body = await getRequestBody<{
      id: string;
      username?: string;
      password?: string;
      apiKey?: string;
      senderName?: string;
      isActive?: boolean;
      priority?: number;
    }>(request);

    const { id, username, password, apiKey, senderName, isActive, priority } = body;

    if (!id) {
      return error('Gateway config id is required', 400);
    }

    // Check gateway exists
    const existing = await db.sMSGatewayConfig.findUnique({
      where: { id },
    });

    if (!existing) {
      return error('Gateway configuration not found', 404);
    }

    // Build update data
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (senderName !== undefined) {
      updateData.senderName = senderName;
    }

    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    if (priority !== undefined) {
      updateData.priority = Number(priority);
    }

    // Encrypt and update credentials if provided
    if (username) {
      try {
        updateData.encryptedUsername = await encrypt(username, ENCRYPTION_KEY);
      } catch {
        return error('Failed to encrypt username', 500);
      }
    }

    if (password) {
      try {
        updateData.encryptedPassword = await encrypt(password, ENCRYPTION_KEY);
      } catch {
        return error('Failed to encrypt password', 500);
      }
    }

    if (apiKey !== undefined) {
      try {
        updateData.encryptedApiKey = apiKey
          ? await encrypt(apiKey, ENCRYPTION_KEY)
          : null;
      } catch {
        return error('Failed to encrypt API key', 500);
      }
    }

    // Apply update
    const gateway = await db.sMSGatewayConfig.update({
      where: { id },
      data: updateData,
    });

    return success({
      id: gateway.id,
      shopId: gateway.shopId,
      gatewayType: gateway.gatewayType,
      maskedUsername: maskCredential(gateway.encryptedUsername),
      maskedPassword: '****',
      hasApiKey: !!gateway.encryptedApiKey,
      senderName: gateway.senderName,
      isActive: gateway.isActive,
      priority: gateway.priority,
      updatedAt: gateway.updatedAt,
    });
  } catch (err) {
    console.error('[gateways:PUT] Error updating gateway config', err);
    return error('Failed to update gateway configuration', 500);
  }
}

// ── DELETE /api/gateways ──────────────────────────────────────────────────────
//
// Remove a gateway configuration.
// Only allowed if it's not the only active gateway for the shop.
//

export async function DELETE(request: NextRequest) {
  try {
    const body = await getRequestBody<{
      id: string;
    }>(request);

    const { id } = body;

    if (!id) {
      return error('Gateway config id is required', 400);
    }

    // Check gateway exists
    const existing = await db.sMSGatewayConfig.findUnique({
      where: { id },
    });

    if (!existing) {
      return error('Gateway configuration not found', 404);
    }

    // Count active gateways for this shop
    const activeCount = await db.sMSGatewayConfig.count({
      where: {
        shopId: existing.shopId,
        isActive: true,
      },
    });

    // Prevent deletion if this is the only active gateway
    if (existing.isActive && activeCount <= 1) {
      return error(
        'Cannot remove the only active gateway. Add another active gateway before removing this one.',
        400
      );
    }

    // Delete the gateway
    await db.sMSGatewayConfig.delete({
      where: { id },
    });

    return success({
      message: 'Gateway configuration deleted successfully',
      deletedGatewayId: id,
      gatewayType: existing.gatewayType,
    });
  } catch (err) {
    console.error('[gateways:DELETE] Error deleting gateway config', err);
    return error('Failed to delete gateway configuration', 500);
  }
}
