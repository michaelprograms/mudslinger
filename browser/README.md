# Mudslinger browser client

The web front end: a single-page MUD client that renders MUD output (ANSI, XTERM
256 color, UTF-8, MXP) and sends player input. It talks to the
[telnet proxy](../telnet_proxy/README.md) over Socket.IO; it never opens a raw
telnet socket itself.

## Configuration

Copy the defaults and edit them:

```bash
cp static/public/config.default.js static/public/config.js
```

`config.js` is gitignored (it is per-deployment) and is loaded at runtime by the
page. Fields:

| Field         | Meaning                                                   |
| ------------- | --------------------------------------------------------- |
| `socketIoUrl` | URL of the proxy's Socket.IO `/telnet` namespace          |
| `mudName`     | Display name of the MUD this instance serves              |
| `mudHost`     | Display-only address of the MUD                           |
| `mudPort`     | Display-only port of the MUD                              |
| `msdp`        | Enable the MSDP gauge/map side panel (MUD must support it)|

## Build and run

Requires Node.js >= 20.

```bash
npm install
npm run build          # production bundle
npm run build-dev      # unminified bundle for debugging
```

The build runs in three stages: `tsc` compiles TypeScript to `build/`, `webpack`
bundles it into `static/public/`, and `buildDocs.js` renders the product docs.
Serve the `static/public/` directory with any static file server, for example:

```bash
npx http-server static/public -p 5000
```

## Docs

The user-facing docs live in [`../userdocs/`](../userdocs/) as Markdown.
`npm run build-docs` renders them to `static/public/docs/*.html` so the in-app
Docs link resolves. The full build runs this step automatically.

## Tests

```bash
npm run build-test     # build the QUnit test bundle
```
