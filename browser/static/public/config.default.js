window.MudslingerConfig = {
    // Transport: "proxy" (default) talks to the telnet proxy over socket.io;
    // "websocket" connects directly to a MUD's WebSocket port (e.g. FluffOS).
    transport: "proxy",
    // URL of the telnet proxy's socket.io /telnet namespace (used when transport === "proxy")
    socketIoUrl: "http://localhost:8080/telnet",
    // Direct MUD WebSocket URL (required when transport === "websocket")
    // mudWsUrl: "wss://your-mud.example.com:10002",
    // Display name and (display-only) address of the MUD this instance serves
    mudName: "My MUD",
    mudHost: "127.0.0.1",
    mudPort: 4000,
    // Enable MSDP + gauge/map side panel (MUD must support MSDP)
    msdp: false
};
