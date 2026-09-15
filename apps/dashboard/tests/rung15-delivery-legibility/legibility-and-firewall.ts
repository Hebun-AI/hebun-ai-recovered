/*
 * DELIVERY LEGIBILITY — what the authorizing human is told about automatic delivery, and what the
 * surface still refuses to claim.
 *
 * WHAT THIS FILE PROVES:
 *
 *   "Delivery legibility is DERIVED, never stored. It reuses `derivePermitState` rather than
 *    re-deciding what expired means. It is silent about permits automatic delivery was never a
 *    question for. It never says which door spent a permit, and never implies a delivery was
 *    attempted. Revoked, expired and refused stay three different facts. The authorizing human may
 *    choose a lifetime, and every lifetime offered is one the server's own clamp grants unchanged."
 *
 * The derivation is PURE, so it is tested directly rather than through a database. The firewalls
 * are source-level because the properties are structural: absence of persistence, absence of a
 * second expiry rule, and absence of a claim.
 */
import assert from "node:assert/strict";
import path from "node:path";
import { readFileSync } from "node:fs";

/* The schema barrel initialises lazily; the released suites load the client first for this reason. */
import "../../src/db/client.server";

import {
  derivePermitDeliveryBand,
  isMachineDeliverableShape,
  permitDeliverySentence,
  type DeliverablePermitState,
  type PermitDeliveryBand,
} from "../../src/features/action-authorization/delivery-legibility";
import {
  derivePermitState,
  type PermitDisplayState,
} from "../../src/features/action-authorization/read-action-authorizations.server";
import {
  PERMIT_DEFAULT_TTL_SECONDS,
  PERMIT_MAX_TTL_SECONDS,
  PERMIT_MIN_TTL_SECONDS,
  PERMIT_TTL_CHOICES,
} from "../../src/features/action-authorization/contracts";
import { clampTtlSeconds } from "../../src/features/action-authorization/decide-action-request.server";
import { MACHINE_EXECUTABLE_ACTION_KINDS } from "../../src/features/governed-machine-execution/contracts";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
const withoutComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
/** Comment-stripped AND string-literal-stripped: honest prose in a sentence cannot satisfy a ban. */
const codeOf = (s: string): string =>
  withoutComments(s)
    .replace(/`(?:[^`\\]|\\[\s\S])*`/g, "``")
    .replace(/"(?:[^"\\]|\\[\s\S])*"/g, '""')
    .replace(/'(?:[^'\\]|\\[\s\S])*'/g, "''");

/*
 * THE RESTATED UNION MUST BE THE SAME SET AS THE PROJECTOR'S, IN BOTH DIRECTIONS.
 *
 * `delivery-legibility.ts` may not NAME the permit read module: it is reached from a `"use client"`
 * component, and a type-only import the type checker erases is still resolved by the BUNDLER, which
 * would drag drizzle and the schema layer into a client chunk. Restating the union is the price of
 * keeping a presentation derivation out of persistence.
 *
 * A test HAS no client bundle, so it may import both and check them against each other. These two
 * assignments are the whole proof: each direction fails to COMPILE if the sets ever diverge.
 */
const _stateWidensToProjector: PermitDisplayState = null as unknown as DeliverablePermitState;
const _projectorWidensToState: DeliverablePermitState = null as unknown as PermitDisplayState;
void _stateWidensToProjector;
void _projectorWidensToState;

const LEGIBILITY = "src/features/action-authorization/delivery-legibility.ts";
const READER = "src/features/action-authorization/read-action-authorizations.server.ts";
const SURFACE = "src/components/decision-workspace/action-authorizations.tsx";
const PAGE = "src/app/(dashboard)/approvals/page.tsx";

/* The one kind a machine may perform, taken from the frozen set rather than spelled here. */
const [MACHINE_KIND] = [...MACHINE_EXECUTABLE_ACTION_KINDS];
assert.ok(MACHINE_KIND, "the frozen machine-executable set must have at least one member");

const agentShaped = (state: Parameters<typeof derivePermitDeliveryBand>[0]["state"]) => ({
  actionKind: MACHINE_KIND!,
  proposedByActorType: "agent",
  state,
});

/* ────────────────────────────────────────────────────────────────────────────
 * 1 · SHAPE IS CHECKED BEFORE STATE
 * ──────────────────────────────────────────────────────────────────────────── */

assert.ok(isMachineDeliverableShape(agentShaped("active")));

assert.equal(
  isMachineDeliverableShape({ ...agentShaped("active"), proposedByActorType: "human" }),
  false,
  "a HUMAN-proposed act is never a delivery candidate — the runtime predicate refuses one",
);
assert.equal(
  isMachineDeliverableShape({ ...agentShaped("active"), actionKind: "external-send" }),
  false,
  "an action kind outside the frozen machine-executable set is never a delivery candidate",
);

/*
 * THE PRECEDENCE THAT MATTERS. A permit automatic delivery was never a question about must get NO
 * delivery verdict in ANY state — otherwise an expired external send would be reported as
 * "expired undelivered", implying delivery had once been possible for it.
 */
for (const state of ["active", "expired", "consumed", "revoked", "none"] as const) {
  for (const foreign of [
    { ...agentShaped(state), proposedByActorType: "human" },
    { ...agentShaped(state), actionKind: "external-send" },
  ]) {
    const band = derivePermitDeliveryBand(foreign);
    assert.equal(
      band.band,
      "not-machine-deliverable",
      `shape must outrank state: ${foreign.actionKind}/${foreign.proposedByActorType} @ ${state}`,
    );
    assert.equal(
      permitDeliverySentence(band),
      null,
      "a question that does not apply is answered with silence, never with a sentence",
    );
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * 2 · THE THREE STATES THE DIRECTOR ASKED FOR, AND THE TWO THAT KEEP THEM HONEST
 * ──────────────────────────────────────────────────────────────────────────── */

assert.equal(derivePermitDeliveryBand(agentShaped("active")).band, "awaiting-delivery");
assert.equal(derivePermitDeliveryBand(agentShaped("consumed")).band, "delivered");
assert.equal(
  derivePermitDeliveryBand(agentShaped("expired")).band,
  "expired-undelivered",
);

/*
 * REVOKED IS NOT EXPIRED, AND NEITHER IS A REFUSAL.
 *
 * A withdrawal is a human's deliberate act under a Governance decision. Collapsing it into the
 * clock would report the most accountable event on this surface as the least.
 */
assert.equal(
  derivePermitDeliveryBand(agentShaped("revoked")).band,
  "revoked-undelivered",
);
assert.notEqual(
  derivePermitDeliveryBand(agentShaped("revoked")).band,
  derivePermitDeliveryBand(agentShaped("expired")).band,
);

/* ────────────────────────────────────────────────────────────────────────────
 * 3 · TRUTH SEMANTICS — THE TWO DENIALS THE ROWS FORCE
 * ──────────────────────────────────────────────────────────────────────────── */

const sentenceOf = (band: PermitDeliveryBand): string => {
  const s = permitDeliverySentence(band);
  assert.ok(s, "this band must carry a sentence");
  return s!;
};

/*
 * THE DEFERRED READ, PINNED SO IT CANNOT BE QUIETLY ADDED WITHOUT A DECISION.
 *
 * `/approvals` does NOT read whether automatic delivery is armed. The three questions this
 * milestone owes an answer to are answerable from the permit and its proposal alone, so composing
 * the machine-execution authority onto a product surface — a new cross-feature import edge and a
 * sixth per-page read — buys only a qualifier on one sentence. The derivation is therefore tenant-
 * and deployment-blind, and the sentence NAMES its condition instead of asserting an arming state.
 */
for (const banned of [
  "resolve-machine-execution-reachability",
  "tenant-machine-execution-authority",
  "MachineExecutionReachability",
]) {
  assert.equal(
    read(LEGIBILITY).includes(banned),
    false,
    `the derivation must not reach the machine-execution authority: ${banned}`,
  );
}
assert.ok(
  /whenever automatic delivery is enabled for your organization/i.test(
    sentenceOf({ band: "awaiting-delivery" }),
  ),
  "the awaiting sentence must NAME its condition rather than assert that delivery is armed",
);

/*
 * DENIAL 1 — WHICH DOOR SPENT IT IS NOT RECORDED.
 *
 * `action_permits` records no consuming actor, and the consumption audit row records the
 * AUTHORIZING human for the human door and the machine door alike. So "delivered" may not be
 * narrowed to "a machine did this".
 */
const delivered = sentenceOf({ band: "delivered" });
assert.ok(
  /not recorded anywhere/i.test(delivered),
  "the delivered sentence must state that the consuming door is not recorded",
);
for (const forbidden of [/\bthe machine (?:delivered|performed|executed)\b/i, /\bautomatically delivered\b/i]) {
  assert.equal(
    forbidden.test(delivered),
    false,
    `"delivered" must not claim a door the rows cannot identify: ${forbidden}`,
  );
}

/*
 * DENIAL 2 — A REFUSED DELIVERY WRITES NOTHING.
 *
 * The trigger persists no attempt, no counter and no timestamp, so "expired undelivered" proves
 * the authorization LAPSED UNSPENT and proves nothing whatever about whether delivery was tried.
 */
const expired = sentenceOf({ band: "expired-undelivered" });
assert.ok(
  /whether delivery was ever attempted is not recorded/i.test(expired),
  "the expired sentence must deny knowledge of any attempt",
);
for (const forbidden of [/\bdelivery failed\b/i, /\bcould not be delivered\b/i, /\battempt failed\b/i]) {
  assert.equal(
    forbidden.test(expired),
    false,
    `"expired undelivered" must not imply a failed attempt: ${forbidden}`,
  );
}

/* An UNSPENT permit's sentence must never say work exists. */
for (const band of [
  { band: "expired-undelivered" } as const,
  { band: "revoked-undelivered" } as const,
]) {
  assert.ok(
    /no work was recorded/i.test(sentenceOf(band)),
    "an authorization nothing spent recorded nothing, and must say so",
  );
}

/* The awaiting sentence must keep the human's own control visible, not replace it. */
const awaiting = sentenceOf({ band: "awaiting-delivery" });
assert.ok(/without a further click/i.test(awaiting));
assert.ok(
  /execute it now yourself/i.test(awaiting),
  "automatic delivery does not remove the human's Execute control, and the sentence must not imply it does",
);

/* Every band is total: a new member fails here rather than rendering as nothing. */
for (const band of [
  { band: "not-machine-deliverable" },
  { band: "awaiting-delivery" },
  { band: "delivered" },
  { band: "expired-undelivered" },
  { band: "revoked-undelivered" },
] as const satisfies readonly PermitDeliveryBand[]) {
  const s = permitDeliverySentence(band);
  assert.ok(
    band.band === "not-machine-deliverable" ? s === null : typeof s === "string" && s.length > 0,
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * 4 · `derivePermitState` IS THE ONE EXPIRY AUTHORITY, AND THIS SITS DOWNSTREAM
 * ──────────────────────────────────────────────────────────────────────────── */

const legibilityCode = codeOf(read(LEGIBILITY));

for (const banned of ["expiresAt", "expires_at", "getTime", "Date.now", "new Date"]) {
  assert.equal(
    legibilityCode.includes(banned),
    false,
    `delivery legibility must not re-decide expiry — \`${banned}\` belongs to derivePermitState`,
  );
}

