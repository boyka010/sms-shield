/**
 * SMS-Shield Landing Page Generator Service
 *
 * Core service for generating COD (Cash on Delivery) confirmation landing pages.
 * Creates personalized, branded landing pages for COD orders that allow customers
 * to confirm or cancel their orders via a unique, time-limited URL.
 *
 * Each landing page:
 * - Has a unique slug for URL access
 * - Expires after 24 hours by default
 * - Tracks confirmation/cancellation status
 * - Stores full order details as JSON
 * - Links to subscriber and shop records
 */

import { db } from '@/lib/db';
import { createLogger } from '@/lib/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GenerateLandingPageInput {
  shopId: string;
  subscriberId: string;
  orderId: string;
  orderName: string;
  customerName: string;
  storeName: string;
  storeLogoUrl?: string;
  lineItems: Array<{
    title: string;
    quantity: number;
    price: number;
    image?: string;
  }>;
  orderTotal: number;
  currency?: string;
  themeColor?: string;
}

interface LandingPageResult {
  success: boolean;
  landingPage: {
    id: string;
    slug: string;
    confirmUrl: string;
    cancelUrl: string;
  };
}

interface LandingPageData {
  id: string;
  shopId: string;
  slug: string;
  orderName: string;
  orderId: string | null;
  storeName: string;
  storeLogoUrl: string | null;
  headline: string;
  subtext: string;
  confirmButtonText: string;
  cancelButtonText: string;
  themeColor: string;
  orderDetails: string;
  orderTotal: number;
  currency: string;
  customerName: string | null;
  isConfirmed: boolean | null;
  isCancelled: boolean | null;
  confirmedAt: Date | string | null;
  cancelledAt: Date | string | null;
  expiresAt: Date;
  visitCount: number;
  createdAt: Date;
  updatedAt: Date;
  shop?: {
    id: string;
    shopifyDomain: string;
    isActive: boolean;
    currency: string;
  } | null;
}

interface ConfirmResult {
  success: boolean;
  landingPageId: string;
  slug: string;
  confirmedAt: string;
  orderName: string;
}

interface CancelResult {
  success: boolean;
  landingPageId: string;
  slug: string;
  cancelledAt: string;
  orderName: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_THEME_COLOR = '#059669'; // Emerald
const DEFAULT_CURRENCY = 'EGP';
const LANDING_PAGE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Logger ───────────────────────────────────────────────────────────────────

const log = createLogger('landing-page-generator');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generates a unique URL-safe slug for a landing page.
 * Format: 8-char UUID fragment + 4-char UUID fragment (12 chars total).
 */
function generateSlug(): string {
  return crypto.randomUUID().slice(0, 8) + crypto.randomUUID().slice(0, 4);
}

/**
 * Returns the base URL for constructing landing page URLs.
 * Uses NEXT_PUBLIC_APP_URL or falls back to localhost.
 */
function getBaseUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    return appUrl.replace(/\/$/, '');
  }
  return process.env.NODE_ENV === 'production'
    ? 'https://app.sms-shield.com'
    : 'http://localhost:3000';
}

// ─── Public Functions ─────────────────────────────────────────────────────────

/**
 * Generates a new COD confirmation landing page.
 *
 * Creates a personalized, branded landing page for a COD order with:
 * - Unique slug-based URL
 * - Order details (line items, total, currency)
 * - Store branding (name, logo, theme color)
 * - 24-hour expiration
 * - Confirm/Cancel action buttons
 *
 * @param input - All required data to generate the landing page
 * @returns The created landing page metadata including confirm/cancel URLs
 * @throws {Error} If slug generation or database creation fails
 */
export async function generateLandingPage(
  input: GenerateLandingPageInput
): Promise<LandingPageResult> {
  const {
    shopId,
    subscriberId,
    orderId,
    orderName,
    customerName,
    storeName,
    storeLogoUrl,
    lineItems,
    orderTotal,
    currency,
    themeColor,
  } = input;

  log.info('Generating COD landing page', {
    shopId,
    subscriberId,
    orderId,
    orderName,
  });

  // Generate a unique slug
  const slug = generateSlug();

  // Build the landing page record
  const landingPage = await db.landingPage.create({
    data: {
      shopId,
      subscriberId,
      orderId,
      orderName,
      slug,
      storeName,
      storeLogoUrl: storeLogoUrl ?? null,
      headline: `Confirm Your Order #${orderName}`,
      subtext: 'Please review and confirm your Cash on Delivery order below',
      confirmButtonText: '\u2705 Confirm My Order',
      cancelButtonText: '\u274C Cancel Order',
      themeColor: themeColor ?? DEFAULT_THEME_COLOR,
      orderDetails: JSON.stringify(lineItems),
      orderTotal,
      currency: currency ?? DEFAULT_CURRENCY,
      customerName: customerName ?? null,
      expiresAt: new Date(Date.now() + LANDING_PAGE_TTL_MS),
    },
  });

  const baseUrl = getBaseUrl();

  log.info('Landing page created successfully', {
    landingPageId: landingPage.id,
    slug,
    shopId,
  });

  return {
    success: true,
    landingPage: {
      id: landingPage.id,
      slug,
      confirmUrl: `${baseUrl}/api/landing/${slug}/confirm`,
      cancelUrl: `${baseUrl}/api/landing/${slug}/cancel`,
    },
  };
}

