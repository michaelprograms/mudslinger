import { EventHook } from "../core/event";
import { EditorItem } from "../panel/base";
import { UserConfig } from "../core/userConfig";


export interface ConfigIf {
    set(key: "triggers", val: EditorItem[]): void;
    getDef(key: "triggersEnabled", def: boolean): boolean;
    get(key: "triggers"): EditorItem[];
}

export interface ScriptIf {
    makeScript(text: string, argsSig: string): any;
}

export class TriggerManager {
    public EvtEmitTriggerCmds = new EventHook<string[]>();

    public triggers: Array<EditorItem> = [];

    constructor(private jsScript: ScriptIf, private config: ConfigIf) {
        /* backward compatibility */
        if (typeof localStorage !== 'undefined') {
            const savedTriggers = localStorage.getItem("triggers");
            if (savedTriggers) {
                try {
                    this.config.set("triggers", JSON.parse(savedTriggers));
                } catch { /* ignore corrupted legacy data */ }
                localStorage.removeItem("triggers");
            }
        }

        this.loadTriggers();
    }

    public saveTriggers() {
        this.triggers.sort((a, b) => a.pattern.localeCompare(b.pattern));
        this.config.set("triggers", this.triggers);
    }

    private loadTriggers() {
        this.triggers = this.config.get("triggers") || [];
        this.triggers.sort((a, b) => a.pattern.localeCompare(b.pattern));
    }

    public handleLine(line: string): void {
        if (this.config.getDef("triggersEnabled", true) !== true) return;
        const activeChar: string = UserConfig.getDef('activeChar', '');

        for (const trig of this.triggers) {
            const scoped = !!trig.scope && trig.scope !== 'global';
            if (scoped && trig.scope !== activeChar) continue;
            this.fireTrigger(trig, line);
        }
    }

    private fireTrigger(trig: EditorItem, line: string): boolean {
        if (trig.regex) {
            const match = line.match(trig.pattern);
            if (!match) return false;
            if (trig.is_script) {
                const script = this.jsScript.makeScript(trig.value, "match, line");
                if (script) { script(match, line); }
            } else {
                const value = trig.value.replace(/\$(\d+)/g, (_m, d) => match[parseInt(d)] || "");
                this.EvtEmitTriggerCmds.fire(value.replace("\r", "").split("\n"));
            }
            return true;
        } else {
            if (!line.includes(trig.pattern)) return false;
            if (trig.is_script) {
                const script = this.jsScript.makeScript(trig.value, "line");
                if (script) { script(line); }
            } else {
                this.EvtEmitTriggerCmds.fire(trig.value.replace("\r", "").split("\n"));
            }
            return true;
        }
    }
}
