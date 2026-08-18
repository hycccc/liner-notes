import { useRef, useState, useCallback } from 'react';

interface SwipeState {
  offsetX: number;
  isSwiping: boolean;
}

export const useSwipe = ({ onSwipeLeft, onSwipeRight, threshold = 50 }: { onSwipeLeft: () => void; onSwipeRight: () => void; threshold?: number }) => {
  const touchStartX = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [swipeState, setSwipeState] = useState<SwipeState>({
    offsetX: 0,
    isSwiping: false,
  });

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isHorizontal.current = null;
    setSwipeState({ offsetX: 0, isSwiping: true });
  }, []);

  const touchStartY = useRef<number | null>(null);
  const isHorizontal = useRef<boolean | null>(null);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const deltaX = e.touches[0].clientX - touchStartX.current;
    const deltaY = e.touches[0].clientY - (touchStartY.current ?? 0);
    
    // Determine direction on first significant move
    if (isHorizontal.current === null && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
      isHorizontal.current = Math.abs(deltaX) > Math.abs(deltaY);
    }
    
    if (isHorizontal.current) {
      e.preventDefault(); // prevent vertical scroll
      setSwipeState({ offsetX: deltaX, isSwiping: true });
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;

    if (isHorizontal.current && Math.abs(deltaX) > threshold) {
      if (deltaX < 0) onSwipeLeft();
      else onSwipeRight();
    }
    setSwipeState({ offsetX: 0, isSwiping: false });
    touchStartX.current = null;
    touchStartY.current = null;
    isHorizontal.current = null;
  }, [onSwipeLeft, onSwipeRight, threshold]);

  return { handleTouchStart, handleTouchMove, handleTouchEnd, swipeState };
};
