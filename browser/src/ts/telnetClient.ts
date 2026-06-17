import { Telnet, NegotiationData, Cmd, CmdName, Opt, OptName } from "./telnetlib";
import { EventHook } from "./event";
import { UserConfig } from "./userConfig";
import { AppInfo } from "./appInfo";


const TTYPES: string[] = [
    "Mudslinger",
    "ANSI",
    "-256color"
];


export class TelnetClient extends Telnet {
    public EvtServerEcho = new EventHook<boolean>();
    public EvtMsdpVar = new EventHook<[MsdpVarName, MsdpVal]>();

    public clientIp: string;

    private ttypeIndex: number = 0;

    private doNewEnviron: boolean = false;

    private msdpEnabled: boolean = false;
    private supportedMsdpVars: string[] = [];

    constructor(writeFunc: (data: ArrayBuffer) => void, private enableMsdp: boolean) {
        super(writeFunc);

        if (enableMsdp) {
            this.msdpEnabled = true;
            TTYPES[0] = "Mudslinger";
            this.supportedMsdpVars = [
                "HEALTH", "HEALTH_MAX",
                "MANA", "MANA_MAX",
                "MOVEMENT", "MOVEMENT_MAX",
                "EXPERIENCE_TNL", "EXPERIENCE_MAX",
                "OPPONENT_HEALTH", "OPPONENT_HEALTH_MAX",
                "OPPONENT_NAME",
                "ROOM_NAME", "ROOM_EXITS", "ROOM_VNUM", "ROOM_SECTOR",
                "EDIT_MODE", "EDIT_VNUM",
            ]
        }

        this.EvtNegotiation.handle((data) => { this.onNegotiation(data); });
    }

    private writeMsdpVar(varName: string, value: string) {
        this.writeArr([Cmd.IAC, Cmd.SB, ExtOpt.MSDP, MsdpDef.VAR].concat(
            arrayFromString(varName),
            [MsdpDef.VAL],
            arrayFromString(value),
            [Cmd.IAC, Cmd.SE]
        ));
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

        let varFuncs: {[k: string]: () => string} = {
            'IPADDRESS': () => { return this.clientIp; },
            'CLIENT_NAME': () => { return TTYPES[0]; },
            'CLIENT_VERSION': () => {
                return `${AppInfo.Version}`;
            }
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
        // console.log(CmdName(cmd), OptName(opt));

        if (cmd === Cmd.WILL) {
            if (opt === Opt.ECHO) {
                this.EvtServerEcho.fire(true);
                this.writeArr([Cmd.IAC, Cmd.DO, Opt.ECHO]);
            } else if (this.msdpEnabled && opt === ExtOpt.MSDP) {
                this.writeArr([Cmd.IAC, Cmd.DO, ExtOpt.MSDP]);
                this.writeMsdpVar("CLIENT_ID", TTYPES[0]);

                for (let varName of this.supportedMsdpVars) {
                    this.writeMsdpVar("REPORT", varName);
                }
            } else if (opt === Opt.SGA) {
                this.writeArr([Cmd.IAC, Cmd.DO, Opt.SGA]);
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
            } else if (opt === ExtOpt.MXP && UserConfig.getDef("mxpEnabled", true) === true) {
                this.writeArr([Cmd.IAC, Cmd.WILL, ExtOpt.MXP]);
            } else {
                this.writeArr([Cmd.IAC, Cmd.WONT, opt]);
            }
        } else if (cmd === Cmd.DONT) {
            if (opt === Opt.NEW_ENVIRON) {
                this.doNewEnviron = false;
            }
        } else if (cmd === Cmd.SE) {
            let sb = this.readSbArr();

            if (sb.length < 1) {
                return;
            }

            if (sb.length === 2 && sb[0] === Opt.TTYPE && sb[1] === SubNeg.SEND) {
                let ttype: string;
                if (this.ttypeIndex >= TTYPES.length) {
                    ttype = this.clientIp || "UNKNOWNIP";
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
            } else if (this.msdpEnabled && sb[0] === ExtOpt.MSDP) {
                let result = ParseMsdp(sb.slice(1));
                this.EvtMsdpVar.fire(result);
            }
        }
    }
}

export namespace ExtOpt {
    export const MSDP = 69;
    export const MCCP = 70;
    export const MSP = 90;
    export const MXP = 91;
    export const ATCP = 200;
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

export function parseNewEnvSeq(seq: number[]): [number, number, string][] {
    let rtn: [number, number, string][] = [];

    let i: number = 0;

    let firstAct: number = null;
    let act: number = null;
    let varType: number = null;
    let varName: string = null;
    
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
            varName = String.fromCharCode.apply(String, varNameArr);
        }
    }

    return rtn;
}

export type MsdpVarName = string;
type MsdpObj = {[k: string]: MsdpVal};
type MsdpArr = Array<any>;

export type MsdpVal = string | MsdpArr | MsdpObj;

function GetMsdpTable(data: Array<number>): [MsdpObj, number] {
    // skip first char which should be MSDP.TABLE_OPEN
    let i = 1;

    let rtn: MsdpVal = {};

    while (data[i] !== MsdpDef.TABLE_CLOSE) {
        let [k, v, j] = GetMsdpVar(data.slice(i));
        i += j;
        rtn[k] = v;
    }

    i += 1;
    return [rtn, i];
}


function GetMsdpArray(data: Array<number>): [MsdpArr, number] {
    // skip first char which should be MSDP.ARRAY_OPEN
    let i = 1;

    let rtn = [];
    while (data[i] !== MsdpDef.ARRAY_CLOSE) {
        let [val, j] = GetMsdpVal(data.slice(i));
        i += j;
        rtn.push(val);
    }

    i += 1;
    return [rtn, i];
}


function GetMsdpVal(data: Array<number>): [MsdpVal, number] {
    // skip first char which should be MSDP.VAL
    let i = 1;

    if (i >= data.length) {
        return ["", i];
    }

    if (data[i] === MsdpDef.ARRAY_OPEN) {
        let [rtn, j] = GetMsdpArray(data.slice(i));
        i += j;
        return [rtn, i];
    } else if (data[i] === MsdpDef.TABLE_OPEN) {
        let [rtn, j] = GetMsdpTable(data.slice(i));
        i += j;
        return [rtn, i];
    }

    // normal var
    let startInd = i;
    while (true) {
        if (i >= data.length) {
            break;
        }
        if ([MsdpDef.VAR, MsdpDef.VAL, MsdpDef.ARRAY_CLOSE, MsdpDef.TABLE_CLOSE].indexOf(data[i]) !== -1) {
            break;
        }
        i += 1;
    }
    let val = String.fromCharCode.apply(String, data.slice(startInd, i));

    return [val, i];
}

function GetMsdpVar(data: Array<number>): [MsdpVarName, MsdpVal, number] {
    // skip first char which should be MSDP.VAR
    let i = 1;

    while (data[i] !== MsdpDef.VAL) {
        i++;
    }

    let varName = String.fromCharCode.apply(String, data.slice(1, i));

    let [val, j] = GetMsdpVal(data.slice(i));

    i += j;

    return [varName, val, i];
}

export function ParseMsdp(data: Array<number>): [MsdpVarName, MsdpVal] {
    let [varName, val, i] = GetMsdpVar(data);

    return [varName, val];
}

export namespace MsdpDef {
    export const VAR = 1;
    export const VAL = 2;
    export const TABLE_OPEN = 3;
    export const TABLE_CLOSE = 4;
    export const ARRAY_OPEN = 5;
    export const ARRAY_CLOSE = 6;
}