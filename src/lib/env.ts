/**
 * SMS-Shield Environment Variable Validation
 *
 * Validates required and optional environment variables at startup
 * using Zod schemas. Falls back to development defaults when
 * validation fails in non-production environments.
 */

import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be at least 32 characters').optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SHOPIFY_API_SECRET: z.string().min(1).optional(),
  SHOPIFY_API_KEY: z.string().min(1).optional(),
  NEXTAUTH_SECRET: z.string().min(1).optional(),
  NEXTAUTH_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const raw = {
    DATABASE_URL: process.env.DATABASE_URL,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    NODE_ENV: process.env.NODE_ENV,
    SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET,
    SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  };

  const parsed = envSchema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    console.error('❌ Invalid environment variables:', JSON.stringify(fieldErrors, null, 2));

    // In development, use safe defaults so the app can start
    if (raw.NODE_ENV !== 'production') {
      console.warn('⚠️  Using development defaults for missing environment variables.');
      return {
        DATABASE_URL: raw.DATABASE_URL || 'file:./dev.db',
        ENCRYPTION_KEY: raw.ENCRYPTION_KEY || 'dev-encryption-key-32-bytes-long-000000',
        NODE_ENV: (raw.NODE_ENV as Env['NODE_ENV']) || 'development',
        SHOPIFY_API_SECRET: raw.SHOPIFY_API_SECRET,
        SHOPIFY_API_KEY: raw.SHOPIFY_API_KEY,
        NEXTAUTH_SECRET: raw.NEXTAUTH_SECRET,
        NEXTAUTH_URL: raw.NEXTAUTH_URL,
      };
    }

    // In production, throw to prevent startup with invalid config
    throw new Error(
      `Invalid environment variables: ${Object.entries(fieldErrors)
        .map(([key, msgs]) => `${key}: ${msgs?.join(', ')}`)
        .join('; ')}`
    );
  }

  return parsed.data;
}

export const env = validateEnv();
