# Modernization Candidates

A running backlog of "maybe we should upgrade these" items for the browser
client. These are intentionally fuzzy — capture the idea, the rationale, and
what makes it hard, so future work can start from context instead of a cold
guess. Nothing here is committed; promote an entry to a GitHub issue when it's
ready to actually happen.

Each entry: **current → target**, why it's worth doing, and rough effort/risk.

## Build & tooling

### webpack → Vite
- **Current**: webpack 5 + `webpack-cli` 5, separate `tsc` step, plus
  `html-webpack-plugin`. Three webpack configs (`webpack.config.js`,
  `.test.js`, `.test_output.js`).
- **Why**: faster dev/HMR, far less config, native ESM + TS handling, simpler
  test story (pairs naturally with Vitest below).
- **Effort/risk**: Medium. Need to port all three webpack entry points and the
  `genAppInfo` / `buildDocs` build steps in `package.json`. The hashed
  `mudslinger-*.js` output naming and `static/public` layout must keep working
  for the smoke test and any deploy.

### QUnit → Vitest
- **Current**: QUnit 2.26, run only in-browser via `static/test/test.html`
  (compiled by `build-test`). No `npm test`; no console output.
- **Why**: the unit suite (`util`, `telnetClient`, `jsScript`, `aliasManager`,
  `triggerManager`, `telnetlib`) and its tests have **no DOM/jQuery
  dependency** — verified. They can run headless. A real `npm test` with
  console pass/fail is what we actually want.
- **Effort/risk**: Low. Mostly mechanical: `QUnit.test`/`assert.strictEqual`
  → `test`/`expect`. Caveat: `aliasManager`/`triggerManager` import
  `TrigAlItem` from `trigAlEditBase.ts`, which touches `document`/jqx — but
  only inside class methods, so it won't execute on import under node. Confirm
  during the port.
- **Note**: `test_output.html` is a *visual* renderer harness, not a unit
  test — it stays browser-based regardless (see xterm.js item).

## UI & rendering

### jQuery 2.x → vanilla / modern
- **Current**: jQuery `^2.2.4` (2016).
- **Why**: ancient, large, and security-stale; most usage is likely
  `querySelector`/`classList`/`fetch`-replaceable today.
- **Effort/risk**: High. Touches lots of UI code and is entangled with
  jqwidgets (below), which assumes jQuery. Probably can't fully drop jQuery
  until jqwidgets is also replaced.

### jqwidgets-framework → modern UI primitives
- **Current**: `jqwidgets-framework` `^9.1.6`; used for windows, splitter,
  menu (see `trigAlEditBase.ts`: `jqxWindow`, `jqxSplitter`).
- **Why**: heavy, jQuery-bound, licensing baggage; blocks the jQuery removal.
- **Effort/risk**: High. Need replacements for windowing/splitter/menu widgets.

### custom output renderer → xterm.js
- **Current**: bespoke renderer in `outputWin.ts` / `outWinBase.ts` /
  `outputManager.ts` / `mxp.ts` / `color.ts`. The visual harness
  `static/test/test_output.html` exercises ANSI 256-color + MXP rendering.
- **Why**: xterm.js is battle-tested for terminal rendering/perf.
- **Effort/risk**: High and uncertain. MXP is MUD-specific markup that xterm.js
  doesn't natively understand, so this likely needs a custom addon or a hybrid.
  Keep `test_output.html` as the visual regression check while evaluating.

### CodeMirror 5 → 6
- **Current**: `codemirror` `^5.24.2`.
- **Why**: CM5 is in maintenance only; CM6 is the actively developed line.
- **Effort/risk**: Medium. CM6 is a near-total API rewrite (state/view
  architecture), not a version bump.

## Lower priority / watch

- **socket.io-client** `^4`: already current major (v4). Just keep it patched;
  bump in lockstep with the proxy's `socket.io` server version.
- **TypeScript / webpack patch bumps**: routine, no design work needed.
