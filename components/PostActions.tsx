'use client';

import { useEffect, useState } from 'react';

type Vote = 'up' | 'down' | null;

interface Props {
  slug: string;
}

export default function PostActions({ slug }: Props) {
  const [votes, setVotes] = useState({ up: 0, down: 0 });
  const [myVote, setMyVote] = useState<Vote>(() => {
    if (typeof window === 'undefined') return null;
    return (localStorage.getItem(`vote_${slug}`) as Vote) ?? null;
  });
  const [bookmarked, setBookmarked] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(`fav_${slug}`) === '1';
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/votes?slug=${encodeURIComponent(slug)}`)
      .then(r => r.json()).then(setVotes).catch(() => {});
  }, [slug]);

  const handleVote = async (dir: 'up' | 'down') => {
    if (loading) return;
    setLoading(true);
    try {
      if (myVote === dir) {
        const res = await fetch('/api/votes', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, vote: dir }) });
        setVotes(await res.json()); setMyVote(null); localStorage.removeItem(`vote_${slug}`);
      } else {
        if (myVote) await fetch('/api/votes', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, vote: myVote }) });
        const res = await fetch('/api/votes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, vote: dir }) });
        const data = await res.json(); setVotes(data); setMyVote(dir); localStorage.setItem(`vote_${slug}`, dir); if (dir === 'up') localStorage.setItem(`votes_up_${slug}`, String(data.up));
      }
    } catch {}
    setLoading(false);
  };

  const toggleBookmark = () => {
    const next = !bookmarked;
    setBookmarked(next);
    if (next) {
      localStorage.setItem(`fav_${slug}`, '1');
      const favs: string[] = JSON.parse(localStorage.getItem('favSlugs') || '[]');
      if (!favs.includes(slug)) localStorage.setItem('favSlugs', JSON.stringify([...favs, slug]));
    } else {
      localStorage.removeItem(`fav_${slug}`);
      const favs: string[] = JSON.parse(localStorage.getItem('favSlugs') || '[]');
      localStorage.setItem('favSlugs', JSON.stringify(favs.filter(s => s !== slug)));
    }
  };

  return (
    <div className="flex items-center gap-3 select-none flex-wrap">
      <button onClick={() => handleVote('up')} disabled={loading}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all active:scale-95 ${myVote === 'up' ? 'bg-orange-500 text-white shadow-md scale-105' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-orange-50 dark:hover:bg-orange-900/30 hover:text-orange-600'}`}>
        <span>🔥</span><span>Fire</span>{votes.up > 0 && <span className="text-xs opacity-70">{votes.up}</span>}
      </button>
      <button onClick={() => handleVote('down')} disabled={loading}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all active:scale-95 ${myVote === 'down' ? 'bg-stone-500 text-white shadow-md scale-105' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'}`}>
        <span>💤</span><span>Meh</span>{votes.down > 0 && <span className="text-xs opacity-70">{votes.down}</span>}
      </button>
      <button onClick={toggleBookmark}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all active:scale-95 ml-auto ${bookmarked ? 'bg-amber-400 text-white shadow-md' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 hover:text-amber-600'}`}>
        <span>{bookmarked ? '★' : '☆'}</span><span>{bookmarked ? 'Saved' : 'Save'}</span>
      </button>
    </div>
  );
}
