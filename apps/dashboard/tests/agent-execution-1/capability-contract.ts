/*
 * AGENT-EXECUTION-1 — the agent work capability contract cannot drift from the authorities it names,
 * and what Heby says about a task is only what the records hold. Pure and source-level; no database.
 *
 *   C1  every capability's mandate kinds are originable, responsibility-scoped kinds
 *   C2  every capability's data use is an ALLOWED platform cell, and matches what the preparation seam
 *       declares (assistance × work-artifact, never a provider observation)
 *   C3  a work capability is preparation only: never an executable, governed action kind
 *   C4  the assignment seam is a composition: it writes through released seams only, owns no table,
 *       applies the ONE shared ceiling itself, and never links evidence (WEV-1 stays a human act)
 *   C5  the client crosses ids and words only; the tenant comes from the session
 *   C6  Heby's wording: one sentence per recorded fact; "complete" only for an accepted draft
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { AGENT_WORK_CAPABILITIES } from "../../src/features/agent-work/capabilities";
import { AGENT_ORIGINABLE_ACTION_KINDS, AGENT_ORIGINABLE_REGISTRY_KIND } from "../../src/features/agent-origination/contracts";
import { RESPONSIBILITY_SCOPED_REGISTRY_KINDS } from "../../src/features/action-authorization/agent-mandate-ceiling";
import { decidePlatformDisclosure } from "../../src/features/external-ai-data-use/platform-disclosure-policy";
import { EXECUTABLE_ACTION_KINDS } from "../../src/features/heby-actions/action-registry";
import {
  ASSIGN_REFUSAL_WORDING,
  describeAssignment,
  describeWorkDraft,
  REVIEW_WORDING,
} from "../../src/components/layout/heby/heby-work-draft-affordance";
import type { WorkDraftView } from "../../src/features/agent-work/assign-work-draft.server";

const ROOT = path.resolve(__dirname, "../..");
const code = (f: string) =>
  readFileSync(path.join(ROOT, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
const SEAM = "src/features/agent-work/assign-work-draft.server.ts";
const ACTIONS = "src/app/(dashboard)/heby/work-state-origination-actions.ts";
const AFFORDANCE = "src/components/layout/heby/heby-work-draft-affordance.tsx";
const PREPARE = "src/features/work-artifacts/prepare-work-artifact.server.ts";

/* ── C1 / C2 / C3 · the contract against its authorities ── */
assert.equal(new Set(AGENT_WORK_CAPABILITIES.map((c) => c.id)).size, AGENT_WORK_CAPABILITIES.length, "capability ids are unique");
for (const capability of AGENT_WORK_CAPABILITIES) {
  assert.ok(capability.mandateKindsAnyOf.length > 0, `${capability.id}: a capability needs a mandate condition`);
  for (const kind of capability.mandateKindsAnyOf) {
    assert.ok((AGENT_ORIGINABLE_ACTION_KINDS as readonly string[]).includes(kind), `${capability.id}: ${kind} is a mandate kind`);
    assert.ok(RESPONSIBILITY_SCOPED_REGISTRY_KINDS.includes(AGENT_ORIGINABLE_REGISTRY_KIND[kind]), `${capability.id}: ${kind} carries responsibility`);
  }
  for (const dataClass of capability.dataUse.dataClasses) {
    const verdict = decidePlatformDisclosure({ serviceScope: "anthropic/messages", purpose: capability.dataUse.purpose, dataClass } as never);
    assert.equal(verdict.decision, "allowed", `${capability.id}: ${capability.dataUse.purpose} × ${dataClass} must be an allowed platform cell`);
  }
  assert.equal(capability.sideEffect, "PREPARATION_ONLY");
  assert.equal(capability.authorizationRequired, false);
  assert.ok(!(EXECUTABLE_ACTION_KINDS as readonly string[]).includes(capability.id), `${capability.id} is not an executable action kind`);
  assert.ok(capability.cannot.some((line) => /send|publish/.test(line)), `${capability.id} says it cannot send or publish`);
}
/* The seam declares exactly the classes the contract names — and a provider observation never travels. */
assert.match(code(PREPARE), /preparationBriefDataClasses: input\.observationSupplement \? \["work-artifact", "provider-observation"\] : \["work-artifact"\]/);
assert.doesNotMatch(code(SEAM), /observationSupplement|conversationId|artifactId:\s*input/, "the assignment never adds grounding, a conversation or a revision target");

