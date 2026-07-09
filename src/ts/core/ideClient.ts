import { EventHook } from "./event";

/**
 * Client side of the GMCP "Ide" package (out-of-band mudlib editing).
 * Protocol spec: ide-over-gmcp-design.md in the workspace root; server side
 * is merentha lib/secure/daemon/ide.c.
 *
 * Handles the Hello handshake, request/ref correlation, chunked content
 * assembly and chunked save transactions. UI-free: the IDE panel consumes
 * the promise API and the event hooks. There is no auth step: the MUD
 * connection is already authenticated and the server derives edit scopes
 * from the character's privileges.
 */

export interface IdeDirEntry {
    name: string;
    type: "file" | "dir";
    size: number;
    mtime: number;
}

export interface IdeDiagnostic {
    path: string;
    line: number;
    col: number;
    severity: "error" | "warning";
    message: string;
}

export interface IdeLimits {
    maxChunk: number;
    maxFile: number;
    hashAlgo: string;
}

export interface IdeWelcome {
    version: number;
    scopes: string[];
    limits: IdeLimits;
}

export interface IdeFileInfo {
    path: string;
    size: number;
    mtime: number;
    hash: string;
}

export interface IdeContent {
    path: string;
    content: string;
    hash: string;
    size: number;
}

export interface IdeSaveResult {
    path: string;
    ok: boolean;
    newHash?: string;
    compiled: boolean;
    reloaded: boolean;
    diagnostics: IdeDiagnostic[];
}

export interface IdeEvent {
    type: string;
    path?: string;
    who?: string;
}

export class IdeError extends Error {
    constructor(
        public code: string,
        message: string,
        public path?: string,
        public currentHash?: string,
    ) {
        super(message);
        this.name = "IdeError";
    }
}

export interface IdeTransport {
    sendGmcp(pkg: string, data?: unknown): boolean;
}

/* ---------- content hashing ----------
 *
 * The server negotiates the algorithm via Welcome.limits.hashAlgo
 * ("sha256" on current servers). crc32 (standard IEEE, final xor included)
 * is kept as a legacy fallback. When the algorithm is unknown or Web Crypto
 * is unavailable (non-localhost http page), the content hash is simply
 * omitted; the server treats it as optional transport-integrity data. */

const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        t[n] = c >>> 0;
    }
    return t;
})();

/** crc32 over the UTF-8 bytes of str, as a decimal string (server format). */
export function crc32str(str: string): string {
    const bytes = new TextEncoder().encode(str);
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
        c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    }
    return ((c ^ 0xffffffff) >>> 0).toString(10);
}

