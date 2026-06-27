import { JsScript } from "./jsScript";
import { UserConfig } from "./userConfig";

declare let CodeMirror: any;

type PanelMode = 'float' | 'top' | 'bottom' | 'left' | 'right' | 'maximize';

interface ScriptItem { name: string; code: string; }

export class JsScriptWin {
    private panel: HTMLElement;
    private titlebar: HTMLElement;
    private listBox: HTMLSelectElement;
    private nameInput: HTMLInputElement;
    private runButton: HTMLButtonElement;
    private saveButton: HTMLButtonElement;
    private cancelButton: HTMLButtonElement;
    private codeMirror: any;

    private mode: PanelMode = 'float';
    private floatStyle = { top: '10%', left: '15%', width: '700px', height: '500px' };
    private scripts: ScriptItem[];

    constructor(private jsScript: JsScript) {
        this.scripts = UserConfig.getDef('scripts', []);

        this.panel = document.createElement('div');
        this.panel.className = 'mudpanel mudpanel-float';
        this.panel.hidden = true;
        this.panel.innerHTML = `
            <div class="mudpanel-titlebar">
                <span class="mudpanel-title">SCRIPTS</span>
                <span class="mudpanel-modes">
                    <button data-toggle="h"   title="Dock left / right">&#x25C0;&#x25B6;</button>
                    <button data-toggle="v"   title="Dock top / bottom">&#x25B2;&#x25BC;</button>
                    <button data-toggle="max" title="Float / Maximize">&#x26F6;</button>
                </span>
                <button class="mudpanel-close" title="Close">&#x2715;</button>
            </div>
            <div class="mudpanel-body">
                <div class="winEdit-list-pane">
                    <div class="winEdit-list-buttons">
                        <button class="winScript-btnNew">NEW</button>
                        <button class="winScript-btnDelete">DELETE</button>
                    </div>
                    <select class="winEdit-listBox" size="10"></select>
                </div>
                <div class="winEdit-edit-pane">
                    <div class="winEdit-meta">
                        <label>Name <input type="text" class="winScript-name" disabled></label>
                        <button class="winScript-btnRun" disabled>RUN</button>
                        <button class="winScript-btnSave" disabled>SAVE</button>
                        <button class="winScript-btnCancel" disabled>CANCEL</button>
                    </div>
                    <div class="winEdit-value-area">
                        <textarea class="winScript-code"></textarea>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(this.panel);

        this.titlebar     = this.panel.querySelector('.mudpanel-titlebar') as HTMLElement;
        this.listBox      = this.panel.querySelector('.winEdit-listBox') as HTMLSelectElement;
        this.nameInput    = this.panel.querySelector('.winScript-name') as HTMLInputElement;
        this.runButton    = this.panel.querySelector('.winScript-btnRun') as HTMLButtonElement;
        this.saveButton   = this.panel.querySelector('.winScript-btnSave') as HTMLButtonElement;
        this.cancelButton = this.panel.querySelector('.winScript-btnCancel') as HTMLButtonElement;

        this.codeMirror = CodeMirror.fromTextArea(
            this.panel.querySelector('.winScript-code') as HTMLTextAreaElement, {
                mode: 'javascript',
                theme: 'neat',
                autoRefresh: true,
                matchBrackets: true,
                lineNumbers: true
            }
        );

        this.applyFloatStyle();
        this.initModeButtons();
        this.initDrag();

        this.panel.addEventListener('mousedown', () => { this.bringToFront(); });
        this.panel.querySelector('.mudpanel-close')!
            .addEventListener('click', () => { this.panel.hidden = true; });
        this.listBox.addEventListener('change',       () => { this.handleSelect(); });
        this.panel.querySelector('.winScript-btnNew')!
            .addEventListener('click',                () => { this.handleNew(); });
        this.panel.querySelector('.winScript-btnDelete')!
            .addEventListener('click',                () => { this.handleDelete(); });
        this.saveButton.addEventListener('click',     () => { this.handleSave(); });
        this.cancelButton.addEventListener('click',   () => { this.handleCancel(); });
        this.runButton.addEventListener('click',      () => { this.handleRun(); });
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
                left:   this.panel.style.left   || '15%',
                width:  this.panel.style.width  || '700px',
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
        let dragging = false, ox = 0, oy = 0;
        this.titlebar.addEventListener('mousedown', e => {
            if (this.mode !== 'float') return;
            if ((e.target as HTMLElement).closest('button')) return;
            dragging = true;
            ox = e.clientX - this.panel.offsetLeft;
            oy = e.clientY - this.panel.offsetTop;
            e.preventDefault();
        });
        document.addEventListener('mousemove', e => {
            if (!dragging) return;
            this.panel.style.left = (e.clientX - ox) + 'px';
            this.panel.style.top  = (e.clientY - oy) + 'px';
        });
        document.addEventListener('mouseup', () => { dragging = false; });
    }

    private setEditorDisabled(state: boolean): void {
        this.nameInput.disabled    = state;
        this.runButton.disabled    = state;
        this.saveButton.disabled   = state;
        this.cancelButton.disabled = state;
        this.codeMirror.setOption('readOnly', state ? 'nocursor' : false);
    }

    private updateListBox(): void {
        this.listBox.innerHTML = this.scripts.map(s => `<option>${s.name}</option>`).join('');
    }

    private persist(): void {
        UserConfig.set('scripts', this.scripts);
    }

    private handleSelect(): void {
        const item = this.scripts[this.listBox.selectedIndex];
        if (!item) return;
        this.nameInput.value = item.name;
        this.codeMirror.setValue(item.code);
        this.setEditorDisabled(false);
    }

    private handleNew(): void {
        this.listBox.selectedIndex = -1;
        this.nameInput.value = 'New Script';
        this.codeMirror.setValue('// write script here');
        this.setEditorDisabled(false);
    }

    private handleDelete(): void {
        const ind = this.listBox.selectedIndex;
        if (ind < 0) return;
        this.scripts.splice(ind, 1);
        this.persist();
        this.updateListBox();
        this.listBox.selectedIndex = -1;
        this.nameInput.value = '';
        this.codeMirror.setValue('');
        this.setEditorDisabled(true);
    }

    private handleSave(): void {
        const ind  = this.listBox.selectedIndex;
        const item = { name: this.nameInput.value, code: this.codeMirror.getValue() };
        if (ind < 0) {
            this.scripts.push(item);
            this.updateListBox();
            this.listBox.selectedIndex = this.scripts.length - 1;
        } else {
            this.scripts[ind] = item;
            this.updateListBox();
            this.listBox.selectedIndex = ind;
        }
        this.persist();
    }

    private handleCancel(): void {
        const ind = this.listBox.selectedIndex;
        if (ind >= 0) {
            this.handleSelect();
        } else {
            this.nameInput.value = '';
            this.codeMirror.setValue('');
            this.setEditorDisabled(true);
        }
    }

    private handleRun(): void {
        const script = this.jsScript.makeScript(this.codeMirror.getValue(), '');
        if (script) { script(); }
    }

    public show(): void {
        this.updateListBox();
        this.panel.hidden = false;
        this.bringToFront();
    }
}
