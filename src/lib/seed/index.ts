/**
 * SMS-Shield — Database Seed Script
 *
 * Populates the database with realistic demo data for the demo shop.
 * Idempotent — safe to run multiple times (checks for existing demo shop).
 */

import { db } from "@/lib/db";
import { encrypt } from "@/lib/encryption";

// ─── Constants ─────────────────────────────────────────────────────────────────

const SHOP_ID = "demo-shop-1";
const SHOP_DOMAIN = "sms-shield-demo.myshopify.com";
const ENCRYPTION_KEY = "dev-encryption-key-32-bytes-long-000000";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SeedSubscriber {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email?: string;
  source: "popup" | "checkout" | "api" | "import";
  consentGranted: boolean;
  isVerified: boolean;
  totalOrdersCount: number;
  totalRevenue: number;
  daysSinceLastOrder: number;
  tags: string[];
  discountCodeId?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals = 2): number {
  const val = Math.random() * (max - min) + min;
  return parseFloat(val.toFixed(decimals));
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `hash_${Math.abs(hash).toString(16)}`;
}

async function safeEncrypt(plaintext: string): Promise<string> {
  try {
    return await encrypt(plaintext, ENCRYPTION_KEY);
  } catch {
    // Fallback if encryption fails (invalid key format, no crypto, etc.)
    return `enc_fallback_${Buffer.from(plaintext).toString("base64")}`;
  }
}

// ─── Data Generators ───────────────────────────────────────────────────────────

const PHONE_PREFIXES = ["010", "011", "012", "015"];

function generateEgyptianPhone(index: number): string {
  const prefix = PHONE_PREFIXES[index % PHONE_PREFIXES.length];
  const digits = String(index).padStart(8, "0").slice(-8);
  return `${prefix}${digits}`;
}

const FIRST_NAMES = [
  "Ahmed", "Fatima", "Mohamed", "Nour", "Youssef",
  "Aisha", "Omar", "Layla", "Karim", "Hana",
  "Mustafa", "Salma", "Ibrahim", "Dina", "Tariq",
  "Mariam", "Hassan", "Rania", "Khaled", "Amira",
  "Ali", "Nada", "Sherif", "Heba", "Mahmoud",
  "Rania", "Tarek", "Sara", "Wael", "Mona",
  "Ammar", "Nermin", "Fady", "Yasmine", "Bassem",
  "Menna", "Ayman", "Doaa", "Ismail", "Hend",
  "Rami", "Nourhan", "Ahmed", "Esraa", "Mazen",
  "Shimaa", "Hossam", "Ola", "Nabil", "Aya",
  "Seif", "Manal",
];

const LAST_NAMES = [
  "Hassan", "Ali", "Ibrahim", "El-Din", "Mansour",
  "Mahmoud", "Khalil", "Mostafa", "Abdel-Rahim", "Fawzy",
  "Saleh", "El-Masry", "Abdallah", "Rashid", "Nasser",
  "Badr", "Zaki", "Fahmy", "El-Sayed", "Gamil",
  "Shahin", "Morcos", "Habib", "Tawfik", "Azer",
];

const SOURCES: Array<"popup" | "checkout" | "api" | "import"> = [
  "popup", "checkout", "api", "import",
];

const TAG_OPTIONS = [
  "vip", "wholesale", "repeat-buyer", "high-value",
  "cart-abandoner", "cod-prefers", "new", "loyalty-member",
  "ramadan-buyer", "referral",
];

function generateSubscriber(index: number): SeedSubscriber {
  const firstName = FIRST_NAMES[index % FIRST_NAMES.length];
  const lastName = LAST_NAMES[index % LAST_NAMES.length];
  const phone = generateEgyptianPhone(index);

  const source = pickRandom(SOURCES);
  const consentGranted = Math.random() > 0.1;
  const isVerified = Math.random() > 0.25;

  // Distribute order counts realistically
  let totalOrdersCount: number;
  let totalRevenue: number;
  let daysSinceLastOrder: number;

  const orderTier = randomInt(1, 10);
  if (orderTier <= 2) {
    // New / low engagement
    totalOrdersCount = randomInt(0, 2);
    totalRevenue = randomFloat(0, 2000);
    daysSinceLastOrder = randomInt(30, 400);
  } else if (orderTier <= 5) {
    // Moderate
    totalOrdersCount = randomInt(2, 7);
    totalRevenue = randomFloat(1000, 10000);
    daysSinceLastOrder = randomInt(10, 120);
  } else if (orderTier <= 8) {
    // Good customers
    totalOrdersCount = randomInt(7, 15);
    totalRevenue = randomFloat(8000, 25000);
    daysSinceLastOrder = randomInt(3, 60);
  } else {
    // Champions
    totalOrdersCount = randomInt(15, 25);
    totalRevenue = randomFloat(20000, 50000);
    daysSinceLastOrder = randomInt(0, 14);
  }

  // Generate email for ~70% of subscribers
  const hasEmail = Math.random() > 0.3;
  const email = hasEmail
    ? `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/[^a-z]/g, "")}${index}@gmail.com`
    : undefined;

  // Generate 0-3 tags
  const tagCount = randomInt(0, 3);
  const tags: string[] = [];
  for (let t = 0; t < tagCount; t++) {
    const tag = pickRandom(TAG_OPTIONS);
    if (!tags.includes(tag)) tags.push(tag);
  }

  return {
    firstName,
    lastName,
    phoneNumber: phone,
    email,
    source,
    consentGranted,
    isVerified,
    totalOrdersCount,
    totalRevenue,
    daysSinceLastOrder,
    tags,
  };
}

/**
 * Assign RFM segment based on scores.
 */
