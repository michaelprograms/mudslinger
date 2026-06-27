# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A self-hosted, web-based MUD client. The browser connects **directly** to a MUD's
native WebSocket port (e.g. FluffOS `external_port ... websocket`), which carries
the raw telnet byte stream as binary WebSocket frames. There is no server-side
proxy — the entire telnet protocol stack (IAC negotiation, MXP, color) runs in the
browser. Consequence: the MUD never sees the player's real IP, and `wss://` is
required when the page is served over HTTPS (else mixed-content block).

## Commands

```bash
npm run dev        # Vite dev server with HMR (entry: src/ts/core/client.ts via index.html)
npm run build      # production bundle -> static/public/assets/
npm run build-dev  # unminified bundle (mode=development)
npm test           # vitest run (headless, *.test.ts colocated in src/)
npm run typecheck  # tsc --noEmit
```

Run one test: `npx vitest run src/ts/protocol/telnet.test.ts` or `npx vitest run -t "name"`.

Note: the build writes into `static/public/` with `emptyOutDir: false` — it does
**not** wipe checked-in assets there (favicon). CSS is co-located with components
as `*.css` files imported in TypeScript; Vite bundles them automatically.

## Architecture

Layered, wired together in `src/ts/core/client.ts` (the `Client` god-object that
constructs everything). Data flows up the layers on input from the MUD and down on
player input:

- **net/** — moving bytes. `transport.ts` defines the `Transport` interface;
  `websocket.ts` is the only implementation. `socket.ts` (`Socket`) drives a
  `TelnetClient` from the transport's raw `EvtData`.
- **protocol/** — `telnet.ts`/`telnetlib.ts` (IAC/telnet negotiation), `mxp.ts`
  (MUD eXtension Protocol), `color.ts` (ANSI/xterm-256 SGR → spans).
- **manager/** — stateful processing: `output.ts` (renders the byte stream to the
  output window, handles SGR/UTF-8/MXP toggles), `trigger.ts`, `alias.ts`.
- **ui/** — DOM widgets: `outputWin.ts`/`outputBase.ts` (the bespoke terminal
  renderer), `commandInput.ts`, `menuBar.ts`.
- **panel/** — floating `.mudpanel` editors (alias, trigger, script, about) sharing
  `base.ts`.
- **core/** — `script.ts` (user JS scripting sandbox + `EvtScriptEmit*` events),
  `config.ts` (build/deploy config, fed by Vite `define` + `VITE_*` env vars) vs
  `userConfig.ts` (per-user settings persisted in the browser), `appInfo.ts`.

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
