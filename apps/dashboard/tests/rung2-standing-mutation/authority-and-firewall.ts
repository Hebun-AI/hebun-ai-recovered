/*
 * RUNG 2 — the standing mutation authority's BOUNDARIES, proved without a database.
 *
 * WHAT THIS FILE PROVES:
 *
 *   "An envelope is a new authority, not a widening of three existing ones. It cannot be reached
 *    from Heby, the UI or any client. It authorizes only `record-work`. Its evidence vocabulary is
 *    closed and contains only source classes that describe an EVENT. It creates no Governance
 *    decision. The ledger records it in its own words. The schema's bounds and the writer's
 *    refusals agree."
 *
 * The persistence proofs — the partial index, quota, cadence, evidence replay, concurrency and the
 * migration itself — live in `issuance-postgres.ts` against a real PostgreSQL.
 */
import assert from "node:assert/strict";
import path from "node:path";
import { readFileSync } from "node:fs";

/* The schema barrel initialises lazily; the released suites load the client first for this reason. */
import "../../src/db/client.server";

import {
  ADMITTED_EVIDENCE_SOURCE_CLASSES,
  STANDING_MUTATION_AUTHORIZED_OUTCOME,
  STANDING_MUTATION_AUTHORIZE_DECISION_TYPE,
  STANDING_MUTATION_DOMAIN,
  STANDING_MUTATION_SUBJECT_TYPE,
  STANDING_MUTATION_WITHDRAWN_OUTCOME,
  STANDING_MUTATION_WITHDRAW_DECISION_TYPE,
} from "../../src/features/standing-mutation-authority/contracts";
import {
  STANDING_MUTATION_MAX_ACTS_CEILING,
  STANDING_MUTATION_MIN_INTERVAL_CEILING_MINUTES,
} from "../../src/features/standing-mutation-authority/authorize-standing-mutation.server";
import { admittedEvidenceRef } from "../../src/features/standing-mutation-authority/issue-permit-under-standing-authorization.server";
import { MACHINE_EXECUTABLE_ACTION_KINDS } from "../../src/features/governed-machine-execution/contracts";
import { STANDING_OBSERVATION_DOMAIN } from "../../src/features/standing-observation-authority/contracts";
import { TENANT_MACHINE_EXECUTION_DOMAIN } from "../../src/features/tenant-machine-execution-authority/contracts";
import { ACTION_AUTHORIZATION_DOMAIN } from "../../src/features/action-authorization/contracts";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
const withoutComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const codeOf = (s: string): string =>
  withoutComments(s)
    .replace(/`(?:[^`\\]|\\[\s\S])*`/g, "``")
    .replace(/"(?:[^"\\]|\\[\s\S])*"/g, '""')
    .replace(/'(?:[^'\\]|\\[\s\S])*'/g, "''");

const ISSUER = "src/features/standing-mutation-authority/issue-permit-under-standing-authorization.server.ts";
const WRITER = "src/features/standing-mutation-authority/authorize-standing-mutation.server.ts";
const SCHEMA = "src/db/schema/standing-mutation-authorization.ts";
const PERMIT_SCHEMA = "src/db/schema/action-authorization.ts";

/* ────────────────────────────────────────────────────────────────────────────
 * 1 · A DISTINCT DOMAIN — THE LEDGER MUST BE ABLE TO TELL THESE APART
 * ──────────────────────────────────────────────────────────────────────────── */

for (const neighbour of [
  STANDING_OBSERVATION_DOMAIN,
  TENANT_MACHINE_EXECUTION_DOMAIN,
  ACTION_AUTHORIZATION_DOMAIN,
]) {
  assert.notEqual(
    STANDING_MUTATION_DOMAIN,
    neighbour,
    `a standing envelope must not be filed under ${neighbour} — see the enum's own comment`,
  );
}

/*
 * THE LEDGER'S OWN WORDS, AND WHY THEY ARE NOT `approved` / `revoked`.
 *
 * `approve` is ALSO the membership-authorization decision type, and `revoke` is ALSO how a
 * Governance DELEGATION ends. Without subject-matched outcomes, authorizing an envelope would be
 * recorded as a human joining the organization, and withdrawing one as Governance authority being
 * taken away.
 */
