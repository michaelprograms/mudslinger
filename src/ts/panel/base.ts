export interface EditorItem {
    pattern: string;
    value: string;
    regex: boolean;
    is_script: boolean;
    scope?: string; // undefined/'global' = always active; char name = that character only
}

/**
 * Inline replacements for window.prompt/confirm, rendered as a bar pinned
 * under the panel's titlebar. Only one bar per panel: opening a new one
 * cancels the previous. Enter/OK resolves, Escape/Cancel rejects the value
 * (null for prompts, false for confirms).
 */
function inlineBar(panel: HTMLElement, build: (bar: HTMLElement, done: () => void) => void): void {
    panel.querySelector('.mudpanel-inlinebar')?.dispatchEvent(new CustomEvent('inlinebar-cancel'));
    const bar = document.createElement('div');
    bar.className = 'mudpanel-inlinebar';
    const titlebar = panel.querySelector('.mudpanel-titlebar');
    if (titlebar?.nextSibling) panel.insertBefore(bar, titlebar.nextSibling);
    else panel.prepend(bar);
    build(bar, () => bar.remove());
}

export function inlinePrompt(panel: HTMLElement, label: string, placeholder = "", initial = ""): Promise<string | null> {
    return new Promise((resolve) => {
        inlineBar(panel, (bar, done) => {
            const span = document.createElement('span');
            span.textContent = label;
            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = placeholder;
            input.value = initial;
            const ok = document.createElement('button');
            ok.className = 'mudpanel-btn';
            ok.textContent = 'OK';
            const cancel = document.createElement('button');
            cancel.className = 'mudpanel-btn';
            cancel.textContent = 'Cancel';
            bar.append(span, input, ok, cancel);

            const finish = (v: string | null) => { done(); resolve(v); };
            ok.addEventListener('click', () => finish(input.value.trim() || null));
            cancel.addEventListener('click', () => finish(null));
            bar.addEventListener('inlinebar-cancel', () => finish(null));
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') finish(input.value.trim() || null);
                if (e.key === 'Escape') { e.stopPropagation(); finish(null); }
            });
            input.focus();
        });
    });
}

export function inlineConfirm(panel: HTMLElement, message: string, okLabel = "OK"): Promise<boolean> {
    return new Promise((resolve) => {
        inlineBar(panel, (bar, done) => {
            const span = document.createElement('span');
            span.textContent = message;
            const ok = document.createElement('button');
            ok.className = 'mudpanel-btn mudpanel-btn-danger';
            ok.textContent = okLabel;
            const cancel = document.createElement('button');
            cancel.className = 'mudpanel-btn';
            cancel.textContent = 'Cancel';
            bar.append(span, ok, cancel);

            const finish = (v: boolean) => { done(); resolve(v); };
            ok.addEventListener('click', () => finish(true));
            cancel.addEventListener('click', () => finish(false));
            bar.addEventListener('inlinebar-cancel', () => finish(false));
            bar.addEventListener('keydown', (e) => {
                if ((e as KeyboardEvent).key === 'Escape') finish(false);
            });
            ok.focus();
        });
    });
}

export function initDrag(
    panel: HTMLElement,
    titlebar: HTMLElement,
    getMode: () => string
): void {
    let dragging = false, ox = 0, oy = 0;
    titlebar.addEventListener('mousedown', e => {
        if (getMode() !== 'float') return;
        if ((e.target as HTMLElement).closest('button')) return;
        dragging = true;
        ox = e.clientX - panel.offsetLeft;
        oy = e.clientY - panel.offsetTop;
        e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
        if (!dragging) return;
        panel.style.left = (e.clientX - ox) + 'px';
        panel.style.top  = (e.clientY - oy) + 'px';
    });
    document.addEventListener('mouseup', () => { dragging = false; });
}
