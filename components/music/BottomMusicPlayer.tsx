'use client';

import { useRef, useState } from 'react';
import { useSwipe } from '@/hooks/useSwipe';
import { playlist } from '@/data';
import { Music } from 'lucide-react';
import Image from 'next/image';
import { useMusic } from '@/contexts/MusicContext';

interface BottomMusicPlayerProps {
  isDark: boolean;
}

function formatTime(s: number): string {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export const BottomMusicPlayer = ({ isDark }: BottomMusicPlayerProps) => {
  const {
    isPlaying, currentTrackIndex, progress, currentTime, duration,
    togglePlay, nextTrack, prevTrack, seekTo, audioRef,
  } = useMusic();
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekProgress, setSeekProgress] = useState(0);

  const { handleTouchStart, handleTouchMove, handleTouchEnd, swipeState } = useSwipe({
    onSwipeLeft: nextTrack,
    onSwipeRight: prevTrack,
  });

  const getRatio = (clientX: number) => {
    if (!progressBarRef.current) return 0;
    const rect = progressBarRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  const handleSeekStart = (clientX: number) => {
    setIsSeeking(true);
    setSeekProgress(getRatio(clientX) * 100);
  };

  const handleSeekMove = (clientX: number) => {
    if (!isSeeking) return;
    setSeekProgress(getRatio(clientX) * 100);
  };

  const handleSeekEnd = (clientX: number) => {
    if (!isSeeking) return;
    const ratio = getRatio(clientX);
    seekTo(ratio);
    setIsSeeking(false);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:bottom-0">
      <div className={`backdrop-blur-xl border-t ${
        isDark 
          ? 'bg-zinc-900/90 border-zinc-800' 
          : 'bg-white/90 border-zinc-200'
      }`} style={{ touchAction: 'pan-x', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {/* Progress bar: single h-1 layer, no extra padding, does not cover the floating nav */}
        <div 
          ref={progressBarRef}
          className="h-1 cursor-pointer group relative"
          style={{ touchAction: 'none' }}
          onMouseDown={(e) => handleSeekStart(e.clientX)}
          onMouseMove={(e) => handleSeekMove(e.clientX)}
          onMouseUp={(e) => handleSeekEnd(e.clientX)}
          onMouseLeave={() => setIsSeeking(false)}
          onTouchStart={(e) => { e.preventDefault(); handleSeekStart(e.touches[0].clientX); }}
          onTouchMove={(e) => { e.preventDefault(); handleSeekMove(e.touches[0].clientX); }}
          onTouchEnd={(e) => { e.preventDefault(); handleSeekEnd(e.changedTouches[0].clientX); }}
        >
          <div className={`absolute inset-0 rounded-full ${isDark ? 'bg-zinc-700' : 'bg-zinc-200'}`} />
          <div 
            className="absolute left-0 top-0 bottom-0 rounded-full bg-gradient-to-r from-red-500 to-pink-500"
            style={{ width: `${isSeeking ? seekProgress : progress}%`, transition: isSeeking ? 'none' : 'width 200ms' }}
          />
          <div 
            className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-md opacity-0 md:group-hover:opacity-100 transition-opacity"
            style={{ left: `calc(${progress}% - 5px)` }}
          />
        </div>
        <div className="max-w-7xl mx-auto px-3 py-1.5 md:px-6 md:py-2.5">
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[10px] font-semibold flex items-center gap-1.5 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
              <Music className="w-3 h-3" />
              Now Playing
              <span className="font-normal tabular-nums">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </span>
            <span className={`text-[10px] flex items-center gap-1 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-heartbeat" />
              Now listening
            </span>
          </div>
          <div className="flex items-center gap-3"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="overflow-hidden flex-1">
              <div className="flex items-center gap-3"
                style={{
                  transform: `translateX(${swipeState.offsetX}px)`,
                  transition: swipeState.isSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                <div className={`w-10 h-10 overflow-hidden flex-shrink-0 rounded-full ${isPlaying ? 'animate-spin-slow' : 'animate-spin-slow-paused'}`}>
                  <Image 
                    src={playlist[currentTrackIndex].cover} 
                    alt={playlist[currentTrackIndex].title}
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                    {playlist[currentTrackIndex].title}
                  </p>
                  <p className={`text-xs truncate ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    {playlist[currentTrackIndex].artist}
                  </p>
                  {playlist[currentTrackIndex].tags && playlist[currentTrackIndex].tags.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-1 overflow-hidden">
                      {playlist[currentTrackIndex].tags.slice(0, 3).map((tag, i) => (
                        <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded-md whitespace-nowrap ${
                          isDark ? 'bg-white/10 text-zinc-300' : 'bg-zinc-100 text-zinc-600'
                        }`}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={prevTrack} className={`p-2 rounded-xl transition-all ${isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-zinc-900'}`}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
              </button>
              <button onClick={togglePlay} className="p-2.5 rounded-xl bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-lg hover:scale-105 transition-all">
                {isPlaying ? (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                )}
              </button>
              <button onClick={nextTrack} className={`p-2 rounded-xl transition-all ${isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-zinc-900'}`}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zm2.5-6l-1 .7V11.3l1 .7zm7.5 6h2V6h-2v12z"/></svg>
              </button>
              <button className="p-2 rounded-xl text-rose-500">
                <svg className="w-4 h-4 fill-current animate-heartbeat" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
