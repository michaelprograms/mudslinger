# Mudslinger browser client

The web front end: a single-page MUD client that renders MUD output (ANSI, XTERM
256 color, UTF-8, MXP) and sends player input.

It supports two transports, chosen by the `transport` config field:

- **`proxy`** (default): talks to the [telnet proxy](../telnet_proxy/README.md)
  over Socket.IO. The proxy opens the raw telnet socket to the MUD.
- **`websocket`**: connects directly to a MUD's native WebSocket port (e.g. a
  FluffOS `external_port ... websocket`), which carries the telnet byte stream as
  binary WebSocket frames. No proxy is involved. Use a `wss://` URL when serving
  the page over HTTPS (mixed content is blocked). In this mode the player's client
  IP is not available to the MUD, since there is no proxy to report it.

The telnet protocol stack (IAC negotiation, MXP, MSDP) runs in the browser
regardless of transport.

## Configuration

Copy the defaults and edit them:

```bash
cp static/public/config.default.js static/public/config.js
```

`config.js` is gitignored (it is per-deployment) and is loaded at runtime by the
page. Fields:

| Field         | Meaning                                                      |
| ------------- | ------------------------------------------------------------ |
| `transport`   | `"proxy"` (default) or `"websocket"`                         |
| `socketIoUrl` | URL of the proxy's Socket.IO `/telnet` namespace (proxy mode)|
| `mudWsUrl`    | Direct MUD WebSocket URL, e.g. `wss://host:port` (ws mode)   |
| `mudName`     | Display name of the MUD this instance serves                 |
| `mudHost`     | Display-only address of the MUD                              |
| `mudPort`     | Display-only port of the MUD                                 |
| `msdp`        | Enable the MSDP gauge/map side panel (MUD must support it)   |

## Build and run

Requires Node.js >= 20.

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

## Docs

The user-facing docs live in [`../userdocs/`](../userdocs/) as Markdown.
`npm run build-docs` renders them to `static/public/docs/*.html` so the in-app
Docs link resolves. The full build runs this step automatically.

## Tests

```bash
npm run build-test     # build the QUnit test bundle
```
