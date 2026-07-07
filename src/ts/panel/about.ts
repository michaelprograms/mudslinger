import "./about.css";
import { AppInfo } from "../core/appInfo";
import { initDrag } from "./base";

type PanelMode = 'float' | 'top' | 'bottom' | 'left' | 'right' | 'maximize';

const EXAMPLE_SCRIPT = `this.deadOrcs = this.deadOrcs || 0;
this.deadOrcs++;
print("deadOrcs: " + this.deadOrcs);
if (this.deadOrcs < 10) {
  send("kill orc");
} else {
  send("say Already killed 10 orcs.");
}`;

export class AboutWin {
    private panel: HTMLElement;
    private titlebar: HTMLElement;
    private mode: PanelMode = 'float';
    private floatStyle = { top: '10%', left: '20%', width: '620px', height: '500px' };
    private codeExampleLoaded = false;

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
                    <h3>Shared state via <code>this</code></h3>
                    <p>Every alias, trigger, and standalone script runs against the <em>same</em> <code>this</code> object —
                    there is only one, shared across all of them for the whole session. Writing
                    <code>this.foo = ...</code> in one script makes <code>this.foo</code> visible to every other
                    alias/trigger/script, and to later runs of the same one. It's the closest thing this client has to a
                    global variable: use it for counters, flags, or anything that needs to persist or be shared
                    between separate triggers and aliases. It resets on page reload — nothing is saved to disk.</p>
                    <h3>Alias Scripts</h3>
                    <p><strong>Non-regex:</strong> receives <code>input</code> — the full command typed.</p>
                    <p><strong>Regex:</strong> receives <code>input</code> and <code>match</code> — the regex match array.</p>
                    <h3>Trigger Scripts</h3>
                    <p><strong>Non-regex:</strong> receives <code>line</code> — the full matched line.</p>
                    <p><strong>Regex:</strong> receives <code>line</code> and <code>match</code> — the regex match array.</p>
                    <h3>Standalone Scripts</h3>
                    <p>Scripts created under the "Scripts" list in the editor take no arguments and are not triggered
                    automatically — they only run when you press <strong>RUN</strong> in the editor. They still share the
                    same <code>this</code>, so they're useful for inspecting or resetting shared state (e.g. a script
                    named <code>reset</code> that sets <code>this.deadOrcs = 0</code>).</p>
                    <h3>Example: Kill 10 orcs then stop</h3>
                    <p>Trigger pattern: <code>An orc is DEAD!!</code></p>
                    <div class="about-code-example"></div>
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
                if (t === 'scripting') { this.loadCodeExample(); }
            });
        });
    }

    private async loadCodeExample(): Promise<void> {
        if (this.codeExampleLoaded) { return; }
        this.codeExampleLoaded = true;
        const [{ basicSetup }, { EditorView }, { EditorState }, { javascript }, { oneDark }] = await Promise.all([
            import("codemirror"),
            import("@codemirror/view"),
            import("@codemirror/state"),
            import("@codemirror/lang-javascript"),
            import("@codemirror/theme-one-dark"),
        ]);
        const container = this.panel.querySelector('.about-code-example') as HTMLElement;
        new EditorView({
            state: EditorState.create({
                doc: EXAMPLE_SCRIPT,
                extensions: [basicSetup, javascript(), oneDark, EditorState.readOnly.of(true)]
            }),
            parent: container
        });
    }

    public show(): void {
        this.panel.hidden = false;
        this.bringToFront();
    }
}
