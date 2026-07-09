import "./base.css";
import "./idePanel.css";
import { initDrag } from "./base";
import { IdeClient, IdeContent, IdeDiagnostic, IdeDirEntry, IdeError } from "../core/ideClient";
import { basicSetup } from "codemirror";
import { EditorView, keymap } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { cpp } from "@codemirror/lang-cpp";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { lintGutter, setDiagnostics, Diagnostic } from "@codemirror/lint";

type PanelMode = 'float' | 'top' | 'bottom' | 'left' | 'right' | 'maximize';

interface OpenFile {
    path: string;
    baseHash: string | null;   // null = new file, not on server yet
    state: EditorState;        // stored when the tab is inactive
    dirty: boolean;
    tabEl: HTMLElement;
}

let zTop = 1000;

/**
 * IDE panel: mudlib file tree + tabbed CodeMirror editor over the GMCP
 * "Ide" package. Save (Ctrl-S) compiles server-side; compiler errors come
 * back as diagnostics in the lint gutter and the problems strip.
 */
export class IdeWin {
    private panel: HTMLElement;
    private titlebar: HTMLElement;
    private authBar: HTMLElement;
    private tokenInput: HTMLInputElement;
    private treeEl: HTMLElement;
    private tabsEl: HTMLElement;
    private editorHost: HTMLElement;
    private statusEl: HTMLElement;
    private problemsEl: HTMLElement;

    private codeMirror: EditorView;
    private langComp = new Compartment();

    private mode: PanelMode = 'float';
    private floatStyle = { top: '8%', left: '10%', width: '860px', height: '560px' };

    private files: OpenFile[] = [];
    private active: OpenFile | null = null;

    constructor(private ide: IdeClient) {
        this.panel = document.createElement('div');
        this.panel.className = 'mudpanel mudpanel-float';
        this.panel.hidden = true;
        this.panel.innerHTML = `
            <div class="mudpanel-titlebar">
                <span class="mudpanel-title">IDE</span>
                <span class="mudpanel-modes">
                    <button data-toggle="h" title="Dock left / right">&#x25C0;&#x25B6;</button>
                    <button data-toggle="v" title="Dock top / bottom">&#x25B2;&#x25BC;</button>
                    <button data-toggle="max" title="Float / Maximize">&#x26F6;</button>
                </span>
                <button class="mudpanel-close" title="Close">&#x2715;</button>
            </div>
            <div class="winIde-authbar">
                <span>Type <b>idetoken</b> in game, then paste the token:</span>
                <input type="password" class="winIde-token" placeholder="token...">
                <button class="winIde-btnAuth">Authorize</button>
            </div>
            <div class="mudpanel-body winIde-body">
                <div class="winIde-tree-pane">
                    <div class="winIde-tree-buttons">
                        <button class="winIde-btnRefresh" title="Reload file tree">&#x21BB;</button>
                        <button class="winIde-btnNewFile" title="New file">+</button>
                    </div>
                    <div class="winIde-tree"></div>
                </div>
                <div class="winIde-edit-pane">
                    <div class="winIde-tabs"></div>
                    <div class="winIde-editor"></div>
                    <div class="winIde-problems" hidden></div>
                    <div class="winIde-status">Not connected.</div>
                </div>
            </div>
        `;
        document.body.appendChild(this.panel);

        this.titlebar   = this.panel.querySelector('.mudpanel-titlebar')!;
        this.authBar    = this.panel.querySelector('.winIde-authbar')!;
        this.tokenInput = this.panel.querySelector('.winIde-token')!;
        this.treeEl     = this.panel.querySelector('.winIde-tree')!;
        this.tabsEl     = this.panel.querySelector('.winIde-tabs')!;
        this.editorHost = this.panel.querySelector('.winIde-editor')!;
        this.statusEl   = this.panel.querySelector('.winIde-status')!;
        this.problemsEl = this.panel.querySelector('.winIde-problems')!;

        this.codeMirror = new EditorView({
            state: this.makeState('', ''),
            parent: this.editorHost,
        });

        this.applyFloatStyle();
        this.initModeButtons();
        initDrag(this.panel, this.titlebar, () => this.mode);
        this.panel.addEventListener('mousedown', () => { this.panel.style.zIndex = String(++zTop); });
        this.panel.querySelector('.mudpanel-close')!.addEventListener('click', () => { this.panel.hidden = true; });

        this.panel.querySelector('.winIde-btnAuth')!.addEventListener('click', () => this.doAuth());
        this.tokenInput.addEventListener('keydown', e => { if (e.key === 'Enter') this.doAuth(); });
        this.panel.querySelector('.winIde-btnRefresh')!.addEventListener('click', () => this.renderRoots());
        this.panel.querySelector('.winIde-btnNewFile')!.addEventListener('click', () => this.newFile());

        this.ide.EvtAuthChanged.handle((authed) => {
            this.authBar.hidden = authed;
            if (authed) {
                this.setStatus("Authorized. Scopes: " + (this.ide.welcome?.scopes ?? []).join(", "));
                this.renderRoots();
            } else {
                this.setStatus("Authorization expired or lost. Re-run idetoken in game.");
            }
        });
        this.ide.EvtEvent.handle((ev) => {
            if (ev.type === "modified" && ev.path) {
                const f = this.files.find(x => x.path === ev.path);
                if (f) this.setStatus(ev.path + " was modified by " + (ev.who ?? "someone") + " - your copy may be stale.");
            }
        });
        this.ide.EvtError.handle((err) => this.setStatus("Server: " + err.message));
    }

