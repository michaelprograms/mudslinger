import { UserConfig } from "./userConfig";
import { AppInfo } from "./appInfo";

import { AliasEditor } from "./aliasEditor";
import { AliasManager } from "./aliasManager";
import { CommandInput } from "./commandInput";
import { JsScript, EvtScriptEmitCmd, EvtScriptEmitPrint, EvtScriptEmitEvalError, EvtScriptEmitError } from "./jsScript";
import { JsScriptWin } from "./jsScriptWin";
import { MenuBar } from "./menuBar";

import { Mxp } from "./mxp";
import { OutputManager } from "./outputManager";
import { OutputWin } from "./outputWin";
import { Socket } from "./socket";
import { TriggerEditor } from "./triggerEditor";
import { TriggerManager } from "./triggerManager";
import { AboutWin } from "./aboutWin";
import { getConfig } from "./clientConfig";
interface ConnectionTarget {
    host: string,
    port: number
}

export class Client {
    private aliasEditor: AliasEditor;
    private aliasManager: AliasManager;
    private commandInput: CommandInput;
    private jsScript: JsScript;
    private jsScriptWin: JsScriptWin;
    private menuBar: MenuBar;
    private mxp: Mxp;
    private outputManager: OutputManager;
    private outputWin: OutputWin;
    private socket: Socket;
    private triggerEditor: TriggerEditor;
    private triggerManager: TriggerManager;
    private aboutWin: AboutWin;

    private serverEcho = false;

    constructor(private connectionTarget: ConnectionTarget) {
        let clientName: string = "Mudslinger";

        this.aboutWin = new AboutWin();
        this.jsScript = new JsScript();

        this.jsScriptWin = new JsScriptWin(this.jsScript);
        this.triggerManager = new TriggerManager(
            this.jsScript, UserConfig);
        this.aliasManager = new AliasManager(
            this.jsScript, UserConfig);

        this.commandInput = new CommandInput(this.aliasManager);

        this.outputWin = new OutputWin(UserConfig);

        this.aliasEditor = new AliasEditor(this.aliasManager);
        this.triggerEditor = new TriggerEditor(this.triggerManager);

        this.outputManager = new OutputManager(this.outputWin, UserConfig);

        this.mxp = new Mxp(this.outputManager, undefined, clientName);
        this.socket = new Socket(this.outputManager, this.mxp);
        this.menuBar = new MenuBar(this.aliasEditor, this.triggerEditor, this.jsScriptWin, this.aboutWin);

        // MenuBar events
        this.menuBar.EvtChangeDefaultColor.handle((data: [string, string]) => {
            this.outputManager.handleChangeDefaultColor(data[0], data[1]);
        });

        this.menuBar.EvtChangeDefaultBgColor.handle((data: [string, string]) => {
            this.outputManager.handleChangeDefaultBgColor(data[0], data[1]);
        });

        this.menuBar.EvtChangeFontSize.handle((sz: string) => {
            this.outputManager.handleChangeFontSize(sz);
        });

        this.menuBar.EvtConnectClicked.handle(() => {
            this.socket.openTelnet(
                this.connectionTarget.host,
                this.connectionTarget.port
            );
        });

        this.menuBar.EvtDisconnectClicked.handle(() => {
            this.socket.closeTelnet();
        });

        // Socket events
        this.socket.EvtServerEcho.handle((val: boolean) => {
            // Server echo ON means we should have local echo OFF
            this.serverEcho = val;
        });

        this.socket.EvtTelnetTryConnect.handle((val: [string, number]) => {
            this.outputWin.handleTelnetTryConnect(val[0], val[1]); 
        });

        this.socket.EvtTelnetConnect.handle((_val: [string, number]) => {
            this.serverEcho = false;
            this.menuBar.handleTelnetConnect();
            this.outputWin.handleTelnetConnect();
        });

        this.socket.EvtTelnetDisconnect.handle(() => {
            this.menuBar.handleTelnetDisconnect();
            this.outputWin.handleTelnetDisconnect();
        });

        this.socket.EvtTelnetError.handle((data: string) => {
            this.outputWin.handleTelnetError(data);
        });

        this.socket.EvtWsError.handle((data) => {
            this.outputWin.handleWsError();
        });

        this.socket.EvtWsConnect.handle((_val: {sid: string}) => {
            this.outputWin.handleWsConnect();
        });

        this.socket.EvtWsDisconnect.handle(() => {
            this.menuBar.handleTelnetDisconnect();
            this.outputWin.handleWsDisconnect();
        });

        // CommandInput events
        this.commandInput.EvtEmitCmd.handle((data: string) => {
            if (true !== this.serverEcho) {
                this.outputWin.handleSendCommand(data);
            }
            this.socket.sendCmd(data);
        });

        this.commandInput.EvtEmitAliasCmds.handle((data) => {
            this.outputWin.handleAliasSendCommands(data.orig, data.commands)
            for (let cmd of data.commands) {
                this.socket.sendCmd(cmd);
            }
        });

        // Mxp events
        this.mxp.EvtEmitCmd.handle((data) => {
            if (data.noPrint !== true) {
                this.outputWin.handleSendCommand(data.value);
            }
            this.socket.sendCmd(data.value);
        });

        // JsScript events
        EvtScriptEmitCmd.handle((data: string) => {
            this.outputWin.handleScriptSendCommand(data);
            this.socket.sendCmd(data);
        });

        EvtScriptEmitPrint.handle((data: string) => {
            this.outputWin.handleScriptPrint(data);
        });

        EvtScriptEmitError.handle((data: {stack: any}) => {
            this.outputWin.handleScriptError(data)
        });

        EvtScriptEmitEvalError.handle((data: {stack: any}) => {
            this.outputWin.handleScriptEvalError(data)
        });

        // TriggerManager events
        this.triggerManager.EvtEmitTriggerCmds.handle((data: string[]) => {
            this.outputWin.handleTriggerSendCommands(data);
            for (let cmd of data) {
                this.socket.sendCmd(cmd);
            }
        });

        // OutputWin events
        this.outputWin.EvtLine.handle((line: string) => {
            this.triggerManager.handleLine(line);
        });

        // OutputManager events
        this.outputManager.EvtNewLine.handle(() => {
            this.mxp.handleNewline();
        });

        this.outputManager.EvtMxpTag.handle((data: string) => {
            this.mxp.handleMxpTag(data);
        });

        this.outputManager.EvtFontSizeChanged.handle((sz: string) => {
            this.commandInput.setFontSize(sz);
        });

        this.commandInput.setFontSize(this.outputManager.getFontSize());

        // Prevent navigating away accidentally
        window.onbeforeunload = () => {
            return "";
        };

        this.socket.open().then((success) => {
            if (!success) { return; }

            this.socket.openTelnet(
                this.connectionTarget.host,
                this.connectionTarget.port);
        });
    }

    public readonly UserConfig = UserConfig;
    public readonly AppInfo = AppInfo;
}

function makeCbLocalConfigSave(): (val: string) => void {
    return (val: string) => {
        localStorage.setItem('userConfig', val);
    };
}

export namespace Mudslinger {
    export let client: Client;
    export async function init() {
        let cfg = getConfig();
        let u = new URL(cfg.mudWsUrl);
        let connectionTarget: ConnectionTarget = { host: u.hostname, port: Number(u.port) };

        UserConfig.init(localStorage.getItem("userConfig"), makeCbLocalConfigSave());

        client = new Client(connectionTarget);
        document.title = client.AppInfo.AppTitle + " - " + cfg.mudName;
    }
}

(<any>window).Mudslinger = Mudslinger;
