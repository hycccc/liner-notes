import { NextRequest, NextResponse } from 'next/server';
import { checkAuth } from '@/lib/adminAuth';
import { readContent, writeContent } from '@/lib/content';

export const dynamic = 'force-dynamic';

type Project = {
  title: string;
  description: string;
  status: string;
  tags: string[];
  url: string;
  icon: string;
};

export function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(readContent<Project[]>('projects.json', []));
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const data = await req.json();
    writeContent('projects.json', data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
