import { Metadata } from 'next';
import { getAllPosts, getPostBySlug } from '@/lib/posts';
import BlogPostClient from '@/components/BlogPostClient';
import { notFound } from 'next/navigation';
import site from '@/content/site.json';

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return { title: 'Post Not Found' };
  }

  const title = `${post.title} | ${site.name}`;
  const description = post.excerpt || post.title;

  return {
    title,
    description,
    openGraph: {
      title: post.title,
      description,
      type: 'article',
      publishedTime: post.date,
      authors: [site.name],
      tags: post.tags,
      locale: 'en_US',
      images: [{ url: site.avatar, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary',
      title: post.title,
      description,
      images: [site.avatar],
    },
  };
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  return <BlogPostClient post={post} />;
}
