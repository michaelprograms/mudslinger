# Manual Smoke Test

End-to-end check that the browser client and the MUD talk to each other over a
direct WebSocket after a build. Run top to bottom.

## Setup

Point `static/public/config.js` at a MUD that exposes a WebSocket port (e.g. a
FluffOS `external_port ... websocket`); set `mudWsUrl` accordingly. Then build
and serve:

```bash
cd ~/projects/mudslinger
npm run build && npm start
```

Then open <http://localhost:5000> in the browser.

## Checks

- [ ] **Page loads**: no console errors in DevTools; the client UI renders.
- [ ] **Connects**: click connect; status shows connected, no WebSocket error
      in the console.
- [ ] **Banner renders**: the MUD's login/welcome banner appears in the output
      window (server to client telnet data flows + ANSI renders).
- [ ] **Input echo / round-trip**: type a command (e.g. `look`, or press enter
      at the login prompt); the MUD responds.
- [ ] **Color / formatting**: ANSI colors show and lines wrap correctly
      (confirms no byte corruption over the binary WebSocket frames).
- [ ] **Reconnect**: disconnect from the client, then reconnect; verify the
      banner appears again.
- [ ] **Clean disconnect**: disconnect from the client; the connection closes
      with no console errors.

If all checks pass, the manual smoke test is fully satisfied.
