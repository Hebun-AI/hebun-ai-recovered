/*
 * HEBY-EXECUTE-AUTHORIZED-1 — what the Heby control may do, pinned, with in-memory bite-proofs.
 *
 *   C1 offered only after a human approval minted a still-active permit, for record-work or
 *      set-work-declared-state — never pending, rejected, spent, expired, revoked, a send or a placement
 *   C2 it reaches exactly the two named server actions Approvals uses, and no decider, revoker, send
 *      executor or model seam; the permit id is the only input
 *   C3 a human click behind a second, explicit confirmation; nothing runs on render or on a timer
 *   C4 it states no outcome of its own: an executed act triggers the caller's re-read; a refusal says
 *      the authorization was not used; an unreachable server says the outcome is unknown
 *   C5 the server actions it calls still resolve the tenant from the session (unchanged)
 *   C6 both Heby surfaces mount it beside the lifecycle they re-read
 *   B  each mutation re-opens one hole; the checks must catch it (source text in memory only)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { codeOf } from "../helpers/durable-write-detector";
import { executableFromHeby, HEBY_EXECUTABLE_KINDS } from "../../src/components/layout/heby/heby-execute-authorized";
import type { ActionRequestLifecycleView } from "../../src/features/action-authorization/read-action-authorizations.server";

const read = (f: string) => readFileSync(path.join(process.cwd(), f), "utf8");
const CONTROL = "src/components/layout/heby/heby-execute-authorized.tsx";
const APPROVALS = "src/app/(dashboard)/approvals/actions.ts";
const MY_REQUESTS = "src/components/layout/heby/heby-my-requests.tsx";
const AFFORDANCE = "src/components/layout/heby/heby-origination-affordance.tsx";

/* ── C1 · when it is offered ── */
const T = "2026-10-27T10:00:00.000Z";
const view = (over: Partial<ActionRequestLifecycleView>): ActionRequestLifecycleView => ({
  requestId: "r", actionKind: "record-work", label: "l", proposedByActorType: "human", proposedAt: T,
  decision: { status: "approved", at: T, standing: false },
  permit: { permitId: "p", state: "active", expiresAt: T, consumedAt: null, revokedAt: null },
  execution: null, workOutcome: null, ...over,
});
assert.deepEqual([...HEBY_EXECUTABLE_KINDS].sort(), ["record-work", "set-work-declared-state"], "C1: exactly two kinds");
assert.equal(executableFromHeby(view({})), true, "C1 record-work, approved, active");
assert.equal(executableFromHeby(view({ actionKind: "set-work-declared-state" })), true, "C1 state change");
assert.equal(executableFromHeby(view({ decision: { status: "pending" }, permit: null })), false, "C1 pending");
assert.equal(executableFromHeby(view({ decision: { status: "rejected", at: T } })), false, "C1 rejected");
for (const state of ["consumed", "expired", "revoked", "none"] as const) {
  assert.equal(executableFromHeby(view({ permit: { permitId: "p", state, expiresAt: T, consumedAt: null, revokedAt: null } })), false, `C1 ${state}`);
}
assert.equal(executableFromHeby(view({ permit: null })), false, "C1 no permit");
for (const kind of ["send", "place-human", "publish-instagram-media", "publish-youtube-video"]) {
  assert.equal(executableFromHeby(view({ actionKind: kind })), false, `C1 ${kind} is never performed from Heby`);
}

