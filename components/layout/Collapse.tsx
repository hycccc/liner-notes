'use client';

import { ReactNode } from 'react';

/**
 * Generic expand/collapse animation component
 *
 * Implemented with the CSS grid-template-rows trick — no JS height measurement needed
 * How it works: grid-template-rows 0fr → 1fr, with min-h-0 on the inner div
 *
 * Animation standards (site-wide):
 * - Collapse (expand/collapse): 240ms ease-in-out
 * - Card entrance: 700ms ease-out (staggered delay)
 * - Hover: 150ms
 * - Color transitions: 150ms
 * - Page navigation loading: >= 600ms
 */
export function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div
      className="grid overflow-hidden transition-[grid-template-rows] duration-[240ms] ease-in-out"
      style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
    >
      <div className="min-h-0">
        {children}
      </div>
    </div>
  );
}
