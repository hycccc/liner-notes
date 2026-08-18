'use client';

import { useTheme } from '@/contexts/ThemeContext';
import { BottomMusicPlayer } from './BottomMusicPlayer';

export function GlobalMusicPlayer() {
  const { theme, mounted } = useTheme();
  if (!mounted) return null;
  const isDark = theme === 'dark';
  return <BottomMusicPlayer isDark={isDark} />;
}