assert.equal(STANDING_MUTATION_AUTHORIZE_DECISION_TYPE, "approve");
assert.equal(STANDING_MUTATION_WITHDRAW_DECISION_TYPE, "revoke");
assert.notEqual(STANDING_MUTATION_AUTHORIZED_OUTCOME, "approved");
assert.notEqual(STANDING_MUTATION_WITHDRAWN_OUTCOME, "revoked");
assert.ok(/standing-mutation/.test(STANDING_MUTATION_AUTHORIZED_OUTCOME));
assert.ok(/standing-mutation/.test(STANDING_MUTATION_WITHDRAWN_OUTCOME));

/* The decision authority must actually route this subject — not fall through to a generic branch. */
const decisionAuthority = read("src/features/governance-decision/decision-authority.server.ts");
assert.ok(decisionAuthority.includes("STANDING_MUTATION_SUBJECT_TYPE"));
assert.ok(decisionAuthority.includes("STANDING_MUTATION_DOMAIN"));
assert.ok(decisionAuthority.includes("STANDING_MUTATION_AUTHORIZED_OUTCOME"));
assert.ok(decisionAuthority.includes("STANDING_MUTATION_WITHDRAWN_OUTCOME"));
assert.equal(STANDING_MUTATION_SUBJECT_TYPE, "standing_mutation_authorization");

/* ────────────────────────────────────────────────────────────────────────────
 * 2 · THE ISSUER CREATES NO GOVERNANCE DECISION, AND NO AGENT AUTHORS ONE
 * ──────────────────────────────────────────────────────────────────────────── */

const issuerCode = codeOf(read(ISSUER));

/*
 * THE DESIGN'S CENTRAL REFUSAL, PINNED.
 *
 * Two escapes were considered and rejected at design time: minting a Governance decision per act
 * with `actor_type = 'agent'` (handing Governance to a machine), and minting one with
 * `actor_type = 'human'` (recording a deliberation that never happened). The issuer must therefore
 * write NO decision at all — it names the STANDING decision the human already took.
 */
assert.equal(
  issuerCode.includes("writeGovernanceDecisionWithin"),
  false,
  "the issuing seam must NOT create a Governance decision — it names the standing one",
);
assert.equal(
  issuerCode.includes("decisionRecords"),
  false,
  "the issuing seam must not touch the decision ledger at all",
);
assert.ok(
  issuerCode.includes("governanceDecisionId: envelope.governanceDecisionId"),
  "the permit must name the STANDING decision as its authorization",
);

/* The human authorizer is the envelope's signer, and the actor type is never anything but human. */
assert.ok(issuerCode.includes('authorizedByActorType: ""') || read(ISSUER).includes('authorizedByActorType: "human"'));
assert.ok(
  issuerCode.includes("authorizedByActorId: envelope.authorizedByActorId"),
  "the permit names the human who signed the envelope, which is the truth",
);
/*
 * THE APPROVER IS THE ENVELOPE'S SIGNER, NEVER A FABRICATED OR ARBITRARY ONE.
 *
 * `heby_action_requests_approved_chk` requires an approved request to name WHO approved it, and a
 * sibling CHECK requires that to be a human — the database will not hold an approved act with no
 * accountable person. The honest answer is the human who signed the envelope, and the issuer must
 * take it from the envelope row rather than from anywhere else.
 */
assert.ok(
  issuerCode.includes("approvedByActorId: envelope.authorizedByActorId"),
  "the approver must be read off the envelope, never supplied or invented",
);
assert.equal(
  (issuerCode.match(/approvedByActorId:/g) ?? []).length,
  1,
  "the approver is written in exactly one place",
);
assert.equal(
  (issuerCode.match(/approvedByActorId: envelope\.authorizedByActorId/g) ?? []).length,
  1,
  "and that one place reads it off the envelope — no other value may ever be the approver",
);

/* ────────────────────────────────────────────────────────────────────────────
 * 3 · UNREACHABLE FROM HEBY, THE UI AND EVERY CLIENT
 * ──────────────────────────────────────────────────────────────────────────── */

