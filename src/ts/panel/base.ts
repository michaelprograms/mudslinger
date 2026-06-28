import "./base.css";
import * as Util from "../core/util";
import { basicSetup } from "codemirror";
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";

export interface EditorItem {
    pattern: string;
    value: string;
    regex: boolean;
    is_script: boolean;
}

type PanelMode = 'float' | 'top' | 'bottom' | 'left' | 'right' | 'maximize';

let zTop = 1000;

export abstract class PanelEditorBase {
    private panel: HTMLElement;
    private titlebar: HTMLElement;
    private listBox: HTMLSelectElement;
    private pattern: HTMLInputElement;
    private regexCheckbox: HTMLInputElement;
    private scriptCheckbox: HTMLInputElement;
    private textArea: HTMLTextAreaElement;
    private scriptArea!: HTMLElement;
    private codeMirror!: EditorView;
    private newButton: HTMLButtonElement;
    private deleteButton: HTMLButtonElement;
    private saveButton: HTMLButtonElement;
    private cancelButton: HTMLButtonElement;

    private mode: PanelMode = 'float';
    private floatStyle = { top: '10%', left: '20%', width: '640px', height: '420px' };

    protected abstract getList(): Array<string>;
    protected abstract getItem(ind: number): EditorItem | null;
    protected abstract saveItem(ind: number, pattern: string, value: string, checked: boolean, is_script: boolean): void;
    protected abstract deleteItem(ind: number): void;

    protected abstract defaultPattern: string | null;
    protected abstract defaultValue: string;
    protected abstract defaultScript: string;

