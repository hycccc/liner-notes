'use client';

import { useRouter } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';
import { ArrowLeft, Home } from 'lucide-react';
import { AnimatedGradient } from '@/components/layout/AnimatedGradient';

export default function NotFound() {
  const router = useRouter();
  const { theme, mounted } = useTheme();

  if (!mounted) return null;
  const isDark = theme === 'dark';

  return (
    <div className={`min-h-screen relative flex items-center justify-center ${isDark ? 'bg-zinc-950' : 'bg-zinc-50'}`}>
      <AnimatedGradient isDark={isDark} />
      
      <div className="relative z-10 text-center px-6">
        <div className="text-8xl mb-6">🌊</div>
        <h1 className={`text-7xl font-bold tracking-tighter mb-2 ${isDark ? 'text-white' : 'text-zinc-900'}`}>
          404
        </h1>
        <p className={`text-lg mb-8 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
          This page drifted off somewhere else
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => router.back()}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-medium transition-all duration-300 hover:scale-105 border ${
              isDark 
                ? 'border-zinc-800 text-zinc-300 hover:bg-zinc-800/50' 
                : 'border-zinc-200 text-zinc-600 hover:bg-white/70'
            }`}
          >
            <ArrowLeft className="w-4 h-4" /> Go back
          </button>
          <button
            onClick={() => router.push('/')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-medium transition-all duration-300 hover:scale-105 ${
              isDark 
                ? 'bg-white text-zinc-900 hover:bg-zinc-200' 
                : 'bg-zinc-900 text-white hover:bg-zinc-800'
            }`}
          >
            <Home className="w-4 h-4" /> Home
          </button>
        </div>
      </div>
    </div>
  );
}
