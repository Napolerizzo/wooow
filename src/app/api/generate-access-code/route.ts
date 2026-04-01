import { NextRequest, NextResponse } from 'next/server';
import { createHmac, randomBytes } from 'crypto';
import { checkRateLimit } from '@/lib/rate-limit';
import bcrypt from 'bcryptjs';

/**
 * Generate a server-signed 8-character uppercase alphanumeric access code.
 * Uses HMAC-SHA256 with committee_id + random salt + server secret.
 * Returns: { code, hash }
 * The hash is stored in DB; the code is shown to user once only.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  if (!checkRateLimit(`gen-code:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const secret = process.env.ACCESS_CODE_SECRET;
  if (!secret) {
    console.error('[generate-access-code] ACCESS_CODE_SECRET not set');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  let body: { committee_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { committee_id } = body;
  if (!committee_id || typeof committee_id !== 'string' || committee_id.length > 36) {
    return NextResponse.json({ error: 'Invalid committee_id' }, { status: 400 });
  }

  // Generate an 8-char alphanumeric code using HMAC-SHA256
  const salt = randomBytes(16).toString('hex');
  const hmac = createHmac('sha256', secret)
    .update(`${committee_id}:${salt}`)
    .digest('hex');

  // Map hex digest to alphanumeric charset and take 8 chars
  const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // remove ambiguous chars
  let code = '';
  for (let i = 0; i < 8; i++) {
    const byte = parseInt(hmac.slice(i * 2, i * 2 + 2), 16);
    code += CHARSET[byte % CHARSET.length];
  }

  // Hash the code with bcrypt for storage
  const hash = await bcrypt.hash(code, 12);

  return NextResponse.json({ code, hash }, { status: 200 });
}
