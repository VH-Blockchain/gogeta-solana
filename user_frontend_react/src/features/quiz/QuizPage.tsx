import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import QuizRounded from '@mui/icons-material/QuizRounded';
import ScheduleRounded from '@mui/icons-material/ScheduleRounded';
import EmojiEventsRounded from '@mui/icons-material/EmojiEventsRounded';
import BoltRounded from '@mui/icons-material/BoltRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import PlayArrowRounded from '@mui/icons-material/PlayArrowRounded';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import HourglassEmptyRounded from '@mui/icons-material/HourglassEmptyRounded';
import WifiOff from '@mui/icons-material/WifiOff';
import HistoryRounded from '@mui/icons-material/HistoryRounded';
import { Routes } from '@/router/routes';
import type { QuizCategoryInfo } from '@/data/models';
import { useQuizStore } from '@/store/quizStore';
import { WebTokens, cardShadow, withAlpha } from '@/theme/webTokens';
import { GlowButton } from '@/components/GlowButton';
import { HeroBackgroundArt } from '@/components/HeroArt';
import { HeroStat, LiveEyebrow } from '@/components/HeroStat';
import { EmptyState, pagePadding } from '@/components/Primitives';
import { Reveal } from '@/components/Reveal';
import { SkeletonCard } from '@/components/Skeleton';
import { WebCard } from '@/components/WebCard';
import { useElementWidth } from '@/hooks/useElementWidth';
import { useWindowWidth } from '@/hooks/useWindowWidth';
import { QuizHistorySection } from './QuizHistorySection';
import { QuizJoinDialog } from './QuizJoinDialog';
import { quizCategoryIcon, quizCategoryTint } from './categoryStyle';
import { formatCountdown, useServerClock } from './useServerClock';

/**
 * Quiz landing (§1, §14): the four categories with their live pool sizes, the
 * countdown to the next session, and the user's own history.
 *
 * Questions are never hard-coded here — every count and every rule comes from
 * the backend, so adding questions or changing the entry fee in the admin panel
 * shows up without a frontend change.
 */
