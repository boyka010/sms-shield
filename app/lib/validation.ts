import { z } from 'zod';

export const phoneSchema = z
  .string()
  .min(11, 'Phone must be at least 11 digits')
  .regex(/^(?:\+20|0)?(10|11|12|15)\d{8}$/, 'Invalid Egyptian phone number');

export const normalizedPhoneSchema = phoneSchema.transform((val) => {
  const cleaned = val.replace(/\D/g, '');
  if (cleaned.startsWith('20')) return cleaned;
  if (cleaned.startsWith('0')) return '20' + cleaned.slice(1);
  return '20' + cleaned;
});

export const emailSchema = z
  .string()
  .email('Invalid email address')
  .transform((val) => val.toLowerCase().trim());

export const shopifyStoreUrlSchema = z
  .string()
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/, 'Invalid Shopify store URL');

export const webhookTopicSchema = z.enum([
  'carts/update',
  'orders/create',
  'checkouts/update',
  'products/create',
  'products/update',
  'customers/create',
  'customers/update'
]);

export const createContactSchema = z.object({
  phone: phoneSchema,
  storeUrl: shopifyStoreUrlSchema,
  email: emailSchema.optional(),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  source: z.enum(['popup', 'checkout', 'api', 'webhook']).default('api')
});

export const updateContactSchema = z.object({
  id: z.string().cuid(),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  email: emailSchema.optional(),
  tags: z.array(z.string()).max(20).optional(),
  smsOptIn: z.boolean().optional(),
  whatsappOptIn: z.boolean().optional()
});

export const createCampaignSchema = z.object({
  name: z.string().min(3).max(100),
  type: z.enum(['WELCOME', 'ABANDONED_CART', 'POST_PURCHASE', 'WIN_BACK', 'LOYALTY', 'SEGMENT']),
  messageTemplate: z.string().min(10).max(1600),
  segmentFilter: z.object({
    segment: z.enum(['CHAMPIONS', 'LOYAL', 'AT_RISK', 'PRICE_SENSITIVE', 'NEW', 'DORMANT']).optional(),
    minOrders: z.number().int().min(0).optional(),
    minSpent: z.number().min(0).optional(),
    maxSpent: z.number().min(0).optional()
  }).optional(),
  scheduledAt: z.string().datetime().optional(),
  sendImmediately: z.boolean().default(false)
});

export const updateCampaignSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(3).max(100).optional(),
  messageTemplate: z.string().min(10).max(1600).optional(),
  status: z.enum(['DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED']).optional()
});

export const createAutomationSchema = z.object({
  name: z.string().min(3).max(100),
  triggerType: z.enum(['ABANDONED_CART', 'POST_PURCHASE', 'WIN_BACK', 'ORDER_FULFILLED', 'REFUND']),
  isActive: z.boolean().default(true),
  delayMinutes: z.number().int().min(0).max(10080),
  maxTouches: z.number().int().min(1).max(10).default(3),
  messageTemplate: z.string().min(10).max(1600)
});

export const sendSmsSchema = z.object({
  contactId: z.string().cuid().optional(),
  phoneNumber: phoneSchema.optional(),
  message: z.string().min(1).max(1600),
  campaignId: z.string().cuid().optional(),
  automationId: z.string().cuid().optional(),
  scheduledAt: z.string().datetime().optional()
}).refine(data => data.contactId || data.phoneNumber, {
  message: 'Either contactId or phoneNumber is required'
});

export const webhookPayloadSchema = z.object({
  id: z.union([z.string(), z.number()]),
  topic: webhookTopicSchema,
  shop_domain: shopifyStoreUrlSchema.optional(),
  customer: z.object({
    id: z.union([z.string(), z.number()]).optional(),
    phone: phoneSchema.optional(),
    email: emailSchema.optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional()
  }).optional(),
  order_number: z.number().optional(),
  total_price: z.string().optional(),
  currency: z.string().length(3).default('EGP'),
  financial_status: z.string().optional(),
  created_at: z.string().datetime().optional()
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25)
});

export const contactFiltersSchema = paginationSchema.extend({
  search: z.string().max(100).optional(),
  segment: z.enum(['CHAMPIONS', 'LOYAL', 'AT_RISK', 'PRICE_SENSITIVE', 'NEW', 'DORMANT']).optional(),
  smsOptIn: z.boolean().optional(),
  minOrders: z.coerce.number().int().min(0).optional(),
  maxOrders: z.coerce.number().int().min(0).optional(),
  minSpent: z.coerce.number().min(0).optional(),
  maxSpent: z.coerce.number().min(0).optional()
});

export const apiKeySchema = z.object({
  name: z.string().min(3).max(50).regex(/^[a-zA-Z0-9-_]+$/),
  expiresAt: z.string().datetime().optional()
});

export const merchantSettingsSchema = z.object({
  discountCode: z.string().min(3).max(50).optional(),
  discountPercentage: z.number().min(0).max(100).optional(),
  discountType: z.enum(['percentage', 'fixed']).default('percentage'),
  popupEnabled: z.boolean().optional(),
  popupTriggerDelay: z.number().int().min(1000).max(60000).optional(),
  popupExitIntent: z.boolean().optional(),
  popupShowAfterDismiss: z.number().int().min(1).max(168).optional(),
  automationsEnabled: z.boolean().optional(),
  abandonedCartDelay: z.number().int().min(1).max(1440).optional(),
  winBackDelay: z.number().int().min(1).max(10080).optional(),
  timezone: z.string().default('Africa/Cairo')
});

export type PhoneInput = z.infer<typeof phoneSchema>;
export type NormalizedPhone = z.infer<typeof normalizedPhoneSchema>;
export type CreateContactInput = z.infer<typeof createContactSchema>;
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type SendSmsInput = z.infer<typeof sendSmsSchema>;
export type ContactFilters = z.infer<typeof contactFiltersSchema>;
