/**
 * POST /api/landing/[slug]/cancel
 *
 * Cancels a COD order via its landing page slug.
 *
 * Validates that the landing page:
 * - Exists
 * - Has not already been confirmed
 * - Has not already been cancelled
 * - Has not expired
 *
 * On success, sets isCancelled=true, records cancelledAt timestamp,
 * and updates any associated touchpoint or cart abandonment records.
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error } from '@/lib/api/helpers';

// ── POST /api/landing/[slug]/cancel ──────────────────────────────────────────

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

    // Check if already confirmed (cannot cancel a confirmed order)
    if (landingPage.isConfirmed) {
      return error(
        'This order has already been confirmed and cannot be cancelled. Please contact the store for assistance.',
        409
      );
    }

    // Check if already cancelled
    if (landingPage.isCancelled) {
      return success({
        message: 'Order has already been cancelled',
        landingPageId: landingPage.id,
        slug: landingPage.slug,
        orderName: landingPage.orderName,
        cancelledAt: landingPage.cancelledAt
          ? new Date(landingPage.cancelledAt).toISOString()
          : null,
      });
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

    // Update the landing page — set cancelled
    const updated = await db.landingPage.update({
      where: { slug },
      data: {
        isCancelled: true,
        cancelledAt: new Date(),
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
          flowState: 'expired',
          completedAt: new Date(),
        },
      });
    } catch (touchpointErr) {
      // Non-critical: log but don't fail the cancellation
      console.warn(
        '[landing:cancel] Failed to update touchpoint (non-critical)',
        touchpointErr
      );
    }

    // Update associated cart abandonment — mark as expired since the order was cancelled
    try {
      await db.cartAbandonment.updateMany({
        where: {
          subscriberId: landingPage.subscriberId,
          shopId: landingPage.shopId,
          recoveryStatus: { in: ['pending', 'reminded_1', 'reminded_2', 'reminded_3'] },
        },
        data: {
          recoveryStatus: 'expired',
          abandonReason: 'Order cancelled by customer via COD landing page',
        },
      });
    } catch (cartErr) {
      // Non-critical: log but don't fail the cancellation
      console.warn(
        '[landing:cancel] Failed to update cart abandonment (non-critical)',
        cartErr
      );
    }

    console.info('[landing:cancel] Order cancelled successfully', {
      landingPageId: updated.id,
      slug,
      orderName: updated.orderName,
      shopId: updated.shopId,
    });

    return success({
      message: 'Order cancelled successfully',
      landingPageId: updated.id,
      slug: updated.slug,
      orderName: updated.orderName,
      cancelledAt: updated.cancelledAt!.toISOString(),
    });
  } catch (err) {
    console.error('[landing:cancel] Error cancelling landing page', err);
    return error('Failed to cancel order', 500);
  }
}
