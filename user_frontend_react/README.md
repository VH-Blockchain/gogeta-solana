# GOGETA Web Portal — React + Vite

A React + Vite port of the Flutter Web portal in `../user_frontend`. Same design,
same functionality, same backend contract. The Flutter project is untouched.

## Why only the web portal?

`user_frontend/lib/main.dart` branches on `kIsWeb`:

```dart
if (kIsWeb) {
  usePathUrlStrategy();
  runApp(const IkiWebApp());   // lib/web/** — its own shell, theme, router, screens
  return;
}
runApp(const PredoraApp());     // lib/features/** — the mobile app, never rendered on web
```

The web build only ever renders `lib/web/**` plus the shared data layer
(`lib/core`, `lib/data`, `lib/providers`). The phone-first screens in
`lib/features/**` are portrait-locked mobile UI that the browser never reaches, so
this port covers exactly what shipped on the web: **`lib/web/**` + the shared
data/core layers**, at full fidelity.

## Quick start

```bash
npm install
cp .env.example .env     # optional — defaults to the live production API
npm run dev              # http://localhost:5173
```

```bash
npm run build            # tsc -b && vite build  ->  dist/
npm run preview          # serve the production build
npm run typecheck        # types only
```

### Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_BASE` | `https://admin.yesiki.com/api` | Backend base URL, **including** the `/api` prefix. Note the name: a `VITE_API_URL` entry is ignored and the build silently falls through to the production default |
| `VITE_SOLANA_NETWORK` | `devnet` | Solana cluster |
| `VITE_SOLANA_RPC_URL` | cluster default | RPC endpoint the wallet adapter connects through |
| `VITE_SOLANA_USDC_MINT` | devnet USDC | The USDC SPL mint points are bought with |
| `VITE_SOLANA_USDC_DECIMALS` | `6` | Mint decimals |
| `VITE_SOLANA_EXPLORER_URL` | `https://explorer.solana.com` | Explorer links are built with `?cluster=` appended |
| `VITE_META_PIXEL_ID` | `962614643458697` | Meta Pixel id (the snippet in `index.html` still hardcodes it, as the Flutter build did) |
| `VITE_FIREBASE_VAPID_KEY` | committed public key | Web Push certificate public key |

### Deployment

Routes are **path-based** (`/predictions`, `/leaderboard/lucky`), matching
`usePathUrlStrategy()`. The host must serve `index.html` for unknown paths, or a
refresh on a deep link 404s:

```
# nginx
location / { try_files $uri $uri/ /index.html; }
```

`public/firebase-messaging-sw.js` must be served from the origin root so its
`/firebase-cloud-messaging-push-scope` registration resolves.

## Architecture

