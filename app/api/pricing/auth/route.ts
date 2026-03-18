import { NextRequest, NextResponse } from 'next/server';
import { createSessionValue, COOKIE_OPTIONS } from '@/app/pricing/lib/auth';

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const expected = process.env.PRICING_PASSWORD;
  if (!expected) {
    return NextResponse.json({ error: 'PRICING_PASSWORD non configuré' }, { status: 500 });
  }
  if (password !== expected) {
    return NextResponse.json({ error: 'Mot de passe incorrect' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_OPTIONS.name, createSessionValue(), COOKIE_OPTIONS);
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_OPTIONS.name, '', { ...COOKIE_OPTIONS, maxAge: 0 });
  return res;
}
