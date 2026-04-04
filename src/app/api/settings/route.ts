import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestBody } from '@/lib/api/helpers';

// ── Allowed updatable settings fields ─────────────────────────────────────────

const UPDATABLE_FIELDS = [
  'popupEnabled',
  'popupDelaySeconds',
  'popupHeadline',
  'popupSubtext',
  'discountType',
  'discountValue',
  'buttonColor',
  'buttonTextColor',
  'smsConsentText',
  'codConfirmationEnabled',
  'autoApplyDiscount',
  'maxRetriesPerGateway',
  'smsRetryIntervalMinutes',
] as const;

// ── GET /api/settings ─────────────────────────────────────────────────────────
//
// Get settings for a shop. Returns ShopSettings record or defaults
// if no settings exist yet.
//

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const shopId = searchParams.get('shopId');
    if (!shopId) {
      return error('shopId query parameter is required', 400);
    }

    // Verify shop exists
    const shop = await db.shop.findUnique({
      where: { id: shopId },
    });

    if (!shop) {
      return error('Shop not found', 404);
    }

    // Find settings or return null (caller can use defaults)
    let settings = await db.shopSettings.findUnique({
      where: { shopId },
    });

    // Auto-create settings if they don't exist yet
    if (!settings) {
      settings = await db.shopSettings.create({
        data: { shopId },
      });
    }

    return success({
      id: settings.id,
      shopId: settings.shopId,
      popupEnabled: settings.popupEnabled,
      popupDelaySeconds: settings.popupDelaySeconds,
      popupHeadline: settings.popupHeadline,
      popupSubtext: settings.popupSubtext,
      discountType: settings.discountType,
      discountValue: settings.discountValue,
      buttonColor: settings.buttonColor,
      buttonTextColor: settings.buttonTextColor,
      smsConsentText: settings.smsConsentText,
      codConfirmationEnabled: settings.codConfirmationEnabled,
      autoApplyDiscount: settings.autoApplyDiscount,
      maxRetriesPerGateway: settings.maxRetriesPerGateway,
      smsRetryIntervalMinutes: settings.smsRetryIntervalMinutes,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    });
  } catch (err) {
    console.error('[settings:GET] Error fetching settings', err);
    return error('Failed to fetch settings', 500);
  }
}

// ── PUT /api/settings ─────────────────────────────────────────────────────────
//
// Update settings for a shop. Upserts if no settings exist.
//

export async function PUT(request: NextRequest) {
  try {
    const body = await getRequestBody<{
      shopId: string;
      popupEnabled?: boolean;
      popupDelaySeconds?: number;
      popupHeadline?: string;
      popupSubtext?: string;
      discountType?: string;
      discountValue?: number;
      buttonColor?: string;
      buttonTextColor?: string;
      smsConsentText?: string;
      codConfirmationEnabled?: boolean;
      autoApplyDiscount?: boolean;
      maxRetriesPerGateway?: number;
      smsRetryIntervalMinutes?: number;
    }>(request);

    const { shopId } = body;

    if (!shopId) {
      return error('shopId is required', 400);
    }

    // Verify shop exists
    const shop = await db.shop.findUnique({
      where: { id: shopId },
    });

    if (!shop) {
      return error('Shop not found', 404);
    }

    // Build update data from provided fields only
    const updateData: Record<string, unknown> = {};

    for (const field of UPDATABLE_FIELDS) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Validate numeric fields if provided
    if (updateData.popupDelaySeconds !== undefined) {
      const val = Number(updateData.popupDelaySeconds);
      if (isNaN(val) || val < 0 || val > 60) {
        return error('popupDelaySeconds must be between 0 and 60', 400);
      }
      updateData.popupDelaySeconds = val;
    }

    if (updateData.discountValue !== undefined) {
      const val = Number(updateData.discountValue);
      if (isNaN(val) || val < 0) {
        return error('discountValue must be a non-negative number', 400);
      }
      updateData.discountValue = val;
    }

    if (updateData.maxRetriesPerGateway !== undefined) {
      const val = Number(updateData.maxRetriesPerGateway);
      if (isNaN(val) || val < 0 || val > 10) {
        return error('maxRetriesPerGateway must be between 0 and 10', 400);
      }
      updateData.maxRetriesPerGateway = val;
    }

    if (updateData.smsRetryIntervalMinutes !== undefined) {
      const val = Number(updateData.smsRetryIntervalMinutes);
      if (isNaN(val) || val < 1 || val > 1440) {
        return error('smsRetryIntervalMinutes must be between 1 and 1440', 400);
      }
      updateData.smsRetryIntervalMinutes = val;
    }

    // Validate discount type if provided
    if (updateData.discountType !== undefined) {
      const validTypes = ['percentage', 'fixed_amount', 'free_shipping'];
      if (!validTypes.includes(updateData.discountType as string)) {
        return error(`Invalid discountType. Allowed: ${validTypes.join(', ')}`, 400);
      }
    }

    // Upsert settings
    const settings = await db.shopSettings.upsert({
      where: { shopId },
      create: {
        shopId,
        ...updateData,
      },
      update: updateData,
    });

    return success({
      id: settings.id,
      shopId: settings.shopId,
      popupEnabled: settings.popupEnabled,
      popupDelaySeconds: settings.popupDelaySeconds,
      popupHeadline: settings.popupHeadline,
      popupSubtext: settings.popupSubtext,
      discountType: settings.discountType,
      discountValue: settings.discountValue,
      buttonColor: settings.buttonColor,
      buttonTextColor: settings.buttonTextColor,
      smsConsentText: settings.smsConsentText,
      codConfirmationEnabled: settings.codConfirmationEnabled,
      autoApplyDiscount: settings.autoApplyDiscount,
      maxRetriesPerGateway: settings.maxRetriesPerGateway,
      smsRetryIntervalMinutes: settings.smsRetryIntervalMinutes,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    });
  } catch (err) {
    console.error('[settings:PUT] Error updating settings', err);
    return error('Failed to update settings', 500);
  }
}
