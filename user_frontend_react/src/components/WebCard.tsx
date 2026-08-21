import { useState, type CSSProperties, type ReactNode } from 'react';
import { WebTokens, cardFill, cardFillHover, cardShadow, glow, withAlpha } from '@/theme/webTokens';

/**
 * Glass card — gradient fill, top-edge highlight, layered depth, and a
 * bolder single-tone hairline + lift on hover. Port of `WebCard`.
 *
 * The Flutter widget nests a 1px-padding gradient-border container around the
 * fill; here the border colour is a real `border` on the outer element, which
 * renders identically and keeps the radius math simple.
 */
export function WebCard({
  children,
  padding = 20,
  onClick,
  hoverLift = false,
  accentBorder,
  glow: glowColor,
  className,
  style,
  as = 'div',
  title,
}: {
  children: ReactNode;
  /** Flutter's EdgeInsets — a number for all sides, or a CSS shorthand string. */
  padding?: number | string;
  onClick?: () => void;
  hoverLift?: boolean;
  accentBorder?: string;
  /** Optional permanent soft glow color behind the card. */
  glow?: string;
  className?: string;
  style?: CSSProperties;
  as?: 'div' | 'button';
  title?: string;
}) {
  const [hover, setHover] = useState(false);
  const lift = hoverLift && hover;

  const borderColor = lift
    ? withAlpha(accentBorder ?? WebTokens.accent, 0.6)
    : (accentBorder ?? WebTokens.glassStroke);

  const shadow = glowColor ? `${cardShadow}, ${glow(glowColor, 0.22)}` : cardShadow;

  const interactive = onClick != null || hoverLift;
  const Component = as;

  return (
    <Component
      className={className}
      title={title}
      onClick={onClick}
      onMouseEnter={interactive ? () => setHover(true) : undefined}
      onMouseLeave={interactive ? () => setHover(false) : undefined}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'inherit',
        boxSizing: 'border-box',
        padding: typeof padding === 'number' ? `${padding}px` : padding,
        background: lift ? cardFillHover : cardFill,
        // Per-side colour longhands rather than `border`/`borderColor`: React
        // warns about mixing a shorthand with the borderTopColor longhand below
        // (and their application order is then unpredictable) whenever the colour
        // changes between renders — which it does on every hoverLift card.
        // `borderColor` counts as a shorthand for this purpose too, so all four
        // sides are named explicitly. Renders identically.
        borderWidth: WebTokens.borderWidth,
        borderStyle: 'solid',
        borderRightColor: borderColor,
        borderBottomColor: borderColor,
        borderLeftColor: borderColor,
        // The top edge carries a brighter shine line, painted over the border.
        borderTopColor: WebTokens.glassHighlight,
        borderRadius: WebTokens.radiusCard,
        boxShadow: shadow,
        transform: lift ? 'translateY(-4px)' : 'none',
        transition: 'transform 170ms cubic-bezier(0.33,1,0.68,1), background 170ms ease, border-color 170ms ease',
        cursor: onClick ? 'pointer' : 'default',
        color: 'inherit',
        ...style,
      }}
    >
      {children}
    </Component>
  );
}
