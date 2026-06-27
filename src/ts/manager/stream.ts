import { EventHook } from "../core/event";

export interface MudTerminalLike {
    EvtLine: EventHook<string>;
    write(data: string): void;
}

export interface StreamConfigIf {
    get(key: "utf8Enabled"): boolean;
}

const ANSI_RE = /\x1b(?:\[[0-9;?]*[a-zA-Z]|[^[])/g;

export class StreamManager {
    private utf8Decoder = new TextDecoder();
    private lineBuffer = "";

    constructor(private terminal: MudTerminalLike, private config: StreamConfigIf) {}

    public handleTelnetData(data: ArrayBuffer): void {
        let text: string;
        if (this.config.get("utf8Enabled")) {
            text = this.utf8Decoder.decode(data, { stream: true });
        } else {
            text = String.fromCharCode(...new Uint8Array(data));
        }

        // Write raw to xterm — preserve \r so \r\n renders correctly
        this.terminal.write(text);

        // Line tracking: strip \r and ANSI, fire EvtLine per \n
        this.lineBuffer += text.replace(/\r/g, "").replace(ANSI_RE, "");
        const lines = this.lineBuffer.split("\n");
        this.lineBuffer = lines.pop()!;
        for (const line of lines) {
            this.terminal.EvtLine.fire(line);
        }
    }
}
