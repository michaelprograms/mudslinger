import { describe, it, expect } from 'vitest';
import * as triggerManager from "./trigger";
import { EditorItem } from "../panel/base";

function testConfig(triggers: EditorItem[]): triggerManager.ConfigIf {
    let triggers_ = triggers;
    let enabled_: boolean;
    return {
        get: (key: "triggers") => triggers_,
        set: (key: "triggers", val: EditorItem[]) => { triggers_ = val; },
        getDef: (key: "triggersEnabled", def: boolean) => enabled_ !== undefined ? enabled_ : def,
    };
}

class TestBasicScript implements triggerManager.ScriptIf {
    public calls: [string, string][] = [];
    public scriptCalls: string[] = [];
    makeScript(text: string, argsSig: string): any {
        this.calls.push([text, argsSig]);
        return (cmd: string) => { this.scriptCalls.push(cmd); };
    }
}

class TestRegexScript implements triggerManager.ScriptIf {
    public calls: [string, string][] = [];
    public scriptCalls: [RegExpMatchArray, string][] = [];
    makeScript(text: string, argsSig: string): any {
        this.calls.push([text, argsSig]);
        return (match: RegExpMatchArray, cmd: string) => { this.scriptCalls.push([match, cmd]); };
    }
}

class CmdCatcher {
    public cmds: string[] = [];
    constructor(mgr: triggerManager.TriggerManager) {
        mgr.EvtEmitTriggerCmds.handle((cmds) => { this.cmds = this.cmds.concat(cmds); });
    }
}

describe("triggerManager", () => {
    it("basic noscript", () => {
        const trigs: EditorItem[] = [{ pattern: "test1", value: "do\na\nthing", regex: false, is_script: false }];
        const mgr = new triggerManager.TriggerManager(null, testConfig(trigs));
        const catcher = new CmdCatcher(mgr);
        mgr.handleLine("123 test1 456 more");
        expect(catcher.cmds).toEqual(['do', 'a', 'thing']);
    });

    it("basic script", () => {
        const trigs: EditorItem[] = [{ pattern: "test1", value: "n/a 1", regex: false, is_script: true }];
        const scr = new TestBasicScript();
        const mgr = new triggerManager.TriggerManager(scr, testConfig(trigs));
        mgr.handleLine("123 test1 456 more");
        expect(scr.calls.pop()).toEqual(["n/a 1", "line"]);
        expect(scr.scriptCalls.pop()).toBe("123 test1 456 more");
    });

    it("regex noscript", () => {
        const trigs: EditorItem[] = [{ pattern: "test1 (\\d{3})\\s", value: "do\na$1\nthing", regex: true, is_script: false }];
        const mgr = new triggerManager.TriggerManager(null, testConfig(trigs));
        const catcher = new CmdCatcher(mgr);
        mgr.handleLine("123 test1 456 more");
        expect(catcher.cmds).toEqual(['do', 'a456', 'thing']);
    });

    it("regex script", () => {
        const trigs: EditorItem[] = [{ pattern: "test1 (\\d{3})\\s", value: "n/a 1", regex: true, is_script: true }];
        const scr = new TestRegexScript();
        const mgr = new triggerManager.TriggerManager(scr, testConfig(trigs));
        mgr.handleLine("123 test1 456 more");
        expect(scr.calls.pop()).toEqual(["n/a 1", "match, line"]);
        const scrCall = scr.scriptCalls.pop();
        expect(scrCall[0][0]).toBe("test1 456 ");
        expect(scrCall[0][1]).toBe("456");
        expect(scrCall[1]).toBe("123 test1 456 more");
    });
});
