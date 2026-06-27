import { describe, it, expect } from 'vitest';
import * as aliasManager from "./alias";
import { EditorItem } from "../panel/base";

function testConfig(aliases: EditorItem[]): aliasManager.ConfigIf {
    let aliases_ = aliases;
    let enabled_: boolean;
    return {
        get: (key: "aliases") => aliases_,
        set: (key: "aliases", val: EditorItem[]) => { aliases_ = val; },
        getDef: (key: "aliasesEnabled", def: boolean) => enabled_ !== undefined ? enabled_ : def,
    };
}

class TestBasicScript implements aliasManager.ScriptIf {
    public calls: [string, string][] = [];
    public scriptCalls: string[] = [];
    makeScript(text: string, argsSig: string): any {
        this.calls.push([text, argsSig]);
        return (cmd: string) => { this.scriptCalls.push(cmd); };
    }
}

class TestRegexScript implements aliasManager.ScriptIf {
    public calls: [string, string][] = [];
    public scriptCalls: [RegExpMatchArray, string][] = [];
    makeScript(text: string, argsSig: string): any {
        this.calls.push([text, argsSig]);
        return (match: RegExpMatchArray, cmd: string) => { this.scriptCalls.push([match, cmd]); };
    }
}

describe("aliasManager", () => {
    it("basic noscript", () => {
        const aliases: EditorItem[] = [
            { pattern: "test1", value: "do a thing",    regex: false, is_script: false },
            { pattern: "test2", value: "do a thing $1", regex: false, is_script: false },
        ];
        const mgr = new aliasManager.AliasManager(null, testConfig(aliases));
        expect(mgr.checkAlias("test1 123 456 more")).toBe("do a thing");
        expect(mgr.checkAlias("test2 123 456 more")).toBe("do a thing 123 456 more");
    });

    it("basic script", () => {
        const aliases: EditorItem[] = [
            { pattern: "test1", value: "n/a 1", regex: false, is_script: true },
            { pattern: "test2", value: "n/a 2", regex: false, is_script: true },
        ];
        const scr = new TestBasicScript();
        const mgr = new aliasManager.AliasManager(scr, testConfig(aliases));

        expect(mgr.checkAlias("test1 123 456 more")).toBe(true);
        expect(scr.calls.length).toBe(1);
        expect(scr.calls.pop()).toEqual(["n/a 1", "input"]);
        expect(scr.scriptCalls.pop()).toBe("test1 123 456 more");

        expect(mgr.checkAlias("test2")).toBe(true);
        expect(scr.calls.pop()).toEqual(["n/a 2", "input"]);
        expect(scr.scriptCalls.pop()).toBe("test2");
    });

    it("regex noscript", () => {
        const aliases: EditorItem[] = [
            { pattern: "test1", value: "do a thing", regex: true, is_script: false },
            { pattern: "abc([a-z]+)", value: "do a thing $1", regex: true, is_script: false },
            { pattern: "abc ([a-z])([a-z])([a-z])([a-z])([a-z])([a-z])([a-z])([a-z])([a-z])",
              value: "do a thing $1 $2 $3 $4 $5 $6 $7 $8 $9", regex: true, is_script: false },
        ];
        const mgr = new aliasManager.AliasManager(null, testConfig(aliases));
        expect(mgr.checkAlias("test1 123 456 more")).toBe("do a thing");
        expect(mgr.checkAlias("abcdef")).toBe("do a thing def");
        expect(mgr.checkAlias("abc defghijkl")).toBe("do a thing d e f g h i j k l");
    });

    it("regex script", () => {
        const aliases: EditorItem[] = [
            { pattern: "test1",       value: "n/a 1", regex: true, is_script: true },
            { pattern: "abc([a-z]+)", value: "n/a 2", regex: true, is_script: true },
        ];
        const scr = new TestRegexScript();
        const mgr = new aliasManager.AliasManager(scr, testConfig(aliases));

        expect(mgr.checkAlias("test1 123 456 more")).toBe(true);
        expect(scr.calls.pop()).toEqual(["n/a 1", "match, input"]);
        const call1 = scr.scriptCalls.pop();
        expect(call1[0][0]).toBe("test1");
        expect(call1[1]).toBe("test1 123 456 more");

        expect(mgr.checkAlias("abcdef")).toBe(true);
        expect(scr.calls.pop()).toEqual(["n/a 2", "match, input"]);
        const call2 = scr.scriptCalls.pop();
        expect(call2[0][0]).toBe("abcdef");
        expect(call2[0][1]).toBe("def");
        expect(call2[1]).toBe("abcdef");
    });
});
