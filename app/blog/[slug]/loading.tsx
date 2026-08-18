'use client';

import { GlobalLoader } from '@/components/layout/GlobalLoader';

export default function BlogLoading() {
  const isDark = typeof document !== 'undefined'
    ? document.documentElement.classList.contains('dark')
    : false;

  return <GlobalLoader isDark={isDark} show={true} />;
}
