import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const contentDir = () => join(process.cwd(), 'content');

export function readContent<T>(filename: string, fallback: T): T {
  const p = join(contentDir(), filename);
  if (!existsSync(p)) return fallback;
  try {
    return JSON.parse(readFileSync(p, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

export function writeContent(filename: string, data: unknown): void {
  const dir = contentDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), JSON.stringify(data, null, 2), 'utf-8');
}