/**
 * Retrieves a landing page by its unique slug.
 *
 * Fetches the landing page along with its associated shop record.
 * Increments the visit counter on each fetch.
 *
 * @param slug - The unique URL slug for the landing page
 * @returns The landing page data or null if not found
 */
export async function getLandingPage(
  slug: string
): Promise<LandingPageData | null> {
  log.info('Fetching landing page by slug', { slug });

  // Increment visit count atomically while fetching
  const landingPage = await db.landingPage.update({
    where: { slug },
    data: {
      visitCount: {
        increment: 1,
      },
    },
    include: {
      shop: {
        select: {
          id: true,
          shopifyDomain: true,
          isActive: true,
          currency: true,
        },
      },
    },
  });

  if (!landingPage) {
    log.warn('Landing page not found', { slug });
    return null;
  }

  return landingPage;
}

/**
 * Confirms a COD order via its landing page.
 *
 * Sets the landing page as confirmed with a timestamp.
 * This action is idempotent — if already confirmed, returns current state.
 *
 * @param slug - The unique URL slug for the landing page
 * @returns Confirmation result with timestamps, or throws on error
 * @throws {Error} If landing page not found
 */
export async function confirmLandingPage(slug: string): Promise<ConfirmResult> {
  log.info('Confirming landing page', { slug });

  const landingPage = await db.landingPage.findUnique({
    where: { slug },
  });

  if (!landingPage) {
    log.error('Landing page not found for confirmation', { slug });
    throw new Error(`Landing page with slug "${slug}" not found`);
  }

  // Idempotent: if already confirmed, return current state
  if (landingPage.isConfirmed) {
    log.info('Landing page already confirmed', {
      slug,
      landingPageId: landingPage.id,
    });
    return {
      success: true,
      landingPageId: landingPage.id,
      slug,
      confirmedAt: landingPage.confirmedAt!.toISOString(),
      orderName: landingPage.orderName,
    };
  }

  // Update the landing page
  const updated = await db.landingPage.update({
    where: { slug },
    data: {
      isConfirmed: true,
      confirmedAt: new Date(),
    },
  });

  log.info('Landing page confirmed successfully', {
    landingPageId: updated.id,
    slug,
    orderName: updated.orderName,
  });

  return {
    success: true,
    landingPageId: updated.id,
    slug,
    confirmedAt: updated.confirmedAt!.toISOString(),
    orderName: updated.orderName,
  };
}

/**
 * Cancels a COD order via its landing page.
 *
 * Sets the landing page as cancelled with a timestamp.
 * This action is idempotent — if already cancelled, returns current state.
 *
 * @param slug - The unique URL slug for the landing page
 * @returns Cancellation result with timestamps, or throws on error
 * @throws {Error} If landing page not found
 */
export async function cancelLandingPage(slug: string): Promise<CancelResult> {
  log.info('Cancelling landing page', { slug });

  const landingPage = await db.landingPage.findUnique({
    where: { slug },
  });

  if (!landingPage) {
    log.error('Landing page not found for cancellation', { slug });
    throw new Error(`Landing page with slug "${slug}" not found`);
  }

  // Idempotent: if already cancelled, return current state
  if (landingPage.isCancelled) {
    log.info('Landing page already cancelled', {
      slug,
      landingPageId: landingPage.id,
    });
    return {
      success: true,
      landingPageId: landingPage.id,
      slug,
      cancelledAt: landingPage.cancelledAt!.toISOString(),
      orderName: landingPage.orderName,
    };
  }

  // Update the landing page
  const updated = await db.landingPage.update({
    where: { slug },
    data: {
      isCancelled: true,
      cancelledAt: new Date(),
    },
  });

  log.info('Landing page cancelled successfully', {
    landingPageId: updated.id,
    slug,
    orderName: updated.orderName,
  });

  return {
    success: true,
    landingPageId: updated.id,
    slug,
    cancelledAt: updated.cancelledAt!.toISOString(),
    orderName: updated.orderName,
  };
}