function assignRFMSegment(
  recencyScore: number,
  frequencyScore: number,
  monetaryScore: number
): string {
  const composite = recencyScore + frequencyScore + monetaryScore;

  if (composite >= 13) return "CHAMPION";
  if (composite >= 11 && frequencyScore >= 4) return "LOYAL";
  if (composite >= 10 && frequencyScore >= 3) return "POTENTIAL_LOYALIST";
  if (frequencyScore <= 2 && recencyScore >= 4) return "NEW_CUSTOMER";
  if (frequencyScore <= 2 && recencyScore === 3) return "PROMISING";
  if (recencyScore <= 2 && frequencyScore >= 3 && monetaryScore >= 3) return "CANT_LOSE";
  if (recencyScore <= 2 && frequencyScore >= 3) return "AT_RISK";
  if (recencyScore <= 2 && frequencyScore <= 2 && monetaryScore >= 2) return "NEED_ATTENTION";
  if (recencyScore <= 1 && frequencyScore <= 1 && monetaryScore <= 1) return "LOST";
  return "HIBERNATING";
}

/**
 * Calculate RFM scores from subscriber data.
 */
function calculateRFM(
  daysSinceLastOrder: number,
  totalOrdersCount: number,
  totalRevenue: number
): {
  recencyScore: number;
  frequencyScore: number;
  monetaryScore: number;
  segment: string;
} {
  // Recency: lower daysSinceLastOrder = higher score
  let recencyScore: number;
  if (daysSinceLastOrder <= 7) recencyScore = 5;
  else if (daysSinceLastOrder <= 14) recencyScore = 4;
  else if (daysSinceLastOrder <= 30) recencyScore = 3;
  else if (daysSinceLastOrder <= 90) recencyScore = 2;
  else recencyScore = 1;

  // Frequency: higher order count = higher score
  let frequencyScore: number;
  if (totalOrdersCount >= 15) frequencyScore = 5;
  else if (totalOrdersCount >= 8) frequencyScore = 4;
  else if (totalOrdersCount >= 4) frequencyScore = 3;
  else if (totalOrdersCount >= 1) frequencyScore = 2;
  else frequencyScore = 1;

  // Monetary: higher revenue = higher score
  let monetaryScore: number;
  if (totalRevenue >= 20000) monetaryScore = 5;
  else if (totalRevenue >= 8000) monetaryScore = 4;
  else if (totalRevenue >= 3000) monetaryScore = 3;
  else if (totalRevenue >= 500) monetaryScore = 2;
  else monetaryScore = 1;

  const segment = assignRFMSegment(recencyScore, frequencyScore, monetaryScore);

  return { recencyScore, frequencyScore, monetaryScore, segment };
}

// ─── Main Seed Function ────────────────────────────────────────────────────────

