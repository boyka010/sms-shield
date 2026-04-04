import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestBody } from '@/lib/api/helpers';

// ── Valid plan tiers ───────────────────────────────────────────────────────────

const VALID_PLANS = ['free', 'starter', 'pro', 'enterprise'] as const;

// ── GET /api/shop ─────────────────────────────────────────────────────────────
//
// Get shop info by domain.
//

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const shopDomain = searchParams.get('shopDomain');
    if (!shopDomain) {
      return error('shopDomain query parameter is required', 400);
    }

    const shop = await db.shop.findUnique({
      where: { shopifyDomain: shopDomain },
      select: {
        id: true,
        shopifyDomain: true,
        isActive: true,
        plan: true,
        currency: true,
        installedAt: true,
        updatedAt: true,
        // Include relation counts
        _count: {
          select: {
            subscribers: true,
            campaigns: true,
            discountCodes: true,
            gateways: true,
            webhookEvents: true,
          },
        },
      },
    });

    if (!shop) {
      return error('Shop not found', 404);
    }

    return success({
      id: shop.id,
      shopifyDomain: shop.shopifyDomain,
      isActive: shop.isActive,
      plan: shop.plan,
      currency: shop.currency,
      installedAt: shop.installedAt,
      updatedAt: shop.updatedAt,
      stats: {
        subscribers: shop._count.subscribers,
        campaigns: shop._count.campaigns,
        discountCodes: shop._count.discountCodes,
        gateways: shop._count.gateways,
        webhookEvents: shop._count.webhookEvents,
      },
    });
  } catch (err) {
    console.error('[shop:GET] Error fetching shop', err);
    return error('Failed to fetch shop', 500);
  }
}

// ── POST /api/shop ────────────────────────────────────────────────────────────
//
// Create/register a new shop with default settings.
//

export async function POST(request: NextRequest) {
  try {
    const body = await getRequestBody<{
      shopifyDomain: string;
      shopifyToken: string;
      plan?: string;
    }>(request);

    const { shopifyDomain, shopifyToken, plan } = body;

    // Validate required fields
    if (!shopifyDomain) {
      return error('shopifyDomain is required', 400);
    }

    if (!shopifyToken) {
      return error('shopifyToken is required', 400);
    }

    // Validate plan
    const selectedPlan = plan ?? 'free';
    if (!VALID_PLANS.includes(selectedPlan as (typeof VALID_PLANS)[number])) {
      return error(`Invalid plan: ${selectedPlan}. Allowed: ${VALID_PLANS.join(', ')}`, 400);
    }

    // Check for existing shop (idempotent — update if exists)
    const existing = await db.shop.findUnique({
      where: { shopifyDomain },
    });

    if (existing) {
      // Reactivate and update existing shop
      const updatedShop = await db.shop.update({
        where: { id: existing.id },
        data: {
          shopifyToken,
          isActive: true,
          plan: selectedPlan,
          updatedAt: new Date(),
        },
      });

      return success({
        shop: {
          id: updatedShop.id,
          shopifyDomain: updatedShop.shopifyDomain,
          isActive: updatedShop.isActive,
          plan: updatedShop.plan,
          message: 'Shop reactivated and updated',
        },
      });
    }

    // Create new shop with default settings in a transaction
    const newShop = await db.$transaction(async (tx) => {
      // Create shop
      const shop = await tx.shop.create({
        data: {
          shopifyDomain,
          shopifyToken,
          plan: selectedPlan,
          isActive: true,
        },
      });

      // Create default settings
      await tx.shopSettings.create({
        data: {
          shopId: shop.id,
        },
      });

      return shop;
    });

    return success({
      shop: {
        id: newShop.id,
        shopifyDomain: newShop.shopifyDomain,
        isActive: newShop.isActive,
        plan: newShop.plan,
        currency: newShop.currency,
        installedAt: newShop.installedAt,
        message: 'Shop registered successfully with default settings',
      },
    }, 201);
  } catch (err) {
    console.error('[shop:POST] Error creating shop', err);
    return error('Failed to register shop', 500);
  }
}
