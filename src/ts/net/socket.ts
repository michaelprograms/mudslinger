import { EventHook } from "../core/event";
import { TelnetClient } from "../protocol/telnet";
import { UserConfig } from "../core/userConfig";
import { getConfig } from "../core/config";
import { Transport, makeTransport } from "./transport";

export interface TelnetDataHandlerIf {
    handleTelnetData(data: ArrayBuffer): void;
}

export class Socket {
    public EvtServerEcho = new EventHook<boolean>();
    public EvtTelnetTryConnect = new EventHook<[string, number]>();
    public EvtTelnetConnect = new EventHook<[string, number]>();
    public EvtTelnetDisconnect = new EventHook<void>();
    public EvtTelnetError = new EventHook<string>();
    public EvtWsError = new EventHook<any>();
    public EvtWsConnect = new EventHook<{sid: string}>();
    public EvtWsDisconnect = new EventHook<void>();
    private transport!: Transport;
    private telnetClient: TelnetClient | null = null;

    constructor(private dataHandler: TelnetDataHandlerIf) {}

    public async open() {
        this.transport = makeTransport(getConfig());

        this.transport.EvtLinkConnect.handle((data) => {
            this.EvtWsConnect.fire(data);
        });

        this.transport.EvtLinkDisconnect.handle(() => {
            this.EvtWsDisconnect.fire();
        });

        this.transport.EvtLinkError.handle((msg: any) => {
            this.EvtWsError.fire(msg);
        });

        this.transport.EvtMudConnect.handle((val: [string, number]) => {
            this.telnetClient = new TelnetClient((data) => {
                this.transport.write(data);
            });

            this.telnetClient.EvtData.handle((data) => {
                this.dataHandler.handleTelnetData(data);
            });

            this.telnetClient.EvtServerEcho.handle((data) => {
                this.EvtServerEcho.fire(data);
            });

            this.EvtTelnetConnect.fire(val);
        });

        this.transport.EvtMudDisconnect.handle(() => {
            this.telnetClient = null;
            this.EvtTelnetDisconnect.fire();
        });

        this.transport.EvtMudError.handle((data) => {
            this.EvtTelnetError.fire(data);
        });

        this.transport.EvtData.handle((data) => {
            if (this.telnetClient) {
                this.telnetClient.handleData(data);
            }
        });

        return this.transport.open();
    }

    public openTelnet(host: string, port: number) {
        this.EvtTelnetTryConnect.fire([host, port]);
        this.transport.openMud(host, port);
    }

    public closeTelnet() {
        this.transport.closeMud();
    }

    sendCmd(cmd: string) {
        cmd += "\r\n";
        let arr: Uint8Array;
        if (UserConfig.get("utf8Enabled") === true) {
            arr = new TextEncoder().encode(cmd);
        } else {
            arr = new Uint8Array(cmd.length);
            for (let i = 0; i < cmd.length; i++) {
                arr[i] = cmd.charCodeAt(i);
            }
        }
        this.transport.write(arr.buffer as ArrayBuffer);
    }
}
