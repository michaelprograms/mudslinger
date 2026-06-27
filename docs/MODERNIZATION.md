# Modernization

Ongoing work to remove legacy dependencies and simplify the stack.

## Done

- **jqxProgressBar** — removed with MSDP sidebar
- **jqxSplitter** — replaced with vanilla `.mudpanel` dock panel (float/top/bottom/left/right/maximize)
- **jqxWindow** — fully removed; all panels use `.mudpanel`
- **statusWin.ts** — deleted (dead code; the profile API it served was removed years ago)
- **webpack → Vite** — `genAppInfo.js` and `buildDocs.js` build steps removed; `index.html` is now the real source; `npm run dev` replaces the old build-then-serve loop
- **QUnit → Vitest** — 27 tests run headless via `npm test`; dead MSDP tests removed
- **External docs site** — folded into About panel (three tabs: About / Scripting API / License); `buildDocs` step and `userdocs/` source deleted
- **jqxMenu → native CSS nav** — `menuBar.ts` rewritten to native DOM; `jqwidgets-framework` removed from `package.json`; `<nav>` with CSS `:hover` dropdowns replaces the old `<ul>` + jqxMenu init
- **jQuery → removed** — `outWinBase.ts`, `outputManager.ts`, `mxp.ts`, `commandInput.ts`, `outputWin.ts` converted to vanilla DOM; `jquery` and `@types/jquery` removed from `package.json`; `<script src="jquery.min.js">` removed from `index.html`; jQuery copy removed from `postinstall.js`
- **CodeMirror 5 → 6** — `panelEditorBase.ts` and `jsScriptWin.ts` migrated to CM6 ESM (`basicSetup` + `@codemirror/lang-javascript` + `@codemirror/theme-one-dark`); gains history, bracketMatching, closeBrackets, one-dark theme; CM5 `<script>`/`<link>` tags removed from `index.html`; `static/public/codemirror/` vendored tree deleted; `tools/postinstall.js` deleted; `fs-extra` removed; postinstall replaced with shell one-liner

## In Progress

## Backlog

- **GMCP support**
- **Unimplemented SGR codes** — italic (3), underline (4), blink (6), alt-font (11) silently
  skipped in `outputManager.ts`; surrounding colors render fine. Low priority unless a MUD needs them.
- **xterm.js** — replace the bespoke output renderer (`outputWin.ts`, `outWinBase.ts`,
  `outputManager.ts`, `mxp.ts`, `color.ts`). High effort; MXP support is non-trivial since
  xterm.js has no MUD protocol awareness. Keep `static/test/test_output.html` as the visual
  regression harness while evaluating.
- **TypeScript bumps** — routine, no design work needed
- move config out of static directory to root of project or src?

## Dependency status

| Before | After | Status |
|---|---|---|
| `webpack` v5 + `webpack-cli` v5 + `html-webpack-plugin` v5 | `vite` v8.1.0 | ✅ done |
| `qunit` v2.26.0 + `@types/qunit` v2.19.14 | `vitest` v4.1.9 | ✅ done |
| `genAppInfo.js` + `buildDocs.js` + `markdown-it` | removed (vite define + About panel) | ✅ done |
| `jqwidgets-framework` v9.1.6 | removed (native CSS nav) | ✅ done |
| `jquery` v2.2.4 + `@types/jquery` v2.0.68 | removed (vanilla DOM throughout) | ✅ done |
| `codemirror` v5 + `fs-extra` + `postinstall.js` | `codemirror` v6 + `@codemirror/lang-javascript` + `@codemirror/theme-one-dark` | ✅ done |
