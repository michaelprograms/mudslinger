import { EventHook } from "./event";
import { Transport } from "./transport";

export class WebSocketTransport implements Transport {
    public EvtLinkConnect = new EventHook<{ sid: string }>();
    public EvtLinkDisconnect = new EventHook<void>();
    public EvtLinkError = new EventHook<any>();
    public EvtMudConnect = new EventHook<[string, number]>();
    public EvtMudDisconnect = new EventHook<void>();
    public EvtMudError = new EventHook<string>();
    public EvtData = new EventHook<ArrayBuffer>();

    private ws!: WebSocket;

    constructor(private mudUrl: string) {
    }

    public async open(): Promise<boolean> {
        // No link until openMud() so Connect/Disconnect map to ws open/close.
        return true;
    }

    public openMud(host: string, port: number): void {
        console.log("Connecting directly to MUD websocket at", this.mudUrl);
        // FluffOS requires a ws subprotocol to bind the telnet handler,
        // else the port www HTTP server answers and the upgrade fails with 200).
        // "telnet" is the FluffOS driver's terminal protocol; switch to "binary"
        // if a deployment's driver registers a different name.
        this.ws = new WebSocket(this.mudUrl, "telnet");
        this.ws.binaryType = "arraybuffer";

        this.ws.onopen = () => {
            // Fire only EvtMudConnect (not EvtLinkConnect) so the user sees a
            // single "connected" message; the websocket IS the MUD session.
            this.EvtMudConnect.fire([host, port]);
        };

        this.ws.onmessage = (ev: MessageEvent) => {
            let data = ev.data;
            if (data instanceof ArrayBuffer) {
                this.EvtData.fire(data);
            } else if (typeof data === "string") {
                // Unexpected for FluffOS (binary), but handle text frames best-effort.
                this.EvtData.fire(new TextEncoder().encode(data).buffer);
            } else if (data instanceof Blob) {
                data.arrayBuffer().then((ab) => this.EvtData.fire(ab));
            }
        };

        this.ws.onclose = () => {
            this.EvtMudDisconnect.fire();
        };

        this.ws.onerror = () => {
            this.EvtMudError.fire("WebSocket error connecting to " + this.mudUrl);
        };
    }

    public write(data: ArrayBuffer): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(data);
        }
    }

    public closeMud(): void {
        if (this.ws) {
            this.ws.close();
        }
    }
}
