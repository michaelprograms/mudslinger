import { describe, it, expect } from "vitest";
import { bodyRowsHtml } from "./bodyPanel";

describe("bodyRowsHtml", () => {
    it("renders one row per limb with damage%, armour, magic", () => {
        const html = bodyRowsHtml({ limbs: {
            "head": { damage: 0, armour: 12, magic: 4 },
            "right arm": { damage: 30, armour: 8, magic: 2 },
        }});
        expect(html).toContain("Head");        // capitalized like the `body` command
        expect(html).toContain("Right arm");
        expect(html).toContain("30%");
        expect(html).toContain(">12<");         // head armour cell
        expect(html).toContain(">4<");          // head magic cell
        expect((html.match(/<tr/g) ?? []).length).toBe(2);
    });

    it("flags a limb red at/above 70% damage, not below", () => {
        const html = bodyRowsHtml({ limbs: {
            "head": { damage: 69 },
            "torso": { damage: 70 },
        }});
        // 69% row has no hurt class; 70% row does
        expect(html).toMatch(/<tr><td class="body-limb">Head/);
        expect(html).toMatch(/<tr class="body-hurt"><td class="body-limb">Torso/);
    });

    it("flags severed limbs with no numbers", () => {
        const html = bodyRowsHtml({ limbs: {}, severed: ["right hand"] });
        expect(html).toContain("body-severed");
        expect(html).toContain("Right hand");
        expect(html).toContain("severed");
        expect(html).not.toContain("%");
    });

    it("defaults missing values to 0 and escapes limb names", () => {
        const html = bodyRowsHtml({ limbs: { "<img>": {} } });
        expect(html).toContain("0%");
        expect(html).toContain("&lt;img&gt;");
        expect(html).not.toContain("<img>");
    });

    it("tolerates empty / absent data", () => {
        expect(bodyRowsHtml({})).toBe("");
        expect(bodyRowsHtml({ limbs: {} })).toBe("");
    });
});
