'use client';

import { createContext, useContext, useState, useRef, useEffect, useCallback, ReactNode } from 'react';
import { playlist } from '@/data';

interface MediaSessionDelegate {
  play: () => void;
  pause: () => void;
  seekto?: (details: MediaSessionActionDetails) => void;
}

interface MusicContextType {
  isPlaying: boolean;
  currentTrackIndex: number;
  progress: number;
  currentTime: number;
  duration: number;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  seekTo: (fraction: number) => void;
  setMediaSessionDelegate: (delegate: MediaSessionDelegate | null) => void;
}

const MusicContext = createContext<MusicContextType | null>(null);

export function MusicProvider({ children }: { children: ReactNode }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Main audio sync logic
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const expectedSrc = `/music/${encodeURIComponent(playlist[currentTrackIndex].file)}`;
    if (audio.src !== window.location.origin + expectedSrc) {
      audio.src = expectedSrc;
    }

    if (isPlaying) {
      audio.play().catch(() => setIsPlaying(false));
    } else {
      audio.pause();
    }
  }, [isPlaying, currentTrackIndex]);

  // Time update
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };
    const onLoaded = () => setDuration(audio.duration);
    const onEnded = () => {
      setCurrentTrackIndex((prev) => (prev + 1) % playlist.length);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  // 互斥：收到 demo-play 时暂停主播放器
  useEffect(() => {
    const handler = () => setIsPlaying(false);
    window.addEventListener('demo-play', handler);
    return () => window.removeEventListener('demo-play', handler);
  }, []);

  const togglePlay = useCallback(() => {
    setIsPlaying(p => {
      if (!p) {
        window.dispatchEvent(new Event('main-play'));
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
      } else {
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
      }
      return !p;
    });
  }, []);
  const play = useCallback(() => {
    window.dispatchEvent(new Event('main-play'));
    setIsPlaying(true);
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
  }, []);
  const pause = useCallback(() => {
    setIsPlaying(false);
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
  }, []);
  const nextTrack = useCallback(() => setCurrentTrackIndex(i => (i + 1) % playlist.length), []);
  const prevTrack = useCallback(() => setCurrentTrackIndex(i => (i - 1 + playlist.length) % playlist.length), []);

  // Demo 播放器可通过此 ref 接管 MediaSession play/pause 路由
  const mediaSessionDelegateRef = useRef<MediaSessionDelegate | null>(null);
  // 用 ref 追踪 currentTrackIndex，避免 setMediaSessionDelegate 闭包过时
  const currentTrackIndexRef = useRef(currentTrackIndex);
  useEffect(() => { currentTrackIndexRef.current = currentTrackIndex; }, [currentTrackIndex]);

  const setMediaSessionDelegate = useCallback((delegate: MediaSessionDelegate | null) => {
    mediaSessionDelegateRef.current = delegate;
    // 清空 delegate（demo 停止）时，立即把主播放器 metadata 和进度还给 iOS
    if (!delegate && 'mediaSession' in navigator) {
      const track = playlist[currentTrackIndexRef.current];
      const audio = audioRef.current;
      navigator.mediaSession.playbackState = 'paused'; // 主播放器在 demo 期间是暂停的
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: '最近在听',
        artwork: [
          { src: `${typeof window !== 'undefined' ? window.location.origin : ''}${track.cover}`, sizes: '256x256', type: 'image/jpeg' },
        ],
      });
      if (audio && isFinite(audio.duration) && audio.duration > 0) {
        try {
          navigator.mediaSession.setPositionState({
            duration: audio.duration,
            playbackRate: audio.playbackRate,
            position: audio.currentTime,
          });
        } catch (_) {}
      }
    }
  }, []); // 无 deps，通过 ref 读取最新值

  const seekTo = useCallback((fraction: number) => {
    const audio = audioRef.current;
    if (audio && audio.duration) {
      audio.currentTime = fraction * audio.duration;
      setCurrentTime(audio.currentTime);
      setProgress(fraction * 100);
      try {
        if ('mediaSession' in navigator) {
          navigator.mediaSession.setPositionState({
            duration: audio.duration,
            playbackRate: audio.playbackRate,
            position: audio.currentTime,
          });
        }
      } catch (_) {}
    }
  }, []);

  // MediaSession action handlers — 只注册一次，通过 delegate ref 路由
  // demo 播放时更新 ref，iOS 无论调哪个 handler 都会路由到正确的播放器
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.setActionHandler('play', () => {
      if (mediaSessionDelegateRef.current?.play) {
        mediaSessionDelegateRef.current.play();
      } else {
        play();
      }
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      if (mediaSessionDelegateRef.current?.pause) {
        mediaSessionDelegateRef.current.pause();
      } else {
        pause();
      }
    });
    navigator.mediaSession.setActionHandler('nexttrack',     () => nextTrack());
    navigator.mediaSession.setActionHandler('previoustrack', () => prevTrack());
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (mediaSessionDelegateRef.current?.seekto) {
        mediaSessionDelegateRef.current.seekto(details);
        return;
      }
      const audio = audioRef.current;
      if (!audio || !audio.duration) return;
      if (details.fastSeek && !('fastSeek' in audio)) return;
      seekTo((details.seekTime || 0) / audio.duration);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 仅 mount 时执行一次

  // MediaSession：更新锁屏/控制中心 metadata（仅主播放器激活时）
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    if (!isPlaying) return;

    const track = playlist[currentTrackIndex];
    const origin = window.location.origin;
    const coverUrl = `${origin}${track.cover}`;

    // cancelled 防止切歌时旧曲的 img.onload 后到，覆盖新曲 metadata
    let cancelled = false;

    const setMeta = (artworkSrc?: string) => {
      if (cancelled) return;
      // iOS 需要先清空再重设，否则有概率空白
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: '最近在听',
        ...(artworkSrc && {
          artwork: [{ src: artworkSrc, sizes: '300x300', type: 'image/jpeg' }],
        }),
      });
    };

    const img = new window.Image();
    img.onload = () => {
      if (cancelled) return;
      // 转成 data URL：iOS 媒体服务直接读内嵌数据，无需额外 fetch，首次也能秒显
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 300;
        canvas.getContext('2d')!.drawImage(img, 0, 0, 300, 300);
        setMeta(canvas.toDataURL('image/jpeg', 0.85));
      } catch {
        setMeta(coverUrl); // canvas 失败时降级用 URL
      }
    };
    img.onerror = () => setMeta();
    img.src = coverUrl;

    return () => { cancelled = true; };
  }, [currentTrackIndex, isPlaying]);

  return (
    <MusicContext.Provider value={{
      isPlaying, currentTrackIndex, progress, currentTime, duration,
      audioRef, play, pause, togglePlay, nextTrack, prevTrack, seekTo,
      setMediaSessionDelegate,
    }}>
      <audio ref={audioRef} preload="auto" />
      {/* 预取下一首和下下首 */}
      <link rel="prefetch" href={`/music/${encodeURIComponent(playlist[(currentTrackIndex + 1) % playlist.length].file)}`} />
      <link rel="prefetch" href={`/music/${encodeURIComponent(playlist[(currentTrackIndex + 2) % playlist.length].file)}`} />
      {children}
    </MusicContext.Provider>
  );
}

export function useMusic() {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error('useMusic must be used within MusicProvider');
  return ctx;
}
