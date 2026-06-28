import "./menuBar.css";
import { EventHook } from "../core/event";
import { AliasEditor } from "../panel/alias";
import { TriggerEditor } from "../panel/trigger";
import { JsScriptWin } from "../panel/script";
import { AboutWin } from "../panel/about";
import { ConfigWin } from "../panel/config";

export class MenuBar {
    public EvtConnectClicked = new EventHook<void>();
    public EvtDisconnectClicked = new EventHook<void>();

    constructor(
        private aliasEditor: AliasEditor,
        private triggerEditor: TriggerEditor,
        private jsScriptWin: JsScriptWin,
        private aboutWin: AboutWin,
        private configWin: ConfigWin,
    ) {
        this.setupClicks();
    }

    private setupClicks() {
        const actions: {[k: string]: () => void} = {
            'Connect':    () => this.EvtConnectClicked.fire(),
            'Disconnect': () => this.EvtDisconnectClicked.fire(),
            'Aliases':    () => this.aliasEditor.show(),
            'Triggers':   () => this.triggerEditor.show(),
            'Script':     () => this.jsScriptWin.show(),
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