function checkSource(src: string): void {
  const code = codeOf(src);
  /* C2 */
  const imports = [...code.matchAll(/^import\s+(?!type)[^;]*?from\s+"([^"]+)"/gm)].map((m) => m[1]!).sort();
  assert.deepEqual(imports, ["@/app/(dashboard)/approvals/actions", "@/features/heby-action-inlet/contracts", "react"], "C2: value imports");
  const fromApprovals = code.slice(code.indexOf("import {"), code.indexOf('} from "@/app/(dashboard)/approvals/actions"'));
  assert.deepEqual(
    [...fromApprovals.matchAll(/\b(\w+Action)\b/g)].map((m) => m[1]).sort(),
    ["executeGovernedInternalActionAction", "executeGovernedWorkStateChangeAction"],
    "C2: only the two named internal acts",
  );
  assert.doesNotMatch(code, /approveActionRequest|rejectActionRequest|revoke[A-Z]\w*|executeAuthorizedActionAction|executeGovernedPlacementAction|heby-model|heby-answer|agent-origination/, "C2: no decision, revocation, send, placement or model");
  assert.match(code, /executeGovernedWorkStateChangeAction\(\{ permitId \}\)/, "C2: only the permit id");
  assert.match(code, /executeGovernedInternalActionAction\(\{ permitId \}\)/, "C2: only the permit id");
  assert.match(code, /const permitId = view\.permit\.permitId;/, "C2: the id the lifecycle read named");
  assert.match(code, /if \(!executableFromHeby\(view\) \|\| view\.permit === null\) return null;/, "C1: rendered only when offered");
  assert.match(code, /view\.decision\.status === "approved" && view\.permit\?\.state === "active" && HEBY_EXECUTABLE_KINDS\.includes\(view\.actionKind\)/, "C1: the rule");
  /* C3 */
  assert.doesNotMatch(code, /useEffect|useLayoutEffect|setInterval|setTimeout/, "C3: nothing runs on render or on a timer");
  assert.equal((code.match(/onClick=\{perform\}/g) ?? []).length, 1, "C3: performed from one control");
  assert.ok(code.indexOf("onClick={perform}") > code.indexOf("{confirming ? ("), "C3: and only inside the confirmation");
  assert.match(code, /onClick=\{\(\) => setConfirming\(true\)\}/, "C3: the first click only asks");
  /* C4 */
  assert.match(code, /if \(result\.status === "executed"\) \{\s*setRefusal\(null\);\s*setConfirming\(false\);\s*onExecuted\(\);\s*return;/, "C4: executed → the caller re-reads");
  assert.doesNotMatch(code, /\bExecuted\b|\bDelivered\b|was recorded|succeeded|\bDone\b/, "C4: no success sentence of its own");
  assert.match(code, /The authorization was not used\./, "C4: a refusal says so");
  assert.match(code, /Whether it was performed is unknown/, "C4: an unreachable server is unknown, not failure or success");
}
checkSource(read(CONTROL));

/* ── C5 · the server actions are the released ones ── */
const approvals = codeOf(read(APPROVALS));
assert.match(approvals, /export async function executeGovernedInternalActionAction\([\s\S]*?const tenant = await resolveTenantContext\(\);\s*const result = await executeRecordWork\(tenant, \{\s*permitId: String\(input\?\.permitId \?\? ""\),/, "C5 record-work");
assert.match(approvals, /export async function executeGovernedWorkStateChangeAction\([\s\S]*?const tenant = await resolveTenantContext\(\);\s*const result = await executeSetWorkDeclaredState\(tenant, \{\s*permitId: String\(input\?\.permitId \?\? ""\),/, "C5 state change");

/* ── C6 · mounted beside the lifecycle each surface re-reads ── */
assert.match(read(MY_REQUESTS), /<HebyExecuteAuthorized view=\{item\} onExecuted=\{load\} \/>/, "C6 Your requests re-reads the list");
assert.match(read(AFFORDANCE), /<HebyExecuteAuthorized view=\{state\.lifecycle\.lifecycle\} onExecuted=\{\(\) => readLifecycle\(proposed\)\} \/>/, "C6 the proposal check re-reads its lifecycle");

/* ── B · bite-proofs ── */
const source = read(CONTROL);
const bites: [string, string, string][] = [
  ["B1 a send executor reached", "  executeGovernedWorkStateChangeAction,\n} from", "  executeGovernedWorkStateChangeAction,\n  executeAuthorizedActionAction,\n} from"],
  ["B2 offered before approval", 'view.decision.status === "approved" && view.permit?.state === "active"', 'view.permit?.state !== "revoked"'],
  ["B3 no confirmation", "onClick={() => setConfirming(true)}", "onClick={perform}"],
  ["B4 runs on render", 'import { useState, useTransition } from "react";', 'import { useEffect, useState, useTransition } from "react";'],
  ["B5 claims success itself", "setRefusal(null);", 'setRefusal("Executed.");'],
  ["B6 a refusal not admitted", " The authorization was not used.", ""],
];
for (const [label, from, to] of bites) {
  assert.equal(source.split(from).length - 1, 1, `${label}: anchor found once`);
  assert.throws(() => checkSource(source.replace(from, to)), `${label}: caught`);
}

console.log(`PASS heby-execute-authorized-1 contract (C1–C6, ${bites.length}/${bites.length} bites)`);
