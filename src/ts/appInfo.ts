declare const __APP_VERSION__: string;
declare const __APP_BUILD__: string;
declare const __MUD_URL__: string;
declare const __MUD_NAME__: string;

export namespace AppInfo {
    export const AppTitle = "Mudslinger";
    export const RepoUrl  = "https://github.com/michaelprograms/mudslinger";
    export const Version  = __APP_VERSION__;
    export const Build    = __APP_BUILD__;
    export const MudUrl   = __MUD_URL__;
    export const MudName  = __MUD_NAME__;
}
