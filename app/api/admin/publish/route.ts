import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { checkAuth } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const build = spawn('sh', ['-c', 'npm run build && pm2 restart liner-notes'], {
    cwd: process.cwd(),
    detached: true,
    stdio: 'ignore',
  });
  build.unref();

  return NextResponse.json({ ok: true, message: 'Build started — live in about 60 seconds' });
}
