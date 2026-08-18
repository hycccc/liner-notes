'use client';

import { useEffect, useState, useRef, memo, isValidElement, type ReactElement, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';
import { ArrowLeft, Moon, Sun, Check, Copy, List, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AnimatedGradient } from '@/components/layout/AnimatedGradient';
// BottomMusicPlayer is now in root layout
import { GlobalLoader } from '@/components/layout/GlobalLoader';
import PostActions from '@/components/PostActions';

// Memoized audio player
const AudioPlayer = memo(function AudioPlayer({ src, label, isDark }: { src: string; label: React.ReactNode; isDark: boolean }) {
  return (
    <div className={`my-6 p-4 rounded-2xl ${isDark ? 'bg-zinc-900/80 border border-zinc-800' : 'bg-zinc-100 border border-zinc-200'}`}>
      <audio controls className="w-full" preload="metadata" src={src} />
      {label && <p className={`text-xs mt-2 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{label}</p>}
    </div>
  );
});

interface MarkdownCodeElementProps {
  className?: string;
  children?: ReactNode;
}

function getMarkdownCodeElement(children: ReactNode): ReactElement<MarkdownCodeElementProps> | null {
  if (Array.isArray(children)) {
    if (children.length !== 1) return null;
    return getMarkdownCodeElement(children[0]);
  }

  if (!isValidElement(children)) return null;
  return children as ReactElement<MarkdownCodeElementProps>;
}

// Memoized markdown renderer
const MemoizedMarkdown = memo(function MemoizedMarkdown({ content, isDark }: { content: string; isDark: boolean }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        pre: ({ children, ...props }) => {
          const codeElement = getMarkdownCodeElement(children);
          const codeText = codeElement?.props?.children;
          if (codeText !== undefined) {
            return (
              <CodeBlock isDark={isDark} className={codeElement.props.className}>
                {String(codeText).replace(/\n$/, '')}
              </CodeBlock>
            );
          }
          return <pre {...props}>{children}</pre>;
        },
        img: ({ src, alt, ...props }) => (
          <figure className="my-8">
            <img src={src} alt={alt || ''} className="rounded-2xl w-full shadow-lg" loading="lazy" {...props} />
            {alt && <figcaption className={`text-center text-sm mt-3 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{alt}</figcaption>}
          </figure>
        ),
        a: ({ href, children, ...props }) => {
          const audioMatch = href && href.match(/\.(mp3|wav|ogg|m4a)$/i);
          if (audioMatch) {
            return <AudioPlayer src={href} label={children} isDark={isDark} />;
          }
          return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
});

interface PostData {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  tags: string[];
  readTime?: string;
  aiGenerated: boolean;
  content: string;
}

interface TocItem {
  id: string;
  text: string;
  level: number;
}

function extractToc(content: string): TocItem[] {
  const lines = content.split('\n');
  const toc: TocItem[] = [];
  for (const line of lines) {
    const match = line.match(/^(#{2,3})\s+(.+)/);
    if (match) {
      const text = match[2].replace(/\*\*/g, '').replace(/[`*_~]/g, '').trim();
      const id = text.toLowerCase().replace(/[^\w\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, '');
      toc.push({ id, text, level: match[1].length });
    }
  }
  return toc;
}

// TOC sidebar component
function TableOfContents({ toc, isDark, activeId }: { toc: TocItem[]; isDark: boolean; activeId: string }) {
  const [open, setOpen] = useState(false);

  if (toc.length === 0) return null;

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setOpen(!open)}
        className={`fixed bottom-24 right-4 z-50 xl:hidden p-3 rounded-2xl shadow-lg transition-all duration-300 ${
          isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-white text-zinc-600 hover:bg-zinc-100'
        } border ${isDark ? 'border-zinc-700' : 'border-zinc-200'}`}
      >
        {open ? <X className="w-5 h-5" /> : <List className="w-5 h-5" />}
      </button>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 xl:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <nav
            onClick={(e) => e.stopPropagation()}
            className={`absolute right-4 bottom-40 w-72 max-h-[60vh] overflow-y-auto p-4 rounded-2xl shadow-2xl border ${
              isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
            }`}
          >
            <p className={`text-xs font-semibold mb-3 uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Contents</p>
            <TocLinks toc={toc} isDark={isDark} activeId={activeId} onClick={() => setOpen(false)} />
          </nav>
        </div>
      )}

      {/* Desktop sidebar */}
      <nav className={`hidden xl:block fixed top-32 w-56 max-h-[calc(100vh-200px)] overflow-y-auto pr-4 ${
        isDark ? 'text-zinc-400' : 'text-zinc-500'
      }`} style={{ left: 'calc(50% + 400px)' }}>
        <p className={`text-xs font-semibold mb-3 uppercase tracking-wider ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>Contents</p>
        <TocLinks toc={toc} isDark={isDark} activeId={activeId} />
      </nav>
    </>
  );
}

function TocLinks({ toc, isDark, activeId, onClick }: { toc: TocItem[]; isDark: boolean; activeId: string; onClick?: () => void }) {
  return (
    <ul className="space-y-1">
      {toc.map((item) => (
        <li key={item.id} style={{ paddingLeft: item.level === 3 ? '12px' : '0' }}>
          <a
            href={`#${item.id}`}
            onClick={onClick}
            className={`block text-xs py-1.5 transition-all duration-200 border-l-2 pl-3 ${
              activeId === item.id
                ? `font-medium border-red-400 ${isDark ? 'text-white' : 'text-zinc-900'}`
                : `border-transparent hover:border-zinc-400 ${isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-600 hover:text-zinc-900'}`
            }`}
          >
            {item.text}
          </a>
        </li>
      ))}
    </ul>
  );
}

function CodeBlock({ children, className, isDark }: { children: string; className?: string; isDark: boolean }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <button
        onClick={handleCopy}
        className={`absolute right-3 top-3 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 z-10 ${
          isDark 
            ? 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300' 
            : 'bg-zinc-200 hover:bg-zinc-300 text-zinc-600'
        }`}
        title="Copy code"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
      <pre className={className}>
        <code>{children}</code>
      </pre>
    </div>
  );
}

// Markdown heading renderer that adds ids for TOC anchoring
const MemoizedMarkdownWithToc = memo(function MemoizedMarkdownWithToc({ content, isDark }: { content: string; isDark: boolean }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h2: ({ children }) => {
          const text = String(children).replace(/\*\*/g, '').replace(/[`*_~]/g, '').trim();
          const id = text.toLowerCase().replace(/[^\w\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, '');
          return <h2 id={id}>{children}</h2>;
        },
        h3: ({ children }) => {
          const text = String(children).replace(/\*\*/g, '').replace(/[`*_~]/g, '').trim();
          const id = text.toLowerCase().replace(/[^\w\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, '');
          return <h3 id={id}>{children}</h3>;
        },
        pre: ({ children, ...props }) => {
          const codeElement = getMarkdownCodeElement(children);
          const codeText = codeElement?.props?.children;
          if (codeText !== undefined) {
            return (
              <CodeBlock isDark={isDark} className={codeElement.props.className}>
                {String(codeText).replace(/\n$/, '')}
              </CodeBlock>
            );
          }
          return <pre {...props}>{children}</pre>;
        },
        img: ({ src, alt, ...props }) => (
          <figure className="my-8">
            <img src={src} alt={alt || ''} className="rounded-2xl w-full shadow-lg" loading="lazy" {...props} />
            {alt && <figcaption className={`text-center text-sm mt-3 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{alt}</figcaption>}
          </figure>
        ),
        a: ({ href, children, ...props }) => {
          const audioMatch = href && href.match(/\.(mp3|wav|ogg|m4a)$/i);
          if (audioMatch) {
            return <AudioPlayer src={href} label={children} isDark={isDark} />;
          }
          return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
});

export default function BlogPostClient({ post }: { post: PostData }) {
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const visible = true;
  const [navigating, setNavigating] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState('');
  const navigatingRef = useRef(false);

  const toc = extractToc(post.content);

  useEffect(() => {
    // Clear the navigation overlay
    document.documentElement.classList.remove('page-navigating');
  }, []);

  // BFCache / new-tab return fix:
  // On iOS Safari, returning from a new tab or from the background can leave the page frozen and blank.
  // Listen to both pageshow(persisted) and visibilitychange; reload when either fires.
  useEffect(() => {
    let hidden = false;
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hidden = true;
      } else if (document.visibilityState === 'visible' && hidden) {
        window.location.reload();
      }
    };
    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const handleBack = () => {
    if (navigating) return;
    document.documentElement.classList.add('page-navigating');
    setNavigating(true);
    const from = new URLSearchParams(window.location.search).get('from');
    setTimeout(() => {
      const blogTab = new URLSearchParams(window.location.search).get('blogtab');
      router.push(from === 'blog' ? `/?tab=blog${blogTab ? '&blogtab='+blogTab : ''}` : '/');
    }, 600);
  };

  // Reading progress
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0 && progressRef.current) {
        const progress = Math.min(100, (scrollTop / docHeight) * 100);
        progressRef.current.style.width = `${progress}%`;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // TOC active heading tracking
  useEffect(() => {
    if (toc.length === 0) return;
    const headings = toc.map(t => document.getElementById(t.id)).filter(Boolean) as HTMLElement[];
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: '-80px 0px -70% 0px' }
    );
    headings.forEach(h => observer.observe(h));
    return () => observer.disconnect();
  }, [toc]);

  // Use React state so the component re-renders correctly on theme toggle
  const isDark = theme === 'dark';

  // Top-to-bottom fade-in with staggered delay
  const anim = (delay: number) =>
    `transition-all duration-500 ease-out ${
      visible
        ? 'opacity-100 translate-y-0'
        : 'opacity-0 translate-y-3'
    }` + (delay ? ` delay-[${delay}ms]` : '');

  return (
    <div className={`min-h-screen relative ${isDark ? 'bg-zinc-950' : 'bg-zinc-50'}`}>
      <GlobalLoader isDark={isDark} show={navigating} />
      {/* Do not render AnimatedGradient before visible, so the glow orbs never leak through */}
      {visible && <AnimatedGradient isDark={isDark} />}
      
      {/* Reading progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-0.5">
        <div 
          ref={progressRef}
          className="h-full bg-gradient-to-r from-red-500 to-pink-500 transition-[width] duration-150 ease-out"
          style={{ width: '0%' }}
        />
      </div>

      {/* Top bar */}
      <nav className={`max-w-3xl mx-auto px-4 md:px-6 py-6 flex items-center justify-between sticky top-0 z-40 backdrop-blur-xl ${anim(0)}`}>
        <button
          onClick={handleBack}
          onTouchStart={(e) => { e.preventDefault(); handleBack(); }}
          style={{ touchAction: 'manipulation' }}
          className={`flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-xl transition-all duration-200 active:scale-95 active:opacity-70 hover:scale-105 ${
            isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800/50' : 'text-zinc-500 hover:text-zinc-900 hover:bg-white/70'
          }`}
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={toggleTheme}
          className={`p-3 rounded-2xl transition-all duration-500 hover:scale-110 ${
            isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800/50' : 'text-zinc-600 hover:text-zinc-900 hover:bg-white/70'
          }`}
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </nav>

      {/* TOC */}
      <TableOfContents toc={toc} isDark={isDark} activeId={activeId} />

      <main className="max-w-3xl mx-auto px-4 md:px-6 pb-52">
        <article>
          <header className={`mb-10 ${anim(80)}`}>
            <h1 className={`text-3xl md:text-4xl font-bold tracking-tight mb-4 ${isDark ? 'text-white' : 'text-zinc-900'}`}>
              {post.title}
            </h1>
            {post.aiGenerated && (
              <p className={`text-xs mb-4 ${isDark ? 'text-violet-300/90' : 'text-violet-700'}`}>
                This post was generated by AI — for reference only
              </p>
            )}
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`text-sm ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>{post.date}</span>
              {post.readTime && <span className={`text-sm ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>· {post.readTime}</span>}
              <div className="flex items-center gap-2">
                {post.tags.map((tag, i) => (
                  <span key={i} className={`text-xs px-2.5 py-1 rounded-lg font-medium ${isDark ? 'bg-zinc-800/80 text-zinc-300' : 'bg-zinc-200/80 text-zinc-600'}`}>{tag}</span>
                ))}
              </div>
            </div>
          </header>

          <div className={`prose prose-base md:prose-lg max-w-none ${anim(160)}
            ${isDark ? 'prose-invert' : ''}
            prose-headings:font-bold prose-headings:tracking-tight
            prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4
            prose-h3:text-lg prose-h3:mt-8 prose-h3:mb-3
            prose-p:leading-relaxed
            prose-a:text-red-500 prose-a:no-underline hover:prose-a:underline
            prose-code:text-sm prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md
            ${isDark ? 'prose-code:bg-zinc-800' : 'prose-code:bg-zinc-100'}
            prose-pre:rounded-2xl prose-pre:shadow-lg
            ${isDark ? 'prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800' : 'prose-pre:bg-zinc-50 prose-pre:border prose-pre:border-zinc-200'}
            prose-li:marker:text-red-400
            prose-blockquote:border-l-red-400 prose-blockquote:italic
            ${isDark ? 'prose-blockquote:text-zinc-400' : 'prose-blockquote:text-zinc-600'}
            prose-strong:font-bold
            prose-hr:border-zinc-200 ${isDark ? 'prose-hr:border-zinc-800' : ''}
          `}>
            <MemoizedMarkdownWithToc content={post.content} isDark={isDark} />
          </div>
          <div className={`mt-10 pt-6 border-t ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
            <PostActions slug={post.slug} />
          </div>
        </article>
      </main>
      {/* Music player is in root layout */}
    </div>
  );
}
