import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import CloseRounded from '@mui/icons-material/CloseRounded';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Check from '@mui/icons-material/Check';
import KeyboardArrowUpRounded from '@mui/icons-material/KeyboardArrowUpRounded';
import KeyboardArrowDownRounded from '@mui/icons-material/KeyboardArrowDownRounded';
import { MetaPixel } from '@/core/analytics/metaPixel';
import { Fmt } from '@/core/utils/format';
import { CategoryCatalog } from '@/data/categoryCatalog';
import type { Prediction, PredictionOption } from '@/data/models';
import { usePredictionsStore } from '@/store/predictionsStore';
import { useUserStore } from '@/store/userStore';
import { WebTokens, panelFill, withAlpha } from '@/theme/webTokens';
import { GlowButton } from '@/components/GlowButton';
import { Icon } from '@/components/Icon';
import { Modal } from '@/components/Modal';
import { CoinAmount, StatusChip } from '@/components/Primitives';
import { WebCard } from '@/components/WebCard';
import { useWindowWidth } from '@/hooks/useWindowWidth';
import { toast } from '@/hooks/useToast';
import { useDetailStore } from './detailStore';

/**
 * Right-hand slide-in detail panel with option pick + confirm submit.
 * Port of `showPredictionDetail`/`_DetailPanel`.
 *
 * Mounted once at the shell level; reads which prediction (if any) is open
 * from the detail store.
 */
export function PredictionDetailPanel() {
  const prediction = useDetailStore((s) => s.prediction);
  const close = useDetailStore((s) => s.close);

  return (
    <Modal open={prediction != null} onClose={close} align="right">
      {prediction && <DetailPanelBody prediction={prediction} onClose={close} />}
    </Modal>
  );
}

