import { useEffect, useRef, useState } from 'react';

/** Flutter's Curves.easeOutCubic. */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Counts a value up from 0 on mount — the React equivalent of
 * `TweenAnimationBuilder<double>(tween: Tween(begin: 0, end: target))`, used
 * by StatTile, GaugeRing, the landing stats strip and the option share bars.
 *
 * Re-runs whenever `target` changes, animating from wherever it currently is
 * so a live data update eases instead of snapping.
 */
export function useCountUp(target: number, durationMs = 900, enabled = true): number {
  const [value, setValue] = useState(enabled ? 0 : target);
  const fromRef = useRef(enabled ? 0 : target);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      fromRef.current = target;
      return;
    }

    const from = fromRef.current;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1);
      const next = from + (target - from) * easeOutCubic(t);
      setValue(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, durationMs, enabled]);

  return value;
}
