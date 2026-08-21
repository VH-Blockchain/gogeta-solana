import type { CSSProperties, ReactNode } from 'react';
import { WebTokens, glassGradient, withAlpha } from '@/theme/webTokens';
import { initialsOf } from '@/data/models';

/** Color-coded status chip (open / locked / won / lost ...). */
export function StatusChip({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="f-dmsans"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '5px 10px',
        background: withAlpha(color, 0.12),
        border: `1px solid ${withAlpha(color, 0.35)}`,
        borderRadius: 999,
        color,
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

const AVATAR_TINTS = [
  WebTokens.accent,
  WebTokens.violet,
  WebTokens.gold,
  WebTokens.blue,
  WebTokens.coral,
];

/** Initials avatar with a deterministic accent tint. */
export function WebAvatar({
  initials,
  seed = 0,
  radius = 18,
}: {
  initials: string;
  seed?: number;
  radius?: number;
}) {
  const tint = AVATAR_TINTS[Math.abs(seed) % AVATAR_TINTS.length];
  return (
    <div
      style={{
        width: radius * 2,
        height: radius * 2,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${withAlpha(tint, 0.28)}, ${withAlpha(tint, 0.1)})`,
        border: `1px solid ${withAlpha(tint, 0.45)}`,
        color: tint,
        fontSize: radius * 0.72,
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      {initials}
    </div>
  );
}

/** Convenience wrapper for the common "avatar from a display name" case. */
export function NameAvatar({
  name,
  seed = 0,
  radius = 18,
}: {
  name: string;
  seed?: number;
  radius?: number;
}) {
  return <WebAvatar initials={initialsOf(name)} seed={seed} radius={radius} />;
}

/** Signed coin amount, green for credit / red for debit. */
export function CoinAmount({ amount, fontSize = 14 }: { amount: number; fontSize?: number }) {
  const credit = amount >= 0;
  return (
    <span
      className="f-opensans"
      style={{
        color: credit ? WebTokens.accent : WebTokens.danger,
        fontWeight: 600,
        fontSize,
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
      }}
    >
      {credit ? '+' : ''}
      {amount}
    </span>
  );
}

export function SectionHeader({ title, trailing }: { title: string; trailing?: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        paddingBottom: 14,
      }}
    >
      <h2 className="t-title-large" style={{ flex: 1, minWidth: 0 }}>
        {title}
      </h2>
      {trailing}
    </div>
  );
}

/**
 * Small icon+value+label chip for PageHeader's `stats` slot — the same visual
 * recipe as the dashboard/predictions hero's stat chips, shared so every page
 * header uses one implementation.
 */
export function HeaderStat({
  icon,
  value,
  label,
  tint = WebTokens.accent,
}: {
  icon: ReactNode;
  value: string;
  label: string;
  tint?: string;
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0,
        padding: '9px 12px',
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${WebTokens.glassStroke}`,
        borderRadius: 12,
      }}
    >
      <span style={{ color: tint, display: 'inline-flex', fontSize: 15 }}>{icon}</span>
      <span
        className="f-opensans"
        style={{
          marginLeft: 7,
          color: WebTokens.textPrimary,
          fontWeight: 600,
          fontSize: 13,
        }}
      >
        {value}
      </span>
      <span style={{ marginLeft: 5, color: WebTokens.textMuted, fontSize: 12 }}>{label}</span>
    </div>
  );
}

/**
 * Standard portal page header: big title + muted subtitle + trailing slot,
 * wrapping on narrow screens. Rendered inside a glass banner — the same
 * gradient/border language as the nav pill — so the nav and the page content
 * read as one continuous surface instead of a floating bar over plain cards.
 */
export function PageHeader({
  title,
  subtitle,
  trailing,
  stats,
  narrow = false,
}: {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  /**
   * Live stat chips (see HeaderStat) shown under the subtitle — gives
   * secondary pages the same "never a bare title" density the
   * Dashboard/Predictions hero cards already have.
   */
  stats?: ReactNode[] | null;
  narrow?: boolean;
}) {
  const titleBlock = (
    <div style={{ minWidth: 0 }}>
      <h1 className="t-headline-medium">{title}</h1>
      {subtitle && (
        <p style={{ marginTop: 6, color: WebTokens.textSecondary, fontSize: 14 }}>{subtitle}</p>
      )}
      {stats && stats.length > 0 && (
        <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 10 }}>{stats}</div>
      )}
    </div>
  );

  return (
    <div
      style={{
        width: '100%',
        padding: narrow ? '18px' : '22px 26px',
        background: glassGradient,
        border: `${WebTokens.borderWidth}px solid ${WebTokens.glassStroke}`,
        borderRadius: WebTokens.radiusCard,
        boxShadow: 'var(--card-shadow)',
      }}
    >
      {trailing == null ? (
        titleBlock
      ) : narrow ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {titleBlock}
          {trailing}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>{titleBlock}</div>
          {trailing}
        </div>
      )}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string | null;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          padding: 18,
          background: glassGradient,
          borderRadius: '50%',
          border: `${WebTokens.borderWidth}px solid ${WebTokens.glassStroke}`,
          color: WebTokens.textMuted,
          display: 'inline-flex',
          fontSize: 30,
        }}
      >
        {icon}
      </div>
      <p className="t-title-medium" style={{ marginTop: 18 }}>
        {title}
      </p>
      {subtitle && (
        <p style={{ marginTop: 6, color: WebTokens.textMuted, fontSize: 13 }}>{subtitle}</p>
      )}
      {action && <div style={{ marginTop: 18 }}>{action}</div>}
    </div>
  );
}

/** Responsive page padding for portal pages: 16 phones / 24 tablets / 32 desktop. */
export function pagePadding(width: number): number {
  return width < WebTokens.bpTablet ? 16 : width < WebTokens.bpDesktop ? 24 : 32;
}

/** A plain, theme-consistent horizontal rule. */
export function Divider({ style }: { style?: CSSProperties }) {
  return <div className="divider" style={style} />;
}
