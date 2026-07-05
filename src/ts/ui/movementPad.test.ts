import { describe, it, expect } from "vitest";
import { MOVE_BUTTONS } from "./movementPad";

describe("MOVE_BUTTONS", () => {
    it("maps the 13 expected directions", () => {
        const cmds = MOVE_BUTTONS.map(b => b.cmd);
        expect(cmds.sort()).toEqual([
            "down", "east", "enter", "look", "north", "northeast", "northwest",
            "out", "south", "southeast", "southwest", "up", "west",
        ]);
    });

    it("has unique commands and non-empty label + layout class for each", () => {
        expect(new Set(MOVE_BUTTONS.map(b => b.cmd)).size).toBe(MOVE_BUTTONS.length);
        for (const b of MOVE_BUTTONS) {
            expect(b.label.length).toBeGreaterThan(0);
            expect(b.cls.length).toBeGreaterThan(0);
        }
    });
});
