import { cookies } from 'next/headers';

const COOKIE_NAME = 'wag_pricing_session';
const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8h

export async function verifySession(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get(COOKIE_NAME);
  if (!session?.value) return false;
  try {
    const data = JSON.parse(atob(session.value));
    return data.expires > Date.now();
  } catch {
    return false;
  }
}

export function createSessionValue(): string {
  return btoa(JSON.stringify({ expires: Date.now() + SESSION_DURATION }));
}

export const COOKIE_OPTIONS = {
  name: COOKIE_NAME,
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 8 * 60 * 60,
};
