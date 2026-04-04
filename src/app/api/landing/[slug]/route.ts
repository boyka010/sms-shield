/**
 * GET /api/landing/[slug]
 *
 * Public endpoint to fetch landing page data by slug.
 * No authentication required — the slug serves as the access token.
 *
 * Returns all page configuration needed to render the COD confirmation page,
 * including order details, store branding, and expiration status.
 */

import { NextRequest } from 'next/server';
import { getLandingPage } from '@/lib/services/landing-page-generator';
import { success, error } from '@/lib/api/helpers';

// ── GET /api/landing/[slug] ──────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    if (!slug || typeof slug !== 'string' || slug.trim().length === 0) {
      return error('Slug parameter is required', 400);
    }

    // Validate slug format (alphanumeric + hyphens only, 12-20 chars)
    if (!/^[a-zA-Z0-9-]{8,20}$/.test(slug)) {
      return error('Invalid slug format', 400);
    }

    const landingPage = await getLandingPage(slug);

    if (!landingPage) {
      return error('Landing page not found', 404);
    }

    // Check expiration
    const now = new Date();
    const expiresAt = new Date(landingPage.expiresAt);
    const isExpired = now > expiresAt;

    // Parse order details from JSON string
    let parsedOrderDetails: unknown;
    try {
      parsedOrderDetails = JSON.parse(landingPage.orderDetails);
    } catch {
      parsedOrderDetails = [];
    }

    // Build response — include all data needed for rendering
    return success({
      id: landingPage.id,
      slug: landingPage.slug,
      orderName: landingPage.orderName,
      orderId: landingPage.orderId,
      customerName: landingPage.customerName,
      storeName: landingPage.storeName,
      storeLogoUrl: landingPage.storeLogoUrl,
      headline: landingPage.headline,
      subtext: landingPage.subtext,
      confirmButtonText: landingPage.confirmButtonText,
      cancelButtonText: landingPage.cancelButtonText,
      themeColor: landingPage.themeColor,
      orderDetails: parsedOrderDetails,
      orderTotal: landingPage.orderTotal,
      currency: landingPage.currency,
      isConfirmed: landingPage.isConfirmed === true,
      isCancelled: landingPage.isCancelled === true,
      confirmedAt: landingPage.confirmedAt
        ? new Date(landingPage.confirmedAt).toISOString()
        : null,
      cancelledAt: landingPage.cancelledAt
        ? new Date(landingPage.cancelledAt).toISOString()
        : null,
      expiresAt: expiresAt.toISOString(),
      isExpired,
      visitCount: landingPage.visitCount,
      createdAt: new Date(landingPage.createdAt).toISOString(),
      shop: landingPage.shop
        ? {
            domain: landingPage.shop.shopifyDomain,
            isActive: landingPage.shop.isActive,
            currency: landingPage.shop.currency,
          }
        : null,
    });
  } catch (err) {
    console.error('[landing:GET] Error fetching landing page', err);
    return error('Failed to fetch landing page', 500);
  }
}