import { readdirSync, statSync } from "node:fs";

function walk(dir: string): readonly string[] {
  const full = path.join(ROOT, dir);
  let entries: string[] = [];
  try {
    entries = readdirSync(full);
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    const rel = path.join(dir, entry);
    return statSync(path.join(ROOT, rel)).isDirectory()
      ? walk(rel)
      : rel.endsWith(".ts") || rel.endsWith(".tsx")
        ? [rel]
        : [];
  });
}

const ISSUER_MODULE = "issue-permit-under-standing-authorization";

/*
 * THE FIREWALL THAT MAKES THE ENVELOPE AN AUTHORITY RATHER THAN A SELF-SERVICE COUNTER.
 *
 * Heby PROPOSES. If any agent runtime, server action, route or component could call the issuer,
 * the agent would be deciding its own authorization and the entire model would collapse.
 */
for (const area of ["src/app", "src/components", "src/features/heby-runtime", "src/features/heby-actions", "src/features/heby-action-inlet", "src/features/agent-origination"]) {
  for (const file of walk(area)) {
    assert.equal(
      read(file).includes(ISSUER_MODULE),
      false,
      `${file} must not reach the standing issuing seam — Heby proposes, it does not authorize`,
    );
  }
}

/*
 * AND THE NAMERS UNDER `src/features` ARE AN ENUMERATED LIST OF TWO.
 *
 * ── WHY THIS WIDENED BY EXACTLY ONE, AND WHAT DID NOT WIDEN ────────────────
 *
 * It used to read `[ISSUER]` — the issuer was the only module allowed to name the issuer, which is
 * another way of saying the authority had no trigger and could never fire. A human could authorize
 * an envelope that nothing could ever act under.
 *
 * The ban's STATED purpose is directly above: Heby proposes, and no agent runtime, server action,
 * route or component may decide its own authorization. A SCHEDULER TICK IS NONE OF THOSE THINGS.
 * So the trigger module is admitted BY NAME, and everything that made the ban meaningful is
 * untouched — the six area bans above still prove that no file under `src/app`, `src/components`,
 * `heby-runtime`, `heby-actions`, `heby-action-inlet` or `agent-origination` may name the issuer.
 *
 * A LIST, NOT A PREFIX, AND NOT A COUNT. `startsWith("src/features/standing-issuance-trigger")`
 * would admit any future file dropped into that directory, and `length <= 2` would admit any second
 * namer anywhere. Enumerating the exact paths means a third namer — wherever it is, whatever it is
 * called — fails this assertion and has to be argued for on its own merits.
 */
const ISSUANCE_TRIGGER = "src/features/standing-issuance-trigger/scan-issuable-requests.server.ts";
/*
 * The trigger's vocabulary module names the issuer too, and for a materially weaker reason: it
 * borrows the issuer's RESULT TYPE so its report cannot invent a refusal word. That is asserted
 * below rather than assumed — a type import erases at compile time and reaches nothing.
 */
const ISSUANCE_TRIGGER_CONTRACTS = "src/features/standing-issuance-trigger/contracts.ts";
const namers = walk("src/features").filter((f) => read(f).includes(ISSUER_MODULE));
assert.deepEqual(
  namers.sort(),
  [ISSUER, ISSUANCE_TRIGGER, ISSUANCE_TRIGGER_CONTRACTS].sort(),
  `only the issuer and the named issuance trigger may name the issuing seam, found: ${namers.join(", ")}`,
);

/*
 * THE CONTRACTS MODULE'S NAMING IS TYPE-ONLY, AND THEREFORE NOT REACH AT ALL.
 *
 * `import type` is erased by the compiler: no runtime binding exists, and the module cannot call
 * what it names. Stripping the comments and string literals leaves no mention of the issuer at all
 * — which is the difference between borrowing a vocabulary and holding an authority.
 */
assert.ok(
  /^\s*import type[^\n]*issue-permit-under-standing-authorization/m.test(read(ISSUANCE_TRIGGER_CONTRACTS)),
  "the trigger's contracts may name the issuer only as a type import",
);
assert.equal(
  codeOf(read(ISSUANCE_TRIGGER_CONTRACTS)).replace(/^\s*import type[\s\S]*?;$/m, "").includes(ISSUER_MODULE),
  false,
  "and must hold no runtime reference to it",
);