export async function seedDatabase(): Promise<void> {
  try {
    console.log("🚀 Starting database seed...");

    // ── 1. Shop ────────────────────────────────────────────────────────────
    console.log("📦 Creating shop...");
    const shop = await db.shop.upsert({
      where: { id: SHOP_ID },
      update: {},
      create: {
        id: SHOP_ID,
        shopifyDomain: SHOP_DOMAIN,
        shopifyToken: "shpat_demo_token_for_development_only",
        isActive: true,
        plan: "pro",
        currency: "EGP",
      },
    });
    console.log(`   ✅ Shop: ${shop.shopifyDomain}`);

    // Check if already seeded (idempotency guard)
    const existingSubscriberCount = await db.subscriber.count({
      where: { shopId: SHOP_ID },
    });
    if (existingSubscriberCount > 0) {
      console.log("   ⏭️  Database already seeded (found existing subscribers). Skipping.");
      console.log(`   📊 Existing subscribers: ${existingSubscriberCount}`);
      return;
    }

    // ── 2. ShopSettings ────────────────────────────────────────────────────
    console.log("⚙️  Creating shop settings...");
    await db.shopSettings.upsert({
      where: { shopId: SHOP_ID },
      update: {},
      create: {
        shopId: SHOP_ID,
        popupEnabled: true,
        popupDelaySeconds: 5,
        popupHeadline: "🎉 Get 10% OFF your first order!",
        popupSubtext: "Subscribe to receive exclusive deals via SMS",
        discountType: "percentage",
        discountValue: 10,
        buttonColor: "#10b981",
        buttonTextColor: "#FFFFFF",
        smsConsentText:
          "I agree to receive SMS marketing messages and confirm my order via SMS.",
        codConfirmationEnabled: true,
        autoApplyDiscount: true,
        maxRetriesPerGateway: 3,
        smsRetryIntervalMinutes: 30,
      },
    });
    console.log("   ✅ Shop settings created");

    // ── 3. SMSGatewayConfig ────────────────────────────────────────────────
    console.log("📡 Creating SMS gateway configs...");
    const encUsername1 = await safeEncrypt("sms_misr_user");
    const encPassword1 = await safeEncrypt("sms_misr_pass_12345");
    const encApiKey1 = await safeEncrypt("sms_misr_api_key_xyz");

    const encUsername2 = await safeEncrypt("victory_user");
    const encPassword2 = await safeEncrypt("victory_pass_67890");

    await db.sMSGatewayConfig.createMany({
      data: [
        {
          id: "gw-sms-misr-1",
          shopId: SHOP_ID,
          gatewayType: "SMS_MISR",
          encryptedUsername: encUsername1,
          encryptedPassword: encPassword1,
          encryptedApiKey: encApiKey1,
          senderName: "SMSShield",
          isActive: true,
          priority: 1,
          lastHealthCheckAt: new Date(),
          healthStatus: "healthy",
        },
        {
          id: "gw-victory-link-2",
          shopId: SHOP_ID,
          gatewayType: "VICTORY_LINK",
          encryptedUsername: encUsername2,
          encryptedPassword: encPassword2,
          encryptedApiKey: null,
          senderName: "SMSHld",
          isActive: true,
          priority: 2,
          lastHealthCheckAt: new Date(),
          healthStatus: "healthy",
        },
      ],
      
    });
    console.log("   ✅ 2 gateway configs created");

    // ── 4. DiscountCodes ───────────────────────────────────────────────────
    console.log("🏷️  Creating discount codes...");
    const discountCodesData = [
      { id: "dc-welcome10", code: "WELCOME10", discountType: "percentage", discountValue: 10, usageCount: 23, maxUsageCount: 100, isActive: true, expiresAt: daysAgo(-30) },
      { id: "dc-smsvip15", code: "SMSVIP15", discountType: "percentage", discountValue: 15, usageCount: 18, maxUsageCount: 50, isActive: true, expiresAt: daysAgo(-15) },
      { id: "dc-recovery20", code: "RECOVERY20", discountType: "percentage", discountValue: 20, usageCount: 42, maxUsageCount: 200, isActive: true, expiresAt: daysAgo(-60) },
      { id: "dc-cod5", code: "COD5", discountType: "fixed_amount", discountValue: 50, usageCount: 67, maxUsageCount: 500, isActive: true, expiresAt: daysAgo(-90) },
      { id: "dc-loyalty12", code: "LOYALTY12", discountType: "percentage", discountValue: 12, usageCount: 9, maxUsageCount: 30, isActive: true, expiresAt: daysAgo(-45) },
    ];

    await db.discountCode.createMany({
      data: discountCodesData.map((dc) => ({
        id: dc.id,
        shopId: SHOP_ID,
        code: dc.code,
        discountType: dc.discountType,
        discountValue: dc.discountValue,
        usageCount: dc.usageCount,
        maxUsageCount: dc.maxUsageCount,
        isActive: dc.isActive,
        startsAt: daysAgo(180),
        expiresAt: dc.expiresAt,
      })),
      
    });
    console.log("   ✅ 5 discount codes created");

    // ── 5. Subscribers (50) ───────────────────────────────────────────────
    console.log("👥 Creating 50 subscribers...");
    const subscribersData: Array<{
      id: string;
      shopId: string;
      phoneNumber: string;
      rawPhoneNumber: string;
      phoneHash: string;
      email: string | null;
      firstName: string | null;
      lastName: string | null;
      consentGranted: boolean;
      consentTimestamp: Date;
      source: string;
      discountCodeId: string | null;
      isVerified: boolean;
      tags: string;
      totalOrdersCount: number;
      totalRevenue: number;
      lastOrderAt: Date | null;
      firstOrderAt: Date | null;
      createdAt: Date;
    }> = [];

    const subscriberRFMData: Array<{
      subscriberId: string;
      recencyScore: number;
      frequencyScore: number;
      monetaryScore: number;
      segment: string;
      daysSinceLastOrder: number;
      totalOrders: number;
      totalRevenue: number;
      averageOrderValue: number;
    }> = [];

    for (let i = 0; i < 50; i++) {
      const sub = generateSubscriber(i);
      const subId = `sub-${String(i + 1).padStart(3, "0")}`;
      const normalizedPhone = sub.phoneNumber;

      const phoneHash = simpleHash(normalizedPhone);

      // Assign a discount code to some subscribers
      let discountCodeId: string | null = null;
      if (i < 10) discountCodeId = "dc-welcome10";
      else if (i >= 10 && i < 18) discountCodeId = "dc-smsvip15";
      else if (i >= 18 && i < 25) discountCodeId = "dc-recovery20";
      else if (i >= 25 && i < 35) discountCodeId = "dc-cod5";
      else if (i >= 35 && i < 40) discountCodeId = "dc-loyalty12";

      const lastOrderAt =
        sub.totalOrdersCount > 0 ? daysAgo(sub.daysSinceLastOrder) : null;
      const firstOrderAt =
        sub.totalOrdersCount > 0
          ? daysAgo(sub.daysSinceLastOrder + randomInt(30, 365))
          : null;

      subscribersData.push({
        id: subId,
        shopId: SHOP_ID,
        phoneNumber: normalizedPhone,
        rawPhoneNumber: normalizedPhone,
        phoneHash,
        email: sub.email ?? null,
        firstName: sub.firstName,
        lastName: sub.lastName,
        consentGranted: sub.consentGranted,
        consentTimestamp: daysAgo(randomInt(10, 365)),
        source: sub.source,
        discountCodeId,
        isVerified: sub.isVerified,
        tags: JSON.stringify(sub.tags),
        totalOrdersCount: sub.totalOrdersCount,
        totalRevenue: sub.totalRevenue,
        lastOrderAt,
        firstOrderAt,
        createdAt: daysAgo(randomInt(60, 730)),
      });

      // Calculate RFM for this subscriber
      const rfm = calculateRFM(
        sub.totalOrdersCount > 0 ? sub.daysSinceLastOrder : 999,
        sub.totalOrdersCount,
        sub.totalRevenue
      );

      subscriberRFMData.push({
        subscriberId: subId,
        recencyScore: rfm.recencyScore,
        frequencyScore: rfm.frequencyScore,
        monetaryScore: rfm.monetaryScore,
        segment: rfm.segment,
        daysSinceLastOrder:
          sub.totalOrdersCount > 0 ? sub.daysSinceLastOrder : 999,
        totalOrders: sub.totalOrdersCount,
        totalRevenue: sub.totalRevenue,
        averageOrderValue:
          sub.totalOrdersCount > 0
            ? sub.totalRevenue / sub.totalOrdersCount
            : 0,
      });
    }

    await db.subscriber.createMany({ data: subscribersData });
    console.log("   ✅ 50 subscribers created");

    // ── 6. RFMSegment ─────────────────────────────────────────────────────
    console.log("📊 Creating RFM segments...");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await db.rFMSegment.createMany({
      data: subscriberRFMData.map((rfm) => ({
        id: `rfm-${rfm.subscriberId}`,
        shopId: SHOP_ID,
        subscriberId: rfm.subscriberId,
        calculatedAt: today,
        recencyScore: rfm.recencyScore,
        frequencyScore: rfm.frequencyScore,
        monetaryScore: rfm.monetaryScore,
        rfmCompositeScore: rfm.recencyScore + rfm.frequencyScore + rfm.monetaryScore,
        segment: rfm.segment,
        daysSinceLastOrder: rfm.daysSinceLastOrder,
        totalOrders: rfm.totalOrders,
        totalRevenue: rfm.totalRevenue,
        averageOrderValue: Math.round(rfm.averageOrderValue * 100) / 100,
      })),
      
    });

    // Log segment distribution
    const segmentCounts: Record<string, number> = {};
    for (const rfm of subscriberRFMData) {
      segmentCounts[rfm.segment] = (segmentCounts[rfm.segment] || 0) + 1;
    }
    console.log(`   ✅ RFM segments: ${JSON.stringify(segmentCounts)}`);

    // ── 7. Campaigns (6) ──────────────────────────────────────────────────
    console.log("📢 Creating campaigns...");
    const campaignsData = [
      {
        id: "camp-summer-sale",
        shopId: SHOP_ID,
        name: "Summer Sale Broadcast",
        description: "Summer collection promotion with 15% off all items",
        type: "BROADCAST",
        status: "completed",
        messageTemplate: "☀️ Summer Sale! 15% off everything at {{store_name}}! Use code SUMMER15. Shop now: {{link}}",
        senderName: "SMSShield",
        gatewayType: "SMS_MISR",
        scheduledAt: daysAgo(45),
        startedAt: daysAgo(45),
        completedAt: daysAgo(44),
        totalRecipients: 2500,
        sentCount: 2480,
        deliveredCount: 2410,
        failedCount: 70,
        createdAt: daysAgo(50),
      },
      {
        id: "camp-ramadan-flash",
        shopId: SHOP_ID,
        name: "Ramadan Flash Sale",
        description: "Limited time Ramadan offers with exclusive SMS discounts",
        type: "BROADCAST",
        status: "completed",
        messageTemplate: "🌙 Ramadan Mubarak! Flash sale: up to 30% off. {{store_name}}. Code: RAMADAN30. {{link}}",
        senderName: "SMSShield",
        gatewayType: "SMS_MISR",
        scheduledAt: daysAgo(90),
        startedAt: daysAgo(90),
        completedAt: daysAgo(89),
        totalRecipients: 3200,
        sentCount: 3180,
        deliveredCount: 3100,
        failedCount: 80,
        createdAt: daysAgo(95),
      },
      {
        id: "camp-cart-recovery",
        shopId: SHOP_ID,
        name: "Cart Recovery Flow",
        description: "Automated 3-touch cart abandonment recovery sequence",
        type: "ABANDONED_CART",
        status: "running",
        messageTemplate: "🛒 You left items in your cart! Complete your order at {{store_name}} and get {{discount}} off. {{link}}",
        senderName: "SMSShield",
        gatewayType: "VICTORY_LINK",
        scheduledAt: null,
        startedAt: daysAgo(30),
        completedAt: null,
        totalRecipients: 450,
        sentCount: 420,
        deliveredCount: 380,
        failedCount: 40,
        createdAt: daysAgo(30),
      },
      {
        id: "camp-cod-june",
        shopId: SHOP_ID,
        name: "COD Confirmation - June",
        description: "Cash on delivery order confirmation campaign for June",
        type: "COD_CONFIRMATION",
        status: "completed",
        messageTemplate: "📦 Confirm your order #{{order_number}} from {{store_name}}. Tap to confirm: {{link}}",
        senderName: "SMSHld",
        gatewayType: "VICTORY_LINK",
        scheduledAt: daysAgo(20),
        startedAt: daysAgo(20),
        completedAt: daysAgo(19),
        totalRecipients: 800,
        sentCount: 800,
        deliveredCount: 790,
        failedCount: 10,
        createdAt: daysAgo(25),
      },
      {
        id: "camp-win-back",
        shopId: SHOP_ID,
        name: "Win Back At-Risk Customers",
        description: "Targeted re-engagement for at-risk and hibernating segments",
        type: "RFM_SEGMENT",
        status: "scheduled",
        segmentFilter: JSON.stringify({
          segments: ["AT_RISK", "HIBERNATING", "LOST"],
        }),
        messageTemplate: " misses you! Here's 25% off your next order at {{store_name}}. Code: COMEBACK25. {{link}}",
        senderName: "SMSShield",
        gatewayType: "SMS_MISR",
        scheduledAt: daysAgo(-3),
        startedAt: null,
        completedAt: null,
        totalRecipients: 0,
        sentCount: 0,
        deliveredCount: 0,
        failedCount: 0,
        createdAt: daysAgo(5),
      },
      {
        id: "camp-loyalty",
        shopId: SHOP_ID,
        name: "Loyalty Rewards",
        description: "Exclusive rewards for our most loyal customers",
        type: "BROADCAST",
        status: "draft",
        segmentFilter: JSON.stringify({
          segments: ["CHAMPION", "LOYAL", "POTENTIAL_LOYALIST"],
        }),
        messageTemplate: "👑 VIP Exclusive! You've earned {{discount}} off at {{store_name}} as a loyal customer. {{link}}",
        senderName: "SMSShield",
        gatewayType: "SMS_MISR",
        scheduledAt: null,
        startedAt: null,
        completedAt: null,
        totalRecipients: 0,
        sentCount: 0,
        deliveredCount: 0,
        failedCount: 0,
        createdAt: daysAgo(2),
      },
    ];

    await db.campaign.createMany({
      data: campaignsData,
      
    });
    console.log("   ✅ 6 campaigns created");

    // ── 8. CampaignMessages (~30) ─────────────────────────────────────────
    console.log("💬 Creating campaign messages...");
    const campaignMessagesData: Array<{
      id: string;
      campaignId: string;
      subscriberId: string;
      shopId: string;
      gatewayType: string;
      recipientPhone: string;
      messageContent: string;
      externalMessageId: string | null;
      status: string;
      errorMessage: string | null;
      sentAt: Date | null;
      deliveredAt: Date | null;
      failedAt: Date | null;
      retryCount: number;
      createdAt: Date;
    }> = [];

    const completedCampaigns = campaignsData.filter(
      (c) => c.status === "completed"
    );
    let msgIndex = 0;

    // Generate messages for completed campaigns
    for (const campaign of completedCampaigns) {
      const messageCount = campaign.id === "camp-summer-sale" ? 10
        : campaign.id === "camp-ramadan-flash" ? 10
        : campaign.id === "camp-cod-june" ? 10
        : 5;

      for (let i = 0; i < messageCount; i++) {
        msgIndex++;
        const subscriberIdx = (msgIndex * 3) % 50;
        const subId = `sub-${String(subscriberIdx + 1).padStart(3, "0")}`;
        const sub = subscribersData[subscriberIdx];
        const phone = sub ? sub.phoneNumber : generateEgyptianPhone(subscriberIdx);

        let status: string;
        let sentAt: Date | null = null;
        let deliveredAt: Date | null = null;
        let failedAt: Date | null = null;
        let errorMessage: string | null = null;
        let retryCount = 0;

        const statusRoll = Math.random();
        if (statusRoll < 0.75) {
          status = "delivered";
          sentAt = daysAgo(randomInt(15, 50));
          deliveredAt = new Date(sentAt.getTime() + randomInt(5000, 30000));
        } else if (statusRoll < 0.9) {
          status = "sent";
          sentAt = daysAgo(randomInt(15, 50));
        } else {
          status = "failed";
          sentAt = daysAgo(randomInt(15, 50));
          failedAt = new Date(sentAt.getTime() + randomInt(10000, 60000));
          errorMessage = "Gateway timeout - no response within 30s";
          retryCount = randomInt(1, 3);
        }

        campaignMessagesData.push({
          id: `cmsg-${String(msgIndex).padStart(4, "0")}`,
          campaignId: campaign.id,
          subscriberId: subId,
          shopId: SHOP_ID,
          gatewayType: campaign.gatewayType!,
          recipientPhone: phone,
          messageContent: campaign.messageTemplate
            .replace("{{store_name}}", "SMS-Shield Store")
            .replace("{{link}}", "https://sms-shield-demo.myshopify.com")
            .replace("{{order_number}}", `#${1000 + subscriberIdx}`)
            .replace("{{discount}}", "15%"),
          externalMessageId:
            status !== "failed"
              ? `ext-${randomInt(100000, 999999)}`
              : null,
          status,
          errorMessage,
          sentAt,
          deliveredAt,
          failedAt,
          retryCount,
          createdAt: daysAgo(randomInt(15, 50)),
        });
      }
    }

    await db.campaignMessage.createMany({
      data: campaignMessagesData,
      
    });
    console.log(`   ✅ ${campaignMessagesData.length} campaign messages created`);

    // ── 9. WebhookEvents (10) ─────────────────────────────────────────────
    console.log("🔗 Creating webhook events...");
    const webhookTopics = [
      "orders/create",
      "carts/update",
      "checkouts/update",
      "customers/create",
      "orders/create",
      "checkouts/update",
      "carts/update",
      "orders/create",
      "customers/create",
      "checkouts/update",
    ];

    const webhookStatuses = [
      "completed", "completed", "completed", "pending", "failed",
      "completed", "completed", "completed", "pending", "failed",
    ];

    const webhookPayloads: Record<string, string> = {
      "orders/create": JSON.stringify({
        id: 5678901234,
        order_number: 1042,
        email: "customer@example.com",
        total_price: "1250.00",
        financial_status: "pending",
        gateway: "cash_on_delivery",
      }),
      "carts/update": JSON.stringify({
        id: "crt_abc123",
        token: "tok_xyz789",
        items_count: 3,
        total_price: "890.00",
        currency: "EGP",
      }),
      "checkouts/update": JSON.stringify({
        id: 9876543210,
        token: "chk_def456",
        email: "buyer@example.com",
        total_price: "2340.00",
        shipping_address: { city: "Cairo", country: "Egypt" },
      }),
      "customers/create": JSON.stringify({
        id: 555444333,
        email: "newcustomer@example.com",
        first_name: "Ahmed",
        last_name: "Hassan",
        phone: "+201012345678",
        accepts_marketing: true,
      }),
    };

    await db.webhookEvent.createMany({
      data: webhookTopics.map((topic, i) => ({
        id: `wh-${String(i + 1).padStart(3, "0")}`,
        shopId: SHOP_ID,
        topic,
        shopifyDomain: SHOP_DOMAIN,
        payload: webhookPayloads[topic],
        processedAt:
          webhookStatuses[i] === "completed"
            ? daysAgo(randomInt(0, 10))
            : null,
        processingStatus: webhookStatuses[i],
        processingAttempts: webhookStatuses[i] === "failed" ? 3 : 1,
        errorMessage:
          webhookStatuses[i] === "failed"
            ? "Connection timeout: Shopify webhook delivery failed"
            : null,
        createdAt: daysAgo(randomInt(0, 14)),
      })),
      
    });
    console.log("   ✅ 10 webhook events created");

    // ── 10. CartAbandonment (15) ──────────────────────────────────────────
    console.log("🛒 Creating cart abandonments...");
    const recoveryStatuses = [
      "pending", "reminded_1", "reminded_2", "recovered", "expired",
      "pending", "reminded_1", "recovered", "reminded_2", "expired",
      "pending", "recovered", "reminded_1", "expired", "recovered",
    ];

    const cartLineItems = [
      JSON.stringify([
        { title: "Cotton T-Shirt - White", price: 350, quantity: 2, variant: "M" },
        { title: "Denim Jeans - Blue", price: 850, quantity: 1, variant: "32" },
      ]),
      JSON.stringify([
        { title: "Wireless Earbuds", price: 1200, quantity: 1, variant: "Black" },
        { title: "Phone Case - Clear", price: 150, quantity: 1, variant: "iPhone 15" },
      ]),
      JSON.stringify([
        { title: "Running Shoes", price: 2100, quantity: 1, variant: "42" },
      ]),
      JSON.stringify([
        { title: "Coffee Maker - Automatic", price: 3500, quantity: 1, variant: "Standard" },
        { title: "Coffee Beans - Arabica 1kg", price: 450, quantity: 2, variant: "" },
        { title: "Milk Frother", price: 280, quantity: 1, variant: "" },
      ]),
      JSON.stringify([
        { title: "Leather Wallet - Brown", price: 650, quantity: 1, variant: "" },
      ]),
      JSON.stringify([
        { title: "Perfume - Oud Collection", price: 1800, quantity: 1, variant: "50ml" },
        { title: "Gift Box", price: 100, quantity: 1, variant: "Premium" },
      ]),
      JSON.stringify([
        { title: "Smart Watch Band", price: 450, quantity: 2, variant: "Silicone" },
      ]),
      JSON.stringify([
        { title: "Backpack - Laptop 15.6\"", price: 1200, quantity: 1, variant: "Black" },
        { title: "USB-C Hub", price: 550, quantity: 1, variant: "7-in-1" },
      ]),
      JSON.stringify([
        { title: "Yoga Mat - Premium", price: 780, quantity: 1, variant: "Purple" },
        { title: "Resistance Bands Set", price: 320, quantity: 1, variant: "Medium" },
      ]),
      JSON.stringify([
        { title: "Blender - 1200W", price: 2800, quantity: 1, variant: "Silver" },
      ]),
      JSON.stringify([
        { title: "Sunglasses - Aviator", price: 950, quantity: 1, variant: "Gold/Green" },
      ]),
      JSON.stringify([
        { title: "Wireless Charger", price: 380, quantity: 1, variant: "Fast Charge" },
        { title: "Cable - USB-C to Lightning", price: 120, quantity: 3, variant: "1m" },
      ]),
      JSON.stringify([
        { title: "Face Cream - SPF50", price: 420, quantity: 2, variant: "50ml" },
      ]),
      JSON.stringify([
        { title: "Desk Lamp - LED", price: 650, quantity: 1, variant: "White" },
        { title: "Notebook Set - A5", price: 180, quantity: 2, variant: "Lined" },
      ]),
      JSON.stringify([
        { title: "Electric Kettle - 1.8L", price: 890, quantity: 1, variant: "Stainless" },
      ]),
    ];

    const cartTotals = [1550, 1350, 2100, 4230, 650, 1900, 900, 1750, 1100, 2800, 950, 740, 840, 1010, 890];

    await db.cartAbandonment.createMany({
      data: recoveryStatuses.map((status, i) => ({
        id: `cart-${String(i + 1).padStart(3, "0")}`,
        shopId: SHOP_ID,
        shopifyCartToken: `cart_token_${randomInt(10000, 99999)}`,
        shopifyCustomerId: `cust_${randomInt(1000, 9999)}`,
        subscriberId: subscribersData[i % 50].id,
        customerPhone: subscribersData[i % 50].phoneNumber,
        customerEmail: subscribersData[i % 50].email,
        customerName: `${subscribersData[i % 50].firstName} ${subscribersData[i % 50].lastName}`,
        cartTotal: cartTotals[i],
        currency: "EGP",
        lineItemsCount: JSON.parse(cartLineItems[i]).length,
        lineItemsData: cartLineItems[i],
        recoveryStatus: status,
        recoveryDiscountCode:
          status === "recovered" || status.startsWith("reminded")
            ? "RECOVERY20"
            : null,
        recoveredAt: status === "recovered" ? daysAgo(randomInt(1, 10)) : null,
        expiresAt: daysAgo(-5 + i * 2),
        createdAt: daysAgo(randomInt(1, 20)),
      })),
      
    });
    console.log("   ✅ 15 cart abandonments created");

    // ── 11. TouchPoints (10) ──────────────────────────────────────────────
    console.log("📍 Creating touch points...");
    const touchPointFlows = [
      { flowType: "CART_ABANDONMENT", flowState: "completed", currentStep: 3, totalSteps: 3 },
      { flowType: "POST_PURCHASE", flowState: "completed", currentStep: 1, totalSteps: 1 },
      { flowType: "COD_CONFIRMATION", flowState: "in_progress", currentStep: 1, totalSteps: 2 },
      { flowType: "CART_ABANDONMENT", flowState: "in_progress", currentStep: 2, totalSteps: 3 },
      { flowType: "POST_PURCHASE", flowState: "completed", currentStep: 1, totalSteps: 1 },
      { flowType: "COD_CONFIRMATION", flowState: "completed", currentStep: 2, totalSteps: 2 },
      { flowType: "CART_ABANDONMENT", flowState: "initialized", currentStep: 1, totalSteps: 3 },
      { flowType: "POST_PURCHASE", flowState: "completed", currentStep: 1, totalSteps: 1 },
      { flowType: "COD_CONFIRMATION", flowState: "in_progress", currentStep: 1, totalSteps: 2 },
      { flowType: "CART_ABANDONMENT", flowState: "paused", currentStep: 2, totalSteps: 3 },
    ];

    await db.touchPoint.createMany({
      data: touchPointFlows.map((tp, i) => ({
        id: `tp-${String(i + 1).padStart(3, "0")}`,
        shopId: SHOP_ID,
        subscriberId: subscribersData[i * 5 % 50].id,
        flowType: tp.flowType,
        flowState: tp.flowState,
        currentStep: tp.currentStep,
        totalSteps: tp.totalSteps,
        configuration: JSON.stringify({
          delays: [60, 1440, 2880],
          templateId: `tpl-${tp.flowType.toLowerCase()}`,
        }),
        nextActionAt:
          tp.flowState === "in_progress"
            ? daysAgo(-randomInt(1, 5))
            : null,
        lastActionAt: daysAgo(randomInt(0, 10)),
        completedAt: tp.flowState === "completed" ? daysAgo(randomInt(0, 5)) : null,
        isExpired: tp.flowState === "expired",
        createdAt: daysAgo(randomInt(2, 15)),
      })),
      
    });
    console.log("   ✅ 10 touch points created");

    // ── 12. LandingPages (5) ──────────────────────────────────────────────
    console.log("📄 Creating landing pages...");
    const landingPagesData = [
      {
        id: "lp-001",
        subscriberId: subscribersData[0].id,
        orderName: "#1001",
        slug: "cod-confirm-order-1001",
        storeName: "SMS-Shield Demo Store",
        storeLogoUrl: "https://cdn.shopify.com/s/files/1/logo.png",
        headline: "Confirm Your Order #1001",
        subtext: "Please confirm your cash on delivery order below. Your items will be shipped once confirmed.",
        orderDetails: JSON.stringify([
          { title: "Cotton T-Shirt - White (M)", price: 350, quantity: 2 },
          { title: "Denim Jeans - Blue (32)", price: 850, quantity: 1 },
        ]),
        orderTotal: 1550,
        isConfirmed: true,
        isCancelled: false,
        confirmedAt: daysAgo(5),
        cancelledAt: null,
        expiresAt: daysAgo(-10),
        visitCount: 3,
      },
      {
        id: "lp-002",
        subscriberId: subscribersData[5].id,
        orderName: "#1002",
        slug: "cod-confirm-order-1002",
        storeName: "SMS-Shield Demo Store",
        storeLogoUrl: "https://cdn.shopify.com/s/files/1/logo.png",
        headline: "Confirm Your Order #1002",
        subtext: "Please confirm your cash on delivery order below.",
        orderDetails: JSON.stringify([
          { title: "Wireless Earbuds - Black", price: 1200, quantity: 1 },
          { title: "Phone Case - iPhone 15", price: 150, quantity: 1 },
        ]),
        orderTotal: 1350,
        isConfirmed: false,
        isCancelled: true,
        confirmedAt: null,
        cancelledAt: daysAgo(8),
        expiresAt: daysAgo(-12),
        visitCount: 1,
      },
      {
        id: "lp-003",
        subscriberId: subscribersData[10].id,
        orderName: "#1003",
        slug: "cod-confirm-order-1003",
        storeName: "SMS-Shield Demo Store",
        storeLogoUrl: "https://cdn.shopify.com/s/files/1/logo.png",
        headline: "Confirm Your Order #1003",
        subtext: "Please confirm your cash on delivery order to proceed with shipping.",
        orderDetails: JSON.stringify([
          { title: "Running Shoes - 42", price: 2100, quantity: 1 },
        ]),
        orderTotal: 2100,
        isConfirmed: null,
        isCancelled: null,
        confirmedAt: null,
        cancelledAt: null,
        expiresAt: daysAgo(-2),
        visitCount: 5,
      },
      {
        id: "lp-004",
        subscriberId: subscribersData[15].id,
        orderName: "#1004",
        slug: "cod-confirm-order-1004",
        storeName: "SMS-Shield Demo Store",
        storeLogoUrl: "https://cdn.shopify.com/s/files/1/logo.png",
        headline: "Confirm Your Order #1004",
        subtext: "Tap the button below to confirm your COD order.",
        orderDetails: JSON.stringify([
          { title: "Coffee Maker - Automatic", price: 3500, quantity: 1 },
          { title: "Coffee Beans - Arabica 1kg", price: 450, quantity: 2 },
        ]),
        orderTotal: 4400,
        isConfirmed: true,
        isCancelled: false,
        confirmedAt: daysAgo(3),
        cancelledAt: null,
        expiresAt: daysAgo(-8),
        visitCount: 2,
      },
      {
        id: "lp-005",
        subscriberId: subscribersData[20].id,
        orderName: "#1005",
        slug: "cod-confirm-order-1005",
        storeName: "SMS-Shield Demo Store",
        storeLogoUrl: "https://cdn.shopify.com/s/files/1/logo.png",
        headline: "Confirm Your Order #1005",
        subtext: "Your order is ready! Please confirm to schedule delivery.",
        orderDetails: JSON.stringify([
          { title: "Perfume - Oud Collection 50ml", price: 1800, quantity: 1 },
          { title: "Gift Box - Premium", price: 100, quantity: 1 },
        ]),
        orderTotal: 1900,
        isConfirmed: null,
        isCancelled: null,
        confirmedAt: null,
        cancelledAt: null,
        expiresAt: daysAgo(-1),
        visitCount: 0,
      },
    ];

    await db.landingPage.createMany({
      data: landingPagesData.map((lp) => ({
        ...lp,
        shopId: SHOP_ID,
        customerName: `${subscribersData.find((s) => s.id === lp.subscriberId)?.firstName ?? ""} ${subscribersData.find((s) => s.id === lp.subscriberId)?.lastName ?? ""}`.trim(),
        currency: "EGP",
        createdAt: daysAgo(randomInt(5, 15)),
      })),
      
    });
    console.log("   ✅ 5 landing pages created");

    // ── 13. AutomationRules (4) ───────────────────────────────────────────
    console.log("🤖 Creating automation rules...");
    await db.automationRule.createMany({
      data: [
        {
          id: "rule-cart-recovery",
          shopId: SHOP_ID,
          name: "Cart Recovery 3-Touch",
          description: "Send up to 3 reminder SMS messages when a cart is abandoned. First reminder after 1 hour, second after 24 hours, third with discount after 48 hours.",
          triggerType: "CART_ABANDONED",
          triggerConditions: JSON.stringify({
            cartAgeMinutes: 60,
            minCartTotal: 200,
          }),
          actions: JSON.stringify([
            { type: "SEND_SMS", delayMinutes: 60, template: "cart_reminder_1" },
            { type: "SEND_SMS", delayMinutes: 1440, template: "cart_reminder_2" },
            { type: "SEND_SMS", delayMinutes: 2880, template: "cart_reminder_3_discount" },
          ]),
          isActive: true,
          executionCount: 45,
          lastExecutedAt: daysAgo(1),
        },
        {
          id: "rule-post-purchase",
          shopId: SHOP_ID,
          name: "Post Purchase Thank You",
          description: "Send a thank-you SMS after successful order completion with review request and referral code.",
          triggerType: "ORDER_CREATED",
          triggerConditions: JSON.stringify({
            paymentStatus: "paid",
            fulfillmentStatus: "fulfilled",
          }),
          actions: JSON.stringify([
            { type: "SEND_SMS", delayMinutes: 120, template: "post_purchase_thank_you" },
          ]),
          isActive: true,
          executionCount: 120,
          lastExecutedAt: daysAgo(0),
        },
        {
          id: "rule-win-back",
          shopId: SHOP_ID,
          name: "Win Back At-Risk",
          description: "Automatically target customers who haven't purchased in 60+ days with a personalized re-engagement offer.",
          triggerType: "RFM_SEGMENT_CHANGE",
          triggerConditions: JSON.stringify({
            segments: ["AT_RISK", "HIBERNATING"],
            minDaysSinceOrder: 60,
          }),
          actions: JSON.stringify([
            { type: "SEND_SMS", delayMinutes: 0, template: "win_back_offer" },
            { type: "SEND_SMS", delayMinutes: 10080, template: "win_back_final" },
          ]),
          isActive: true,
          executionCount: 12,
          lastExecutedAt: daysAgo(3),
        },
        {
          id: "rule-cod-confirm",
          shopId: SHOP_ID,
          name: "COD Confirmation",
          description: "Send COD order confirmation link via SMS immediately after checkout. Auto-cancel if not confirmed within 48 hours.",
          triggerType: "CHECKOUT_STARTED",
          triggerConditions: JSON.stringify({
            paymentGateway: "cash_on_delivery",
          }),
          actions: JSON.stringify([
            { type: "GENERATE_LANDING_PAGE", delayMinutes: 0 },
            { type: "SEND_SMS", delayMinutes: 5, template: "cod_confirmation_link" },
            { type: "CHECK_CONFIRMATION", delayMinutes: 2880 },
          ]),
          isActive: true,
          executionCount: 80,
          lastExecutedAt: daysAgo(0),
        },
      ],
      
    });
    console.log("   ✅ 4 automation rules created");

    // ── 14. SMSSendLog (50 entries) ───────────────────────────────────────
    console.log("📋 Creating SMS send logs...");
    const smsSendLogsData: Array<{
      id: string;
      shopId: string;
      campaignId: string | null;
      subscriberId: string | null;
      gatewayType: string;
      recipientPhoneHash: string;
      messageContent: string;
      externalMessageId: string | null;
      status: string;
      cost: number;
      currency: string;
      responseCode: string | null;
      responseMessage: string | null;
      latencyMs: number | null;
      retryCount: number;
      sentAt: Date | null;
      deliveredAt: Date | null;
      failedAt: Date | null;
      createdAt: Date;
    }> = [];

    const gateways = ["SMS_MISR", "VICTORY_LINK"];
    const campaignIds = ["camp-summer-sale", "camp-ramadan-flash", "camp-cart-recovery", "camp-cod-june"];
    const smsTemplates = [
      "☀️ Summer Sale! 15% off everything! Use code SUMMER15. Shop now: https://sms-shield-demo.myshopify.com",
      "🌙 Ramadan Mubarak! Flash sale: up to 30% off. Code: RAMADAN30.",
      "🛒 You left items in your cart! Complete your order and get 20% off.",
      "📦 Confirm your order #{{order_number}} from SMS-Shield Demo Store. Tap to confirm.",
      "🎉 Get 10% OFF your first order! Use code WELCOME10. Shop now!",
      "Thank you for your purchase! We'd love to hear your feedback ⭐",
    ];

    for (let i = 0; i < 50; i++) {
      const daysAgoValue = randomInt(0, 30);
      const gateway = pickRandom(gateways);
      const subscriberIdx = i % 50;
      const subId = subscribersData[subscriberIdx].id;
      const phoneHash = subscribersData[subscriberIdx].phoneHash;

      let status: string;
      let sentAt: Date | null = null;
      let deliveredAt: Date | null = null;
      let failedAt: Date | null = null;
      let responseCode: string | null = null;
      let responseMessage: string | null = null;
      let retryCount = 0;
      let latencyMs: number | null = null;

      const statusRoll = Math.random();
      if (statusRoll < 0.65) {
        status = "delivered";
        sentAt = daysAgo(daysAgoValue);
        deliveredAt = new Date(sentAt.getTime() + randomInt(3000, 15000));
        responseCode = "200";
        responseMessage = "Message delivered";
        latencyMs = randomInt(200, 2000);
      } else if (statusRoll < 0.85) {
        status = "sent";
        sentAt = daysAgo(daysAgoValue);
        responseCode = "202";
        responseMessage = "Message accepted";
        latencyMs = randomInt(100, 800);
      } else if (statusRoll < 0.95) {
        status = "failed";
        sentAt = daysAgo(daysAgoValue);
        failedAt = new Date(sentAt.getTime() + randomInt(5000, 30000));
        responseCode = "500";
        responseMessage = "Gateway error: insufficient balance";
        retryCount = randomInt(1, 3);
        latencyMs = randomInt(5000, 30000);
      } else {
        status = "bounced";
        sentAt = daysAgo(daysAgoValue);
        failedAt = new Date(sentAt.getTime() + randomInt(10000, 60000));
        responseCode = "603";
        responseMessage = "Number unreachable / bounced";
        retryCount = 2;
      }

      smsSendLogsData.push({
        id: `smslog-${String(i + 1).padStart(4, "0")}`,
        shopId: SHOP_ID,
        campaignId: i < 35 ? campaignIds[i % campaignIds.length] : null,
        subscriberId: subId,
        gatewayType: gateway,
        recipientPhoneHash: phoneHash,
        messageContent: smsTemplates[i % smsTemplates.length],
        externalMessageId:
          status !== "failed" && status !== "bounced"
            ? `gw_ext_${randomInt(1000000, 9999999)}`
            : null,
        status,
        cost: gateway === "SMS_MISR" ? randomFloat(0.05, 0.15) : randomFloat(0.06, 0.18),
        currency: "EGP",
        responseCode,
        responseMessage,
        latencyMs,
        retryCount,
        sentAt,
        deliveredAt,
        failedAt,
        createdAt: daysAgo(daysAgoValue),
      });
    }

    await db.sMSSendLog.createMany({
      data: smsSendLogsData,
      
    });
    console.log("   ✅ 50 SMS send logs created");

    // ── Summary ───────────────────────────────────────────────────────────
    console.log("");
    console.log("🎉 Database seed completed successfully!");
    console.log("───────────────────────────────────────");
    console.log(`   Shop:           1`);
    console.log(`   Settings:       1`);
    console.log(`   Gateways:       2`);
    console.log(`   Discount Codes: 5`);
    console.log(`   Subscribers:    50`);
    console.log(`   RFM Segments:   50`);
    console.log(`   Campaigns:      6`);
    console.log(`   Campaign Msgs:  ${campaignMessagesData.length}`);
    console.log(`   Webhook Events: 10`);
    console.log(`   Cart Abandon:   15`);
    console.log(`   Touch Points:   10`);
    console.log(`   Landing Pages:  5`);
    console.log(`   Auto Rules:     4`);
    console.log(`   SMS Send Logs:  50`);
    console.log("───────────────────────────────────────");
  } catch (err) {
    console.error("❌ Seed failed with error:", err);
    throw err;
  }
}
