// Permanent integration test for the telnet proxy.
// Proves two things end-to-end through socket.io:
//  1. The proxy ignores a client-supplied target and dials the configured MUD.
//  2. Binary telnet frames round-trip with EXACT bytes (no pooled-buffer leak).
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const assert = require("assert");
const { startStubMud, BANNER } = require("./stubMud");

const PROXY_PORT = 18080;
const BANNER_BUF = Buffer.from(BANNER, "utf8");

function toBuf(d) {
  if (Buffer.isBuffer(d)) return d;
  if (d instanceof ArrayBuffer) return Buffer.from(new Uint8Array(d));
  if (d && d.buffer instanceof ArrayBuffer) {
    return Buffer.from(new Uint8Array(d.buffer, d.byteOffset || 0, d.byteLength));
  }
  return Buffer.from(String(d), "utf8");
}

async function main() {
  const mud = await startStubMud();

  const cfg = [
    'var config = {};',
    'config.serverHost = "127.0.0.1";',
    'config.serverPort = ' + PROXY_PORT + ';',
    'config.mudHost = "127.0.0.1";',
    'config.mudPort = ' + mud.port + ';',
    'config.corsOrigin = "*";',
    'config.adminHost = "localhost";',
    'config.adminPort = 0;',
    'config.adminWebHost = "localhost";',
    'config.adminWebPort = 0;',
    'module.exports = config;',
    '',
  ].join("\n");
  const cfgPath = path.join(os.tmpdir(), "mudslinger-proxy-test-" + process.pid + ".js");
  fs.writeFileSync(cfgPath, cfg);

  const appPath = path.join(__dirname, "..", "dist", "telnet_proxy", "src", "app.js");
  const proxy = spawn(process.execPath, [appPath], {
    env: Object.assign({}, process.env, { MUDSLINGER_PROXY_CONFIG: cfgPath }),
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderrBuf = "";
  proxy.stderr.on("data", (b) => {
    stderrBuf += b.toString();
    process.stderr.write("[proxy] " + b);
  });

  let finished = false;
  async function cleanup(code, msg) {
    if (finished) return;
    finished = true;
    if (msg) console[code === 0 ? "log" : "error"](msg);
    try { proxy.kill(); } catch (e) {}
    try { await mud.close(); } catch (e) {}
    try { fs.unlinkSync(cfgPath); } catch (e) {}
    process.exit(code);
  }

  // Surface an early proxy exit (e.g. port already in use) instead of a 8s timeout.
  proxy.on("exit", (code, signal) => {
    if (finished) return;
    cleanup(1, "FAIL: proxy exited early (code=" + code + ", signal=" + signal + ")\n" +
      stderrBuf.slice(-500));
  });

  const timer = setTimeout(() => cleanup(1, "FAIL: timeout"), 8000);

  // Wait for the proxy to be listening.
  await new Promise((resolve) => {
    const onReady = (b) => {
      if (b.toString().includes("Server is running")) {
        proxy.stdout.removeListener("data", onReady);
        resolve();
      }
    };
    proxy.stdout.on("data", onReady);
  });

  const io = require("socket.io-client");
  const sock = io("http://127.0.0.1:" + PROXY_PORT + "/telnet", {
    transports: ["websocket", "polling"],
  });

  let received = Buffer.alloc(0);
  let phase = "banner"; // banner -> echo

  sock.on("connect", () => {
    // Deliberately bogus target: the proxy must ignore it.
    sock.emit("clReqTelnetOpen", ["evil.example.com", 6666]);
  });

  sock.on("srvTelnetOpened", (val) => {
    try {
      assert.deepStrictEqual(val, ["127.0.0.1", mud.port],
        "hardwire failed; proxy dialed " + JSON.stringify(val));
    } catch (e) { clearTimeout(timer); cleanup(1, "FAIL: " + e.message); }
  });

  sock.on("srvTelnetData", (d) => {
    received = Buffer.concat([received, toBuf(d)]);
    try {
      if (phase === "banner" && received.length >= BANNER_BUF.length) {
        assert.ok(received.slice(0, BANNER_BUF.length).equals(BANNER_BUF),
          "banner bytes mismatch: " + JSON.stringify(received.toString("utf8")));
        assert.strictEqual(received.length, BANNER_BUF.length,
          "extra bytes after banner (pooled-buffer leak): " + received.length);
        phase = "echo";
        received = Buffer.alloc(0);
        const cmd = Buffer.from("hello\r\n", "utf8");
        sock.emit("clReqTelnetWrite",
          cmd.buffer.slice(cmd.byteOffset, cmd.byteOffset + cmd.byteLength));
      } else if (phase === "echo" && received.toString("utf8").includes("you said: hello")) {
        clearTimeout(timer);
        sock.close();
        cleanup(0, "PASS: hardwire + exact-byte round-trip OK");
      }
    } catch (e) { clearTimeout(timer); cleanup(1, "FAIL: " + e.message); }
  });

  sock.on("connect_error", (e) => {
    clearTimeout(timer);
    sock.close();
    cleanup(1, "FAIL: connect_error: " + (e && e.message ? e.message : e));
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
