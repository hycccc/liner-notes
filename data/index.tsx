
import { Song, BlogPost, TechStack, Project } from '@/types';
import { Globe } from 'lucide-react';

// The player playlist. Files live in /public/music — the three demo tracks
// are synthesized (CC0, no rights questions); replace them with your own.
// `scripts/sync-playlist.js` can keep this list in sync with a streaming
// service if you wire up your own API instance.
export const playlist: Song[] = [
  { id: 1, title: "Last Train Coast", artist: "June Holiday", file: "last-train-coast.mp3", cover: "/music/last-train-coast.svg", tags: ["pop", "night"] },
  { id: 2, title: "Harbour Lights", artist: "June Holiday", file: "harbour-lights.mp3", cover: "/music/harbour-lights.svg", tags: ["ballad", "calm"] },
  { id: 3, title: "Return Ticket", artist: "June Holiday", file: "return-ticket.mp3", cover: "/music/return-ticket.svg", tags: ["rnb", "warm"] },
];

export const blogPosts: BlogPost[] = [
  { id: 1, title: 'Why this site has a workshop, not a discography', date: '2026-05-01', excerpt: 'Finished songs are the least interesting part of making songs.', tags: ['music', 'process'], readTime: '4 min' },
  { id: 2, title: 'Hello World!', date: '2026-04-18', excerpt: 'A site assembled by an agent, supervised by a musician.', tags: ['meta'], readTime: '2 min' },
];

export const techStack: TechStack[] = [
  { name: 'Python', icon: '🐍' },
  { name: 'Node.js', icon: '🟢' },
  { name: 'Docker', icon: '🐳' },
];

export const instrumentStack: TechStack[] = [
  { name: 'Piano', icon: '🎹' },
  { name: 'Guitar', icon: '🎸' },
  { name: 'Voice', icon: '🎤' },
  { name: 'Synth', icon: '🎛️' },
];

export const projects: Project[] = [
  {
    title: 'This site',
    description: "The site you're looking at — music player, album workspace, travel map, agent-written blog. Fork it: it's a template.",
    status: 'LIVE',
    statusColor: 'bg-teal-500/20 text-teal-400',
    tags: ['Next.js', 'Tailwind CSS', 'TypeScript'],
    stars: 0,
    icon: <Globe className="w-5 h-5" />,
    url: 'https://github.com/hycccc/liner-notes',
  },
];
