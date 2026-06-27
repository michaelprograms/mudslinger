import { OutWinBase, ConfigIf } from "./outWinBase";
import * as Util from "./util";

export class OutputWin extends OutWinBase {
    constructor(config: ConfigIf) {
        super(document.getElementById("winOutput")!, config);
        window.onerror = this.handleWindowError.bind(this);
    }

    private appendLine(color: string, text: string) {
        const span = document.createElement("span");
        span.style.color = color;
        span.textContent = text + "\n";
        this.target.appendChild(span);
    }

    handleScriptPrint(data: string) {
        this.appendLine("orange", JSON.stringify(data));
        this.scrollBottom(true);
    }

    handleSendCommand(cmd: string) {
        this.appendLine("yellow", cmd);
        this.scrollBottom(true);
    }

    handleScriptSendCommand(cmd: string) {
        this.appendLine("cyan", cmd);
        this.scrollBottom(true);
    }

    handleTriggerSendCommands(data: string[]) {
        const span = document.createElement("span");
        span.style.color = "cyan";
        const visible = data.slice(0, 5);
        span.textContent = visible.join("\n") + (data.length > 5 ? "\n..." : "") + "\n";
        this.target.appendChild(span);
        this.scrollBottom(false);
    }

    handleAliasSendCommands(orig: string, cmds: string[]) {
        const yellow = document.createElement("span");
        yellow.style.color = "yellow";
        yellow.textContent = orig;

        const cyan = document.createElement("span");
        cyan.style.color = "cyan";
        const visible = cmds.slice(0, 5);
        cyan.textContent = " --> " + visible.join("\n") + (cmds.length > 5 ? "\n..." : "") + "\n";

        this.target.appendChild(yellow);
        this.target.appendChild(cyan);
        this.scrollBottom(true);
    }

    private connIntervalId: number | null = null;

    handleTelnetTryConnect(host: string, port: number): void {
        if (this.connIntervalId) {
            clearInterval(this.connIntervalId);
            this.connIntervalId = null;
        }

        const outer = document.createElement("span");
        outer.style.color = "cyan";
        outer.appendChild(document.createTextNode("[[Connecting to " + host + ":" + port));
        const dots = document.createElement("span");
        dots.className = "conn-dots";
        outer.appendChild(dots);
        outer.appendChild(document.createTextNode("]]\n"));

        this.connIntervalId = setInterval(() => dots.textContent += '.', 1000);
        this.target.appendChild(outer);
        this.scrollBottom(true);
    }

    handleTelnetConnect(): void {
        if (this.connIntervalId) {
            clearInterval(this.connIntervalId);
            this.connIntervalId = null;
        }
        this.appendLine("cyan", "[[Connected]]");
        this.scrollBottom(true);
    }

    handleTelnetDisconnect() {
        if (this.connIntervalId) {
            clearInterval(this.connIntervalId);
            this.connIntervalId = null;
        }
        this.appendLine("cyan", "[[Disconnected]]");
        this.scrollBottom(true);
    }

    handleWsConnect() {
        this.appendLine("cyan", "[[Websocket connected]]");
        this.scrollBottom(false);
    }

    handleWsDisconnect() {
        if (this.connIntervalId) {
            clearInterval(this.connIntervalId);
            this.connIntervalId = null;
        }
        this.appendLine("cyan", "[[Websocket disconnected]]");
        this.scrollBottom(false);
    }

    handleTelnetError(data: string) {
        this.appendLine("red", "[[" + data + "]]");
        this.scrollBottom(true);
    }

    handleWsError() {
        this.appendLine("red", "[[Websocket error]]");
        this.scrollBottom(true);
    }

    private handleWindowError(message: any, source: any, lineno: any, colno: any, _error: any) {
        this.appendLine("red",
            "[[Web Client Error\n" + message + "\n" + source + "\n" + lineno + "\n" + colno + "\n]]"
        );
        this.scrollBottom(true);
    }

    handleScriptEvalError(err: any) {
        this.appendLine("red", "[[Script eval error\n" + err + "\n\n" + err.stack + "\n]]");
        this.scrollBottom(true);
    }

    handleScriptError(err: any) {
        this.appendLine("red", "[[Script error\n" + err + "\n\n" + err.stack + "\n]]");
        this.scrollBottom(true);
    }
}
