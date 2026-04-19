import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

// Validated at startup — missing required vars throw before the app mounts.
// Add new EXPO_PUBLIC_* vars here AND in .env.example.
export const env = createEnv({
    clientPrefix: 'EXPO_PUBLIC_',
    client: {
        EXPO_PUBLIC_API_URL: z.url(),
        EXPO_PUBLIC_SENTRY_DSN: z.string().optional(),
        EXPO_PUBLIC_ENV: z.enum(['development', 'preview', 'production']).default('development')
    },
    runtimeEnv: {
        EXPO_PUBLIC_API_URL: process.env['EXPO_PUBLIC_API_URL'],
        EXPO_PUBLIC_SENTRY_DSN: process.env['EXPO_PUBLIC_SENTRY_DSN'],
        EXPO_PUBLIC_ENV: process.env['EXPO_PUBLIC_ENV']
    }
});
