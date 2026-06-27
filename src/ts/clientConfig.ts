export interface MudslingerConfig {
    // Full ws:// or wss:// URL of the MUD's WebSocket port.
    mudWsUrl: string;
    mudName: string;
}

export function getConfig(): MudslingerConfig {
    let cfg = (<any>window).MudslingerConfig;
    if (!cfg) {
        throw new Error("MudslingerConfig not found - is config.js loaded before the bundle?");
    }
    return cfg;
}
