import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import ScheduleRounded from '@mui/icons-material/ScheduleRounded';
import BoltRounded from '@mui/icons-material/BoltRounded';
import PeopleAltRounded from '@mui/icons-material/PeopleAltRounded';
import CheckRounded from '@mui/icons-material/CheckRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import { useState, type ReactNode } from 'react';
import { Fmt } from '@/core/utils/format';
import { CategoryCatalog } from '@/data/categoryCatalog';
import { isResolved, type Prediction, type PredictionOption } from '@/data/models';
import { useBasketStore } from '@/store/basketStore';
import { WebTokens, cardFill, cardFillHover, cardShadow, glow, withAlpha } from '@/theme/webTokens';
import { accentColor } from './accents';
import { HeroBackgroundArt } from './HeroArt';
import { Icon } from './Icon';
import { useCountUp } from '@/hooks/useCountUp';

/**
 * Compact-header mission card — a small category/league header row, then full
 * combined option rows (indicator + label + share percent in one clickable
 * pill, with a crowd-share fill bar).
 *
 * Real functionality preserved: rows are directly clickable right on the card
 * (mirrors the app's inline-pick pattern) — clicking stages a pick in the
 * basket store (local-only, no network call, click again to deselect) exactly
 * like the mobile app's "Predict the day" grid; actual submission happens
 * later via PredictSubmitBar. The header opens the full detail panel.
 *
 * Port of `ArenaCard`.
 */
export function ArenaCard({
  prediction,
  onOpenDetail,
}: {
  prediction: Prediction;
  onOpenDetail: (p: Prediction) => void;
}) {
  const p = prediction;
  const entered = p.selectedOptionId != null;
  const basketOptionId = useBasketStore((s) => s.picks[p.id]?.option.id ?? null);
  const toggle = useBasketStore((s) => s.toggle);

  const tint = accentColor(CategoryCatalog.accentFor(p.categoryKey));
  const iconName = CategoryCatalog.iconNameFor(p.categoryKey);
  const shown = p.options.slice(0, 3);

  return (
    <ArenaCardShell entered={entered} categoryIconName={iconName}>
      {/* The header opens the full detail panel; the option rows below are
          their own independent quick-pick targets — never nested under the
          same click handler. */}
      <button
        type="button"
        onClick={() => onOpenDetail(p)}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: '14px 14px 10px',
          borderRadius: `${WebTokens.radiusCard}px ${WebTokens.radiusCard}px 0 0`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Chip
            icon={<Icon name={iconName} size={12} />}
            label={CategoryCatalog.labelFor(p.categoryKey)}
            tint={tint}
            flexible
          />
          <Chip
            icon={
              entered ? (
                <CheckCircleRounded sx={{ fontSize: 12 }} />
              ) : (
                <ScheduleRounded sx={{ fontSize: 12 }} />
              )
            }
            label={entered ? 'Entered' : Fmt.durationShort(p.closesInMs)}
            tint={entered ? WebTokens.accent : WebTokens.textSecondary}
          />
        </div>

        <div
          className="clamp-2"
          style={{ marginTop: 12, fontWeight: 700, fontSize: 15, lineHeight: 1.25 }}
        >
          {p.title}
        </div>

        {p.subtitle && (
          <div
            className="ellipsis f-inter"
            style={{ marginTop: 2, color: WebTokens.textMuted, fontSize: 12 }}
          >
            {p.subtitle}
          </div>
        )}
      </button>

      <div style={{ padding: '4px 14px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {shown.map((o) => (
          <OptionRow
            key={o.id}
            option={o}
            prediction={p}
            basketOptionId={basketOptionId}
            onClick={entered ? null : () => toggle(p, o)}
          />
        ))}
      </div>

      {p.options.length > 3 && (
        <button
          type="button"
          onClick={() => onOpenDetail(p)}
          className="f-inter"
          style={{
            margin: '8px 14px 6px',
            alignSelf: 'flex-start',
            color: WebTokens.textMuted,
            fontSize: 11,
            textDecoration: 'underline',
          }}
        >
          +{p.options.length - 3} more options
        </button>
      )}

      <div style={{ display: 'flex', gap: 8, padding: '8px 14px 14px' }}>
        <FooterPill
          icon={<BoltRounded sx={{ fontSize: 13 }} />}
          label={`${Fmt.compactNumber(p.reward)} pts`}
          fg={WebTokens.onAccent}
          bg={WebTokens.gold}
        />
        <FooterPill
          icon={<PeopleAltRounded sx={{ fontSize: 13 }} />}
          label={Fmt.compactNumber(p.participants)}
          fg={WebTokens.textPrimary}
          bg={WebTokens.surfaceAlt}
        />
      </div>
    </ArenaCardShell>
  );
}

