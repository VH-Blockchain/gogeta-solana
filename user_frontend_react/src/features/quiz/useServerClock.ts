import { useEffect, useRef, useState } from 'react';

/**
 * A ticking clock corrected to the server's time.
 *
 * The backend is the single source of truth for quiz timing (§13: the frontend
 * timer is never trusted for scoring), so every countdown on these screens is
 * drawn against this value rather than `Date.now()`. An admin- or user-machine
 * clock that is a minute off would otherwise show a timer that disagrees with
 * the session it is counting down.
 *
 * Returns a *number*, not a getter: consumers re-render when it changes, which
 * a stable callback would not cause.
 *
 * @param serverNowMs the newest `serverNow` seen from any quiz response
 * @param intervalMs  tick rate — 250ms during play so a question boundary is
 *                    never missed by more than a quarter second
 */
export function useServerClock(serverNowMs: number | null, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  const offsetRef = useRef(0);

  // Held in a ref: re-measuring the offset must not itself trigger a render,
  // and it is an external value being read, not React state to synchronise.
  useEffect(() => {
    if (serverNowMs && serverNowMs > 0) offsetRef.current = serverNowMs - Date.now();
  }, [serverNowMs]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now + offsetRef.current;
}

/** `m:ss` for a duration in ms, floored at zero. */
export function formatCountdown(msLeft: number): string {
  const total = Math.max(0, Math.ceil(msLeft / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Whole seconds remaining, floored at zero — the per-question timer. */
export function secondsLeft(msLeft: number): number {
  return Math.max(0, Math.ceil(msLeft / 1000));
}

/** "15m" / "14m 10s" / "50s" — used to explain the schedule in prose. */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}
