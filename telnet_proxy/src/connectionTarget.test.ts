import * as assert from "assert";
import { getMudTarget } from "./connectionTarget";

// Returns the configured host/port
let t = getMudTarget({ mudHost: "127.0.0.1", mudPort: 4000 });
assert.strictEqual(t.host, "127.0.0.1");
assert.strictEqual(t.port, 4000);

// Throws when host is missing
assert.throws(() => getMudTarget({ mudPort: 4000 }), /mudHost/);

// Throws when port is missing
assert.throws(() => getMudTarget({ mudHost: "127.0.0.1" }), /mudPort/);

console.log("connectionTarget tests passed");
