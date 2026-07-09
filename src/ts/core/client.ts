import "../base.css";
import { UserConfig } from "./userConfig";
import { AppInfo } from "./appInfo";

import { AliasManager } from "../manager/alias";
import { CommandInput } from "../ui/commandInput";
import { JsScript, EvtScriptEmitCmd, EvtScriptEmitPrint, EvtScriptEmitEvalError, EvtScriptEmitError } from "./script";
import { MenuBar } from "../ui/menuBar";
import { MovementPad } from "../ui/movementPad";

import { StreamManager } from "../manager/stream";
import { MudTerminal } from "../ui/terminal";
import { Socket } from "../net/socket";
import { TriggerManager } from "../manager/trigger";
import { AboutWin } from "../panel/about";
import { ConfigWin } from "../panel/config";
import { getConfig } from "./config";
import { IdeClient } from "./ideClient";

interface ConnectionTarget {
    host: string;
    port: number;
}

export class Client {
    private editorWin?: import("../panel/editor").EditorWin;
    private ideWin?: import("../panel/idePanel").IdeWin;
    private aliasManager: AliasManager;
    private commandInput: CommandInput;
    private movementPad: MovementPad;
    private jsScript: JsScript;
    private menuBar: MenuBar;
    private stream: StreamManager;
    private terminal: MudTerminal;
    private socket: Socket;
    private ideClient: IdeClient;
    private triggerManager: TriggerManager;
    private aboutWin: AboutWin;
    private configWin: ConfigWin;

    private serverEcho = false;

    constructor(private connectionTarget: ConnectionTarget) {
        this.aboutWin = new AboutWin();
        this.configWin = new ConfigWin();
        this.jsScript = new JsScript();
        this.triggerManager = new TriggerManager(this.jsScript, UserConfig);
        this.aliasManager = new AliasManager(this.jsScript, UserConfig);
        this.commandInput = new CommandInput(this.aliasManager);
        this.movementPad = new MovementPad();

        this.terminal = new MudTerminal();
        this.stream = new StreamManager(this.terminal, UserConfig);

        this.socket = new Socket(this.stream);
        this.ideClient = new IdeClient(this.socket);
        this.menuBar = new MenuBar(this.aboutWin, this.configWin);

        // Lazily load the CodeMirror-backed editor panel on first open (keeps it out of the initial bundle)
        this.menuBar.EvtEditorClicked.handle(async () => {
            if (!this.editorWin) {
                const { EditorWin } = await import("../panel/editor");
                this.editorWin = new EditorWin(this.aliasManager, this.triggerManager, this.jsScript);
            }
            this.editorWin.show();
        });

        // IDE panel: same lazy-load pattern (CodeMirror stays out of the initial bundle)
        this.menuBar.EvtIdeClicked.handle(async () => {
            if (!this.ideWin) {
                const { IdeWin } = await import("../panel/idePanel");
                this.ideWin = new IdeWin(this.ideClient, () => this.jsScript.getGmcp());
            }
            this.ideWin.show();
        });

        // Initialize font size/family from saved config
        const savedFontSize: number | undefined = UserConfig.get("fontSize");
        if (savedFontSize) {
            this.terminal.setFontSize(savedFontSize);
            this.commandInput.setFontSize(savedFontSize);
        }
        const savedFontFamily: string | undefined = UserConfig.get("fontFamily");
        if (savedFontFamily) {
            this.terminal.setFontFamily(savedFontFamily);
            this.commandInput.setFontFamily(savedFontFamily);
        }

        // ConfigWin events
        this.configWin.EvtChangeFontSize.handle((sz: number) => {
            this.terminal.setFontSize(sz);
            this.commandInput.setFontSize(sz);
        });
        this.configWin.EvtChangeFontFamily.handle((family: string) => {
            this.terminal.setFontFamily(family);
            this.commandInput.setFontFamily(family);
        });

        this.menuBar.EvtConnectClicked.handle(() => {
            this.socket.openTelnet(this.connectionTarget.host, this.connectionTarget.port);
        });

        this.menuBar.EvtDisconnectClicked.handle(() => {
            this.socket.closeTelnet();
        });

        // Socket events
        this.socket.EvtGmcp.handle(({pkg, data}: {pkg: string; data: any}) => {
            if (pkg.startsWith('Ide.')) {
                this.ideClient.handleGmcp(pkg, data);
                return; // out-of-band editing traffic; kept out of the gmcp object
            }
            this.jsScript.setGmcp(pkg, data);
            if (pkg === 'Char.Info') {
                this.menuBar.setImmortal(Number(data?.immortal) === 1);
                this.ideWin?.followCwd(); // in-game cd resends Char.Info
            }
            // Char.Name (IRE-style) or Char.Info (Merentha) both identify the character
            if ((pkg === 'Char.Name' || pkg === 'Char.Info') && data?.name) {
                const name = String(data.name);
                UserConfig.set('activeChar', name);
                const known: string[] = UserConfig.getDef('knownChars', []);
                if (!known.includes(name)) UserConfig.set('knownChars', [...known, name]);
            }
        });

        this.socket.EvtServerEcho.handle((val: boolean) => {
            this.serverEcho = val;
            this.commandInput.setPasswordMode(val);
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
            this.ideClient.reset();
            this.jsScript.clearGmcp();
            this.menuBar.handleTelnetDisconnect();
            this.terminal.handleTelnetDisconnect();
        });

        this.socket.EvtTelnetError.handle((data: string) => {
            this.terminal.handleTelnetError(data);
        });

        // CommandInput + MovementPad events (both echo locally then send)
        this.commandInput.EvtEmitCmd.handle((data: string) => this.sendUserCommand(data));
        this.movementPad.EvtEmitCmd.handle((data: string) => this.sendUserCommand(data));

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

    private sendUserCommand(data: string): void {
        if (!this.serverEcho && UserConfig.getDef('localEcho', true)) {
            this.terminal.handleSendCommand(data);
        }
        this.socket.sendCmd(data);
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
