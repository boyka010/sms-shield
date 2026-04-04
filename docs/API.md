# API Reference

## Webhooks

### POST /webhooks

Receives Shopify webhooks for cart updates, orders, and checkouts.

**Headers:**
- `X-Shopify-Hmac-SHA256`: HMAC signature
- `X-Shopify-Topic`: Webhook topic

**Topics:**
- `carts/update`
- `orders/create`
- `checkouts/update`

**Response:**
```json
{
  "success": true
}
```

## SMS Subscribers

### POST /api/sms-subscribers

Capture phone number and apply discount.

**Body:**
```json
{
  "phone": "01012345678",
  "storeUrl": "store.myshopify.com",
  "email": "customer@example.com",
  "firstName": "Ahmed"
}
```

**Response:**
```json
{
  "success": true,
  "contactId": "abc123",
  "phone": "201012345678"
}
```

## Health Check

### GET /api/health

Returns system health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:00:00Z",
  "services": {
    "database": { "status": "up", "latency": 12 },
    "redis": { "status": "up", "latency": 2 },
    "smsGateways": [{ "status": "up", "message": "SMS_MISR: Available" }],
    "jobs": { "pending": 5, "processing": 2, "completed": 100, "failed": 3 }
  }
}
```

## COD Confirmation

### GET /confirm-cod?token=xxx&order=123

Server-side rendered confirmation page.

**Query Parameters:**
- `token`: Confirmation token
- `order`: Order number

**Actions:**
- `confirm`: Confirm COD order
- `cancel`: Cancel COD order

---

# Database Schema

## Core Models

### Merchant
```prisma
model Merchant {
  id              String    @id @default(cuid())
  shopifyStoreUrl String    @unique
  shopifyApiKey   String
  shopifyApiSecret String
  accessToken     String
}
```

### Contact
```prisma
model Contact {
  id              String       @id @default(cuid())
  phoneNumber     String
  phoneNumberHash String
  segment         SegmentType
  rfmTotalScore   Int
  smsOptIn        Boolean
}
```

### Segment Types
- `CHAMPIONS` - Best customers (RFM ≥ 12)
- `LOYAL` - Regular buyers
- `AT_RISK` - Declining engagement
- `PRICE_SENSITIVE` - Need discounts
- `NEW` - Recent first purchase
- `DORMANT` - Inactive 6+ months

---

# SMS Message Variables

Use these placeholders in message templates:

| Variable | Description |
|----------|-------------|
| `{{firstName}}` | Customer first name |
| `{{lastName}}` | Customer last name |
| `{{phoneNumber}}` | Phone number |
| `{{totalOrders}}` | Total order count |
| `{{totalSpent}}` | Total spent (EGP) |
