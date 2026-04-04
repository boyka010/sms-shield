import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, paginated, getRequestBody } from '@/lib/api/helpers';

// ── Allowed campaign types ─────────────────────────────────────────────────────

const VALID_TYPES = [
  'BROADCAST',
  'ABANDONED_CART',
  'COD_CONFIRMATION',
  'RFM_SEGMENT',
  'CUSTOM',
] as const;

// ── Allowed campaign statuses ──────────────────────────────────────────────────

const VALID_STATUSES = [
  'draft',
  'scheduled',
  'running',
  'paused',
  'completed',
  'failed',
  'cancelled',
] as const;

// ── GET /api/campaigns ────────────────────────────────────────────────────────
//
// List campaigns with filters.
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

    // Status filter
    const status = searchParams.get('status');
    if (status) {
      if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
        return error(`Invalid status: ${status}. Allowed: ${VALID_STATUSES.join(', ')}`, 400);
      }
      where.status = status;
    }

    // Type filter
    const type = searchParams.get('type');
    if (type) {
      if (!VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
        return error(`Invalid type: ${type}. Allowed: ${VALID_TYPES.join(', ')}`, 400);
      }
      where.type = type;
    }

    // Search (by campaign name)
    const search = searchParams.get('search')?.trim();
    if (search) {
      where.name = { contains: search };
    }

    // Fetch campaigns and total count in parallel
    const [campaigns, total] = await Promise.all([
      db.campaign.findMany({
        where,
        select: {
          id: true,
          shopId: true,
          name: true,
          description: true,
          type: true,
          status: true,
          segmentFilter: true,
          senderName: true,
          gatewayType: true,
          scheduledAt: true,
          startedAt: true,
          completedAt: true,
          totalRecipients: true,
          sentCount: true,
          deliveredCount: true,
          failedCount: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      db.campaign.count({ where }),
    ]);

    return paginated(campaigns, total, page, pageSize);
  } catch (err) {
    console.error('[campaigns:GET] Error listing campaigns', err);
    return error('Failed to list campaigns', 500);
  }
}

// ── POST /api/campaigns ───────────────────────────────────────────────────────
//
// Create a new campaign.
//

export async function POST(request: NextRequest) {
  try {
    const body = await getRequestBody<{
      shopId: string;
      name: string;
      type: string;
      messageTemplate: string;
      segmentFilter?: string;
      scheduledAt?: string;
      senderName?: string;
    }>(request);

    const {
      shopId,
      name,
      type,
      messageTemplate,
      segmentFilter,
      scheduledAt,
      senderName,
    } = body;

    // Validate required fields
    if (!shopId) {
      return error('shopId is required', 400);
    }

    if (!name || name.trim().length === 0) {
      return error('Campaign name is required', 400);
    }

    if (!type) {
      return error('Campaign type is required', 400);
    }

    if (!VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
      return error(`Invalid campaign type: ${type}. Allowed: ${VALID_TYPES.join(', ')}`, 400);
    }

    if (!messageTemplate || messageTemplate.trim().length === 0) {
      return error('Message template is required', 400);
    }

    // Validate scheduledAt is not in the past
    if (scheduledAt) {
      const scheduledDate = new Date(scheduledAt);
      if (isNaN(scheduledDate.getTime())) {
        return error('Invalid scheduledAt date format', 400);
      }

      if (scheduledDate <= new Date()) {
        return error('scheduledAt must be in the future', 400);
      }
    }

    // Verify shop exists
    const shop = await db.shop.findUnique({
      where: { id: shopId },
    });

    if (!shop) {
      return error('Shop not found', 404);
    }

    // Create the campaign
    const campaign = await db.campaign.create({
      data: {
        shopId,
        name: name.trim(),
        type,
        messageTemplate: messageTemplate.trim(),
        status: 'draft',
        segmentFilter: segmentFilter ?? null,
        senderName: senderName ?? null,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      },
    });

    return success({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        type: campaign.type,
        status: campaign.status,
        messageTemplate: campaign.messageTemplate,
        segmentFilter: campaign.segmentFilter,
        senderName: campaign.senderName,
        scheduledAt: campaign.scheduledAt,
        createdAt: campaign.createdAt,
      },
    }, 201);
  } catch (err) {
    console.error('[campaigns:POST] Error creating campaign', err);
    return error('Failed to create campaign', 500);
  }
}
