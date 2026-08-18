'use client';

import { useState, useEffect, useLayoutEffect, useRef, useCallback, type ButtonHTMLAttributes, type MouseEvent as ReactMouseEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Mail, 
  MapPin, 
  User, 
  Moon, 
  Sun, 
  Code,
  ChevronRight,
  BookOpen,
  Sparkles,
  Globe,
  Star,
  Zap,
  Music,
  Briefcase,
  Disc3,
  Github,
  Rss
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useTheme } from '@/contexts/ThemeContext';
import Link from 'next/link';
import Image from 'next/image';

import { AnimatedGradient } from '@/components/layout/AnimatedGradient';
import site from '@/content/site.json';
import { AlbumTab } from '@/components/AlbumTab';
import { Card } from '@/components/layout/Card';
// BottomMusicPlayer is now in root layout
import { BlogList } from '@/components/BlogList';
import { GlobalLoader } from '@/components/layout/GlobalLoader';
import EasterEgg from '@/components/EasterEgg';
import GameMode from '@/components/GameMode';
import { playlist, blogPosts as staticBlogPosts, techStack, instrumentStack, projects } from '@/data';
import type { AlbumData } from '@/types/album';

const SimpleTravelMap = dynamic(() => import('@/components/SimpleTravelMap'), { ssr: false });

// Map JSON project icon names to Lucide components
const PROJECT_ICON_MAP: Record<string, React.ReactNode> = {
  Globe:   <Globe   className="w-5 h-5" />,
  Code:    <Code    className="w-5 h-5" />,
  Music:   <Music   className="w-5 h-5" />,
  Star:    <Star    className="w-5 h-5" />,
  Zap:     <Zap     className="w-5 h-5" />,
  Mail:    <Mail    className="w-5 h-5" />,
  Sparkles: <Sparkles className="w-5 h-5" />,
  Briefcase: <Briefcase className="w-5 h-5" />,
};

// Liquid Glass Nav Bar - desktop only hover effect
function NavGlass({ children, isDark }: { children: React.ReactNode; isDark: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const causticRef = useRef<HTMLDivElement>(null);
  const edgeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || 'ontouchstart' in window) return;

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const angle = Math.atan2(y - 20, x - 150) * (180 / Math.PI);

      if (glowRef.current) {
        glowRef.current.style.opacity = '1';
        glowRef.current.style.background = `radial-gradient(180px circle at ${x}px ${y}px, ${isDark ? 'rgba(200,220,255,0.15)' : 'rgba(255,255,255,0.7)'}, transparent 50%)`;
      }
      if (causticRef.current) {
        causticRef.current.style.opacity = '1';
        causticRef.current.style.background = `
          radial-gradient(50px circle at ${x}px ${y}px, ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.85)'}, transparent 70%),
          radial-gradient(70px circle at ${x + 12}px ${y - 8}px, rgba(120,200,255,${isDark ? 0.1 : 0.12}), transparent 60%),
          radial-gradient(70px circle at ${x - 12}px ${y + 8}px, rgba(255,150,200,${isDark ? 0.08 : 0.1}), transparent 60%)
        `;
      }
      if (edgeRef.current) {
        edgeRef.current.style.opacity = '1';
        edgeRef.current.style.background = `linear-gradient(${angle}deg, rgba(120,180,255,${isDark ? 0.12 : 0.1}) 0%, rgba(200,120,255,${isDark ? 0.08 : 0.06}) 25%, transparent 50%, rgba(255,180,120,${isDark ? 0.08 : 0.06}) 75%, rgba(120,255,200,${isDark ? 0.12 : 0.1}) 100%)`;
      }
    };

    const onLeave = () => {
      [glowRef, causticRef, edgeRef].forEach(r => {
        if (r.current) r.current.style.opacity = '0';
      });
    };

    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, [isDark]);

  return (
    <div
      ref={ref}
      className="hidden md:flex items-center gap-1 p-1.5 rounded-2xl relative overflow-hidden"
    >
      <div className={`absolute inset-0 rounded-2xl backdrop-blur-2xl ${isDark ? 'bg-zinc-800/30' : 'bg-white/20'}`} />
      <div className={`absolute inset-0 rounded-2xl border ${isDark ? 'border-white/[0.1]' : 'border-white/50'}`} />
      <div ref={edgeRef} className="absolute inset-0 rounded-2xl" style={{ opacity: 0, transition: 'opacity 0.3s' }} />
      <div ref={glowRef} className="absolute inset-0 rounded-2xl pointer-events-none" style={{ opacity: 0, transition: 'opacity 0.2s' }} />
      <div ref={causticRef} className="absolute inset-0 rounded-2xl pointer-events-none" style={{ opacity: 0, transition: 'opacity 0.15s' }} />
      <div className={`absolute inset-x-4 top-0 h-px ${isDark ? 'bg-gradient-to-r from-transparent via-white/20 to-transparent' : 'bg-gradient-to-r from-transparent via-white/70 to-transparent'}`} />
      <div className="relative z-10 flex items-center gap-1">{children}</div>
    </div>
  );
}

