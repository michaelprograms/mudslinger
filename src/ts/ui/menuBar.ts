import "./menuBar.css";
import { EventHook } from "../core/event";
import { AboutWin } from "../panel/about";
import { ConfigWin } from "../panel/config";

export class MenuBar {
    public EvtConnectClicked = new EventHook<void>();
    public EvtDisconnectClicked = new EventHook<void>();
    public EvtEditorClicked = new EventHook<void>();
    public EvtIdeClicked = new EventHook<void>();

    constructor(
        private aboutWin: AboutWin,
        private configWin: ConfigWin,
    ) {
        this.setupClicks();
    }

    private setupClicks() {
        const actions: {[k: string]: () => void} = {
            'Connect':    () => this.EvtConnectClicked.fire(),
            'Disconnect': () => this.EvtDisconnectClicked.fire(),
            'Editor':     () => this.EvtEditorClicked.fire(),
            'IDE':        () => this.EvtIdeClicked.fire(),
            'Config':     () => this.configWin.show(),
            'About':      () => this.aboutWin.show(),
        };

        document.getElementById('menuBar')!.addEventListener('click', (e) => {
            const btn = (e.target as HTMLElement).closest('button');
            if (!btn) return;
            const text = btn.textContent?.trim() ?? '';
            actions[text]?.();
        });
    }

    handleTelnetConnect() {
        const btn = document.getElementById('menuBar-conn-disconn');
        if (btn) btn.textContent = 'Disconnect';
    }

    handleTelnetDisconnect() {
        const btn = document.getElementById('menuBar-conn-disconn');
        if (btn) btn.textContent = 'Connect';
    }
}
