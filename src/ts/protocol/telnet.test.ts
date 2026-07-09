import { describe, it, expect } from 'vitest';
import { parseNewEnvSeq, NewEnv, TelnetClient, ExtOpt } from "./telnet";
import { Telnet, Cmd, MAX_SB_LEN } from "./telnetlib";

function arrayFromString(str: string): number[] {
    return Array.from(str).map(c => c.charCodeAt(0));
}

describe("NEW-ENVIRON", () => {
    it("parse send all", () => {
        expect(parseNewEnvSeq([NewEnv.SEND])).toEqual([[NewEnv.SEND, null, ""]]);
    });

    it("parse send all var", () => {
        expect(parseNewEnvSeq([NewEnv.SEND, NewEnv.VAR])).toEqual([[NewEnv.SEND, NewEnv.VAR, ""]]);
    });

    it("parse send all uservar", () => {
        expect(parseNewEnvSeq([NewEnv.SEND, NewEnv.USERVAR])).toEqual([[NewEnv.SEND, NewEnv.USERVAR, ""]]);
    });

    it("parse send all var and uservar", () => {
        expect(parseNewEnvSeq([NewEnv.SEND, NewEnv.USERVAR, NewEnv.VAR])).toEqual([
            [NewEnv.SEND, NewEnv.USERVAR, ""],
            [NewEnv.SEND, NewEnv.VAR, ""],
        ]);
    });

    it("parse send single var", () => {
        const input = [NewEnv.SEND, NewEnv.VAR].concat(arrayFromString("CHARSET"));
        expect(parseNewEnvSeq(input)).toEqual([[NewEnv.SEND, NewEnv.VAR, "CHARSET"]]);
    });

    it("parse send single uservar", () => {
        const input = [NewEnv.SEND, NewEnv.USERVAR].concat(arrayFromString("CHARSET"));
        expect(parseNewEnvSeq(input)).toEqual([[NewEnv.SEND, NewEnv.USERVAR, "CHARSET"]]);
    });

    it("parse send multi var (repeated send)", () => {
        const input = [NewEnv.SEND, NewEnv.VAR].concat(
            arrayFromString("CLIENT_NAME"),
            [NewEnv.SEND, NewEnv.VAR],
            arrayFromString("CLIENT_VERSION"));
        expect(parseNewEnvSeq(input)).toEqual([
            [NewEnv.SEND, NewEnv.VAR, "CLIENT_NAME"],
            [NewEnv.SEND, NewEnv.VAR, "CLIENT_VERSION"],
        ]);
    });

    it("parse send multi var (single send)", () => {
        const input = [NewEnv.SEND, NewEnv.VAR].concat(
            arrayFromString("CLIENT_NAME"),
            [NewEnv.VAR],
            arrayFromString("CLIENT_VERSION"));
        expect(parseNewEnvSeq(input)).toEqual([
            [NewEnv.SEND, NewEnv.VAR, "CLIENT_NAME"],
            [NewEnv.SEND, NewEnv.VAR, "CLIENT_VERSION"],
        ]);
    });

    it("parse send example 1", () => {
        const input = [NewEnv.SEND, NewEnv.VAR].concat(
            arrayFromString("USER"),
            [NewEnv.VAR],
            arrayFromString("ACCT"),
            [NewEnv.VAR],
            [NewEnv.USERVAR]);
        expect(parseNewEnvSeq(input)).toEqual([
            [NewEnv.SEND, NewEnv.VAR, "USER"],
            [NewEnv.SEND, NewEnv.VAR, "ACCT"],
            [NewEnv.SEND, NewEnv.VAR, ""],
            [NewEnv.SEND, NewEnv.USERVAR, ""],
        ]);
    });
});

/* ---------- GMCP + subnegotiation ---------- */

function makeGmcpClient() {
    const writes: number[][] = [];
    const client = new TelnetClient((data) => { writes.push(Array.from(new Uint8Array(data))); });
    // Server offers GMCP; client should reply DO and enable it.
    client.handleData(new Uint8Array([Cmd.IAC, Cmd.WILL, ExtOpt.GMCP]).buffer);
    return { client, writes };
}

function gmcpFrame(payload: string): ArrayBuffer {
    const bytes = new TextEncoder().encode(payload);
    const arr = [Cmd.IAC, Cmd.SB, ExtOpt.GMCP];
    for (const b of bytes) {
        arr.push(b);
        if (b === Cmd.IAC) arr.push(Cmd.IAC);
    }
    arr.push(Cmd.IAC, Cmd.SE);
    return new Uint8Array(arr).buffer;
}

describe("GMCP negotiation", () => {
    it("replies DO to WILL GMCP and enables gmcp", () => {
        const { client, writes } = makeGmcpClient();
        expect(client.gmcpEnabled).toBe(true);
        expect(writes).toContainEqual([Cmd.IAC, Cmd.DO, ExtOpt.GMCP]);
    });
});