/** Hash str's UTF-8 bytes with the negotiated algorithm, or null to skip. */
export async function contentHash(str: string, algo: string): Promise<string | null> {
    if (algo === "crc32") return crc32str(str);
    if (algo === "sha256" && globalThis.crypto?.subtle) {
        const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
        return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    return null;
}

/** Split into pieces of at most maxBytes UTF-8 bytes, never splitting a code point. */
export function chunkString(content: string, maxBytes: number): string[] {
    const enc = new TextEncoder();
    if (enc.encode(content).length <= maxBytes) return [content];
    const out: string[] = [];
    let piece = "";
    let pieceBytes = 0;
    for (const ch of content) { // iterates by code point, keeps surrogate pairs whole
        const chBytes = ch.length > 1 ? 4 : ch.charCodeAt(0) < 0x80 ? 1 : ch.charCodeAt(0) < 0x800 ? 2 : 3;
        if (pieceBytes + chBytes > maxBytes && piece.length > 0) {
            out.push(piece);
            piece = "";
            pieceBytes = 0;
        }
        piece += ch;
        pieceBytes += chBytes;
    }
    if (piece.length > 0) out.push(piece);
    return out;
}

/* ---------- client ---------- */

interface Pending {
    resolve: (v: any) => void;
    reject: (e: any) => void;
    timer: ReturnType<typeof setTimeout>;
    // open assembly state
    assembly?: { path: string; hash: string; size: number; parts: string[]; expect: number };
}

const DEFAULT_TIMEOUT = 15000;
const SAVE_TIMEOUT = 60000;

export class IdeClient {
    public EvtEvent = new EventHook<IdeEvent>();
    public EvtError = new EventHook<IdeError>();       // unsolicited errors
    public EvtSessionChanged = new EventHook<boolean>();

    private pending = new Map<number, Pending>();
    private nextRef = 1;
    private nextTxn = 1;
    private welcome_: IdeWelcome | null = null;

    constructor(private transport: IdeTransport) {}

    public get welcome(): IdeWelcome | null {
        return this.welcome_;
    }

    /** True once the Hello handshake has completed. */
    public get ready(): boolean {
        return this.welcome_ !== null;
    }

    /** Call on disconnect: drop session state and fail all in-flight requests. */
    public reset(): void {
        for (const [, p] of this.pending) {
            clearTimeout(p.timer);
            p.reject(new IdeError("disconnected", "Connection lost"));
        }
        this.pending.clear();
        if (this.welcome_) {
            this.welcome_ = null;
            this.EvtSessionChanged.fire(false);
        }
    }

    /* ----- request plumbing ----- */

    private send(msg: string, data: Record<string, unknown>): void {
        if (!this.transport.sendGmcp("Ide." + msg, data)) {
            throw new IdeError("disconnected", "Not connected or GMCP not negotiated");
        }
    }

    private request<T>(msg: string, data: Record<string, unknown>, timeout = DEFAULT_TIMEOUT): Promise<T> {
        const ref = this.nextRef++;
        return new Promise<T>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(ref);
                reject(new IdeError("timeout", "Ide." + msg + " timed out"));
            }, timeout);
            this.pending.set(ref, { resolve, reject, timer });
            try {
                this.send(msg, { ...data, ref });
            } catch (e) {
                clearTimeout(timer);
                this.pending.delete(ref);
                reject(e);
            }
        });
    }

    private settle(ref: number, fn: (p: Pending) => void): boolean {
        const p = this.pending.get(ref);
        if (!p) return false;
        fn(p);
        return true;
    }

    private finish(ref: number, value: unknown): void {
        this.settle(ref, (p) => {
            clearTimeout(p.timer);
            this.pending.delete(ref);
            p.resolve(value);
        });
    }

    private fail(ref: number, err: IdeError): void {
        this.settle(ref, (p) => {
            clearTimeout(p.timer);
            this.pending.delete(ref);
            p.reject(err);
        });
    }

    /* ----- incoming GMCP (wire from Socket.EvtGmcp for pkg starting "Ide.") ----- */

    public handleGmcp(pkg: string, data: any): void {
        if (!pkg.startsWith("Ide.")) return;
        const msg = pkg.slice(4);
        const ref: number | undefined = data && typeof data.ref === "number" ? data.ref : undefined;

        switch (msg) {
            case "Welcome":
                this.welcome_ = {
                    version: Number(data.version ?? 0),
                    scopes: Array.isArray(data.scopes) ? data.scopes : [],
                    limits: {
                        maxChunk: Number(data.limits?.maxChunk ?? 32768),
                        maxFile: Number(data.limits?.maxFile ?? 500000),
                        hashAlgo: String(data.limits?.hashAlgo ?? "sha256"),
                    },
                };
                if (ref !== undefined) this.finish(ref, this.welcome_);
                this.EvtSessionChanged.fire(true);
                break;

            case "Dir":
                if (ref !== undefined) this.finish(ref, (data.entries ?? []) as IdeDirEntry[]);
                break;

            case "FileInfo":
                if (ref !== undefined) this.finish(ref, data as IdeFileInfo);
                break;

            case "Content": {
                if (ref === undefined) break;
                const p = this.pending.get(ref);
                if (!p) break;
                if (!p.assembly) {
                    p.assembly = {
                        path: String(data.path),
                        hash: String(data.hash),
                        size: Number(data.size ?? 0),
                        parts: [],
                        expect: Number(data.chunks ?? 1),
                    };
                }
                p.assembly.parts[Number(data.chunk ?? 0)] = String(data.data ?? "");
                const got = p.assembly.parts.filter((x) => x !== undefined).length;
                if (got >= p.assembly.expect) {
                    const content = p.assembly.parts.join("");
                    this.finish(ref, {
                        path: p.assembly.path,
                        content,
                        hash: p.assembly.hash,
                        size: p.assembly.size,
                    } as IdeContent);
                } else {
                    // keep waiting; refresh the timeout between chunks
                    clearTimeout(p.timer);
                    p.timer = setTimeout(() => {
                        this.pending.delete(ref);
                        p.reject(new IdeError("timeout", "Ide.Content transfer timed out"));
                    }, DEFAULT_TIMEOUT);
                }
                break;
            }

            case "SaveResult":
            case "CheckResult":
                if (ref !== undefined) {
                    this.finish(ref, {
                        path: String(data.path),
                        ok: !!data.ok,
                        newHash: data.newHash !== undefined ? String(data.newHash) : undefined,
                        compiled: !!data.compiled,
                        reloaded: !!data.reloaded,
                        diagnostics: (data.diagnostics ?? []) as IdeDiagnostic[],
                    } as IdeSaveResult);
                }
                break;

            case "LockResult":
            case "DeleteResult":
            case "MkdirResult":
                if (ref !== undefined) this.finish(ref, data);
                break;

            case "Event":
                this.EvtEvent.fire(data as IdeEvent);
                break;

            case "Error": {
                const err = new IdeError(
                    String(data?.code ?? "internal"),
                    String(data?.message ?? "Unknown error"),
                    data?.path !== undefined ? String(data.path) : undefined,
                    data?.currentHash !== undefined ? String(data.currentHash) : undefined,
                );
                if (ref !== undefined && this.pending.has(ref)) this.fail(ref, err);
                else this.EvtError.fire(err);
                break;
            }
        }
    }

    /* ----- public API ----- */

    /**
     * Announce the IDE to the server and fetch grant scopes + limits.
     * No credentials: the MUD session is already authenticated; the server
     * derives the scopes from the character's privileges.
     */
    public hello(): Promise<IdeWelcome> {
        this.transport.sendGmcp("Core.Supports.Add", ["Ide 1"]);
        return this.request<IdeWelcome>("Hello", {});
    }

    public list(path: string): Promise<IdeDirEntry[]> {
        return this.request<IdeDirEntry[]>("List", { path });
    }

    public stat(path: string): Promise<IdeFileInfo> {
        return this.request<IdeFileInfo>("Stat", { path });
    }

    public open(path: string): Promise<IdeContent> {
        return this.request<IdeContent>("Open", { path });
    }

    /**
     * Save content. baseHash is the server hash the edit was based on
     * (null asserts the file must not exist yet). Automatically uses the
     * chunked transaction flow when content exceeds the negotiated maxChunk.
     */
    public async save(path: string, content: string, baseHash: string | null, noReload = false): Promise<IdeSaveResult> {
        const maxChunk = this.welcome_?.limits.maxChunk ?? 32768;
        const algo = this.welcome_?.limits.hashAlgo ?? "sha256";
        const hash = await contentHash(content, algo);
        const base: Record<string, unknown> = { path, noReload };
        if (hash !== null) base.hash = hash;
        if (baseHash !== null) base.baseHash = baseHash;

        const pieces = chunkString(content, maxChunk);
        if (pieces.length === 1) {
            return this.request<IdeSaveResult>("Save", { ...base, data: content }, SAVE_TIMEOUT);
        }
        const txn = "t" + this.nextTxn++;
        this.send("SaveBegin", { ...base, txn, chunks: pieces.length, size: content.length });
        for (let i = 0; i < pieces.length; i++) {
            this.send("SaveChunk", { txn, chunk: i, data: pieces[i] });
        }
        return this.request<IdeSaveResult>("SaveCommit", { txn }, SAVE_TIMEOUT);
    }

    /** Compile-check content without writing the file. */
    public check(path: string, content: string): Promise<IdeSaveResult> {
        return this.request<IdeSaveResult>("Check", { path, data: content }, SAVE_TIMEOUT);
    }

    /** Delete a file, or a directory when it is empty. */
    public delete(path: string): Promise<{ path: string; ok: boolean }> {
        return this.request("Delete", { path });
    }

    /** Create a directory; intermediate directories are created as needed. */
    public mkdir(path: string): Promise<{ path: string; ok: boolean }> {
        return this.request("Mkdir", { path });
    }

    public lock(path: string): Promise<{ path: string; ok: boolean; holder?: string; expires?: number }> {
        return this.request("Lock", { path });
    }

    public unlock(path: string): void {
        this.send("Unlock", { path });
    }

    public close(path: string): void {
        this.send("Close", { path });
    }
}
