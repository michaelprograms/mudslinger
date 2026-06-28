export interface EditorItem {
    pattern: string;
    value: string;
    regex: boolean;
    is_script: boolean;
    scope?: string; // undefined/'global' = always active; char name = that character only
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
