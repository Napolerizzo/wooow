/**
 * Simple in-memory rate limiter.
 * In production, replace with Redis-backed solution (e.g. @upstash/ratelimit).
 * This is sufficient for single-instance deployments.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

/**
 * Check and record a rate limit hit.
 * @returns true if the request is allowed, false if rate limited
 */
export function checkRateLimit(
  key: string,
  maxRequests: number = 10,
  windowMs: number = 60_000
): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count++;
  return true;
}

// Cleanup stale entries every 5 minutes to prevent memory leaks
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of Array.from(store.entries())) {
      if (now > entry.resetAt) {
        store.delete(key);
      }
    }
  }, 5 * 60_000);
}
