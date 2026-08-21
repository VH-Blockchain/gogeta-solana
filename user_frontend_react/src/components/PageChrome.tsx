import type { ReactNode } from 'react';
import { Fmt } from '@/core/utils/format';
import { WebTokens, cardShadow, glow, withAlpha } from '@/theme/webTokens';
import { useWindowWidth } from '@/hooks/useWindowWidth';

/**
 * The portal's page chrome — masthead, section headers and card grids.
 *
 * Extracted so the Dashboard and Predict pages share one implementation instead
 * of each carrying its own copy: these are the pieces that define the layout
 * language, and two copies would drift the moment either page changed.
 */

/**
 * Slim masthead band.
 *
 * Replaces the older tall gradient hero with pop-out artwork: a single accent
 * rail on the left edge, the headline and any actions on one row, and live
 * counters inline underneath as a divided strip. Reads as a console header
 * rather than a marketing panel, and costs far less vertical space before the
 * first real content.
 */
export function Masthead({
  eyebrow,
  title,
  subtitle,
  actions,
  counters,
  railTo = WebTokens.violet,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  /** Optional CTA cluster, right-aligned on wide screens. */
  actions?: ReactNode;
  counters: ReactNode[];
  /** Second stop of the left rail's gradient — lets each page key its own colour. */
  railTo?: string;
}) {
  const width = useWindowWidth();
  const stacked = width < 900;

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        padding: stacked ? '20px 20px 20px 26px' : '24px 28px 24px 32px',
        background: `linear-gradient(100deg, ${withAlpha(WebTokens.accent, 0.1)} 0%, ${withAlpha(WebTokens.surfaceAlt, 0.55)} 42%, ${withAlpha(WebTokens.surface, 0.5)} 100%)`,
        border: `${WebTokens.borderWidth}px solid ${WebTokens.glassStroke}`,
        borderRadius: WebTokens.radiusCard,
        boxShadow: cardShadow,
      }}
    >
      {/* The accent rail — this design's signature, replacing the old hero's
          radial glow and background artwork. */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          background: `linear-gradient(to bottom, ${WebTokens.accent}, ${railTo})`,
        }}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: stacked ? 'column' : 'row',
          alignItems: stacked ? 'flex-start' : 'flex-end',
          gap: stacked ? 18 : 24,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <span
            className="f-dmsans"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              color: WebTokens.accent,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1.4,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: WebTokens.accent,
                boxShadow: glow(WebTokens.accent, 0.9),
              }}
            />
            {eyebrow}
          </span>

          <h1
            className="t-headline-medium"
            style={{ marginTop: 10, fontWeight: 800, lineHeight: 1.12 }}
          >
            {title}
          </h1>

          <p
            className="f-inter"
            style={{
              marginTop: 6,
              maxWidth: 560,
              color: WebTokens.textSecondary,
              fontSize: 13.5,
              lineHeight: 1.45,
            }}
          >
            {subtitle}
          </p>
        </div>

        {actions && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, flexShrink: 0 }}>{actions}</div>
        )}
      </div>

      {/* Divided counter strip — live numbers aligned on a rule so they scan as
          a row rather than floating as separate chips. */}
      {counters.length > 0 && (
        <div
          style={{
            marginTop: stacked ? 18 : 20,
            paddingTop: 16,
            borderTop: `1px solid ${WebTokens.chromeDivider}`,
            display: 'flex',
            flexWrap: 'wrap',
            gap: stacked ? 20 : 36,
          }}
        >
          {counters}
        </div>
      )}
    </div>
  );
}

/** One masthead counter: tinted icon, big number, quiet label beneath. */
export function Counter({
  icon,
  value,
  label,
  tint,
}: {
  icon: ReactNode;
  value: string;
  label: string;
  tint: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <span style={{ color: tint, display: 'inline-flex', fontSize: 18 }}>{icon}</span>
      <span style={{ minWidth: 0 }}>
        <span
          className="f-opensans"
          style={{
            display: 'block',
            fontSize: 19,
            fontWeight: 700,
            lineHeight: 1.1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </span>
        <span
          style={{ display: 'block', marginTop: 1, color: WebTokens.textMuted, fontSize: 11.5 }}
        >
          {label}
        </span>
      </span>
    </div>
  );
}

/** 1,234 / 12.3k / 1.2M — the compact form the counters use. */
export function compactCounter(n: number): string {
  return Fmt.compactNumber(n);
}

/**
 * Section header with a colour rail, a caption and an optional count.
 *
 * Replaces the plain title + right-hand text link: sections are visually keyed
 * by colour and carry a caption, so the same information reads with more
 * hierarchy. `trailing` takes over the right side when a page needs controls
 * there (the Predict page puts its tab switcher in that slot) instead of a
 * single action link.
 */
export function RailHeader({
  title,
  caption,
  accent,
  count,
  actionLabel,
  onAction,
  trailing,
}: {
  title: string;
  caption?: string;
  accent: string;
  count?: number;
  actionLabel?: string;
  onAction?: () => void;
  trailing?: ReactNode;
}) {
  const width = useWindowWidth();
  // A tab switcher next to a title needs its own row once space is tight.
  const stack = trailing != null && width < 780;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: stack ? 'column' : 'row',
        alignItems: stack ? 'stretch' : 'center',
        gap: stack ? 14 : 12,
        paddingBottom: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
        <span
          aria-hidden="true"
          style={{
            width: 3,
            alignSelf: 'stretch',
            minHeight: 34,
            borderRadius: 999,
            background: accent,
            boxShadow: glow(accent, 0.5),
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <h2 className="t-title-large" style={{ fontSize: 18 }}>
              {title}
            </h2>
            {count != null && count > 0 && (
              <span
                className="f-opensans"
                style={{
                  padding: '2px 8px',
                  background: withAlpha(accent, 0.14),
                  border: `1px solid ${withAlpha(accent, 0.3)}`,
                  borderRadius: 999,
                  color: accent,
                  fontSize: 11,
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {count}
              </span>
            )}
          </div>
          {caption && (
            <p style={{ marginTop: 2, color: WebTokens.textMuted, fontSize: 12 }}>{caption}</p>
          )}
        </div>
        {actionLabel && onAction && !stack && (
          <button
            type="button"
            className="btn-text"
            style={{ color: accent, flexShrink: 0 }}
            onClick={onAction}
          >
            {actionLabel}
          </button>
        )}
      </div>
      {trailing}
      {actionLabel && onAction && stack && (
        <button
          type="button"
          className="btn-text"
          style={{ color: accent, alignSelf: 'flex-start' }}
          onClick={onAction}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

/**
 * Auto-fill card grid.
 *
 * Replaces measured fixed-pixel flex items: cards size themselves to the
 * column, so a half-empty final row no longer leaves a ragged gap and narrow
 * viewports get one full-width card instead of a squeezed one. No container
 * measurement needed, which also removes a render pass.
 */
export function CardGrid({ min, children }: { min: number; children: ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(min(${min}px, 100%), 1fr))`,
        gap: 16,
        alignItems: 'start',
      }}
    >
      {children}
    </div>
  );
}
