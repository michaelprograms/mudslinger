import { Telnet, NegotiationData, Cmd, CmdName, Opt, OptName } from "./telnetlib";
import { EventHook } from "../core/event";
import { UserConfig } from "../core/userConfig";
import { AppInfo } from "../core/appInfo";


const utf8Decoder = new TextDecoder("utf-8");

const TTYPES: string[] = [
    "Mudslinger",
    "ANSI",
    "-256color"
];


export class TelnetClient extends Telnet {
    public EvtServerEcho = new EventHook<boolean>();
    public EvtGmcp = new EventHook<{pkg: string; data: unknown}>();

    private ttypeIndex: number = 0;

    private doNewEnviron: boolean = false;
    private doCharset: boolean = false;
    private doGmcp: boolean = false;

    constructor(writeFunc: (data: ArrayBuffer) => void) {
        super(writeFunc);
        this.EvtNegotiation.handle((data) => { this.onNegotiation(data); });
    }

    public get gmcpEnabled(): boolean {
        return this.doGmcp;
    }

    /**
     * Send a GMCP message: IAC SB 201 "Pkg.Msg" [SP json] IAC SE.
     * Payload is UTF-8 encoded; IAC bytes are doubled per the telnet spec
     * (0xFF never occurs in valid UTF-8, but escape defensively).
     */
    public sendGmcp(pkg: string, data?: unknown): void {
        const payload = data === undefined ? pkg : pkg + " " + JSON.stringify(data);
        const bytes = new TextEncoder().encode(payload);
        const arr: number[] = [Cmd.IAC, Cmd.SB, ExtOpt.GMCP];
        for (let i = 0; i < bytes.length; i++) {
            arr.push(bytes[i]);
            if (bytes[i] === Cmd.IAC) {
                arr.push(Cmd.IAC);
            }
        }
        arr.push(Cmd.IAC, Cmd.SE);
        this.writeArr(arr);
    }

    private writeNewEnvVar(varName: string, varVal: string) {
        this.writeArr([
            Cmd.IAC, Cmd.SB, Opt.NEW_ENVIRON,
            NewEnv.IS, NewEnv.VAR
            ].concat(
                arrayFromString(varName),
                [NewEnv.VALUE],
                arrayFromString(varVal),
                [Cmd.IAC, Cmd.SE]));
    }

    private handleNewEnvSeq(seq: number[]): void {
        let actions = parseNewEnvSeq(seq);

        const utf8 = UserConfig.getDef("utf8Enabled", true) === true;
        let varFuncs: {[k: string]: () => string} = {
            'CLIENT_NAME':    () => TTYPES[0],
            'CLIENT_VERSION': () => AppInfo.Version,
            'ANSI':           () => "1",
            'VT100':          () => "0",
            '256_COLORS':     () => "1",
            'UTF-8':          () => utf8 ? "1" : "0",
            'CHARSET':        () => utf8 ? "UTF-8" : "ASCII",
            'SCREEN_READER':  () => "0",
            'TERMINAL_TYPE':  () => "ANSI-256COLOR",
            'MTTS':           () => utf8 ? "13" : "9",
        };

        for (let i = 0; i < actions.length; i++) {
            let [action, varType, varName] = actions[i];
            if (action !== NewEnv.SEND) {
                console.error("Unexpected action:", actions[i]);
                continue;
            }

            if (varName === "") {
                if (varType === null) {
                    /* send all var and uservar */
                    for (let k in varFuncs) {
                        this.writeNewEnvVar(k, varFuncs[k]());
                    }
                    /* we don't support any USERVAR */
                } else if (varType === NewEnv.VAR) {
                    /* send all VAR */
                    for (let k in varFuncs) {
                        this.writeNewEnvVar(k, varFuncs[k]());
                    }
                } else if (varType === NewEnv.USERVAR) {
                    /* we don't support any USERVAR */
                }
            } else if (varType === NewEnv.VAR) {
                if (varName in varFuncs) {
                    this.writeNewEnvVar(varName, varFuncs[varName]());
                }
            } else if (varType === NewEnv.USERVAR) {
                /* we don't support any USERVAR */
            }
        }
    }