    public show(): void {
        this.panel.hidden = false;
        this.panel.style.zIndex = String(++zTop);
        this.authBar.hidden = this.ide.authed;
        if (this.ide.authed && !this.treeEl.hasChildNodes()) this.renderRoots();
        if (!this.ide.authed) this.tokenInput.focus();
    }

    /* ----- CodeMirror ----- */

    private langFor(path: string) {
        if (path.endsWith('.c') || path.endsWith('.h')) return cpp();
        if (path.endsWith('.js')) return javascript();
        return [];
    }

    private makeState(path: string, doc: string): EditorState {
        return EditorState.create({
            doc,
            extensions: [
                basicSetup,
                oneDark,
                lintGutter(),
                this.langComp.of(this.langFor(path)),
                keymap.of([{
                    key: "Mod-s",
                    preventDefault: true,
                    run: () => { this.saveActive(); return true; },
                }]),
                EditorView.updateListener.of(u => {
                    if (u.docChanged && this.active) this.markDirty(this.active, true);
                }),
            ],
        });
    }

    /* ----- auth ----- */

    private async doAuth(): Promise<void> {
        const token = this.tokenInput.value.trim();
        if (!token) return;
        this.setStatus("Authorizing...");
        try {
            const w = await this.ide.auth(token);
            this.tokenInput.value = "";  // token lives in memory server-side only
            this.setStatus("Authorized until " + new Date(w.expires * 1000).toLocaleTimeString());
        } catch (e) {
            this.setStatus(e instanceof IdeError ? e.message : String(e));
        }
    }

    /* ----- file tree ----- */

    private renderRoots(): void {
        this.treeEl.innerHTML = '';
        const scopes = this.ide.welcome?.scopes ?? [];
        for (const scope of scopes) {
            const path = scope === "/" ? "" : scope.replace(/\/$/, "");
            this.treeEl.appendChild(this.makeDirNode(scope === "/" ? "/" : path, scope));
        }
    }

    private makeDirNode(path: string, label: string): HTMLElement {
        const node = document.createElement('div');
        node.className = 'winIde-node winIde-dir';
        const row = document.createElement('div');
        row.className = 'winIde-row';
        row.innerHTML = `<span class="winIde-caret">&#x25B8;</span><span class="winIde-label"></span>`;
        row.querySelector('.winIde-label')!.textContent = label;
        const children = document.createElement('div');
        children.className = 'winIde-children';
        children.hidden = true;
        node.append(row, children);

        let loaded = false;
        row.addEventListener('click', async () => {
            if (children.hidden) {
                children.hidden = false;
                row.querySelector('.winIde-caret')!.innerHTML = '&#x25BE;';
                if (!loaded) {
                    loaded = true;
                    await this.loadDir(path === "/" ? "/" : path, children);
                }
            } else {
                children.hidden = true;
                row.querySelector('.winIde-caret')!.innerHTML = '&#x25B8;';
            }
        });
        return node;
    }

