import { NextRequest } from 'next/server';

export function checkAuth(req: NextRequest): boolean {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  return !!token && token === process.env.ADMIN_PASSWORD;
}
