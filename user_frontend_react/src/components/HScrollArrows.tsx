import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import ChevronLeftRounded from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import { WebTokens } from '@/theme/webTokens';

function ArrowButton({ dir, onClick }: { dir: 'left' | 'right'; onClick: () => void }) {
  const Chevron = dir === 'left' ? ChevronLeftRounded : ChevronRightRounded;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === 'left' ? 'Scroll left' : 'Scroll right'}
      style={{
        width: 32,
        height: 32,
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.06)',
        border: `1px solid ${WebTokens.border}`,
        color: WebTokens.textSecondary,
      }}
    >
      <Chevron sx={{ fontSize: 18 }} />
    </button>
  );
}

/**
 * Horizontal-scroll wrapper with click-to-scroll arrows — desktop web has no
 * visible scrollbar and mouse-drag isn't discoverable, so a bare
 * overflow-x strip leaves overflowing content effectively unreachable
 * (confirmed: the Achievement levels' "Legend" node was clipped with no way
 * to scroll to it). Arrows sit beside the still-scrollable strip.
 *
 * Port of `HScrollArrows`.
 */
export function HScrollArrows({
  children,
  scrollBy = 220,
}: {
  children: ReactNode;
  scrollBy?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 1);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    // Content width isn't known until after first layout, and can change when
    // the catalog/badges land.
    const observer = new ResizeObserver(update);
    observer.observe(el);
    for (const child of Array.from(el.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [update]);

  const scroll = (delta: number) => {
    ref.current?.scrollBy({ left: delta, behavior: 'smooth' });
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      {canLeft && <ArrowButton dir="left" onClick={() => scroll(-scrollBy)} />}
      <div
        ref={ref}
        onScroll={update}
        style={{
          flex: 1,
          minWidth: 0,
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollbarWidth: 'none',
        }}
        className="hscroll"
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', width: 'max-content' }}>
          {children}
        </div>
      </div>
      {canRight && <ArrowButton dir="right" onClick={() => scroll(scrollBy)} />}
    </div>
  );
}
