import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const VOTES_FILE = path.join(process.cwd(), 'data', 'votes.json');

type VoteMap = Record<string, { up: number; down: number }>;

function readVotes(): VoteMap {
  try {
    if (!fs.existsSync(VOTES_FILE)) return {};
    return JSON.parse(fs.readFileSync(VOTES_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeVotes(votes: VoteMap) {
  fs.mkdirSync(path.dirname(VOTES_FILE), { recursive: true });
  fs.writeFileSync(VOTES_FILE, JSON.stringify(votes, null, 2));
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug');
  const votes = readVotes();
  if (slug) return NextResponse.json(votes[slug] ?? { up: 0, down: 0 });
  return NextResponse.json(votes);
}

export async function POST(req: NextRequest) {
  const { slug, vote } = await req.json() as { slug: string; vote: 'up' | 'down' };
  if (!slug) return NextResponse.json({ error: 'missing slug' }, { status: 400 });
  const votes = readVotes();
  if (!votes[slug]) votes[slug] = { up: 0, down: 0 };
  if (vote === 'up') votes[slug].up++;
  else if (vote === 'down') votes[slug].down++;
  writeVotes(votes);
  return NextResponse.json(votes[slug]);
}

export async function DELETE(req: NextRequest) {
  const { slug, vote } = await req.json() as { slug: string; vote: 'up' | 'down' };
  if (!slug) return NextResponse.json({ error: 'missing slug' }, { status: 400 });
  const votes = readVotes();
  if (!votes[slug]) votes[slug] = { up: 0, down: 0 };
  if (vote === 'up') votes[slug].up = Math.max(0, votes[slug].up - 1);
  else if (vote === 'down') votes[slug].down = Math.max(0, votes[slug].down - 1);
  writeVotes(votes);
  return NextResponse.json(votes[slug]);
}