| Flutter | React | Notes |
| --- | --- | --- |
| `provider` (`ChangeNotifier`) | `zustand` | One store per provider |
| `go_router` | `react-router-dom` v6 | `PortalGuard` replaces the `redirect:` callback |
| `dio` | `axios` | Same interceptor + normalized `ApiException` |
| `flutter_secure_storage` | `localStorage` | Session token under `gogeta_jwt` (renamed from the Flutter build's `predora_jwt` in the GOGETA rebrand, so an existing Flutter-web session does not carry over — users sign in once more) |
| `flutter_animate` | CSS animations (`Reveal`) | The `.fadeIn().slideY()` entrance chain |
| `CustomPainter` | inline SVG / canvas | Sparkline, gauge arc, crown → SVG; confetti → canvas |
| `Icons.*` | `@mui/icons-material` | Same Material glyphs, resolved by name through `components/Icon.tsx` |
| `flutter_widget_from_html` | `dangerouslySetInnerHTML` + `DOMPurify` | CMS HTML is sanitized — `innerHTML` executes scripts, the Flutter renderer did not |
| `google_fonts` | local `@font-face` | The same bundled `.ttf` files; never a runtime CDN fetch |

### Wallet

Points are bought with USDC on Solana. `core/web3/Web3Provider.tsx` mounts the
standard adapter stack — `ConnectionProvider → WalletProvider →
WalletModalProvider` — above the router, so a connection survives navigation, and
`features/points/useSolanaWallet.ts` is the one hook that reads balances and sends
transfers.

Three things in that hook are load-bearing rather than incidental:

- **The balance loads on connect**, not after a purchase. It is the number a user
  needs *before* paying.
- **A missing associated token account is a real zero, not an error.** The SPL
  client throws when a wallet has never held the mint; that is caught and reported
  as 0, while any other failure leaves the balance unknown rather than showing a
  confident 0 for a wallet that might be full.
- **Transfers create the recipient's token account when absent** and use
  `transferChecked`, so the token program itself rejects a mint or decimals
  mismatch. The signature is only returned after confirmation, so the backend is
  never handed a signature it cannot yet read.

There is no network-switch concept: a Solana wallet does not choose a cluster the
way an EVM wallet chooses a chain, so the cluster is whatever the provider was
given and there is nothing for the user to switch.

`core/polyfills.ts` installs `Buffer`, which the Solana libraries touch at module
load. It must stay the first import in `main.tsx` — ES module bodies evaluate in
import order, so anywhere lower runs too late.

```
src/
  theme/        design tokens (webTokens.ts ≡ WebTokens), fonts, global CSS
  core/         network (apiClient/apiException/tokenStore), constants, push, analytics, utils
                polyfills.ts (Buffer), web3/ (Solana provider + config)
  data/         models, mappers, categoryCatalog, api/ (one repository per Flutter repository)
  store/        zustand stores (auth, user, config, predictions, basket, notifications, theme)
  router/       routes, AppRouter, PortalGuard, pendingLocation
  components/   the shared widget library (port of lib/web/widgets/web_widgets.dart)
  shell/        WebShell, Sidebar, TopBar, RightRail, Logo, SearchBox
  features/     landing, auth, dashboard, predictions, leaderboard, rewards, profile,
                notifications, legal
```

### Design fidelity

The brand palette is GOGETA's own: an electric cyan aura (`#22D3EE`) falling
into deep blue (`#2563EB`) over a navy-black ground (`#04070E`), with gold kept
for Rewards and violet for the Leaderboard. Profile moved from sky blue to
indigo so it stays a distinct family alongside the cyan primary. Everything
flows from `theme/palette.ts` -> `theme/webTokens.ts` (mirrored in
`theme/tokens.css`), so the ramp is swappable from one place.

Semantic colours are deliberately independent of the brand: `danger` stays red,
`success` stays green, and the won/lost states on prediction cards keep their
accent-vs-red pairing.

Structurally, every token is a 1:1 port of the Flutter original. Flutter's ARGB hex literals became `rgba()` so the
alphas survive exactly — `0x28FFFFFF` → `rgba(255,255,255,0.157)`. The 4-font
system keeps its widget-level carve-outs: **Poppins** is the ambient default
(most portal text was a raw hardcoded `TextStyle`, so anything else would have
silently restyled ~90% of it), with **Inter** for prose, **DM Sans** for nav and
small uppercase labels, and **Open Sans** for stat numbers.

Poppins ships only 500/600/700 (as in `pubspec.yaml`), so no rule requests w400
on it — the sidebar's category rows use Inter for exactly that reason, matching
the comment in the Dart source.

## What carried over verbatim

Every non-obvious behaviour the Dart comments called out is preserved, including:

- **Server-paginated Open grid** — `open` is a capped 20-item page, so the grid
  owns its own paged fetch. Tab counts use `openTotal` and sidebar badges use
  `categoryCounts`, never `open.length` (which under-reports past 20 items).
- **Optimistic post-submit hide** — `justSubmittedVersion` bumps synchronously so
  the answered card disappears immediately, mutated in place to keep the
  skip/take math intact; the full refresh follows on `submitVersion` and
  re-fetches the same number of items to preserve scroll position.
- **Answered-batch backfill** (PO-51) — the backend can't filter "already
  answered", so a partly-answered page auto-continues instead of leaving a gap.
- **Tab switches route** (PO-43) — the URL is the source of truth, so the
  topbar's "Predict now" genuinely resets the tab.
- **Basket lines capture the full prediction + option** at click time, never
  re-looked-up at submit, so a pick made beyond the first page can't be dropped.
- **Sidebar collapse toggle is a sibling of the sidebar** (PO-44), so its full
  circular hit area is clickable rather than half-swallowed by the layout boundary.
- **Featured shows only admin-flagged, unanswered picks** (PO-50) — no
  non-featured substitution under a "Featured" heading.
- **Level progress uses the counts the backend actually promotes on**, not an XP
  ratio that had no backend equivalent.
- **`option.odds` is never rendered as a multiplier** — for Polymarket-imported
  predictions it's a raw 0–1 probability; only the real vote share is shown.
- **Guarded deep links replay after sign-in**, and the guard holds off while the
  stored session is still restoring rather than flashing `/login`.

## Deliberate improvements

Three places where a faithful port would have carried a real defect:

1. **CMS HTML is sanitized** with DOMPurify. Flutter's renderer never executed
   scripts; `innerHTML` does, so sanitizing preserves the original security
   posture rather than the original code.
2. **The hidden submit bar is inert** (`visibility: hidden` + `aria-hidden`).
   Flutter's `IgnorePointer` + `AnimatedOpacity` left "0 picks selected" in the
   semantics tree behind an invisible layer.
3. **The pending deep link is read purely during render** and cleared in an
   effect. A read-and-clear during render is impure, which React StrictMode
   exposes by double-invoking — the first call would consume the value and the
   second would fall back to the default.

## Known scope limits (matching the Flutter portal)

- **Light mode** is defined in tokens and read by the boot loader, but no toggle
  is exposed — `WebThemeProvider` had no UI toggle either and always stayed dark.
- **No guided coach marks.** The Flutter tour used `tutorial_coach_mark`; that
  first-run tour is not ported. Everything it pointed at is unchanged, and
  `MetaPixel.logCompletedTutorial()` is retained for when a tour is added.
- **Foreground push shows an in-app toast** (browsers never show a native banner
  for a focused tab); background pushes are handled by the service worker, which
  owns the same `type` → route mapping.
- **English only.** `IkiWebApp` never wired `localizationsDelegates`, so the
  portal shipped without the `l10n/` translations the mobile app used.
- **The user store starts empty, not mocked.** Flutter seeded `UserProvider` with
  `MockData.currentUser`; on web those numbers were never visible (the shell only
  mounts once authenticated, and the real profile loads first), so this starts
  from zeros instead of fabricated stats.

## Verification

Four Puppeteer suites drove a headless Chrome against the dev server with a
stubbed backend — **228 checks, all passing**:

| Suite | Checks | Covers |
| --- | --- | --- |
| `smoke` | 16 routes | Every route renders, no console/page errors, no horizontal overflow |
| `func` | 88 | Page content, data binding, landing sections, responsive breakpoints |
| `func2` | 38 | Sidebar submenus, full pick→confirm→congrats flow, guard, search |
| `func3` | 39 | Scroll reachability, layout geometry, submit bar, detail panel |
| `func4` | 25 | Register→OTP, forgot-password wizard, login validation, sign out |

The `func3` geometry suite exists because text assertions alone are not enough:
`innerText` returns content whether or not the user can scroll to it. It caught a
real regression where the backdrop's `min-height` let the shell grow past the
viewport, pushing the submit bar off-screen and making everything below the fold
unreachable.
