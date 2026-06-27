window.MudslingerConfig = {
    // Direct MUD WebSocket URL (e.g. a FluffOS websocket port). Use wss:// when
    // the page is served over HTTPS, or the browser will block mixed content.
    mudWsUrl: "ws://localhost:4000",
    // Display name and (display-only) address of the MUD this instance serves
    mudName: "My MUD",
    mudHost: "127.0.0.1",
    mudPort: 4000,
    // Enable MSDP + gauge/map side panel (MUD must support MSDP)
    msdp: false
};
