// =============================================================================
// SMS-Shield — Campaign Execution API Endpoint
// POST /api/campaigns/execute
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { executeCampaign, type ExecutionResult } from "@/lib/services/campaign-executor";
import { serializeError } from "@/lib/errors";
import { logger } from "@/lib/logger";

// -----------------------------------------------------------------------------
// POST handler
// -----------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const requestLogger = logger.child("api:campaigns:execute");

  try {
    // Parse request body
    let body: { campaignId?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON body",
          code: "INVALID_BODY",
        },
        { status: 400 }
      );
    }

    const { campaignId } = body;

    // Validate required fields
    if (!campaignId || typeof campaignId !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Missing or invalid campaignId in request body",
          code: "VALIDATION_ERROR",
        },
        { status: 400 }
      );
    }

    // TODO: In production, extract shopId from authenticated session/cookie
    // For now, we derive it from the campaign itself within executeCampaign
    // This placeholder allows the endpoint to function while auth is wired separately
    const shopId = request.headers.get("x-shop-id");
    if (!shopId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing shop identification header (x-shop-id)",
          code: "AUTHENTICATION_ERROR",
        },
        { status: 401 }
      );
    }

    requestLogger.info("Campaign execution requested", {
      campaignId,
      shopId,
    });

    // Execute the campaign
    const result: ExecutionResult = await executeCampaign({
      campaignId,
      shopId,
    });

    // Determine HTTP status based on execution outcome
    const httpStatus = result.success
      ? 200
      : result.totalRecipients === 0
        ? 404
        : 202; // Accepted but with partial failures

    requestLogger.info("Campaign execution finished", {
      campaignId,
      shopId,
      success: result.success,
      totalRecipients: result.totalRecipients,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
      errorCount: result.errors.length,
    });

    return NextResponse.json(
      {
        success: result.success,
        data: {
          campaignId,
          totalRecipients: result.totalRecipients,
          sentCount: result.sentCount,
          failedCount: result.failedCount,
        },
        ...(result.errors.length > 0 && { errors: result.errors }),
      },
      { status: httpStatus }
    );
  } catch (error) {
    const serialized = serializeError(error);

    requestLogger.error("Unexpected error in campaign execute endpoint", {
      error: serialized,
    });

    return NextResponse.json(
      {
        success: false,
        error: serialized.message,
        code: serialized.code,
      },
      { status: serialized.statusCode }
    );
  }
}
