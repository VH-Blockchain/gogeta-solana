import { useMemo, useState } from 'react';
import CloseRounded from '@mui/icons-material/CloseRounded';
import CloseIcon from '@mui/icons-material/Close';
import BoltRounded from '@mui/icons-material/BoltRounded';
import LockRounded from '@mui/icons-material/LockRounded';
import { CategoryCatalog } from '@/data/categoryCatalog';
import { basketCount, linesOf, useBasketStore, type PickLine } from '@/store/basketStore';
import { usePredictionsStore } from '@/store/predictionsStore';
import { useUserStore } from '@/store/userStore';
import { WebTokens, glow, withAlpha } from '@/theme/webTokens';
import { toast } from '@/hooks/useToast';
import { accentColor } from './accents';
import { CongratsDialog, type CongratsPayload } from './CongratsDialog';
import { GlowButton } from './GlowButton';
import { Icon } from './Icon';
import { DialogCard, Modal } from './Modal';
import { CoinAmount, Divider, StatusChip } from './Primitives';
import './PredictSubmitBar.css';

/**
 * Floating glass action bar for the pick basket. Slides up over the bottom of
 * the content area once the basket has picks; "Submit" opens the confirm
 * dialog. Visible across the whole portal (mirroring the app stacking its
 * submit bar over the bottom nav in every tab, not just Predict).
 *
 * Port of `WebPredictSubmitBar` + `showWebSubmitPicksDialog`.
 */
export function PredictSubmitBar() {
  // `picks` is a stable reference; the array is derived here rather than in a
  // selector (see basketStore's note on snapshot identity).
  const picks = useBasketStore((s) => s.picks);
  const lines = useMemo(() => linesOf(picks), [picks]);
  const count = useBasketStore(basketCount);
  const clear = useBasketStore((s) => s.clear);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [congrats, setCongrats] = useState<CongratsPayload | null>(null);

  const visible = count > 0;
  const totalFee = lines.reduce((s, l) => s + l.prediction.entryFee, 0);

  function handleDone(ok: number) {
    setConfirmOpen(false);
    const submitted = lines;
    clear();

    if (ok === submitted.length) {
      // Full success — a real celebration, matching the app's post-submit
      // "Congratulations!" screen, instead of a toast.
      setCongrats({
        count: ok,
        totalFee: submitted.reduce((s, l) => s + l.prediction.entryFee, 0),
        totalReward: submitted.reduce((s, l) => s + l.prediction.reward, 0),
      });
      return;
    }

    const error = usePredictionsStore.getState().error;
    toast(
      ok === 0
        ? (error ?? 'Could not submit your picks.')
        : `${ok} of ${submitted.length} submitted — ${error ?? 'some failed'}`,
    );
  }

  return (
    <>
      <div
        className={`submit-bar${visible ? ' submit-bar--visible' : ''}`}
        // Inert when empty: opacity alone would leave "0 picks selected" in the
        // text and accessibility trees behind an invisible layer.
        aria-hidden={!visible}
      >
        <div
          className="submit-bar__pill"
          style={{
            background: `linear-gradient(to right, ${withAlpha(WebTokens.accent, 0.24)}, ${withAlpha(WebTokens.accent, 0.14)})`,
            border: `1px solid ${withAlpha(WebTokens.accent, 0.5)}`,
            boxShadow: glow(WebTokens.accent, 0.28),
          }}
        >
          <button
            type="button"
            aria-label="Clear picks"
            onClick={clear}
            style={{
              width: 40,
              height: 40,
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: withAlpha(WebTokens.surface, 0.7),
              borderRadius: '50%',
              border: `1px solid ${WebTokens.border}`,
              color: WebTokens.textPrimary,
            }}
          >
            <CloseRounded sx={{ fontSize: 18 }} />
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              className="ellipsis"
              style={{ color: WebTokens.textPrimary, fontWeight: 700, fontSize: 14 }}
            >
              {count} {count === 1 ? 'pick' : 'picks'} selected
            </div>
            {totalFee > 0 && (
              <div style={{ marginTop: 2, display: 'flex', alignItems: 'center' }}>
                <span style={{ color: WebTokens.textSecondary, fontSize: 11.5 }}>Entry&nbsp;</span>
                <CoinAmount amount={-totalFee} fontSize={11.5} />
              </div>
            )}
          </div>

          <GlowButton
            label="Submit"
            icon={<BoltRounded />}
            pill
            onClick={() => setConfirmOpen(true)}
          />
        </div>
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        {confirmOpen && (
          <ConfirmPicksDialog
            picks={lines}
            onCancel={() => setConfirmOpen(false)}
            onDone={handleDone}
          />
        )}
      </Modal>

      <CongratsDialog payload={congrats} onClose={() => setCongrats(null)} />
    </>
  );
}

/**
 * Confirm dialog. Loops the submit call per pick (no batch-submit endpoint
 * exists on the backend — mirrors the app's submit_picks_sheet.dart), then
 * reports how many landed.
 */