/*
 * THE ADMITTED TRIGGER IS A TRIGGER, NOT A SECOND AUTHORITY.
 *
 * Admitting a module by name is only safe if that module cannot do the thing the ban exists to
 * prevent. So the trigger is held to what it claims: it mints nothing, executes nothing, and holds
 * no vocabulary of its own for deciding whether issuance is authorized.
 */
const triggerCode = codeOf(read(ISSUANCE_TRIGGER));
for (const banned of [
  /* It may not write a permit, an envelope or a decision itself. */
  "actionPermits",
  "standingMutationAuthorizations",
  "writeGovernanceDecision",
  "db.insert",
  "db.transaction",
  "drizzle-orm",
  /* It may not execute, deliver, arm, or enrol. */
  "executeRecordWorkAsMachine",
  "scanDeliverablePermits",
  "resolveMachineInternalExecutionEnabled",
  "writeTenantMachineExecution",
  "mintMachineExecutionPrincipal",
]) {
  assert.equal(
    triggerCode.includes(banned),
    false,
    `the issuance trigger must not reach ${banned} — it decides WHEN, never WHETHER`,
  );
}

/*
 * AND IT MAY NOT RE-DECIDE THE ENVELOPE'S BOUNDS. Every one of these is the issuer's to evaluate
 * behind its own row lock; a second evaluation here would be a second quota, a second clock and a
 * second cadence that could disagree with the authoritative ones.
 */
