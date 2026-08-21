import { useState, type ReactNode } from 'react';
import { WebTokens, accentGradient, glow } from '@/theme/webTokens';
import './GlowButton.css';

/**
 * Glow CTA — gradient fill, glow shadow, hover lift, press scale.
 * Port of `GlowButton`.
 */
export function GlowButton({
  label,
  onClick,
  icon,
  gradient = accentGradient,
  glowColor = WebTokens.accent,
  large = false,
  fullWidth = false,
  busy = false,
  pill = false,
  height,
  type = 'button',
}: {
  label: string;
  /** Null/undefined disables the button (muted look, no interactions). */
  onClick?: (() => void) | null;
  icon?: ReactNode;
  gradient?: string;
  glowColor?: string;
  large?: boolean;
  fullWidth?: boolean;
  /** Shows a spinner instead of the label and blocks clicks. */
  busy?: boolean;
  /** Fully rounded capsule shape instead of the default soft-rounded corner. */
  pill?: boolean;
  /** Overrides the default 52 (58 when `large`) height — for compact contexts. */
  height?: number;
  type?: 'button' | 'submit';
}) {
  const [hover, setHover] = useState(false);
  const [down, setDown] = useState(false);

  const enabled = onClick != null && !busy;
  const resolvedHeight = height ?? (large ? 58 : 52);
  // A custom height (e.g. the topbar's pill button) implies a tighter, more
  // compact button overall — not just shorter but narrower too.
  const compact = height != null;

  const scale = down ? 0.97 : hover && enabled ? 1.02 : 1;

  return (
    <button
      type={type}
      className="glow-btn"
      disabled={!enabled}
      onClick={enabled ? () => onClick?.() : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setDown(false);
      }}
      onMouseDown={enabled ? () => setDown(true) : undefined}
      onMouseUp={() => setDown(false)}
      style={{
        height: resolvedHeight,
        width: fullWidth ? '100%' : undefined,
        padding: `0 ${compact ? 12 : large ? 32 : 24}px`,
        background: enabled ? gradient : WebTokens.surfaceHover,
        borderRadius: pill ? 999 : WebTokens.radiusControl + 1,
        boxShadow: enabled ? glow(glowColor, hover ? 0.65 : 0.4) : 'none',
        color: enabled ? WebTokens.onAccent : WebTokens.textMuted,
        transform: `scale(${scale})`,
        fontSize: compact ? 12.5 : large ? 16 : 14.5,
      }}
    >
      {busy ? (
        <span className="glow-btn__spinner" aria-label="Loading" />
      ) : (
        <>
          {icon && (
            <span
              className="glow-btn__icon"
              style={{ fontSize: compact ? 14 : 18, marginRight: compact ? 5 : 8 }}
            >
              {icon}
            </span>
          )}
          <span style={{ fontWeight: 400 }}>{label}</span>
        </>
      )}
    </button>
  );
}
