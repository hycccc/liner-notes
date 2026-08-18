'use client';

import { Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

interface GlobalLoaderProps {
  isDark: boolean;
  show: boolean;
  message?: string;
}

export function GlobalLoader({ isDark, show, message = "Loading..." }: GlobalLoaderProps) {
  // Delay unmounting so the fade-out animation can finish
  const [shouldRender, setShouldRender] = useState(show);

  useEffect(() => {
    if (show) setShouldRender(true);
    else {
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [show]);

  if (!shouldRender) return null;

  return (
    <div 
      className={`fixed inset-0 z-[100] flex items-center justify-center pointer-events-none ${
        show ? 'opacity-100' : 'opacity-0 transition-opacity duration-300 ease-in-out'
      } ${isDark ? 'bg-zinc-950' : 'bg-zinc-50'}`}
    >
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <Sparkles className={`w-12 h-12 md:w-16 md:h-16 animate-pulse ${
            isDark ? 'text-amber-400' : 'text-amber-500'
          }`} />
          <div className="absolute inset-0 animate-ping opacity-30 scale-150">
            <Sparkles className={`w-12 h-12 md:w-16 md:h-16 ${
              isDark ? 'text-amber-400' : 'text-amber-500'
            }`} />
          </div>
        </div>
        <div className={`text-xl md:text-2xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent tracking-widest animate-pulse`}>
          {message}
        </div>
      </div>
    </div>
  );
}
