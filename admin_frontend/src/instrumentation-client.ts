/**
 * Client-side polyfills, installed before the app becomes interactive.
 *
 * `@solana/web3.js` and `@solana/spl-token` were written for Node and touch
 * `Buffer` at module-evaluation time — deriving associated token addresses,
 * encoding instruction layouts. Nothing in a browser provides it, so the bare
 * import throws `ReferenceError: Buffer is not defined` before any of our code
 * runs.
 *
 * `instrumentation-client` is Next's own hook for exactly this: it runs before
 * the application becomes interactive, which is the guarantee a polyfill needs.
 * Putting the assignment inside the wallet provider component instead would be
 * too late — module evaluation of its imports happens first.
 *
 * Assigned only when absent, so any host that already provides Buffer keeps its own.
 */
import { Buffer } from 'buffer';

const g = globalThis as typeof globalThis & { Buffer?: typeof Buffer };

if (g.Buffer === undefined) {
  g.Buffer = Buffer;
}
