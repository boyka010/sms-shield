FROM node:20-alpine AS base

RUN apk add --no-cache dumb-init

FROM base AS deps

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --only=production

FROM base AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 remix

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/build ./build
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

RUN chown remix:nodejs /app

USER remix

EXPOSE 3000

ENV PORT=3000
ENV HOST=0.0.0.0

CMD ["dumb-init", "npm", "start"]
