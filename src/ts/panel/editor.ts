import "./base.css";
import { UserConfig } from "../core/userConfig";
import { AliasManager, scriptsToAliases } from "../manager/alias";
import { TriggerManager } from "../manager/trigger";
import { JsScript } from "../core/script";
import { EditorItem, initDrag } from "./base";
import { basicSetup } from "codemirror";
import { EditorView } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";

type EditorType = 'alias' | 'trigger';
type PanelMode = 'float' | 'top' | 'bottom' | 'left' | 'right' | 'maximize';

let zTop = 1000;

export class EditorWin {
    private panel: HTMLElement;
    private titlebar: HTMLElement;
    private titleSpan: HTMLElement;
    private folderListEl: HTMLElement;
    private folderInput: HTMLInputElement;
    private folderDatalist: HTMLDataListElement;
    // null = All, '' = Ungrouped, else a folder name
    private activeFolder: string | null = null;
    private typeButtons: NodeListOf<HTMLButtonElement>;
    private listBox: HTMLSelectElement;
    private patternInput: HTMLInputElement;
    private regexCheckbox: HTMLInputElement;
    private scriptCheckbox: HTMLInputElement;
    private textArea: HTMLTextAreaElement;
    private scriptArea: HTMLElement;
    private codeMirror: EditorView;
    private readOnlyComp = new Compartment();
    private saveButton: HTMLButtonElement;
    private cancelButton: HTMLButtonElement;
    private runButton: HTMLButtonElement;

    private type: EditorType = 'alias';
    private mode: PanelMode = 'float';
    private floatStyle = { top: '10%', left: '15%', width: '700px', height: '500px' };
    private filteredIndices: number[] = [];

