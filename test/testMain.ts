import * as testTelnetClient from "./testTelnetClient";
import * as testJsScript from "./testJsScript";
import * as testAliasManager from "./testAliasManager";
import * as testTriggerManager from "./testTriggerManager";
import * as testTransport from "./testTransport";

export namespace test {
    testTriggerManager.test();
    testAliasManager.test();
    testTelnetClient.test();
    testJsScript.test();
    testTransport.test();
} // namespace test