function DetailPanelBody({
  prediction: p,
  onClose,
}: {
  prediction: Prediction;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const user = useUserStore((s) => s.user);
  const setCoins = useUserStore((s) => s.setCoins);
  const submit = usePredictionsStore((s) => s.submit);

  const width = useWindowWidth();
  const panelWidth = width < 560 ? width : 480;

  const canAfford = user.coins >= p.entryFee;
  // Already entered: show the pick read-only, no second submit.
  const entered = p.selectedOptionId != null;

  useEffect(() => {
    MetaPixel.logViewedContent();
  }, []);

  // Close the panel if the route changes underneath it (browser back/forward
  // or address-bar navigation) — otherwise it would linger over the new page.
  const location = useLocation();
  const openedAt = useRef(location.pathname + location.search);
  useEffect(() => {
    if (submitting) return;
    if (location.pathname + location.search !== openedAt.current) onClose();
  }, [location, submitting, onClose]);

  async function handleSubmit() {
    if (selected == null) return;
    setSubmitting(true);
    const balance = await submit(p.id, selected, p.entryFee);
    if (balance != null) {
      setCoins(balance);
      onClose();
      toast(`Prediction locked in! New balance: ${balance} points`);
    } else {
      setSubmitting(false);
      toast(usePredictionsStore.getState().error ?? 'Could not submit prediction');
    }
  }

  return (
    <aside
      style={{
        width: panelWidth,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: panelFill,
        borderLeft: `1px solid ${WebTokens.glassStroke}`,
        boxShadow: '-10px 0 40px rgba(0,0,0,0.55)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '20px 12px 0 24px', gap: 8 }}>
        <Icon
          name={CategoryCatalog.iconNameFor(p.categoryKey)}
          size={18}
          color={WebTokens.accent}
        />
        <span style={{ color: WebTokens.textSecondary, fontWeight: 600, fontSize: 13 }}>
          {CategoryCatalog.labelFor(p.categoryKey)}
        </span>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          title="Close"
          aria-label="Close"
          onClick={submitting ? undefined : onClose}
          disabled={submitting}
          style={{ color: WebTokens.textMuted, padding: 8, display: 'inline-flex' }}
        >
          <CloseRounded />
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 24px 24px' }}>
        <h2 className="t-headline-small">{p.title}</h2>

        {p.subtitle && (
          <p
            className="f-inter"
            style={{ marginTop: 8, color: WebTokens.textSecondary, lineHeight: 1.4 }}
          >
            {p.subtitle}
          </p>
        )}

        <div style={{ marginTop: 18, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <StatusChip label={`Closes ${Fmt.durationShort(p.closesInMs)}`} color={WebTokens.gold} />
          <StatusChip
            label={`${Fmt.compactNumber(p.participants)} playing`}
            color={WebTokens.violet}
          />
        </div>

        {p.info && (
          <div style={{ marginTop: 18 }}>
            <WebCard padding={14}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <InfoOutlined sx={{ fontSize: 16 }} style={{ color: WebTokens.textMuted, marginTop: 2 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <ExpandableInfo text={p.info} />
                </div>
              </div>
            </WebCard>
          </div>
        )}

        <h3 className="t-title-medium" style={{ marginTop: 24 }}>
          {entered ? 'Your pick' : 'Pick your answer'}
        </h3>

        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {p.options.map((o) => (
            <SelectableOption
              key={o.id}
              option={o}
              selected={entered ? o.id === p.selectedOptionId : selected === o.id}
              onClick={entered || submitting ? null : () => setSelected(o.id)}
            />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: 20,
          background: WebTokens.surfaceAlt,
          borderTop: `1px solid ${WebTokens.border}`,
        }}
      >
        {entered ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span
              style={{
                padding: 9,
                display: 'inline-flex',
                background: withAlpha(WebTokens.accent, 0.14),
                borderRadius: 12,
                color: WebTokens.accent,
              }}
            >
              <CheckCircle sx={{ fontSize: 20 }} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>You&apos;re in!</div>
              <div style={{ marginTop: 2, color: WebTokens.textSecondary, fontSize: 12.5 }}>
                Result lands after this closes — watch the bell.
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {p.entryFee > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 6,
                }}
              >
                <span style={{ color: WebTokens.textSecondary, fontSize: 13 }}>Points to enter</span>
                <CoinAmount amount={-p.entryFee} />
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: WebTokens.textSecondary, fontSize: 13 }}>Points if correct</span>
              <CoinAmount amount={p.reward} />
            </div>

            <div style={{ height: 16 }} />

            <GlowButton
              label={
                !canAfford
                  ? 'Not enough points'
                  : selected == null
                    ? 'Pick an option to continue'
                    : p.entryFee > 0
                      ? `Lock in prediction (−${p.entryFee})`
                      : 'Lock in prediction'
              }
              fullWidth
              busy={submitting}
              onClick={selected == null || !canAfford ? null : handleSubmit}
            />

            <p
              style={{
                marginTop: 8,
                textAlign: 'center',
                color: WebTokens.textMuted,
                fontSize: 11,
              }}
            >
              Predictions are final once submitted.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}

/**
 * The "More info" body text, clamped to 4 lines with a "View more"/"View less"
 * toggle — right-aligned under the text, only shown when the text actually
 * overflows 4 lines at the available width (a short info blurb gets no toggle
 * at all).
 */
function ExpandableInfo({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  // Measured rather than guessed — the Flutter version laid out a TextPainter
  // for exactly this reason.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => {
      const lineHeight = 13 * 1.45;
      setOverflows(el.scrollHeight > lineHeight * 4 + 1);
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text]);

  const style: React.CSSProperties = {
    color: WebTokens.textSecondary,
    fontSize: 13,
    lineHeight: 1.45,
    whiteSpace: 'pre-line',
  };

  return (
    <div>
      <p ref={ref} className={`f-inter${expanded ? '' : ' clamp-4'}`} style={style}>
        {text}
      </p>
      {overflows && (
        <div style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="f-inter"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              color: WebTokens.accent,
              fontSize: 12.5,
              fontWeight: 700,
            }}
          >
            {expanded ? 'View less' : 'View more'}
            {expanded ? (
              <KeyboardArrowUpRounded sx={{ fontSize: 16 }} />
            ) : (
              <KeyboardArrowDownRounded sx={{ fontSize: 16 }} />
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function SelectableOption({
  option,
  selected,
  onClick,
}: {
  option: PredictionOption;
  selected: boolean;
  onClick: (() => void) | null;
}) {
  return (
    <button
      type="button"
      onClick={onClick ?? undefined}
      disabled={onClick == null}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: 14,
        textAlign: 'left',
        background: selected ? withAlpha(WebTokens.accent, 0.1) : WebTokens.surfaceAlt,
        borderRadius: WebTokens.radiusControl,
        border: `${selected ? 1.5 : 1}px solid ${selected ? WebTokens.accent : WebTokens.border}`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background 160ms ease, border-color 160ms ease',
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          background: selected ? WebTokens.accent : 'transparent',
          border: `2px solid ${selected ? WebTokens.accent : WebTokens.borderStrong}`,
          color: WebTokens.onAccent,
        }}
      >
        {selected && <Check sx={{ fontSize: 12 }} />}
      </span>
      <span style={{ flex: 1, minWidth: 0, fontWeight: selected ? 700 : 500 }}>{option.label}</span>
      <span style={{ color: WebTokens.textSecondary, fontSize: 12, flexShrink: 0 }}>
        {Math.round(option.sharePercent)}% picked
      </span>
    </button>
  );
}
