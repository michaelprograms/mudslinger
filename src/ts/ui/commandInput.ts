import "./commandInput.css";
import { EventHook } from "../core/event";

import {AliasManager} from "../manager/alias";

export class CommandInput {
    public EvtEmitCmd = new EventHook<string>();
    public EvtEmitAliasCmds = new EventHook<{orig: string, commands: string[]}>();

    private cmd_history: string[] = [];
    private cmd_index: number = -1;
    private cmd_entered: string = "";

    private cmdInput: HTMLTextAreaElement;
    private cmdInputPassword: HTMLInputElement;
    private chkCmdStack: HTMLInputElement;

    constructor(private aliasManager: AliasManager) {
        this.cmdInput = document.getElementById("cmdInput") as HTMLTextAreaElement;
        this.cmdInputPassword = document.getElementById("cmdInputPassword") as HTMLInputElement;
        this.chkCmdStack = document.getElementById("chkCmdStack") as HTMLInputElement;

        this.cmdInput.addEventListener("keydown", (event: KeyboardEvent) => {
            if (this.keydown(event) === false) event.preventDefault();
        });
        this.cmdInput.addEventListener("input", () => { this.inputChange(); });

        this.cmdInputPassword.addEventListener("keydown", (event: KeyboardEvent) => {
            if (event.key === "Enter") {
                this.EvtEmitCmd.fire(this.cmdInputPassword.value);
                this.cmdInputPassword.value = "";
                event.preventDefault();
            }
        });

        this.loadHistory();
        this.inputChange(); // Force a resize
    }

    private sendCmd(): void {
        let cmd: string = this.cmdInput.value;
        let result = this.aliasManager.checkAlias(cmd);
        if (!result) {
            if (this.chkCmdStack.checked) {
                let cmds = cmd.split(";");
                for (let i = 0; i < cmds.length; i++) {
                    this.EvtEmitCmd.fire(cmds[i]);
                }
            } else {
                this.EvtEmitCmd.fire(cmd);
            }
        } else if (result !== true) {
            let cmds: string[] = [];
            let lines: string[] = (<string>result).replace("\r", "").split("\n");
            for (let i = 0; i < lines.length; i++) {
                cmds = cmds.concat(lines[i].split(";"));
            }
            this.EvtEmitAliasCmds.fire({orig: cmd, commands: cmds});
        } /* else the script ran already */

        this.cmdInput.select();

        if (cmd.trim() === "") {
            return;
        }
        if (this.cmd_history.length > 0
            && cmd === this.cmd_history[this.cmd_history.length - 1]) {
            return;
        }

        this.cmd_history.push(cmd);
        this.cmd_history = this.cmd_history.slice(-20);
        this.saveHistory();
        this.cmd_index = -1;
    };

    private keydown(event: KeyboardEvent): boolean {
        if (event.location === KeyboardEvent.DOM_KEY_LOCATION_NUMPAD) {
            const numpadCmds: Record<string, string> = {
                '1': 'southwest', '2': 'south',  '3': 'southeast',
                '4': 'west',      '5': 'look',   '6': 'east',
                '7': 'northwest', '8': 'north',  '9': 'northeast',
                '+': 'down',      '-': 'up',
            };
            const cmd = numpadCmds[event.key];
            if (cmd) {
                this.cmdInput.value = cmd;
                this.sendCmd();
                return false;
            }
        }

        switch (event.key) {
            case 'Enter':
                if (event.shiftKey) {
                    return true;
                } else {
                    this.sendCmd();
                    return false;
                }
            case 'ArrowUp':
                if (this.cmd_index === -1) {
                    this.cmd_entered = this.cmdInput.value;
                    this.cmd_index = this.cmd_history.length - 1;
                } else {
                    this.cmd_index -= 1;
                    this.cmd_index = Math.max(this.cmd_index, 0);
                }
                this.cmdInput.value = this.cmd_history[this.cmd_index];
                this.inputChange();
                this.cmdInput.select();
                return false;
            case 'ArrowDown':
                if (this.cmd_index === -1) {
                    break;
                }
                if (this.cmd_index === (this.cmd_history.length - 1)) {
                    // Already at latest, grab entered but unsent value
                    this.cmd_index = -1;
                    this.cmdInput.value = this.cmd_entered;
                } else {
                    this.cmd_index += 1;
                    this.cmdInput.value = this.cmd_history[this.cmd_index];
                }
                this.inputChange();
                this.cmdInput.select();
                return false;
            default:
                this.cmd_index = -1;
                return true;
        }
        return false;
    }

    private inputChange(): void {
        this.cmdInput.style.height = "1px";
        const scrollHeight = Math.max(this.cmdInput.scrollHeight, 20);
        this.cmdInput.style.height = scrollHeight + "px";
    }

    private saveHistory(): void {
        localStorage.setItem("cmd_history", JSON.stringify(this.cmd_history));
    }

    private loadHistory(): void {
        let cmds = localStorage.getItem("cmd_history");
        if (cmds) {
            try {
                this.cmd_history = JSON.parse(cmds);
            } catch { /* start with empty history if data is corrupted */ }
        }
    }

    setPasswordMode(on: boolean): void {
        this.cmdInput.style.display = on ? "none" : "";
        this.cmdInputPassword.style.display = on ? "" : "none";
        (on ? this.cmdInputPassword : this.cmdInput).focus();
    }

    focus(): void {
        this.cmdInput.focus();
    }

    setFontSize(sz: number): void {
        this.cmdInput.style.fontSize = sz + 'px';
    }
}
