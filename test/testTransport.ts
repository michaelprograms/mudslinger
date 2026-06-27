import { MudslingerConfig } from "../src/ts/clientConfig";
import { makeTransport } from "../src/ts/transport";
import { WebSocketTransport } from "../src/ts/webSocketTransport";

function cfg(over: Partial<MudslingerConfig>): MudslingerConfig {
    return Object.assign({
        mudWsUrl: "wss://example.com:16666",
        mudName: "Test",
        mudHost: "127.0.0.1",
        mudPort: 4000,
        msdp: false
    }, over);
}

export function test() {

QUnit.module("Transport factory");

QUnit.test("returns WebSocketTransport", (assert: Assert) => {
    let t = makeTransport(cfg({}));
    assert.ok(t instanceof WebSocketTransport);
});

QUnit.test("missing mudWsUrl throws", (assert: Assert) => {
    assert.throws(() => {
        makeTransport(cfg({ mudWsUrl: undefined }));
    }, /mudWsUrl/);
});

};
