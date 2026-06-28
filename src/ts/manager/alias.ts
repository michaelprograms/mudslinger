import { EditorItem } from "../panel/base";


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

        for (let i = 0; i < this.aliases.length; i++) {
            let alias = this.aliases[i];

            if (alias.regex) {
                let re = alias.pattern;
                let match = cmd.match(re);
                if (!match) {
                    continue;
                }

                if (alias.is_script) {
                    let script = this.jsScript.makeScript(alias.value, "match, input");
                    if (script) { script(match, cmd); };
                    return true;
                } else {
                    let value = alias.value;

                    value = value.replace(/\$(\d+)/g, function(m, d) {
                        return match[parseInt(d)] || "";
                    });
                    return value;
                }
            } else {
                let re = "^" + alias.pattern + "\\s*(.*)$";
                let match = cmd.match(re);
                if (!match) {
                    continue;
                }

                if (alias.is_script) {
                    let script = this.jsScript.makeScript(alias.value, "input");
                    if (script) { script(cmd); };
                    return true;
                } else {
                    let value = alias.value.replace("$1", match[1] || "");
                    return value;
                }
            }
        }
        return null;
    };
}