for (const bound of ["maxActs", "minIntervalMinutes", "notBefore", "notAfter", "authorizationRevision"]) {
  assert.equal(
    triggerCode.includes(bound),
    false,
    `the issuance trigger must not evaluate ${bound} — the issuer owns it, under a lock`,
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * 4 · ONE ACTION KIND, CONSULTED AND ALSO FROZEN IN THE DATABASE
 * ──────────────────────────────────────────────────────────────────────────── */

assert.deepEqual([...MACHINE_EXECUTABLE_ACTION_KINDS], ["record-work"]);

const schemaSource = read(SCHEMA);
assert.ok(
  schemaSource.includes("standing_mutation_authorizations_action_kind_chk"),
  "the frozen kind must be a DATABASE fact, not only a server-side check",
);
assert.ok(
  /action_kind_chk[\s\S]{0,200}record-work/.test(schemaSource),
  "the CHECK must name record-work",
);

/* The writer consults the released frozen set rather than restating a kind. */
assert.ok(codeOf(read(WRITER)).includes("MACHINE_EXECUTABLE_ACTION_KINDS"));

/* The schema's ceilings and the writer's refusal ceilings must agree. */
assert.ok(
  schemaSource.includes(`<= ${STANDING_MUTATION_MAX_ACTS_CEILING}`),
  "the writer's max-acts ceiling must match the schema CHECK",
);
assert.ok(
  schemaSource.includes(`<= ${STANDING_MUTATION_MIN_INTERVAL_CEILING_MINUTES}`),
  "the writer's cadence ceiling must match the schema CHECK",
);

/* ────────────────────────────────────────────────────────────────────────────
 * 5 · EVIDENCE — CLOSED, EVENT-SHAPED, AND REQUIRED
 * ──────────────────────────────────────────────────────────────────────────── */

assert.deepEqual([...ADMITTED_EVIDENCE_SOURCE_CLASSES], ["provider-observations"]);

/*
 * `organization` MUST NOT BE ADMITTED. It is a standing fact about the company — equally true
 * today and next year — so it can never be the thing that makes one NEW work record warranted, and
 * an envelope keyed on it would let one unchanging fact consume the entire quota.
 */
assert.equal(
  ADMITTED_EVIDENCE_SOURCE_CLASSES.has("organization"),
  false,
  "a standing organizational fact is not evidence that work happened",
);

/* The extractor picks the admitted class and ignores the rest. */
assert.equal(
  admittedEvidenceRef([
    { sourceClass: "organization", recordRef: "organization/abc", lifecycle: "settled" },
    { sourceClass: "provider-observations", recordRef: "obs/1", lifecycle: "settled" },
  ]),
  "obs/1",
);
assert.equal(
  admittedEvidenceRef([{ sourceClass: "organization", recordRef: "organization/abc" }]),
  null,
  "a proposal carrying only unadmitted evidence must not qualify",
);
assert.equal(admittedEvidenceRef(null), null);
assert.equal(admittedEvidenceRef([]), null);
assert.equal(admittedEvidenceRef("not-an-array"), null);

/* ────────────────────────────────────────────────────────────────────────────
 * 6 · NO SECOND EXECUTOR, NO REUSABLE PERMIT, NO STANDING-OBSERVATION WIDENING
 * ──────────────────────────────────────────────────────────────────────────── */

for (const banned of [
  "recordWorkWithinAsMachine",
  "consumeActionPermitAsMachine",
  "executeRecordWorkAsMachine",
  "mintMachineExecutionPrincipal",
]) {
  assert.equal(
    issuerCode.includes(banned),
    false,
    `the issuing seam must not execute anything: ${banned}`,
  );
}

/*
 * It must never touch the standing OBSERVATION authority — the read/write firewall.
 *
 * Judged on CODE, not prose: these modules EXPLAIN at length why they are siblings of the
 * observation authority rather than extensions of it, and a ban that fired on that explanation
 * would be a guard punishing the documentation that makes the boundary legible.
 */
for (const file of [ISSUER, WRITER, SCHEMA]) {
  assert.equal(
    codeOf(read(file)).includes("standingObservationAuthorizations"),
    false,
    `${file} must not read or write the observation authority's table`,
  );
  assert.equal(
    /^\s*import[^\n]*standing-observation-authority/m.test(read(file)),
    false,
    `${file} must not import the observation authority`,
  );
}

/* No permit is ever updated to be reused: the issuer only INSERTS permits. */
assert.equal(
  /update\(\s*actionPermits/.test(issuerCode),
  false,
  "permits are single-use; the issuing seam may never update one",
);

/* ────────────────────────────────────────────────────────────────────────────
 * 7 · THE PARTIAL INDEX SAYS EXACTLY WHAT WAS APPROVED, AND NO MORE
 * ──────────────────────────────────────────────────────────────────────────── */

const permitSchema = read(PERMIT_SCHEMA);
assert.ok(
  /action_permits_decision_uq[\s\S]{0,400}standingAuthorizationId\} is null/.test(permitSchema),
  "decision uniqueness must be PARTIAL on standing_authorization_id IS NULL",
);
/* The human-authorizer CHECK is untouched — approved explicitly by the Director. */
assert.ok(
  permitSchema.includes("action_permits_human_authorizer_chk"),
  "the human-authorizer invariant must remain",
);
assert.ok(
  /action_permits_human_authorizer_chk[\s\S]{0,200}= 'human'/.test(permitSchema),
  "and it must still require a human",
);
/* Single-spend and one-permit-per-request are untouched. */
assert.ok(permitSchema.includes("action_permits_request_uq"));
assert.ok(permitSchema.includes("action_permits_handoff_uq"));

/* ────────────────────────────────────────────────────────────────────────────
 * 8 · THE ENVELOPE ROW IS THE MUTEX
 * ──────────────────────────────────────────────────────────────────────────── */

assert.ok(
  /\.for\(\s*""\s*\)/.test(issuerCode) || read(ISSUER).includes('.for("update")'),
  "the effective envelope revision must be locked FOR UPDATE before any count",
);
/* And the lock must be taken before the quota/cadence/evidence reads it guards. */
const raw = read(ISSUER);
const lockAt = raw.indexOf('.for("update")');
assert.ok(lockAt > 0);
for (const guarded of ["actsIssued >= envelope.maxActs", "cadence-not-elapsed", "evidence-already-consumed"]) {
  assert.ok(
    raw.indexOf(guarded) > lockAt,
    `the ${guarded} check must happen behind the envelope lock, not before it`,
  );
}

console.log("PASS rung2 standing mutation — a new authority, bounded, and unreachable from the agent");
