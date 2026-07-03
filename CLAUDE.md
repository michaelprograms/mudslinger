# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A self-hosted, web-based MUD client. The browser connects **directly** to a MUD's
native WebSocket port (e.g. FluffOS `external_port ... websocket`), which carries
the raw telnet byte stream as binary WebSocket frames. There is no server-side
proxy — the telnet protocol stack (IAC negotiation) runs in the browser and
`@xterm/xterm` renders the output stream (ANSI color included). Consequence: the
MUD never sees the player's real IP, and `wss://` is required when the page is
served over HTTPS (else mixed-content block).

## Commands

```bash
npm run dev        # Vite dev server with HMR (entry: src/ts/core/client.ts via index.html)
npm run build      # production bundle -> static/public/assets/
npm run build-dev  # unminified bundle (mode=development)
npm test           # vitest run (headless, *.test.ts colocated in src/)
npm run typecheck  # tsc --noEmit
```

Run one test: `npx vitest run src/ts/protocol/telnet.test.ts` or `npx vitest run -t "name"`.

Note: the build empties and rewrites `static/public/` (`emptyOutDir: true`).
Checked-in static assets that must survive a build (favicon) live in the root
`public/` dir — Vite copies them into the output. CSS is co-located with
components as `*.css` files imported in TypeScript; Vite bundles them automatically.

## Architecture

Layered, wired together in `src/ts/core/client.ts` (the `Client` god-object that
constructs everything). Data flows up the layers on input from the MUD and down on
player input:

- **net/** — moving bytes. `websocket.ts` wraps the browser WebSocket; `socket.ts`
  (`Socket`) runs telnet negotiation over it and forwards decoded data downstream.
- **protocol/** — `telnet.ts`/`telnetlib.ts` (IAC/telnet negotiation).
- **manager/** — stateful processing: `stream.ts` (`StreamManager`: UTF-8 decode +
  line extraction, forwards the raw ANSI stream to the terminal), `trigger.ts`,
  `alias.ts`.
- **ui/** — DOM widgets: `terminal.ts` (`MudTerminal`, an `@xterm/xterm` wrapper —
  renders output, handles ANSI color natively), `commandInput.ts`, `menuBar.ts`.
- **panel/** — floating `.mudpanel` windows sharing `base.ts`: `editor.ts` (combined
  alias/trigger/script editor, CodeMirror-backed, **lazy-loaded** via dynamic
  `import()` on first open so CodeMirror stays out of the initial bundle),
  `config.ts`, `about.ts`.
- **core/** — `script.ts` (user JS scripting sandbox + `EvtScriptEmit*` events),
  `config.ts` (build/deploy config, fed by Vite `define` + `VITE_*` env vars) vs
  `userConfig.ts` (per-user settings persisted in the browser), `appInfo.ts`,
  `event.ts`, `util.ts`.

**Eventing**: everything is decoupled through `core/event.ts` `EventHook<T>` — a
tiny pub/sub (`.handle(cb)` / `.fire(data)`). Layers communicate by firing hooks,
not by calling each other directly. This is the pattern to follow when adding
cross-layer behavior.

## Deploy

Static bundle served under the `/play/` path (note `base: '/play/'` in
`vite.config.ts` — all asset URLs are prefixed). nginx `alias` maps `/play` to
`static/public/`; see `DEPLOY.md`.

## Modernization log

`docs/MODERNIZATION.md` tracks the dependency-removal effort and remaining backlog.
