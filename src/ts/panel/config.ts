import "./base.css";
import "./config.css";
import { EventHook } from "../core/event";
import { UserConfig } from "../core/userConfig";
import { initDrag } from "./base";

const DEFAULT_FONT_SIZE = 14;

type PanelMode = 'float' | 'top' | 'bottom' | 'left' | 'right' | 'maximize';

export class ConfigWin {
    public EvtChangeFontSize = new EventHook<number>();

    private panel: HTMLElement;
    private titlebar: HTMLElement;
    private mode: PanelMode = 'float';
    private floatStyle = { top: '10%', left: '20%', width: '300px', height: '200px' };

    constructor() {
        this.panel = document.createElement('div');
        this.panel.className = 'mudpanel mudpanel-float';
        this.panel.hidden = true;
        this.panel.innerHTML = `
            <div class="mudpanel-titlebar">
                <span class="mudpanel-title">CONFIG</span>
                <span class="mudpanel-modes">
                    <button data-toggle="h"   title="Dock left / right">&#x25C0;&#x25B6;</button>
                    <button data-toggle="v"   title="Dock top / bottom">&#x25B2;&#x25BC;</button>
                    <button data-toggle="max" title="Float / Maximize">&#x26F6;</button>
                </span>
                <button class="mudpanel-close" title="Close">&#x2715;</button>
            </div>
            <div class="config-body">
                <label>Font Size (px)
                    <input type="number" class="config-font-size" min="8" max="48" step="1">
                </label>
                <label><input type="checkbox" class="config-chk-utf8"> Enable UTF-8</label>
                <label><input type="checkbox" class="config-chk-trig"> Enable Triggers</label>
                <label><input type="checkbox" class="config-chk-alias"> Enable Aliases</label>
                <label><input type="checkbox" class="config-chk-echo"> Local echo</label>
                <label><input type="checkbox" class="config-chk-movepad"> Show movement pad</label>
            </div>
        `;
        document.body.appendChild(this.panel);

        this.titlebar = this.panel.querySelector('.mudpanel-titlebar') as HTMLElement;

        const sizeInput = this.panel.querySelector<HTMLInputElement>('.config-font-size')!;
        const chkUtf8   = this.panel.querySelector<HTMLInputElement>('.config-chk-utf8')!;
        const chkTrig   = this.panel.querySelector<HTMLInputElement>('.config-chk-trig')!;
        const chkAlias  = this.panel.querySelector<HTMLInputElement>('.config-chk-alias')!;
        const chkEcho   = this.panel.querySelector<HTMLInputElement>('.config-chk-echo')!;
        const chkMovePad = this.panel.querySelector<HTMLInputElement>('.config-chk-movepad')!;

        sizeInput.value  = String(UserConfig.getDef('fontSize', DEFAULT_FONT_SIZE));
        chkUtf8.checked  = UserConfig.getDef('utf8Enabled',     true);
        chkTrig.checked  = UserConfig.getDef('triggersEnabled', true);
        chkAlias.checked = UserConfig.getDef('aliasesEnabled',  true);
        chkEcho.checked  = UserConfig.getDef('localEcho',       true);
        chkMovePad.checked = UserConfig.getDef('movementPad', false);

        sizeInput.addEventListener('change', () => {
            const px = Math.max(8, Math.min(48, Number(sizeInput.value)));
            sizeInput.value = String(px);
            UserConfig.set('fontSize', px);
            this.EvtChangeFontSize.fire(px);
        });
        chkUtf8.addEventListener( 'change', () => UserConfig.set('utf8Enabled',     chkUtf8.checked));
        chkTrig.addEventListener( 'change', () => UserConfig.set('triggersEnabled', chkTrig.checked));
        chkAlias.addEventListener('change', () => UserConfig.set('aliasesEnabled',  chkAlias.checked));
        chkEcho.addEventListener( 'change', () => UserConfig.set('localEcho',       chkEcho.checked));
        chkMovePad.addEventListener('change', () => UserConfig.set('movementPad', chkMovePad.checked));

        this.applyFloatStyle();
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
                width:  this.panel.style.width  || '300px',
                height: this.panel.style.height || '200px',
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

    public show(): void {
        this.panel.hidden = false;
        this.bringToFront();
    }
}
