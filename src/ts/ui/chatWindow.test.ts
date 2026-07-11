import { describe, it, expect } from "vitest";
import { ansiToHtml } from "./chatWindow";

describe("ansiToHtml", () => {
    it("renders the real Comm.Channel.Text example as a bold span, reset closes it", () => {
        const msg = "\x1b[1mHogan's battlecry of the Mercenaries echoes throughout the realm.\x1b[0;37;40m";
        const html = ansiToHtml(msg);
        expect(html).toContain("font-weight:bold");
        expect(html).toContain("Hogan&#39;s battlecry".replace("&#39;", "'")); // apostrophe not html-special
        // trailing reset produces no visible run
        expect(html.endsWith("</span>")).toBe(true);
    });

    it("maps bold + fg-yellow (Merentha bright yellow = ESC[1m ESC[33m) to bright #ffff00", () => {
        expect(ansiToHtml("\x1b[1m\x1b[33mhi")).toContain("color:#ffff00");
        // plain 33 without bold is the dim yellow
        expect(ansiToHtml("\x1b[33mhi")).toContain("color:#808000");
    });

    it("escapes HTML-special chars in remote text", () => {
        const html = ansiToHtml("<script>alert(1)</script> & more");
        expect(html).toContain("&lt;script&gt;");
        expect(html).not.toContain("<script>");
        expect(html).toContain("&amp;");
    });

    it("drops black background (RESET's ESC[0;37;40m) so the overlay shows through", () => {
        const html = ansiToHtml("\x1b[0;37;40m hello");
        expect(html).not.toContain("background-color");
        // an explicit non-black bg is still painted
        expect(ansiToHtml("\x1b[41mred bg")).toContain("background-color:#800000");
    });

    it("swaps fg/bg on inverse", () => {
        // red fg, inverse -> red becomes background
        const html = ansiToHtml("\x1b[31m\x1b[7mx");
        expect(html).toContain("background-color:#800000");
    });
});
