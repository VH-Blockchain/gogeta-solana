import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import HistoryRounded from '@mui/icons-material/HistoryRounded';
import EmojiEventsRounded from '@mui/icons-material/EmojiEventsRounded';
import SentimentNeutralRounded from '@mui/icons-material/SentimentNeutralRounded';
import HourglassEmptyRounded from '@mui/icons-material/HourglassEmptyRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import WifiOff from '@mui/icons-material/WifiOff';
import type { QuizHistoryItem } from '@/data/models';
import { Routes } from '@/router/routes';
import { useQuizStore } from '@/store/quizStore';
import { WebTokens, withAlpha } from '@/theme/webTokens';
import { GlowButton } from '@/components/GlowButton';
import { EmptyState } from '@/components/Primitives';
import { SkeletonCard } from '@/components/Skeleton';
import { WebCard } from '@/components/WebCard';
import { quizCategoryIcon, quizCategoryTint } from './categoryStyle';

/**
 * Quiz history (§6): every past attempt with its score, points and outcome.
 * A row opens the full graded detail — the same review screen the result shows,
 * read through the history endpoint.
 */
export function QuizHistorySection({ containerWidth }: { containerWidth: number }) {
  const navigate = useNavigate();
  const history = useQuizStore((s) => s.history);
  const total = useQuizStore((s) => s.historyTotal);
  const loading = useQuizStore((s) => s.historyLoading);
  const error = useQuizStore((s) => s.historyError);
  const loadHistory = useQuizStore((s) => s.loadHistory);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  if (error) {
    return (
      <WebCard>
        <EmptyState
          icon={<WifiOff />}
          title="Could not load your history"
          subtitle={error}
          action={<GlowButton label="Try again" height={46} onClick={() => void loadHistory()} />}
        />
      </WebCard>
    );
  }

  if (loading && history.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {Array.from({ length: 3 }, (_, i) => (
          <SkeletonCard key={i} height={86} />
        ))}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <WebCard>
        <EmptyState
          icon={<HistoryRounded />}
          title="No quizzes played yet"
          subtitle="Join a category and your results will appear here."
          action={<GlowButton label="Pick a category" height={46} onClick={() => navigate(Routes.quiz)} />}
        />
      </WebCard>
    );
  }

  const narrow = containerWidth > 0 && containerWidth < 620;

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {history.map((item) => (
          <HistoryRow
            key={item.id}
            item={item}
            narrow={narrow}
            onOpen={() =>
              navigate(`${Routes.quizResult}/${item.quizId}?attempt=${item.id}`)
            }
          />
        ))}
      </div>
      {total > history.length && (
        <p style={{ marginTop: 16, color: WebTokens.textMuted, fontSize: 12.5, textAlign: 'center' }}>
          Showing your {history.length} most recent of {total} quizzes.
        </p>
      )}
    </div>
  );
}

function HistoryRow({
  item,
  narrow,
  onOpen,
}: {
  item: QuizHistoryItem;
  narrow: boolean;
  onOpen: () => void;
}) {
  const tint = quizCategoryTint(item.category);
  // A finished session can be read before settlement lands, so "pending" is a
  // real state — not every row has a win/loss yet.
  const pending = !item.settled;
  const statusColor = pending
    ? WebTokens.textMuted
    : item.won
      ? WebTokens.gold
      : WebTokens.textSecondary;

  return (
    <WebCard padding={narrow ? 16 : '18px 20px'} hoverLift onClick={onOpen}>
      <div
        style={{
          display: 'flex',
          flexDirection: narrow ? 'column' : 'row',
          alignItems: narrow ? 'stretch' : 'center',
          gap: narrow ? 14 : 18,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, flex: 1, minWidth: 0 }}>
          <span
            style={{
              width: 40,
              height: 40,
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: withAlpha(tint, 0.14),
              border: `1px solid ${withAlpha(tint, 0.32)}`,
              borderRadius: 12,
              color: tint,
            }}
          >
            {quizCategoryIcon(item.category)}
          </span>
          <div style={{ minWidth: 0 }}>
            <p className="t-title-medium" style={{ fontSize: 15 }}>
              {item.categoryLabel}
            </p>
            <p style={{ marginTop: 3, color: WebTokens.textMuted, fontSize: 12 }}>
              {formatPlayedAt(item.playedAtMs)} · session #{item.slotIndex}
            </p>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: narrow ? 12 : 20,
          }}
        >
          <Metric
            value={`${item.score}/${item.totalQuestions}`}
            label={`${item.percentage}%`}
          />
          <Metric
            value={`${item.correctAnswers} / ${item.wrongAnswers} / ${item.unanswered}`}
            label="right / wrong / missed"
          />
          <Metric
            value={`${item.netPoints >= 0 ? '+' : ''}${item.netPoints}`}
            label={`−${item.pointsSpent} entry, +${item.pointsEarned} reward`}
            color={item.netPoints > 0 ? WebTokens.accent : item.netPoints < 0 ? WebTokens.danger : undefined}
          />

          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 11px',
              background: withAlpha(statusColor, 0.12),
              border: `1px solid ${withAlpha(statusColor, 0.3)}`,
              borderRadius: 999,
              color: statusColor,
              fontSize: 11.5,
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            {pending ? (
              <>
                <HourglassEmptyRounded style={{ fontSize: 13 }} /> Pending
              </>
            ) : item.won ? (
              <>
                <EmojiEventsRounded style={{ fontSize: 13 }} /> Won
              </>
            ) : (
              <>
                <SentimentNeutralRounded style={{ fontSize: 13 }} /> Lost
              </>
            )}
          </span>

          {!narrow && (
            <span style={{ color: WebTokens.textMuted, display: 'inline-flex' }}>
              <ChevronRightRounded />
            </span>
          )}
        </div>
      </div>
    </WebCard>
  );
}

function Metric({
  value,
  label,
  color,
}: {
  value: string;
  label: string;
  color?: string;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        className="f-opensans"
        style={{
          color: color ?? WebTokens.textPrimary,
          fontSize: 14.5,
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </div>
      <div style={{ marginTop: 2, color: WebTokens.textMuted, fontSize: 11 }}>{label}</div>
    </div>
  );
}

/** "18 Aug, 6:15 PM" — the played-at stamp §6 asks for. */
function formatPlayedAt(msValue: number): string {
  if (!msValue) return '—';
  return new Date(msValue).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}
