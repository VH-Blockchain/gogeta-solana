import { useState, type ReactNode } from 'react';
import { WebTokens } from '@/theme/webTokens';

/** Outlined ghost button — the secondary CTA next to a primary GlowButton. */
export function GhostButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        height: 52,
        padding: '0 20px',
        background: hover ? 'rgba(255,255,255,0.06)' : 'transparent',
        borderRadius: WebTokens.radiusControl,
        border: `1px solid ${hover ? WebTokens.glassStrokeStrong : WebTokens.glassStroke}`,
        color: WebTokens.textPrimary,
        fontSize: 15,
        fontWeight: 400,
        transition: 'background 150ms ease, border-color 150ms ease',
        whiteSpace: 'nowrap',
      }}
    >
      {icon && (
        <span style={{ display: 'inline-flex', color: WebTokens.textSecondary, fontSize: 18 }}>
          {icon}
        </span>
      )}
      {label}
    </button>
  );
}
