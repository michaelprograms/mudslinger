import { EventHook } from "./event";

export let EvtScriptEmitCmd = new EventHook<string>();
export let EvtScriptEmitPrint = new EventHook<string>();
export let EvtScriptEmitError = new EventHook<any>();
export let EvtScriptEmitEvalError = new EventHook<any>();
export let EvtScriptEmitGmcp = new EventHook<{pkg: string; data?: unknown}>();

function makeScript(this: any, text: string, argsSig: string, gmcpData: any) {
    let _scriptFunc_: any;
    /* Scripting API section */
    let send = function(cmd: string) {
        EvtScriptEmitCmd.fire(cmd);
    };

    let print = function(message: string) {
        EvtScriptEmitPrint.fire(message);
    };

    // Mudlet-style send_gmcp(pkg, data?), e.g. send_gmcp("Char.Vitals.Get").
    let send_gmcp = function(pkg: string, data?: unknown) {
        EvtScriptEmitGmcp.fire({pkg, data});
    };

    // Mudlet-style nested GMCP state, e.g. gmcp.Char.Vitals.hp.
    // Also reachable as this.gmcp. Live object, updated on every message.
    let gmcp = gmcpData;
    /* end Scripting API section */

    try {
        eval("_scriptFunc_ = function(" + argsSig + ") {\"use strict\";\n" + text + "\n}");
    }
    catch (err) {
        EvtScriptEmitEvalError.fire(err);
        return null;
    }

    return _scriptFunc_.bind(this);;
}

function isPlainObject(v: any): boolean {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}

/* Merge incoming GMCP JSON into the existing node: objects merge key-wise
 * (partial updates keep sibling values), everything else is replaced. */
function deepMerge(oldVal: any, incoming: any): any {
    if (!isPlainObject(oldVal) || !isPlainObject(incoming)) return incoming;
    for (const k of Object.keys(incoming)) {
        oldVal[k] = deepMerge(oldVal[k], incoming[k]);
    }
    return oldVal;
}

export class JsScript {
    private scriptThis: any = {}; /* the 'this' used for all scripts */
    /* Mudlet-style GMCP state: "Char.Vitals" {hp:5} -> gmcp.Char.Vitals.hp.
     * The root object's identity never changes, so closures over it (the
     * `gmcp` binding in scripts) always see current data. */
    private gmcpData: Record<string, any> = {};

    constructor() {
        this.scriptThis.gmcp = this.gmcpData;
    }

    getScriptThis() { return this.scriptThis; }

    getGmcp(): Record<string, any> { return this.gmcpData; }

    /** Record one GMCP message under its dot-separated package path. */
    public setGmcp(pkg: string, data: any): void {
        const parts = pkg.split(".");
        let node: any = this.gmcpData;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!isPlainObject(node[parts[i]])) node[parts[i]] = {};
            node = node[parts[i]];
        }
        const leaf = parts[parts.length - 1];
        node[leaf] = deepMerge(node[leaf], data === undefined ? {} : data);
    }

    /** Clear all GMCP state (on disconnect) without changing object identity. */
    public clearGmcp(): void {
        for (const k of Object.keys(this.gmcpData)) {
            delete this.gmcpData[k];
        }
    }

    public makeScript(text: string, argsSig: string): any {
        let scr = makeScript.call(this.scriptThis, text, argsSig, this.gmcpData);
        if (!scr) { return null; }
        return (...args: any[]) => {
            try {
                scr(...args);
            } catch (err) {
                EvtScriptEmitError.fire(err);
            }
        };
    }
}