    private async loadDir(path: string, host: HTMLElement): Promise<void> {
        host.innerHTML = '<div class="winIde-loading">loading...</div>';
        let entries: IdeDirEntry[];
        try {
            entries = await this.ide.list(path === "/" ? "/" : path);
        } catch (e) {
            host.innerHTML = '';
            this.setStatus(e instanceof IdeError ? e.message : String(e));
            return;
        }
        host.innerHTML = '';
        entries.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
        const base = path === "/" ? "" : path;
        for (const ent of entries) {
            const child = base + "/" + ent.name;
            if (ent.type === 'dir') {
                host.appendChild(this.makeDirNode(child, ent.name));
            } else {
                const row = document.createElement('div');
                row.className = 'winIde-row winIde-file';
                row.innerHTML = `<span class="winIde-caret"></span><span class="winIde-label"></span>`;
                row.querySelector('.winIde-label')!.textContent = ent.name;
                row.addEventListener('click', () => this.openFile(child));
                host.appendChild(row);
            }
        }
    }

    /* ----- tabs / open files ----- */

    private async openFile(path: string): Promise<void> {
        const existing = this.files.find(f => f.path === path);
        if (existing) {
            this.activate(existing);
            return;
        }
        this.setStatus("Opening " + path + "...");
        let content: IdeContent;
        try {
            content = await this.ide.open(path);
        } catch (e) {
            this.setStatus(e instanceof IdeError ? e.message : String(e));
            return;
        }
        this.addTab(path, content.content, content.hash);
        this.setStatus(path + " (" + content.size + " bytes)");
    }

    private newFile(): void {
        const path = prompt("New file path (absolute, e.g. /realms/you/thing.c):");
        if (!path) return;
        this.addTab(path, "", null);
        this.setStatus(path + " (new file, will be created on save)");
    }

    private addTab(path: string, doc: string, baseHash: string | null): void {
        const tabEl = document.createElement('span');
        tabEl.className = 'winIde-tab';
        tabEl.innerHTML = `<span class="winIde-tab-label"></span><button class="winIde-tab-close" title="Close">&#x2715;</button>`;
        tabEl.querySelector('.winIde-tab-label')!.textContent = path.split('/').pop() ?? path;
        tabEl.title = path;
        this.tabsEl.appendChild(tabEl);

        const file: OpenFile = { path, baseHash, state: this.makeState(path, doc), dirty: false, tabEl };
        this.files.push(file);

        tabEl.addEventListener('click', (e) => {
            if ((e.target as HTMLElement).closest('.winIde-tab-close')) this.closeTab(file);
            else this.activate(file);
        });
        this.activate(file);
    }

    private activate(file: OpenFile): void {
        if (this.active === file) return;
        if (this.active) this.active.state = this.codeMirror.state;
        this.active = file;
        this.codeMirror.setState(file.state);
        this.codeMirror.dispatch({ effects: this.langComp.reconfigure(this.langFor(file.path)) });
        for (const f of this.files) f.tabEl.classList.toggle('active', f === file);
        this.renderProblems([]);
    }

    private closeTab(file: OpenFile): void {
        if (file.dirty && !confirm(file.path + " has unsaved changes. Close anyway?")) return;
        try { this.ide.close(file.path); } catch { /* disconnected is fine */ }
        file.tabEl.remove();
        this.files = this.files.filter(f => f !== file);
        if (this.active === file) {
            this.active = null;
            const next = this.files[this.files.length - 1];
            if (next) this.activate(next);
            else this.codeMirror.setState(this.makeState('', ''));
        }
    }

    private markDirty(file: OpenFile, dirty: boolean): void {
        if (file.dirty === dirty) return;
        file.dirty = dirty;
        file.tabEl.classList.toggle('dirty', dirty);
    }

    /* ----- save + diagnostics ----- */

