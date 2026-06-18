import { EventHook } from "./event";

import { Mxp } from "./mxp";
import { OutputManager } from "./outputManager";
import { TelnetClient, MsdpVarName, MsdpVal } from "./telnetClient";
import { UserConfig } from "./userConfig";
import { getConfig } from "./clientConfig";
import { Transport, makeTransport } from "./transport";


export class Socket {
    public EvtServerEcho = new EventHook<boolean>();
    public EvtTelnetTryConnect = new EventHook<[string, number]>();
    public EvtTelnetConnect = new EventHook<[string, number]>();
    public EvtTelnetDisconnect = new EventHook<void>();
    public EvtTelnetError = new EventHook<string>();
    public EvtWsError = new EventHook<any>();
    public EvtWsConnect = new EventHook<{sid: string}>();
    public EvtWsDisconnect = new EventHook<void>();
    public EvtSetClientIp = new EventHook<string>();
    public EvtMsdpVar = new EventHook<[MsdpVarName, MsdpVal]>();

    private transport: Transport;
    private telnetClient: TelnetClient;
    private clientIp: string;

    constructor(private outputManager: OutputManager, private mxp: Mxp) {
    }

    public async open() {
        this.transport = makeTransport(getConfig());

        this.transport.EvtLinkConnect.handle((data) => {
            this.EvtWsConnect.fire(data);
        });

        this.transport.EvtLinkDisconnect.handle(() => {
            this.EvtWsDisconnect.fire(null);
        });

        this.transport.EvtLinkError.handle((msg: any) => {
            this.EvtWsError.fire(msg);
        });

        this.transport.EvtMudConnect.handle((val: [string, number]) => {
            let enableMsdp = getConfig().msdp;
            this.telnetClient = new TelnetClient((data) => {
                this.transport.write(data);
            }, enableMsdp);

            // websocket mode has no proxy to report the IP, so clientIp is
            // unset; default to "" so NEW_ENVIRON IPADDRESS doesn't crash.
            this.telnetClient.clientIp = this.clientIp || "";

            this.telnetClient.EvtData.handle((data) => {
                this.outputManager.handleTelnetData(data);
            });

            this.telnetClient.EvtServerEcho.handle((data) => {
                this.EvtServerEcho.fire(data);
            });

            this.telnetClient.EvtMsdpVar.handle((data) => {
                this.EvtMsdpVar.fire(data);
            });

            this.EvtTelnetConnect.fire(val);
        });

        this.transport.EvtMudDisconnect.handle(() => {
            this.telnetClient = null;
            this.EvtTelnetDisconnect.fire(null);
        });

        this.transport.EvtMudError.handle((data) => {
            this.EvtTelnetError.fire(data);
        });

        this.transport.EvtData.handle((data) => {
            if (this.telnetClient) {
                this.telnetClient.handleData(data);
            }
        });

        let ipHook = this.transport.EvtSetClientIp;
        if (ipHook) {
            ipHook.handle((ipAddr: string) => {
                let re = /::ffff:(\d+\.\d+\.\d+\.\d+)/;
                let match = re.exec(ipAddr);
                if (match) {
                    ipAddr = match[1];
                }

                this.clientIp = ipAddr;
                if (this.telnetClient) {
                    this.telnetClient.clientIp = ipAddr;
                }
                this.EvtSetClientIp.fire(this.clientIp);
            });
        }

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

        this.transport.write(arr.buffer);
    }
}
