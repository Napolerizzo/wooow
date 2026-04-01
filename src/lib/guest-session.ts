/**
 * Guest session management.
 * Stored as a signed httpOnly cookie (not localStorage) for security.
 * The cookie contains: committee_id, guest_name, expires_at.
 * The access_code is NEVER stored — only used during verification.
 */

import { createHmac } from 'crypto';

export const GUEST_COOKIE_NAME = 'markzo_guest';
const GUEST_SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface GuestSession {
  committee_id: string;
  guest_name: string;
  expires_at: number; // Unix timestamp ms
}

function getSecret(): string {
  const secret = process.env.ACCESS_CODE_SECRET;
  if (!secret) throw new Error('ACCESS_CODE_SECRET not set');
  return secret;
}

/** Sign a guest session payload and return a compact string for the cookie value. */
export function signGuestSession(session: GuestSession): string {
  const payload = JSON.stringify(session);
  const b64 = Buffer.from(payload).toString('base64url');
  const sig = createHmac('sha256', getSecret()).update(b64).digest('base64url');
  return `${b64}.${sig}`;
}

/** Verify and parse a guest session cookie value. Returns null if invalid/expired. */
export function verifyGuestSession(cookieValue: string): GuestSession | null {
  try {
    const [b64, sig] = cookieValue.split('.');
    if (!b64 || !sig) return null;

    const expectedSig = createHmac('sha256', getSecret())
      .update(b64)
      .digest('base64url');

    // Constant-time comparison to prevent timing attacks
    if (sig.length !== expectedSig.length) return null;
    let diff = 0;
    for (let i = 0; i < sig.length; i++) {
      diff |= sig.charCodeAt(i) ^ expectedSig.charCodeAt(i);
    }
    if (diff !== 0) return null;

    const session: GuestSession = JSON.parse(
      Buffer.from(b64, 'base64url').toString('utf8')
    );

    if (Date.now() > session.expires_at) return null;
    if (!session.committee_id || !session.guest_name) return null;

    return session;
  } catch {
    return null;
  }
}

/** Build a Set-Cookie header string for the guest session. */
export function buildGuestCookie(session: GuestSession): string {
  const value = signGuestSession(session);
  const maxAge = Math.floor(GUEST_SESSION_TTL_MS / 1000);
  return [
    `${GUEST_COOKIE_NAME}=${value}`,
    `Max-Age=${maxAge}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    process.env.NODE_ENV === 'production' ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

/** Build a cookie string that expires the guest session immediately. */
export function clearGuestCookie(): string {
  return [
    `${GUEST_COOKIE_NAME}=`,
    'Max-Age=0',
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
  ].join('; ');
}

export function getGuestSessionTTL(): number {
  return GUEST_SESSION_TTL_MS;
}