    constructor(
        private aliasManager: AliasManager,
        private triggerManager: TriggerManager,
        private jsScript: JsScript
    ) {
        this.panel = document.createElement('div');
        this.panel.className = 'mudpanel mudpanel-float';
        this.panel.hidden = true;
        this.panel.innerHTML = `
            <div class="mudpanel-titlebar">
                <span class="mudpanel-title">ALIASES</span>
                <span class="mudpanel-modes">
                    <button data-toggle="h" title="Dock left / right">&#x25C0;&#x25B6;</button>
                    <button data-toggle="v" title="Dock top / bottom">&#x25B2;&#x25BC;</button>
                    <button data-toggle="max" title="Float / Maximize">&#x26F6;</button>
                </span>
                <button class="mudpanel-close" title="Close">&#x2715;</button>
            </div>
            <div class="mudpanel-body">
                <div class="winEdit-list-pane">
                    <div class="winEdit-type-toggle">
                        <button class="winEdit-typeBtn active" data-type="alias">Alias</button>
                        <button class="winEdit-typeBtn" data-type="trigger">Trigger</button>
                    </div>
                    <div class="winEdit-folders"></div>
                    <div class="winEdit-list-buttons">
                        <button class="winEdit-btnNew mudpanel-btn" title="New">+</button>
                        <button class="winEdit-btnDelete mudpanel-btn mudpanel-btn-danger" title="Delete selected">&#x2715;</button>
                        <button class="winEdit-btnExport mudpanel-btn" title="Export aliases &amp; triggers to a JSON file">&#x2193;</button>
                        <button class="winEdit-btnImport mudpanel-btn" title="Import aliases &amp; triggers from a JSON file">&#x2191;</button>
                        <input type="file" class="winEdit-importFile" accept=".json,application/json" hidden>
                    </div>
                    <select class="winEdit-listBox" size="10"></select>
                </div>
                <div class="winEdit-edit-pane">
                    <div class="winEdit-meta">
                        <div class="winEdit-metaRow">
                            <label class="winEdit-field winEdit-field-grow">
                                <span class="winEdit-fieldLabel">Pattern</span>
                                <input type="text" class="winEdit-pattern" placeholder="^pattern$" disabled>
                            </label>
                            <label class="winEdit-check"><input type="checkbox" class="winEdit-chkRegex" disabled> Regex</label>
                            <label class="winEdit-check"><input type="checkbox" class="winEdit-chkScript" disabled> Script</label>
                            <button class="winEdit-btnRun mudpanel-btn" style="display:none" title="Run this script" disabled>RUN</button>
                        </div>
                        <div class="winEdit-metaRow">
                            <label class="winEdit-field">
                                <span class="winEdit-fieldLabel">Folder</span>
                                <input type="text" class="winEdit-folder" list="winEdit-folderlist" placeholder="(none)" disabled>
                            </label>
                            <datalist id="winEdit-folderlist"></datalist>
                            <span class="winEdit-spacer"></span>
                            <button class="winEdit-btnSave mudpanel-btn" disabled>SAVE</button>
                            <button class="winEdit-btnCancel mudpanel-btn" disabled>CANCEL</button>
                        </div>
                    </div>
                    <div class="winEdit-value-label">Value:</div>
                    <div class="winEdit-value-area">
                        <textarea class="winEdit-textArea" disabled></textarea>
                        <div class="winEdit-scriptArea" style="display:none"></div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(this.panel);

        this.titlebar         = this.panel.querySelector('.mudpanel-titlebar')!;
        this.titleSpan        = this.panel.querySelector('.mudpanel-title')!;
        this.folderListEl     = this.panel.querySelector('.winEdit-folders')!;
        this.typeButtons      = this.panel.querySelectorAll('.winEdit-typeBtn');
        this.listBox          = this.panel.querySelector('.winEdit-listBox')!;
        this.patternInput     = this.panel.querySelector('.winEdit-pattern')!;
        this.regexCheckbox    = this.panel.querySelector('.winEdit-chkRegex')!;
        this.scriptCheckbox   = this.panel.querySelector('.winEdit-chkScript')!;
        this.folderInput      = this.panel.querySelector('.winEdit-folder')!;
        this.folderDatalist   = this.panel.querySelector('#winEdit-folderlist')!;
        this.textArea         = this.panel.querySelector('.winEdit-textArea')!;
        this.saveButton       = this.panel.querySelector('.winEdit-btnSave')!;
        this.cancelButton     = this.panel.querySelector('.winEdit-btnCancel')!;
        this.runButton        = this.panel.querySelector('.winEdit-btnRun')!;
        this.scriptArea       = this.panel.querySelector('.winEdit-scriptArea')!;

        this.codeMirror = new EditorView({
            state: EditorState.create({
                doc: '',
                extensions: [basicSetup, javascript(), oneDark, this.readOnlyComp.of(EditorState.readOnly.of(false))]
            }),
            parent: this.scriptArea
        });

        this.applyFloatStyle();
        this.initModeButtons();
        this.initDrag();

        this.panel.addEventListener('mousedown', () => { this.panel.style.zIndex = String(++zTop); });
        this.panel.querySelector('.mudpanel-close')!.addEventListener('click', () => { this.panel.hidden = true; });
        this.typeButtons.forEach(btn => {
            btn.addEventListener('click', () => { this.handleTypeChange(btn.dataset.type as EditorType); });
        });
        this.listBox.addEventListener('change', () => { this.handleListBoxChange(); });
        this.panel.querySelector('.winEdit-btnNew')!.addEventListener('click', () => { this.handleNew(); });
        this.panel.querySelector('.winEdit-btnDelete')!.addEventListener('click', () => { this.handleDelete(); });
        const importFile = this.panel.querySelector<HTMLInputElement>('.winEdit-importFile')!;
        this.panel.querySelector('.winEdit-btnExport')!.addEventListener('click', () => { this.handleExport(); });
        this.panel.querySelector('.winEdit-btnImport')!.addEventListener('click', () => { importFile.click(); });
        importFile.addEventListener('change', () => {
            const f = importFile.files?.[0];
            if (f) this.handleImport(f);
            importFile.value = '';
        });
        this.saveButton.addEventListener('click', () => { this.handleSave(); });
        this.cancelButton.addEventListener('click', () => { this.handleCancel(); });
        this.runButton.addEventListener('click', () => { this.handleRun(); });
        this.scriptCheckbox.addEventListener('change', () => {
            if (this.scriptCheckbox.checked) { this.showScriptInput(); } else { this.showTextInput(); }
            this.updateRunButton();
        });
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
        initDrag(this.panel, this.titlebar, () => this.mode);
    }

    private setEditorDisabled(state: boolean): void {
        this.patternInput.disabled   = state;
        this.regexCheckbox.disabled  = state;
        this.scriptCheckbox.disabled = state;
        this.folderInput.disabled    = state;
        this.textArea.disabled       = state;
        this.saveButton.disabled     = state;
        this.cancelButton.disabled   = state;
        this.runButton.disabled      = state;
        this.codeMirror.dispatch({
            effects: this.readOnlyComp.reconfigure(EditorState.readOnly.of(state))
        });
    }

    private handleTypeChange(type: EditorType): void {
        this.type = type;
        this.typeButtons.forEach(btn => { btn.classList.toggle('active', btn.dataset.type === type); });
        this.titleSpan.textContent = type === 'alias' ? 'ALIASES' : 'TRIGGERS';
        this.clearEditor();
        this.setEditorDisabled(true);
        this.updateListBox();
    }

    private currentItems(): EditorItem[] {
        return this.type === 'alias' ? this.aliasManager.aliases : this.triggerManager.triggers;
    }

    private updateListBox(): void {
        const items = this.currentItems();
        this.filteredIndices = [];

        // Which items pass the active folder filter (null = All, '' = Ungrouped).
        const visible: number[] = [];
        for (let i = 0; i < items.length; i++) {
            const folder = (items[i] as any).folder || '';
            if (this.activeFolder === null) visible.push(i);
            else if (folder === this.activeFolder) visible.push(i);
        }

        const label = (i: number): string => items[i].pattern;

        // Group visible items under an <optgroup> per folder (native grouping).
        const groups = new Map<string, number[]>();
        for (const i of visible) {
            const key = (items[i] as any).folder || '';
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(i);
        }
        const keys = [...groups.keys()].sort((a, b) => {
            if (a === '') return 1;   // ungrouped last
            if (b === '') return -1;
            return a.localeCompare(b);
        });

        const nodes: HTMLElement[] = [];
        for (const key of keys) {
            const group = document.createElement('optgroup');
            group.label = key || 'Ungrouped';
            for (const i of groups.get(key)!) {
                const opt = document.createElement('option');
                opt.textContent = label(i);
                opt.value = String(this.filteredIndices.length); // slot into filteredIndices
                group.appendChild(opt);
                this.filteredIndices.push(i);
            }
            nodes.push(group);
        }
        this.listBox.replaceChildren(...nodes);
        this.renderFolderList();
        this.updateFolderDatalist();
    }

    /** Distinct non-empty folder names on the current type's items, sorted. */
    private folderNames(): string[] {
        const set = new Set<string>();
        for (const it of this.currentItems()) {
            const f = (it as any).folder;
            if (f) set.add(f);
        }
        return [...set].sort();
    }

    private hasUngrouped(): boolean {
        return this.currentItems().some(it => !(it as any).folder);
    }

    private renderFolderList(): void {
        const disabled: string[] = UserConfig.getDef('disabledFolders', []);
        const rows: HTMLElement[] = [];

        const makeRow = (label: string, value: string | null, checkbox: boolean): HTMLElement => {
            const row = document.createElement('div');
            row.className = 'winEdit-folderRow';
            if (value === this.activeFolder) row.classList.add('active');
            if (checkbox) {
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.checked = !disabled.includes(value as string);
                cb.addEventListener('click', e => { e.stopPropagation(); this.toggleFolder(value as string, cb.checked); });
                row.appendChild(cb);
            } else {
                const spacer = document.createElement('span');
                spacer.className = 'winEdit-folderSpacer';
                row.appendChild(spacer);
            }
            const name = document.createElement('span');
            name.className = 'winEdit-folderName';
            name.textContent = label;
            row.appendChild(name);
            row.addEventListener('click', () => this.setFolderFilter(value));
            return row;
        };

        rows.push(makeRow('— All —', null, false));
        if (this.hasUngrouped()) rows.push(makeRow('Ungrouped', '', false));
        for (const f of this.folderNames()) rows.push(makeRow(f, f, true));

        this.folderListEl.replaceChildren(...rows);
    }

    private setFolderFilter(folder: string | null): void {
        this.activeFolder = folder;
        this.clearEditor();
        this.setEditorDisabled(true);
        this.updateListBox();
    }

    private toggleFolder(folder: string, enabled: boolean): void {
        const disabled: string[] = UserConfig.getDef('disabledFolders', []);
        const next = enabled ? disabled.filter(f => f !== folder) : [...new Set([...disabled, folder])];
        UserConfig.set('disabledFolders', next);
    }

    /** Rebuild the folder datalist for the edit-pane folder input. */
    private updateFolderDatalist(): void {
        this.folderDatalist.replaceChildren(
            ...this.folderNames().map(f => Object.assign(document.createElement('option'), { value: f }))
        );
    }

    private cmSet(text: string): void {
        this.codeMirror.dispatch({
            changes: { from: 0, to: this.codeMirror.state.doc.length, insert: text }
        });
    }

    private showScriptInput(): void {
        this.textArea.style.display   = 'none';
        this.scriptArea.style.display = '';
        this.codeMirror.requestMeasure();
    }

    private showTextInput(): void {
        this.scriptArea.style.display = 'none';
        this.textArea.style.display   = '';
    }

    /** RUN is only meaningful for a script-backed alias (triggers fire on output). */
    private updateRunButton(): void {
        this.runButton.style.display = (this.type === 'alias' && this.scriptCheckbox.checked) ? '' : 'none';
    }

    private clearEditor(): void {
        this.patternInput.value     = '';
        this.textArea.value         = '';
        this.cmSet('');
        this.regexCheckbox.checked  = false;
        this.scriptCheckbox.checked = false;
        this.folderInput.value      = '';
        this.listBox.selectedIndex  = -1;
        this.showTextInput();
        this.updateRunButton();
    }

    private selectedRealIndex(): number {
        const opt = this.listBox.selectedOptions[0];
        return opt ? this.filteredIndices[parseInt(opt.value)] : -1;
    }

    private handleListBoxChange(): void {
        const realInd = this.selectedRealIndex();
        if (realInd < 0) return;
        const e = this.currentItems()[realInd];
        if (!e) return;
        this.setEditorDisabled(false);

        this.patternInput.value     = e.pattern;
        this.regexCheckbox.checked  = !!e.regex;
        this.scriptCheckbox.checked = !!e.is_script;
        this.folderInput.value      = e.folder || '';
        if (e.is_script) {
            this.showScriptInput();
            this.cmSet(e.value);
            this.textArea.value = '';
        } else {
            this.showTextInput();
            this.textArea.value = e.value;
            this.cmSet('');
        }
        this.updateRunButton();
    }

    private handleNew(): void {
        this.clearEditor();
        this.setEditorDisabled(false);
        // pre-fill folder to the active folder filter, if one is selected
        if (this.activeFolder) this.folderInput.value = this.activeFolder;
        this.textArea.value = this.type === 'alias' ? 'alias value here' : 'trigger value here';
    }

    private handleDelete(): void {
        const realInd = this.selectedRealIndex();
        if (realInd < 0) return;
        if (this.type === 'alias') {
            this.aliasManager.aliases.splice(realInd, 1);
            this.aliasManager.saveAliases();
        } else {
            this.triggerManager.triggers.splice(realInd, 1);
            this.triggerManager.saveTriggers();
        }
        this.clearEditor();
        this.setEditorDisabled(true);
        this.updateListBox();
    }

    private handleExport(): void {
        const data = {
            aliases:  this.aliasManager.aliases,
            triggers: this.triggerManager.triggers,
        };
        const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
        const a = Object.assign(document.createElement('a'), { href: url, download: 'mudslinger-config.json' });
        a.click();
        URL.revokeObjectURL(url);
    }

    private async handleImport(file: File): Promise<void> {
        try {
            const data = JSON.parse(await file.text());
            if (Array.isArray(data.aliases))  { this.aliasManager.aliases   = data.aliases;  this.aliasManager.saveAliases(); }
            if (Array.isArray(data.triggers)) { this.triggerManager.triggers = data.triggers; this.triggerManager.saveTriggers(); }
            // ponytail: scripts→aliases migration for legacy export files, delete in 2.0
            if (Array.isArray(data.scripts) && data.scripts.length) {
                scriptsToAliases(data.scripts, this.aliasManager.aliases);
                this.aliasManager.saveAliases();
            }
        } catch (e) {
            alert('Import failed: ' + (e as Error).message);
            return;
        }
        this.clearEditor();
        this.setEditorDisabled(true);
        this.updateListBox();
    }

    private handleSave(): void {
        const realInd = this.selectedRealIndex();
        const folder  = this.folderInput.value.trim();

        const is_script = this.scriptCheckbox.checked;
        const item: EditorItem = {
            pattern: this.patternInput.value,
            value: is_script ? this.codeMirror.state.doc.toString() : this.textArea.value,
            regex: this.regexCheckbox.checked,
            is_script,
        };
        if (folder) item.folder = folder;
        if (this.type === 'alias') {
            if (realInd < 0) { this.aliasManager.aliases.push(item); } else { this.aliasManager.aliases[realInd] = item; }
            this.aliasManager.saveAliases();
        } else {
            if (realInd < 0) { this.triggerManager.triggers.push(item); } else { this.triggerManager.triggers[realInd] = item; }
            this.triggerManager.saveTriggers();
        }
        this.clearEditor();
        this.setEditorDisabled(true);
        this.updateListBox();
    }

    private handleCancel(): void {
        if (this.selectedRealIndex() >= 0) {
            this.handleListBoxChange();
        } else {
            this.clearEditor();
            this.setEditorDisabled(true);
        }
    }

    private handleRun(): void {
        const script = this.jsScript.makeScript(this.codeMirror.state.doc.toString(), '');
        if (script) { script(); }
    }

    public show(): void {
        this.updateListBox();
        this.panel.hidden = false;
        this.panel.style.zIndex = String(++zTop);
    }
}
