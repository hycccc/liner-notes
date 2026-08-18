import { NextRequest, NextResponse } from 'next/server';
import { checkAuth } from '@/lib/adminAuth';
import { readContent, writeContent } from '@/lib/content';

export const dynamic = 'force-dynamic';

const DEFAULT = {
  tagline: '',
  about: '',
  timeline: [] as { period: string; title: string; subtitle: string; type: 'work' | 'edu' }[],
};

export function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(readContent('home.json', DEFAULT));
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const data = await req.json();
    writeContent('home.json', data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
