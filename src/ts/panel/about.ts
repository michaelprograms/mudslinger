import "./about.css";
import { AppInfo } from "../core/appInfo";
import { initDrag } from "./base";

type PanelMode = 'float' | 'top' | 'bottom' | 'left' | 'right' | 'maximize';

export class AboutWin {
    private panel: HTMLElement;
    private titlebar: HTMLElement;
    private mode: PanelMode = 'float';
    private floatStyle = { top: '10%', left: '20%', width: '620px', height: '500px' };

    constructor() {
        this.panel = document.createElement('div');
        this.panel.className = 'mudpanel mudpanel-float';
        this.panel.hidden = true;
        this.panel.innerHTML = `
            <div class="mudpanel-titlebar">
                <span class="mudpanel-title">ABOUT</span>
                <span class="mudpanel-modes">
                    <button data-toggle="h"   title="Dock left / right">&#x25C0;&#x25B6;</button>
                    <button data-toggle="v"   title="Dock top / bottom">&#x25B2;&#x25BC;</button>
                    <button data-toggle="max" title="Float / Maximize">&#x26F6;</button>
                </span>
                <button class="mudpanel-close" title="Close">&#x2715;</button>
            </div>
            <div class="about-tabs">
                <button class="about-tab active" data-tab="about">About</button>
                <button class="about-tab" data-tab="scripting">Scripting API</button>
            </div>
            <div class="about-body">
                <div class="about-pane" data-pane="about">
                    <h2>${AppInfo.AppTitle}</h2>
                    <a href="${AppInfo.RepoUrl}" target="_blank">${AppInfo.RepoUrl}</a><br><br>
                    Version: ${AppInfo.Version}<br>
                    Build: ${AppInfo.Build}
                    <p>Mudslinger is a web-based MUD client. Open the page in your browser and it connects you to the MUD automatically. There is nothing to install.</p>
                    <h3>Features</h3>
                    <ul>
                        <li>ANSI color &amp; XTERM 256 colors</li>
                        <li>UTF-8</li>
                        <li>Triggers (basic and regex)</li>
                        <li>Aliases (basic and regex)</li>
                        <li>JavaScript scripting</li>
                    </ul>
                </div>
                <div class="about-pane" data-pane="scripting" hidden>
                    <h2>Scripting API</h2>
                    <p>All scripts have access to:</p>
                    <ul>
                        <li><strong>print(text)</strong> — Print text to the output window.</li>
                        <li><strong>send(text)</strong> — Send text to the game.</li>
                    </ul>
                    <p>All scripts share the same <code>this</code> object, allowing state to be shared between scripts or between calls of the same script.</p>
                    <h3>Alias Scripts</h3>
                    <p><strong>Non-regex:</strong> receives <code>input</code> — the full command typed.</p>
                    <p><strong>Regex:</strong> receives <code>input</code> and <code>match</code> — the regex match array.</p>
                    <h3>Trigger Scripts</h3>
                    <p><strong>Non-regex:</strong> receives <code>line</code> — the full matched line.</p>
                    <p><strong>Regex:</strong> receives <code>line</code> and <code>match</code> — the regex match array.</p>
                    <h3>Example: Kill 10 orcs then stop</h3>
                    <p>Trigger pattern: <code>An orc is DEAD!!</code></p>
                    <pre><code>this.deadOrcs = this.deadOrcs || 0;
this.deadOrcs++;
print("deadOrcs: " + this.deadOrcs);
if (this.deadOrcs &lt; 10) {
  send("kill orc");
} else {
  send("say Already killed 10 orcs.");
}</code></pre>
                </div>
            </div>
        `;
        document.body.appendChild(this.panel);

        this.titlebar = this.panel.querySelector('.mudpanel-titlebar') as HTMLElement;

        this.applyFloatStyle();
        this.initTabs();
        this.initModeButtons();
        this.initDrag();

        this.panel.addEventListener('mousedown', () => { this.bringToFront(); });
        this.panel.querySelector('.mudpanel-close')!
            .addEventListener('click', () => { this.panel.hidden = true; });
    }

    private bringToFront(): void {
        const max = Math.max(1000, ...Array.from(document.querySelectorAll<HTMLElement>('.mudpanel'))
            .map(p => parseInt(p.style.zIndex) || 0));
        this.panel.style.zIndex = String(max + 1);
    }

    private applyFloatStyle(): void {
        Object.assign(this.panel.style, this.floatStyle, { right: '', bottom: '' });
    }

    private clearPositionStyle(): void {
        Object.assign(this.panel.style, { top: '', left: '', right: '', bottom: '', width: '', height: '' });
    }

    private setMode(mode: PanelMode): void {
        if (this.mode === 'float') {
            this.floatStyle = {
                top:    this.panel.style.top    || '10%',
                left:   this.panel.style.left   || '20%',
                width:  this.panel.style.width  || '620px',
                height: this.panel.style.height || '500px',
            };
        }
        this.mode = mode;
        this.panel.className = `mudpanel mudpanel-${mode}`;
        this.titlebar.style.cursor = mode === 'float' ? 'move' : 'default';
        if (mode === 'float') { this.applyFloatStyle(); } else { this.clearPositionStyle(); }
        this.updateModeButtons();
    }

    private updateModeButtons(): void {
        this.panel.querySelector<HTMLElement>('[data-toggle="h"]')!
            .classList.toggle('active', this.mode === 'left' || this.mode === 'right');
        this.panel.querySelector<HTMLElement>('[data-toggle="v"]')!
            .classList.toggle('active', this.mode === 'top'  || this.mode === 'bottom');
        this.panel.querySelector<HTMLElement>('[data-toggle="max"]')!
            .classList.toggle('active', this.mode === 'maximize');
    }

    private initModeButtons(): void {
        this.panel.querySelector('[data-toggle="h"]')!.addEventListener('click', e => {
            e.stopPropagation();
            this.setMode(this.mode === 'left' ? 'right' : 'left');
        });
        this.panel.querySelector('[data-toggle="v"]')!.addEventListener('click', e => {
            e.stopPropagation();
            this.setMode(this.mode === 'top' ? 'bottom' : 'top');
        });
        this.panel.querySelector('[data-toggle="max"]')!.addEventListener('click', e => {
            e.stopPropagation();
            this.setMode(this.mode === 'maximize' ? 'float' : 'maximize');
        });
    }

    private initDrag(): void {
        initDrag(this.panel, this.titlebar, () => this.mode);
    }

    private initTabs(): void {
        this.panel.querySelectorAll('.about-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const t = (tab as HTMLElement).dataset.tab!;
                this.panel.querySelectorAll('.about-tab').forEach(b => b.classList.remove('active'));
                tab.classList.add('active');
                this.panel.querySelectorAll<HTMLElement>('.about-pane').forEach(p => {
                    p.hidden = p.dataset.pane !== t;
                });
            });
        });
    }

    public show(): void {
        this.panel.hidden = false;
        this.bringToFront();
    }
}
