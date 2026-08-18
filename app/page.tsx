import { Suspense } from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import HomeClient from '@/components/HomeClient';
import { getAllPosts } from '@/lib/posts';
import { readContent } from '@/lib/content';
import { defaultAlbumData, type AlbumData } from '@/types/album';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseAlbumData(raw: unknown): AlbumData {
  if (!isRecord(raw)) return defaultAlbumData;

  const tracks = Array.isArray(raw.tracks)
    ? raw.tracks
        .filter(isRecord)
        .map((track, index) => ({
          number: typeof track.number === 'string' ? track.number : String(index + 1).padStart(2, '0'),
          title: typeof track.title === 'string' ? track.title : '',
          status: typeof track.status === 'string' ? track.status : 'Idea',
          currentlyWorking: typeof track.currentlyWorking === 'boolean' ? track.currentlyWorking : false,
          demo: typeof track.demo === 'string' ? track.demo : '',
          story: typeof track.story === 'string' ? track.story : '',
          lyrics: typeof track.lyrics === 'string' ? track.lyrics : '',
          notes: typeof track.notes === 'string' ? track.notes : '',
          tags: Array.isArray(track.tags) ? track.tags.filter((tag): tag is string => typeof tag === 'string') : [],
        }))
    : defaultAlbumData.tracks;

  return {
    title: typeof raw.title === 'string' ? raw.title : defaultAlbumData.title,
    artist: typeof raw.artist === 'string' ? raw.artist : defaultAlbumData.artist,
    year: typeof raw.year === 'string' ? raw.year : defaultAlbumData.year,
    concept: typeof raw.concept === 'string' ? raw.concept : defaultAlbumData.concept,
    tracks,
  };
}

function readAlbumData(): AlbumData {
  try {
    const albumPath = join(process.cwd(), 'content', 'album.json');
    const content = readFileSync(albumPath, 'utf-8');
    return parseAlbumData(JSON.parse(content));
  } catch {
    return defaultAlbumData;
  }
}

export default async function Home() {
  const posts = getAllPosts();
  const homeData = readContent('home.json', {
    tagline: 'June Holiday · songwriter & producer · somewhere near the sea',
    about: "I write songs about places I haven't been yet, then go see if I got them right.",
    timeline: [
      { period: '2024 - now', title: 'Nightjar Records', subtitle: 'Songwriter & producer', type: 'work' as const },
      { period: '2020 - 2024', title: 'Seaside Conservatory', subtitle: 'Composition · B.A.', type: 'edu' as const },
    ],
  });
  const projectsData = readContent('projects.json', null);
  const albumData = readAlbumData();

  return (
    <Suspense>
      <HomeClient posts={posts} homeData={homeData} projectsData={projectsData ?? undefined} albumData={albumData} />
    </Suspense>
  );
}
