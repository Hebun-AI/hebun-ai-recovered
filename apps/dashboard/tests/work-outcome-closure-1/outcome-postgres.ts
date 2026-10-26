/*
 * WORK-OUTCOME-CLOSURE-1 — a work item's outcome read from the released Work, Work Artifacts and
 * Governance review records, and the completion suggestion they support. Real disposable PostgreSQL,
 * the released writers, no model and no network.
 *
 *   O1  a linked draft waiting for review: awaiting-review, nothing suggested (outcome read and Heby agree)
 *   O2  Governance accepts the current revision: suggested — and the acceptance changed no work row,
 *       created no action request and no permit, and the work stays declared planned (no automatic transition)
 *   O3  a newer revision is filed: the old acceptance does not cover it, awaiting-review again
 *   O4  multiple evidence: one draft with changes requested withholds the suggestion; a reversal to
 *       accepted offers it; a retired draft does not count; a draft whose review is unknown withholds it
 *   O5  tenant isolation: another organization reads none of this, cannot review these revisions and
 *       cannot read Heby's choices for this work
 *   O6  human declaration: a member without Governance authority is refused; the authority declares
 *       complete through the existing writer, the audit row names a human, and nothing is suggested after
 *   O7  a full evidence page (the read's bound) is not an answer: evidence-unknown, nothing suggested
 *   O8  no database: unavailable, nothing suggested
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { seedGovernanceAuthority } from "../helpers/agent-mandate-seed";
import { proposeRecordWorkAction } from "../../src/features/heby-action-inlet/record-work-proposal.server";
import { approveActionRequest } from "../../src/features/action-authorization/decide-action-request.server";
import { executeRecordWork } from "../../src/features/governed-internal-action/execute-record-work.server";
import { declareWorkEvidenceReference, setWorkDeclaredState } from "../../src/features/organizational-work/write-work.server";
import { MAX_WORK_EVIDENCE_REFERENCES } from "../../src/features/organizational-work/read-work-evidence.server";
import { createWorkArtifact, retireWorkArtifact, reviseWorkArtifact } from "../../src/features/work-artifacts/write-work-artifacts.server";
import { readWorkArtifactHistory } from "../../src/features/work-artifacts/read-work-artifacts.server";
import { acceptArtifactRevision, requestArtifactRevisionChanges } from "../../src/features/work-artifact-review/review-revision.server";
import { readWorkDraftChoices } from "../../src/features/agent-work/assign-work-draft.server";
import { readWorkOutcomeEvidence } from "../../src/features/work-outcome/read-work-outcome-evidence.server";
import { suggestCompletion, type CompletionSuggestion } from "../../src/features/work-outcome/contracts";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";

const APPROVE = "I have read this proposal and authorize it for the work outcome proof.";
const ACCEPT = "Accepted: this draft is fit for the next internal step of this work.";
const CHANGES = "Changes requested: the second step needs a named owner before it is usable.";

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
    mfaVerified: false, requestId: "woc1-request", authenticatedAt: new Date().toISOString(),
  });

async function addMember(client: Client, tenantId: string, email: string): Promise<Seeded> {
  const user = (await client.query<{ id: string }>(`insert into users (email, name) values ($1, $1) returning id`, [email])).rows[0]!.id;
  const identity = (await client.query<{ id: string }>(
    `insert into auth_identities (user_id, provider, issuer, subject, status, is_primary, verified_at)
     values ($1, 'local', 'hebun-local', $2, 'active', true, now()) returning id`,
    [user, `local:${email}`],
  )).rows[0]!.id;
  const role = (await client.query<{ id: string }>(`insert into roles (tenant_id, name, type) values ($1, $2, 'owner') returning id`, [tenantId, `Role ${email}`])).rows[0]!.id;
  const membership = (await client.query<{ id: string }>(
    `insert into memberships (tenant_id, user_id, role_id, status) values ($1, $2, $3, 'active') returning id`,
    [tenantId, user, role],
  )).rows[0]!.id;
  return { tenantId, userId: user, authIdentityId: identity, membershipId: membership, roleId: role };
}

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("work-outcome-closure-1/outcome-postgres: exited before completing");
    process.exitCode = 1;
  }
});

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_woc1_outcome");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const dbDeps = { getDb: () => handle.db } as never;
  const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await setup.query(sql, params)).rows as T[];
  const n = async (sql: string, params: unknown[] = []) => Number((await q<{ n: number }>(sql, params))[0]!.n);

  try {
    const acmeSeed = (await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme-woc1", email: "director@acme.test" })) as Seeded;
    const globexSeed = (await seedLocalIdentity(setup, { companyName: "Globex", companySlug: "globex-woc1", email: "director@globex.test" })) as Seeded;
    const acme = contextFor(acmeSeed, await sessionRow(setup, acmeSeed, "woc1-acme"));
    const globex = contextFor(globexSeed, await sessionRow(setup, globexSeed, "woc1-globex"));
    await seedGovernanceAuthority(setup, acmeSeed, dbDeps, { ctx: acme, sessionContextId: acme.sessionContextId });
    await seedGovernanceAuthority(setup, globexSeed, dbDeps, { ctx: globex, sessionContextId: globex.sessionContextId });
    const memberSeed = await addMember(setup, acmeSeed.tenantId, "member@acme.test");
    const member = contextFor(memberSeed, await sessionRow(setup, memberSeed, "woc1-member"));

    let titles = 0;
    const work = async (ctx: TenantContext): Promise<string> => {
      const p = await proposeRecordWorkAction(ctx, { title: `Quarter close ${++titles}`, department: { kind: "organization-level" }, workScope: { kind: "organization" } } as never, dbDeps);
      assert.equal(p.status, "proposed", JSON.stringify(p));
      const a = await approveActionRequest(ctx, { requestId: p.status === "proposed" ? p.receipt.requestId : "", justification: APPROVE }, dbDeps);
      assert.equal(a.status, "authorized", JSON.stringify(a));
      const e = await executeRecordWork(ctx, { permitId: a.status === "authorized" ? a.permitId : "" }, dbDeps);
      assert.equal(e.status, "executed", JSON.stringify(e));
      return e.status === "executed" && e.outcome.status === "recorded" ? e.outcome.workItem.workItemId : "";
    };
    const draft = async (ctx: TenantContext, title: string): Promise<string> => {
      const r = await createWorkArtifact(ctx, { artifactType: "operational-plan", title, content: `${title}: step one, step two.` }, "operations", dbDeps);
      assert.equal(r.status, "created", JSON.stringify(r));
      return r.status === "created" ? r.artifactId : "";
    };
    const link = async (ctx: TenantContext, workItemId: string, artifactId: string) => {
      const r = await declareWorkEvidenceReference(ctx, { workItemId, referent: { kind: "work-artifact", referentId: artifactId } }, dbDeps);
      assert.equal(r.status, "recorded", JSON.stringify(r));
    };
    const currentRevisionId = async (ctx: TenantContext, artifactId: string) =>
      (await readWorkArtifactHistory(ctx, artifactId, dbDeps)).find((r) => r.current)!.id;
    const accept = async (ctx: TenantContext, artifactId: string) => {
      const r = await acceptArtifactRevision(ctx, { artifactId, revisionId: await currentRevisionId(ctx, artifactId), justification: ACCEPT }, dbDeps);
      assert.equal(r.status, "reviewed", JSON.stringify(r));
    };
    const requestChanges = async (ctx: TenantContext, artifactId: string) => {
      const r = await requestArtifactRevisionChanges(ctx, { artifactId, revisionId: await currentRevisionId(ctx, artifactId), justification: CHANGES }, dbDeps);
      assert.equal(r.status, "reviewed", JSON.stringify(r));
    };
    /* Both surfaces' answers: the outcome read the register uses, and Heby's choices. They must agree. */
    const suggestion = async (ctx: TenantContext, workItemId: string): Promise<CompletionSuggestion> => {
      const outcome = await readWorkOutcomeEvidence(ctx, dbDeps);
      const state = (await q<{ declared_state: "planned" | "active" | "blocked" | "complete" }>("select declared_state from work_items where id = $1", [workItemId]))[0]!.declared_state;
      const fromRegister = suggestCompletion({
        declaredState: state,
        inService: true,
        evidence: outcome.status === "read" ? (outcome.byWorkItem[workItemId] ?? []) : null,
      });
      const choices = await readWorkDraftChoices(ctx, workItemId, dbDeps);
      assert.equal(choices.status, "read", JSON.stringify(choices));
      if (choices.status === "read") {
        assert.deepEqual(choices.completion, fromRegister, "Heby and the Work register give the same answer");
        assert.equal(choices.declaredState, state);
      }
      return fromRegister;
    };
    const workRow = async (id: string) =>
      (await q<{ h: string }>("select md5(row(w.*)::text) h from work_items w where id = $1", [id]))[0]!.h;

    /* ── O1 ── */
    const close = await work(acme);
    const plan = await draft(acme, "Close plan");
    await link(acme, close, plan);
    assert.deepEqual(await suggestion(acme, close), { offered: false, reason: "awaiting-review" }, "O1");

    /* ── O2 · acceptance suggests, and changes nothing else ── */
    const before = {
      row: await workRow(close),
      requests: await n("select count(*)::int n from heby_action_requests"),
      permits: await n("select count(*)::int n from action_permits"),
      workAudit: await n("select count(*)::int n from audit_log where entity_id = $1", [close]),
    };
    await accept(acme, plan);
    assert.deepEqual(await suggestion(acme, close), { offered: true }, "O2: every linked current revision accepted");
    assert.equal(await workRow(close), before.row, "O2: the review wrote nothing to the work item");
    assert.equal(await n("select count(*)::int n from audit_log where entity_id = $1", [close]), before.workAudit, "O2: no work audit row");
    assert.equal(await n("select count(*)::int n from heby_action_requests"), before.requests, "O2: no action request — acceptance is not publication or execution");
    assert.equal(await n("select count(*)::int n from action_permits"), before.permits, "O2: no permit minted");
    assert.equal((await q<{ s: string }>("select declared_state s from work_items where id = $1", [close]))[0]!.s, "planned", "O2: no automatic transition");

    /* ── O3 · the old acceptance does not cover a newer revision ── */
    const revised = await reviseWorkArtifact(acme, { artifactId: plan, content: "Close plan: step one, step two, step three." }, dbDeps);
    assert.equal(revised.status, "revised", JSON.stringify(revised));
    assert.deepEqual(await suggestion(acme, close), { offered: false, reason: "awaiting-review" }, "O3: revision 2 is unreviewed");
    await accept(acme, plan);
    assert.deepEqual(await suggestion(acme, close), { offered: true }, "O3: revision 2 accepted");

    /* ── O4 · multiple evidence ── */
    const checklist = await draft(acme, "Close checklist");
    await link(acme, close, checklist);
    assert.deepEqual(await suggestion(acme, close), { offered: false, reason: "awaiting-review" }, "O4: a second draft waits");
    await requestChanges(acme, checklist);
    assert.deepEqual(await suggestion(acme, close), { offered: false, reason: "changes-requested" }, "O4: changes requested withholds");
    await accept(acme, checklist);
    assert.deepEqual(await suggestion(acme, close), { offered: true }, "O4: the reversal is a new decision, and the latest wins");
    const stray = await draft(acme, "Abandoned note");
    await link(acme, close, stray);
    assert.deepEqual(await suggestion(acme, close), { offered: false, reason: "awaiting-review" }, "O4: an unreviewed third draft withholds");
    assert.equal((await retireWorkArtifact(acme, { artifactId: stray }, dbDeps)).status, "retired");
    assert.deepEqual(await suggestion(acme, close), { offered: true }, "O4: a retired draft does not count");
    const evidence = await readWorkOutcomeEvidence(acme, dbDeps);
    assert.equal(evidence.status, "read");
    if (evidence.status === "read") {
      assert.equal(evidence.byWorkItem[close]!.length, 3, "O4: all three declared drafts are listed");
      assert.deepEqual(evidence.byWorkItem[close]!.find((e) => e.artifactId === stray), {
        artifactId: stray, title: "Abandoned note", artifactType: "operational-plan", revisionNo: 1, retired: true, review: "awaiting-review",
      });
      assert.equal(evidence.byWorkItem[close]!.find((e) => e.artifactId === plan)!.revisionNo, 2, "O4: the current revision is reported");
    }
    /* A declared draft the review ledger cannot speak for (an unrecognised outcome) is unknown, and withholds. */
    const odd = await draft(acme, "Odd decision");
    await link(acme, close, odd);
    await accept(acme, odd);
    await setup.query("update decision_records set outcome = 'something-else' where subject_id = $1", [await currentRevisionId(acme, odd)]).catch(async () => {
      /* decision_records may be append-only; bypass the trigger only for this disposable database. */
      await setup.query("set session_replication_role = replica");
      await setup.query("update decision_records set outcome = 'something-else' where subject_id = $1", [await currentRevisionId(acme, odd)]);
      await setup.query("set session_replication_role = origin");
    });
    assert.deepEqual(await suggestion(acme, close), { offered: false, reason: "review-unknown" }, "O4: an unknown review withholds");
    assert.equal((await retireWorkArtifact(acme, { artifactId: odd }, dbDeps)).status, "retired");
    assert.deepEqual(await suggestion(acme, close), { offered: true });

    /* ── O5 · tenant isolation ── */
    const globexOutcome = await readWorkOutcomeEvidence(globex, dbDeps);
    assert.equal(globexOutcome.status, "read");
    if (globexOutcome.status === "read") assert.deepEqual(globexOutcome.byWorkItem, {}, "O5: another organization reads none of Acme's evidence");
    const crossChoices = await readWorkDraftChoices(globex, close, dbDeps);
    assert.deepEqual(crossChoices, { status: "refused", reason: "work-unresolved" }, "O5: Acme's work is not resolvable from Globex");
    const crossReview = await requestArtifactRevisionChanges(globex, { artifactId: plan, revisionId: await currentRevisionId(acme, plan), justification: CHANGES }, dbDeps);
    assert.deepEqual(crossReview, { status: "refused", reason: "revision-unresolvable" }, "O5: Globex cannot review Acme's revision");
    const globexWork = await work(globex);
    const globexDraft = await draft(globex, "Globex plan");
    await link(globex, globexWork, globexDraft);
    await requestChanges(globex, globexDraft);
    assert.deepEqual(await suggestion(acme, close), { offered: true }, "O5: Globex's decisions never reach Acme");
    const acmeOutcome = await readWorkOutcomeEvidence(acme, dbDeps);
    if (acmeOutcome.status === "read") assert.equal(acmeOutcome.byWorkItem[globexWork], undefined, "O5: and Globex's work is invisible to Acme");

    /* ── O6 · the human declaration, under the existing authority ── */
    const refused = await setWorkDeclaredState(member, { workItemId: close, declaredState: "complete" }, dbDeps);
    assert.deepEqual([refused.status, refused.status === "refused" ? refused.reason : ""], ["refused", "not-authorized"], "O6: no Governance authority, no declaration");
    const memberChoices = await readWorkDraftChoices(member, close, dbDeps);
    assert.equal(memberChoices.status === "read" && memberChoices.mayAssign, false, "O6: Heby knows the member may not declare");
    const declared = await setWorkDeclaredState(acme, { workItemId: close, declaredState: "complete" }, dbDeps);
    assert.equal(declared.status, "recorded", JSON.stringify(declared));
    const audit = (await q<{ actor_type: string; metadata: Record<string, unknown> }>(
      "select actor_type, metadata from audit_log where action = 'work.state-declared' and entity_id = $1 order by recorded_at desc limit 1",
      [close],
    ))[0]!;
    assert.equal(audit.actor_type, "human", "O6: the declaration is a person's");
    assert.equal(audit.metadata.declaredState, "complete");
    assert.deepEqual(await suggestion(acme, close), { offered: false, reason: "work-complete" }, "O6: nothing is suggested after");

    /* ── O7 · a full page is not an answer ── */
    const crowded = await work(acme);
    const crowdedDraft = await draft(acme, "Crowded plan");
    await link(acme, crowded, crowdedDraft);
    await accept(acme, crowdedDraft);
    assert.deepEqual(await suggestion(acme, crowded), { offered: true }, "O7: under the bound, an answer");
    const existing = await n("select count(*)::int n from work_evidence_references where tenant_id = $1 and withdrawn_at is null", [acmeSeed.tenantId]);
    const filler = await work(acme);
    for (let i = existing; i < MAX_WORK_EVIDENCE_REFERENCES; i++) await link(acme, filler, await draft(acme, `Filler ${i}`));
    assert.equal(await n("select count(*)::int n from work_evidence_references where tenant_id = $1 and withdrawn_at is null", [acmeSeed.tenantId]), MAX_WORK_EVIDENCE_REFERENCES);
    assert.deepEqual(await readWorkOutcomeEvidence(acme, dbDeps), { status: "unavailable" }, "O7: the read refuses a possibly partial page");
    assert.deepEqual(await suggestion(acme, crowded), { offered: false, reason: "evidence-unknown" }, "O7: and nothing is suggested");

    /* ── O8 · no database ── */
    assert.deepEqual(await readWorkOutcomeEvidence(acme, { getDb: () => null }), { status: "unavailable" }, "O8");
    assert.deepEqual(await readWorkOutcomeEvidence(null, dbDeps), { status: "unavailable" }, "O8: no tenant, no read");

    assert.equal(networkCalls, 0, "no network");
    finished = true;
    console.log("work-outcome-closure-1 outcome-postgres: O1–O8 ok");
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
