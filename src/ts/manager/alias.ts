import { EditorItem } from "../panel/base";
import { UserConfig } from "../core/userConfig";


export interface ConfigIf {
    set(key: "aliases", val: EditorItem[]): void;
    getDef(key: "aliasesEnabled", def: boolean): boolean;
    get(key: "aliases"): EditorItem[];
}

export interface ScriptIf {
    makeScript(text: string, argsSig: string): any;
}

export class AliasManager {
    public aliases: Array<EditorItem> = [];

    constructor(private jsScript: ScriptIf, private config: ConfigIf) {
        this.loadAliases();
    }

    public saveAliases() {
        this.aliases.sort((a, b) => a.pattern.localeCompare(b.pattern));
        this.config.set("aliases", this.aliases);
    }

    private loadAliases() {
        this.aliases = this.config.get("aliases") || [];
        this.aliases.sort((a, b) => a.pattern.localeCompare(b.pattern));
    }

    // return the result of the alias if any (string with embedded lines)
    // return true if matched and script ran
    // return null if no match
    public checkAlias(cmd: string): boolean | string | null {
        if (this.config.getDef("aliasesEnabled", true) !== true) return null;
        const activeChar: string = UserConfig.getDef('activeChar', '');

        // character-scoped aliases take priority over global ones
        if (activeChar) {
            const r = this.tryMatch(cmd, a => a.scope === activeChar);
            if (r !== null) return r;
        }
        return this.tryMatch(cmd, a => !a.scope || a.scope === 'global');
    }

    private tryMatch(cmd: string, filter: (a: EditorItem) => boolean): boolean | string | null {
        for (const alias of this.aliases) {
            if (!filter(alias)) continue;

            if (alias.regex) {
                const match = cmd.match(alias.pattern);
                if (!match) continue;
                if (alias.is_script) {
                    const script = this.jsScript.makeScript(alias.value, "match, input");
                    if (script) { script(match, cmd); }
                    return true;
                }
                return alias.value.replace(/\$(\d+)/g, (_m, d) => match[parseInt(d)] || "");
            } else {
                const match = cmd.match("^" + alias.pattern + "\\s*(.*)$");
                if (!match) continue;
                if (alias.is_script) {
                    const script = this.jsScript.makeScript(alias.value, "input");
                    if (script) { script(cmd); }
                    return true;
                }
                return alias.value.replace("$1", match[1] || "");
            }
        }
        return null;
    }
}
