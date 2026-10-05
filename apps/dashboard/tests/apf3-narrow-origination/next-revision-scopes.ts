/*
 * APF-3 — a new tenant authorization revision keeps every scope in force and adds only the new ones.
 */
import assert from "node:assert/strict";
import { nextRevisionScopes } from "../../scripts/lib/tenant-data-use-scopes";

const ASSISTANCE = (["conversation", "knowledge", "work-artifact"] as const).map((dataClass) => ({ purpose: "assistance" as const, dataClass }));
const ORIGINATION = (["conversation", "organization"] as const).map((dataClass) => ({ purpose: "agent-origination" as const, dataClass }));

/* hebun's intended revision 2: the three assistance scopes survive, the two origination scopes are added. */
assert.deepEqual(nextRevisionScopes(ASSISTANCE, ORIGINATION), [...ASSISTANCE, ...ORIGINATION], "assistance kept, origination added");
/* Re-running assistance after origination withdraws nothing. */
assert.deepEqual(nextRevisionScopes([...ASSISTANCE, ...ORIGINATION], ASSISTANCE), [...ASSISTANCE, ...ORIGINATION], "nothing withdrawn by a re-run");
/* Nothing in force: only the addition. */
assert.deepEqual(nextRevisionScopes([], ORIGINATION), ORIGINATION);
/* Same data class, different purpose, is a different scope. */
assert.equal(nextRevisionScopes([ASSISTANCE[0]!], [ORIGINATION[0]!]).length, 2, "assistance×conversation ≠ agent-origination×conversation");

console.log("PASS apf3-narrow-origination next-revision-scopes");
