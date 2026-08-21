import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import CancelRounded from '@mui/icons-material/CancelRounded';
import RemoveCircleOutlineRounded from '@mui/icons-material/RemoveCircleOutlineRounded';
import EmojiEventsRounded from '@mui/icons-material/EmojiEventsRounded';
import SentimentNeutralRounded from '@mui/icons-material/SentimentNeutralRounded';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import ReplayRounded from '@mui/icons-material/ReplayRounded';
import WifiOff from '@mui/icons-material/WifiOff';
import LightbulbOutlined from '@mui/icons-material/LightbulbOutlined';
import { isApiException } from '@/core/network/apiException';
import { QuizRepository } from '@/data/api/quizRepository';
import type { QuizResultView, QuizReviewQuestion } from '@/data/models';
import { Routes } from '@/router/routes';
import { useQuizStore } from '@/store/quizStore';
import { WebTokens, cardShadow, withAlpha } from '@/theme/webTokens';
import { ConfettiBurst } from '@/components/Confetti';
import { GaugeArc } from '@/components/GaugeRing';
import { GlowButton } from '@/components/GlowButton';
import { EmptyState, pagePadding } from '@/components/Primitives';
import { Reveal } from '@/components/Reveal';
import { WebCard } from '@/components/WebCard';
import { useElementWidth } from '@/hooks/useElementWidth';
import { useWindowWidth } from '@/hooks/useWindowWidth';
import { OPTION_LETTERS, quizCategoryTint } from './categoryStyle';

const CONFETTI_COLORS = [WebTokens.accent, WebTokens.gold, WebTokens.violet];

/**
 * Result (§5). Every number here is the backend's — score, percentage, points
 * spent and earned, and win/loss are all read from the graded payload, never
 * computed locally.
 *
 * Doubles as the history detail view: `/quiz/result/:quizId` grades on demand,
 * and `?attempt=<participationId>` reads a past attempt through the history
 * endpoint. Both return the same shape.
 */
