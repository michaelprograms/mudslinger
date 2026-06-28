import "../base.css";
import { UserConfig } from "./userConfig";
import { AppInfo } from "./appInfo";

import { AliasEditor } from "../panel/alias";
import { AliasManager } from "../manager/alias";
import { CommandInput } from "../ui/commandInput";
import { JsScript, EvtScriptEmitCmd, EvtScriptEmitPrint, EvtScriptEmitEvalError, EvtScriptEmitError } from "./script";
import { JsScriptWin } from "../panel/script";
import { MenuBar } from "../ui/menuBar";

import { StreamManager } from "../manager/stream";
import { MudTerminal } from "../ui/terminal";
import { Socket } from "../net/socket";
import { TriggerEditor } from "../panel/trigger";
import { TriggerManager } from "../manager/trigger";
import { AboutWin } from "../panel/about";
import { getConfig } from "./config";

interface ConnectionTarget {
    host: string;
    port: number;
}

export class Client {
    private aliasEditor: AliasEditor;
    private aliasManager: AliasManager;
    private commandInput: CommandInput;
    private jsScript: JsScript;
    private jsScriptWin: JsScriptWin;
    private menuBar: MenuBar;
    private stream: StreamManager;
    private terminal: MudTerminal;
    private socket: Socket;
    private triggerEditor: TriggerEditor;
    private triggerManager: TriggerManager;
    private aboutWin: AboutWin;

    private serverEcho = false;

    constructor(private connectionTarget: ConnectionTarget) {
        this.aboutWin = new AboutWin();
        this.jsScript = new JsScript();
        this.jsScriptWin = new JsScriptWin(this.jsScript);
        this.triggerManager = new TriggerManager(this.jsScript, UserConfig);
        this.aliasManager = new AliasManager(this.jsScript, UserConfig);
        this.commandInput = new CommandInput(this.aliasManager);

        this.terminal = new MudTerminal();
        this.stream = new StreamManager(this.terminal, UserConfig);

        this.aliasEditor = new AliasEditor(this.aliasManager);
        this.triggerEditor = new TriggerEditor(this.triggerManager);

        this.socket = new Socket(this.stream);
        this.menuBar = new MenuBar(this.aliasEditor, this.triggerEditor, this.jsScriptWin, this.aboutWin);

        // Initialize font size from saved config
        const savedFontSize = UserConfig.get("fontSize");
        if (savedFontSize) {
            this.terminal.setFontSize(savedFontSize);
            this.commandInput.setFontSize(savedFontSize);
        }

        // MenuBar events
        this.menuBar.EvtChangeFontSize.handle((sz: string) => {
            this.terminal.setFontSize(sz);
            UserConfig.set("fontSize", sz);
            this.commandInput.setFontSize(sz);
        });

        this.menuBar.EvtConnectClicked.handle(() => {
            this.socket.openTelnet(this.connectionTarget.host, this.connectionTarget.port);
        });

        this.menuBar.EvtDisconnectClicked.handle(() => {
            this.socket.closeTelnet();
        });

        // Socket events
        this.socket.EvtServerEcho.handle((val: boolean) => {
            this.serverEcho = val;
        });

        this.socket.EvtTelnetTryConnect.handle((val: [string, number]) => {
            this.terminal.handleTelnetTryConnect(val[0], val[1]);
        });

        this.socket.EvtTelnetConnect.handle((_val: [string, number]) => {
            this.serverEcho = false;
            this.menuBar.handleTelnetConnect();
            this.terminal.handleTelnetConnect();
        });

        this.socket.EvtTelnetDisconnect.handle(() => {
            this.menuBar.handleTelnetDisconnect();
            this.terminal.handleTelnetDisconnect();
        });

        this.socket.EvtTelnetError.handle((data: string) => {
            this.terminal.handleTelnetError(data);
        });

        this.socket.EvtWsError.handle(() => {
            this.terminal.handleWsError();
        });

        this.socket.EvtWsConnect.handle((_val: { sid: string }) => {
            this.terminal.handleWsConnect();
        });

        this.socket.EvtWsDisconnect.handle(() => {
            this.menuBar.handleTelnetDisconnect();
            this.terminal.handleWsDisconnect();
        });

        // CommandInput events
        this.commandInput.EvtEmitCmd.handle((data: string) => {
            if (this.serverEcho !== true) {
                this.terminal.handleSendCommand(data);
            }
            this.socket.sendCmd(data);
        });

        this.commandInput.EvtEmitAliasCmds.handle((data) => {
            this.terminal.handleAliasSendCommands(data.orig, data.commands);
            for (const cmd of data.commands) {
                this.socket.sendCmd(cmd);
            }
        });

        // JsScript events
        EvtScriptEmitCmd.handle((data: string) => {
            this.terminal.handleScriptSendCommand(data);
            this.socket.sendCmd(data);
        });

        EvtScriptEmitPrint.handle((data: string) => {
            this.terminal.handleScriptPrint(data);
        });

        EvtScriptEmitError.handle((data: { stack: any }) => {
            this.terminal.handleScriptError(data);
        });

        EvtScriptEmitEvalError.handle((data: { stack: any }) => {
            this.terminal.handleScriptEvalError(data);
        });

        // TriggerManager events
        this.triggerManager.EvtEmitTriggerCmds.handle((data: string[]) => {
            this.terminal.handleTriggerSendCommands(data);
            for (const cmd of data) {
                this.socket.sendCmd(cmd);
            }
        });

        // Terminal line events → triggers
        this.terminal.EvtLine.handle((line: string) => {
            this.triggerManager.handleLine(line);
        });

        this.terminal.EvtRequestInputFocus.handle(() => this.commandInput.focus());

        window.onbeforeunload = () => "";

        this.socket.open().then((success) => {
            if (!success) return;
            this.socket.openTelnet(this.connectionTarget.host, this.connectionTarget.port);
        });
    }

    public readonly UserConfig = UserConfig;
    public readonly AppInfo = AppInfo;
}

function makeCbLocalConfigSave(): (val: string) => void {
    return (val: string) => {
        localStorage.setItem("userConfig", val);
    };
}

let _client: Client;

async function init() {
    const cfg = getConfig();
    const u = new URL(cfg.mudUrl);
    const connectionTarget: ConnectionTarget = { host: u.hostname, port: Number(u.port) };
    UserConfig.init(localStorage.getItem("userConfig"), makeCbLocalConfigSave());
    _client = new Client(connectionTarget);
    document.title = AppInfo.AppTitle + " - " + cfg.mudName;
}

(<any>window).Mudslinger = { get client() { return _client; } };

init();
