import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { MusicProvider } from "@/contexts/MusicContext";
import { GlobalMusicPlayer } from "@/components/music/GlobalMusicPlayer";
import site from "@/content/site.json";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: site.metaTitle,
  description: site.metaDescription,
  keywords: [site.name, "music", "personal website"],
  authors: [{ name: site.name }],
  openGraph: {
    title: site.metaTitle,
    description: site.metaDescription,
    type: "website",
    locale: "en_US",
    images: [{ url: site.avatar, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: site.metaTitle,
    description: site.metaDescription,
    images: [site.avatar],
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '32x32', type: 'image/x-icon' },
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/* Static theme-color fallback; JS immediately overrides it with the correct value */}
        <meta name="theme-color" content="#fafafa" />
        {/* Set the theme synchronously before React hydration to prevent a dark-mode flash */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            // v2 migration: clear the old auto-set theme record and follow the system theme instead
            if (localStorage.getItem('theme-mv') !== '2') {
              localStorage.removeItem('theme');
              localStorage.removeItem('theme-override');
              localStorage.setItem('theme-mv', '2');
            }
            var t = localStorage.getItem('theme-override');
            var isDark = t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches);
            var color = isDark ? '#09090b' : '#fafafa';
            if (isDark) {
              document.documentElement.classList.add('dark');
            }
            document.documentElement.style.backgroundColor = color;
            var m = document.querySelector('meta[name="theme-color"]');
            if (!m) { m = document.createElement('meta'); m.name = 'theme-color'; document.head.appendChild(m); }
            m.content = color;
          } catch(e) {}
        `}} />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          <MusicProvider>
            {children}
            <GlobalMusicPlayer />
          </MusicProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
