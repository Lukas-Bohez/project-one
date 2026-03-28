import { useEffect, useRef, useState } from 'react';

export type ScrollDirection = 'down' | 'up';

export function useScrollDirection(threshold = 4): ScrollDirection {
  const [direction, setDirection] = useState<ScrollDirection>('down');
  const lastY = useRef(0);

  useEffect(() => {
    const handler = () => {
      const y = window.scrollY;
      const delta = y - lastY.current;
      if (Math.abs(delta) < threshold) return;
      setDirection(delta > 0 ? 'down' : 'up');
      lastY.current = y;
    };

    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, [threshold]);

  return direction;
}
