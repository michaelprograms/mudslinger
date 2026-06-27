import * as Util from "./util";

declare let CodeMirror: any;

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
    private codeMirror: any;
    private codeMirrorWrapper: HTMLElement;
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
                    <button data-mode="float"    title="Float">&#x22A1;</button>
                    <button data-mode="top"      title="Dock top">&#x25B2;</button>
                    <button data-mode="bottom"   title="Dock bottom">&#x25BC;</button>
                    <button data-mode="left"     title="Dock left">&#x25C0;</button>
                    <button data-mode="right"    title="Dock right">&#x25B6;</button>
                    <button data-mode="maximize" title="Maximize">&#x26F6;</button>
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
                        <label>Pattern <input type="text" class="winEdit-pattern" disabled></label>
                        <label><input type="checkbox" class="winEdit-chkRegex" disabled> Regex</label>
                        <label><input type="checkbox" class="winEdit-chkScript" disabled> Script</label>
                        <button class="winEdit-btnSave" disabled>SAVE</button>
                        <button class="winEdit-btnCancel" disabled>CANCEL</button>
                    </div>
                    <div class="winEdit-value-label">Value:</div>
                    <div class="winEdit-value-area">
                        <textarea class="winEdit-textArea" disabled></textarea>
                        <textarea class="winEdit-scriptArea"></textarea>
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
        const scriptArea = this.panel.querySelector('.winEdit-scriptArea') as HTMLTextAreaElement;

        this.codeMirror = CodeMirror.fromTextArea(scriptArea, {
            mode: "javascript",
            theme: "neat",
            autoRefresh: true,
            matchBrackets: true,
            lineNumbers: true
        });
        this.codeMirrorWrapper = this.codeMirror.getWrapperElement();
        this.codeMirrorWrapper.style.display = 'none';

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

        this.panel.querySelectorAll<HTMLElement>('.mudpanel-modes button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
    }

    private initModeButtons(): void {
        this.panel.querySelectorAll<HTMLElement>('.mudpanel-modes button').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                this.setMode(btn.dataset.mode as PanelMode);
            });
        });
        (this.panel.querySelector('[data-mode="float"]') as HTMLElement).classList.add('active');
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

    private clearEditor(): void {
        this.pattern.value         = '';
        this.textArea.value        = '';
        this.codeMirror.setValue('');
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
            is_script ? this.codeMirror.getValue() : this.textArea.value,
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
        this.pattern.value  = this.defaultPattern || 'INPUT PATTERN HERE';
        this.textArea.value = this.defaultValue   || 'INPUT VALUE HERE';
        this.codeMirror.setValue(this.defaultScript || '// INPUT SCRIPT HERE');
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
        this.textArea.style.display        = 'none';
        this.codeMirrorWrapper.style.display = '';
        this.codeMirror.refresh();
    }

    private showTextInput(): void {
        this.codeMirrorWrapper.style.display = 'none';
        this.textArea.style.display          = '';
    }

    private handleListBoxChange(): void {
        const ind  = this.listBox.selectedIndex;
        const item = this.getItem(ind);
        if (!item) return;
        this.setEditorDisabled(false);
        this.pattern.value = item.pattern;
        if (item.is_script) {
            this.showScriptInput();
            this.codeMirror.setValue(item.value);
            this.textArea.value = '';
        } else {
            this.showTextInput();
            this.textArea.value = item.value;
            this.codeMirror.setValue('');
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
