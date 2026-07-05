import "./movementPad.css";
import { EventHook } from "../core/event";
import { UserConfig } from "../core/userConfig";

export const MOVE_BUTTONS: { cmd: string; label: string; cls: string }[] = [
    { cmd: "northwest", label: "NW",    cls: "nw"    },
    { cmd: "north",     label: "N",     cls: "n"     },
    { cmd: "northeast", label: "NE",    cls: "ne"    },
    { cmd: "west",      label: "W",     cls: "w"     },
    { cmd: "look",      label: "Look",  cls: "look"  },
    { cmd: "east",      label: "E",     cls: "e"     },
    { cmd: "southwest", label: "SW",    cls: "sw"    },
    { cmd: "south",     label: "S",     cls: "s"     },
    { cmd: "southeast", label: "SE",    cls: "se"    },
    { cmd: "up",        label: "Up",    cls: "up"    },
    { cmd: "enter",     label: "Enter", cls: "enter" },
    { cmd: "out",       label: "Out",   cls: "out"   },
    { cmd: "down",      label: "Down",  cls: "down"  },
];

export class MovementPad {
    public EvtEmitCmd = new EventHook<string>();

    private pad: HTMLElement;

    constructor() {
        this.pad = document.createElement("div");
        this.pad.id = "movementPad";
        this.pad.hidden = true;

        for (const b of MOVE_BUTTONS) {
            const btn = document.createElement("button");
            btn.className = `movepad-btn movepad-${b.cls}`;
            btn.textContent = b.label;
            btn.addEventListener("click", () => this.EvtEmitCmd.fire(b.cmd));
            this.pad.appendChild(btn);
        }

        document.getElementById("mainWin")!.appendChild(this.pad);

        if (UserConfig.getDef("movementPad", false)) this.show();
        UserConfig.onSet("movementPad", (v: boolean) => (v ? this.show() : this.hide()));
    }

    show(): void { this.pad.hidden = false; }
    hide(): void { this.pad.hidden = true; }
}
