// Reusable stub MUD for integration tests: writes a fixed banner on connect,
// and echoes "you said: <line>" for each newline-terminated line received.
const net = require("net");

const BANNER = "Welcome to the test MUD\r\n";

function startStubMud() {
  return new Promise((resolve) => {
    const server = net.createServer((sock) => {
      sock.write(BANNER);
      let buf = "";
      sock.on("data", (d) => {
        buf += d.toString("utf8");
        let idx;
        while ((idx = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, idx).replace(/\r$/, "");
          buf = buf.slice(idx + 1);
          sock.write("you said: " + line + "\r\n");
        }
      });
      sock.on("error", () => {});
    });
    server.listen(0, "127.0.0.1", () => {
      resolve({
        port: server.address().port,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

module.exports = { startStubMud, BANNER };
