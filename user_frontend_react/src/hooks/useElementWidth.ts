import { useEffect, useRef, useState } from 'react';

/**
 * React equivalent of Flutter's `LayoutBuilder` — reports the measured width
 * of the returned ref's element, so the column-count math in the card grids
 * ports verbatim.
 *
 * Returns 0 until the first measurement lands; call sites guard on that so
 * they never compute a negative card width on the first paint.
 */
export function useElementWidth<T extends HTMLElement = HTMLDivElement>(): [
  React.RefObject<T>,
  number,
] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setWidth((prev) => (Math.abs(prev - w) < 0.5 ? prev : w));
    });
    observer.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}

/**
 * The shared "as many ~targetWidth cards per row as fit" math used by the
 * prediction grids (gap of 16, clamped to 1..maxCols).
 */
export function gridColumns(
  containerWidth: number,
  targetWidth: number,
  gap = 16,
  maxCols = 5,
): number {
  if (containerWidth <= 0) return 1;
  const cols = Math.floor((containerWidth + gap) / (targetWidth + gap));
  return Math.min(Math.max(cols, 1), maxCols);
}

/** Width of one card in an N-column row of `containerWidth` with `gap` gutters. */
export function columnWidth(containerWidth: number, cols: number, gap = 16): number {
  if (containerWidth <= 0 || cols <= 0) return 0;
  return (containerWidth - (cols - 1) * gap) / cols;
}
