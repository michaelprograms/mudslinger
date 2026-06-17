import * as http from "http";
import { Server, Socket, Namespace } from "socket.io";
import * as net from "net";

import { IoEvent } from "../../common/src/ts/ioevent";
import { getMudTarget } from "./connectionTarget";

let configPath = process.env.MUDSLINGER_PROXY_CONFIG || "../../../configServer.js";
let serverConfig = require(configPath);
console.log(serverConfig);

let telnetIdNext: number = 0;

let server: http.Server = http.createServer();
let io = new Server(server, { cors: { origin: serverConfig.corsOrigin || "*" } });

let telnetNs: Namespace = io.of("/telnet");
telnetNs.on("connection", (client: Socket) => {
    let telnet: net.Socket;
    let ioEvt = new IoEvent(client);
    let remoteAddr: string = (client.request.headers['x-real-ip'] as string) || client.handshake.address;

    let writeQueue: any[] = [];
    let canWrite: boolean =  true;
    let checkWrite = () => {
        if (!canWrite) { return; }

        if (writeQueue.length > 0) {
            let data = writeQueue.shift();
            canWrite = false;
            canWrite = telnet.write(data as Buffer);
        }
    };

    let writeData = (data: any) => {
        writeQueue.push(data);
        checkWrite();
    };

    client.on("disconnect", () => {
        if (telnet) {
            telnet.destroy();
            telnet = null;
        }
    });

    ioEvt.clReqTelnetOpen.handle((args: [string, number]) => {
        if (telnet) { return; }
        telnet = new net.Socket();

        let telnetId: number = telnetIdNext++;

        let conStartTime: Date;

        let { host, port } = getMudTarget(serverConfig);

        telnet.on("data", (data: Buffer) => {
            ioEvt.srvTelnetData.fire(data as any);
        });
        telnet.on("close", (had_error: boolean) => {
            ioEvt.srvTelnetClosed.fire(had_error);
            telnet = null;
            let connEndTime = new Date();
            let elapsed: number = conStartTime && (<any>connEndTime - <any>conStartTime);
            tlog(telnetId, "::", remoteAddr, "->", host, port, "::closed after", elapsed && (elapsed/1000), "seconds");
        });
        telnet.on("drain", () => {
            canWrite = true;
            checkWrite();
        });
        telnet.on("error", (err: Error) => {
            tlog(telnetId, "::", "TELNET ERROR:", err);
            ioEvt.srvTelnetError.fire(err.message);
        });

        try {
            tlog(telnetId, "::", remoteAddr, "->", host, port, "::opening");
            telnet.connect(port, host, () => {
                ioEvt.srvTelnetOpened.fire([host, port]);
                conStartTime = new Date();
            });
        }
        catch (err) {
            tlog(telnetId, "::", "ERROR CONNECTING TELNET:", err);
            ioEvt.srvTelnetError.fire(err.message);
        }
    });

    ioEvt.clReqTelnetClose.handle(() => {
        if (telnet == null) { return; }
        telnet.destroy();
        telnet = null;
    });

    ioEvt.clReqTelnetWrite.handle((data) => {
        if (telnet == null) { return; }
        writeData(data);
    });

    ioEvt.srvSetClientIp.fire(remoteAddr);
});

server.on("error", (err: Error) => {
    tlog("Server error:", err);
});

server.listen(serverConfig.serverPort, serverConfig.serverHost, () => {
    tlog("Server is running on " + serverConfig.serverHost + ":" + serverConfig.serverPort);
});

function tlog(...args: any[]) {
    console.log("[[", new Date().toLocaleString(), "]]", ...args);
}
