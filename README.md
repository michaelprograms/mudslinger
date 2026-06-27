# Mudslinger

A self-hosted, web-based MUD client. Players open a page in their browser and
are connected to a single MUD automatically; there is nothing to install on the
client side. It renders MUD output (ANSI, XTERM 256 color, UTF-8, MXP) and sends
player input.

The client connects directly to a MUD's native WebSocket port (e.g. a FluffOS
`external_port ... websocket`), which carries the telnet byte stream as binary
WebSocket frames. The telnet protocol stack (IAC negotiation, MXP, MSDP) runs in
the browser. Use a `wss://` URL when serving the page over HTTPS, or the browser
will block the connection as mixed content. The player's client IP is not
available to the MUD, since there is no proxy to report it.

End-user documentation lives in [`userdocs/`](userdocs/). This file is for
developers and operators.

## Prerequisites

- Node.js >= 20

## Configuration

Copy the defaults and edit them:

```bash
cp static/public/config.default.js static/public/config.js
```

`config.js` is gitignored (it is per-deployment) and is loaded at runtime by the
page. Fields:

| Field      | Meaning                                                       |
| ---------- | ------------------------------------------------------------- |
| `mudWsUrl` | MUD WebSocket URL, e.g. `ws://host:port` or `wss://host:port` |
| `mudName`  | Display name of the MUD this instance serves                  |
| `mudHost`  | Display-only address of the MUD                               |
| `mudPort`  | Display-only port of the MUD                                  |
| `msdp`     | Enable the MSDP gauge/map side panel (MUD must support it)    |

## Build and run

```bash
npm install
npm run build          # production bundle
npm run build-dev      # unminified bundle for debugging
```

The build runs in three stages: `tsc` compiles TypeScript to `build/`, `webpack`
bundles it into `static/public/`, and `buildDocs.js` renders the product docs.
Then serve the built `static/public/` directory on port 5000:

```bash
npm start
```

Then open <http://localhost:5000>.

## Docs

The user-facing docs live in [`userdocs/`](userdocs/) as Markdown.
`npm run build-docs` renders them to `static/public/docs/*.html` so the in-app
Docs link resolves. The full build runs this step automatically.

## Tests

```bash
npm run build-test     # build the QUnit test bundle
```

## Deployment

VPS deployment is a planned phase and not yet documented here.

## License

[MIT](userdocs/LICENSE.md)
