/**
 * POST /api/landing/[slug]/confirm
 *
 * Confirms a COD order via its landing page slug.
 *
 * Validates that the landing page:
 * - Exists
 * - Has not already been confirmed
 * - Has not already been cancelled
 * - Has not expired
 *
 * On success, sets isConfirmed=true, records confirmedAt timestamp,
 * and updates any associated touchpoint or cart abandonment records.
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error } from '@/lib/api/helpers';

// ── POST /api/landing/[slug]/confirm ─────────────────────────────────────────

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    if (!slug || typeof slug !== 'string' || slug.trim().length === 0) {
      return error('Slug parameter is required', 400);
    }

    // Validate slug format
    if (!/^[a-zA-Z0-9-]{8,20}$/.test(slug)) {
      return error('Invalid slug format', 400);
    }

    // Fetch the landing page
    const landingPage = await db.landingPage.findUnique({
      where: { slug },
    });

    if (!landingPage) {
      return error('Landing page not found', 404);
    }

    // Check if already confirmed
    if (landingPage.isConfirmed) {
      return success({
        message: 'Order has already been confirmed',
        landingPageId: landingPage.id,
        slug: landingPage.slug,
        orderName: landingPage.orderName,
        confirmedAt: landingPage.confirmedAt
          ? new Date(landingPage.confirmedAt).toISOString()
          : null,
      });
    }

    // Check if already cancelled
    if (landingPage.isCancelled) {
      return error(
        'This order has already been cancelled and cannot be confirmed',
        409
      );
    }

    // Check expiration
    const now = new Date();
    const expiresAt = new Date(landingPage.expiresAt);
    if (now > expiresAt) {
      return error(
        'This landing page has expired. Please contact the store for assistance.',
        410
      );
    }

    // Update the landing page — set confirmed
    const updated = await db.landingPage.update({
      where: { slug },
      data: {
        isConfirmed: true,
        confirmedAt: new Date(),
      },
    });

    // Update associated touchpoint if one exists with COD_CONFIRMATION flow type
    try {
      await db.touchPoint.updateMany({
        where: {
          subscriberId: landingPage.subscriberId,
          shopId: landingPage.shopId,
          flowType: 'COD_CONFIRMATION',
          flowState: { in: ['initialized', 'in_progress'] },
          isExpired: false,
        },
        data: {
          flowState: 'completed',
          completedAt: new Date(),
        },
      });
    } catch (touchpointErr) {
      // Non-critical: log but don't fail the confirmation
      console.warn(
        '[landing:confirm] Failed to update touchpoint (non-critical)',
        touchpointErr
      );
    }

    // Update associated cart abandonment if one exists for this subscriber
    try {
      await db.cartAbandonment.updateMany({
        where: {
          subscriberId: landingPage.subscriberId,
          shopId: landingPage.shopId,
          recoveryStatus: { in: ['pending', 'reminded_1', 'reminded_2', 'reminded_3'] },
        },
        data: {
          recoveryStatus: 'recovered',
          recoveredAt: new Date(),
        },
      });
    } catch (cartErr) {
      // Non-critical: log but don't fail the confirmation
      console.warn(
        '[landing:confirm] Failed to update cart abandonment (non-critical)',
        cartErr
      );
    }

    console.info('[landing:confirm] Order confirmed successfully', {
      landingPageId: updated.id,
      slug,
      orderName: updated.orderName,
      shopId: updated.shopId,
    });

    return success({
      message: 'Order confirmed successfully',
      landingPageId: updated.id,
      slug: updated.slug,
      orderName: updated.orderName,
      confirmedAt: updated.confirmedAt!.toISOString(),
    });
  } catch (err) {
    console.error('[landing:confirm] Error confirming landing page', err);
    return error('Failed to confirm order', 500);
  }
}
