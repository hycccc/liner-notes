'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/layout/Card';
import { GlobalLoader } from '@/components/layout/GlobalLoader';
import { useRouter, useSearchParams } from 'next/navigation';

type AiPostCategory = 'tech' | 'music' | 'social' | 'midifan';
type BlogTab = 'manual' | 'ai' | 'fav';
type SortMode = 'date' | 'hot';
type CategoryFilter = 'all' | 'tech' | 'music' | 'social' | 'midifan';

interface PostMeta {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  tags: string[];
  readTime?: string;
  aiGenerated?: boolean;
  aiCategory?: AiPostCategory;
}

const AI_CATEGORY_LABELS: Record<AiPostCategory, string> = {
  tech: 'Tech',
  music: 'Music',
  social: 'Society',
  midifan: 'Music Production',
};

export function BlogList({ isDark, posts }: { isDark: boolean; posts?: PostMeta[] }) {
  const router = useRouter();
  const [navigating, setNavigating] = useState(false);
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<BlogTab>(
(() => {
    const t = searchParams?.get('blogtab');
    if (t === 'ai' || t === 'fav') return t;
    return 'manual';
  })()
  );
  const [sortMode, setSortMode] = useState<SortMode>('date');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [allVotes, setAllVotes] = useState<Record<string, { up: number; down: number }>>({});

  const [favSlugs, setFavSlugs] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    return JSON.parse(localStorage.getItem('favSlugs') || '[]');
  });
  const touchMoved = useRef(false);
  const touchStartPos = useRef<{x: number; y: number} | null>(null);

  const displayPosts = useMemo(() => posts ?? [], [posts]);
  const { manualPosts, aiPosts } = useMemo(() => {
    const manual: PostMeta[] = [];
    const ai: PostMeta[] = [];

    for (const post of displayPosts) {
      if (post.aiGenerated) {
        ai.push(post);
      } else {
        manual.push(post);
      }
    }

    return {
      manualPosts: manual,
      aiPosts: ai,
    };
  }, [displayPosts]);


  const filteredPosts = useMemo(() => {
    let base = activeTab === 'manual' ? manualPosts : activeTab === 'fav' ? displayPosts.filter(p => favSlugs.includes(p.slug)) : aiPosts;
    if (activeTab === 'ai' && category !== 'all') base = base.filter(p => p.aiCategory === category);
    if (activeTab === 'ai' && sortMode === 'hot') {
      base = [...base].sort((a, b) => {
        const va = (allVotes[a.slug]?.up ?? 0) - (allVotes[a.slug]?.down ?? 0);
        const vb = (allVotes[b.slug]?.up ?? 0) - (allVotes[b.slug]?.down ?? 0);
        return vb - va;
      });
    }
    return base;
  }, [activeTab, manualPosts, aiPosts, displayPosts, favSlugs, category, sortMode, allVotes]);

  // Prefetch all posts on mount
  useEffect(() => {
    displayPosts.forEach(post => {
      if (!post.slug) return;
      router.prefetch(`/blog/${post.slug}?from=blog${post.aiGenerated ? '&blogtab=ai' : ''}`);
    });
  }, [displayPosts, router]);

  // Restore the blog list scroll position
  useEffect(() => {
    const saved = sessionStorage.getItem('blogListScrollY');
    if (saved) {
      sessionStorage.removeItem('blogListScrollY');
      const y = parseInt(saved);
      setTimeout(() => window.scrollTo({ top: y, behavior: 'instant' }), 50);
    }
  }, []);

  useEffect(() => {
    if (sortMode === 'hot') {
      fetch('/api/votes').then(r => r.json()).then(setAllVotes).catch(() => {});
    }
  }, [sortMode]);

  // After mount, read the correct tab: URL param (returning from a post) > sessionStorage (returning after switching main tabs)
  useEffect(() => {
    const t = searchParams?.get('blogtab');
    if (t === 'ai' || t === 'fav') { setActiveTab(t as BlogTab); return; }
    const s = sessionStorage.getItem('blogListTab');
    if (s === 'ai' || s === 'fav') setActiveTab(s as BlogTab);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync again when searchParams change (returning from a post)
  useEffect(() => {
    const t = searchParams?.get('blogtab');
    if (t === 'ai' || t === 'fav') setActiveTab(t as BlogTab);
  }, [searchParams]);

  // Store the tab in sessionStorage on switch (leave the URL alone to avoid clashing with the main tab param)
  useEffect(() => {
    sessionStorage.setItem('blogListTab', activeTab);
  }, [activeTab]);

  const handleNavigate = (slug: string) => {
    if (navigating) return;
    sessionStorage.setItem('blogListScrollY', String(window.scrollY));
    document.documentElement.classList.add('page-navigating');
    setNavigating(true);
    setTimeout(() => {
      router.push(`/blog/${slug}?from=blog${filteredPosts.find(p=>p.slug===slug)?.aiGenerated ? '&blogtab=ai' : ''}`);
    }, 600);
  };

  if (displayPosts.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card delay={100}>
          <div className="text-center py-8">
            <div className="text-4xl mb-4">📝</div>
            <p className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>No posts yet — stay tuned!</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <>
      <GlobalLoader isDark={isDark} show={navigating} />
      <div className="max-w-2xl mx-auto">
        <div className="mb-4 flex justify-center">
          <div className={`inline-flex p-1 rounded-2xl border backdrop-blur-xl ${isDark ? 'bg-zinc-900/70 border-zinc-800' : 'bg-white/80 border-zinc-200'}`}>
            <button
              onClick={() => setActiveTab('manual')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${activeTab === 'manual'
                ? isDark
                  ? 'bg-zinc-800 text-white shadow'
                  : 'bg-zinc-100 text-zinc-900 shadow'
                : isDark
                  ? 'text-zinc-400 hover:text-zinc-200'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              My Blog
              <span className={`ml-2 text-xs ${activeTab === 'manual' ? (isDark ? 'text-zinc-300' : 'text-zinc-600') : (isDark ? 'text-zinc-500' : 'text-zinc-500')}`}>
                {manualPosts.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${activeTab === 'ai'
                ? isDark
                  ? 'bg-violet-500/25 text-violet-200 shadow shadow-violet-500/20'
                  : 'bg-violet-100 text-violet-700 shadow'
                : isDark
                  ? 'text-zinc-400 hover:text-zinc-200'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              AI Daily
              <span className={`ml-2 text-xs ${activeTab === 'ai'
                ? isDark
                  ? 'text-violet-200'
                  : 'text-violet-700'
                : isDark
                  ? 'text-zinc-500'
                  : 'text-zinc-500'
              }`}>
                {aiPosts.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('fav')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${activeTab === 'fav'
                ? isDark ? 'bg-amber-500/25 text-amber-200 shadow shadow-amber-500/20' : 'bg-amber-100 text-amber-700 shadow'
                : isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              ★ Saved
              {favSlugs.length > 0 && <span className="ml-2 text-xs opacity-70">{favSlugs.length}</span>}
            </button>
          </div>
        </div>

        {/* AI Daily filter/sort bar */}
        {activeTab === 'ai' && (
          <div className="mb-3 flex items-center gap-2 flex-wrap">
            {/* Category */}
            <div className="flex gap-1 flex-wrap">
              {(['all','tech','music','social','midifan'] as CategoryFilter[]).map(cat => (
                <button key={cat} onClick={() => setCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${category === cat
                    ? isDark ? 'bg-violet-500/30 text-violet-200 border border-violet-500/40' : 'bg-violet-100 text-violet-700 border border-violet-300'
                    : isDark ? 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-transparent' : 'bg-zinc-100 text-zinc-500 hover:text-zinc-800 border border-transparent'
                  }`}>
                  {cat === 'all' ? 'All' : AI_CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
            {/* Sort */}
            <div className="ml-auto flex gap-1">
              {(['date','hot'] as SortMode[]).map(mode => (
                <button key={mode} onClick={() => setSortMode(mode)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${sortMode === mode
                    ? isDark ? 'bg-zinc-700 text-white' : 'bg-zinc-200 text-zinc-900'
                    : isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-500'
                  }`}>
                  {mode === 'date' ? 'Latest' : '🔥 Top'}
                </button>
              ))}
            </div>
          </div>
        )}

        {filteredPosts.length === 0 ? (
          <Card delay={100}>
            <div className="text-center py-8">
              <div className="text-4xl mb-4">{activeTab === 'manual' ? '📝' : '🛰️'}</div>
              <p className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>
                {activeTab === 'manual' ? 'No handwritten posts yet — stay tuned!' : 'No AI Daily posts yet — check back soon.'}
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredPosts.map((post) => {
              const categoryLabel = post.aiCategory ? AI_CATEGORY_LABELS[post.aiCategory] : 'Uncategorized';

              return (
                <div
                  key={post.slug}
                  onPointerDown={(e) => {
                    touchMoved.current = false;
                    touchStartPos.current = { x: e.clientX, y: e.clientY };
                  }}
                  onPointerMove={(e) => {
                    if (touchStartPos.current) {
                      const dx = Math.abs(e.clientX - touchStartPos.current.x);
                      const dy = Math.abs(e.clientY - touchStartPos.current.y);
                      if (dx > 8 || dy > 8) touchMoved.current = true;
                    }
                  }}
                  onPointerUp={() => {
                    if (!touchMoved.current) handleNavigate(post.slug);
                    touchStartPos.current = null;
                  }}
                  className="cursor-pointer active:scale-[0.98] active:opacity-70 transition-transform duration-75 select-none"
                  style={{ touchAction: 'manipulation' }}
                >
                  <Card delay={80}>
                    <article className="group">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className={`text-base font-bold group-hover:underline underline-offset-4 ${isDark ? 'text-white' : 'text-zinc-900'}`}>{post.title}</h3>
                        {post.aiGenerated && (
                          <>
                            <span className={`text-[10px] px-2 py-0.5 rounded-lg font-semibold tracking-wide ${isDark ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' : 'bg-violet-100 text-violet-700 border border-violet-200'}`}>
                              ✦ AI generated
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-lg font-medium ${isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-600'}`}>
                              {categoryLabel}
                            </span>
                          </>
                        )}
                      </div>
                      <p className={`text-sm mb-3 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{post.excerpt}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {post.tags?.map((tag, i) => (
                            <span key={i} className={`text-[11px] px-2 py-0.5 rounded-lg ${isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-600'}`}>{tag}</span>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          {favSlugs.includes(post.slug) && <span className="text-amber-400 text-xs">★</span>}
                          <span className={isDark ? 'text-zinc-500' : 'text-zinc-500'}>{post.date}</span>
                          {post.readTime && <span className={isDark ? 'text-zinc-600' : 'text-zinc-400'}>· {post.readTime}</span>}
                        </div>
                      </div>
                    </article>
                  </Card>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
