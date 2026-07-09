import "./vitalsGauges.css";
import { UserConfig } from "../core/userConfig";

export interface VitalsData {
    hp?: number; maxhp?: number;
    sp?: number; maxsp?: number;
    mp?: number; maxmp?: number;
    xp?: number; maxxp?: number;
}

const GAUGES: { key: keyof VitalsData; maxKey: keyof VitalsData; label: string; cls: string; abbreviate?: boolean }[] = [
    { key: "hp", maxKey: "maxhp", label: "HP", cls: "hp" },
    { key: "sp", maxKey: "maxsp", label: "SP", cls: "sp" },
    { key: "mp", maxKey: "maxmp", label: "MP", cls: "mp" },
    { key: "xp", maxKey: "maxxp", label: "XP", cls: "xp", abbreviate: true },
];

// Below this percentage a gauge pulses to flag a critical vital.
const CRITICAL_PCT = 25;

function formatNumber(n: number): string {
    return Math.round(n).toLocaleString("en-US");
}

// e.g. 102984 -> "103.0k", 247336770 -> "247.3m"
function abbreviateNumber(n: number): string {
    const sign = n < 0 ? "-" : "";
    const abs = Math.abs(n);
    if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1)}b`;
    if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)}m`;
    if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}k`;
    return `${sign}${Math.round(abs)}`;
}

export class VitalsGauges {
    private container: HTMLElement;
    private fills: Record<string, HTMLElement> = {};
    private texts: Record<string, HTMLElement> = {};
    private enabled: boolean;
    private hasData = false;

    constructor() {
        this.enabled = UserConfig.getDef("vitalsGaugesEnabled", true);

        this.container = document.createElement("div");
        this.container.id = "vitalsGauges";
        this.container.hidden = true;

        for (const g of GAUGES) {
            const gauge = document.createElement("div");
            gauge.className = `vgauge vgauge-${g.cls}`;

            const fill = document.createElement("div");
            fill.className = "vgauge-fill";

            const text = document.createElement("span");
            text.className = "vgauge-text";
            text.textContent = g.label;

            gauge.appendChild(fill);
            gauge.appendChild(text);
            this.container.appendChild(gauge);

            this.fills[g.key] = fill;
            this.texts[g.key] = text;
        }

        const mainWin = document.getElementById("mainWin")!;
        const cmdCont = document.getElementById("cmdCont")!;
        mainWin.insertBefore(this.container, cmdCont);

        UserConfig.onSet("vitalsGaugesEnabled", (v: boolean) => {
            this.enabled = v;
            this.refreshVisibility();
        });
    }

    public update(data: VitalsData): void {
        for (const g of GAUGES) {
            const current = Number(data[g.key] ?? 0);
            const max = Number(data[g.maxKey] ?? 0);
            const pct = max > 0 ? (current / max) * 100 : 0;
            const clampedPct = Math.max(0, Math.min(100, pct));

            const format = g.abbreviate ? abbreviateNumber : formatNumber;

            this.fills[g.key].style.width = `${clampedPct}%`;
            this.fills[g.key].classList.toggle("vgauge-critical", pct < CRITICAL_PCT);
            this.texts[g.key].textContent = `${g.label} ${format(current)}/${format(max)} (${Math.round(pct)}%)`;
        }
        this.hasData = true;
        this.refreshVisibility();
    }

    // Hide again on disconnect so stale numbers from the last session aren't shown as current.
    public reset(): void {
        this.hasData = false;
        this.refreshVisibility();
    }

    private refreshVisibility(): void {
        this.container.hidden = !(this.enabled && this.hasData);
    }
}
