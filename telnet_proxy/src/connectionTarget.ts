export interface MudTarget {
    host: string;
    port: number;
}

export function getMudTarget(config: { mudHost?: string; mudPort?: number }): MudTarget {
    if (!config.mudHost) {
        throw new Error("configServer.js must define mudHost");
    }
    if (!config.mudPort) {
        throw new Error("configServer.js must define mudPort");
    }
    return { host: config.mudHost, port: config.mudPort };
}