describe("GMCP decode", () => {
    it("decodes package and JSON body", () => {
        const { client } = makeGmcpClient();
        const got: {pkg: string; data: unknown}[] = [];
        client.EvtGmcp.handle((d) => got.push(d));
        client.handleData(gmcpFrame('Char.Vitals {"hp":10,"maxhp":20}'));
        expect(got).toEqual([{pkg: "Char.Vitals", data: {hp: 10, maxhp: 20}}]);
    });

    it("decodes package with no body", () => {
        const { client } = makeGmcpClient();
        const got: {pkg: string; data: unknown}[] = [];
        client.EvtGmcp.handle((d) => got.push(d));
        client.handleData(gmcpFrame("Core.Ping"));
        expect(got).toEqual([{pkg: "Core.Ping", data: null}]);
    });

    it("decodes multi-byte UTF-8 payloads correctly", () => {
        const { client } = makeGmcpClient();
        const got: {pkg: string; data: unknown}[] = [];
        client.EvtGmcp.handle((d) => got.push(d));
        client.handleData(gmcpFrame('Ide.Content {"data":"héllo → wörld"}'));
        expect(got.length).toBe(1);
        expect((got[0].data as any).data).toBe("héllo → wörld");
    });

    it("survives split frames across handleData calls", () => {
        const { client } = makeGmcpClient();
        const got: {pkg: string; data: unknown}[] = [];
        client.EvtGmcp.handle((d) => got.push(d));
        const frame = new Uint8Array(gmcpFrame('Ide.Dir {"path":"/realms"}'));
        client.handleData(frame.slice(0, 7).buffer);
        client.handleData(frame.slice(7).buffer);
        expect(got).toEqual([{pkg: "Ide.Dir", data: {path: "/realms"}}]);
    });
});

describe("GMCP encode (sendGmcp)", () => {
    it("frames package with JSON body", () => {
        const { client, writes } = makeGmcpClient();
        writes.length = 0;
        client.sendGmcp("Ide.Auth", {token: "abc"});
        const expected = [Cmd.IAC, Cmd.SB, ExtOpt.GMCP]
            .concat(Array.from(new TextEncoder().encode('Ide.Auth {"token":"abc"}')),
                    [Cmd.IAC, Cmd.SE]);
        expect(writes).toEqual([expected]);
    });

    it("frames package without body", () => {
        const { client, writes } = makeGmcpClient();
        writes.length = 0;
        client.sendGmcp("Core.Ping");
        expect(writes).toEqual([[Cmd.IAC, Cmd.SB, ExtOpt.GMCP]
            .concat(Array.from(new TextEncoder().encode("Core.Ping")), [Cmd.IAC, Cmd.SE])]);
    });

    it("encodes multi-byte UTF-8 and round-trips through the decoder", () => {
        const { client, writes } = makeGmcpClient();
        writes.length = 0;
        client.sendGmcp("Ide.Save", {data: "ünïcode ☃"});
        const { client: rx } = makeGmcpClient();
        const got: {pkg: string; data: unknown}[] = [];
        rx.EvtGmcp.handle((d) => got.push(d));
        rx.handleData(new Uint8Array(writes[0]).buffer);
        expect(got).toEqual([{pkg: "Ide.Save", data: {data: "ünïcode ☃"}}]);
    });
});

describe("subnegotiation buffer", () => {
    it("un-escapes doubled IAC inside SB payloads", () => {
        const t = new Telnet(() => {});
        let sb: number[] = [];
        t.EvtNegotiation.handle(({cmd, opt}) => {
            if (cmd === Cmd.SE && opt === null) sb = t.readSbArr();
            return true;
        });
        t.handleData(new Uint8Array(
            [Cmd.IAC, Cmd.SB, 42, 1, Cmd.IAC, Cmd.IAC, 2, Cmd.IAC, Cmd.SE]).buffer);
        expect(sb).toEqual([42, 1, Cmd.IAC, 2]);
    });

    it("drops oversized SB frames and recovers", () => {
        const { client } = makeGmcpClient();
        const got: {pkg: string; data: unknown}[] = [];
        client.EvtGmcp.handle((d) => got.push(d));

        const huge = new Uint8Array(MAX_SB_LEN + 64);
        huge.fill(97 /* 'a' */);
        client.handleData(new Uint8Array([Cmd.IAC, Cmd.SB, ExtOpt.GMCP]).buffer);
        client.handleData(huge.buffer);
        client.handleData(new Uint8Array([Cmd.IAC, Cmd.SE]).buffer);
        expect(got).toEqual([]);

        client.handleData(gmcpFrame("Core.Ping"));
        expect(got).toEqual([{pkg: "Core.Ping", data: null}]);
    });
});

