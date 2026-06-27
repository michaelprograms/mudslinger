import { AppInfo } from "./appInfo";

export interface MudslingerConfig {
    mudUrl: string;
    mudName: string;
}

export function getConfig(): MudslingerConfig {
    return {
        mudUrl:   AppInfo.MudUrl,
        mudName:  AppInfo.MudName,
    };
}
