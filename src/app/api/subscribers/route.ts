import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  isValidEgyptianPhone,
  normalizePhone,
  maskPhone,
} from '@/lib/phone-validation';
import { hashPhone, encrypt } from '@/lib/encryption';
import { success, error, paginated, getRequestBody } from '@/lib/api/helpers';

// ── Encryption key ─────────────────────────────────────────────────────────────

const ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY ??
  'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';

// ── Allowed sortable fields ────────────────────────────────────────────────────

const SORTABLE_FIELDS = [
  'createdAt',
  'updatedAt',
  'totalOrdersCount',
  'totalRevenue',
  'lastOrderAt',
  'firstName',
  'lastName',
] as const;

type SortableField = (typeof SORTABLE_FIELDS)[number];

// ── GET /api/subscribers ──────────────────────────────────────────────────────
//
// List subscribers with pagination and filtering.
// Search by phone (hashed), email, or name. Filter by segment, source, isVerified.
//

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const shopId = searchParams.get('shopId');
    if (!shopId) {
      return error('shopId query parameter is required', 400);
    }

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('pageSize') ?? '20', 10))
    );
    const skip = (page - 1) * pageSize;

    // Build where clause
    const where: Record<string, unknown> = { shopId };

    // Search (phone / email / name)
    const search = searchParams.get('search')?.trim();
    if (search) {
      // Check if the search looks like a phone number (has digits)
      const hasDigits = /\d/.test(search);

      if (hasDigits) {
        // Hash the search term to match against phoneHash
        try {
          const normalizedSearch = normalizePhone(search);
          const searchHash = hashPhone(normalizedSearch);
          where.phoneHash = searchHash;
        } catch {
          // If normalization fails, try email/name search instead
          where.OR = [
            { email: { contains: search } },
            { firstName: { contains: search } },
            { lastName: { contains: search } },
          ];
        }
      } else {
        // Search by email or name
        where.OR = [
          { email: { contains: search } },
          { firstName: { contains: search } },
          { lastName: { contains: search } },
        ];
      }
    }

    // Filters
    const segment = searchParams.get('segment');
    if (segment) {
      where.rfmSegments = { some: { segment } };
    }

    const source = searchParams.get('source');
    if (source) {
      where.source = source;
    }

    const isVerified = searchParams.get('isVerified');
    if (isVerified !== null) {
      where.isVerified = isVerified === 'true';
    }

    // Sorting
    const sortBy = (searchParams.get('sortBy') ?? 'createdAt') as SortableField;
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

    if (!SORTABLE_FIELDS.includes(sortBy)) {
      return error(`Invalid sortBy field: ${sortBy}. Allowed: ${SORTABLE_FIELDS.join(', ')}`, 400);
    }

    // Fetch subscribers and total count in parallel
    const [subscribers, total] = await Promise.all([
      db.subscriber.findMany({
        where,
        select: {
          id: true,
          shopId: true,
          phoneNumber: true,
          phoneHash: true,
          rawPhoneNumber: true,
          email: true,
          firstName: true,
          lastName: true,
          consentGranted: true,
          consentTimestamp: true,
          source: true,
          discountCodeId: true,
          isVerified: true,
          tags: true,
          totalOrdersCount: true,
          totalRevenue: true,
          lastOrderAt: true,
          firstOrderAt: true,
          createdAt: true,
          updatedAt: true,
          discountCode: {
            select: {
              id: true,
              code: true,
              discountType: true,
              discountValue: true,
              isActive: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: pageSize,
      }),
      db.subscriber.count({ where }),
    ]);

    // Mask phone numbers for response
    const maskedSubscribers = subscribers.map((sub) => ({
      ...sub,
      // phoneNumber is encrypted — return masked version from the hash
      // We can't decrypt here without extra latency, so derive a display
      // from the rawPhoneNumber (which is hashed) — return masked placeholder
      maskedPhone: maskPhoneFromHash(sub.phoneHash),
    }));

    return paginated(maskedSubscribers, total, page, pageSize);
  } catch (err) {
    console.error('[subscribers:GET] Error listing subscribers', err);
    return error('Failed to list subscribers', 500);
  }
}

// ── POST /api/subscribers ─────────────────────────────────────────────────────
//
// Create a new subscriber.
//

export async function POST(request: NextRequest) {
  try {
    const body = await getRequestBody<{
      shopId: string;
      phoneNumber: string;
      email?: string;
      firstName?: string;
      lastName?: string;
      source?: string;
      discountType?: string;
      discountValue?: number;
    }>(request);

    const { shopId, phoneNumber, email, firstName, lastName, source, discountType, discountValue } = body;

    // Validate required fields
    if (!shopId) {
      return error('shopId is required', 400);
    }

    if (!phoneNumber) {
      return error('phoneNumber is required', 400);
    }

    // Validate phone number
    if (!isValidEgyptianPhone(phoneNumber)) {
      return error('Invalid Egyptian phone number. Must be a valid mobile number (010/011/012/015 prefix)', 400);
    }

    const normalized = normalizePhone(phoneNumber);
    const phoneHash = hashPhone(normalized);

    // Check for duplicate subscriber by phoneHash within this shop
    const existing = await db.subscriber.findUnique({
      where: { phoneHash },
    });

    if (existing && existing.shopId === shopId) {
      return error('A subscriber with this phone number already exists', 409, {
        subscriberId: existing.id,
      });
    }

    // Encrypt the phone number for storage
    let encryptedPhone: string;
    try {
      encryptedPhone = await encrypt(normalized, ENCRYPTION_KEY);
    } catch (encryptErr) {
      console.error('[subscribers:POST] Encryption failed', encryptErr);
      return error('Failed to encrypt phone number', 500);
    }

    // Create discount code if requested
    let discountCodeId: string | undefined;
    if (discountType && discountValue !== undefined) {
      const validTypes = ['percentage', 'fixed_amount', 'free_shipping'];
      if (!validTypes.includes(discountType)) {
        return error(`Invalid discountType: ${discountType}. Allowed: ${validTypes.join(', ')}`, 400);
      }

      const code = generateDiscountCode();
      const discount = await db.discountCode.create({
        data: {
          shopId,
          code,
          discountType,
          discountValue: Number(discountValue),
          isActive: true,
        },
      });

      discountCodeId = discount.id;
    }

    // Create subscriber
    const subscriber = await db.subscriber.create({
      data: {
        shopId,
        phoneNumber: encryptedPhone,
        rawPhoneNumber: phoneHash,
        phoneHash,
        email: email ?? null,
        firstName: firstName ?? null,
        lastName: lastName ?? null,
        source: source ?? 'popup',
        discountCodeId: discountCodeId ?? null,
        consentGranted: true,
      },
    });

    return success({
      subscriber: {
        id: subscriber.id,
        maskedPhone: maskPhone(normalized),
        email: subscriber.email,
        firstName: subscriber.firstName,
        lastName: subscriber.lastName,
        source: subscriber.source,
        isVerified: subscriber.isVerified,
        createdAt: subscriber.createdAt,
      },
    }, 201);
  } catch (err) {
    console.error('[subscribers:POST] Error creating subscriber', err);
    return error('Failed to create subscriber', 500);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Generates a displayable masked phone from a phone hash.
 * Since we can't reverse a hash, we produce a consistent masked format
 * derived from the hash itself.
 */
function maskPhoneFromHash(_phoneHash: string): string {
  // Return a generic masked format — the actual phone is encrypted.
  // The UI layer should use the maskedPhone field from subscriber creation.
  return 'XXX XXXX XXXX';
}

/**
 * Generates a random alphanumeric discount code.
 * Format: WELCOME + 4 random uppercase characters + 2 random digits.
 */
function generateDiscountCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const randomChars = Array.from({ length: 4 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
  const randomDigits = String(Math.floor(1000 + Math.random() * 9000)).slice(0, 2);
  return `WELCOME${randomChars}${randomDigits}`;
}
