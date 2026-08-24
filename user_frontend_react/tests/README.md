# Verification suites

Puppeteer-driven headless-Chrome suites that exercise the running dev server
against a stubbed backend (`stubs.mjs`). They need Chrome at
`/usr/bin/google-chrome` and `puppeteer-core` installed.

```bash
npm run dev                     # in one shell
npm install --no-save puppeteer-core
node tests/smoke.mjs            # every route renders cleanly
node tests/func.mjs             # content, data binding, responsive breakpoints
node tests/func2.mjs            # nav, full submit flow, guard, search
node tests/func3.mjs            # scroll reachability + layout geometry
node tests/func4.mjs            # auth flows
node tests/func5.mjs            # quiz: lobby, join dialog, waiting, result, history
node tests/func6.mjs            # points: balance, buy-points modal, quote, validation, history
node tests/func7.mjs            # withdrawals: eligibility figures, modal conversion, wallet gate, history
node tests/func8.mjs            # dialog geometry: action rows stay reachable, cards scroll
```

`func3` and `func8` assert real geometry rather than text: `innerText` returns
content whether or not the user can actually scroll to it. That gap hid a layout
regression which pushed the submit bar off-screen (`func3`), and later shipped
the withdraw modal with its action row below the fold and no way to scroll to it
(`func8`).
