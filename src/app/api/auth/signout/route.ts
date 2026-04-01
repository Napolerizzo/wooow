import { NextResponse } from 'next/server';
import { clearGuestCookie } from '@/lib/guest-session';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.headers.append('Set-Cookie', clearGuestCookie());
  return response;
}
