import { useState } from 'react';
import CloseRounded from '@mui/icons-material/CloseRounded';
import ScheduleRounded from '@mui/icons-material/ScheduleRounded';
import HelpOutlineRounded from '@mui/icons-material/HelpOutlineRounded';
import EmojiEventsRounded from '@mui/icons-material/EmojiEventsRounded';
import { isApiException } from '@/core/network/apiException';
import type { QuizCategoryInfo, QuizRules } from '@/data/models';
import { useUserStore } from '@/store/userStore';
import { WebTokens, withAlpha } from '@/theme/webTokens';
import { GlowButton } from '@/components/GlowButton';
import { DialogCard, Modal } from '@/components/Modal';
import { quizCategoryTint } from './categoryStyle';
import { formatCountdown } from './useServerClock';

/**
 * Entry confirmation (§2): states the cost, the user's balance and what they
 * are joining before any points move.
 *
 * The button is disabled when the balance is short, but that is a courtesy — the
 * backend rejects an underfunded join on its own, and this dialog surfaces
 * whatever message it returns rather than guessing.
 */
export function QuizJoinDialog({
  category,
  rules,
  startsInMs,
  onClose,
  onConfirm,
}: {
  category: QuizCategoryInfo | null;
  rules: QuizRules | null;
  startsInMs: number;
  onClose: () => void;
  /** Resolves once the join succeeded; throws to surface a server message. */
  onConfirm: (category: QuizCategoryInfo) => Promise<void>;
}) {
  const coins = useUserStore((s) => s.user.coins);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = category != null && rules != null;
  const entry = rules?.entryPoints ?? 0;
  const affordable = coins >= entry;
  const tint = category ? quizCategoryTint(category.key) : WebTokens.accent;

  async function confirm() {
    if (!category) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(category);
    } catch (e) {
      setError(isApiException(e) ? e.message : 'Could not join. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!busy}
      labelledBy="quiz-join-title"
    >
      {open && (
        <DialogCard maxWidth={440}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <h2 id="quiz-join-title" className="t-title-large" style={{ flex: 1, fontSize: 20 }}>
              Join {category.label} Quiz?
            </h2>
            <button
              type="button"
              aria-label="Close"
              onClick={busy ? undefined : onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: WebTokens.textMuted,
                cursor: busy ? 'default' : 'pointer',
                display: 'inline-flex',
                padding: 2,
              }}
            >
              <CloseRounded fontSize="small" />
            </button>
          </div>

          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Row label="Entry Fee" value={entry === 0 ? 'Free' : `${entry} Points`} tint={tint} strong />
            <Row
              label="Your Balance"
              value={`${coins.toLocaleString()} Points`}
              tint={affordable ? WebTokens.textPrimary : WebTokens.danger}
              strong
            />
          </div>

          <div
            style={{
              marginTop: 16,
              padding: 14,
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${WebTokens.glassStroke}`,
              borderRadius: WebTokens.radiusControl,
              display: 'flex',
              flexDirection: 'column',
              gap: 9,
            }}
          >
            <Detail
              icon={<HelpOutlineRounded style={{ fontSize: 16 }} />}
              text={`${rules.questionsPerQuiz} questions · ${rules.secondsPerQuestion} seconds each`}
            />
            <Detail
              icon={<ScheduleRounded style={{ fontSize: 16 }} />}
              text={
                startsInMs > 0
                  ? `Starts in ${formatCountdown(startsInMs)} — you must join before it begins`
                  : 'Starting now'
              }
            />
            <Detail
              icon={<EmojiEventsRounded style={{ fontSize: 16 }} />}
              text={`Score above ${rules.winPercent}% to win ${rules.rewardPoints} points`}
            />
          </div>

          {!affordable && (
            <p style={{ marginTop: 14, color: WebTokens.danger, fontSize: 13 }}>
              You need {entry - coins} more point{entry - coins === 1 ? '' : 's'} to join this quiz.
            </p>
          )}
          {error && (
            <p style={{ marginTop: 14, color: WebTokens.danger, fontSize: 13 }}>{error}</p>
          )}

          <div
            style={{
              marginTop: 20,
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <button
              type="button"
              onClick={busy ? undefined : onClose}
              style={{
                height: 46,
                padding: '0 18px',
                background: 'transparent',
                border: `1px solid ${WebTokens.glassStroke}`,
                borderRadius: WebTokens.radiusControl,
                color: WebTokens.textSecondary,
                fontSize: 14,
                cursor: busy ? 'default' : 'pointer',
              }}
            >
              Cancel
            </button>
            <GlowButton
              label="Join Quiz"
              busy={busy}
              height={46}
              glowColor={tint}
              onClick={affordable ? confirm : null}
            />
          </div>
        </DialogCard>
      )}
    </Modal>
  );
}

function Row({
  label,
  value,
  tint,
  strong = false,
}: {
  label: string;
  value: string;
  tint: string;
  strong?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ color: WebTokens.textSecondary, fontSize: 13 }}>{label}</span>
      <span
        className="f-opensans"
        style={{
          color: tint,
          fontSize: strong ? 17 : 14,
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Detail({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <span style={{ color: withAlpha(WebTokens.textSecondary, 0.9), display: 'inline-flex' }}>
        {icon}
      </span>
      <span style={{ color: WebTokens.textSecondary, fontSize: 12.5 }}>{text}</span>
    </div>
  );
}
