// Test-only fixture location follows the current isolated development stage.
// Never resolve against any archived or accepted release folder.
// @ts-expect-error Client TS project intentionally omits Node type declarations.
import {resolve} from "node:path";
declare const process:{cwd():string};
export const fixtureDir=():string=>resolve(process.cwd(),"test-fixtures/Acceptance_Fixtures");
