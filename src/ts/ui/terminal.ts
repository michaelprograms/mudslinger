import "@xterm/xterm/css/xterm.css";
import "./terminal.css";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { EventHook } from "../core/event";

const CSS_TO_PX: Record<string, number> = {
    "xx-small": 8,
    "x-small":  10,
    "small":    12,
    "medium":   14,
    "large":    18,
    "x-large":  24,
    "xx-large": 32,
};

export class MudTerminal {
    public EvtLine = new EventHook<string>();
    public EvtRequestInputFocus = new EventHook<void>();

    private xterm: Terminal;
    private fitAddon: FitAddon;

    constructor() {
        this.xterm = new Terminal({
            allowProposedApi: true,
            convertEol: true,
            scrollback: 5000,
            cursorInactiveStyle: "none",
            theme: {
                background:     "#000000",
                foreground:     "#c0c0c0",
                black:          "#000000",
                red:            "#800000",
                green:          "#008000",
                yellow:         "#808000",
                blue:           "#000080",
                magenta:        "#800080",
                cyan:           "#008080",
                white:          "#c0c0c0",
                brightBlack:    "#808080",
                brightRed:      "#ff0000",
                brightGreen:    "#00ff00",
                brightYellow:   "#ffff00",
                brightBlue:     "#0000ff",
                brightMagenta:  "#ff00ff",
                brightCyan:     "#00ffff",
                brightWhite:    "#ffffff",
            },
        });

        this.fitAddon = new FitAddon();
        this.xterm.loadAddon(this.fitAddon);
        const unicode11 = new Unicode11Addon();
        this.xterm.loadAddon(unicode11);
        this.xterm.unicode.activeVersion = "11";
        const winOutput = document.getElementById("winOutput")!;
        this.xterm.open(winOutput);
        this.fitAddon.fit();

        // Remove xterm's hidden textarea from tab order so Tab stays in cmdInput
        const helperTextarea = this.xterm.element?.querySelector(".xterm-helper-textarea") as HTMLElement | null;
        if (helperTextarea) helperTextarea.tabIndex = -1;

        // Refocus cmdInput on click unless the user is selecting terminal text
        winOutput.addEventListener("mouseup", () => {
            if (!this.xterm.getSelection()) this.EvtRequestInputFocus.fire();
        });

        new ResizeObserver(() => this.fitAddon.fit()).observe(winOutput);
        window.onerror = (message, source, lineno, colno) => {
            this.writeError(`[[Web Client Error\r\n${message}\r\n${source}\r\n${lineno}\r\n${colno}\r\n]]`);
        };
    }

    public write(data: string): void {
        this.xterm.write(data);
    }

    public setFontSize(sz: string): void {
        this.xterm.options.fontSize = CSS_TO_PX[sz] ?? 14;
        this.fitAddon.fit();
    }

    private writeStatus(text: string): void {
        this.xterm.writeln(`\x1b[36m${text}\x1b[0m`);
    }

    private writeError(text: string): void {
        this.xterm.writeln(`\x1b[31m${text}\x1b[0m`);
    }

    handleTelnetTryConnect(host: string, port: number): void {
        this.writeStatus(`[[Connecting to ${host}:${port}...]]`);
    }

    handleTelnetConnect(): void {
        this.writeStatus("[[Connected]]");
    }

    handleTelnetDisconnect(): void {
        this.writeStatus("[[Disconnected]]");
    }

    handleWsConnect(): void {
        this.writeStatus("[[Websocket connected]]");
    }

    handleWsDisconnect(): void {
        this.writeStatus("[[Websocket disconnected]]");
    }

    handleTelnetError(data: string): void {
        this.writeError(`[[${data}]]`);
    }

    handleWsError(): void {
        this.writeError("[[Websocket error]]");
    }

    handleSendCommand(cmd: string): void {
        this.xterm.writeln(`\x1b[33m${cmd}\x1b[0m`);
    }

    handleScriptSendCommand(cmd: string): void {
        this.xterm.writeln(`\x1b[36m${cmd}\x1b[0m`);
    }

    handleScriptPrint(data: string): void {
        this.xterm.writeln(`\x1b[38;5;214m${JSON.stringify(data)}\x1b[0m`);
    }

    handleTriggerSendCommands(data: string[]): void {
        const visible = data.slice(0, 5);
        const text = visible.join("\r\n") + (data.length > 5 ? "\r\n..." : "");
        this.xterm.writeln(`\x1b[36m${text}\x1b[0m`);
    }

    handleAliasSendCommands(orig: string, cmds: string[]): void {
        const visible = cmds.slice(0, 5);
        const text = visible.join("\r\n") + (cmds.length > 5 ? "\r\n..." : "");
        this.xterm.writeln(`\x1b[33m${orig}\x1b[0m\x1b[36m --> ${text}\x1b[0m`);
    }

    handleScriptEvalError(err: any): void {
        this.writeError(`[[Script eval error\r\n${err}\r\n\r\n${err.stack}\r\n]]`);
    }

    handleScriptError(err: any): void {
        this.writeError(`[[Script error\r\n${err}\r\n\r\n${err.stack}\r\n]]`);
    }
}
