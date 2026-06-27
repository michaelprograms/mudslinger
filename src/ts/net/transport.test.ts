import { describe, it, expect } from 'vitest';
import { MudslingerConfig } from "../core/config";
import { makeTransport } from "./transport";
import { WebSocketTransport } from "./websocket";

function cfg(over: Partial<MudslingerConfig>): MudslingerConfig {
    return Object.assign({ mudUrl: "wss://example.com:16666", mudName: "Test" }, over);
}

describe("Transport factory", () => {
    it("returns WebSocketTransport", () => {
        expect(makeTransport(cfg({}))).toBeInstanceOf(WebSocketTransport);
    });

    it("missing mudUrl throws", () => {
        expect(() => makeTransport(cfg({ mudUrl: undefined }))).toThrow(/mudUrl/);
    });
});
