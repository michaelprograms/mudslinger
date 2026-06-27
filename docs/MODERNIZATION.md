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
- **client.css → component CSS** — monolithic `static/public/client.css` split into 6 co-located CSS files imported by their components (`base.css`, `menuBar.css`, `outputWin.css`, `commandInput.css`, `panel/base.css`, `panel/about.css`); `<link>` tag removed from `index.html`; Vite bundles them automatically; dead `#leftPanel`/`#rightPanel` rules dropped
- **xterm.js** — replaced bespoke output renderer (`outputWin.ts`, `outputBase.ts`, `outputManager.ts`, `mxp.ts`, `color.ts`) with xterm.js (`MudTerminal` + `StreamManager`); ANSI/SGR/xterm-256 rendered natively; italic/underline/blink now work; MXP disabled

## In Progress

## Backlog

- **GMCP support**
- **Unimplemented SGR codes** — italic (3), underline (4), blink (6), alt-font (11) silently
  skipped in `outputManager.ts`; surrounding colors render fine. Low priority unless a MUD needs them.

## Dependency status

| Before | After | Status |
|---|---|---|
| `webpack` v5 + `webpack-cli` v5 + `html-webpack-plugin` v5 | `vite` v8.1.0 | ✅ done |
| `qunit` v2.26.0 + `@types/qunit` v2.19.14 | `vitest` v4.1.9 | ✅ done |
| `genAppInfo.js` + `buildDocs.js` + `markdown-it` | removed (vite define + About panel) | ✅ done |
| `jqwidgets-framework` v9.1.6 | removed (native CSS nav) | ✅ done |
| `jquery` v2.2.4 + `@types/jquery` v2.0.68 | removed (vanilla DOM throughout) | ✅ done |
| `codemirror` v5 + `fs-extra` + `postinstall.js` | `codemirror` v6 + `@codemirror/lang-javascript` + `@codemirror/theme-one-dark` | ✅ done |
| bespoke DOM renderer | `@xterm/xterm` v6.0.0 + `@xterm/addon-fit` v0.11.0 | ✅ done |