    constructor(title: string) {
        this.panel = document.createElement('div');
        this.panel.className = 'mudpanel mudpanel-float';
        this.panel.hidden = true;
        this.panel.innerHTML = `
            <div class="mudpanel-titlebar">
                <span class="mudpanel-title">${title}</span>
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
                        <button class="winEdit-btnNew">NEW</button>
                        <button class="winEdit-btnDelete">DELETE</button>
                    </div>
                    <select class="winEdit-listBox" size="10"></select>
                </div>
                <div class="winEdit-edit-pane">
                    <div class="winEdit-meta">
                        <label>Pattern <input type="text" class="winEdit-pattern" placeholder="^pattern$" disabled></label>
                        <label><input type="checkbox" class="winEdit-chkRegex" disabled> Regex</label>
                        <label><input type="checkbox" class="winEdit-chkScript" disabled> Script</label>
                        <button class="winEdit-btnSave" disabled>SAVE</button>
                        <button class="winEdit-btnCancel" disabled>CANCEL</button>
                    </div>
                    <div class="winEdit-value-label">Value:</div>
                    <div class="winEdit-value-area">
                        <textarea class="winEdit-textArea" disabled></textarea>
                        <div class="winEdit-scriptArea"></div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(this.panel);

        this.titlebar       = this.panel.querySelector('.mudpanel-titlebar') as HTMLElement;
        this.listBox        = this.panel.querySelector('.winEdit-listBox') as HTMLSelectElement;
        this.pattern        = this.panel.querySelector('.winEdit-pattern') as HTMLInputElement;
        this.regexCheckbox  = this.panel.querySelector('.winEdit-chkRegex') as HTMLInputElement;
        this.scriptCheckbox = this.panel.querySelector('.winEdit-chkScript') as HTMLInputElement;
        this.newButton      = this.panel.querySelector('.winEdit-btnNew') as HTMLButtonElement;
        this.deleteButton   = this.panel.querySelector('.winEdit-btnDelete') as HTMLButtonElement;
        this.saveButton     = this.panel.querySelector('.winEdit-btnSave') as HTMLButtonElement;
        this.cancelButton   = this.panel.querySelector('.winEdit-btnCancel') as HTMLButtonElement;
        this.textArea = this.panel.querySelector('.winEdit-textArea') as HTMLTextAreaElement;

        this.scriptArea = this.panel.querySelector('.winEdit-scriptArea') as HTMLElement;
        this.codeMirror = new EditorView({
            state: EditorState.create({
                doc: '',
                extensions: [basicSetup, javascript(), oneDark]
            }),
            parent: this.scriptArea
        });
        this.scriptArea.style.display = 'none';

        this.applyFloatStyle();
        this.initModeButtons();
        this.initDrag();

        this.panel.addEventListener('mousedown', () => {
            this.panel.style.zIndex = String(++zTop);
        });
        this.panel.querySelector('.mudpanel-close')!
            .addEventListener('click', () => { this.panel.hidden = true; });
        this.listBox.addEventListener('change', this.handleListBoxChange.bind(this));
        this.newButton.addEventListener('click', this.handleNewButtonClick.bind(this));
        this.deleteButton.addEventListener('click', this.handleDeleteButtonClick.bind(this));
        this.saveButton.addEventListener('click', this.handleSaveButtonClick.bind(this));
        this.cancelButton.addEventListener('click', this.handleCancelButtonClick.bind(this));
        this.scriptCheckbox.addEventListener('change', this.handleScriptCheckboxChange.bind(this));
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
                width:  this.panel.style.width  || '640px',
                height: this.panel.style.height || '420px',
            };
        }
        this.mode = mode;
        this.panel.className = `mudpanel mudpanel-${mode}`;
        this.titlebar.style.cursor = mode === 'float' ? 'move' : 'default';

        if (mode === 'float') {
            this.applyFloatStyle();
        } else {
            this.clearPositionStyle();
        }

        this.updateModeButtons();
    }

    private updateModeButtons(): void {
        const hBtn   = this.panel.querySelector<HTMLElement>('[data-toggle="h"]')!;
        const vBtn   = this.panel.querySelector<HTMLElement>('[data-toggle="v"]')!;
        const maxBtn = this.panel.querySelector<HTMLElement>('[data-toggle="max"]')!;
        hBtn.classList.toggle('active',   this.mode === 'left'     || this.mode === 'right');
        vBtn.classList.toggle('active',   this.mode === 'top'      || this.mode === 'bottom');
        maxBtn.classList.toggle('active', this.mode === 'maximize');
    }

    private initModeButtons(): void {
        const hBtn   = this.panel.querySelector<HTMLElement>('[data-toggle="h"]')!;
        const vBtn   = this.panel.querySelector<HTMLElement>('[data-toggle="v"]')!;
        const maxBtn = this.panel.querySelector<HTMLElement>('[data-toggle="max"]')!;

        hBtn.addEventListener('click', e => {
            e.stopPropagation();
            this.setMode(this.mode === 'left' ? 'right' : 'left');
        });
        vBtn.addEventListener('click', e => {
            e.stopPropagation();
            this.setMode(this.mode === 'top' ? 'bottom' : 'top');
        });
        maxBtn.addEventListener('click', e => {
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
        this.pattern.disabled        = state;
        this.regexCheckbox.disabled  = state;
        this.scriptCheckbox.disabled = state;
        this.textArea.disabled       = state;
        this.saveButton.disabled     = state;
        this.cancelButton.disabled   = state;
    }

    private selectNone(): void { this.listBox.selectedIndex = -1; }

    private cmSet(text: string): void {
        this.codeMirror.dispatch({
            changes: { from: 0, to: this.codeMirror.state.doc.length, insert: text }
        });
    }

    private clearEditor(): void {
        this.pattern.value         = '';
        this.textArea.value        = '';
        this.cmSet('');
        this.regexCheckbox.checked  = false;
        this.scriptCheckbox.checked = false;
    }

    private updateListBox(): void {
        this.listBox.innerHTML = this.getList()
            .map(s => `<option>${Util.rawToHtml(s)}</option>`)
            .join('');
    }

    private handleSaveButtonClick(): void {
        const ind       = this.listBox.selectedIndex;
        const is_script = this.scriptCheckbox.checked;
        this.saveItem(
            ind,
            this.pattern.value,
            is_script ? this.codeMirror.state.doc.toString() : this.textArea.value,
            this.regexCheckbox.checked,
            is_script
        );
        this.selectNone();
        this.clearEditor();
        this.setEditorDisabled(true);
        this.updateListBox();
    }

    private handleCancelButtonClick(): void {
        this.clearEditor();
        this.selectNone();
        this.setEditorDisabled(true);
    }

    private handleNewButtonClick(): void {
        this.setEditorDisabled(false);
        this.selectNone();
        this.pattern.value  = this.defaultPattern || '';
        this.textArea.value = this.defaultValue   || 'INPUT VALUE HERE';
        this.cmSet(this.defaultScript || '// INPUT SCRIPT HERE');
    }

    private handleDeleteButtonClick(): void {
        const ind = this.listBox.selectedIndex;
        this.deleteItem(ind);
        this.clearEditor();
        this.selectNone();
        this.setEditorDisabled(true);
        this.updateListBox();
    }

    private showScriptInput(): void {
        this.textArea.style.display     = 'none';
        this.scriptArea.style.display   = '';
        this.codeMirror.requestMeasure();
    }

    private showTextInput(): void {
        this.scriptArea.style.display  = 'none';
        this.textArea.style.display    = '';
    }

    private handleListBoxChange(): void {
        const ind  = this.listBox.selectedIndex;
        const item = this.getItem(ind);
        if (!item) return;
        this.setEditorDisabled(false);
        this.pattern.value = item.pattern;
        if (item.is_script) {
            this.showScriptInput();
            this.cmSet(item.value);
            this.textArea.value = '';
        } else {
            this.showTextInput();
            this.textArea.value = item.value;
            this.cmSet('');
        }
        this.regexCheckbox.checked  = !!item.regex;
        this.scriptCheckbox.checked = !!item.is_script;
    }

    private handleScriptCheckboxChange(): void {
        if (this.scriptCheckbox.checked) {
            this.showScriptInput();
        } else {
            this.showTextInput();
        }
    }

    public show(): void {
        this.updateListBox();
        this.panel.hidden = false;
        this.panel.style.zIndex = String(++zTop);
    }
}