/* And it agrees with that authority by construction, on the authority's own inputs. */
const later = new Date("2026-09-16T00:00:00.000Z");
const earlier = new Date("2026-09-15T00:00:00.000Z");
assert.equal(
  derivePermitDeliveryBand(
    agentShaped(derivePermitState("active", earlier, later)),
  ).band,
  "expired-undelivered",
  "a permit the released projector calls expired is reported as expired-undelivered",
);
assert.equal(
  derivePermitDeliveryBand(
    agentShaped(derivePermitState("active", later, earlier)),
  ).band,
  "awaiting-delivery",
);
assert.equal(
  derivePermitDeliveryBand(
    agentShaped(derivePermitState("consumed", earlier, later)),
  ).band,
  "delivered",
  "consumed outranks the clock in the projector, and must outrank it here too",
);

/* ────────────────────────────────────────────────────────────────────────────
 * 5 · NO SECOND LEDGER, NO NEW AUTHORITY, NO WIDENING
 * ──────────────────────────────────────────────────────────────────────────── */

for (const banned of [
  "insert",
  "update",
  "delete",
  "transaction",
  "drizzle-orm",
  "db/schema",
  "client.server",
  "randomUUID",
]) {
  assert.equal(
    legibilityCode.includes(banned),
    false,
    `delivery legibility persists NOTHING and owns NOTHING — found \`${banned}\``,
  );
}

