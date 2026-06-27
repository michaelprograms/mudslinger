import { describe, it, expect, vi, beforeEach } from "vitest";
import { StreamManager } from "./stream";

const makeMockTerminal = () => ({
    EvtLine: { fire: vi.fn() },
    write: vi.fn(),
});

const makeConfig = (utf8Enabled = true) => ({
    get: (_key: string) => utf8Enabled,
});

describe("StreamManager", () => {
    let terminal: ReturnType<typeof makeMockTerminal>;
    let stream: StreamManager;

    beforeEach(() => {
        terminal = makeMockTerminal();
        stream = new StreamManager(terminal as any, makeConfig() as any);
    });

    it("fires EvtLine with plain text on newline", () => {
        stream.handleTelnetData(new TextEncoder().encode("Hello\n").buffer as ArrayBuffer);
        expect(terminal.EvtLine.fire).toHaveBeenCalledWith("Hello");
    });

    it("strips ANSI SGR codes from line text", () => {
        stream.handleTelnetData(new TextEncoder().encode("\x1b[32mGreen\x1b[0m\n").buffer as ArrayBuffer);
        expect(terminal.EvtLine.fire).toHaveBeenCalledWith("Green");
    });

    it("strips xterm 256-color sequences from line text", () => {
        stream.handleTelnetData(new TextEncoder().encode("\x1b[38;5;196mRed\x1b[0m\n").buffer as ArrayBuffer);
        expect(terminal.EvtLine.fire).toHaveBeenCalledWith("Red");
    });

    it("fires EvtLine for each line in a multi-line packet", () => {
        stream.handleTelnetData(new TextEncoder().encode("line1\nline2\nline3\n").buffer as ArrayBuffer);
        expect(terminal.EvtLine.fire).toHaveBeenCalledTimes(3);
        expect(terminal.EvtLine.fire).toHaveBeenNthCalledWith(1, "line1");
        expect(terminal.EvtLine.fire).toHaveBeenNthCalledWith(2, "line2");
        expect(terminal.EvtLine.fire).toHaveBeenNthCalledWith(3, "line3");
    });

    it("buffers partial lines across packets", () => {
        stream.handleTelnetData(new TextEncoder().encode("partial").buffer as ArrayBuffer);
        expect(terminal.EvtLine.fire).not.toHaveBeenCalled();
        stream.handleTelnetData(new TextEncoder().encode(" line\n").buffer as ArrayBuffer);
        expect(terminal.EvtLine.fire).toHaveBeenCalledWith("partial line");
    });

    it("writes raw data to terminal unmodified", () => {
        stream.handleTelnetData(new TextEncoder().encode("Hello\r\n").buffer as ArrayBuffer);
        expect(terminal.write).toHaveBeenCalledWith("Hello\r\n");
    });

    it("strips carriage returns for line tracking but not for write", () => {
        stream.handleTelnetData(new TextEncoder().encode("line\r\n").buffer as ArrayBuffer);
        expect(terminal.write).toHaveBeenCalledWith("line\r\n");
        expect(terminal.EvtLine.fire).toHaveBeenCalledWith("line");
    });
});
