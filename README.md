# Mudslinger

A self-hosted, web-based MUD client. Players open a page in their browser and
are connected to a single MUD automatically; there is nothing to install on the
client side.

End-user documentation lives in [`userdocs/`](userdocs/). This file is for
developers and operators.

## Architecture

The project is a small monorepo of three Node.js / TypeScript components:

- **`browser/`** the single-page web client. Renders MUD output (ANSI, XTERM
  256 color, UTF-8, MXP) and sends player input. See
  [`browser/README.md`](browser/README.md).
- **`telnet_proxy/`** a Node.js / Socket.IO service that holds the telnet
  connection to the MUD and relays bytes to and from the browser, since browsers
  cannot open raw TCP sockets. See
  [`telnet_proxy/README.md`](telnet_proxy/README.md).
- **`common/`** the shared Socket.IO event protocol (`ioevent.ts`) used by both
  sides.

Data flow: `browser` <-> Socket.IO <-> `telnet_proxy` <-> telnet <-> MUD.

## Prerequisites

- Node.js >= 20

## Local build and run

Run the proxy and the client in two terminals.

Proxy:

```bash
cd telnet_proxy
cp configServer.default.js configServer.js   # first time; edit mudHost/mudPort
npm install
npm run build
npm start
```

Browser:

```bash
cd browser
cp static/public/config.default.js static/public/config.js   # first time
npm install
npm run build
npx http-server static/public -p 5000
```

Then open <http://localhost:5000>. Each component's README documents its own
config fields.

After a build, run through [`docs/SMOKE_TEST.md`](docs/SMOKE_TEST.md) to confirm
the client, proxy, and MUD all talk to each other.

## Deployment

VPS deployment is a planned phase and not yet documented here.

## License

[MIT](userdocs/LICENSE.md)
