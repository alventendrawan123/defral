import { z } from 'zod';

const DEFAULT_SITE_URL = 'http://localhost:3000';

const publicEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.url().optional(),
  NEXT_PUBLIC_SITE_URL: z.url().default(DEFAULT_SITE_URL),
});

const parsed = publicEnvSchema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || undefined,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
});

export const PUBLIC_ENV = parsed.success
  ? parsed.data
  : { NEXT_PUBLIC_API_URL: undefined, NEXT_PUBLIC_SITE_URL: DEFAULT_SITE_URL };

export function isBackendMode(): boolean {
  return typeof PUBLIC_ENV.NEXT_PUBLIC_API_URL === 'string';
}