    private async saveActive(): Promise<void> {
        const file = this.active;
        if (!file) return;
        const content = this.codeMirror.state.doc.toString();
        this.setStatus("Saving " + file.path + "...");
        try {
            const res = await this.ide.save(file.path, content, file.baseHash);
            this.applyDiagnostics(file, res.diagnostics);
            if (res.ok) {
                file.baseHash = res.newHash ?? file.baseHash;
                this.markDirty(file, false);
                this.setStatus(file.path + " saved" +
                    (res.compiled ? (res.reloaded ? ", compiled and reloaded." : ", compiled (reload skipped).") : ".") +
                    (res.diagnostics.length ? " " + res.diagnostics.length + " warning(s)." : ""));
            } else {
                const errs = res.diagnostics.filter(d => d.severity === "error").length;
                this.setStatus(file.path + ": compile failed with " + errs + " error(s). Nothing was written.");
            }
        } catch (e) {
            if (e instanceof IdeError && e.code === "stale") {
                this.setStatus(file.path + " changed on the server since you opened it.");
                if (confirm(file.path + " changed on the server. Reload server version? (Your local changes stay in the editor history via undo.)")) {
                    try {
                        const c = await this.ide.open(file.path);
                        this.codeMirror.dispatch({
                            changes: { from: 0, to: this.codeMirror.state.doc.length, insert: c.content },
                        });
                        file.baseHash = c.hash;
                        this.markDirty(file, false);
                    } catch (e2) {
                        this.setStatus(e2 instanceof IdeError ? e2.message : String(e2));
                    }
                }
            } else {
                this.setStatus(e instanceof IdeError ? e.message : String(e));
            }
        }
    }

    private applyDiagnostics(file: OpenFile, diags: IdeDiagnostic[]): void {
        const doc = this.codeMirror.state.doc;
        const cmDiags: Diagnostic[] = [];
        const other: IdeDiagnostic[] = [];
        for (const d of diags) {
            if (d.path === file.path && d.line >= 1 && d.line <= doc.lines) {
                const line = doc.line(d.line);
                cmDiags.push({
                    from: Math.min(line.from + Math.max(d.col, 0), line.to),
                    to: line.to,
                    severity: d.severity === "warning" ? "warning" : "error",
                    message: d.message,
                });
            } else {
                other.push(d);
            }
        }
        this.codeMirror.dispatch(setDiagnostics(this.codeMirror.state, cmDiags));
        this.renderProblems(diags, other);
    }

    private renderProblems(diags: IdeDiagnostic[], _other?: IdeDiagnostic[]): void {
        if (!diags.length) {
            this.problemsEl.hidden = true;
            this.problemsEl.innerHTML = '';
            return;
        }
        this.problemsEl.hidden = false;
        this.problemsEl.innerHTML = '';
        for (const d of diags) {
            const row = document.createElement('div');
            row.className = 'winIde-problem winIde-problem-' + d.severity;
            row.textContent = `${d.severity}: ${d.path}:${d.line} ${d.message}`;
            row.addEventListener('click', () => {
                const doc = this.codeMirror.state.doc;
                if (d.line >= 1 && d.line <= doc.lines) {
                    const line = doc.line(d.line);
                    this.codeMirror.dispatch({ selection: { anchor: line.from }, scrollIntoView: true });
                    this.codeMirror.focus();
                }
            });
            this.problemsEl.appendChild(row);
        }
    }

    private setStatus(msg: string): void {
        this.statusEl.textContent = msg;
    }

    /* ----- panel chrome (same conventions as editor.ts) ----- */

    private applyFloatStyle(): void {
        Object.assign(this.panel.style, this.floatStyle, { right: '', bottom: '' });
    }

    private clearPositionStyle(): void {
        Object.assign(this.panel.style, { top: '', left: '', right: '', bottom: '', width: '', height: '' });
    }

    private setMode(mode: PanelMode): void {
        if (this.mode === 'float') {
            this.floatStyle = {
                top:    this.panel.style.top    || '8%',
                left:   this.panel.style.left   || '10%',
                width:  this.panel.style.width  || '860px',
                height: this.panel.style.height || '560px',
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
}
