export interface MudslingerConfig {
    // "proxy" (default) routes through telnet_proxy over socket.io.
    // "websocket" connects directly to a MUD websocket port (mudWsUrl).
    transport?: "proxy" | "websocket";
    // Used in proxy mode: URL of the proxy's socket.io /telnet namespace.
    socketIoUrl: string;
    // Used in websocket mode: full ws:// or wss:// URL of the MUD websocket port.
    mudWsUrl?: string;
    mudName: string;
    mudHost: string;
    mudPort: number;
    msdp: boolean;
}

export function getConfig(): MudslingerConfig {
    let cfg = (<any>window).MudslingerConfig;
    if (!cfg) {
        throw new Error("MudslingerConfig not found - is config.js loaded before the bundle?");
    }
    return cfg;
}
