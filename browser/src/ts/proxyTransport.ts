import { EventHook } from "./event";
import { io, Socket as IoSocket } from "socket.io-client";
import { IoEvent } from "../../../common/src/ts/ioevent";
import { Transport } from "./transport";

export class ProxyTransport implements Transport {
    public EvtLinkConnect = new EventHook<{ sid: string }>();
    public EvtLinkDisconnect = new EventHook<void>();
    public EvtLinkError = new EventHook<any>();
    public EvtMudConnect = new EventHook<[string, number]>();
    public EvtMudDisconnect = new EventHook<void>();
    public EvtMudError = new EventHook<string>();
    public EvtData = new EventHook<ArrayBuffer>();
    public EvtSetClientIp = new EventHook<string>();

    private ioConn!: IoSocket;
    private ioEvt!: IoEvent;

    constructor(private socketIoUrl: string) {
    }

    public async open(): Promise<boolean> {
        console.log("Connecting to telnet proxy server at", this.socketIoUrl);
        this.ioConn = io(this.socketIoUrl);

        this.ioConn.on("connect", () => {
            this.EvtLinkConnect.fire({ sid: this.ioConn.id || "" });
        });
        this.ioConn.on("disconnect", () => {
            this.EvtLinkDisconnect.fire();
        });
        this.ioConn.on("error", (msg: any) => {
            this.EvtLinkError.fire(msg);
        });
        this.ioConn.on("connect_error", (msg: any) => {
            this.EvtLinkError.fire(msg);
        });

        this.ioEvt = new IoEvent(this.ioConn);

        this.ioEvt.srvTelnetOpened.handle((val: [string, number]) => {
            this.EvtMudConnect.fire(val);
        });
        this.ioEvt.srvTelnetClosed.handle(() => {
            this.EvtMudDisconnect.fire();
        });
        this.ioEvt.srvTelnetError.handle((data) => {
            this.EvtMudError.fire(data);
        });
        this.ioEvt.srvTelnetData.handle((data) => {
            this.EvtData.fire(data);
        });
        this.ioEvt.srvSetClientIp.handle((ipAddr: string) => {
            this.EvtSetClientIp.fire(ipAddr);
        });

        return true;
    }

    public openMud(host: string, port: number): void {
        this.ioEvt.clReqTelnetOpen.fire([host, port]);
    }

    public write(data: ArrayBuffer): void {
        this.ioEvt.clReqTelnetWrite.fire(data);
    }

    public closeMud(): void {
        this.ioEvt.clReqTelnetClose.fire(undefined);
    }
}
