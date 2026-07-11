import "./chatWindow.css";
import { UserConfig } from "../core/userConfig";

// 16-color palette, matched to the xterm theme in terminal.ts so chat renders
// identically to the main console.
const NORMAL = ["#000000", "#800000", "#008000", "#808000", "#000080", "#800080", "#008080", "#c0c0c0"];
const BRIGHT = ["#808080", "#ff0000", "#00ff00", "#ffff00", "#0000ff", "#ff00ff", "#00ffff", "#ffffff"];
const DEFAULT_FG = "#c0c0c0";
const DEFAULT_BG = "#000000";

const MAX_LINES = 500;

interface SgrState {
    bold: boolean; italic: boolean; underline: boolean; blink: boolean; inverse: boolean; strike: boolean;
    fgIdx: number | null; fgBright: boolean;
    bgIdx: number | null; bgBright: boolean;
}

function newState(): SgrState {
    return { bold: false, italic: false, underline: false, blink: false, inverse: false, strike: false,
             fgIdx: null, fgBright: false, bgIdx: null, bgBright: false };
}

function escapeHtml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Apply one SGR escape's params (e.g. "0;37;40") to the running state.
// Codes verified against Merentha /daemon/terminal.c "ansi" type.
function applyCodes(params: string, st: SgrState): void {
    for (const p of (params === "" ? "0" : params).split(";")) {
        const c = Number(p);
        if (c === 0) Object.assign(st, newState());
        else if (c === 1) st.bold = true;
        else if (c === 22) st.bold = false;
        else if (c === 3) st.italic = true;
        else if (c === 23) st.italic = false;
        else if (c === 4) st.underline = true;
        else if (c === 24) st.underline = false;
        else if (c === 5) st.blink = true;
        else if (c === 25) st.blink = false;
        else if (c === 7) st.inverse = true;
        else if (c === 27) st.inverse = false;
        else if (c === 9) st.strike = true;
        else if (c === 29) st.strike = false;
        else if (c >= 30 && c <= 37) { st.fgIdx = c - 30; st.fgBright = false; }
        else if (c === 39) st.fgIdx = null;
        else if (c >= 90 && c <= 97) { st.fgIdx = c - 90; st.fgBright = true; }
        else if (c >= 40 && c <= 47) { st.bgIdx = c - 40; st.bgBright = false; }
        else if (c === 49) st.bgIdx = null;
        else if (c >= 100 && c <= 107) { st.bgIdx = c - 100; st.bgBright = true; }
        // ponytail: anything else (dim, conceal, 256-color) ignored — Merentha never emits it.
    }
}

function renderRun(text: string, st: SgrState): string {
    if (text === "") return "";
    const esc = escapeHtml(text);

    // Bold brightens the foreground (Merentha makes bright yellow via ESC[1m ESC[33m,
    // and xterm's drawBoldTextInBrightColors is on by default).
    let fg = st.fgIdx === null ? null : (st.fgBright || st.bold ? BRIGHT : NORMAL)[st.fgIdx];
    let bg = st.bgIdx === null ? null : (st.bgBright ? BRIGHT : NORMAL)[st.bgIdx];
    // Merentha's RESET is ESC[0;37;40m — the 40 sets bg black. Painting opaque
    // black over the semi-transparent overlay looks wrong (and is identical to
    // "no background" on the black console), so drop it and let the overlay show.
    if (bg === DEFAULT_BG) bg = null;
    if (st.inverse) {
        const nf = bg ?? DEFAULT_BG;
        const nb = fg ?? DEFAULT_FG;
        fg = nf; bg = nb;
    }

    const style: string[] = [];
    if (fg) style.push(`color:${fg}`);
    if (bg) style.push(`background-color:${bg}`);
    if (st.bold) style.push("font-weight:bold");
    if (st.italic) style.push("font-style:italic");
    const deco = [st.underline && "underline", st.strike && "line-through"].filter(Boolean);
    if (deco.length) style.push(`text-decoration:${deco.join(" ")}`);

    if (style.length === 0 && !st.blink) return esc;
    const cls = st.blink ? ' class="chat-blink"' : "";
    return `<span${cls} style="${style.join(";")}">${esc}</span>`;
}

export function ansiToHtml(input: string): string {
    const re = /\x1b\[([0-9;]*)m/g;
    const st = newState();
    let out = "";
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(input)) !== null) {
        if (m.index > last) out += renderRun(input.slice(last, m.index), st);
        applyCodes(m[1], st);
        last = re.lastIndex;
    }
    if (last < input.length) out += renderRun(input.slice(last), st);
    return out;
}

export class ChatWindow {
    private container: HTMLElement;
    private enabled: boolean;
    private hasData = false;

    constructor() {
        this.enabled = UserConfig.getDef("chatWindowEnabled", true);

        this.container = document.createElement("div");
        this.container.id = "chatWindow";
        this.container.hidden = true;

        document.getElementById("mainWin")!.appendChild(this.container);

        UserConfig.onSet("chatWindowEnabled", (v: boolean) => {
            this.enabled = v;
            this.refreshVisibility();
        });
    }

    public append(msg: string): void {
        // At-bottom check must happen before we append (which changes scrollHeight).
        const atBottom = this.container.scrollTop + this.container.clientHeight >= this.container.scrollHeight - 4;

        const line = document.createElement("div");
        line.className = "chat-line";
        // Safe: ansiToHtml escapes all remote text (escapeHtml); span attributes only
        // ever hold our own palette hex + fixed keywords, never remote data.
        line.innerHTML = ansiToHtml(msg.replace(/[\r\n]+$/, ""));
        this.container.appendChild(line);

        while (this.container.childElementCount > MAX_LINES) {
            this.container.firstElementChild!.remove();
        }

        this.hasData = true;
        this.refreshVisibility();

        if (atBottom) this.container.scrollTop = this.container.scrollHeight;
    }

    // Clear on disconnect so stale chatter isn't shown as current (matches VitalsGauges).
    public reset(): void {
        this.container.replaceChildren();
        this.hasData = false;
        this.refreshVisibility();
    }

    private refreshVisibility(): void {
        this.container.hidden = !(this.enabled && this.hasData);
    }
}
