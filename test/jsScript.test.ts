import { describe, it, expect, beforeEach } from 'vitest';
import * as jsScript from "../src/ts/jsScript";

let sends: string[];
let prints: string[];
let evalErrors: {}[];
let scriptErrors: {}[];
let clss: jsScript.JsScript;

jsScript.EvtScriptEmitCmd.handle((data) => { sends.push(data); });
jsScript.EvtScriptEmitPrint.handle((data) => { prints.push(data); });
jsScript.EvtScriptEmitEvalError.handle((data) => { evalErrors.push(data); });
jsScript.EvtScriptEmitError.handle((data) => { scriptErrors.push(data); });

describe("jsScript", () => {
    beforeEach(() => {
        sends = [];
        prints = [];
        evalErrors = [];
        scriptErrors = [];
        clss = new jsScript.JsScript();
    });

    it("send", () => {
        const scr = clss.makeScript(`send('hello world'); send('second message'); send('third mess');`, "");
        scr();
        expect(sends).toEqual(["hello world", "second message", "third mess"]);
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