/**
 * Standalone bordered pill for the header row (category / status) — sits
 * directly on the card background rather than a colored banner strip.
 */
function Chip({
  icon,
  label,
  tint,
  flexible = false,
}: {
  icon: ReactNode;
  label: string;
  tint: string;
  flexible?: boolean;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        minWidth: 0,
        flexShrink: flexible ? 1 : 0,
        padding: '6px 10px',
        background: WebTokens.surfaceAlt,
        borderRadius: 999,
        border: `1px solid ${withAlpha(tint, 0.4)}`,
        color: tint,
      }}
    >
      <span style={{ display: 'inline-flex', flexShrink: 0 }}>{icon}</span>
      <span className="ellipsis f-dmsans" style={{ fontSize: 11, fontWeight: 700 }}>
        {label}
      </span>
    </span>
  );
}

/** Solid pill badge for the card footer (points / players). */
function FooterPill({
  icon,
  label,
  fg,
  bg,
}: {
  icon: ReactNode;
  label: string;
  fg: string;
  bg: string;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 12px',
        background: bg,
        borderRadius: 999,
        color: fg,
      }}
    >
      {icon}
      <span className="f-opensans" style={{ fontWeight: 600, fontSize: 12 }}>
        {label}
      </span>
    </span>
  );
}

/**
 * A single option row — clickable to pick when open, otherwise a crowd-share
 * progress bar. One combined target (indicator + label + percent) instead of a
 * separate identity row + disconnected odds pill. Colors mirror the app
 * exactly: accent for the picked/correct option, danger-red for a resolved
 * wrong pick, plain muted bar beforehand.
 */