export function QuizPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const width = useWindowWidth();
  const [hostRef, hostWidth] = useElementWidth();

  const lobby = useQuizStore((s) => s.lobby);
  const lobbyLoading = useQuizStore((s) => s.lobbyLoading);
  const lobbyError = useQuizStore((s) => s.lobbyError);
  const active = useQuizStore((s) => s.active);
  const serverNowMs = useQuizStore((s) => s.serverNowMs);
  const loadLobby = useQuizStore((s) => s.loadLobby);
  const loadActive = useQuizStore((s) => s.loadActive);
  const loadHistory = useQuizStore((s) => s.loadHistory);
  const join = useQuizStore((s) => s.join);

  const [joinTarget, setJoinTarget] = useState<QuizCategoryInfo | null>(null);

  const tab = params.get('tab') === 'history' ? 1 : 0;
  const nowMs = useServerClock(serverNowMs);

  useEffect(() => {
    void loadLobby();
    void loadActive();
    void loadHistory();
  }, [loadLobby, loadActive, loadHistory]);

  // The countdown runs out on its own, so re-sync when the slot should have
  // rolled over rather than polling on a short fixed interval.
  const opensAtMs = lobby?.nextQuiz.startsAtMs ?? 0;
  useEffect(() => {
    if (!opensAtMs) return;
    const delay = Math.max(2000, opensAtMs - nowMs + 1500);
    const id = setTimeout(() => {
      void loadLobby();
      void loadActive();
    }, delay);
    return () => clearTimeout(id);
    // nowMs deliberately excluded — including it would reschedule every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opensAtMs, loadLobby, loadActive]);

  const changeTab = (i: number) => {
    const next = new URLSearchParams(params);
    if (i === 1) next.set('tab', 'history');
    else next.delete('tab');
    setParams(next);
  };

  const openInMs = Math.max(0, opensAtMs - nowMs);
  const rules = lobby?.rules ?? null;

  const confirmJoin = useCallback(
    async (category: QuizCategoryInfo) => {
      const r = await join(category.key);
      setJoinTarget(null);
      if (r) navigate(`${Routes.quizPlay}/${r.quizId}`);
    },
    [join, navigate],
  );

  /**
   * A session already in progress (or finished but unread) takes priority over
   * the lobby — it is the only thing the user can act on right now, and landing
   * here after a refresh mid-quiz must not look like the quiz was lost.
   */
  const resumeBanner = useMemo(() => {
    if (!active) return null;
    const { quiz, phase, resultReady } = active;
    const tint = quizCategoryTint(quiz.category);
    const playing = phase === 'running';
    return (
      <WebCard padding={hostWidth > 0 && hostWidth < 560 ? 18 : '20px 22px'} accentBorder={tint} glow={tint}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: tint, display: 'inline-flex' }}>
                {playing ? <PlayArrowRounded /> : resultReady ? <EmojiEventsRounded /> : <HourglassEmptyRounded />}
              </span>
              <span className="t-title-medium">
                {playing
                  ? `${quiz.categoryLabel} quiz is live`
                  : resultReady
                    ? `${quiz.categoryLabel} quiz has finished`
                    : `You're in the next ${quiz.categoryLabel} quiz`}
              </span>
            </div>
            <p style={{ marginTop: 6, color: WebTokens.textSecondary, fontSize: 13 }}>
              {playing
                ? 'Answer the open question before its timer runs out.'
                : resultReady
                  ? 'Your score is ready to view.'
                  : `Starts in ${formatCountdown(Math.max(0, quiz.startsAtMs - nowMs))} — keep this page open.`}
            </p>
          </div>
          <GlowButton
            label={playing ? 'Continue quiz' : resultReady ? 'View result' : 'Open quiz'}
            glowColor={tint}
            height={46}
            icon={resultReady ? <EmojiEventsRounded style={{ fontSize: 17 }} /> : <BoltRounded style={{ fontSize: 17 }} />}
            onClick={() =>
              navigate(
                resultReady
                  ? `${Routes.quizResult}/${quiz.id}`
                  : `${Routes.quizPlay}/${quiz.id}`,
              )
            }
          />
        </div>
      </WebCard>
    );
  }, [active, hostWidth, navigate, nowMs]);

  const padding = pagePadding(width);
  const narrow = hostWidth > 0 && hostWidth < WebTokens.bpTablet;

  return (
    <div style={{ padding }} ref={hostRef}>
      <Reveal duration={350} y={0.05}>
        <QuizHero
          openInMs={openInMs}
          rules={rules}
          questionTotal={(lobby?.categories ?? []).reduce((s, c) => s + c.questionCount, 0)}
          narrow={narrow}
        />
      </Reveal>

      {resumeBanner && (
        <>
          <div style={{ height: 20 }} />
          <Reveal duration={350} y={0.04}>
            {resumeBanner}
          </Reveal>
        </>
      )}

      <div style={{ height: 24 }} />

      <div
        style={{
          display: 'flex',
          flexDirection: narrow ? 'column' : 'row',
          alignItems: narrow ? 'flex-start' : 'center',
          gap: 14,
        }}
      >
        <h2 className="t-title-large" style={{ flex: 1, minWidth: 0 }}>
          {tab === 0 ? 'Pick a category' : 'Your quiz history'}
        </h2>
        <QuizTabs index={tab} onChange={changeTab} />
      </div>

      <div style={{ height: 20 }} />

      {tab === 1 ? (
        <QuizHistorySection containerWidth={hostWidth} />
      ) : lobbyError ? (
        <WebCard>
          <EmptyState
            icon={<WifiOff />}
            title="Could not load the quiz"
            subtitle={lobbyError}
            action={<GlowButton label="Try again" height={46} onClick={() => void loadLobby()} />}
          />
        </WebCard>
      ) : lobbyLoading && !lobby ? (
        <CategorySkeletons containerWidth={hostWidth} />
      ) : !rules?.enabled ? (
        <WebCard>
          <EmptyState
            icon={<HourglassEmptyRounded />}
            title="Quizzes are paused"
            subtitle="New sessions aren't running right now. Please check back soon."
          />
        </WebCard>
      ) : (
        <CategoryGrid
          categories={lobby?.categories ?? []}
          rules={rules}
          openInMs={openInMs}
          containerWidth={hostWidth}
          onPick={setJoinTarget}
          onOpenJoined={(c) => {
            const activeQuiz = active?.quiz;
            if (activeQuiz && activeQuiz.category === c.key) {
              navigate(`${Routes.quizPlay}/${activeQuiz.id}`);
            }
          }}
        />
      )}

      <QuizJoinDialog
        category={joinTarget}
        rules={rules}
        startsInMs={openInMs}
        onClose={() => setJoinTarget(null)}
        onConfirm={confirmJoin}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

function QuizHero({
  openInMs,
  rules,
  questionTotal,
  narrow,
}: {
  openInMs: number;
  rules: { entryPoints: number; rewardPoints: number; questionsPerQuiz: number; secondsPerQuestion: number; durationSeconds: number; winPercent: number } | null;
  questionTotal: number;
  narrow: boolean;
}) {
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        padding: narrow ? '22px 20px' : '28px 32px',
        background: `linear-gradient(135deg, ${withAlpha(WebTokens.violet, 0.16)}, ${withAlpha(WebTokens.accent, 0.08)})`,
        border: `${WebTokens.borderWidth}px solid ${WebTokens.glassStroke}`,
        borderRadius: WebTokens.radiusCard,
        boxShadow: cardShadow,
      }}
    >
      <HeroBackgroundArt icon={<QuizRounded sx={{ fontSize: 340 }} />} />
      <div style={{ position: 'relative' }}>
        <LiveEyebrow label="Live every few minutes" />
        <h1 className="t-headline-medium" style={{ marginTop: 12 }}>
          Quiz
        </h1>
        <p
          style={{
            marginTop: 8,
            maxWidth: 560,
            color: WebTokens.textSecondary,
            fontSize: 14,
          }}
        >
          {rules
            ? `${rules.questionsPerQuiz} questions, ${rules.secondsPerQuestion} seconds each. Score above ${rules.winPercent}% to win ${rules.rewardPoints} points.`
            : 'Answer against the clock and win points.'}
        </p>

        <div style={{ marginTop: 18, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <HeroStat
            icon={<ScheduleRounded />}
            value={openInMs > 0 ? formatCountdown(openInMs) : '—'}
            label="until next quiz"
            tint={WebTokens.accent}
          />
          <HeroStat
            icon={<QuizRounded />}
            value={questionTotal > 0 ? String(questionTotal) : '—'}
            label="questions"
            tint={WebTokens.violet}
          />
          {rules && (
            <>
              <HeroStat
                icon={<BoltRounded />}
                value={rules.entryPoints === 0 ? 'Free' : String(rules.entryPoints)}
                label="to enter"
                tint={WebTokens.blue}
              />
              <HeroStat
                icon={<EmojiEventsRounded />}
                value={`+${rules.rewardPoints}`}
                label="if you win"
                tint={WebTokens.gold}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

function QuizTabs({ index, onChange }: { index: number; onChange: (i: number) => void }) {
  const labels: [string, React.ReactNode][] = [
    ['Categories', <QuizRounded key="c" style={{ fontSize: 16 }} />],
    ['History', <HistoryRounded key="h" style={{ fontSize: 16 }} />],
  ];
  return (
    <div
      role="tablist"
      style={{
        display: 'inline-flex',
        padding: 4,
        gap: 4,
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${WebTokens.glassStroke}`,
        borderRadius: 999,
      }}
    >
      {labels.map(([label, icon], i) => {
        const selected = i === index;
        return (
          <button
            key={label}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(i)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '9px 16px',
              background: selected ? withAlpha(WebTokens.accent, 0.16) : 'transparent',
              border: 'none',
              borderRadius: 999,
              color: selected ? WebTokens.accent : WebTokens.textSecondary,
              fontSize: 13,
              fontWeight: selected ? 600 : 400,
              cursor: 'pointer',
              transition: 'background 150ms ease, color 150ms ease',
            }}
          >
            {icon}
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Category grid
// ---------------------------------------------------------------------------

/** 1 / 2 / 4 columns — four categories fit one desktop row exactly. */
function quizColumns(width: number): number {
  if (width <= 0) return 2;
  if (width < 520) return 1;
  if (width < 900) return 2;
  return 4;
}

function CategoryGrid({
  categories,
  rules,
  openInMs,
  containerWidth,
  onPick,
  onOpenJoined,
}: {
  categories: QuizCategoryInfo[];
  rules: { entryPoints: number; questionsPerQuiz: number };
  openInMs: number;
  containerWidth: number;
  onPick: (c: QuizCategoryInfo) => void;
  onOpenJoined: (c: QuizCategoryInfo) => void;
}) {
  const columns = quizColumns(containerWidth);
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: 16,
      }}
    >
      {categories.map((c) => (
        <CategoryCard
          key={c.key}
          category={c}
          rules={rules}
          openInMs={openInMs}
          onPick={onPick}
          onOpenJoined={onOpenJoined}
        />
      ))}
    </div>
  );
}

function CategoryCard({
  category,
  rules,
  openInMs,
  onPick,
  onOpenJoined,
}: {
  category: QuizCategoryInfo;
  rules: { entryPoints: number; questionsPerQuiz: number };
  openInMs: number;
  onPick: (c: QuizCategoryInfo) => void;
  onOpenJoined: (c: QuizCategoryInfo) => void;
}) {
  const tint = quizCategoryTint(category.key);
  const joined = category.joinedNext;
  // A pool smaller than one session's worth cannot produce a quiz — the backend
  // refuses with NO_QUESTIONS, so say so here instead of failing on tap.
  const playable = category.questionCount >= 1;

  return (
    <WebCard
      padding={20}
      hoverLift={playable}
      accentBorder={joined ? tint : undefined}
      onClick={playable ? () => (joined ? onOpenJoined(category) : onPick(category)) : undefined}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            style={{
              width: 42,
              height: 42,
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `linear-gradient(135deg, ${withAlpha(tint, 0.26)}, ${withAlpha(tint, 0.08)})`,
              border: `1px solid ${withAlpha(tint, 0.4)}`,
              borderRadius: 13,
              color: tint,
            }}
          >
            {quizCategoryIcon(category.key)}
          </span>
          {joined && (
            <span
              style={{
                marginLeft: 'auto',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 10px',
                background: withAlpha(tint, 0.14),
                border: `1px solid ${withAlpha(tint, 0.35)}`,
                borderRadius: 999,
                color: tint,
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              <CheckCircleRounded style={{ fontSize: 13 }} /> Joined
            </span>
          )}
        </div>

        <div>
          <p className="t-title-medium">{category.label}</p>
          <p
            className="f-opensans"
            style={{ marginTop: 4, color: WebTokens.textMuted, fontSize: 12.5 }}
          >
            {category.questionCount} question{category.questionCount === 1 ? '' : 's'}
          </p>
        </div>

        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {!playable ? (
            <span style={{ color: WebTokens.textMuted, fontSize: 12.5 }}>Coming soon</span>
          ) : joined ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                color: tint,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {openInMs > 0 ? `Starts in ${formatCountdown(openInMs)}` : 'Starting now'}
              <ArrowForwardRounded style={{ fontSize: 15 }} />
            </span>
          ) : (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                color: WebTokens.textSecondary,
                fontSize: 13,
              }}
            >
              {rules.entryPoints === 0 ? 'Free to enter' : `${rules.entryPoints} points to enter`}
              <ArrowForwardRounded style={{ fontSize: 15, color: tint }} />
            </span>
          )}
        </div>
      </div>
    </WebCard>
  );
}

function CategorySkeletons({ containerWidth }: { containerWidth: number }) {
  const columns = quizColumns(containerWidth);
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: 16,
      }}
    >
      {Array.from({ length: 4 }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
