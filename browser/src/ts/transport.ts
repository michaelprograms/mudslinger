import { EventHook } from "./event";

// Abstraction over "move bytes to/from the MUD".
// Implementations: ProxyTransport (socket.io -> telnet_proxy) and
// WebSocketTransport (native WebSocket -> MUD websocket port).
export interface Transport {
    // Establish the underlying link. Resolves true on success.
    open(): Promise<boolean>;
    // Begin a MUD session. host/port are display values; the destination
    // is fixed by the transport (proxy config, or mudWsUrl).
    openMud(host: string, port: number): void;
    // Send raw bytes to the MUD.
    write(data: ArrayBuffer): void;
    // End the MUD session.
    closeMud(): void;

    // Underlying link lifecycle (socket.io connection, or — proxy only — surfaced as ws events).
    EvtLinkConnect: EventHook<{ sid: string }>;
    EvtLinkDisconnect: EventHook<void>;
    EvtLinkError: EventHook<any>;

    // MUD/telnet session lifecycle.
    EvtMudConnect: EventHook<[string, number]>;
    EvtMudDisconnect: EventHook<void>;
    EvtMudError: EventHook<string>;

    // Raw inbound bytes from the MUD; fed to TelnetClient by Socket.
    EvtData: EventHook<ArrayBuffer>;

    // Proxy only: the player's IP as reported by the proxy. Absent in websocket mode.
    EvtSetClientIp?: EventHook<string>;
}