/* The frozen action set is CONSULTED, never restated: the kind is not spelled in this file. */
for (const kind of MACHINE_EXECUTABLE_ACTION_KINDS) {
  assert.equal(
    read(LEGIBILITY).includes(`"${kind}"`),
    false,
    `the machine-executable kind must be imported, never spelled: ${kind}`,
  );
}
assert.ok(
  legibilityCode.includes("MACHINE_EXECUTABLE_ACTION_KINDS"),
  "it must consult the frozen set",
);

/* It may not reach an executor, a trigger or a scan from a presentation derivation. */
for (const banned of [
  "execute-record-work-as-machine",
  "machine-delivery-trigger",
  "read-machine-deliverable-permits",
  "consume-action-permit",
]) {
  assert.equal(
    read(LEGIBILITY).includes(banned),
    false,
    `a sentence generator must not import execution machinery: ${banned}`,
  );
}


/*
 * NO SERVER MODULE MAY BE NAMED IN AN IMPORT — the regression this phase found and fixed.
 *
 * This module is reached from a `"use client"` component. A `.server` module named in ANY import,
 * type-only included, is resolved by the bundler and pulls the schema layer into the client graph.
 * A presentation derivation must not reach persistence, and a type position is not an exception.
 */
for (const line of read(LEGIBILITY).split("\n")) {
  if (!/^\s*import\b/.test(line)) continue;
  assert.equal(
    /\.server["']|\.server\b/.test(line),
    false,
    `a client-reached module must import no .server module: ${line.trim()}`,
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * 6 · TENANT ISOLATION — NOTHING HERE INTRODUCED A CALLER-SUPPLIED TENANT
 * ──────────────────────────────────────────────────────────────────────────── */

const legibilitySource = read(LEGIBILITY);
for (const banned of ["tenantId", "tenant_id", "TenantContext"]) {
  assert.equal(
    legibilitySource.includes(banned),
    false,
    `the derivation is tenant-blind by construction — found \`${banned}\``,
  );
}

const readerSource = read(READER);
assert.ok(
  readerSource.includes("eq(actionPermits.tenantId, tenant.tenantId)"),
  "the permit read stays scoped by the SESSION tenant predicate, unchanged",
);
/* The added column rides the join that already existed — no second query appeared. */
assert.equal(
  (readerSource.match(/\.from\(actionPermits\)/g) ?? []).length,
  1,
  "projecting the proposer must not have added a second permit query",
);
assert.ok(
  readerSource.includes("proposedByActorType: hebyActionRequests.proposedByActorType"),
  "the proposer class is selected off the join the reader already performs",
);

/*
 * THE PAGE IS UNTOUCHED BY THIS PHASE.
 *
 * Delivery legibility added NO read, no composition and no import to `/approvals`. The permit read
 * it already performed carries one additional column and nothing else, so this phase introduced no
 * new place a tenant could be named, chosen, or supplied.
 */
const pageSource = read(PAGE);
for (const banned of [
  "resolveMachineExecutionReachability",
  "tenant-machine-execution-authority",
  "governed-machine-execution",
]) {
  assert.equal(
    pageSource.includes(banned),
    false,
    `the approvals page must not reach the machine-execution authority: ${banned}`,
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * 7 · THE SURFACE FAILS CLOSED, AND STILL SEPARATES SPENT FROM DELIVERABLE
 * ──────────────────────────────────────────────────────────────────────────── */

const surfaceSource = read(SURFACE);
/* The component gained NO new prop: the band is derived from the permit view it already had. */
assert.equal(
  surfaceSource.includes("deliveryReachability"),
  false,
  "delivery legibility needs no new prop — everything it reads is already on ActionPermitView",
);
/* The delivery band is a SECOND line; the released outcome sentence is untouched. */
assert.ok(surfaceSource.includes("permitOutcomeSentence(item)"));
assert.ok(surfaceSource.includes("permitDeliverySentence("));

/* The surface may not derive delivery itself. */
assert.equal(
  codeOf(surfaceSource).includes("MACHINE_EXECUTABLE_ACTION_KINDS"),
  false,
  "the component asks the derivation; it does not re-implement the predicate",
);

/* ────────────────────────────────────────────────────────────────────────────
 * 8 · THE AUTHORIZING HUMAN CHOOSES A LIFETIME, AND CHOSEN == GRANTED
 * ──────────────────────────────────────────────────────────────────────────── */

assert.ok(PERMIT_TTL_CHOICES.length >= 2, "a picker with one option is not a choice");

for (const choice of PERMIT_TTL_CHOICES) {
  assert.ok(
    choice.seconds >= PERMIT_MIN_TTL_SECONDS && choice.seconds <= PERMIT_MAX_TTL_SECONDS,
    `every offered lifetime must lie inside the server's own bounds: ${choice.seconds}`,
  );
  /*
   * THE PROPERTY THE PICKER EXISTS FOR. The clamp is silent by design; an option it would narrow
   * would mean the human chose one lifetime and the row recorded another, with nothing said.
   */
  assert.equal(
    clampTtlSeconds(choice.seconds),
    choice.seconds,
    `the clamp must grant this lifetime UNCHANGED: ${choice.seconds}`,
  );
  assert.ok(choice.label.trim().length > 0, "every option must be readable, never a raw number");
}

/* Strictly ascending, so the list reads as a scale rather than a bag. */
for (let i = 1; i < PERMIT_TTL_CHOICES.length; i += 1) {
  assert.ok(
    PERMIT_TTL_CHOICES[i]!.seconds > PERMIT_TTL_CHOICES[i - 1]!.seconds,
    "offered lifetimes must ascend",
  );
}

assert.ok(
  PERMIT_TTL_CHOICES.some((c) => c.seconds === PERMIT_DEFAULT_TTL_SECONDS),
  "the server's default must be one of the offered options, and is the pre-selected one",
);
assert.ok(
  PERMIT_TTL_CHOICES.some((c) => c.seconds === PERMIT_MAX_TTL_SECONDS),
  "the ceiling is reachable through the picker; the clamp still owns it",
);

/* THE AUTHORITY IS UNCHANGED: the clamp still accepts and narrows anything. */
assert.equal(clampTtlSeconds(10_000_000), PERMIT_MAX_TTL_SECONDS);
assert.equal(clampTtlSeconds(-5), PERMIT_MIN_TTL_SECONDS);
assert.equal(clampTtlSeconds(undefined), PERMIT_DEFAULT_TTL_SECONDS);

/* And the surface now actually SENDS the choice — the one place it was dropped. */
assert.ok(
  surfaceSource.includes("requestedTtlSeconds: ttlSeconds"),
  "the approve call must carry the chosen lifetime; omitting it is the defect this closes",
);
assert.ok(
  surfaceSource.includes("useState<number>(PERMIT_DEFAULT_TTL_SECONDS)"),
  "the pre-selected lifetime is the server's own default, not a number this component invented",
);

console.log("PASS delivery legibility — derived, silent where it must be, and honest where it speaks");
