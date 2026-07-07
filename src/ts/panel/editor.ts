import "./base.css";
import { UserConfig } from "../core/userConfig";
import { AliasManager } from "../manager/alias";
import { TriggerManager } from "../manager/trigger";
import { JsScript } from "../core/script";
import { EditorItem, initDrag } from "./base";
import { basicSetup } from "codemirror";
import { EditorView } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";

type EditorType = 'alias' | 'trigger' | 'script';
type PanelMode = 'float' | 'top' | 'bottom' | 'left' | 'right' | 'maximize';

interface ScriptItem { name: string; code: string; scope?: string; }

let zTop = 1000;

export class EditorWin {
    private panel: HTMLElement;
    private titlebar: HTMLElement;
    private titleSpan: HTMLElement;
    private activeCharSelect: HTMLSelectElement;
    private newCharInput: HTMLInputElement;
    private typeButtons: NodeListOf<HTMLButtonElement>;
    private listBox: HTMLSelectElement;
    private patternInput: HTMLInputElement;
    private nameInput: HTMLInputElement;
    private regexCheckbox: HTMLInputElement;
    private scriptCheckbox: HTMLInputElement;
    private scopeSelect: HTMLSelectElement;
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
    private scripts: ScriptItem[] = [];
    private filteredIndices: number[] = [];

