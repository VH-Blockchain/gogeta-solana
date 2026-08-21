/**
 * Portal location the guard bounced to /login — replayed after sign-in (or
 * session restore) so deep links land on their exact page.
 *
 * Deliberately split into a pure `peek` and an explicit `clear`: consuming it
 * during render (a read-and-clear) is an impure render, which React's
 * StrictMode surfaces by double-invoking initializers — the first call would eat
 * the value and the second would see nothing. Pages peek while rendering and
 * clear only once they actually navigate.
 */
let pending: string | null = null;

export function setPendingLocation(location: string): void {
  pending = location;
}

/** Pure read — safe to call during render. */
export function peekPendingLocation(): string | null {
  return pending;
}

/** Call once the pending location has actually been navigated to. */
export function clearPendingLocation(): void {
  pending = null;
}
