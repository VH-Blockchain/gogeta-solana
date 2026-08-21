import type { CSSProperties, ReactNode } from 'react';
import './Reveal.css';

/**
 * The flutter_animate `.animate().fadeIn(delay:, duration:).slideY(begin:)`
 * chain used for every page's cascading entrance — each section fades and
 * slides in slightly after the one above it, so a page reads as one smooth
 * reveal on load rather than popping in all at once.
 *
 * A CSS animation rather than a JS one: these fire once on mount and never
 * need to be driven or interrupted.
 */
export function Reveal({
  children,
  delay = 0,
  duration = 320,
  /** Vertical offset to slide up from, as a fraction of the element's height. */
  y = 0.06,
  /** Horizontal offset, for the landing page's zigzag cards. */
  x = 0,
  className,
  style,
}: {
  children: ReactNode;
  delay?: number;
  duration?: number;
  y?: number;
  x?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`reveal${className ? ` ${className}` : ''}`}
      style={
        {
          '--reveal-delay': `${delay}ms`,
          '--reveal-duration': `${duration}ms`,
          '--reveal-y': `${y * 100}%`,
          '--reveal-x': `${x * 100}%`,
          ...style,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}
