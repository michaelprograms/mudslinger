import { describe, it, expect } from 'vitest';
import { IdeClient, IdeError, contentHash, crc32str, chunkString } from "./ideClient";

/** Flush microtasks + timer turns so async save() has sent its messages
 * (crypto.subtle.digest may take more than one turn to resolve). */
const tick = async () => {
    for (let i = 0; i < 10; i++) {
        await new Promise<void>((r) => setTimeout(r, 0));
    }
};

/** Fake transport capturing outgoing GMCP messages. */
function makeClient() {
    const sent: {pkg: string; data: any}[] = [];
    const client = new IdeClient({
        sendGmcp: (pkg: string, data?: unknown) => {
            sent.push({pkg, data});
            return true;
        },
    });
    return { client, sent };
}

function refOf(sent: {pkg: string; data: any}[], pkg: string): number {
    const m = sent.filter(s => s.pkg === pkg);
    return m[m.length - 1].data.ref;
}

describe("crc32str", () => {
    it("matches known vectors (decimal string, IEEE crc32)", () => {
        expect(crc32str("")).toBe("0");
        expect(crc32str("123456789")).toBe(String(0xCBF43926));
    });

    it("hashes UTF-8 bytes, not UTF-16 units", () => {
        expect(crc32str("é")).not.toBe(crc32str("e"));
    });
});

describe("contentHash", () => {
    it("sha256 matches standard vectors", async () => {
        expect(await contentHash("abc", "sha256"))
            .toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
        expect(await contentHash("", "sha256"))
            .toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    });

    it("falls back to crc32, and null for unknown algorithms", async () => {
        expect(await contentHash("123456789", "crc32")).toBe(crc32str("123456789"));
        expect(await contentHash("x", "md5-of-the-future")).toBeNull();
    });
});

describe("chunkString", () => {
    it("returns single chunk when under limit", () => {
        expect(chunkString("abc", 10)).toEqual(["abc"]);
    });

    it("splits by UTF-8 byte size without splitting code points", () => {
        const s = "aé☃".repeat(10); // 1+2+3 = 6 bytes per repeat
        const parts = chunkString(s, 7);
        expect(parts.join("")).toBe(s);
        for (const p of parts) {
            expect(new TextEncoder().encode(p).length).toBeLessThanOrEqual(7);
        }
    });
});

