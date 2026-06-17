# Mudslinger telnet proxy

A small Node.js / Socket.IO service that bridges the browser client to the MUD.
Browsers cannot open raw TCP/telnet sockets, so this proxy holds the telnet
connection to the game and relays bytes both ways over a Socket.IO `/telnet`
namespace.

## How it works

- Listens for Socket.IO clients on `serverHost:serverPort`.
- On a client request, opens a telnet connection to `mudHost:mudPort`.
- Forwards server-to-client bytes as `srvTelnetData` events and
  client-to-server bytes from `clReqTelnetWrite` events, preserving binary
  frames so ANSI and UTF-8 stay intact.
- The destination MUD is fixed by config; the browser does not choose it.

## Configuration

Copy the defaults and edit them:

```bash
cp configServer.default.js configServer.js
```

`configServer.js` is gitignored (it is per-deployment). Fields:

| Field         | Meaning                                              | Default       |
| ------------- | ---------------------------------------------------- | ------------- |
| `serverHost`  | Address the proxy binds to                           | `0.0.0.0`     |
| `serverPort`  | Port the proxy listens on                            | `80`          |
| `mudHost`     | Address of the MUD to connect to                     | `127.0.0.1`   |
| `mudPort`     | Port of the MUD to connect to                        | `4000`        |
| `corsOrigin`  | Allowed browser origin (`*` for any, or your domain) | `*`           |

`mudHost` and `mudPort` are required; the proxy throws on startup if they are
missing. The config path can be overridden with the `MUDSLINGER_PROXY_CONFIG`
environment variable.

## Build and run

Requires Node.js >= 20.

```bash
npm install
npm run build      # tsc -> dist/
npm start          # node dist/telnet_proxy/src/app.js
```

On startup it prints the loaded config and
`Server is running on <serverHost>:<serverPort>`.

## Test

```bash
npm test           # unit test + integration test
```
