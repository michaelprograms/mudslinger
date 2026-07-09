import { describe, it, expect, beforeEach } from 'vitest';
import * as jsScript from "./script";

let sends: string[];
let prints: string[];
let evalErrors: {}[];
let scriptErrors: {}[];
let gmcpSends: {pkg: string; data?: unknown}[];
let clss: jsScript.JsScript;

jsScript.EvtScriptEmitCmd.handle((data) => { sends.push(data); });
jsScript.EvtScriptEmitPrint.handle((data) => { prints.push(data); });
jsScript.EvtScriptEmitEvalError.handle((data) => { evalErrors.push(data); });
jsScript.EvtScriptEmitError.handle((data) => { scriptErrors.push(data); });
jsScript.EvtScriptEmitGmcp.handle((data) => { gmcpSends.push(data); });

describe("jsScript", () => {
    beforeEach(() => {
        sends = [];
        prints = [];
        evalErrors = [];
        scriptErrors = [];
        gmcpSends = [];
        clss = new jsScript.JsScript();
    });

    it("send", () => {
        const scr = clss.makeScript(`send('hello world'); send('second message'); send('third mess');`, "");
        scr();
        expect(sends).toEqual(["hello world", "second message", "third mess"]);
    });

    it("send_gmcp", () => {
        const scr = clss.makeScript(`send_gmcp('Char.Vitals.Get'); send_gmcp('Ide.Save', {data: 'x'});`, "");
        scr();
        expect(gmcpSends).toEqual([
            {pkg: "Char.Vitals.Get", data: undefined},
            {pkg: "Ide.Save", data: {data: "x"}},
        ]);
    });

    it("print", () => {
        const scr = clss.makeScript(`print('hello world'); print('second message'); print('third mess');`, "");
        scr();
        expect(prints).toEqual(["hello world", "second message", "third mess"]);
    });

    it("eval error", () => {
        const scr = clss.makeScript(`print('hello world`, "");
        expect(scr).toBeNull();
        expect(evalErrors.length).toBe(1);
    });

    it("script error", () => {
        const scr = clss.makeScript(`fakefunc('hello world');`, "");
        expect(evalErrors.length).toBe(0);
        expect(scriptErrors.length).toBe(0);
        scr();
        expect(scriptErrors.length).toBe(1);
    });

    it("comment regression 1", () => {
        const scr = clss.makeScript(`send('hello world');\n// a comment`, "");
        expect(scr).not.toBeNull();
        scr();
        expect(sends[0]).toBe('hello world');
    });

    it("this", () => {
        const sthis = clss.getScriptThis();
        clss.makeScript(`this.abc = 123;`, "")();
        expect(sthis.abc).toBe(123);

        clss.makeScript(`this.abc += 123;`, "")();
        expect(sthis.abc).toBe(246);

        clss.makeScript(`this.incrabc = () => { this.abc += 1; }`, "")();
        clss.makeScript(`this.incrabc();`, "")();
        expect(sthis.abc).toBe(247);
    });

    it("args eval error", () => {
        const scr = clss.makeScript(`print('hello world');`, "{}}}");
        expect(scr).toBeNull();
        expect(evalErrors.length).toBe(1);
    });

    it("basic args", () => {
        clss.makeScript(`print(myarg1 + myarg2 + myarg3);`, "myarg1,myarg2,myarg3")('abc', 'def', 'ghi');
        expect(prints).toEqual(['abcdefghi']);
    });
});

describe("jsScript gmcp store", () => {
    beforeEach(() => {
        sends = [];
        prints = [];
        evalErrors = [];
        scriptErrors = [];
        clss = new jsScript.JsScript();
    });

    it("nests packages Mudlet-style under dot-separated paths", () => {
        clss.setGmcp("Char.Info", { name: "diavolo", immortal: 1 });
        clss.setGmcp("Char.Vitals", { hp: 100, maxhp: 200 });
        expect(clss.getGmcp().Char.Info.name).toBe("diavolo");
        expect(clss.getGmcp().Char.Vitals.maxhp).toBe(200);
    });

    it("merges partial updates without dropping sibling keys", () => {
        clss.setGmcp("Char.Vitals", { hp: 100, maxhp: 200 });
        clss.setGmcp("Char.Vitals", { hp: 90 });
        expect(clss.getGmcp().Char.Vitals).toEqual({ hp: 90, maxhp: 200 });
    });

    it("replaces non-object leaves and tolerates missing payloads", () => {
        clss.setGmcp("Comm.Channel.Text", { msg: "hi" });
        clss.setGmcp("Core.Ping", undefined);
        expect(clss.getGmcp().Comm.Channel.Text.msg).toBe("hi");
        expect(clss.getGmcp().Core.Ping).toEqual({});
    });

    it("keeps root identity across updates and clear, exposes this.gmcp", () => {
        const root = clss.getGmcp();
        clss.setGmcp("Char.Vitals", { hp: 1 });
        clss.clearGmcp();
        clss.setGmcp("Room.Info", { name: "Somewhere" });
        expect(clss.getGmcp()).toBe(root);           // closures stay live
        expect(root.Char).toBeUndefined();           // clear removed old data
        expect(clss.getScriptThis().gmcp).toBe(root); // this.gmcp in scripts
    });

    it("scripts can read gmcp and this.gmcp directly", () => {
        clss.setGmcp("Char.Vitals", { hp: 42 });
        clss.makeScript(`print(gmcp.Char.Vitals.hp + this.gmcp.Char.Vitals.hp);`, "")();
        expect(prints).toEqual([84]);

        // updates after script creation are visible (live object)
        clss.setGmcp("Char.Vitals", { hp: 50 });
        clss.makeScript(`print(gmcp.Char.Vitals.hp);`, "")();
        expect(prints).toEqual([84, 50]);
    });
});