interface TimelineItem {
  period: string;
  title: string;
  subtitle: string;
  type: 'work' | 'edu';
}

interface HomeData {
  tagline?: string;
  about?: string;
  timeline?: TimelineItem[];
}

interface ProjectItem {
  title: string;
  description: string;
  status: string;
  tags: string[];
  url?: string;
  icon?: string;
}

interface HomeClientProps {
  posts: any[];
  homeData?: HomeData;
  projectsData?: ProjectItem[];
  albumData: AlbumData;
}

export default function HomeClient({ posts, homeData, projectsData, albumData }: HomeClientProps) {
  const [avatarFile, setAvatarFile] = useState<string | null>(null);
  const { theme, toggleTheme, mounted } = useTheme();
  const [isPageLoaded, setIsPageLoaded] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [themeHoldHint, setThemeHoldHint] = useState(false);
  const [easterEggActive, setEasterEggActive] = useState(false);
  const [gameModeHoldHint, setGameModeHoldHint] = useState(false);
  const [gameModeActive, setGameModeActive] = useState(false);
  const blogTouchMoved = useRef(false);
  const blogTouchStartPos = useRef<{x: number; y: number} | null>(null);
  const themeHoldHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const themeHoldActivateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoldingThemeToggleRef = useRef(false);
  const suppressNextThemeClickRef = useRef(false);
  const gameModeHoldHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameModeHoldActivateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoldingAboutButtonRef = useRef(false);
  const suppressNextAboutClickRef = useRef(false);
  const router = useRouter();

  // Tap the version number five times to open the admin panel
  const versionClicks = useRef(0);
  const versionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleVersionClick = () => {
    versionClicks.current += 1;
    if (versionTimer.current) clearTimeout(versionTimer.current);
    if (versionClicks.current >= 5) {
      versionClicks.current = 0;
      router.push('/admin');
    } else {
      versionTimer.current = setTimeout(() => { versionClicks.current = 0; }, 500);
    }
  };
  const searchParams = useSearchParams();

  const initialTab = (searchParams?.get('tab') as any) || 'home';
  const [activeTab, setActiveTab] = useState<'home' | 'projects' | 'blog' | 'about' | 'album'>(
    ['home', 'projects', 'blog', 'about', 'album'].includes(initialTab) ? initialTab : 'home'
  );
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    // Clear the navigation overlay
    document.documentElement.classList.remove('page-navigating');
    setIsPageLoaded(true);
  }, []);

  // Restore the home scroll position when returning from a post
  useEffect(() => {
    const savedY = sessionStorage.getItem('homeScrollY');
    if (savedY) {
      sessionStorage.removeItem('homeScrollY');
      const y = parseInt(savedY);
      setTimeout(() => window.scrollTo({ top: y, behavior: 'instant' }), 50);
    }
  }, []);

  // Nav scroll effect
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const tab = searchParams?.get('tab');
    if (tab && ['home', 'projects', 'blog', 'about', 'album'].includes(tab)) {
      setActiveTab(tab as any);
    }
  }, [searchParams]);

  const clearThemeHoldTimers = useCallback(() => {
    if (themeHoldHintTimerRef.current) {
      clearTimeout(themeHoldHintTimerRef.current);
      themeHoldHintTimerRef.current = null;
    }
    if (themeHoldActivateTimerRef.current) {
      clearTimeout(themeHoldActivateTimerRef.current);
      themeHoldActivateTimerRef.current = null;
    }
  }, []);

  const stopThemeHold = useCallback(() => {
    isHoldingThemeToggleRef.current = false;
    setThemeHoldHint(false);
    clearThemeHoldTimers();
  }, [clearThemeHoldTimers]);

  const startThemeHold = useCallback(() => {
    if (easterEggActive || isHoldingThemeToggleRef.current) return;
    isHoldingThemeToggleRef.current = true;
    clearThemeHoldTimers();

    themeHoldHintTimerRef.current = setTimeout(() => {
      setThemeHoldHint(true);
    }, 500);

    themeHoldActivateTimerRef.current = setTimeout(() => {
      suppressNextThemeClickRef.current = true;
      isHoldingThemeToggleRef.current = false;
      setThemeHoldHint(false);
      clearThemeHoldTimers();
      setEasterEggActive(true);
    }, 3000);
  }, [clearThemeHoldTimers, easterEggActive]);

  const handleThemeButtonClick = useCallback(() => {
    if (suppressNextThemeClickRef.current) {
      suppressNextThemeClickRef.current = false;
      return;
    }
    toggleTheme();
  }, [toggleTheme]);

  const clearGameModeHoldTimers = useCallback(() => {
    if (gameModeHoldHintTimerRef.current) {
      clearTimeout(gameModeHoldHintTimerRef.current);
      gameModeHoldHintTimerRef.current = null;
    }
    if (gameModeHoldActivateTimerRef.current) {
      clearTimeout(gameModeHoldActivateTimerRef.current);
      gameModeHoldActivateTimerRef.current = null;
    }
  }, []);

  const stopGameModeHold = useCallback(() => {
    isHoldingAboutButtonRef.current = false;
    setGameModeHoldHint(false);
    clearGameModeHoldTimers();
  }, [clearGameModeHoldTimers]);

  const startGameModeHold = useCallback(() => {
    if (gameModeActive || isHoldingAboutButtonRef.current) return;
    isHoldingAboutButtonRef.current = true;
    clearGameModeHoldTimers();

    gameModeHoldHintTimerRef.current = setTimeout(() => {
      setGameModeHoldHint(true);
    }, 500);

    gameModeHoldActivateTimerRef.current = setTimeout(() => {
      suppressNextAboutClickRef.current = true;
      isHoldingAboutButtonRef.current = false;
      setGameModeHoldHint(false);
      clearGameModeHoldTimers();
      setGameModeActive(true);
    }, 3000);
  }, [clearGameModeHoldTimers, gameModeActive]);

  const handleAboutHoldMouseDown = useCallback((event: ReactMouseEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    startGameModeHold();
  }, [startGameModeHold]);

  useEffect(() => {
    return () => {
      clearThemeHoldTimers();
      clearGameModeHoldTimers();
    };
  }, [clearThemeHoldTimers, clearGameModeHoldTimers]);

  useEffect(() => {
    if (!gameModeActive) return;
    stopGameModeHold();
  }, [gameModeActive, stopGameModeHold]);

  // After a tab switch, reset scroll synchronously before paint (useLayoutEffect prevents a flash of the inherited scroll position)
  useLayoutEffect(() => {
    try { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); } catch { window.scrollTo(0, 0); }
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
  }, [activeTab]);

  const navigateToBlog = (slug: string, from: string) => {
    if (navigating) return;
    // Add the CSS class synchronously, without waiting for a React re-render, to cover the amber gradient background
    document.documentElement.classList.add('page-navigating');
    setNavigating(true);
    sessionStorage.setItem('homeScrollY', String(window.scrollY));
    setTimeout(() => {
      router.push(`/blog/${slug}?from=${from}`);
    }, 600);
  };

  const handleTabChange = (tab: 'home' | 'projects' | 'blog' | 'about' | 'album') => {
    stopGameModeHold();
    setActiveTab(tab);
    setScrolled(false);
    router.replace(`/?tab=${tab}`, { scroll: false });
    // iOS needs multiple resets: immediately, next frame, and after 50ms, to cover all render timings
    const resetScroll = () => {
      try { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); } catch { window.scrollTo(0, 0); }
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = 0;
    };
    resetScroll();
    requestAnimationFrame(resetScroll);
    setTimeout(resetScroll, 50);
  };

  if (!mounted) return null;

  const isDark = theme === 'dark';
  const aboutButtonHoldHandlers: ButtonHTMLAttributes<HTMLButtonElement> = {
    onMouseDown: handleAboutHoldMouseDown,
    onMouseUp: stopGameModeHold,
    onMouseLeave: stopGameModeHold,
    onTouchStart: startGameModeHold,
    onTouchEnd: stopGameModeHold,
    onTouchCancel: stopGameModeHold,
    onContextMenu: (event) => event.preventDefault(),
  };
  
  // Use passed posts, fallback to static data if needed (though SSR should provide it)
  const displayPosts = posts && posts.length > 0 ? posts : staticBlogPosts;

  return (
    <div className={`min-h-screen relative overflow-x-hidden ${
      isDark ? 'bg-zinc-950' : 'bg-zinc-50'
    }`}>
      <AnimatedGradient isDark={isDark} />

      <GlobalLoader show={!isPageLoaded || navigating} isDark={isDark} />

      <nav className={`max-w-7xl mx-auto px-4 md:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-40 backdrop-blur-xl transition-all duration-500 ${
        isPageLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      } ${scrolled 
        ? `py-3 ${isDark ? 'border-b border-zinc-800/60 bg-zinc-950/80' : 'border-b border-zinc-200/60 bg-zinc-50/80'}` 
        : 'py-6'
      }`}>
        <div className="flex items-center gap-2">
          <span
            onClick={handleVersionClick}
            className={`px-3 py-1 text-xs font-medium rounded-full cursor-default select-none ${
              isDark
                ? 'bg-zinc-800 text-zinc-300'
                : 'bg-zinc-200 text-zinc-700'
            }`}
          >
            V4
          </span>
        </div>

        <NavGlass isDark={isDark}>
          {[
            { id: 'home', label: 'Home', icon: <Globe className="w-4 h-4" /> },
            { id: 'projects', label: 'Projects', icon: <Code className="w-4 h-4" /> },
            { id: 'blog', label: 'Blog', icon: <BookOpen className="w-4 h-4" /> },
            { id: 'album', label: 'Album', icon: <Disc3 className="w-4 h-4" /> },
            { id: 'about', label: 'About', icon: <User className="w-4 h-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === 'about' && suppressNextAboutClickRef.current) {
                  suppressNextAboutClickRef.current = false;
                  return;
                }
                handleTabChange(tab.id as any);
              }}
              {...(tab.id === 'about' ? aboutButtonHoldHandlers : {})}
              className={`relative z-10 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2.5 ${
                activeTab === tab.id
                  ? isDark
                    ? 'bg-white/10 text-white shadow-lg shadow-white/5'
                    : 'bg-white/70 text-zinc-900 shadow-lg shadow-black/5'
                  : isDark
                    ? 'text-zinc-400 hover:text-zinc-200'
                    : 'text-zinc-600 hover:text-zinc-900'
              } ${tab.id === 'about' && gameModeHoldHint ? 'game-mode-hold-hint' : ''}`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </NavGlass>

        <div className="flex items-center gap-3">
          <button
            onClick={handleThemeButtonClick}
            onMouseDown={(event) => {
              if (event.button !== 0) return;
              startThemeHold();
            }}
            onMouseUp={stopThemeHold}
            onMouseLeave={stopThemeHold}
            onTouchStart={(e) => { e.preventDefault(); startThemeHold(); }}
            onTouchEnd={stopThemeHold}
            onTouchCancel={stopThemeHold}
            onContextMenu={(event) => event.preventDefault()}
            className={`p-3 rounded-2xl transition-all duration-500 hover:scale-110 ${
              isDark 
                ? 'text-zinc-400 hover:text-white hover:bg-zinc-800/50' 
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-white/70'
            } select-none touch-none ${themeHoldHint ? 'theme-toggle-hold-hint' : ''}`}
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      <nav className="md:hidden fixed left-1/2 -translate-x-1/2 z-40 max-w-[95vw]" style={{ bottom: 'calc(6.5rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className={`flex flex-row flex-nowrap items-center gap-1.5 backdrop-blur-xl p-1.5 rounded-3xl border shadow-xl whitespace-nowrap overflow-x-auto no-scrollbar ${
          isDark 
            ? 'bg-zinc-800/80 border-zinc-700/50' 
            : 'bg-white/90 border-zinc-200/60'
        }`}>
          {[
            { id: 'home', label: 'Home', icon: <Globe className="w-4 h-4" /> },
            { id: 'projects', label: 'Projects', icon: <Code className="w-4 h-4" /> },
            { id: 'blog', label: 'Blog', icon: <BookOpen className="w-4 h-4" /> },
            { id: 'album', label: 'Album', icon: <Disc3 className="w-4 h-4" /> },
            { id: 'about', label: 'About', icon: <User className="w-4 h-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === 'about' && suppressNextAboutClickRef.current) {
                  suppressNextAboutClickRef.current = false;
                  return;
                }
                handleTabChange(tab.id as any);
              }}
              {...(tab.id === 'about' ? aboutButtonHoldHandlers : {})}
              className={`px-3 py-2 rounded-2xl transition-all duration-300 flex flex-col items-center gap-0.5 ${
                activeTab === tab.id
                  ? isDark
                    ? 'bg-zinc-900 text-white shadow-lg'
                    : 'bg-zinc-100 text-zinc-900 shadow-lg'
                  : isDark
                    ? 'text-zinc-400 hover:text-zinc-200'
                    : 'text-zinc-600 hover:text-zinc-900'
              } ${tab.id === 'about' && gameModeHoldHint ? 'game-mode-hold-hint' : ''}`}
            >
              {tab.icon}
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 md:pb-28">
        <div key={activeTab} className="animate-fade-in">
        {activeTab === 'home' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 md:gap-5">
            <div className="lg:col-span-4 space-y-4 md:space-y-5">
              <Card delay={100}>
                <div className="flex flex-col items-center text-center">
                  <div className="mb-5">
                    <div className="relative group">
                      <div className={`absolute -inset-1 rounded-2xl md:rounded-3xl blur-lg opacity-0 group-hover:opacity-60 transition-opacity duration-700 ${
                        isDark ? 'bg-gradient-to-br from-purple-500 to-pink-500' : 'bg-gradient-to-br from-red-400 to-amber-400'
                      }`} />
                      <div className={`relative w-28 h-28 md:w-32 md:h-32 rounded-2xl md:rounded-3xl overflow-hidden transition-all duration-500 group-hover:scale-105 shadow-2xl ring-2 ${
                        isDark ? 'ring-zinc-800' : 'ring-zinc-200'
                      }`}>
                        <Image src={site.avatar} alt={site.name} width={256} height={256} quality={90} className="w-full h-full object-cover" priority />
                      </div>
                    </div>
                  </div>

                  <h1 className={`text-xl md:text-2xl font-bold mb-1.5 ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                    {site.name}
                  </h1>
                  <p className={`text-base md:text-lg mb-1.5 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    {site.subtitle}
                  </p>
                  
                  <div className="flex items-center gap-2 flex-wrap justify-center">
                    {site.badges.map((badge, idx) => (
                      <span key={badge} className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                        idx === 0
                          ? isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-700'
                          : isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {badge}
                      </span>
                    ))}
                  </div>
                </div>
              </Card>

              <Card delay={200}>
                <div className="flex items-center gap-4">
                  <div className={`p-3.5 rounded-2xl ${
                    isDark ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
                    <MapPin className="w-5 h-5 md:w-6 md:h-6 text-blue-500" />
                  </div>
                  <div>
                    <p className={`font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                      {site.location}
                    </p>
                    <p className={`text-sm ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                      {site.timezone}
                    </p>
                  </div>
                </div>
              </Card>

              <Card delay={400}>
                <h3 className={`text-xs md:text-sm font-semibold mb-4 flex items-center gap-2 ${
                  isDark ? 'text-white' : 'text-zinc-900'
                }`}>
                  <Zap className="w-4 h-4.5 text-amber-400" />
                  Tech Stack
                </h3>
                <div className="grid grid-cols-3 gap-2.5">
                  {techStack.map((tech, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-2xl text-center transition-all duration-500 hover:scale-110 cursor-pointer ${
                        isDark ? 'bg-zinc-800/50 hover:bg-zinc-800' : 'bg-zinc-100 hover:bg-zinc-200'
                      }`}
                      style={{ transitionDelay: `${idx * 30}ms` }}
                    >
                      <div className="text-xl md:text-2xl mb-1">{tech.icon}</div>
                      <div className={`text-xs font-semibold ${
                        isDark ? 'text-zinc-300' : 'text-zinc-700'
                      }`}>
                        {tech.name}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card delay={500}>
                <h3 className={`text-xs md:text-sm font-semibold mb-4 flex items-center gap-2 ${
                  isDark ? 'text-white' : 'text-zinc-900'
                }`}>
                  <Music className="w-4 h-4.5 text-pink-500" />
                  Music Gear
                </h3>
                <div className="grid grid-cols-3 gap-2.5">
                  {instrumentStack.map((tech, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-2xl text-center transition-all duration-500 hover:scale-110 cursor-pointer ${
                        isDark ? 'bg-zinc-800/50 hover:bg-zinc-800' : 'bg-zinc-100 hover:bg-zinc-200'
                      }`}
                      style={{ transitionDelay: `${idx * 30}ms` }}
                    >
                      <div className="text-xl md:text-2xl mb-1">{tech.icon}</div>
                      <div className={`text-xs font-semibold ${
                        isDark ? 'text-zinc-300' : 'text-zinc-700'
                      }`}>
                        {tech.name}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <div className="lg:col-span-8 space-y-4 md:space-y-5">
              <Card delay={150} className="h-72 md:h-80">
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`text-xs md:text-sm font-semibold flex items-center gap-2 ${
                    isDark ? 'text-white' : 'text-zinc-900'
                  }`}>
                    <MapPin className="w-4 h-4.5" />
                    Travel Map
                  </h3>
                </div>
                <div className="rounded-2xl overflow-hidden h-52 md:h-56">
                  <SimpleTravelMap />
                </div>
              </Card>

              <Card delay={250}>
                <div className="flex items-center justify-between mb-5">
                  <h3 className={`text-xs md:text-sm font-semibold flex items-center gap-2 ${
                    isDark ? 'text-white' : 'text-zinc-900'
                  }`}>
                    <Code className="w-4 h-4.5" />
                    Featured Projects
                  </h3>
                  <Link href="#" onClick={(e) => { e.preventDefault(); handleTabChange('projects'); }} className={`text-xs font-medium flex items-center gap-1.5 ${
                    isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-600 hover:text-zinc-900'
                  }`}>
                    All projects <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                
                <div className="space-y-3.5">
                  {projects.slice(0, 3).map((project, idx) => (
                    <div
                      key={idx}
                      className={`p-4.5 rounded-2xl border transition-all duration-300 hover:scale-[1.02] cursor-pointer ${
                        isDark ? 'bg-zinc-800/50 border-zinc-700/50 hover:bg-zinc-800' : 'bg-zinc-100 border-zinc-200/50 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          {project.icon && (
                            <div className={`p-2.5 rounded-xl ${isDark ? 'bg-zinc-700/50 text-zinc-200' : 'bg-zinc-200 text-zinc-700'}`}>
                              {project.icon}
                            </div>
                          )}
                          <div>
                            <h4 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                              {project.title}
                            </h4>
                            {project.tags && (
                              <div className="flex items-center gap-2 mt-1">
                                {project.tags.slice(0, 2).map((tag, i) => (
                                  <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'bg-zinc-700 text-zinc-300' : 'bg-zinc-200 text-zinc-600'}`}>
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${project.statusColor}`}>
                            {project.status}
                          </span>
                          {project.stars > 0 && (
                            <div className={`flex items-center gap-1 mt-1 text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                              <Star className="w-3 h-3" />
                              {project.stars}
                            </div>
                          )}
                        </div>
                      </div>
                      <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                        {project.description}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card delay={350}>
                <div className="flex items-center justify-between mb-5">
                  <h3 className={`text-xs md:text-sm font-semibold flex items-center gap-2 ${
                    isDark ? 'text-white' : 'text-zinc-900'
                  }`}>
                    <BookOpen className="w-4 h-4.5" />
                    Latest Posts
                  </h3>
                  <Link href="#" onClick={(e) => { e.preventDefault(); handleTabChange('blog'); }} className={`text-xs font-medium flex items-center gap-1.5 ${
                    isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-600 hover:text-zinc-900'
                  }`}>
                    All posts <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                
                <div className="space-y-3.5">
                  {displayPosts.slice(0, 3).map((post: any, idx: number) => (
                    <div
                      key={post.slug || post.id}
                      onPointerDown={(e) => { blogTouchMoved.current = false; blogTouchStartPos.current = { x: e.clientX, y: e.clientY }; }}
                      onPointerMove={(e) => { if (blogTouchStartPos.current) { const dx = Math.abs(e.clientX - blogTouchStartPos.current.x); const dy = Math.abs(e.clientY - blogTouchStartPos.current.y); if (dx > 8 || dy > 8) blogTouchMoved.current = true; } }}
                      onPointerUp={() => {
                        blogTouchStartPos.current = null;
                        if (!blogTouchMoved.current && post.slug) {
                          navigateToBlog(post.slug, 'home');
                        }
                      }}
                      style={{ touchAction: 'pan-y' }}
                      className="block cursor-pointer select-none active:scale-[0.98] active:opacity-70 transition-transform duration-75">
                      <article 
                        className={`p-4.5 rounded-2xl transition-all duration-300 active:scale-[0.98] active:opacity-70 hover:scale-[1.02] border ${
                          isDark ? 'bg-zinc-800/50 hover:bg-zinc-800 border-zinc-700/50' : 'bg-zinc-100 hover:bg-white border-zinc-200/60'
                        }`}
                      >
                        <h4 className={`text-sm font-bold mb-1.5 ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                          {post.title}
                        </h4>
                        <p className={`text-xs mb-2.5 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                          {post.excerpt}
                        </p>
                        <div className="flex items-center justify-between">
                          {post.tags && (
                            <div className="flex items-center gap-2">
                              {post.tags.map((tag: string, i: number) => (
                                <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'bg-zinc-700 text-zinc-300' : 'bg-zinc-200 text-zinc-600'}`}>
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center gap-3 text-xs">
                            <span className={isDark ? 'text-zinc-500' : 'text-zinc-500'}>{post.date}</span>
                            {post.readTime && (
                              <span className={isDark ? 'text-zinc-600' : 'text-zinc-400'}>· {post.readTime}</span>
                            )}
                          </div>
                        </div>
                      </article>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'projects' && (
          <div className="max-w-2xl mx-auto space-y-4">
            {(projectsData ?? projects.map(p => ({ ...p, icon: 'Globe', statusColor: undefined }))).map((project, idx) => {
              const statusColor = project.status === 'LIVE'
                ? 'bg-teal-500/20 text-teal-400'
                : project.status === 'WIP'
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-zinc-700 text-zinc-400';
              // Prefer the Lucide component from the icon map, fall back to emoji
              const iconNode = PROJECT_ICON_MAP[project.icon] ?? <span className="text-xl">{project.icon}</span>;
              return (
              <Card key={idx} delay={100 + idx * 100}>
                <div className="flex items-start gap-4">
                  {project.icon && (
                    <div className={`p-3 rounded-2xl flex-shrink-0 ${isDark ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-200 text-zinc-700'}`}>
                      {iconNode}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>{project.title}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColor}`}>{project.status}</span>
                    </div>
                    <p className={`text-sm mb-3 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{project.description}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {project.tags.map((tag, i) => (
                        <span key={i} className={`text-[11px] px-2 py-0.5 rounded-lg ${isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-600'}`}>{tag}</span>
                      ))}
                      {project.url && (
                        <a href={project.url} target="_blank" rel="noopener noreferrer" className={`text-[11px] px-2 py-0.5 rounded-lg flex items-center gap-1 transition-colors ${isDark ? 'bg-zinc-800 text-zinc-300 hover:text-white' : 'bg-zinc-100 text-zinc-600 hover:text-zinc-900'}`}>
                          <Code className="w-3 h-3" /> Source
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
              );
            })}
          </div>
        )}

        {activeTab === 'blog' && (
          <BlogList isDark={isDark} posts={displayPosts} />
        )}

        {activeTab === 'album' && (
          <AlbumTab isDark={isDark} albumData={albumData} />
        )}

        {activeTab === 'about' && (
          <div className="max-w-lg mx-auto space-y-5">
            <Card delay={100}>
              <div className="text-center py-4">
                <h2 className={`text-2xl font-bold tracking-tight mb-1 ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                  {site.name}
                </h2>
                <p className={`text-sm ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                  {homeData?.tagline ?? site.tagline}
                </p>
              </div>
            </Card>

            {/* About Me */}
            <Card delay={150}>
              <h3 className={`text-xs md:text-sm font-semibold mb-3 flex items-center gap-2 ${
                isDark ? 'text-white' : 'text-zinc-900'
              }`}>
                <User className="w-4 h-4" />
                About me
              </h3>
              <p className={`text-sm leading-relaxed ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                {homeData?.about ?? 'Into music, travel, and games — rising slowly at my own pace.'}
              </p>
            </Card>

            {/* Timeline */}
            <Card delay={200}>
              <h3 className={`text-xs md:text-sm font-semibold mb-5 flex items-center gap-2 ${
                isDark ? 'text-white' : 'text-zinc-900'
              }`}>
                <Briefcase className="w-4 h-4" />
                Journey
              </h3>
              <div className="relative">
                {/* Timeline line */}
                <div className={`absolute left-[7px] top-2 bottom-2 w-px ${isDark ? 'bg-zinc-700' : 'bg-zinc-200'}`} />
                
                <div className="space-y-6">
                  {(homeData?.timeline ?? [
                    { period: '2024 - now', title: 'Nightjar Records', subtitle: 'Songwriter & producer', type: 'work' as const },
                    { period: '2020 - 2024', title: 'Seaside Conservatory', subtitle: 'Composition · B.A.', type: 'edu' as const },
                  ]).map((item, idx) => (
                    <div key={idx} className="flex items-start gap-4 relative">
                      <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 mt-0.5 z-10 ${
                        idx === 0
                          ? 'border-blue-500 bg-blue-500'
                          : isDark 
                            ? 'border-zinc-600 bg-zinc-800' 
                            : 'border-zinc-300 bg-white'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-[11px] font-medium mb-0.5 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                          {item.period}
                        </p>
                        <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                          {item.title}
                        </p>
                        <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                          {item.subtitle}
                        </p>
                        <span className={`inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          item.type === 'work'
                            ? isDark ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-50 text-blue-600'
                            : isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-50 text-amber-600'
                        }`}>
                          {item.type === 'work' ? 'Work' : 'Education'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Social Links */}
            <Card delay={300}>
              <div className="grid grid-cols-3 gap-3">
                {site.socials.map((s) => ({
                  ...s,
                  icon: s.name === 'GitHub' ? <Github className="w-5 h-5" />
                    : s.name === 'Email' ? <Mail className="w-5 h-5" />
                    : <Rss className="w-5 h-5" />,
                })).map((social, idx) => (
                  <a
                    key={idx}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex flex-col items-center gap-2 p-4 rounded-2xl transition-all duration-300 hover:scale-105 ${
                      isDark ? 'bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                    }`}
                  >
                    {social.icon}
                    <span className="text-xs font-medium">{social.name}</span>
                  </a>
                ))}
              </div>
            </Card>

            {/* Contact QR — set site.json contactQr to an image path to show this card */}
            {site.contactQr && (
              <Card delay={400}>
                <div className="flex flex-col items-center">
                  <p className={`text-xs font-medium mb-3 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Scan to connect</p>
                  <div className={`w-48 h-48 rounded-2xl overflow-hidden ${isDark ? 'bg-white p-2' : 'p-0'}`}>
                    <Image src={site.contactQr} alt="Contact QR" width={192} height={192} className="w-full h-full object-contain rounded-xl" />
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}
        </div>
        {/* Bottom spacing on mobile: floating nav + music player + iOS safe area */}
        <div className="md:hidden" style={{ height: 'calc(10.5rem + env(safe-area-inset-bottom, 0px))' }} aria-hidden="true" />
      </main>

      {/* footer removed */}

      {/* Fixed bottom music player */}
      <div className={`fixed bottom-0 left-0 right-0 z-50 md:bottom-0 ${
        isPageLoaded ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
      } transition-all duration-500`}>
        {/* Music player is in root layout */}
      </div>

      {easterEggActive && (
        <EasterEgg onClose={() => setEasterEggActive(false)} isDark={isDark} />
      )}
      {gameModeActive && (
        <GameMode onClose={() => setGameModeActive(false)} isDark={isDark} />
      )}
    </div>
  );
}
