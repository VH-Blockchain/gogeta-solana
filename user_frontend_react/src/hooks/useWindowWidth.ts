import { useEffect, useState } from 'react';

/**
 * React equivalent of `MediaQuery.sizeOf(context).width` — every responsive
 * branch in the Flutter portal reads the live viewport width, so the port
 * needs the same value as reactive state.
 */
export function useWindowWidth(): number {
  const [width, setWidth] = useState(() =>
    typeof window === 'undefined' ? 1440 : window.innerWidth,
  );

  useEffect(() => {
    let frame = 0;
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setWidth(window.innerWidth));
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return width;
}
