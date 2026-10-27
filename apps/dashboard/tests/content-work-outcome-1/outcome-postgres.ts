/*
 * CONTENT-WORK-OUTCOME-1 — a content draft's publication, read from the action ledger, joins the work
 * outcome. Real disposable PostgreSQL, the released writers, no model and no network.
 *
 *   P1  draft-only work keeps the released behaviour: an accepted plan offers the suggestion
 *   P2  publication-required work: an accepted content draft with no publication request reads
 *       `pending` from the REAL ledger, and nothing is suggested — Governance acceptance alone is not enough
 *   P3  plan + content on one work: the accepted plan does not cover the unpublished content draft
 *   P4  tenant isolation: another organization reads none of this work's evidence
 *   P5  the ledger's answers, through the real composition (the projection itself is proven by
 *       content-publication-state-1/publication-postgres.ts against released writers):
 *         accepted attempt for exactly this revision → suggested
 *         accepted attempt for ANOTHER artifact or ANOTHER revision → not this draft's evidence
 *         accepted attempt to another destination → not verified
 *         approved request with an active permit → pending (a permit is not a publication)
 *         latest attempt failed / refused / unknown → failed
 *         truncated history without an accepted attempt → unavailable
 *         unknown, missing, or a throwing read → unavailable
 *   P6  only content revisions are asked about, under the caller's tenant
 *   P7  no database → unavailable, nothing suggested
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { seedGovernanceAuthority } from "../helpers/agent-mandate-seed";
import { proposeRecordWorkAction } from "../../src/features/heby-action-inlet/record-work-proposal.server";
import { approveActionRequest } from "../../src/features/action-authorization/decide-action-request.server";
import { executeRecordWork } from "../../src/features/governed-internal-action/execute-record-work.server";
import { declareWorkEvidenceReference } from "../../src/features/organizational-work/write-work.server";
import { createWorkArtifact } from "../../src/features/work-artifacts/write-work-artifacts.server";
import { readWorkArtifactHistory } from "../../src/features/work-artifacts/read-work-artifacts.server";
import { acceptArtifactRevision } from "../../src/features/work-artifact-review/review-revision.server";
import { readWorkDraftChoices } from "../../src/features/agent-work/assign-work-draft.server";
import { readWorkOutcomeEvidence } from "../../src/features/work-outcome/read-work-outcome-evidence.server";
import { suggestCompletion, type CompletionSuggestion } from "../../src/features/work-outcome/contracts";
import type {
  ContentPublicationState,
  PublicationHistoryEntry,
  PublicationStage,
} from "../../src/features/action-authorization/content-publication-state";
import type { readContentPublicationStates } from "../../src/features/action-authorization/content-publication-state.server";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";

const APPROVE = "I have read this proposal and authorize it for the content outcome proof.";
const ACCEPT = "Accepted: this draft is fit for the next internal step of this work.";

let networkCalls = 0;
globalThis.fetch = (() => {
  networkCalls++;
  throw new Error("REAL NETWORK REACHED");
}) as typeof fetch;

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
}

async function sessionRow(client: Client, s: Seeded, tag: string): Promise<string> {
  const row = await client.query<{ id: string }>(
    `insert into user_session_contexts
       (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
        user_id, active_tenant_id, active_membership_id, membership_version, assurance_level,
        mfa_verified, authenticated_at, issued_at, last_activity_at, absolute_expires_at, inactivity_expires_at)
     values ($1, $2, 1, $3, $4, $5, 1, 'aal1', false, now(), now(), now(), now() + interval '1 day', now() + interval '1 hour')
     returning id`,
    [s.authIdentityId, createHash("sha256").update(tag).digest("hex"), s.userId, s.tenantId, s.membershipId],
  );
  return row.rows[0]!.id;
}

const contextFor = (s: Seeded, sessionContextId: string): TenantContext =>
  asHumanTenantContext({
    tenantId: s.tenantId, userId: s.userId, authIdentityId: s.authIdentityId, membershipId: s.membershipId,
    membershipVersion: 1, roleId: s.roleId, sessionContextId, provider: "local", assuranceLevel: "aal1",
    mfaVerified: false, requestId: "cwo1-request", authenticatedAt: new Date().toISOString(),
  });

/* One ledger entry, shaped exactly as the projection reports it. */
function entry(stage: PublicationStage, destination: "instagram" | "youtube" = "instagram"): PublicationHistoryEntry {
  const executed = stage.startsWith("execution-");
  const status = stage.slice("execution-".length) as "pending" | "accepted" | "refused" | "failed" | "unknown";
  return {
    requestId: randomUUID(),
    actionKind: destination === "instagram" ? "publish-instagram-media" : "publish-youtube-video",
    destination,
    destinationAccountId: "account-1",
    acknowledgesPriorAttemptId: null,
    payloadDigest: "digest",
    requestStatus: stage === "request-pending" ? "pending" : "approved",
    proposedAt: "2026-10-27T10:00:00.000Z",
    approvedAt: stage === "request-pending" ? null : "2026-10-27T10:01:00.000Z",
    rejectedAt: null,
    permit: stage === "request-pending" ? null : {
      state: executed ? "consumed" : "active",
      issuedAt: "2026-10-27T10:01:00.000Z",
      expiresAt: "2026-10-27T11:01:00.000Z",
      consumedAt: executed ? "2026-10-27T10:02:00.000Z" : null,
      revokedAt: null,
    },
    attempt: executed ? {
      attemptId: randomUUID(),
      status,
      providerResponseClass: null,
      providerResultId: status === "accepted" ? "18000000000000000" : null,
      failureClass: null,
      startedAt: "2026-10-27T10:02:00.000Z",
      completedAt: "2026-10-27T10:02:05.000Z",
    } : null,
    stage,
  } as PublicationHistoryEntry;
}

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("content-work-outcome-1/outcome-postgres: exited before completing");
    process.exitCode = 1;
  }
});

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_cwo1_outcome");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const dbDeps = { getDb: () => handle.db } as never;

  try {
    const acmeSeed = (await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme-cwo1", email: "director@acme.test" })) as Seeded;
    const globexSeed = (await seedLocalIdentity(setup, { companyName: "Globex", companySlug: "globex-cwo1", email: "director@globex.test" })) as Seeded;
    const acme = contextFor(acmeSeed, await sessionRow(setup, acmeSeed, "cwo1-acme"));
    const globex = contextFor(globexSeed, await sessionRow(setup, globexSeed, "cwo1-globex"));
    await seedGovernanceAuthority(setup, acmeSeed, dbDeps, { ctx: acme, sessionContextId: acme.sessionContextId });
    await seedGovernanceAuthority(setup, globexSeed, dbDeps, { ctx: globex, sessionContextId: globex.sessionContextId });

    let titles = 0;
    const work = async (ctx: TenantContext): Promise<string> => {
      const p = await proposeRecordWorkAction(ctx, { title: `Launch post ${++titles}`, department: { kind: "organization-level" }, workScope: { kind: "organization" } } as never, dbDeps);
      assert.equal(p.status, "proposed", JSON.stringify(p));
      const a = await approveActionRequest(ctx, { requestId: p.status === "proposed" ? p.receipt.requestId : "", justification: APPROVE }, dbDeps);
      assert.equal(a.status, "authorized", JSON.stringify(a));
      const e = await executeRecordWork(ctx, { permitId: a.status === "authorized" ? a.permitId : "" }, dbDeps);
      assert.equal(e.status, "executed", JSON.stringify(e));
      return e.status === "executed" && e.outcome.status === "recorded" ? e.outcome.workItem.workItemId : "";
    };
    const plan = async (ctx: TenantContext, title: string): Promise<string> => {
      const r = await createWorkArtifact(ctx, { artifactType: "operational-plan", title, content: `${title}: step one, step two.` }, "operations", dbDeps);
      assert.equal(r.status, "created", JSON.stringify(r));
      return r.status === "created" ? r.artifactId : "";
    };
    const content = async (ctx: TenantContext, title: string): Promise<string> => {
      const r = await createWorkArtifact(
        ctx,
        { artifactType: "content-draft", title, content: `${title}: a caption for the new collection.`, intendedDestination: "instagram" },
        "operations",
        dbDeps,
      );
      assert.equal(r.status, "created", JSON.stringify(r));
      return r.status === "created" ? r.artifactId : "";
    };
    const link = async (ctx: TenantContext, workItemId: string, artifactId: string) => {
      const r = await declareWorkEvidenceReference(ctx, { workItemId, referent: { kind: "work-artifact", referentId: artifactId } }, dbDeps);
      assert.equal(r.status, "recorded", JSON.stringify(r));
    };
    const accept = async (ctx: TenantContext, artifactId: string) => {
      const revisionId = (await readWorkArtifactHistory(ctx, artifactId, dbDeps)).find((r) => r.current)!.id;
      const r = await acceptArtifactRevision(ctx, { artifactId, revisionId, justification: ACCEPT }, dbDeps);
      assert.equal(r.status, "reviewed", JSON.stringify(r));
    };
    const evidenceOf = async (ctx: TenantContext, workItemId: string, deps: object = {}) => {
      const outcome = await readWorkOutcomeEvidence(ctx, { getDb: () => handle.db, ...deps } as never);
      return outcome.status === "read" ? (outcome.byWorkItem[workItemId] ?? []) : null;
    };
    const suggest = async (ctx: TenantContext, workItemId: string, deps: object = {}): Promise<CompletionSuggestion> =>
      suggestCompletion({ declaredState: "planned", inService: true, evidence: await evidenceOf(ctx, workItemId, deps) });
    /* The real ledger: the register's answer and Heby's must agree. */
    const bothSurfaces = async (ctx: TenantContext, workItemId: string): Promise<CompletionSuggestion> => {
      const fromRegister = await suggest(ctx, workItemId);
      const choices = await readWorkDraftChoices(ctx, workItemId, dbDeps);
      assert.equal(choices.status, "read", JSON.stringify(choices));
      if (choices.status === "read") assert.deepEqual(choices.completion, fromRegister, "Heby and the Work register give the same answer");
      return fromRegister;
    };

    /* ── P1 · draft-only work: released behaviour ── */
    const notes = await work(acme);
    const notesPlan = await plan(acme, "Release notes plan");
    await link(acme, notes, notesPlan);
    await accept(acme, notesPlan);
    assert.deepEqual(await bothSurfaces(acme, notes), { offered: true }, "P1: an accepted plan still offers the suggestion");
    assert.equal((await evidenceOf(acme, notes))![0]!.publication, undefined, "P1: a plan carries no publication answer");

    /* ── P2 · publication-required: acceptance alone is not enough (REAL ledger: no request) ── */
    const launch = await work(acme);
    const caption = await content(acme, "Kilim launch caption");
    await link(acme, launch, caption);
    assert.deepEqual(await bothSurfaces(acme, launch), { offered: false, reason: "awaiting-review" }, "P2: review comes first");
    const requestsBefore = Number((await setup.query("select count(*)::int n from heby_action_requests")).rows[0].n);
    await accept(acme, caption);
    assert.equal((await evidenceOf(acme, launch))![0]!.publication, "pending", "P2: the real ledger holds no request for this revision");
    assert.deepEqual(await bothSurfaces(acme, launch), { offered: false, reason: "publication-pending" }, "P2: Governance acceptance is not publication");
    assert.equal(
      Number((await setup.query("select count(*)::int n from heby_action_requests")).rows[0].n),
      requestsBefore,
      "P2: reading the outcome files no request",
    );

    /* ── P3 · plan + content on one work ── */
    const launchPlan = await plan(acme, "Launch plan");
    await link(acme, launch, launchPlan);
    await accept(acme, launchPlan);
    assert.deepEqual(await bothSurfaces(acme, launch), { offered: false, reason: "publication-pending" }, "P3: the plan does not cover the content draft");

    /* ── P4 · tenant isolation ── */
    const foreign = await readWorkOutcomeEvidence(globex, dbDeps);
    assert.equal(foreign.status, "read");
    if (foreign.status === "read") {
      assert.equal(foreign.byWorkItem[launch], undefined, "P4: another organization reads none of this work");
      assert.equal(Object.values(foreign.byWorkItem).flat().length, 0, "P4: and no draft of this organization");
    }

    /* ── P5 · the ledger's answers, through the real composition ── */
    const ref = `work-artifact/${caption}@1`;
    const asked: { tenantId: string | undefined; revisions: unknown }[] = [];
    const ledger = (states: Record<string, ContentPublicationState> | "throw") =>
      ({
        readPublicationStates: (async (tenant, revisions) => {
          asked.push({ tenantId: tenant?.tenantId, revisions });
          if (states === "throw") throw new Error("ledger read failed");
          return new Map(Object.entries(states));
        }) as typeof readContentPublicationStates,
      });
    const recorded = (entries: PublicationHistoryEntry[], truncated = false): ContentPublicationState => ({ status: "recorded", artifactRef: ref, entries, truncated });
    const cases: [string, Record<string, ContentPublicationState> | "throw", CompletionSuggestion][] = [
      ["accepted attempt for exactly this revision", { [ref]: recorded([entry("execution-accepted")]) }, { offered: true }],
      ["accepted after an earlier failure", { [ref]: recorded([entry("execution-failed"), entry("execution-accepted")]) }, { offered: true }],
      ["accepted attempt for another artifact", { [`work-artifact/${randomUUID()}@1`]: recorded([entry("execution-accepted")]), [ref]: { status: "no-request-recorded", artifactRef: ref } }, { offered: false, reason: "publication-pending" }],
      ["accepted attempt for another revision only", { [`work-artifact/${caption}@2`]: recorded([entry("execution-accepted")]) }, { offered: false, reason: "publication-unavailable" }],
      ["accepted attempt to another destination", { [ref]: recorded([entry("execution-accepted", "youtube")]) }, { offered: false, reason: "publication-pending" }],
      ["request awaiting a decision", { [ref]: recorded([entry("request-pending")]) }, { offered: false, reason: "publication-pending" }],
      ["approved with an active permit", { [ref]: recorded([entry("permit-active")]) }, { offered: false, reason: "publication-pending" }],
      ["latest attempt failed", { [ref]: recorded([entry("execution-failed")]) }, { offered: false, reason: "publication-failed" }],
      ["latest attempt refused", { [ref]: recorded([entry("execution-refused")]) }, { offered: false, reason: "publication-failed" }],
      ["latest attempt outcome unknown", { [ref]: recorded([entry("execution-unknown")]) }, { offered: false, reason: "publication-failed" }],
      ["truncated history without an accepted attempt", { [ref]: recorded([entry("execution-failed")], true) }, { offered: false, reason: "publication-unavailable" }],
      ["truncated history with an accepted attempt", { [ref]: recorded([entry("execution-accepted")], true) }, { offered: true }],
      ["ledger unknown", { [ref]: { status: "unknown", artifactRef: ref, reason: "read-failed" } }, { offered: false, reason: "publication-unavailable" }],
      ["revision not answered", {}, { offered: false, reason: "publication-unavailable" }],
      ["read throws", "throw", { offered: false, reason: "publication-unavailable" }],
    ];
    for (const [label, states, expected] of cases) {
      assert.deepEqual(await suggest(acme, launch, ledger(states)), expected, `P5: ${label}`);
    }

    /* ── P6 · only content revisions, under the caller's tenant ── */
    for (const call of asked) {
      assert.equal(call.tenantId, acmeSeed.tenantId, "P6: the projection is asked under the caller's tenant");
      assert.deepEqual(call.revisions, [{ artifactId: caption, revisionNo: 1 }], "P6: only the content draft's current revision is asked about");
    }

    /* ── P7 · no database ── */
    const none = await readWorkOutcomeEvidence(acme, { getDb: () => null });
    assert.equal(none.status, "unavailable", "P7");
    assert.deepEqual(suggestCompletion({ declaredState: "planned", inService: true, evidence: null }), { offered: false, reason: "evidence-unknown" }, "P7");

    assert.equal(networkCalls, 0, "no network");
    finished = true;
    console.log("content-work-outcome-1 outcome-postgres: P1–P7 ok");
  } finally {
    await setup.end().catch(() => {});
    await (handle as { dispose?: () => Promise<void> }).dispose?.().catch?.(() => {});
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
