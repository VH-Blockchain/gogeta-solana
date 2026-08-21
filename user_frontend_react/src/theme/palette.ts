/**
 * Raw color constants for GOGETA's multi-accent gamified system.
 *
 * The ramp is drawn from the Gogeta (Super Saiyan Blue) key art: an electric
 * cyan aura over deep blue, gold shoulder armour, and violet edge light on a
 * near-black navy ground.
 *
 * Feature accents:
 *  - aura   -> Predictions   (primary brand — the cyan aura)
 *  - gold   -> Rewards       (the shoulder armour)
 *  - violet -> Leaderboard   (aura edge light)
 *  - indigo -> Profile       (deep blue, kept clear of the cyan primary)
 */
export const AppPalette = {
  // ---- Feature accents ----
  aura: '#22D3EE', // predictions / primary — aura cyan
  auraDeep: '#2563EB', // electric blue the aura falls into
  auraSoft: '#A5F3FC',

  gold: '#FFC042', // rewards
  goldDeep: '#F59E0B',
  goldSoft: '#FFE9B8',

  violet: '#9B7BFF', // leaderboard
  violetDeep: '#6D4AE0',
  violetSoft: '#E5DBFF',

  // Profile sits on a deeper indigo rather than the old sky blue: with a cyan
  // primary, a light blue accent no longer reads as its own family.
  indigo: '#6366F1', // profile
  indigoDeep: '#4338CA',
  indigoSoft: '#C7D2FE',

  // ---- Semantic ----
  success: '#3FD37C',
  danger: '#FF5A6E',
  warning: '#FFB020',
  info: '#38BDF8',

  // ---- Dark surfaces (navy-black, so the cyan aura reads as light on it) ----
  darkBg: '#04070E',
  darkSurface: '#0B1220',
  darkSurfaceAlt: '#131C2E',
  darkElevated: '#1B2740',

  // ---- Light surfaces ----
  lightBg: '#F4F6FB',
  lightSurface: '#FFFFFF',
  lightSurfaceAlt: '#EDEFF6',

  // ---- Neutral ramp ----
  white: '#FFFFFF',
  black: '#000000',
} as const;

/** The four feature accent families used across the app. */
export type AccentFamily = 'predictions' | 'rewards' | 'leaderboard' | 'profile';
