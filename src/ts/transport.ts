import { EventHook } from "./event";
import { MudslingerConfig } from "./clientConfig";
import { WebSocketTransport } from "./webSocketTransport";

// Abstraction over "move bytes to/from the MUD".
// Implementation: WebSocketTransport (native WebSocket -> MUD websocket port).
export interface Transport {
    // Establish the underlying link. Resolves true on success.
    open(): Promise<boolean>;
    // Begin a MUD session. host/port are display values; the destination
    // is fixed by the transport (mudUrl).
    openMud(host: string, port: number): void;
    // Send raw bytes to the MUD.
    write(data: ArrayBuffer): void;
    // End the MUD session.
    closeMud(): void;

    // Underlying link lifecycle (the WebSocket connection).
    EvtLinkConnect: EventHook<{ sid: string }>;
    EvtLinkDisconnect: EventHook<void>;
    EvtLinkError: EventHook<any>;

    // MUD/telnet session lifecycle.
    EvtMudConnect: EventHook<[string, number]>;
    EvtMudDisconnect: EventHook<void>;
    EvtMudError: EventHook<string>;

    // Raw inbound bytes from the MUD; fed to TelnetClient by Socket.
    EvtData: EventHook<ArrayBuffer>;
}

export function makeTransport(config: MudslingerConfig): Transport {
    if (!config.mudUrl) {
        throw new Error("mudUrl is not set in config");
    }
    return new WebSocketTransport(config.mudUrl);
}
