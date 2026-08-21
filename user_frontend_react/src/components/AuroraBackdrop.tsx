import { useEffect, useRef, type ReactNode } from 'react';
import { WebTokens, withAlpha } from '@/theme/webTokens';
import './AuroraBackdrop.css';

/**
 * Animated gradient blobs + a faint dot grid. One instance per screen, kept
 * cheap: no blur, just drifting radial gradients behind the content.
 *
 * The blob drift is driven by a rAF loop writing CSS custom properties (the
 * exact same sin/cos alignment math as the Flutter AnimationController's
 * 24-second cycle) rather than a keyframe animation, because each blob's
 * position is a different phase of the same clock.
 */
export function AuroraBackdrop({
  children,
  dimmed = false,
  fill = false,
}: {
  children: ReactNode;
  /** Softer blobs for in-portal pages (landing uses full strength). */
  dimmed?: boolean;
  /**
   * `true` caps the host at exactly the viewport, for layouts that scroll an
   * inner pane (the portal shell). `false` lets it grow past the viewport, for
   * the pages that scroll the document (landing, legal).
   */
  fill?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const DURATION_MS = 24_000;
    let raf = 0;
    const start = performance.now();

    const tick = (now: number) => {
      // Flutter: `final t = _c.value * 2 * math.pi;`
      const t = (((now - start) % DURATION_MS) / DURATION_MS) * 2 * Math.PI;

      // Alignment(x, y) maps to a percentage: -1 => 0%, 0 => 50%, 1 => 100%.
      const pct = (a: number) => `${(a + 1) * 50}%`;

      host.style.setProperty('--b1x', pct(-0.9 + 0.25 * Math.sin(t)));
      host.style.setProperty('--b1y', pct(-1.1 + 0.15 * Math.cos(t)));
      host.style.setProperty('--b2x', pct(1.1 + 0.2 * Math.cos(t * 0.8)));
      host.style.setProperty('--b2y', pct(-0.6 + 0.25 * Math.sin(t * 0.8)));
      host.style.setProperty('--b3x', pct(0.2 + 0.3 * Math.sin(t * 0.6)));
      host.style.setProperty('--b3y', pct(1.25 + 0.1 * Math.cos(t * 0.6)));

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const strength = dimmed ? 0.16 : 0.3;

  return (
    <div
      className={`aurora${fill ? ' aurora--fill' : ''}`}
      ref={hostRef}
      style={
        {
          '--blob1': withAlpha(WebTokens.accent, strength * 0.55),
          '--blob2': withAlpha(WebTokens.violet, strength),
          '--blob3': withAlpha(WebTokens.blue, strength * 0.5),
        } as React.CSSProperties
      }
    >
      <div className="aurora__blobs" aria-hidden="true">
        <div className="aurora__blob aurora__blob--1" />
        <div className="aurora__blob aurora__blob--2" />
        <div className="aurora__blob aurora__blob--3" />
      </div>
      <div className="aurora__dots" aria-hidden="true" />
      <div className="aurora__content">{children}</div>
    </div>
  );
}
