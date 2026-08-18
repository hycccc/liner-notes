
export interface Song {
  id: number;
  title: string;
  artist: string;
  file: string;
  cover: string;
  tags: string[];
}

export interface BlogPost {
  id: number;
  title: string;
  date: string;
  excerpt: string;
  tags: string[];
  readTime?: string;
}

export interface TechStack {
  name: string;
  icon: string;
}

export interface Project {
  title: string;
  description: string;
  status: string;
  statusColor: string;
  tags: string[];
  stars: number;
  icon?: React.ReactNode;
  url?: string;
}
