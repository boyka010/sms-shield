import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, error, getRequestBody } from '@/lib/api/helpers';

// ── Valid status transitions ───────────────────────────────────────────────────
// Each key maps to the set of statuses it can transition to.

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['scheduled', 'cancelled'],
  scheduled: ['running', 'draft', 'cancelled'],
  running: ['paused', 'completed', 'failed', 'cancelled'],
  paused: ['running', 'cancelled'],
  completed: [],
  failed: ['draft'],
  cancelled: [],
};

// ── GET /api/campaigns/[id] ───────────────────────────────────────────────────
//
// Get a single campaign by ID with its messages.
//

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return error('Campaign ID is required', 400);
    }

    const campaign = await db.campaign.findUnique({
      where: { id },
      include: {
        messages: {
          select: {
            id: true,
            subscriberId: true,
            status: true,
            errorMessage: true,
            sentAt: true,
            deliveredAt: true,
            failedAt: true,
            retryCount: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 100, // limit for performance
        },
      },
    });

    if (!campaign) {
      return error('Campaign not found', 404);
    }

    return success({
      id: campaign.id,
      shopId: campaign.shopId,
      name: campaign.name,
      description: campaign.description,
      type: campaign.type,
      status: campaign.status,
      segmentFilter: campaign.segmentFilter,
      messageTemplate: campaign.messageTemplate,
      senderName: campaign.senderName,
      gatewayType: campaign.gatewayType,
      scheduledAt: campaign.scheduledAt,
      startedAt: campaign.startedAt,
      completedAt: campaign.completedAt,
      totalRecipients: campaign.totalRecipients,
      sentCount: campaign.sentCount,
      deliveredCount: campaign.deliveredCount,
      failedCount: campaign.failedCount,
      messages: campaign.messages,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
    });
  } catch (err) {
    console.error('[campaigns/[id]:GET] Error fetching campaign', err);
    return error('Failed to fetch campaign', 500);
  }
}

// ── PUT /api/campaigns/[id] ───────────────────────────────────────────────────
//
// Update a campaign. Allowed fields: name, messageTemplate, status,
// segmentFilter, scheduledAt. Status transitions must be valid.
//

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return error('Campaign ID is required', 400);
    }

    const body = await getRequestBody<{
      name?: string;
      messageTemplate?: string;
      status?: string;
      segmentFilter?: string | null;
      scheduledAt?: string | null;
    }>(request);

    // Check campaign exists
    const existing = await db.campaign.findUnique({
      where: { id },
    });

    if (!existing) {
      return error('Campaign not found', 404);
    }

    // Build update data (only include provided fields)
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (body.name !== undefined) {
      if (!body.name || body.name.trim().length === 0) {
        return error('Campaign name cannot be empty', 400);
      }
      updateData.name = body.name.trim();
    }

    if (body.messageTemplate !== undefined) {
      if (!body.messageTemplate || body.messageTemplate.trim().length === 0) {
        return error('Message template cannot be empty', 400);
      }
      updateData.messageTemplate = body.messageTemplate.trim();
    }

    if (body.segmentFilter !== undefined) {
      updateData.segmentFilter = body.segmentFilter;
    }

    if (body.scheduledAt !== undefined) {
      if (body.scheduledAt) {
        const scheduledDate = new Date(body.scheduledAt);
        if (isNaN(scheduledDate.getTime())) {
          return error('Invalid scheduledAt date format', 400);
        }
        if (scheduledDate <= new Date()) {
          return error('scheduledAt must be in the future', 400);
        }
        updateData.scheduledAt = scheduledDate;
      } else {
        updateData.scheduledAt = null;
      }
    }

    // Handle status transition
    if (body.status !== undefined) {
      if (!VALID_TRANSITIONS[existing.status]) {
        return error(`Unknown current status: ${existing.status}`, 400);
      }

      if (!VALID_TRANSITIONS[existing.status].includes(body.status)) {
        return error(
          `Invalid status transition from "${existing.status}" to "${body.status}". ` +
          `Allowed transitions: ${VALID_TRANSITIONS[existing.status].join(', ') || 'none'}`,
          400
        );
      }

      updateData.status = body.status;

      // Set timestamps based on new status
      if (body.status === 'running') {
        updateData.startedAt = new Date();
      }
      if (body.status === 'completed') {
        updateData.completedAt = new Date();
      }
    }

    // Apply update
    const campaign = await db.campaign.update({
      where: { id },
      data: updateData,
    });

    return success({
      id: campaign.id,
      name: campaign.name,
      type: campaign.type,
      status: campaign.status,
      messageTemplate: campaign.messageTemplate,
      segmentFilter: campaign.segmentFilter,
      senderName: campaign.senderName,
      scheduledAt: campaign.scheduledAt,
      startedAt: campaign.startedAt,
      completedAt: campaign.completedAt,
      sentCount: campaign.sentCount,
      deliveredCount: campaign.deliveredCount,
      failedCount: campaign.failedCount,
      updatedAt: campaign.updatedAt,
    });
  } catch (err) {
    console.error('[campaigns/[id]:PUT] Error updating campaign', err);
    return error('Failed to update campaign', 500);
  }
}

// ── DELETE /api/campaigns/[id] ────────────────────────────────────────────────
//
// Delete a campaign. Only allowed if status is draft or completed.
// Deletes all associated campaign messages.
//

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return error('Campaign ID is required', 400);
    }

    // Check campaign exists
    const existing = await db.campaign.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        _count: {
          select: { messages: true },
        },
      },
    });

    if (!existing) {
      return error('Campaign not found', 404);
    }

    // Only allow deletion if draft or completed
    if (existing.status !== 'draft' && existing.status !== 'completed') {
      return error(
        `Cannot delete campaign with status "${existing.status}". Only draft or completed campaigns can be deleted.`,
        400
      );
    }

    // Delete all associated campaign messages first
    // (Cascade should handle this, but we do it explicitly for clarity)
    await db.campaignMessage.deleteMany({
      where: { campaignId: id },
    });

    // Delete the campaign
    await db.campaign.delete({
      where: { id },
    });

    return success({
      message: 'Campaign deleted successfully',
      deletedCampaignId: id,
      deletedMessageCount: existing._count.messages,
    });
  } catch (err) {
    console.error('[campaigns/[id]:DELETE] Error deleting campaign', err);
    return error('Failed to delete campaign', 500);
  }
}
