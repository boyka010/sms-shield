import { prisma } from './database';
import { hash } from '../utils/security.server';

export type AuditAction =
  | 'CONTACT_CREATE'
  | 'CONTACT_VIEW'
  | 'CONTACT_UPDATE'
  | 'CONTACT_DELETE'
  | 'CONTACT_EXPORT'
  | 'PHONE_LOOKUP'
  | 'SMS_SEND'
  | 'SMS_VIEW'
  | 'CAMPAIGN_CREATE'
  | 'CAMPAIGN_VIEW'
  | 'CAMPAIGN_UPDATE'
  | 'AUTOMATION_CREATE'
  | 'AUTOMATION_UPDATE'
  | 'SETTINGS_VIEW'
  | 'SETTINGS_UPDATE'
  | 'API_KEY_CREATE'
  | 'API_KEY_REVOKE'
  | 'WEBHOOK_RECEIVE'
  | 'ORDER_CREATE'
  | 'ORDER_VIEW';

export type AuditResource = 'CONTACT' | 'CAMPAIGN' | 'AUTOMATION' | 'SETTINGS' | 'API_KEY' | 'SMS' | 'ORDER';

interface AuditLogEntry {
  id: string;
  merchantId: string;
  userId?: string;
  action: AuditAction;
  resource: AuditResource;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  piiAccessed?: boolean;
  createdAt: Date;
}

const SENSITIVE_FIELDS = [
  'phoneNumber',
  'phoneNumberHash',
  'email',
  'emailHash',
  'firstName',
  'lastName',
  'totalSpent',
  'averageOrderValue'
];

export async function createAuditLog(
  merchantId: string,
  action: AuditAction,
  resource: AuditResource,
  options: {
    userId?: string;
    resourceId?: string;
    details?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
    piiAccessed?: boolean;
  }
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        merchantId,
        userId: options.userId,
        action,
        resource,
        resourceId: options.resourceId,
        details: options.details,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
        piiAccessed: options.piiAccessed ?? false
      }
    });
  } catch (error) {
    console.error('[Audit] Failed to create audit log:', error);
  }
}

export async function logContactAccess(
  merchantId: string,
  contactId: string,
  action: 'VIEW' | 'UPDATE' | 'DELETE' | 'EXPORT',
  userId?: string,
  ipAddress?: string,
  fieldsAccessed?: string[]
): Promise<void> {
  const piiAccessed = fieldsAccessed?.some(f => SENSITIVE_FIELDS.includes(f)) ?? false;

  const actionMap: Record<string, AuditAction> = {
    'VIEW': 'CONTACT_VIEW',
    'UPDATE': 'CONTACT_UPDATE',
    'DELETE': 'CONTACT_DELETE',
    'EXPORT': 'CONTACT_EXPORT'
  };

  await createAuditLog(merchantId, actionMap[action], 'CONTACT', {
    resourceId: contactId,
    userId,
    ipAddress,
    piiAccessed,
    details: fieldsAccessed ? { fieldsAccessed } : undefined
  });
}

export async function logSmsSend(
  merchantId: string,
  contactId: string,
  campaignId?: string,
  automationId?: string,
  ipAddress?: string
): Promise<void> {
  await createAuditLog(merchantId, 'SMS_SEND', 'SMS', {
    resourceId: campaignId || automationId,
    userId: contactId,
    ipAddress,
    piiAccessed: true,
    details: {
      recipientContactId: contactId,
      campaignId,
      automationId
    }
  });
}

export async function logSettingsAccess(
  merchantId: string,
  action: 'VIEW' | 'UPDATE',
  userId?: string,
  ipAddress?: string,
  fieldsAccessed?: string[]
): Promise<void> {
  const actionMap: Record<string, AuditAction> = {
    'VIEW': 'SETTINGS_VIEW',
    'UPDATE': 'SETTINGS_UPDATE'
  };

  await createAuditLog(merchantId, actionMap[action], 'SETTINGS', {
    userId,
    ipAddress,
    piiAccessed: true,
    details: fieldsAccessed ? { fieldsAccessed } : undefined
  });
}

export async function logApiKeyAction(
  merchantId: string,
  action: 'CREATE' | 'REVOKE',
  keyId: string,
  userId?: string,
  ipAddress?: string
): Promise<void> {
  const actionMap: Record<string, AuditAction> = {
    'CREATE': 'API_KEY_CREATE',
    'REVOKE': 'API_KEY_REVOKE'
  };

  await createAuditLog(merchantId, actionMap[action], 'API_KEY', {
    resourceId: keyId,
    userId,
    ipAddress,
    piiAccessed: false
  });
}

export async function getAuditLogs(
  merchantId: string,
  options: {
    action?: AuditAction;
    resource?: AuditResource;
    resourceId?: string;
    startDate?: Date;
    endDate?: Date;
    piiOnly?: boolean;
    page?: number;
    limit?: number;
  } = {}
): Promise<{ logs: AuditLogEntry[]; total: number }> {
  const { page = 1, limit = 50, ...filters } = options;

  const where: any = { merchantId };

  if (filters.action) where.action = filters.action;
  if (filters.resource) where.resource = filters.resource;
  if (filters.resourceId) where.resourceId = filters.resourceId;
  if (filters.piiOnly) where.piiAccessed = true;

  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) where.createdAt.gte = filters.startDate;
    if (filters.endDate) where.createdAt.lte = filters.endDate;
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit
    }),
    prisma.auditLog.count({ where })
  ]);

  return { logs: logs as unknown as AuditLogEntry[], total };
}

export async function getPiiAccessSummary(
  merchantId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  totalAccesses: number;
  byAction: Record<string, number>;
  byResource: Record<string, number>;
  topUsers: { userId: string; count: number }[];
}> {
  const logs = await prisma.auditLog.findMany({
    where: {
      merchantId,
      piiAccessed: true,
      createdAt: { gte: startDate, lte: endDate }
    },
    select: { action: true, resource: true, userId: true }
  });

  const byAction: Record<string, number> = {};
  const byResource: Record<string, number> = {};
  const userCounts: Record<string, number> = {};

  for (const log of logs) {
    byAction[log.action] = (byAction[log.action] || 0) + 1;
    byResource[log.resource] = (byResource[log.resource] || 0) + 1;
    
    if (log.userId) {
      userCounts[log.userId] = (userCounts[log.userId] || 0) + 1;
    }
  }

  const topUsers = Object.entries(userCounts)
    .map(([userId, count]) => ({ userId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalAccesses: logs.length,
    byAction,
    byResource,
    topUsers
  };
}
