'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(({ children, className = '', delay = 0 }, ref) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [isVisible, setIsVisible] = useState(false);
  const internalCardRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const shineRef = useRef<HTMLDivElement>(null);

  // Merge the internal ref with the forwarded ref
  const cardRef = (node: HTMLDivElement | null) => {
    internalCardRef.current = node;
    if (typeof ref === 'function') {
      ref(node);
    } else if (ref != null) {
      ref.current = node;
    }
  };

  useEffect(() => {
    const el = internalCardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setIsVisible(true), delay);
          observer.unobserve(el);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);

  // Mouse glow - desktop only, using refs for performance
  useEffect(() => {
    const el = internalCardRef.current;
    if (!el || 'ontouchstart' in window) return;

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (glowRef.current) {
        glowRef.current.style.opacity = '1';
        glowRef.current.style.background = `radial-gradient(350px circle at ${x}px ${y}px, ${
          isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'
        }, transparent 45%)`;
      }
      if (shineRef.current) {
        shineRef.current.style.opacity = '1';
        shineRef.current.style.background = `radial-gradient(100px circle at ${x}px ${y}px, ${
          isDark ? 'rgba(200,220,255,0.07)' : 'rgba(255,255,255,0.5)'
        }, transparent 60%)`;
      }
    };

    const onLeave = () => {
      if (glowRef.current) glowRef.current.style.opacity = '0';
      if (shineRef.current) shineRef.current.style.opacity = '0';
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
      ref={cardRef}
      className={`p-6 md:p-7 rounded-2xl md:rounded-3xl border transition-all duration-700 ease-out relative overflow-hidden ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      } hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/5 ${
        isDark 
          ? 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700/50' 
          : 'bg-white/80 border-zinc-200/60 hover:border-zinc-300/60'
      } backdrop-blur-xl ${className}`}
    >
      {/* Soft ambient glow */}
      <div
        ref={glowRef}
        className="pointer-events-none absolute inset-0 rounded-2xl md:rounded-3xl"
        style={{ opacity: 0, transition: 'opacity 0.3s ease-out' }}
      />
      {/* Focused shine */}
      <div
        ref={shineRef}
        className="pointer-events-none absolute inset-0 rounded-2xl md:rounded-3xl"
        style={{ opacity: 0, transition: 'opacity 0.2s ease-out', filter: 'blur(1px)' }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
});
