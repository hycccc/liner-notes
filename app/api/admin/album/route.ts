import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { checkAuth } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

const filePath = () => join(process.cwd(), 'content', 'album.json');

const defaultAlbum = {
  title: '23',
  artist: 'June Holiday',
  year: '2026',
  concept: '',
  tracks: [],
};

function readAlbum() {
  const p = filePath();
  if (!existsSync(p)) return defaultAlbum;
  try {
    return JSON.parse(readFileSync(p, 'utf-8'));
  } catch {
    return defaultAlbum;
  }
}

export function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(readAlbum());
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const data = await req.json();
    const dir = join(process.cwd(), 'content');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(filePath(), JSON.stringify(data, null, 2), 'utf-8');
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
