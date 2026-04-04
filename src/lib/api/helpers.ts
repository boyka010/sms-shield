import { NextResponse } from 'next/server';

/**
 * Returns a success JSON response with the given data.
 *
 * @param data  — The payload to include under the `data` key.
 * @param status — HTTP status code (default 200).
 */
export function success<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

/**
 * Returns an error JSON response.
 *
 * @param message — Human-readable error message.
 * @param status — HTTP status code (default 500).
 * @param details — Optional extra error context (object, string, etc.).
 */
export function error(message: string, status = 500, details?: unknown) {
  return NextResponse.json({ success: false, error: message, details }, { status });
}

/**
 * Returns a paginated JSON response.
 *
 * Automatically computes `totalPages` from `total` and `pageSize`.
 *
 * @param data — Array of items for the current page.
 * @param total — Total number of items across all pages.
 * @param page — Current page number (1-indexed).
 * @param pageSize — Number of items per page.
 */
export function paginated<T>(data: T[], total: number, page: number, pageSize: number) {
  return NextResponse.json({
    success: true,
    data,
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}

/**
 * Reads and parses the request body as JSON, casting to type T.
 *
 * @param request — The native Request object.
 * @returns Parsed body as type T.
 */
export async function getRequestBody<T>(request: Request): Promise<T> {
  const body = await request.json();
  return body as T;
}
