/**
 * GET /api/export
 *
 * Data export API for downloading subscriber data as CSV.
 *
 * Query parameters:
 * - shopId (required): The shop to export subscribers from
 * - format (optional): Export format — only "csv" is supported (default: "csv")
 * - segment (optional): RFM segment filter (e.g., "CHAMPION", "LOYAL", "AT_RISK")
 * - source (optional): Subscriber source filter (e.g., "popup", "checkout", "api", "import")
 * - isVerified (optional): Filter by verification status ("true" / "false")
 *
 * Returns a streaming CSV response with phone numbers masked for privacy.
 * Uses Content-Disposition header to trigger a file download.
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { error } from '@/lib/api/helpers';

// ── Constants ────────────────────────────────────────────────────────────────

const CSV_HEADERS = [
  'Phone',
  'Name',
  'Email',
  'Segment',
  'Source',
  'Total Orders',
  'Total Revenue (EGP)',
  'Last Order',
  'Verified',
  'Joined Date',
];

const BATCH_SIZE = 500; // Fetch subscribers in batches to avoid memory pressure

// ── Types ────────────────────────────────────────────────────────────────────

interface SubscriberRow {
  id: string;
  phoneHash: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  source: string;
  isVerified: boolean;
  totalOrdersCount: number;
  totalRevenue: number;
  lastOrderAt: Date | string | null;
  createdAt: Date | string;
  segment: string | null;
}

// ── GET /api/export ──────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // ── Validate required parameters ────────────────────────────────────────

    const shopId = searchParams.get('shopId');
    if (!shopId) {
      return error('shopId query parameter is required', 400);
    }

    const format = searchParams.get('format') ?? 'csv';
    if (format !== 'csv') {
      return error('Unsupported export format. Only "csv" is supported.', 400);
    }

    // ── Build where clause ──────────────────────────────────────────────────

    const where: Record<string, unknown> = { shopId, consentGranted: true };

    // Optional segment filter
    const segment = searchParams.get('segment');
    if (segment && segment.trim().length > 0) {
      where.rfmSegments = {
        some: {
          segment: segment.trim().toUpperCase(),
        },
      };
    }

    // Optional source filter
    const source = searchParams.get('source');
    if (source && source.trim().length > 0) {
      const validSources = ['popup', 'checkout', 'api', 'import'];
      const trimmedSource = source.trim().toLowerCase();
      if (validSources.includes(trimmedSource)) {
        where.source = trimmedSource;
      }
    }

    // Optional verification filter
    const isVerifiedParam = searchParams.get('isVerified');
    if (isVerifiedParam !== null && isVerifiedParam !== '') {
      where.isVerified = isVerifiedParam.toLowerCase() === 'true';
    }

    // ── Fetch subscribers with RFM segment data ─────────────────────────────

    // Fetch all matching subscribers (we need them all for CSV export)
    // For large datasets, we paginate through in batches
    const subscribers: SubscriberRow[] = [];
    let skip = 0;
    let hasMore = true;

    while (hasMore) {
      const batch = await db.subscriber.findMany({
        where,
        select: {
          id: true,
          phoneHash: true,
          email: true,
          firstName: true,
          lastName: true,
          source: true,
          isVerified: true,
          totalOrdersCount: true,
          totalRevenue: true,
          lastOrderAt: true,
          createdAt: true,
          rfmSegments: {
            select: {
              segment: true,
            },
            orderBy: {
              calculatedAt: 'desc',
            },
            take: 1,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: BATCH_SIZE,
      });

      if (batch.length === 0) {
        hasMore = false;
      } else {
        // Map to flat rows with segment
        for (const sub of batch) {
          const latestSegment =
            sub.rfmSegments.length > 0 ? sub.rfmSegments[0].segment : null;

          subscribers.push({
            id: sub.id,
            phoneHash: sub.phoneHash,
            email: sub.email,
            firstName: sub.firstName,
            lastName: sub.lastName,
            source: sub.source,
            isVerified: sub.isVerified,
            totalOrdersCount: sub.totalOrdersCount,
            totalRevenue: sub.totalRevenue,
            lastOrderAt: sub.lastOrderAt,
            createdAt: sub.createdAt,
            segment: latestSegment,
          });
        }

        skip += batch.length;
        hasMore = batch.length === BATCH_SIZE;
      }
    }

    // ── Generate CSV ────────────────────────────────────────────────────────

    const csvContent = generateCSV(subscribers);
    const csvBytes = new TextEncoder().encode(csvContent);

    // ── Generate filename with timestamp ────────────────────────────────────

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const segmentSuffix = segment ? `_${segment.trim().toUpperCase()}` : '';
    const filename = `subscribers_export${segmentSuffix}_${timestamp}.csv`;

    // ── Return streaming CSV response ───────────────────────────────────────

    return new Response(csvBytes, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(csvBytes.byteLength),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (err) {
    console.error('[export:GET] Error generating export', err);
    return error('Failed to generate export', 500);
  }
}

// ── CSV Generation ───────────────────────────────────────────────────────────

/**
 * Generates a CSV string from an array of subscriber rows.
 *
 * Phone numbers are masked for privacy — since the DB stores encrypted phone
 * numbers, we derive a masked display from the phone hash.
 *
 * @param subscribers - Array of subscriber data rows
 * @returns Complete CSV string with headers and all data rows
 */
function generateCSV(subscribers: SubscriberRow[]): string {
  const headerLine = CSV_HEADERS.join(',');

  const dataLines = subscribers.map((sub) => {
    const maskedPhone = maskPhoneFromHash(sub.phoneHash);
    const fullName = `${sub.firstName ?? ''} ${sub.lastName ?? ''}`.trim();
    const email = sub.email ?? '';
    const segment = sub.segment ?? '';
    const source = sub.source;
    const totalOrders = String(sub.totalOrdersCount);
    const totalRevenue = sub.totalRevenue.toFixed(2);
    const lastOrder = sub.lastOrderAt
      ? new Date(sub.lastOrderAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : 'Never';
    const verified = sub.isVerified ? 'Yes' : 'No';
    const joinedDate = new Date(sub.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    // Wrap each cell in quotes to handle commas, newlines, etc.
    const cells = [
      maskedPhone,
      fullName,
      email,
      segment,
      source,
      totalOrders,
      totalRevenue,
      lastOrder,
      verified,
      joinedDate,
    ];

    return cells.map(escapeCSVCell).join(',');
  });

  return [headerLine, ...dataLines].join('\n');
}

/**
 * Escapes a CSV cell value by wrapping in double quotes and escaping
 * any internal double quotes by doubling them.
 *
 * @param value - The cell value to escape
 * @returns Properly escaped CSV cell string
 */
function escapeCSVCell(value: string): string {
  // Escape double quotes by doubling them, then wrap in quotes
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Derives a masked phone display from a phone hash.
 *
 * Since phone numbers are encrypted at rest and we can't decrypt without
 * the encryption key in this context, we produce a consistent masked format
 * derived from the hash characters for display purposes.
 *
 * @param phoneHash - SHA-256 hash of the phone number
 * @returns Masked phone string for CSV export
 */
function maskPhoneFromHash(phoneHash: string): string {
  if (!phoneHash || phoneHash.length < 8) {
    return 'XXX XXXX XXXX';
  }

  // Derive a masked display from the hash — use hash characters for the visible prefix
  // This gives a consistent masked value per subscriber while hiding the actual number
  const prefix1 = phoneHash.slice(0, 3).toUpperCase();
  const prefix2 = phoneHash.slice(3, 7).toUpperCase();
  return `${prefix1} ${prefix2} XXXX`;
}
