import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ ok: false, error: 'ADMIN_PASSWORD not set' }, { status: 500 });
  }
  if (password === process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ ok: true, token: process.env.ADMIN_PASSWORD });
  }
  return NextResponse.json({ ok: false }, { status: 401 });
}
