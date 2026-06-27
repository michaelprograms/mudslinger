import { EventHook } from "../core/event";
import { UserConfig } from "../core/userConfig";
import { AliasEditor } from "../panel/alias";
import { TriggerEditor } from "../panel/trigger";
import { JsScriptWin } from "../panel/script";
import { AboutWin } from "../panel/about";

export class MenuBar {
    public EvtChangeDefaultColor = new EventHook<[string, string]>();
    public EvtChangeDefaultBgColor = new EventHook<[string, string]>();
    public EvtChangeFontSize = new EventHook<string>();
    public EvtConnectClicked = new EventHook<void>();
    public EvtDisconnectClicked = new EventHook<void>();

    constructor(
        private aliasEditor: AliasEditor,
        private triggerEditor: TriggerEditor,
        private jsScriptWin: JsScriptWin,
        private aboutWin: AboutWin,
    ) {
        this.setupCheckboxes();
        this.setupClicks();
    }

    private setupCheckboxes() {
        const chkColor = document.getElementById('menuBar-chkEnableColor') as HTMLInputElement;
        const chkUtf8  = document.getElementById('menuBar-chkEnableUtf8')  as HTMLInputElement;
        const chkMxp   = document.getElementById('menuBar-chkEnableMxp')   as HTMLInputElement;
        const chkTrig  = document.getElementById('menuBar-chkEnableTrig')   as HTMLInputElement;
        const chkAlias = document.getElementById('menuBar-chkEnableAlias')  as HTMLInputElement;

        chkColor.checked = UserConfig.getDef('colorsEnabled',   true);
        chkUtf8.checked  = UserConfig.getDef('utf8Enabled',     true);
        chkMxp.checked   = UserConfig.getDef('mxpEnabled',      true);
        chkTrig.checked  = UserConfig.getDef('triggersEnabled', true);
        chkAlias.checked = UserConfig.getDef('aliasesEnabled',  true);

        chkColor.addEventListener('change', () => UserConfig.set('colorsEnabled',   chkColor.checked));
        chkUtf8.addEventListener( 'change', () => UserConfig.set('utf8Enabled',     chkUtf8.checked));
        chkMxp.addEventListener(  'change', () => UserConfig.set('mxpEnabled',      chkMxp.checked));
        chkTrig.addEventListener( 'change', () => UserConfig.set('triggersEnabled', chkTrig.checked));
        chkAlias.addEventListener('change', () => UserConfig.set('aliasesEnabled',  chkAlias.checked));
    }

    private setupClicks() {
        const actions: {[k: string]: () => void} = {
            'Connect':        () => this.EvtConnectClicked.fire(),
            'Disconnect':     () => this.EvtDisconnectClicked.fire(),
            'Aliases':        () => this.aliasEditor.show(),
            'Triggers':       () => this.triggerEditor.show(),
            'Script':         () => this.jsScriptWin.show(),
            'About':          () => this.aboutWin.show(),
            'White on Black': () => { this.EvtChangeDefaultColor.fire(['white', 'low']);  this.EvtChangeDefaultBgColor.fire(['black', 'low']); },
            'Green on Black': () => { this.EvtChangeDefaultColor.fire(['green', 'low']);  this.EvtChangeDefaultBgColor.fire(['black', 'low']); },
            'Black on Grey':  () => { this.EvtChangeDefaultColor.fire(['black', 'low']);  this.EvtChangeDefaultBgColor.fire(['white', 'low']); },
            'Black on White': () => { this.EvtChangeDefaultColor.fire(['black', 'low']);  this.EvtChangeDefaultBgColor.fire(['white', 'high']); },
        };
        for (const sz of ['xx-small', 'x-small', 'small', 'medium', 'large', 'x-large', 'xx-large']) {
            actions[sz] = () => this.EvtChangeFontSize.fire(sz);
        }

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
