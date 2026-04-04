# SMS-Shield

Enterprise-grade Shopify SMS Marketing App with RFM segmentation, automation, and multi-gateway SMS delivery.

## Features

- **Zero-Friction Capture**: Egyptian phone validation + auto-apply discount codes
- **Event-Driven Automation**: Webhook-based triggers for abandoned cart, post-purchase, win-back
- **Advanced RFM Segmentation**: Champions, Loyal, At-Risk, Price-Sensitive, New, Dormant
- **Multi-Gateway SMS**: SMS Misr, Victory Link, WE API with automatic failover
- **1-Click COD Confirmation**: Server-side rendered confirmation pages
- **Security First**: HMAC verification, AES-256 encryption, PDPL/GDPR compliant

## Tech Stack

- **Framework**: Shopify Remix App Template (React/Node.js)
- **Database**: PostgreSQL with Prisma ORM
- **Queue**: Redis (BullMQ)
- **CSS**: Tailwind CSS + Shopify Polaris
- **State**: Zustand
- **SMS Gateways**: SMS Misr, Victory Link, WE API

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- Shopify Partner Account

### Installation

```bash
# Clone repository
git clone https://github.com/your-org/sms-shield.git
cd sms-shield

# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Push database schema
npm run db:push

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Start development
npm run dev
```

### Environment Variables

```env
DATABASE_URL="postgresql://user:password@localhost:5432/sms_shield"
REDIS_URL="redis://localhost:6379"
MASTER_KEY="32-character-secure-key"
SHOPIFY_API_KEY=""
SHOPIFY_API_SECRET=""
SHOPIFY_ACCESS_TOKEN=""
SMS_MISR_API_KEY=""
VICTORY_LINK_USERNAME=""
VICTORY_LINK_PASSWORD=""
WE_API_KEY=""
```

## Workers

```bash
# Start all workers
npm run worker:all

# Start individual workers
npm run worker:sms      # SMS processing
npm run worker:webhook   # Webhook processing
npm run worker:campaign  # Campaign execution
npm run worker:cron     # Scheduled jobs
```

## Docker

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f app
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/webhooks` | POST | Shopify webhook receiver |
| `/api/sms-subscribers` | POST | Capture phone number |
| `/api/health` | GET | Health check |
| `/confirm-cod` | GET | COD confirmation page |

## Project Structure

```
sms-shield/
├── app/
│   ├── adapters/          # SMS gateway adapters
│   ├── components/        # React components
│   ├── queues/            # BullMQ queue definitions
│   ├── routes/            # Remix routes
│   ├── stores/            # Zustand stores
│   ├── utils/             # Security utilities
│   ├── workers/           # Background workers
│   └── services/          # Business logic
├── prisma/
│   └── schema.prisma      # Database schema
├── tests/                 # Test files
├── server/                # Worker entry points
└── docker-compose.yml     # Docker services
```

## Security

- All PII (phone, email) hashed with SHA-256
- API keys encrypted with AES-256-GCM
- HMAC signature verification for webhooks
- PDPL (Egypt) and GDPR (EU) compliant

## License

MIT
