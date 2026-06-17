# Manual Smoke Test

End-to-end check that the browser client, the socket.io proxy, and the MUD all
talk to each other after a build. Run top to bottom.

## Setup (two terminals)

### Terminal 1 — proxy

```bash
cd ~/projects/mudslinger/telnet_proxy
npm run build && npm start
```

Expect: `Server is running on 0.0.0.0:8080` (no admin CLI/API lines).

### Terminal 2 — browser bundle + static server

```bash
cd ~/projects/mudslinger/browser
NODE_OPTIONS=--openssl-legacy-provider npm run build
npx http-server static/public -p 5000
```

Then open <http://localhost:5000> in the browser.

## Checks

- [ ] **Page loads** — no console errors in DevTools; the client UI renders.
- [ ] **Connects** — click connect; status shows connected, no `connect_error`
      in the console.
- [ ] **Banner renders** — the MUD's login/welcome banner appears in the output
      window (server→client telnet data flows + ANSI renders).
- [ ] **Input echo / round-trip** — type a command (e.g. `look`, or press enter
      at the login prompt); the MUD responds (client→server `clReqTelnetWrite`).
- [ ] **Color / formatting** — ANSI colors show and lines wrap correctly
      (confirms no Buffer/byte corruption).
- [ ] **Reconnect after proxy restart** — Ctrl-C Terminal 1, confirm the client
      shows a disconnect; restart `npm start`, reconnect from the client, verify
      the banner appears again.
- [ ] **Clean disconnect** — disconnect from the client; Terminal 1 logs a
      `::closed after N seconds` line with no errors.

If all checks pass, the manual smoke test is fully satisfied.
