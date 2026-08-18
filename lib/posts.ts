import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const postsDirectory = path.join(process.cwd(), 'posts');
const AI_POST_FILENAME_PATTERN = /^\d{4}-\d{2}-\d{2}-(tech|music|social|midifan)-\d+$/;
const AI_CATEGORIES = ['tech', 'music', 'social', 'midifan'] as const;

export type AiPostCategory = (typeof AI_CATEGORIES)[number];

export interface PostMeta {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  tags: string[];
  readTime?: string;
  aiGenerated: boolean;
  aiCategory?: AiPostCategory;
}

export interface Post extends PostMeta {
  content: string;
}

function isAiPostCategory(value: unknown): value is AiPostCategory {
  return typeof value === 'string' && AI_CATEGORIES.includes(value as AiPostCategory);
}

function parseBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.trim().toLowerCase() === 'true';
  return false;
}

function parseString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0);
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return [value];
  }

  return [];
}

function parseAiCategoryFromSlug(slug: string): AiPostCategory | undefined {
  const match = slug.match(AI_POST_FILENAME_PATTERN);
  if (!match || !match[1]) return undefined;
  return isAiPostCategory(match[1]) ? match[1] : undefined;
}

function resolveAiMeta(slug: string, frontmatter: Record<string, unknown>): Pick<PostMeta, 'aiGenerated' | 'aiCategory'> {
  const aiCategoryFromSlug = parseAiCategoryFromSlug(slug);
  const aiGeneratedByFilename = Boolean(aiCategoryFromSlug);
  const aiGeneratedByFrontmatter = parseBoolean(frontmatter.aiGenerated);
  const aiCategoryFromFrontmatter = isAiPostCategory(frontmatter.aiCategory) ? frontmatter.aiCategory : undefined;

  return {
    aiGenerated: aiGeneratedByFilename || aiGeneratedByFrontmatter,
    aiCategory: aiCategoryFromSlug ?? aiCategoryFromFrontmatter,
  };
}

function buildPostMeta(slug: string, frontmatter: Record<string, unknown>): PostMeta {
  const readTime = parseString(frontmatter.readTime);
  const aiMeta = resolveAiMeta(slug, frontmatter);

  return {
    slug,
    title: parseString(frontmatter.title, slug),
    date: parseString(frontmatter.date),
    excerpt: parseString(frontmatter.excerpt),
    tags: parseTags(frontmatter.tags),
    readTime: readTime || undefined,
    ...aiMeta,
  };
}

export function getAllPosts(): PostMeta[] {
  if (!fs.existsSync(postsDirectory)) return [];
  
  const files = fs.readdirSync(postsDirectory).filter(f => f.endsWith('.md'));
  
  const posts = files.map((filename) => {
    const slug = filename.replace(/\.md$/, '');
    const fullPath = path.join(postsDirectory, filename);
    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const { data } = matter(fileContents);
    const frontmatter = data as Record<string, unknown>;

    return buildPostMeta(slug, frontmatter);
  });

  return posts.sort((a, b) => (a.date > b.date ? -1 : 1));
}

export function getPostBySlug(slug: string): Post | null {
  const fullPath = path.join(postsDirectory, `${slug}.md`);
  if (!fs.existsSync(fullPath)) return null;

  const fileContents = fs.readFileSync(fullPath, 'utf8');
  const { data, content } = matter(fileContents);
  const frontmatter = data as Record<string, unknown>;

  return {
    ...buildPostMeta(slug, frontmatter),
    content,
  };
}

export function getAllSlugs(): string[] {
  if (!fs.existsSync(postsDirectory)) return [];
  return fs.readdirSync(postsDirectory)
    .filter(f => f.endsWith('.md'))
    .map(f => f.replace(/\.md$/, ''));
}
