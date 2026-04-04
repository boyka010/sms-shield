import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  isValidEgyptianPhone,
  normalizePhone,
  maskPhone,
} from '@/lib/phone-validation';
import { hashPhone, encrypt } from '@/lib/encryption';
import { success, error, getRequestBody } from '@/lib/api/helpers';

// ── Encryption key ─────────────────────────────────────────────────────────────

const ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY ??
  'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';

// ── POST /api/subscribe ───────────────────────────────────────────────────────
//
// Frontend capture endpoint (called by the storefront pop-up).
// Validates phone, creates or finds subscriber, generates a discount code.
//

export async function POST(request: NextRequest) {
  try {
    const body = await getRequestBody<{
      shopId: string;
      phoneNumber: string;
      source?: string;
    }>(request);

    const { shopId, phoneNumber, source } = body;

    // ── Validate required fields ────────────────────────────────────────
    if (!shopId) {
      return error('shopId is required', 400);
    }

    if (!phoneNumber) {
      return error('phoneNumber is required', 400);
    }

    // ── Validate phone number ───────────────────────────────────────────
    if (!isValidEgyptianPhone(phoneNumber)) {
      return error(
        'Invalid Egyptian phone number. Must be a valid mobile number (010/011/012/015 prefix).',
        400,
      );
    }

    const normalized = normalizePhone(phoneNumber);
    const phoneHash = hashPhone(normalized);

    // ── Verify shop exists ──────────────────────────────────────────────
    const shop = await db.shop.findUnique({
      where: { id: shopId },
    });

    if (!shop) {
      return error('Shop not found', 404);
    }

    // ── Get shop settings for discount config ───────────────────────────
    const settings = await db.shopSettings.findUnique({
      where: { shopId },
    });

    const discountType = settings?.discountType ?? 'percentage';
    const discountValue = settings?.discountValue ?? 10;

    // ── Check for existing subscriber ───────────────────────────────────
    const existing = await db.subscriber.findUnique({
      where: { phoneHash },
      include: {
        discountCode: {
          select: {
            id: true,
            code: true,
            isActive: true,
          },
        },
      },
    });

    // If subscriber already exists for this shop, return existing discount code
    if (existing && existing.shopId === shopId) {
      const existingCode = existing.discountCode;

      if (existingCode && existingCode.isActive) {
        return success({
          subscriberId: existing.id,
          isNew: false,
          discountCode: existingCode.code,
          message: `Welcome back! Your discount code ${existingCode.code} is still active.`,
        });
      }

      // Subscriber exists but no active discount code — generate a new one
      const newCode = await generateDiscountCode(shopId, discountType, discountValue);

      await db.subscriber.update({
        where: { id: existing.id },
        data: {
          discountCodeId: newCode.id,
          consentGranted: true,
          consentTimestamp: new Date(),
        },
      });

      return success({
        subscriberId: existing.id,
        isNew: false,
        discountCode: newCode.code,
        message: `Your new discount code ${newCode.code} has been generated!`,
      });
    }

    // ── Encrypt phone number ────────────────────────────────────────────
    let encryptedPhone: string;
    try {
      encryptedPhone = await encrypt(normalized, ENCRYPTION_KEY);
    } catch (encryptErr) {
      console.error('[subscribe:POST] Encryption failed', encryptErr);
      return error('Failed to process subscription', 500);
    }

    // ── Generate discount code ──────────────────────────────────────────
    const discountCode = await generateDiscountCode(shopId, discountType, discountValue);

    // ── Create new subscriber ───────────────────────────────────────────
    const subscriber = await db.subscriber.create({
      data: {
        shopId,
        phoneNumber: encryptedPhone,
        rawPhoneNumber: phoneHash,
        phoneHash,
        consentGranted: true,
        consentTimestamp: new Date(),
        source: source ?? 'popup',
        discountCodeId: discountCode.id,
      },
    });

    return success({
      subscriberId: subscriber.id,
      isNew: true,
      discountCode: discountCode.code,
      maskedPhone: maskPhone(normalized),
      message: `Welcome! Your discount code ${discountCode.code} gives you ${discountType === 'percentage' ? `${discountValue}%` : discountValue} off.`,
    }, 201);
  } catch (err) {
    console.error('[subscribe:POST] Error processing subscription', err);
    return error('Failed to process subscription', 500);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Generates a random alphanumeric discount code and stores it in the DB.
 */
async function generateDiscountCode(
  shopId: string,
  discountType: string,
  discountValue: number,
) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const randomChars = Array.from({ length: 4 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
  const randomDigits = String(Math.floor(1000 + Math.random() * 9000)).slice(0, 2);
  const code = `WELCOME${randomChars}${randomDigits}`;

  return db.discountCode.create({
    data: {
      shopId,
      code,
      discountType,
      discountValue: Number(discountValue),
      isActive: true,
    },
  });
}