    private onNegotiation(data: NegotiationData) {
        let {cmd, opt} = data;
        // console.log(CmdName(cmd), opt === null ? "(SB/SE)" : OptName(opt));

        // SE completes a subnegotiation. opt is null, but the payload sits in the
        // SB buffer — this is where TTYPE / NEW-ENVIRON / MSDP replies are built,
        // so it must run *before* the opt-null guard below.
        if (cmd === Cmd.SE) {
            let sb = this.readSbArr();

            if (sb.length < 1) {
                return;
            }

            if (this.doCharset && sb[0] === Opt.CHARSET && sb.length > 2 && sb[1] === 1 /* REQUEST */) {
                const sep = String.fromCharCode(sb[2]);
                const list = String.fromCharCode(...sb.slice(2)).split(sep).map(s => s.toUpperCase());
                if (list.indexOf("UTF-8") !== -1) {
                    this.writeArr([Cmd.IAC, Cmd.SB, Opt.CHARSET, SubNeg.ACCEPTED]
                        .concat(arrayFromString("UTF-8"), [Cmd.IAC, Cmd.SE]));
                } else {
                    this.writeArr([Cmd.IAC, Cmd.SB, Opt.CHARSET, SubNeg.REJECTED, Cmd.IAC, Cmd.SE]);
                }
            } else if (sb.length === 2 && sb[0] === Opt.TTYPE && sb[1] === SubNeg.SEND) {
                let ttype: string;
                if (this.ttypeIndex >= TTYPES.length) {
                    ttype = "UNKNOWNIP";
                } else {
                    ttype = TTYPES[this.ttypeIndex];
                    this.ttypeIndex++;
                }
                this.writeArr( ([Cmd.IAC, Cmd.SB, Opt.TTYPE, SubNeg.IS]).concat(
                    arrayFromString(ttype),
                    [Cmd.IAC, Cmd.SE]
                ));
            } else if (this.doNewEnviron && sb.length > 0 && sb[0] == Opt.NEW_ENVIRON) {
                let seq = sb.slice(1);
                this.handleNewEnvSeq(seq);
            } else if (this.doGmcp && sb.length > 0 && sb[0] === ExtOpt.GMCP) {
                // GMCP payloads are UTF-8 JSON; decode properly (String.fromCharCode
                // would mangle multi-byte sequences).
                const str = utf8Decoder.decode(new Uint8Array(sb.slice(1)));
                const space = str.indexOf(' ');
                const pkg = space >= 0 ? str.slice(0, space) : str;
                const jsonStr = space >= 0 ? str.slice(space + 1) : '';
                let data: unknown = null;
                try {
                    if (jsonStr) data = JSON.parse(jsonStr);
                } catch (e) {
                    // A dropped payload becomes a silent request timeout
                    // downstream (e.g. Ide.Dir), so make it diagnosable.
                    console.warn("GMCP: unparseable JSON payload for " + pkg, e, jsonStr.slice(0, 200));
                }
                this.EvtGmcp.fire({pkg, data});
            }
            return;
        }

        // SB (and any other option-less command) needs no handling here; the
        // guard also narrows opt to a number for the negotiation branches below.
        if (opt === null) return;

        if (cmd === Cmd.WILL) {
            if (opt === Opt.ECHO) {
                this.EvtServerEcho.fire(true);
                this.writeArr([Cmd.IAC, Cmd.DO, Opt.ECHO]);
            } else if (opt === Opt.CHARSET && UserConfig.getDef("utf8Enabled", true) === true) {
                this.writeArr([Cmd.IAC, Cmd.DO, Opt.CHARSET]);
                this.doCharset = true;
            } else if (opt === Opt.SGA) {
                this.writeArr([Cmd.IAC, Cmd.DO, Opt.SGA]);
            } else if (opt === ExtOpt.GMCP) {
                this.writeArr([Cmd.IAC, Cmd.DO, ExtOpt.GMCP]);
                this.doGmcp = true;
            } else {
                this.writeArr([Cmd.IAC, Cmd.DONT, opt]);
            }
        } else if (cmd === Cmd.WONT) {
            if (opt === Opt.ECHO) {
                this.EvtServerEcho.fire(false);
                this.writeArr([Cmd.IAC, Cmd.DONT, Opt.ECHO]);
            }
        } else if (cmd === Cmd.DO) {
            if (opt === Opt.TTYPE) {
                this.writeArr([Cmd.IAC, Cmd.WILL, Opt.TTYPE]);
            } else if (opt == Opt.NEW_ENVIRON) {
                this.writeArr([Cmd.IAC, Cmd.WILL, Opt.NEW_ENVIRON]);
                this.doNewEnviron = true;
            } else if (opt === Opt.CHARSET && UserConfig.getDef("utf8Enabled", true) === true) {
                this.writeArr([Cmd.IAC, Cmd.WILL, Opt.CHARSET]);
                this.doCharset = true;
                this.writeArr([Cmd.IAC, Cmd.SB, Opt.CHARSET, 1 /* REQUEST */]
                    .concat(arrayFromString(";UTF-8"), [Cmd.IAC, Cmd.SE]));
            } else if (opt === ExtOpt.GMCP) {
                this.writeArr([Cmd.IAC, Cmd.WILL, ExtOpt.GMCP]);
                this.doGmcp = true;
            } else {
                this.writeArr([Cmd.IAC, Cmd.WONT, opt]);
            }
        } else if (cmd === Cmd.DONT) {
            if (opt === Opt.NEW_ENVIRON) {
                this.doNewEnviron = false;
            } else if (opt === Opt.CHARSET) {
                this.doCharset = false;
            }
        }
    }
}

