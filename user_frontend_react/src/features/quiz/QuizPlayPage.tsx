import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ScheduleRounded from '@mui/icons-material/ScheduleRounded';
import CheckRounded from '@mui/icons-material/CheckRounded';
import LockClockRounded from '@mui/icons-material/LockClockRounded';
import HourglassEmptyRounded from '@mui/icons-material/HourglassEmptyRounded';
import BlockRounded from '@mui/icons-material/BlockRounded';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import { isApiException } from '@/core/network/apiException';
import { QuizRepository } from '@/data/api/quizRepository';
import type { QuizLiveQuestion, QuizPhase } from '@/data/models';
import { Routes } from '@/router/routes';
import { useQuizStore } from '@/store/quizStore';
import { WebTokens, cardShadow, withAlpha } from '@/theme/webTokens';
import { GlowButton } from '@/components/GlowButton';
import { EmptyState, pagePadding } from '@/components/Primitives';
import { WebCard } from '@/components/WebCard';
import { useElementWidth } from '@/hooks/useElementWidth';
import { useWindowWidth } from '@/hooks/useWindowWidth';
import { OPTION_LETTERS } from './categoryStyle';
import { formatCountdown, secondsLeft, useServerClock } from './useServerClock';

/**
 * Live play (§4). One question at a time, four options, a per-question timer
 * driven by the server clock, and automatic advance when a window closes.
 *
 * The timer here is presentation only. Whether an answer counts is decided
 * entirely by the backend against its own clock (§13) — this screen stops
 * accepting taps when the window closes, but a late request would be rejected
 * server-side anyway, and that rejection is what the user is shown.
 */
