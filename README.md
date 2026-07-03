# Mudslinger

A self-hosted, web-based MUD client. Players open a page in their browser and
are connected to a MUD automatically; there is nothing to install on the client
side. It renders MUD output (ANSI, XTERM 256 color, UTF-8) and sends
player input.

The client connects directly to a MUD's native WebSocket port (e.g. a FluffOS
`external_port ... websocket`), which carries the telnet byte stream as binary
WebSocket frames. The telnet protocol stack (IAC negotiation, GMCP) runs
entirely in the browser. Use a `wss://` URL when serving the page over HTTPS,
or the browser will block the connection as mixed content. The player's real IP
is not available to the MUD, since there is no proxy to report it.

## Prerequisites

- Node.js >= 22

## Configuration

Build-time settings are controlled via Vite `define` constants and `VITE_*`
environment variables (see `vite.config.ts`):

| Variable          | Default                                              | Meaning                                    |
| ----------------- | ---------------------------------------------------- | ------------------------------------------ |
| `VITE_MUD_URL`    | `ws://localhost:5000`                                 | MUD WebSocket URL (`ws://` or `wss://`)    |
| `VITE_MUD_NAME`   | `My MUD`                                              | Display name shown in the UI               |
| `VITE_REPO_URL`   | `https://github.com/michaelprograms/mudslinger`       | Repo link in the About panel               |

Set them in a `.env` file (gitignored) or pass inline:

```bash
VITE_MUD_URL=wss://mud.example.com:4200 npm run build
```

## Build and run

```bash
npm install
npm run build          # production bundle -> static/public/assets/
npm run build-dev      # unminified bundle (mode=development)
npm run dev            # Vite dev server with HMR
```

Then serve `static/public/` (the build output) behind a web server. See
`DEPLOY.md` for nginx configuration.

## Tests

```bash
npm test               # vitest run (headless)
npm run typecheck      # tsc --noEmit
```

## License

[MIT](LICENSE.md)
