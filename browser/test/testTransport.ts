import { MudslingerConfig } from "../src/ts/clientConfig";
import { makeTransport } from "../src/ts/transport";
import { ProxyTransport } from "../src/ts/proxyTransport";
import { WebSocketTransport } from "../src/ts/webSocketTransport";

function cfg(over: Partial<MudslingerConfig>): MudslingerConfig {
    return Object.assign({
        socketIoUrl: "http://localhost:8080/telnet",
        mudName: "Test",
        mudHost: "127.0.0.1",
        mudPort: 4000,
        msdp: false
    }, over);
}

export function test() {

QUnit.module("Transport factory");

QUnit.test("defaults to proxy when transport unset", (assert: Assert) => {
    let t = makeTransport(cfg({}));
    assert.ok(t instanceof ProxyTransport);
});

QUnit.test("proxy mode returns ProxyTransport", (assert: Assert) => {
    let t = makeTransport(cfg({ transport: "proxy" }));
    assert.ok(t instanceof ProxyTransport);
});

QUnit.test("websocket mode returns WebSocketTransport", (assert: Assert) => {
    let t = makeTransport(cfg({ transport: "websocket", mudWsUrl: "wss://example.com:16666" }));
    assert.ok(t instanceof WebSocketTransport);
});

QUnit.test("websocket mode without mudWsUrl throws", (assert: Assert) => {
    assert.throws(() => {
        makeTransport(cfg({ transport: "websocket" }));
    }, /mudWsUrl/);
});

};