export function QuizPlayPage() {
  const { quizId = '' } = useParams();
  const navigate = useNavigate();
  const width = useWindowWidth();
  const [hostRef, hostWidth] = useElementWidth();

  const loadActive = useQuizStore((s) => s.loadActive);

  const [phase, setPhase] = useState<QuizPhase | null>(null);
  const [question, setQuestion] = useState<QuizLiveQuestion | null>(null);
  const [startsInMs, setStartsInMs] = useState(0);
  const [serverNowMs, setServerNowMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /** Locked-in choice for the question on screen, from this session or a reload. */
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // 250ms so a question boundary is never missed by more than a quarter second.
  const nowMs = useServerClock(serverNowMs, 250);

  // Which question the UI currently holds, so the fetch effect can tell a real
  // window change from a re-render.
  const shownIndexRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);

  const fetchQuestion = useCallback(async () => {
    if (!quizId || inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const r = await QuizRepository.question(quizId);
      setServerNowMs(r.serverNowMs);
      setPhase(r.phase);
      setError(null);
      if (r.question) {
        setQuestion(r.question);
        setSelectedIndex(r.question.mySelectedIndex);
        shownIndexRef.current = r.question.index;
      } else {
        setQuestion(null);
        shownIndexRef.current = null;
        // Only meaningful while the session is still scheduled — the waiting
        // view anchors its countdown to this server-measured span.
        setStartsInMs(r.startsInMs);
      }
    } catch (e) {
      const message = isApiException(e) ? e.message : 'Could not load the question.';
      // NOT_JOINED is terminal — polling harder will not fix it.
      if (isApiException(e) && (e.code === 'NOT_JOINED' || e.statusCode === 403)) {
        setFatal(message);
      } else {
        setError(message);
      }
    } finally {
      inFlightRef.current = false;
    }
  }, [quizId]);

  useEffect(() => {
    void fetchQuestion();
  }, [fetchQuestion]);

  /**
   * Advance at a question boundary: the open window has closed, so the next
   * question is due. Runs off the clock tick, with no timer of its own.
   */
  useEffect(() => {
    if (fatal || !question) return;
    if (phase === 'finished' || phase === 'cancelled') return;
    if (nowMs >= question.questionEndMs) void fetchQuestion();
  }, [nowMs, question, phase, fatal, fetchQuestion]);

  /**
   * Poll while there is nothing to show — waiting for the session to start, or
   * between windows.
   *
   * Deliberately NOT dependent on the clock tick: an interval recreated on every
   * 250ms tick is cleared before it can ever fire, which left this screen stuck
   * on "waiting" for the entire session.
   */
  useEffect(() => {
    if (fatal || question) return;
    if (phase === 'finished' || phase === 'cancelled') return;
    const id = setInterval(() => void fetchQuestion(), phase === 'scheduled' ? 1000 : 500);
    return () => clearInterval(id);
  }, [question, phase, fatal, fetchQuestion]);

  /** Finished — the result is the only thing left to show. */
  useEffect(() => {
    if (phase !== 'finished') return;
    void loadActive();
    const id = setTimeout(() => navigate(`${Routes.quizResult}/${quizId}`, { replace: true }), 600);
    return () => clearTimeout(id);
  }, [phase, quizId, navigate, loadActive]);

  async function answer(index: number) {
    if (!question || submitting || selectedIndex != null) return;
    // The window is closed as far as this screen can tell — don't send a request
    // the backend will only reject.
    if (nowMs > question.questionEndMs) return;

    setSubmitting(true);
    // Optimistic: the pick is locked visually at once, because the timer keeps
    // running and a round-trip's worth of "did that register?" is the worst
    // possible moment for doubt.
    setSelectedIndex(index);
    try {
      const r = await QuizRepository.answer(quizId, question.id, index);
      setServerNowMs(r.serverNowMs);
    } catch (e) {
      const message = isApiException(e) ? e.message : 'Could not submit that answer.';
      // ALREADY_ANSWERED means the pick did land (a double tap, or a replay) —
      // keep it shown. Anything else, hand the choice back.
      if (!(isApiException(e) && e.code === 'ALREADY_ANSWERED')) {
        setSelectedIndex(null);
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const padding = pagePadding(width);
  const narrow = hostWidth > 0 && hostWidth < WebTokens.bpTablet;

  if (fatal) {
    return (
      <div style={{ padding }} ref={hostRef}>
        <WebCard>
          <EmptyState
            icon={<BlockRounded />}
            title="You're not in this quiz"
            subtitle={fatal}
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
      {phase === 'cancelled' ? (
        <WebCard>
          <EmptyState
            icon={<BlockRounded />}
            title="This quiz was cancelled"
            subtitle="Your entry points have not been used for a session that ran."
            action={<GlowButton label="Back to Quiz" height={46} onClick={() => navigate(Routes.quiz)} />}
          />
        </WebCard>
      ) : phase === 'finished' ? (
        <WebCard>
          <EmptyState
            icon={<HourglassEmptyRounded />}
            title="Time's up"
            subtitle="Working out your score…"
          />
        </WebCard>
      ) : question ? (
        <QuestionView
          question={question}
          nowMs={nowMs}
          selectedIndex={selectedIndex}
          submitting={submitting}
          narrow={narrow}
          onAnswer={answer}
          error={error}
        />
      ) : phase === 'scheduled' ? (
        <WaitingView startsInMs={startsInMs} nowMs={nowMs} onBack={() => navigate(Routes.quiz)} />
      ) : (
        <WebCard>
          <EmptyState icon={<HourglassEmptyRounded />} title="Getting the next question…" />
        </WebCard>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Waiting for the session to open
// ---------------------------------------------------------------------------

function WaitingView({
  startsInMs,
  nowMs,
  onBack,
}: {
  startsInMs: number;
  nowMs: number;
  onBack: () => void;
}) {
  // startsInMs is a server-measured span; anchor it to the first render so the
  // countdown keeps moving between polls.
  const anchorRef = useRef<{ at: number; span: number } | null>(null);
  if (anchorRef.current == null || anchorRef.current.span !== startsInMs) {
    anchorRef.current = { at: nowMs, span: startsInMs };
  }
  const remaining = Math.max(0, anchorRef.current.span - (nowMs - anchorRef.current.at));

  return (
    <WebCard padding="34px 26px">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <span
          style={{
            width: 62,
            height: 62,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: withAlpha(WebTokens.accent, 0.12),
            border: `1px solid ${withAlpha(WebTokens.accent, 0.32)}`,
            borderRadius: '50%',
            color: WebTokens.accent,
          }}
        >
          <ScheduleRounded style={{ fontSize: 28 }} />
        </span>
        <p className="t-title-large" style={{ marginTop: 18 }}>
          You're in. The quiz starts shortly.
        </p>
        <div
          className="f-opensans"
          style={{
            marginTop: 14,
            color: WebTokens.accent,
            fontSize: 44,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
          }}
        >
          {remaining > 0 ? formatCountdown(remaining) : 'Starting…'}
        </div>
        <p style={{ marginTop: 14, maxWidth: 380, color: WebTokens.textSecondary, fontSize: 13 }}>
          Keep this page open — the first question appears automatically and each
          one is only open for a few seconds.
        </p>
        <div style={{ marginTop: 20 }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              height: 44,
              padding: '0 18px',
              background: 'transparent',
              border: `1px solid ${WebTokens.glassStroke}`,
              borderRadius: WebTokens.radiusControl,
              color: WebTokens.textSecondary,
              fontSize: 13.5,
              cursor: 'pointer',
            }}
          >
            Back to Quiz
          </button>
        </div>
      </div>
    </WebCard>
  );
}

// ---------------------------------------------------------------------------
// The question
// ---------------------------------------------------------------------------

function QuestionView({
  question: q,
  nowMs,
  selectedIndex,
  submitting,
  narrow,
  onAnswer,
  error,
}: {
  question: QuizLiveQuestion;
  nowMs: number;
  selectedIndex: number | null;
  submitting: boolean;
  narrow: boolean;
  onAnswer: (index: number) => void;
  error: string | null;
}) {
  const msLeft = Math.max(0, q.questionEndMs - nowMs);
  const seconds = secondsLeft(msLeft);
  const windowMs = Math.max(1, q.questionEndMs - q.questionStartMs);
  const fraction = Math.max(0, Math.min(1, msLeft / windowMs));
  const expired = msLeft <= 0;
  const locked = selectedIndex != null;

  // Colour shifts as time runs out: accent -> amber -> danger.
  const timerColor =
    fraction > 0.5 ? WebTokens.accent : fraction > 0.25 ? WebTokens.gold : WebTokens.danger;

  return (
    <div>
      <div
        style={{
          padding: narrow ? '20px' : '24px 26px',
          background: `linear-gradient(135deg, ${withAlpha(WebTokens.violet, 0.12)}, ${withAlpha(WebTokens.accent, 0.06)})`,
          border: `${WebTokens.borderWidth}px solid ${WebTokens.glassStroke}`,
          borderRadius: WebTokens.radiusCard,
          boxShadow: cardShadow,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: narrow ? 'column' : 'row',
            alignItems: narrow ? 'flex-start' : 'center',
            gap: narrow ? 14 : 20,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: WebTokens.textMuted, fontSize: 12, letterSpacing: 0.4 }}>
              QUESTION {q.number} / {q.totalQuestions}
            </p>
            <h1
              className="t-title-large"
              style={{ marginTop: 8, fontSize: narrow ? 19 : 23, lineHeight: 1.35 }}
            >
              {q.question}
            </h1>
          </div>

          {/* Ring timer — the seconds number is the primary readout; the ring
              gives the at-a-glance sense of how much is left. */}
          <div style={{ position: 'relative', width: 82, height: 82, flexShrink: 0 }}>
            <svg width={82} height={82} viewBox="0 0 82 82" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx={41} cy={41} r={36} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={6} />
              <circle
                cx={41}
                cy={41}
                r={36}
                fill="none"
                stroke={timerColor}
                strokeWidth={6}
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 36}
                strokeDashoffset={2 * Math.PI * 36 * (1 - fraction)}
                style={{ transition: 'stroke-dashoffset 240ms linear, stroke 300ms ease' }}
              />
            </svg>
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
                style={{
                  color: timerColor,
                  fontSize: 26,
                  fontWeight: 700,
                  lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {seconds}
              </span>
              <span style={{ marginTop: 2, color: WebTokens.textMuted, fontSize: 9.5, letterSpacing: 0.5 }}>
                {seconds === 1 ? 'SECOND' : 'SECONDS'}
              </span>
            </div>
          </div>
        </div>

        {/* Per-session progress: which question of how many. */}
        <div style={{ marginTop: 18, display: 'flex', gap: 6 }}>
          {Array.from({ length: q.totalQuestions }, (_, i) => (
            <span
              key={i}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 999,
                background:
                  i < q.index
                    ? withAlpha(WebTokens.accent, 0.55)
                    : i === q.index
                      ? WebTokens.accent
                      : 'rgba(255,255,255,0.08)',
              }}
            />
          ))}
        </div>
      </div>

      <div style={{ height: 18 }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {q.options.map((label, i) => (
          <OptionRow
            key={i}
            letter={OPTION_LETTERS[i]}
            label={label}
            selected={selectedIndex === i}
            disabled={locked || expired || submitting}
            onClick={() => onAnswer(i)}
          />
        ))}
      </div>

      <div style={{ height: 16 }} />

      {error && (
        <p style={{ color: WebTokens.danger, fontSize: 13, textAlign: 'center' }}>{error}</p>
      )}

      {/* Status line. Deliberately never says whether the pick was right — the
          backend does not tell the client that until the result screen (§13). */}
      {!error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            color: locked ? WebTokens.accent : expired ? WebTokens.textMuted : WebTokens.textSecondary,
            fontSize: 13,
          }}
        >
          {locked ? (
            <>
              <CheckRounded style={{ fontSize: 16 }} />
              Answer locked in — waiting for the next question
            </>
          ) : expired ? (
            <>
              <LockClockRounded style={{ fontSize: 16 }} />
              Time's up for this question
            </>
          ) : (
            'Pick one answer — you cannot change it afterwards'
          )}
        </div>
      )}
    </div>
  );
}

function OptionRow({
  letter,
  label,
  selected,
  disabled,
  onClick,
}: {
  letter: string;
  label: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const interactive = !disabled;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={interactive ? onClick : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        width: '100%',
        padding: '16px 18px',
        textAlign: 'left',
        background: selected
          ? withAlpha(WebTokens.accent, 0.14)
          : hover && interactive
            ? 'rgba(255,255,255,0.05)'
            : 'rgba(255,255,255,0.025)',
        border: `1px solid ${
          selected ? withAlpha(WebTokens.accent, 0.55) : WebTokens.glassStroke
        }`,
        borderRadius: WebTokens.radiusControl + 3,
        color: WebTokens.textPrimary,
        // Unpicked options fade once the choice is made, but stay readable —
        // the user should still be able to see what they chose between.
        opacity: disabled && !selected ? 0.5 : 1,
        cursor: interactive ? 'pointer' : 'default',
        transition: 'background 140ms ease, border-color 140ms ease, opacity 200ms ease',
      }}
    >
      <span
        style={{
          width: 30,
          height: 30,
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: selected ? WebTokens.accent : 'rgba(255,255,255,0.06)',
          border: `1px solid ${selected ? WebTokens.accent : WebTokens.glassStroke}`,
          borderRadius: 9,
          color: selected ? WebTokens.onAccent : WebTokens.textSecondary,
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        {selected ? <CheckRounded style={{ fontSize: 17 }} /> : letter}
      </span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, lineHeight: 1.4 }}>{label}</span>
    </button>
  );
}