    constructor(
        private aliasManager: AliasManager,
        private triggerManager: TriggerManager,
        private jsScript: JsScript
    ) {
        this.scripts = UserConfig.getDef('scripts', []);

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
                        <button class="winEdit-typeBtn active" data-type="alias">Aliases</button>
                        <button class="winEdit-typeBtn" data-type="trigger">Triggers</button>
                        <button class="winEdit-typeBtn" data-type="script">Scripts</button>
                    </div>
                    <div class="winEdit-char-selector">
                        <label>Character</label>
                        <select class="winEdit-activeChar">
                            <option value="">— All —</option>
                            <option value="global">Global</option>
                        </select>
                        <div class="winEdit-char-add">
                            <input type="text" class="winEdit-newChar" placeholder="add character...">
                            <button class="winEdit-btnAddChar">+</button>
                        </div>
                    </div>
                    <div class="winEdit-list-buttons">
                        <button class="winEdit-btnNew">NEW</button>
                        <button class="winEdit-btnDelete">DELETE</button>
                    </div>
                    <select class="winEdit-listBox" size="10"></select>
                </div>
                <div class="winEdit-edit-pane">
                    <div class="winEdit-meta">
                        <label class="winEdit-alias-trig-only">Pattern <input type="text" class="winEdit-pattern" placeholder="^pattern$" disabled></label>
                        <label class="winEdit-alias-trig-only"><input type="checkbox" class="winEdit-chkRegex" disabled> Regex</label>
                        <label class="winEdit-alias-trig-only"><input type="checkbox" class="winEdit-chkScript" disabled> Script</label>
                        <label class="winEdit-script-only" style="display:none">Name <input type="text" class="winEdit-name" disabled></label>
                        <button class="winEdit-btnRun winEdit-script-only" style="display:none" disabled>RUN</button>
                        <label>Scope <select class="winEdit-scope" disabled><option value="">Global</option></select></label>
                        <button class="winEdit-btnSave" disabled>SAVE</button>
                        <button class="winEdit-btnCancel" disabled>CANCEL</button>
                    </div>
                    <div class="winEdit-value-label winEdit-alias-trig-only">Value:</div>
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
        this.activeCharSelect = this.panel.querySelector('.winEdit-activeChar')!;
        this.newCharInput     = this.panel.querySelector('.winEdit-newChar')!;
        this.typeButtons      = this.panel.querySelectorAll('.winEdit-typeBtn');
        this.listBox          = this.panel.querySelector('.winEdit-listBox')!;
        this.patternInput     = this.panel.querySelector('.winEdit-pattern')!;
        this.nameInput        = this.panel.querySelector('.winEdit-name')!;
        this.regexCheckbox    = this.panel.querySelector('.winEdit-chkRegex')!;
        this.scriptCheckbox   = this.panel.querySelector('.winEdit-chkScript')!;
        this.scopeSelect      = this.panel.querySelector('.winEdit-scope')!;
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
        this.activeCharSelect.addEventListener('change', () => {
            const val = this.activeCharSelect.value;
            // 'global' and '' (All) both mean no active character at runtime
            UserConfig.set('activeChar', val === 'global' ? '' : val);
            this.updateListBox();
        });
        this.panel.querySelector('.winEdit-btnAddChar')!.addEventListener('click', () => { this.handleAddChar(); });
        this.newCharInput.addEventListener('keydown', e => { if (e.key === 'Enter') this.handleAddChar(); });
        this.typeButtons.forEach(btn => {
            btn.addEventListener('click', () => { this.handleTypeChange(btn.dataset.type as EditorType); });
        });
        this.listBox.addEventListener('change', () => { this.handleListBoxChange(); });
        this.panel.querySelector('.winEdit-btnNew')!.addEventListener('click', () => { this.handleNew(); });
        this.panel.querySelector('.winEdit-btnDelete')!.addEventListener('click', () => { this.handleDelete(); });
        this.saveButton.addEventListener('click', () => { this.handleSave(); });
        this.cancelButton.addEventListener('click', () => { this.handleCancel(); });
        this.runButton.addEventListener('click', () => { this.handleRun(); });
        this.scriptCheckbox.addEventListener('change', () => {
            if (this.scriptCheckbox.checked) { this.showScriptInput(); } else { this.showTextInput(); }
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
        this.nameInput.disabled      = state;
        this.regexCheckbox.disabled  = state;
        this.scriptCheckbox.disabled = state;
        this.scopeSelect.disabled    = state;
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
        const isScript = this.type === 'script';
        const titles: Record<EditorType, string> = { alias: 'ALIASES', trigger: 'TRIGGERS', script: 'SCRIPTS' };
        this.titleSpan.textContent = titles[this.type];
        this.panel.querySelectorAll<HTMLElement>('.winEdit-alias-trig-only')
            .forEach(el => { el.style.display = isScript ? 'none' : ''; });
        this.panel.querySelectorAll<HTMLElement>('.winEdit-script-only')
            .forEach(el => { el.style.display = isScript ? '' : 'none'; });
        this.clearEditor();
        this.setEditorDisabled(true);
        this.updateListBox();
    }

    private handleAddChar(): void {
        const name = this.newCharInput.value.trim();
        if (!name) return;
        const known: string[] = UserConfig.getDef('knownChars', []);
        if (!known.includes(name)) UserConfig.set('knownChars', [...known, name]);
        this.newCharInput.value = '';
        this.updateCharSelect();
        this.activeCharSelect.value = name;
        UserConfig.set('activeChar', name);
        this.updateScopeOptions();
        this.updateListBox();
    }

    private currentItems(): (EditorItem | ScriptItem)[] {
        if (this.type === 'alias') return this.aliasManager.aliases;
        if (this.type === 'trigger') return this.triggerManager.triggers;
        return this.scripts;
    }

    private updateListBox(): void {
        const char = this.activeCharSelect.value;
        const items = this.currentItems();
        this.filteredIndices = [];
        const opts: HTMLOptionElement[] = [];

        for (let i = 0; i < items.length; i++) {
            const scope = (items[i] as any).scope || '';
            // '' = All (show everything); 'global' = only unscoped; else = only that character
            if (char === 'global' && scope !== '' && scope !== 'global') continue;
            if (char !== '' && char !== 'global' && scope !== char) continue;
            this.filteredIndices.push(i);
            const opt = document.createElement('option');
            opt.textContent = 'pattern' in items[i]
                ? (items[i] as EditorItem).pattern
                : (items[i] as ScriptItem).name;
            opts.push(opt);
        }
        this.listBox.replaceChildren(...opts);
    }

    private updateScopeOptions(): void {
        const current = this.scopeSelect.value;
        const known: string[] = UserConfig.getDef('knownChars', []);
        const opts = [
            Object.assign(document.createElement('option'), { value: '', textContent: 'Global' }),
            ...known.map(n => Object.assign(document.createElement('option'), { value: n, textContent: n }))
        ];
        this.scopeSelect.replaceChildren(...opts);
        this.scopeSelect.value = current;
    }

    private updateCharSelect(): void {
        const known: string[] = UserConfig.getDef('knownChars', []);
        const activeChar = UserConfig.getDef('activeChar', '');
        const opts = [
            Object.assign(document.createElement('option'), { value: '', textContent: '— All —' }),
            Object.assign(document.createElement('option'), { value: 'global', textContent: 'Global' }),
            ...known.map(n => Object.assign(document.createElement('option'), { value: n, textContent: n }))
        ];
        this.activeCharSelect.replaceChildren(...opts);
        // 'global' view when no activeChar is set and we want to show that selection
        this.activeCharSelect.value = activeChar || '';
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

    private clearEditor(): void {
        this.patternInput.value     = '';
        this.nameInput.value        = '';
        this.textArea.value         = '';
        this.cmSet('');
        this.regexCheckbox.checked  = false;
        this.scriptCheckbox.checked = false;
        this.scopeSelect.value      = '';
        this.listBox.selectedIndex  = -1;
        if (this.type === 'script') { this.showScriptInput(); } else { this.showTextInput(); }
    }

    private handleListBoxChange(): void {
        const listInd = this.listBox.selectedIndex;
        if (listInd < 0) return;
        const realInd = this.filteredIndices[listInd];
        const item = this.currentItems()[realInd];
        if (!item) return;
        this.setEditorDisabled(false);

        if (this.type === 'script') {
            const s = item as ScriptItem;
            this.nameInput.value   = s.name;
            this.scopeSelect.value = s.scope || '';
            this.showScriptInput();
            this.cmSet(s.code);
        } else {
            const e = item as EditorItem;
            this.patternInput.value     = e.pattern;
            this.regexCheckbox.checked  = !!e.regex;
            this.scriptCheckbox.checked = !!e.is_script;
            this.scopeSelect.value      = e.scope || '';
            if (e.is_script) {
                this.showScriptInput();
                this.cmSet(e.value);
                this.textArea.value = '';
            } else {
                this.showTextInput();
                this.textArea.value = e.value;
                this.cmSet('');
            }
        }
    }

    private handleNew(): void {
        this.clearEditor();
        this.setEditorDisabled(false);
        // pre-fill scope to active character if one is selected
        if (this.activeCharSelect.value) this.scopeSelect.value = this.activeCharSelect.value;
        if (this.type === 'script') {
            this.nameInput.value = 'New Script';
            this.cmSet('// write script here');
        } else if (this.type === 'alias') {
            this.textArea.value = 'alias value here';
        } else {
            this.textArea.value = 'trigger value here';
        }
    }

    private handleDelete(): void {
        const listInd = this.listBox.selectedIndex;
        if (listInd < 0) return;
        const realInd = this.filteredIndices[listInd];
        if (this.type === 'alias') {
            this.aliasManager.aliases.splice(realInd, 1);
            this.aliasManager.saveAliases();
        } else if (this.type === 'trigger') {
            this.triggerManager.triggers.splice(realInd, 1);
            this.triggerManager.saveTriggers();
        } else {
            this.scripts.splice(realInd, 1);
            UserConfig.set('scripts', this.scripts);
        }
        this.clearEditor();
        this.setEditorDisabled(true);
        this.updateListBox();
    }

    private handleSave(): void {
        const listInd = this.listBox.selectedIndex;
        const realInd = listInd >= 0 ? this.filteredIndices[listInd] : -1;
        const scope   = this.scopeSelect.value;

        if (this.type === 'script') {
            const item: ScriptItem = {
                name: this.nameInput.value,
                code: this.codeMirror.state.doc.toString(),
            };
            if (scope) item.scope = scope;
            if (realInd < 0) { this.scripts.push(item); } else { this.scripts[realInd] = item; }
            this.scripts.sort((a, b) => a.name.localeCompare(b.name));
            UserConfig.set('scripts', this.scripts);
        } else {
            const is_script = this.scriptCheckbox.checked;
            const item: EditorItem = {
                pattern: this.patternInput.value,
                value: is_script ? this.codeMirror.state.doc.toString() : this.textArea.value,
                regex: this.regexCheckbox.checked,
                is_script,
            };
            if (scope) item.scope = scope;
            if (this.type === 'alias') {
                if (realInd < 0) { this.aliasManager.aliases.push(item); } else { this.aliasManager.aliases[realInd] = item; }
                this.aliasManager.saveAliases();
            } else {
                if (realInd < 0) { this.triggerManager.triggers.push(item); } else { this.triggerManager.triggers[realInd] = item; }
                this.triggerManager.saveTriggers();
            }
        }
        this.clearEditor();
        this.setEditorDisabled(true);
        this.updateListBox();
    }

    private handleCancel(): void {
        const listInd = this.listBox.selectedIndex;
        if (listInd >= 0) {
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
        this.scripts = UserConfig.getDef('scripts', []);
        this.updateCharSelect();
        this.updateScopeOptions();
        this.updateListBox();
        this.panel.hidden = false;
        this.panel.style.zIndex = String(++zTop);
    }
}