function OptionRow({
  option,
  prediction,
  basketOptionId,
  onClick,
}: {
  option: PredictionOption;
  prediction: Prediction;
  /** The option currently staged in the basket for this prediction, if any. */
  basketOptionId: string | null;
  onClick: (() => void) | null;
}) {
  const p = prediction;
  const selectedInBasket = basketOptionId === option.id;
  const picked = option.id === p.selectedOptionId || selectedInBasket;
  const resolved = isResolved(p);
  const correct = resolved && p.correctOptionId === option.id;
  const wrongPick = resolved && picked && !correct;
  const revealShare = basketOptionId != null || p.selectedOptionId != null || resolved;

  let fillColor: string;
  let edgeColor: string;
  let textColor: string;
  let indicator: ReactNode = null;

  if (correct) {
    fillColor = withAlpha(WebTokens.accent, 0.3);
    edgeColor = withAlpha(WebTokens.accent, 0.6);
    textColor = WebTokens.accent;
    indicator = <CheckRounded sx={{ fontSize: 13 }} />;
  } else if (wrongPick) {
    fillColor = withAlpha(WebTokens.danger, 0.22);
    edgeColor = withAlpha(WebTokens.danger, 0.5);
    textColor = WebTokens.danger;
    indicator = <CloseRounded sx={{ fontSize: 13 }} />;
  } else if (picked) {
    fillColor = withAlpha(WebTokens.accent, 0.18);
    edgeColor = withAlpha(WebTokens.accent, 0.5);
    textColor = WebTokens.textPrimary;
    indicator = <CheckRounded sx={{ fontSize: 13 }} />;
  } else {
    fillColor = withAlpha(WebTokens.accent, 0.1);
    edgeColor = 'transparent';
    textColor = WebTokens.textPrimary;
  }

  const share = Math.min(Math.max(option.sharePercent / 100, 0), 1);
  const animatedShare = useCountUp(revealShare ? share : 0, 750, revealShare);

  return (
    <button
      type="button"
      onClick={onClick ?? undefined}
      disabled={onClick == null}
      style={{
        position: 'relative',
        display: 'block',
        width: '100%',
        height: 46,
        borderRadius: 999,
        overflow: 'hidden',
        background: WebTokens.surfaceAlt,
        cursor: onClick ? 'pointer' : 'default',
        textAlign: 'left',
      }}
    >
      {revealShare && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            width: `${animatedShare * 100}%`,
            background: fillColor,
          }}
        />
      )}
      {edgeColor !== 'transparent' && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 999,
            border: `1.5px solid ${edgeColor}`,
          }}
        />
      )}
      <span
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 14px',
        }}
      >
        <span
          style={{
            width: 20,
            height: 20,
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            background: indicator ? withAlpha(textColor, 0.18) : 'rgba(255,255,255,0.06)',
            border: `1px solid ${indicator ? withAlpha(textColor, 0.5) : WebTokens.glassStroke}`,
            color: textColor,
          }}
        >
          {indicator}
        </span>
        <span className="ellipsis" style={{ flex: 1, fontSize: 14, fontWeight: 500, color: textColor }}>
          {option.label}
        </span>
        {/*
         * `option.odds` is NOT a payout multiplier in this app — reward is a
         * fixed amount set on the prediction, never computed from odds. For
         * Polymarket-imported predictions `odds` is literally the raw outcome
         * price (a 0.0-1.0 probability), so rendering it as "×0.51" reads as
         * "you'll get back less than your stake", which is both wrong and
         * confusing. Only the real vote-share percent is meaningful here.
         */}
        {revealShare && (
          <span
            className="f-opensans"
            style={{ fontSize: 12.5, fontWeight: 700, color: textColor, flexShrink: 0 }}
          >
            {Math.round(option.sharePercent)}%
          </span>
        )}
      </span>
    </button>
  );
}

/**
 * Card shell — the exact same glass gradient every other card in the portal
 * uses (WebCard's own recipe: dark two-tone fill + a top-edge highlight line),
 * not a custom background invented for this card. An entered card keeps a
 * subtle accent glow always on — a state indicator independent of the
 * background itself. No border at all: depth/state comes from the lift +
 * shadow/glow only.
 */
function ArenaCardShell({
  entered,
  categoryIconName,
  children,
}: {
  entered: boolean;
  categoryIconName: string;
  children: ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        background: hover ? cardFillHover : cardFill,
        borderRadius: WebTokens.radiusCard,
        borderTop: `0.8px solid ${WebTokens.glassHighlight}`,
        boxShadow: entered
          ? `${cardShadow}, ${glow(WebTokens.accent, 0.08)}`
          : cardShadow,
        transform: hover ? 'translateY(-4px)' : 'none',
        transition: 'transform 170ms cubic-bezier(0.33,1,0.68,1), background 170ms ease',
        // Isolates each card's hover animation from repainting its neighbors —
        // a grid holds up to ~20 of these at once.
        contain: 'paint',
      }}
    >
      {/* The same ambient glow + faded background glyph recipe as the dashboard
          hero card — a fixed warm gold radial blob top-right (not the category
          tint, which could be blue or violet and read as a "colored" wash)
          plus a large soft-edged category icon. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          right: -50,
          top: -50,
          width: 140,
          height: 140,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${withAlpha(WebTokens.gold, 0.18)}, ${withAlpha(WebTokens.gold, 0)})`,
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: '100%', height: 130 }}>
          <HeroBackgroundArt
            icon={<Icon name={categoryIconName} size={130} />}
            align="right"
            size={130}
          />
        </div>
      </div>
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: 1 }}>
        {children}
      </div>
    </div>
  );
}
