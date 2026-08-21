declare global {
  interface Window {
    fbq?: (command: string, eventName: string) => void;
  }
}

/**
 * Thin wrapper around the Meta Pixel — keeps every call site in one place.
 * The snippet in index.html defines `fbq` synchronously the instant the page
 * loads (as a queuing stub, before its actual tracking script even finishes
 * downloading), so these are safe to call at any point after boot.
 *
 * Every call is wrapped in a try/catch and never awaited by callers: a
 * tracking hiccup (or `fbq` being unexpectedly unavailable) must never
 * surface as a user-facing error.
 */
export const MetaPixel = {
  /**
   * Fired once an account is verified and a real session is granted (not on
   * the initial signup form submit, which only sends an OTP).
   */
  logCompleteRegistration: () => track('track', 'CompleteRegistration'),

  /**
   * Core engagement action — a user actually predicting. Not a Meta standard
   * event name, so trackCustom (not track) is the correct call.
   */
  logPredictionSubmitted: () => track('trackCustom', 'SubmitPrediction'),

  /** Fired only when a submitted prediction had a real points cost. */
  logSpentCredits: () => track('trackCustom', 'SpentCredits'),

  /** Fired when a prediction's detail panel is opened. */
  logViewedContent: () => track('track', 'ViewContent'),

  /** Fired when a badge flips from not-earned to earned. */
  logUnlockedAchievement: () => track('trackCustom', 'UnlockedAchievement'),

  /** Fired when the one-time guided tour ends, whether finished or skipped. */
  logCompletedTutorial: () => track('trackCustom', 'CompletedTutorial'),

  /** Fired when a Predict-page search actually changes results. */
  logSearched: () => track('track', 'Search'),
};

function track(command: string, eventName: string): void {
  try {
    window.fbq?.(command, eventName);
  } catch {
    /* best-effort — never let a tracking call affect the app */
  }
}