function ConfirmPicksDialog({
  picks,
  onCancel,
  onDone,
}: {
  picks: PickLine[];
  onCancel: () => void;
  onDone: (ok: number) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const balance = useUserStore((s) => s.user.coins);
  const setCoins = useUserStore((s) => s.setCoins);
  const submit = usePredictionsStore((s) => s.submit);

  const totalFee = picks.reduce((s, p) => s + p.prediction.entryFee, 0);
  const totalReward = picks.reduce((s, p) => s + p.prediction.reward, 0);
  const after = balance - totalFee;
  const enough = after >= 0;

  async function confirm() {
    setSubmitting(true);
    let ok = 0;
    let lastBalance: number | null = null;
    for (const l of picks) {
      const result = await submit(l.prediction.id, l.option.id, l.prediction.entryFee);
      if (result != null) {
        ok++;
        lastBalance = result;
      }
    }
    if (lastBalance != null) setCoins(lastBalance);
    onDone(ok);
  }

  return (
    <DialogCard maxWidth={460}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h2 style={{ fontSize: 19, fontWeight: 700, color: WebTokens.textPrimary }}>
          Confirm your picks
        </h2>
        <StatusChip label={`${picks.length}`} color={WebTokens.accent} />
        <span style={{ flex: 1 }} />
        <button
          type="button"
          title="Close"
          aria-label="Close"
          onClick={submitting ? undefined : onCancel}
          disabled={submitting}
          style={{ color: WebTokens.textMuted, padding: 8, display: 'inline-flex' }}
        >
          <CloseIcon />
        </button>
      </div>

      <p style={{ marginTop: 4, color: WebTokens.textSecondary, fontSize: 13 }}>
        Picks lock once submitted — each correct call pays out the reward shown.
      </p>

      {/* Everything between the header and the CTA scrolls as one unit once it
          can't fit — header and Confirm stay pinned so the action is always
          reachable. */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingTop: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {picks.map((line) => (
            <PickRow key={line.prediction.id} line={line} />
          ))}
        </div>

        <div style={{ height: 16 }} />

        <Line label="Potential reward" amount={totalReward} />
        {totalFee > 0 && (
          <>
            <div style={{ height: 8 }} />
            <Line label="Total points" amount={-totalFee} />
            <div style={{ height: 8 }} />
            <Divider />
            <div style={{ height: 8 }} />
            <Line label="Balance before" amount={balance} signed={false} />
            <div style={{ height: 8 }} />
            <Line
              label="Balance after entry"
              amount={after}
              signed={false}
              emphasize
              danger={!enough}
            />
            {!enough && (
              <p
                style={{
                  marginTop: 8,
                  color: WebTokens.danger,
                  fontSize: 12.5,
                  fontWeight: 600,
                }}
              >
                Not enough points for all picks. Remove one to continue.
              </p>
            )}
          </>
        )}
      </div>

      <div style={{ height: 16 }} />

      <GlowButton
        label={enough ? `Confirm & lock in ${picks.length} picks` : 'Insufficient balance'}
        icon={<LockRounded />}
        fullWidth
        busy={submitting}
        onClick={enough ? confirm : null}
      />
    </DialogCard>
  );
}

function PickRow({ line }: { line: PickLine }) {
  const tint = accentColor(CategoryCatalog.accentFor(line.prediction.categoryKey));
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: 12,
        background: withAlpha(tint, 0.1),
        borderRadius: WebTokens.radiusControl,
        border: `1px solid ${withAlpha(tint, 0.35)}`,
      }}
    >
      <span
        style={{
          padding: 8,
          display: 'inline-flex',
          background: withAlpha(tint, 0.16),
          borderRadius: 10,
          border: `1px solid ${withAlpha(tint, 0.35)}`,
        }}
      >
        <Icon
          name={CategoryCatalog.iconNameFor(line.prediction.categoryKey)}
          size={15}
          color={tint}
        />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="ellipsis"
          style={{ color: WebTokens.textPrimary, fontWeight: 700, fontSize: 13 }}
        >
          {line.prediction.title}
        </div>
        <div
          className="ellipsis"
          style={{ marginTop: 2, color: tint, fontWeight: 700, fontSize: 12 }}
        >
          {line.option.label}
        </div>
      </div>
      {line.prediction.entryFee > 0 && (
        <CoinAmount amount={-line.prediction.entryFee} fontSize={12.5} />
      )}
    </div>
  );
}

function Line({
  label,
  amount,
  signed = true,
  emphasize = false,
  danger = false,
}: {
  label: string;
  amount: number;
  signed?: boolean;
  emphasize?: boolean;
  danger?: boolean;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span
        style={{
          color: emphasize ? WebTokens.textPrimary : WebTokens.textSecondary,
          fontSize: emphasize ? 14 : 13,
          fontWeight: emphasize ? 700 : 500,
        }}
      >
        {label}
      </span>
      {signed ? (
        <CoinAmount amount={amount} fontSize={emphasize ? 15 : 14} />
      ) : (
        <span
          style={{
            color: danger ? WebTokens.danger : WebTokens.textPrimary,
            fontWeight: 700,
            fontSize: emphasize ? 15 : 14,
          }}
        >
          {amount}
        </span>
      )}
    </div>
  );
}