export function QuizResultPage() {
  const { quizId = '' } = useParams();
  const [params] = useSearchParams();
  const attemptId = params.get('attempt');
  const navigate = useNavigate();
  const width = useWindowWidth();
  const [hostRef, hostWidth] = useElementWidth();

  const refreshBalance = useQuizStore((s) => s.refreshBalance);
  const loadActive = useQuizStore((s) => s.loadActive);
  const loadHistory = useQuizStore((s) => s.loadHistory);

  const [result, setResult] = useState<QuizResultView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const request = attemptId
      ? QuizRepository.historyDetail(attemptId)
      : QuizRepository.result(quizId);

    request
      .then((r) => {
        if (cancelled) return;
        setResult(r);
        // The reward is applied server-side during settlement, so the balance in
        // the store is stale by exactly this much — refresh it rather than doing
        // arithmetic on a number the client does not own.
        void refreshBalance();
        void loadActive();
        void loadHistory();
      })
      .catch((e) => {
        if (cancelled) return;
        setError(isApiException(e) ? e.message : 'Could not load your result.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [quizId, attemptId, refreshBalance, loadActive, loadHistory]);

  const padding = pagePadding(width);
  const narrow = hostWidth > 0 && hostWidth < WebTokens.bpTablet;

  const summary = result?.summary;
  const won = summary?.won === true;
  const tint = result ? quizCategoryTint(result.category) : WebTokens.accent;

  const breakdown = useMemo(
    () =>
      summary
        ? [
            { label: 'Correct', value: summary.correctAnswers, color: WebTokens.accent, icon: <CheckCircleRounded style={{ fontSize: 17 }} /> },
            { label: 'Wrong', value: summary.wrongAnswers, color: WebTokens.danger, icon: <CancelRounded style={{ fontSize: 17 }} /> },
            { label: 'Unanswered', value: summary.unanswered, color: WebTokens.textMuted, icon: <RemoveCircleOutlineRounded style={{ fontSize: 17 }} /> },
          ]
        : [],
    [summary],
  );

  if (loading) {
    return (
      <div style={{ padding }} ref={hostRef}>
        <WebCard>
          <EmptyState icon={<EmojiEventsRounded />} title="Loading your result…" />
        </WebCard>
      </div>
    );
  }

  if (error || !result || !summary) {
    return (
      <div style={{ padding }} ref={hostRef}>
        <WebCard>
          <EmptyState
            icon={<WifiOff />}
            title="Result unavailable"
            subtitle={error ?? 'We could not find that quiz attempt.'}
            action={
              <GlowButton
                label="Back to Quiz"
                height={46}
                icon={<ArrowBackRounded style={{ fontSize: 17 }} />}
                onClick={() => navigate(Routes.quiz)}
              />
            }
          />
        </WebCard>
      </div>
    );
  }

  return (
    <div style={{ padding }} ref={hostRef}>
      <Reveal duration={350} y={0.05}>
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            padding: narrow ? '24px 20px' : '30px 32px',
            background: `linear-gradient(135deg, ${withAlpha(won ? WebTokens.gold : WebTokens.blue, 0.16)}, ${withAlpha(tint, 0.06)})`,
            border: `${WebTokens.borderWidth}px solid ${WebTokens.glassStroke}`,
            borderRadius: WebTokens.radiusCard,
            boxShadow: cardShadow,
          }}
        >
          {won && <ConfettiBurst colors={CONFETTI_COLORS} />}

          <div
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: narrow ? 'column' : 'row',
              alignItems: narrow ? 'flex-start' : 'center',
              gap: narrow ? 22 : 32,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: WebTokens.textMuted, fontSize: 12, letterSpacing: 0.4 }}>
                {result.categoryLabel.toUpperCase()} QUIZ
              </p>
              <h1 className="t-headline-medium" style={{ marginTop: 8 }}>
                Quiz Complete!
              </h1>

              <div
                style={{
                  marginTop: 16,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: '9px 15px',
                  background: withAlpha(won ? WebTokens.gold : WebTokens.textMuted, 0.14),
                  border: `1px solid ${withAlpha(won ? WebTokens.gold : WebTokens.textMuted, 0.35)}`,
                  borderRadius: 999,
                  color: won ? WebTokens.gold : WebTokens.textSecondary,
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                {won ? (
                  <>
                    <EmojiEventsRounded style={{ fontSize: 18 }} /> You Won!
                  </>
                ) : (
                  <>
                    <SentimentNeutralRounded style={{ fontSize: 18 }} /> Not this time
                  </>
                )}
              </div>

              <p style={{ marginTop: 12, color: WebTokens.textSecondary, fontSize: 13 }}>
                {won
                  ? `You scored above ${result.winPercent}% and earned the reward.`
                  : `You needed more than ${result.winPercent}% to win this one.`}
              </p>

              <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <PointsChip label="Entry" amount={-summary.pointsSpent} />
                <PointsChip label="Reward" amount={summary.pointsEarned} />
                <PointsChip label="Net" amount={summary.netPoints} emphasise />
              </div>
            </div>

            {/* Score gauge — the percentage the backend calculated. */}
            <div style={{ position: 'relative', width: 158, height: 158, flexShrink: 0 }}>
              <GaugeArc
                value={summary.percentage / 100}
                color={won ? WebTokens.gold : tint}
                size={158}
                strokeWidth={11}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span
                  className="f-opensans"
                  style={{ fontSize: 34, fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}
                >
                  {summary.score}
                  <span style={{ color: WebTokens.textMuted, fontSize: 20 }}>
                    /{summary.totalQuestions}
                  </span>
                </span>
                <span
                  className="f-opensans"
                  style={{ marginTop: 6, color: won ? WebTokens.gold : tint, fontSize: 16, fontWeight: 600 }}
                >
                  {summary.percentage}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      <div style={{ height: 18 }} />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${hostWidth > 0 && hostWidth < 520 ? 1 : 3}, minmax(0, 1fr))`,
          gap: 14,
        }}
      >
        {breakdown.map((b) => (
          <WebCard key={b.label} padding={18}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span
                style={{
                  width: 38,
                  height: 38,
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: withAlpha(b.color, 0.14),
                  border: `1px solid ${withAlpha(b.color, 0.3)}`,
                  borderRadius: 11,
                  color: b.color,
                }}
              >
                {b.icon}
              </span>
              <div style={{ minWidth: 0 }}>
                <div
                  className="f-opensans"
                  style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}
                >
                  {b.value}
                </div>
                <div style={{ marginTop: 2, color: WebTokens.textMuted, fontSize: 12 }}>{b.label}</div>
              </div>
            </div>
          </WebCard>
        ))}
      </div>

      <div style={{ height: 26 }} />

      <h2 className="t-title-large">Answer review</h2>
      <p style={{ marginTop: 6, color: WebTokens.textSecondary, fontSize: 13 }}>
        The correct answer and a short explanation for every question.
      </p>

      <div style={{ height: 16 }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {result.questions.map((q) => (
          <ReviewCard key={q.index} question={q} />
        ))}
      </div>

      <div style={{ height: 26 }} />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <GlowButton
          label="Play another quiz"
          height={48}
          icon={<ReplayRounded style={{ fontSize: 18 }} />}
          onClick={() => navigate(Routes.quiz)}
        />
        <button
          type="button"
          onClick={() => navigate(`${Routes.quiz}?tab=history`)}
          style={{
            height: 48,
            padding: '0 20px',
            background: 'transparent',
            border: `1px solid ${WebTokens.glassStroke}`,
            borderRadius: WebTokens.radiusControl,
            color: WebTokens.textSecondary,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          View quiz history
        </button>
      </div>
    </div>
  );
}

function PointsChip({
  label,
  amount,
  emphasise = false,
}: {
  label: string;
  amount: number;
  emphasise?: boolean;
}) {
  const positive = amount > 0;
  const color = amount === 0 ? WebTokens.textSecondary : positive ? WebTokens.accent : WebTokens.danger;
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 8,
        padding: '10px 14px',
        background: emphasise ? withAlpha(color, 0.12) : 'rgba(255,255,255,0.04)',
        border: `1px solid ${emphasise ? withAlpha(color, 0.32) : WebTokens.glassStroke}`,
        borderRadius: 12,
      }}
    >
      <span style={{ color: WebTokens.textMuted, fontSize: 12 }}>{label}</span>
      <span
        className="f-opensans"
        style={{ color, fontSize: 15, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
      >
        {positive ? '+' : ''}
        {amount} points
      </span>
    </div>
  );
}

/** One graded question: every option marked, plus the explanation. */
function ReviewCard({ question: q }: { question: QuizReviewQuestion }) {
  const missed = !q.answered;
  const statusColor = q.isCorrect
    ? WebTokens.accent
    : missed
      ? WebTokens.textMuted
      : WebTokens.danger;

  return (
    <WebCard padding={20} accentBorder={withAlpha(statusColor, 0.3)}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span
          style={{
            width: 26,
            height: 26,
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: withAlpha(statusColor, 0.14),
            border: `1px solid ${withAlpha(statusColor, 0.32)}`,
            borderRadius: 8,
            color: statusColor,
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {q.number}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14.5, lineHeight: 1.45 }}>{q.question}</p>
        </div>
        <span
          style={{
            flexShrink: 0,
            padding: '4px 9px',
            background: withAlpha(statusColor, 0.12),
            border: `1px solid ${withAlpha(statusColor, 0.3)}`,
            borderRadius: 999,
            color: statusColor,
            fontSize: 11,
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          {q.isCorrect ? 'Correct' : missed ? 'No answer' : 'Wrong'}
        </span>
      </div>

      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {q.options.map((label, i) => {
          const isCorrect = q.correctIndex === i;
          const isMine = q.selectedIndex === i;
          // Green marks the right answer whether or not it was picked; red only
          // marks a wrong pick.
          const color = isCorrect ? WebTokens.accent : isMine ? WebTokens.danger : null;
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 11,
                padding: '10px 13px',
                background: color ? withAlpha(color, 0.09) : 'rgba(255,255,255,0.02)',
                border: `1px solid ${color ? withAlpha(color, 0.32) : WebTokens.glassStroke}`,
                borderRadius: WebTokens.radiusControl,
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: color ? withAlpha(color, 0.18) : 'rgba(255,255,255,0.05)',
                  borderRadius: 7,
                  color: color ?? WebTokens.textMuted,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {OPTION_LETTERS[i]}
              </span>
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  color: color ?? WebTokens.textSecondary,
                  fontSize: 13.5,
                }}
              >
                {label}
              </span>
              {isMine && (
                <span style={{ flexShrink: 0, color: color ?? WebTokens.textMuted, fontSize: 11 }}>
                  your answer
                </span>
              )}
              {isCorrect && !isMine && (
                <span style={{ flexShrink: 0, color: WebTokens.accent, fontSize: 11 }}>
                  correct answer
                </span>
              )}
            </div>
          );
        })}
      </div>

      {q.explanation && (
        <div
          style={{
            marginTop: 13,
            display: 'flex',
            gap: 9,
            padding: '11px 13px',
            background: 'rgba(255,255,255,0.025)',
            border: `1px solid ${WebTokens.glassStroke}`,
            borderRadius: WebTokens.radiusControl,
          }}
        >
          <span style={{ color: WebTokens.gold, display: 'inline-flex', flexShrink: 0 }}>
            <LightbulbOutlined style={{ fontSize: 16 }} />
          </span>
          <span style={{ color: WebTokens.textSecondary, fontSize: 12.5, lineHeight: 1.5 }}>
            {q.explanation}
          </span>
        </div>
      )}
    </WebCard>
  );
}