export namespace ExtOpt {
    export const MCCP = 70;
    export const MSP = 90;
    export const MXP = 91;
    export const ATCP = 200;
    export const GMCP = 201;
}

export namespace SubNeg {
    export const IS = 0;
    export const SEND = 1;
    export const ACCEPTED = 2;
    export const REJECTED = 3;
}

export namespace NewEnv {
    export const IS = 0;
    export const SEND = 1;
    export const INFO = 2;

    export const VAR = 0;
    export const VALUE = 1;
    export const ESC = 2;
    export const USERVAR = 3;
}

function arrayFromString(str: string): number[] {
    let arr = new Array(str.length);
    for (let i = 0; i < arr.length; i++) {
        arr[i] = str.charCodeAt(i);
    }

    return arr;
}

export function parseNewEnvSeq(seq: number[]): [number, number | null, string][] {
    let rtn: [number, number | null, string][] = [];

    let i: number = 0;

    let firstAct: number | null = null;
    let act: number | null = null;
    let varType: number | null = null;
    let varName: string | null = null;
    
    while (true) {
        if (act !== null && varType !== null && varName !== null) {
            rtn.push([act, varType, varName]);
            act = null;
            varType = null;
            varName = null;
        }

        if (i >= seq.length) {
            if (act != null) {
                rtn.push([act, varType, varName || ""]);
            }
            break;
        }
        
        if (act === null) {
            let first = seq[i];
            if (firstAct === null) {
                /* We are at the very start of sequence so it has to be a SEND */
                act = first;
                firstAct = act;
                i++;

                if (act !== NewEnv.SEND) {
                    console.error("Only NEW-ENVIRON SEND is supported but got", act);
                    break;
                }
            } else if (first === firstAct) {
                /* Some servers will repeat the SEND for each request, some won't */
                act = firstAct;
                i++;
                continue;
            } else {
                act = firstAct;
                continue;
            }
        } else if (varType === null) {
            varType = seq[i];
            if (varType !== NewEnv.VAR && varType !== NewEnv.USERVAR) {
                console.error("Only NEW-ENVIRON VAR and USERVAR are supported but got", varType);
                break;
            }
            i++;
            continue;
        } else {
            let start = i;
            while (i < seq.length && seq[i] >=32 && seq[i] <= 127) {
                i++;
            }
            let varNameArr = seq.slice(start, i);
            varName = String.fromCharCode(...varNameArr);
        }
    }

    return rtn;
}

