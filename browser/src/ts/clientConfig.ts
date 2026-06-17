export interface MudslingerConfig {
    socketIoUrl: string;
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
