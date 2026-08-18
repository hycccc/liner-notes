export type TrackStatus = 'Idea' | 'Demo' | 'Recording' | 'Mixing' | 'Done';

export interface AlbumTrackData {
  number: string;
  title: string;
  status: string;
  currentlyWorking?: boolean;
  demo?: string;
  story?: string;
  lyrics?: string;
  notes?: string;
  tags?: string[];
}

export interface AlbumData {
  title: string;
  artist: string;
  year: string;
  concept: string;
  tracks: AlbumTrackData[];
}

export const defaultAlbumData: AlbumData = {
  title: 'Night Trains',
  artist: 'June Holiday',
  year: '2026',
  concept: '',
  tracks: [],
};
