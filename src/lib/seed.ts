import { db } from '@/lib/db';
import { encrypt, hashPhone } from '@/lib/encryption';

/**
 * Seeds the SQLite database with demo data for development.
 * Idempotent — uses upsert where possible, skips if shop already exists.
 */
export async function seedDatabase(): Promise<void> {
  const DEMO_SHOP_DOMAIN = 'sms-shield-demo.myshopify.com';
  const DEMO_SHOP_ID = 'demo-shop-1';
  const ENCRYPTION_KEY =
    process.env.ENCRYPTION_KEY ??
    'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';

  // ── 1. Create demo shop ────────────────────────────────────────────────────

  const shop = await db.shop.upsert({
    where: { shopifyDomain: DEMO_SHOP_DOMAIN },
    create: {
      id: DEMO_SHOP_ID,
      shopifyDomain: DEMO_SHOP_DOMAIN,
      shopifyToken: 'shpat_demo_token_for_development_only',
      isActive: true,
      plan: 'pro',
      currency: 'EGP',
    },
    update: {
      isActive: true,
      plan: 'pro',
    },
  });

  // ── 2. Create shop settings ────────────────────────────────────────────────

  await db.shopSettings.upsert({
    where: { shopId: shop.id },
    create: {
      shopId: shop.id,
      popupEnabled: true,
      popupDelaySeconds: 5,
      popupHeadline: '🎉 Get 10% OFF your first order!',
      popupSubtext: 'Subscribe to our SMS list and never miss a deal.',
      discountType: 'percentage',
      discountValue: 10,
      buttonColor: '#10B981',
      buttonTextColor: '#FFFFFF',
      codConfirmationEnabled: true,
      autoApplyDiscount: true,
    },
    update: {},
  });

  // ── 3. Create demo subscribers ─────────────────────────────────────────────

  const demoSubscribers = [
    { phone: '01012345678', firstName: 'Ahmed', lastName: 'Hassan', email: 'ahmed@example.com', source: 'popup', verified: true, orders: 12, revenue: 15400 },
    { phone: '01198765432', firstName: 'Fatma', lastName: 'Ali', email: 'fatma@example.com', source: 'checkout', verified: true, orders: 8, revenue: 9200 },
    { phone: '01255544433', firstName: 'Mohamed', lastName: 'Ibrahim', email: null, source: 'popup', verified: false, orders: 3, revenue: 3100 },
    { phone: '01588877766', firstName: 'Sara', lastName: 'Omar', email: 'sara@example.com', source: 'import', verified: true, orders: 15, revenue: 22300 },
    { phone: '01099988777', firstName: 'Youssef', lastName: 'Khalil', email: 'youssef@example.com', source: 'popup', verified: true, orders: 6, revenue: 7800 },
    { phone: '01166655544', firstName: 'Nour', lastName: 'El-Din', email: null, source: 'checkout', verified: false, orders: 1, revenue: 850 },
    { phone: '01233322211', firstName: 'Hana', lastName: 'Moustafa', email: 'hana@example.com', source: 'api', verified: true, orders: 20, revenue: 35000 },
    { phone: '01544433322', firstName: 'Omar', lastName: 'Farouk', email: 'omar.f@example.com', source: 'popup', verified: true, orders: 4, revenue: 4200 },
    { phone: '01077766555', firstName: 'Layla', lastName: 'Zaki', email: null, source: 'popup', verified: false, orders: 0, revenue: 0 },
    { phone: '01122211100', firstName: 'Karim', lastName: 'Said', email: 'karim@example.com', source: 'checkout', verified: true, orders: 10, revenue: 12600 },
  ];

  for (const sub of demoSubscribers) {
    const normalizedPhone = `+2${sub.phone}`;
    const phoneHash = hashPhone(normalizedPhone);
    const encryptedPhone = await encrypt(normalizedPhone, ENCRYPTION_KEY);

    try {
      await db.subscriber.upsert({
        where: { phoneHash },
        create: {
          id: `sub-${sub.phone}`,
          shopId: shop.id,
          phoneNumber: encryptedPhone,
          rawPhoneNumber: phoneHash,
          phoneHash,
          email: sub.email,
          firstName: sub.firstName,
          lastName: sub.lastName,
          source: sub.source,
          isVerified: sub.verified,
          tags: JSON.stringify([]),
          totalOrdersCount: sub.orders,
          totalRevenue: sub.revenue,
          firstOrderAt: sub.orders > 0 ? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) : null,
          lastOrderAt: sub.orders > 0 ? new Date() : null,
        },
        update: {},
      });
    } catch {
      // Skip duplicates (phoneHash is unique)
    }
  }

  // ── 4. Create demo campaigns ───────────────────────────────────────────────

  const demoCampaigns = [
    { name: 'Ramadan Flash Sale', type: 'BROADCAST', status: 'completed', message: '🌙 Ramadan Mubarak! Enjoy 30% OFF everything — use code RAMADAN30 at checkout. Shop now!', recipients: 500, sent: 487, delivered: 462, failed: 25 },
    { name: 'Cart Recovery — Week 12', type: 'ABANDONED_CART', status: 'running', message: '👋 Hey {{firstName}}, you left items in your cart! Complete your order now and get {{discount}} OFF. Code: COMEBACK10', recipients: 34, sent: 28, delivered: 27, failed: 1 },
    { name: 'COD Confirmation Flow', type: 'COD_CONFIRMATION', status: 'running', message: '✅ Please confirm your order #{{orderNumber}} by clicking: {{confirmationUrl}}', recipients: 120, sent: 115, delivered: 110, failed: 5 },
    { name: 'Loyal Customer VIP', type: 'RFM_SEGMENT', status: 'scheduled', message: '👑 VIP Exclusive: 20% OFF your next order! You\'re one of our top customers. Code: VIP20', recipients: 45, sent: 0, delivered: 0, failed: 0 },
    { name: 'New Collection Launch', type: 'BROADCAST', status: 'draft', message: '🆕 Our new summer collection just dropped! Be the first to shop. {{link}}', recipients: 0, sent: 0, delivered: 0, failed: 0 },
  ];

  for (let i = 0; i < demoCampaigns.length; i++) {
    const c = demoCampaigns[i];
    const campaignId = `campaign-${i + 1}`;

    await db.campaign.upsert({
      where: { id: campaignId },
      create: {
        id: campaignId,
        shopId: shop.id,
        name: c.name,
        type: c.type,
        status: c.status,
        messageTemplate: c.message,
        segmentFilter: null,
        senderName: 'SMS-Shield',
        totalRecipients: c.recipients,
        sentCount: c.sent,
        deliveredCount: c.delivered,
        failedCount: c.failed,
        scheduledAt: c.status === 'scheduled' ? new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) : null,
        startedAt: ['running', 'completed'].includes(c.status) ? new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) : null,
        completedAt: c.status === 'completed' ? new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) : null,
      },
      update: {},
    });
  }

  // ── 5. Create demo gateway configs ─────────────────────────────────────────

  const demoGateways = [
    { type: 'SMS_MISR', sender: 'SMSHD', priority: 1, username: 'sms_shield_user', password: 'demo_pass_sms_misr' },
    { type: 'VICTORY_LINK', sender: 'VLink', priority: 2, username: 'vl_shield_user', password: 'demo_pass_vl' },
    { type: 'WE_API', sender: 'WESMS', priority: 3, username: 'we_shield_user', password: 'demo_pass_we', apiKey: 'we-api-key-demo-12345' },
  ];

  for (const gw of demoGateways) {
    const encUser = await encrypt(gw.username, ENCRYPTION_KEY);
    const encPass = await encrypt(gw.password, ENCRYPTION_KEY);
    const encApiKey = gw.apiKey ? await encrypt(gw.apiKey, ENCRYPTION_KEY) : null;
    const gwId = `gw-${gw.type.toLowerCase()}`;

    try {
      await db.sMSGatewayConfig.upsert({
        where: { id: gwId },
        create: {
          id: gwId,
          shopId: shop.id,
          gatewayType: gw.type,
          encryptedUsername: encUser,
          encryptedPassword: encPass,
          encryptedApiKey: encApiKey,
          senderName: gw.sender,
          isActive: true,
          priority: gw.priority,
          healthStatus: 'healthy',
          lastHealthCheckAt: new Date(),
        },
        update: {},
      });
    } catch {
      // Skip if unique constraint (shopId + gatewayType) conflicts
    }
  }

  // ── 6. Create demo automation rules ────────────────────────────────────────

  const demoRules = [
    {
      id: 'rule-cart-1',
      name: 'Cart Abandonment — 3 Step Recovery',
      description: 'Send 3 reminder SMS at 1h, 24h, and 72h after cart abandonment',
      triggerType: 'CART_ABANDONED',
      triggerConditions: JSON.stringify({ delayMinutes: 60 }),
      actions: JSON.stringify([{ type: 'SEND_SMS', template: 'cart_recovery_1h' }]),
    },
    {
      id: 'rule-cod-1',
      name: 'COD Auto-Confirm',
      description: 'Send COD confirmation link immediately on order creation',
      triggerType: 'ORDER_CREATED',
      triggerConditions: JSON.stringify({ paymentMethod: 'cod' }),
      actions: JSON.stringify([{ type: 'SEND_SMS', template: 'cod_confirmation' }]),
    },
  ];

  for (const rule of demoRules) {
    await db.automationRule.upsert({
      where: { id: rule.id },
      create: {
        id: rule.id,
        shopId: shop.id,
        name: rule.name,
        description: rule.description,
        triggerType: rule.triggerType,
        triggerConditions: rule.triggerConditions,
        actions: rule.actions,
        isActive: true,
        executionCount: Math.floor(Math.random() * 50) + 10,
        lastExecutedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      },
      update: {},
    });
  }

  console.log('✅ Database seeded successfully with demo data');
}