/* ── C4 · a composition, not an authority ── */
const seam = code(SEAM);
for (const banned of [".insert(", ".update(", ".delete(", "from \"@/db/schema"]) {
  assert.ok(!seam.includes(banned), `the seam writes nothing itself (${banned})`);
}
/* Its one statement of its own is the assignment lock: a transaction-scoped advisory lock, no row. */
assert.deepEqual([...seam.matchAll(/sql`([^`]*)`/g)].map((m) => m[1]!.replace(/\$\{[^}]*\}/g, "?")), [
  "select pg_try_advisory_xact_lock(hashtext('hebun.agent-work.assign'), hashtext(?)) as locked",
]);
assert.equal(seam.split("db.transaction(").length - 1, 1, "one transaction: the lock's");
{
  const body = seam.slice(seam.indexOf("const prepareUnderLock"), seam.indexOf("db.transaction("));
  assert.ok(body.includes("openDraftBy(drafts.drafts, agentId)") && body.includes("deps.prepare ?? prepareWorkArtifact"), "the open-draft read and the model call run only under the lock");
  const locked = seam.slice(seam.indexOf("db.transaction("));
  assert.ok(locked.indexOf("pg_try_advisory_xact_lock") < locked.indexOf("return prepareUnderLock()"), "the lock is taken before anything runs under it");
  assert.equal(seam.split("prepareUnderLock()").length - 1, 1, "and nothing runs it outside the lock");
}
const imports = [...seam.matchAll(/from "([^"]+)"/g)].map((m) => m[1]!).sort();
assert.deepEqual(
  imports,
  [
    "./capabilities",
    "@/db/client.server",
    "@/features/agent-identity/read-durable-agent-identity.server",
    "@/features/agent-mandate/read-agent-mandate.server",
    "@/features/auth/tenant/tenant-context",
    "@/features/governance-decision/authority-read.server",
    "@/features/heby-runtime/contracts",
    "@/features/organizational-work/read-work-evidence.server",
    "@/features/organizational-work/read-work.server",
    "@/features/work-artifact-review/contracts",
    "@/features/work-artifact-review/review-revision.server",
    "@/features/work-artifacts/contracts",
    "@/features/work-artifacts/prepare-work-artifact.server",
    "@/features/work-artifacts/read-work-artifacts.server",
    "@/features/work-domain/work-scope",
    "drizzle-orm",
  ],
  "the seam reaches only these authorities (a new reach is a deliberate edit here)",
);
assert.doesNotMatch(seam, /declareWorkEvidenceReference|write-work\.server|list-eligible-agents/, "the seam never links evidence and never uses the read-only eligibility projection as a gate");
assert.match(seam, /refuseOutsideAgentWorkCapability\(CAPABILITY, mandate, workScope\)/, "the shared ceiling decides, through the capability's one condition");
assert.match(seam, /workScope: target\.target\.workScope/, "the preparation seam is handed the work item's recorded scope, server-side");
assert.match(seam, /agentId: agent\.agentId/, "the agent handed to the preparation seam is the one the eligibility read listed");
assert.ok(seam.indexOf("resolveGovernanceAuthority") < seam.indexOf("deps.prepare ?? prepareWorkArtifact"), "authority is asked before the model");
assert.ok(seam.indexOf("openDraftBy(drafts.drafts, agentId)") < seam.indexOf("deps.prepare ?? prepareWorkArtifact"), "the open-draft rule is asked before the model");
assert.ok(seam.lastIndexOf("eligibleAgents(tenant, after.target.workScope") > seam.indexOf("deps.prepare ?? prepareWorkArtifact"), "eligibility is asked again after the draft exists");

/* ── C5 · the client crosses ids and words; the tenant is the session's ── */
const actionsFile = readFileSync(path.join(ROOT, ACTIONS), "utf8");
assert.match(actionsFile, /^"use server";/m);
/* Only this milestone's section: from its marker to the end of the file. */
const actions = actionsFile.slice(actionsFile.indexOf("AGENT-EXECUTION-1")).replace(/\/\*[\s\S]*?\*\//g, " ");
assert.ok(actionsFile.includes("AGENT-EXECUTION-1"), "the section marker exists");
assert.match(actions, /readWorkDraftChoices\(await resolveTenantContext\(\)/);
assert.match(actions, /resolveTenant: resolveTenantContext/);
assert.doesNotMatch(actions, /tenantId|userId|membershipId|roleId|mandate|responsibility|authorized/i, "no authority-shaped field crosses from the client");
const affordance = code(AFFORDANCE);
assert.match(affordance, /declareWorkReferenceAction\(\{ workItemId, kind: "work-artifact", referentId: linkable\.artifactId \}\)/, "Heby links only through the Work register's own human action, on the person's click");
for (const line of affordance.split("\n").filter((l) => /^import /.test(l) && /\.server"/.test(l))) {
  assert.match(line, /^import type /, `the client imports only types from server modules: ${line.trim()}`);
}
assert.doesNotMatch(affordance, /tenantId|userId/, "the client never names a tenant or a user");

/* ── C6 · wording ── */
const draft = (over: Partial<WorkDraftView>): WorkDraftView => ({
  artifactId: "a", title: "Plan", artifactType: "operational-plan", revisionNo: 1, retired: false,
  author: { kind: "agent", agentId: "g", name: "Writer" }, review: "awaiting-review", declaredAt: "2026-10-25T10:00:00.000Z", ...over,
});
assert.equal(describeWorkDraft(draft({})), "Plan “Plan” · revision 1 · written by Writer · waiting for review");
assert.match(describeWorkDraft(draft({ review: "accepted" })), /accepted — this task is complete/);
for (const review of ["awaiting-review", "changes-requested", "unknown"] as const) {
  assert.doesNotMatch(describeWorkDraft(draft({ review })), /complete/, `${review} is never worded as complete`);
}
assert.match(describeWorkDraft(draft({ retired: true, review: "accepted" })), /retired$/, "a retired draft says retired");
assert.match(describeWorkDraft(draft({ author: { kind: "human" } })), /written by a person/);
assert.match(REVIEW_WORDING.unknown, /could not be read/);

const prepared = describeAssignment({ status: "prepared", workItemId: "w", artifactId: "a", revisionNo: 1, agentName: "Writer", agentRole: "coordinator" }, "Writer");
assert.match(prepared, /It is not yet this work's evidence: link it below/, "prepared is not linked, and says so");
assert.match(prepared, /nothing was sent, published or changed\./);
const stale = describeAssignment({ status: "prepared-stale", artifactId: "a", revisionNo: 1, reason: "agent-no-longer-eligible" }, "Writer");
assert.match(stale, /the agent stopped being responsible for this work while it was writing, so Heby does not offer it as this work's evidence/);
assert.match(describeAssignment({ status: "not-prepared", reason: "no-model-answer" }, "Writer"), /^No draft was written\./);
for (const reason of Object.keys(ASSIGN_REFUSAL_WORDING) as (keyof typeof ASSIGN_REFUSAL_WORDING)[]) {
  const text = describeAssignment({ status: "refused", reason }, "Writer");
  assert.ok(text.length > 20 && !/undefined/.test(text), `refusal ${reason} is worded`);
  assert.doesNotMatch(text, /wrote|prepared|linked the draft/, `refusal ${reason} claims no work`);
}

console.log("agent-execution-1 capability contract: ok");
