/**
 * Validates required environment variables at startup.
 * Call this in middleware or top-level server code.
 * Throws hard errors rather than silent failures.
 */

const REQUIRED_SERVER_VARS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'ACCESS_CODE_SECRET',
] as const;

const REQUIRED_PUBLIC_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
] as const;

export function validateEnv(): void {
  const missing: string[] = [];

  for (const key of REQUIRED_SERVER_VARS) {
    if (!process.env[key]) missing.push(key);
  }
  for (const key of REQUIRED_PUBLIC_VARS) {
    if (!process.env[key]) missing.push(key);
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
}
