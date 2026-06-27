import { describe, it, expect } from 'vitest';
import { parseNewEnvSeq, NewEnv } from "./telnet";

function arrayFromString(str: string): number[] {
    return Array.from(str).map(c => c.charCodeAt(0));
}

describe("NEW-ENVIRON", () => {
    it("parse send all", () => {
        expect(parseNewEnvSeq([NewEnv.SEND])).toEqual([[NewEnv.SEND, null, ""]]);
    });

    it("parse send all var", () => {
        expect(parseNewEnvSeq([NewEnv.SEND, NewEnv.VAR])).toEqual([[NewEnv.SEND, NewEnv.VAR, ""]]);
    });

    it("parse send all uservar", () => {
        expect(parseNewEnvSeq([NewEnv.SEND, NewEnv.USERVAR])).toEqual([[NewEnv.SEND, NewEnv.USERVAR, ""]]);
    });

    it("parse send all var and uservar", () => {
        expect(parseNewEnvSeq([NewEnv.SEND, NewEnv.USERVAR, NewEnv.VAR])).toEqual([
            [NewEnv.SEND, NewEnv.USERVAR, ""],
            [NewEnv.SEND, NewEnv.VAR, ""],
        ]);
    });

    it("parse send single var", () => {
        const input = [NewEnv.SEND, NewEnv.VAR].concat(arrayFromString("CHARSET"));
        expect(parseNewEnvSeq(input)).toEqual([[NewEnv.SEND, NewEnv.VAR, "CHARSET"]]);
    });

    it("parse send single uservar", () => {
        const input = [NewEnv.SEND, NewEnv.USERVAR].concat(arrayFromString("CHARSET"));
        expect(parseNewEnvSeq(input)).toEqual([[NewEnv.SEND, NewEnv.USERVAR, "CHARSET"]]);
    });

    it("parse send multi var (repeated send)", () => {
        const input = [NewEnv.SEND, NewEnv.VAR].concat(
            arrayFromString("CLIENT_NAME"),
            [NewEnv.SEND, NewEnv.VAR],
            arrayFromString("CLIENT_VERSION"));
        expect(parseNewEnvSeq(input)).toEqual([
            [NewEnv.SEND, NewEnv.VAR, "CLIENT_NAME"],
            [NewEnv.SEND, NewEnv.VAR, "CLIENT_VERSION"],
        ]);
    });

    it("parse send multi var (single send)", () => {
        const input = [NewEnv.SEND, NewEnv.VAR].concat(
            arrayFromString("CLIENT_NAME"),
            [NewEnv.VAR],
            arrayFromString("CLIENT_VERSION"));
        expect(parseNewEnvSeq(input)).toEqual([
            [NewEnv.SEND, NewEnv.VAR, "CLIENT_NAME"],
            [NewEnv.SEND, NewEnv.VAR, "CLIENT_VERSION"],
        ]);
    });

    it("parse send example 1", () => {
        const input = [NewEnv.SEND, NewEnv.VAR].concat(
            arrayFromString("USER"),
            [NewEnv.VAR],
            arrayFromString("ACCT"),
            [NewEnv.VAR],
            [NewEnv.USERVAR]);
        expect(parseNewEnvSeq(input)).toEqual([
            [NewEnv.SEND, NewEnv.VAR, "USER"],
            [NewEnv.SEND, NewEnv.VAR, "ACCT"],
            [NewEnv.SEND, NewEnv.VAR, ""],
            [NewEnv.SEND, NewEnv.USERVAR, ""],
        ]);
    });
});

