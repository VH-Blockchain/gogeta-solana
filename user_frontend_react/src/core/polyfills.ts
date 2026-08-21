/**
 * Node globals the Solana libraries expect, installed before anything imports
 * them.
 *
 * `@solana/web3.js` and `@solana/spl-token` were written for Node and reach for
 * `Buffer` at module-evaluation time — decoding account data, building
 * instruction layouts, deriving associated-token addresses. Vite ships no Node
 * shims to the browser, so the bare import throws
 * `ReferenceError: Buffer is not defined` before any of our own code runs.
 *
 * This file must be the FIRST import in main.tsx. ES module bodies evaluate in
 * import order, so importing it first is what guarantees the global exists by
 * the time the wallet adapters are pulled in — a polyfill placed lower in the
 * list would run too late.
 *
 * Assigned only when absent, so a host that already provides Buffer (a test
 * harness, a future SSR pass) keeps its own.
 */
import { Buffer } from 'buffer';

const g = globalThis as typeof globalThis & { Buffer?: typeof Buffer };

if (g.Buffer === undefined) {
  g.Buffer = Buffer;
}