describe("IdeClient", () => {
    it("hello sends Core.Supports.Add then Ide.Hello, resolves on Welcome", async () => {
        const { client, sent } = makeClient();
        const p = client.hello();
        expect(sent[0]).toEqual({pkg: "Core.Supports.Add", data: ["Ide 1"]});
        expect(sent[1].pkg).toBe("Ide.Hello");

        client.handleGmcp("Ide.Welcome", {
            version: 1, scopes: ["/realms/kal/"],
            limits: {maxChunk: 16, maxFile: 500000, hashAlgo: "crc32"},
            ref: sent[1].data.ref,
        });
        const w = await p;
        expect(w.scopes).toEqual(["/realms/kal/"]);
        expect(w.limits.maxChunk).toBe(16);
        expect(client.ready).toBe(true);
    });

    it("list resolves with entries", async () => {
        const { client, sent } = makeClient();
        const p = client.list("/realms/kal");
        client.handleGmcp("Ide.Dir", {
            path: "/realms/kal",
            entries: [{name: "workroom.c", type: "file", size: 12, mtime: 5}],
            ref: refOf(sent, "Ide.List"),
        });
        expect(await p).toEqual([{name: "workroom.c", type: "file", size: 12, mtime: 5}]);
    });

    it("open reassembles chunked content in order", async () => {
        const { client, sent } = makeClient();
        const p = client.open("/realms/kal/big.c");
        const ref = refOf(sent, "Ide.Open");
        client.handleGmcp("Ide.Content", {path: "/realms/kal/big.c", hash: "42", size: 6, chunk: 0, chunks: 2, data: "abc", ref});
        client.handleGmcp("Ide.Content", {path: "/realms/kal/big.c", hash: "42", size: 6, chunk: 1, chunks: 2, data: "def", ref});
        const c = await p;
        expect(c.content).toBe("abcdef");
        expect(c.hash).toBe("42");
    });

    it("small save uses single Ide.Save and resolves SaveResult", async () => {
        const { client, sent } = makeClient();
        const p = client.save("/realms/kal/a.c", "int x;", "999");
        await tick();
        const msg = sent.find(s => s.pkg === "Ide.Save")!;
        expect(msg.data.baseHash).toBe("999");
        expect(msg.data.hash).toBe(await contentHash("int x;", "sha256"));
        client.handleGmcp("Ide.SaveResult", {
            path: "/realms/kal/a.c", ok: 1, newHash: msg.data.hash,
            compiled: 1, reloaded: 1, diagnostics: [], ref: msg.data.ref,
        });
        const r = await p;
        expect(r.ok).toBe(true);
        expect(r.diagnostics).toEqual([]);
    });

    it("large save uses SaveBegin/SaveChunk/SaveCommit", async () => {
        const { client, sent } = makeClient();
        // negotiate a tiny maxChunk
        const pHello = client.hello();
        client.handleGmcp("Ide.Welcome", {
            version: 1, scopes: ["/"],
            limits: {maxChunk: 4, maxFile: 500000, hashAlgo: "crc32"},
            ref: refOf(sent, "Ide.Hello"),
        });
        await pHello;

        const p = client.save("/realms/kal/a.c", "abcdefgh", "1");
        await tick();
        const begin = sent.find(s => s.pkg === "Ide.SaveBegin")!;
        const chunks = sent.filter(s => s.pkg === "Ide.SaveChunk");
        const commit = sent.find(s => s.pkg === "Ide.SaveCommit")!;
        expect(begin.data.chunks).toBe(2);
        expect(chunks.map(c => c.data.data)).toEqual(["abcd", "efgh"]);
        expect(chunks.map(c => c.data.chunk)).toEqual([0, 1]);
        expect(begin.data.txn).toBe(chunks[0].data.txn);
        expect(begin.data.hash).toBe(crc32str("abcdefgh")); // negotiated crc32 fallback

        client.handleGmcp("Ide.SaveResult", {
            path: "/realms/kal/a.c", ok: 1, compiled: 1, reloaded: 1,
            diagnostics: [], ref: commit.data.ref,
        });
        expect((await p).ok).toBe(true);
    });

    it("delete and mkdir resolve on their results", async () => {
        const { client, sent } = makeClient();
        const pDel = client.delete("/realms/kal/old.c");
        client.handleGmcp("Ide.DeleteResult", {path: "/realms/kal/old.c", ok: 1, ref: refOf(sent, "Ide.Delete")});
        expect(await pDel).toMatchObject({path: "/realms/kal/old.c", ok: 1});

        const pMk = client.mkdir("/realms/kal/rooms");
        client.handleGmcp("Ide.MkdirResult", {path: "/realms/kal/rooms", ok: 1, ref: refOf(sent, "Ide.Mkdir")});
        expect(await pMk).toMatchObject({path: "/realms/kal/rooms", ok: 1});
    });

    it("rejects with IdeError on correlated Ide.Error (stale)", async () => {
        const { client, sent } = makeClient();
        const p = client.save("/realms/kal/a.c", "x", "old");
        await tick();
        const msg = sent.find(s => s.pkg === "Ide.Save")!;
        client.handleGmcp("Ide.Error", {
            code: "stale", message: "File changed", path: "/realms/kal/a.c",
            currentHash: "new", ref: msg.data.ref,
        });
        await expect(p).rejects.toMatchObject({code: "stale", currentHash: "new"});
    });

    it("failed compile SaveResult carries diagnostics", async () => {
        const { client, sent } = makeClient();
        const p = client.save("/realms/kal/a.c", "int x", "1");
        await tick();
        const msg = sent.find(s => s.pkg === "Ide.Save")!;
        client.handleGmcp("Ide.SaveResult", {
            path: "/realms/kal/a.c", ok: 0, compiled: 0, reloaded: 0,
            diagnostics: [{path: "/realms/kal/a.c", line: 1, col: 0, severity: "error", message: "Missing ';'"}],
            ref: msg.data.ref,
        });
        const r = await p;
        expect(r.ok).toBe(false);
        expect(r.diagnostics[0].line).toBe(1);
    });

    it("fires EvtEvent for unsolicited events and EvtError for unrefd errors", () => {
        const { client } = makeClient();
        const events: any[] = [];
        const errors: IdeError[] = [];
        client.EvtEvent.handle(e => events.push(e));
        client.EvtError.handle(e => errors.push(e));
        client.handleGmcp("Ide.Event", {type: "modified", path: "/a.c", who: "suzy"});
        client.handleGmcp("Ide.Error", {code: "denied", message: "nope"});
        expect(events).toEqual([{type: "modified", path: "/a.c", who: "suzy"}]);
        expect(errors[0].code).toBe("denied");
    });

    it("reset rejects in-flight requests and drops the session", async () => {
        const { client, sent } = makeClient();
        const pHello = client.hello();
        client.handleGmcp("Ide.Welcome", {version: 1, scopes: [], limits: {}, ref: refOf(sent, "Ide.Hello")});
        await pHello;
        const p = client.list("/realms");
        client.reset();
        await expect(p).rejects.toMatchObject({code: "disconnected"});
        expect(client.ready).toBe(false);
    });
});
