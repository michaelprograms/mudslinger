import { parseNewEnvSeq, NewEnv, MsdpDef, MsdpVal, ParseMsdp } from "../src/ts/telnetClient";

export function test() {

QUnit.module("NEW-ENVIRON");

/* 
Per: https://tintin.mudhalla.net/rfc/rfc1572/

    IAC SB NEW-ENVIRON SEND IAC SE
    IAC SB NEW-ENVIRON SEND VAR IAC SE
    IAC SB NEW-ENVIRON SEND USERVAR IAC SE
    IAC SB NEW-ENVIRON SEND VAR USERVAR IAC SE
*/

QUnit.test("parse send all", (assert: Assert) => {
    let input = [NewEnv.SEND];
    let exp: [number, number, string][] = [
        [NewEnv.SEND, null, ""],
    ]

    let result = parseNewEnvSeq(input);
    assert.deepEqual(result, exp);
});

QUnit.test("parse send all var", (assert: Assert) => {
    let input = [NewEnv.SEND, NewEnv.VAR];
    let exp: [number, number, string][] = [
        [NewEnv.SEND, NewEnv.VAR, ""],
    ]

    let result = parseNewEnvSeq(input);
    assert.deepEqual(result, exp);
});

QUnit.test("parse send all uservar", (assert: Assert) => {
    let input = [NewEnv.SEND, NewEnv.USERVAR];
    let exp: [number, number, string][] = [
        [NewEnv.SEND, NewEnv.USERVAR, ""],
    ]

    let result = parseNewEnvSeq(input);
    assert.deepEqual(result, exp);
});

QUnit.test("parse send all var and uservar", (assert: Assert) => {
    let input = [NewEnv.SEND, NewEnv.USERVAR, NewEnv.VAR];
    let exp: [number, number, string][] = [
        [NewEnv.SEND, NewEnv.USERVAR, ""],
        [NewEnv.SEND, NewEnv.VAR, ""],
    ]

    let result = parseNewEnvSeq(input);
    assert.deepEqual(result, exp);
});


/*
Per: https://tintin.mudhalla.net/protocols/mnes/

    server - IAC   SB NEW-ENVIRON SEND VAR "CLIENT_NAME" SEND VAR "CLIENT_VERSION" IAC SE
    server - IAC   SB NEW-ENVIRON SEND VAR "CHARSET" IAC SE
*/
QUnit.test("parse send single var", (assert: Assert) => {
    let input = [NewEnv.SEND, NewEnv.VAR].concat(arrayFromString("CHARSET"));
    let exp: [number, number, string][] = [
        [NewEnv.SEND, NewEnv.VAR, "CHARSET"],
    ];

    let result = parseNewEnvSeq(input);
    assert.deepEqual(result, exp);
});

QUnit.test("parse send single uservar", (assert: Assert) => {
    let input = [NewEnv.SEND, NewEnv.USERVAR].concat(arrayFromString("CHARSET"));
    let exp: [number, number, string][] = [
        [NewEnv.SEND, NewEnv.USERVAR, "CHARSET"],
    ];

    let result = parseNewEnvSeq(input);
    assert.deepEqual(result, exp);
});

QUnit.test("parse send multi var (repeated send)", (assert: Assert) => {
    let input = [NewEnv.SEND, NewEnv.VAR].concat(
        arrayFromString("CLIENT_NAME"),
        [NewEnv.SEND, NewEnv.VAR],
        arrayFromString("CLIENT_VERSION"));
    let exp: [number, number, string][] = [
        [NewEnv.SEND, NewEnv.VAR, "CLIENT_NAME"],
        [NewEnv.SEND, NewEnv.VAR, "CLIENT_VERSION"],
    ];

    let result = parseNewEnvSeq(input);
    assert.deepEqual(result, exp);
});

QUnit.test("parse send multi var (single send)", (assert: Assert) => {
    let input = [NewEnv.SEND, NewEnv.VAR].concat(
        arrayFromString("CLIENT_NAME"),
        [NewEnv.VAR],
        arrayFromString("CLIENT_VERSION"));
    let exp: [number, number, string][] = [
        [NewEnv.SEND, NewEnv.VAR, "CLIENT_NAME"],
        [NewEnv.SEND, NewEnv.VAR, "CLIENT_VERSION"],
    ];

    let result = parseNewEnvSeq(input);
    assert.deepEqual(result, exp);
});

/*
per: https://tintin.mudhalla.net/rfc/rfc1572/

    SEND VAR "USER" VAR "ACCT" VAR USERVAR
    [ The server has now explicitly asked for the USER and ACCT
         variables, the default set of well known environment variables,
         and the default set of user defined variables.  Note that the
         client includes the USER information twice; once because it was
         explicitly asked for, and once because it is part of the
         default environment.  ]
 */

 QUnit.test("parse send example 1", (assert: Assert) => {
    let input = [NewEnv.SEND, NewEnv.VAR].concat(
        arrayFromString("USER"),
        [NewEnv.VAR],
        arrayFromString("ACCT"),
        [NewEnv.VAR],
        [NewEnv.USERVAR]);
    let exp: [number, number, string][] = [
        [NewEnv.SEND, NewEnv.VAR, "USER"],
        [NewEnv.SEND, NewEnv.VAR, "ACCT"],
        [NewEnv.SEND, NewEnv.VAR, ""],
        [NewEnv.SEND, NewEnv.USERVAR, ""],
    ];

    let result = parseNewEnvSeq(input);
    assert.deepEqual(result, exp);
});

QUnit.module("MSDP");

let chr = String.fromCharCode;
let VAR = chr(MsdpDef.VAR);
let VAL = chr(MsdpDef.VAL);
let ARRAY_OPEN = chr(MsdpDef.ARRAY_OPEN)
let ARRAY_CLOSE = chr(MsdpDef.ARRAY_CLOSE)
let TABLE_OPEN = chr(MsdpDef.TABLE_OPEN)
let TABLE_CLOSE = chr(MsdpDef.TABLE_CLOSE)

function ToBytes(data: string) {
    let rtn: Array<number> = [];
    for (let i = 0; i < data.length; i++) {
        rtn.push(data.charCodeAt(i));
    }

    return rtn;
}

QUnit.test("SERVER_ID", (assert: Assert) => {
    let data = `${VAR}SERVER_ID${VAL}Aarchon MUD`;
    let bytes = ToBytes(data);
    let exp: MsdpVal = ["SERVER_ID", "Aarchon MUD"];
    let result = ParseMsdp(bytes);
    assert.deepEqual(result, exp);
});

QUnit.test("OPPONENT_NAME", (assert: Assert) => {
    let data = `${VAR}OPPONENT_NAME${VAL}`;
    let bytes = ToBytes(data);
    let exp: MsdpVal = ["OPPONENT_NAME", ""];
    let result = ParseMsdp(bytes);
    assert.deepEqual(result, exp);
});

QUnit.test("AFFECTS", (assert: Assert) => {
    let data = `${VAR}AFFECTS${VAL}${TABLE_OPEN}${VAR}fade${VAL}13${VAR}sanctuary${VAL}13${VAR}shield${VAL}29${TABLE_CLOSE}${VAR}MANA${VAL}14144`;
        let bytes = ToBytes(data);
        let exp: MsdpVal = ["AFFECTS", {
            fade: "13",
            sanctuary: "13",
            shield: "29"
        }];
        let result = ParseMsdp(bytes);
    assert.deepEqual(result, exp);
});

QUnit.test("ROOM_EXITS", (assert: Assert) => {
    let data = `${VAR}ROOM_EXITS${VAL}${TABLE_OPEN}${VAR}north${VAL}O${VAR}down${VAL}O${TABLE_CLOSE}`;
    let bytes = ToBytes(data);
    let exp: MsdpVal = ["ROOM_EXITS", {
        north: "O",
        down: "O"
    }];
    let result = ParseMsdp(bytes);
    assert.deepEqual(result, exp);
});

QUnit.test("GROUP_INFO", (assert: Assert) => {
    let data = `${VAR}GROUP_INFO${VAL}${TABLE_OPEN}${VAR}leader${VAL}Vodur${VAR}members${VAL}` +
                   `${ARRAY_OPEN}${VAL}${TABLE_OPEN}${VAR}name${VAL}Vodur` +
                   `${TABLE_CLOSE}${ARRAY_CLOSE}${TABLE_CLOSE}`;
    let bytes = ToBytes(data);
    let exp: MsdpVal = ["GROUP_INFO", {
        leader: "Vodur",
        members: [
            {
                name: "Vodur"
            }
        ]
    }];
    let result = ParseMsdp(bytes);
    assert.deepEqual(result, exp);
});

};

function arrayFromString(str: string): number[] {
    let arr = new Array(str.length);
    for (let i = 0; i < arr.length; i++) {
        arr[i] = str.charCodeAt(i);
    }

    return arr;
}