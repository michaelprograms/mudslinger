import "./bodyPanel.css";
import { UserConfig } from "../core/userConfig";

export interface LimbData { damage?: number; armour?: number; magic?: number; }
export interface BodyData { limbs?: Record<string, LimbData>; severed?: string[]; }

// "right arm" -> "Right arm", to match the in-game `body` command labels.
function cap(name: string): string {
    return name.length ? name[0].toUpperCase() + name.slice(1) : name;
}

function escapeHtml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Build the <tbody> rows for the Char.Body table. Limb names are remote data,
// so they're HTML-escaped; every other cell is a locally-formatted number.
// Severed limbs (no numbers) render last, flagged.
export function bodyRowsHtml(data: BodyData): string {
    const rows: string[] = [];
    for (const [name, limb] of Object.entries(data?.limbs ?? {})) {
        const dmg = Number(limb?.damage ?? 0);
        const arm = Number(limb?.armour ?? 0);
        const mag = Number(limb?.magic ?? 0);
        rows.push(
            `<tr><td class="body-limb">${escapeHtml(cap(name))}</td>` +
            `<td class="body-num">${dmg}%</td>` +
            `<td class="body-num">${arm}</td>` +
            `<td class="body-num">${mag}</td></tr>`
        );
    }
    for (const name of data?.severed ?? []) {
        rows.push(
            `<tr class="body-severed"><td class="body-limb">${escapeHtml(cap(name))}</td>` +
            `<td class="body-num" colspan="3">severed</td></tr>`
        );
    }
    return rows.join("");
}

export class BodyPanel {
    private container: HTMLElement;
    private tbody: HTMLElement;
    private enabled: boolean;
    private hasData = false;

    constructor() {
        this.enabled = UserConfig.getDef("bodyPanelEnabled", false);

        this.container = document.createElement("div");
        this.container.id = "bodyPanel";
        this.container.hidden = true;
        this.container.innerHTML =
            `<table class="body-table"><thead><tr>` +
            `<th>Limb</th><th>Dmg</th><th>Arm</th><th>Mag</th>` +
            `</tr></thead><tbody></tbody></table>`;
        this.tbody = this.container.querySelector("tbody")!;

        document.getElementById("mainWin")!.appendChild(this.container);

        UserConfig.onSet("bodyPanelEnabled", (v: boolean) => {
            this.enabled = v;
            this.refreshVisibility();
        });
    }

    public update(data: BodyData): void {
        // Safe: limb names are HTML-escaped in bodyRowsHtml; all other cells are numbers.
        this.tbody.innerHTML = bodyRowsHtml(data);
        this.hasData = this.tbody.childElementCount > 0;
        this.refreshVisibility();
    }

    // Clear on disconnect so the last session's limbs aren't shown as current
    // (matches VitalsGauges / ChatWindow).
    public reset(): void {
        this.tbody.replaceChildren();
        this.hasData = false;
        this.refreshVisibility();
    }

    private refreshVisibility(): void {
        this.container.hidden = !(this.enabled && this.hasData);
    }
}
