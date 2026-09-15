/*
 * RUNG 2 INGRESS — the standing envelope becomes REACHABLE, and nothing else becomes reachable
 * with it.
 *
 * WHAT THIS FILE PROVES:
 *
 *   "A human holding Governance can now authorize, see and withdraw a standing envelope from the
 *    released `/approvals` surface. The surface states, in words, that this authorizes future acts
 *    IN ADVANCE and is not a human approving each one. It cannot issue, execute, arm, enrol or
 *    widen anything, and it introduces no second authority, no second persistence model and no
 *    second execution path. Every refusal and every unreachable state keeps its own sentence."
 *
 * The authority's own boundaries live in `rung2-standing-mutation/authority-and-firewall.ts`; the
 * persistence proofs live in `rung2-standing-mutation/issuance-postgres.ts`. This file proves the
 * INGRESS and nothing the other two already own.
 */
import assert from "node:assert/strict";
import path from "node:path";
import { readFileSync } from "node:fs";

/* The schema barrel initialises lazily; the released suites load the client first for this reason. */
import "../../src/db/client.server";

import { MACHINE_EXECUTABLE_ACTION_KINDS } from "../../src/features/governed-machine-execution/contracts";
import {
  STANDING_MUTATION_MAX_ACTS_CEILING,
  STANDING_MUTATION_MIN_INTERVAL_CEILING_MINUTES,
} from "../../src/features/standing-mutation-authority/authorize-standing-mutation.server";
import { ADMITTED_EVIDENCE_SOURCE_CLASSES } from "../../src/features/standing-mutation-authority/contracts";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
const withoutComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const codeOf = (s: string): string =>
  withoutComments(s)
    .replace(/`(?:[^`\\]|\\[\s\S])*`/g, "``")
    .replace(/"(?:[^"\\]|\\[\s\S])*"/g, '""')
    .replace(/'(?:[^'\\]|\\[\s\S])*'/g, "''");

const ACTIONS = "src/app/(dashboard)/approvals/actions.ts";
const PAGE = "src/app/(dashboard)/approvals/page.tsx";
const SURFACE = "src/components/decision-workspace/standing-mutation-envelopes.tsx";

const actionsSource = read(ACTIONS);
const actionsCode = codeOf(actionsSource);
const surfaceSource = read(SURFACE);
const surfaceCode = codeOf(surfaceSource);
const pageCode = codeOf(read(PAGE));

/* ────────────────────────────────────────────────────────────────────────────
 * 1 · IT IS ACTUALLY REACHABLE — the whole point of the phase
 * ──────────────────────────────────────────────────────────────────────────── */

/*
 * Before this phase the authority had ZERO callers: 1182 lines of tested authority that no human,
 * route or component could reach. A test that only asserted the firewalls would have passed
 * happily against that, so reachability is asserted FIRST and positively.
 */
assert.ok(
  actionsCode.includes("writeStandingMutationAuthorization"),
  "the approvals boundary must reach the released envelope writer",
);
assert.ok(
  actionsCode.includes("authorizeStandingMutationAction") &&
    actionsCode.includes("withdrawStandingMutationAction"),
  "both transitions must be exported as server actions",
);
assert.ok(
  pageCode.includes("readStandingMutations") && pageCode.includes("StandingMutationEnvelopes"),
  "the approvals page must read the envelope register and render it",
);
assert.ok(
  surfaceCode.includes("authorizeStandingMutationAction") &&
    surfaceCode.includes("withdrawStandingMutationAction"),
  "the surface must call the two server actions and nothing else",
);
/* `"use server"` must still be the first thing in the actions file. */
assert.ok(
  actionsSource.trimStart().startsWith('"use server"'),
  "the approvals action boundary must remain a server-action module",
);

/* ────────────────────────────────────────────────────────────────────────────
 * 2 · THE ISSUING FIREWALL SURVIVED THE INGRESS
 * ──────────────────────────────────────────────────────────────────────────── */

/*
 * This is the assertion the phase could most plausibly have broken. Making an authority reachable
 * is exactly when somebody wires the NEXT seam along "while they are in there" — and the next seam
 * along is the one that turns a proposal into a permit. If a browser event could reach it, the
 * envelope would be self-service.
 */
const ISSUER_MODULE = "issue-permit-under-standing-authorization";
for (const file of [ACTIONS, PAGE, SURFACE]) {
  assert.equal(
    read(file).includes(ISSUER_MODULE),
    false,
    `${file} must not reach the standing issuing seam — a human authorizes the envelope, never an act under it`,
  );
}

/*
 * NO EXECUTION, NO ARMING, NO ENROLMENT FROM THE INGRESS.
 *
 * Three different authorities a standing envelope must never be able to move: the deployment's
 * master stop, the organization's enrolment, and the executor itself. Each is a separate
 * possession-or-ceremony decision, and an envelope surface that could reach any of them would
 * collapse the split the whole RUNG design is built on.
 */
for (const banned of [
  "resolveMachineInternalExecutionEnabled",
  "writeTenantMachineExecution",
  "authorize-tenant-machine-execution",
  "executeRecordWorkAsMachine",
  "mintMachineExecutionPrincipal",
  "consumeActionPermitAsMachine",
  "scanDeliverablePermits",
]) {
  assert.equal(
    surfaceCode.includes(banned) || actionsCode.includes(banned),
    false,
    `the envelope ingress must not reach ${banned}`,
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * 3 · WHAT THE BROWSER MAY SAY IS BOUNDED AND EXHAUSTIVE
 * ──────────────────────────────────────────────────────────────────────────── */

/*
 * A forged tenant, actor or authorizer must be UNREPRESENTABLE rather than filtered. The way that
 * is true here is that no such parameter exists on either action's input type.
 */
const inputBlocks = actionsSource.slice(actionsSource.indexOf("authorizeStandingMutationAction"));
for (const forbidden of [
  "tenantId",
  "userId",
  "actorId",
  "authorizedBy",
  "governanceDecisionId",
  "permitId",
  "requestId",
  "payload",
  "digest",
  "workItemId",
  "departmentRef",
]) {
  assert.equal(
    new RegExp(`readonly\\s+${forbidden}\\b`).test(inputBlocks),
    false,
    `the standing envelope actions must have no client parameter for ${forbidden}`,
  );
}

/* The tenant is resolved server-side on BOTH actions, from the durable session. */
assert.equal(
  (inputBlocks.match(/await resolveTenantContext\(\)/g) ?? []).length,
  2,
  "both standing envelope actions must resolve the tenant server-side",
);

/* ────────────────────────────────────────────────────────────────────────────
 * 4 · WITHDRAWAL TELLS THE TRUTH ABOUT WHAT IT WITHDREW
 * ──────────────────────────────────────────────────────────────────────────── */

/*
 * The withdrawn revision is a ROW whose window, quota and cadence are NOT NULL, and the released
 * writer copies them into the Governance decision's evidence. A withdrawal that invented
 * placeholder bounds would therefore write a FALSE Governance record — a decision claiming the
 * envelope it ended had a one-millisecond window and a quota of one.
 *
 * So the bounds are re-read from the effective revision, server-side, and the browser supplies
 * none of them.
 */
const withdrawBlock = actionsSource.slice(actionsSource.indexOf("export async function withdrawStandingMutationAction"));
assert.ok(
  withdrawBlock.includes("readStandingMutations"),
  "withdrawal must re-read the effective envelope rather than accept or invent its bounds",
);
for (const forbidden of ["notBefore", "notAfter", "maxActs", "minIntervalMinutes", "actionKind"]) {
  assert.equal(
    new RegExp(`readonly\\s+${forbidden}\\b`).test(withdrawBlock.slice(0, withdrawBlock.indexOf("): Promise"))),
    false,
    `withdrawal must not take ${forbidden} from the browser — it is re-read from the row`,
  );
}
/* And the placeholder shape that would have produced the false record must not be present. */
assert.equal(
  /new Date\(\s*0\s*\)/.test(codeOf(withdrawBlock)),
  false,
  "withdrawal must not pass a placeholder instant",
);

/* ────────────────────────────────────────────────────────────────────────────
 * 5 · THE SEMANTICS ARE STATED, NOT LEFT TO BE INFERRED
 * ──────────────────────────────────────────────────────────────────────────── */

/*
 * The single most misleading thing this product could do is render an advance authorization as
 * though it were an ordinary one. The claim and its DENIAL must both appear, and the denial must
 * be adjacent to the claim rather than merely present somewhere on the page — CGO-2 established
 * that adjacency rule and this follows it.
 */
const rendered = surfaceSource.slice(surfaceSource.indexOf("export function StandingMutationEnvelopes"));
assert.ok(
  /authorizes future acts IN ADVANCE/i.test(rendered),
  "the surface must state that this authorizes future acts in advance",
);
assert.ok(
  /does\s*<span className="font-medium">not<\/span>\s*mean a human approved each act/i.test(
    rendered.replace(/\s+/g, " "),
  ),
  "the denial of per-act human approval must be rendered, adjacent to the claim",
);
assert.ok(
  /will carry your name as the authorizer/i.test(rendered),
  "the surface must say whose name appears on the permits it will produce",
);
assert.ok(
  /you will not have read them first/i.test(rendered),
  "and must say that the signer will not have read those acts",
);
/* It must also state what signing does NOT do, in the same breath. */
for (const claim of [
  "mints no permit",
  "records no work",
  "reaches no provider",
  "cannot arm this deployment",
]) {
  assert.ok(rendered.includes(claim), `the surface must state that an envelope ${claim}`);
}

/* ────────────────────────────────────────────────────────────────────────────
 * 6 · THE ACTION KIND IS SHOWN, NEVER CHOSEN, AND NEVER WIDENED
 * ──────────────────────────────────────────────────────────────────────────── */

assert.deepEqual([...MACHINE_EXECUTABLE_ACTION_KINDS], ["record-work"]);

/*
 * There is exactly ONE offered kind and it is a constant, not a list the surface builds. A
 * dropdown here would imply a choice the system does not offer and would be the first place a
 * widening could be smuggled in.
 */
assert.ok(
  /const OFFERED_ACTION_KIND = "record-work" as const;/.test(surfaceSource),
  "the offered kind must be a single frozen constant",
);
assert.equal(
  /<option[^>]*value=\{[^}]*actionKind/i.test(surfaceSource),
  false,
  "the action kind must never be a selectable option",
);
/* And the surface must SAY that it cannot add to the set. */
assert.ok(
  /cannot add to it|cannot widen that set/i.test(surfaceSource),
  "the surface must state that it cannot widen the frozen action set",
);

/* ────────────────────────────────────────────────────────────────────────────
 * 7 · THE CEILINGS RENDERED ARE THE RELEASED ONES
 * ──────────────────────────────────────────────────────────────────────────── */

/*
 * A surface that restated `50` and `10080` would drift the moment the schema moved. It is handed
 * the released constants instead, so the form's own bounds and the database CHECK cannot disagree.
 */
assert.ok(
  pageCode.includes("STANDING_MUTATION_MAX_ACTS_CEILING") &&
    pageCode.includes("STANDING_MUTATION_MIN_INTERVAL_CEILING_MINUTES"),
  "the page must pass the released ceilings, never literals",
);
for (const literal of [String(STANDING_MUTATION_MAX_ACTS_CEILING), String(STANDING_MUTATION_MIN_INTERVAL_CEILING_MINUTES)]) {
  assert.equal(
    new RegExp(`max=\\{${literal}\\}`).test(surfaceSource),
    false,
    `the surface must not hard-code the ceiling ${literal}`,
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * 8 · SEVEN UNREACHABLE FACTS, SEVEN SENTENCES — NO COLLAPSE
 * ──────────────────────────────────────────────────────────────────────────── */

/*
 * "You withdrew this", "the window has not opened", "the window closed", "the quota is spent",
 * "the agent is out of service", "your organization is not enrolled" and "an operator stopped
 * everything" call for seven different human responses. AMA-4 had to repair exactly this collapse
 * at its own gate, so the wordings are asserted DISTINCT rather than merely present.
 */
const unreachableBlock = surfaceSource.slice(
  surfaceSource.indexOf("const UNREACHABLE_WORDING"),
  surfaceSource.indexOf("const REFUSAL_WORDING"),
);
const unreachableWordings = [...unreachableBlock.matchAll(/"((?:[^"\\]|\\.)*)"/g)]
  .map((m) => m[1])
  /* > 40 keeps the VALUES and drops the keys: the longest key is `root-control-disabled` (21). */
  .filter((s) => s.length > 40);
assert.equal(
  unreachableWordings.length,
  7,
  `every unreachable reason needs its own sentence, found ${unreachableWordings.length}`,
);
assert.equal(
  new Set(unreachableWordings).size,
  7,
  "no two unreachable reasons may share a sentence",
);
/* The deployment-wide stop must be described as deployment-wide, not as this envelope's problem. */
assert.ok(
  /whole deployment/i.test(unreachableBlock),
  "the root control's refusal must say it is deployment-wide",
);

/* Every write refusal likewise has its own sentence, and none claims anything was written. */
const refusalBlock = surfaceSource.slice(
  surfaceSource.indexOf("const REFUSAL_WORDING"),
  surfaceSource.indexOf("type Outcome"),
);
const refusalWordings = [...refusalBlock.matchAll(/"((?:[^"\\]|\\.)*)"/g)]
  .map((m) => m[1])
  /* Same threshold, same reason: the longest key here is `stale-authorization-revision` (28). */
  .filter((s) => s.length > 40);
assert.equal(
  new Set(refusalWordings).size,
  refusalWordings.length,
  "no two write refusals may share a sentence",
);
/* An outage must be named as an outage, never as a refusal of authority. */
assert.ok(
  /This is an outage, not a refusal/.test(refusalBlock),
  "persistence-unavailable must be distinguished from a refusal",
);

/* ────────────────────────────────────────────────────────────────────────────
 * 9 · THE EVIDENCE REQUIREMENT IS TOLD TO THE HUMAN WHO SIGNS
 * ──────────────────────────────────────────────────────────────────────────── */

/*
 * The envelope authorizes a class of EVIDENCED acts, not a quota to spend freely. A human choosing
 * "5 acts" who has not been told that each one still needs a stored provider observation has been
 * shown a larger grant than the one they are making.
 */
assert.deepEqual([...ADMITTED_EVIDENCE_SOURCE_CLASSES], ["provider-observations"]);
assert.ok(
  /a stored provider observation/i.test(surfaceSource),
  "the surface must tell the signer what evidence each act will still require",
);

/* ────────────────────────────────────────────────────────────────────────────
 * 10 · NO SECOND AUTHORITY, NO SECOND PERSISTENCE, NO SECOND EXECUTION PATH
 * ──────────────────────────────────────────────────────────────────────────── */

/*
 * An ingress phase must EXPOSE what exists. If it grew its own table, its own query or its own
 * decision writer, it would have built a second authority wearing the first one's name.
 */
for (const banned of ["drizzle-orm", "getControlPlaneDb", "db.insert", "db.transaction", "writeGovernanceDecision"]) {
  assert.equal(
    actionsCode.includes(banned) || surfaceCode.includes(banned),
    false,
    `the ingress must not carry its own persistence: ${banned}`,
  );
}
/* The surface is a client component and must therefore hold no server-only import. */
assert.ok(surfaceSource.trimStart().startsWith('"use client"'));
for (const banned of ["client.server", "resolveTenantContext", "authorize-standing-mutation.server"]) {
  assert.equal(
    new RegExp(`^\\s*import[^\\n]*${banned.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "m").test(
      surfaceSource.replace(/^import type[^\n]*$/gm, ""),
    ),
    false,
    `a client component must not import ${banned}`,
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * 11 · THE REGISTER'S ABSENCE IS EXPLAINED, NEVER RENDERED AS EMPTY
 * ──────────────────────────────────────────────────────────────────────────── */

/*
 * "No envelope has ever been authorized" and "we could not find out" are different truths. The page
 * passes the read's own availability rather than an inferred one, and the surface renders a
 * different sentence for each.
 */
assert.ok(
  /connected=\{standing\.status === "read"\}/.test(read(PAGE)),
  "availability must come from the read itself, never from whether rows exist",
);
assert.ok(
  /could not be read/i.test(surfaceSource) && /unknown rather than empty/i.test(surfaceSource),
  "an unreadable register must be rendered as unknown, not as empty",
);
assert.ok(
  /No standing envelope has ever been authorized/.test(surfaceSource),
  "and a genuinely empty register must say so in its own words",
);

/* ────────────────────────────────────────────────────────────────────────────
 * 12 · ONLY IN-SERVICE AGENTS ARE OFFERED
 * ──────────────────────────────────────────────────────────────────────────── */

/*
 * An envelope naming a retired agent is refused by the writer and would authorize nothing, so
 * offering one would only manufacture a refusal the human cannot act on.
 */
assert.ok(
  /\.filter\(\(identity\) => identity\.inService\)/.test(read(PAGE)),
  "the agent picker must offer in-service agents only",
);

console.log("PASS rung2 ingress — the standing envelope is reachable, and nothing else became reachable with it");
