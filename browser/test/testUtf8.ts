import { utf8decode } from "../src/ts/util";

export function test() {

QUnit.module("utf8 decode");

QUnit.test("ascii", (assert: Assert) => {
    let expected = "";
    let arr = [];
    for (let i = 0; i < 128; ++i) {
        expected += String.fromCharCode(i);
        arr.push(i);
    }

    let o = utf8decode(new Uint8Array(arr));
    assert.strictEqual(o.result, expected);
    assert.strictEqual(o.partial, null);

});

QUnit.test("2 byte", (assert: Assert) => {

    let expected = "¡¢£¤ÿ";
    let arr = [
        0xc2, 0xa1, // ¡
        0xc2, 0xa2, // ¢
        0xc2, 0xa3, // £
        0xc2, 0xa4, // ¤
        0xc3, 0xbf, // ÿ
    ];

    let o = utf8decode(new Uint8Array(arr));
    assert.strictEqual(o.result, expected);
    assert.strictEqual(o.partial, null);
});

QUnit.test("3 byte", (assert: Assert) => {
    let expected = "ࢢࢬऄ";
    let arr = [
        0xe0, 0xa2, 0xa2, // ࢢ
        0xe0, 0xa2, 0xac, // ࢬ
        0xe0, 0xa4, 0x84, // ऄ
    ];

    let o = utf8decode(new Uint8Array(arr));
    assert.strictEqual(o.result, expected);
    assert.strictEqual(o.partial, null);
});

QUnit.test("4 byte", (assert: Assert) => {
    let expected = "𐌰𐌸𐍊";
    let arr = [
        0xf0, 0x90, 0x8c, 0xb0, // 𐌰
        0xf0, 0x90, 0x8c, 0xb8, // 𐌸
        0xf0, 0x90, 0x8d, 0x8a, // 𐍊
    ];

    let o = utf8decode(new Uint8Array(arr));
    assert.strictEqual(o.result, expected);
    assert.strictEqual(o.partial, null);
});

// TODO
// QUnit.test("invalid 1", (assert: Assert) => {
//     let arr = [
//         0xc2, 0x01,
//     ];

//     let o = utf8decode(new Uint8Array(arr));
//     console.log(o);
//     console.log(o.result.length);
//     assert.strictEqual(o.result, "");
// });

QUnit.test("partial 1", (assert: Assert) => {
    let expected = "";
    let arr = [
        0xf0, 0x90, 0x8c
    ];

    let o = utf8decode(new Uint8Array(arr));
    assert.strictEqual(o.result, expected);
    assert.deepEqual(o.partial, new Uint8Array(arr));
});

};
