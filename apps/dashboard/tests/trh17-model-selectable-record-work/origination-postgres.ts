/*
 * TRH-17 — Heby SELECTS `record-work` and the proposal lands, against a REAL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "An organization with ZERO recipients, ZERO drafts and ZERO departments — Turkish Rug House's
 *    exact shape — states a goal, its durable agent selects `record-work` for itself, and a PENDING
 *    action request lands naming the agent. No Governance decision, no permit, no execution and no
 *    work item is created, `send` is still refused by the mandate ceiling, and the human `send`
 *    path is untouched."
 *
 * ── THE TWO GAPS THIS CLOSES, AND WHY BOTH HAD TO ────────────────────────────
 *
 * GIA-1 made `record-work` mandatable and gave it an agent-originated inlet with no caller.
 * TRH-16 made departmentless work legitimate. Neither made it REACHABLE, and the reason was not
 * only the model vocabulary: `candidatesAreProposable` required a recipient AND a draft, so an
 * organization with no recipient could not reach the model at all, whatever it could propose.
 * Section 1 proves that gate is what changed; section 3 proves the vocabulary is.
 *
 * No live provider: the transport is a fake returning exactly the text each case needs, through the
 * REAL generator, the REAL parser, the REAL candidate builder and the REAL inlet.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { seedAgentMandate } from "../helpers/agent-mandate-seed";
import { originateAgentAction } from "../../src/features/agent-origination/originate-action.server";
import {
  buildOriginationCandidates,
  candidatesAreProposable,
  recordWorkIsProposable,
  sendIsProposable,
} from "../../src/features/agent-origination/candidate-set.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { recordDepartment } from "../../src/features/organization-authority/write-structure.server";
import { formatDepartmentRef } from "../../src/features/organization-authority/department-ref";
import { proposeRecordWorkAction } from "../../src/features/heby-action-inlet/record-work-proposal.server";
import { createWorkArtifact } from "../../src/features/work-artifacts/write-work-artifacts.server";
import { createExternalRecipient } from "../../src/features/external-recipients/write-external-recipients.server";
import type { ClaudeTransport } from "../../src/features/heby-model";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date("2026-09-06T10:00:00.000Z");
const GOAL =
  "We re-warped the standing loom this week and nobody wrote it down. Get that on the record.";

const MODEL_ENV = {
  HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
  HEBUN_MODEL_PROVIDER: "claude",
  HEBUN_MODEL_ID: "claude-test",
  HEBUN_MODEL_CREDENTIAL: "present",
  HEBUN_MODEL_MAX_OUTPUT_TOKENS: "300",
} as const;

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
}

function contextFor(seeded: Seeded, requestId: string): TenantContext {
  return asHumanTenantContext({
    tenantId: seeded.tenantId,
    userId: seeded.userId,
    authIdentityId: seeded.authIdentityId,
    membershipId: seeded.membershipId,
    membershipVersion: 1,
    roleId: seeded.roleId,
    sessionContextId: "00000000-0000-4000-8000-000000000000",
    provider: "local",
    assuranceLevel: "aal1",
    mfaVerified: false,
    requestId,
    authenticatedAt: NOW.toISOString(),
  });
}

const TITLE = "Re-warp the standing loom";

function recordWorkEnvelope(scope: unknown, title: string = TITLE): string {
  return JSON.stringify({
    kind: "record-work",
    args: { title, scope },
    reason: "The loom work happened and this organization has no record of it.",
  });
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_trh17_origination");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);

  const dbDeps = { getDb: () => handle.db } as never;
  const writeDeps = { getDb: () => handle.db, now: () => NOW } as never;

  const countOf = async (table: string): Promise<number> =>
    (await setup.query<{ n: number }>(`select count(*)::int as n from ${table}`)).rows[0]!.n;

  const transportReturning = (text: string): ClaudeTransport => ({
    async send(request) {
      return {
        id: "req_trh17_fake",
        model: request.model,
        content: [{ type: "text", text }],
        stopReason: "end_turn",
        usage: { inputTokens: 90, outputTokens: 30 },
      };
    },
  });

  try {
    /* ═══════════════════════════════════════════════════════════════════════
     * 0. TURKISH RUG HOUSE'S EXACT SHAPE — and a second organization that has nothing at all.
     * ═════════════════════════════════════════════════════════════════════ */
    const trh = (await seedLocalIdentity(setup, {
      companyName: "Turkish Rug House",
      companySlug: "trh-trh17",
      email: "director@trh.test",
    })) as Seeded;
    const trhCtx = contextFor(trh, "trh17-trh");

    const agent = await createDurableAgentIdentity(trhCtx, { name: "Heby" }, writeDeps);
    assert.equal(agent.status, "established");
    const agentId = agent.status === "established" ? agent.identity.agentId : "";

    /* THE MANDATE IS EXACTLY TRH'S: record-work, and `send` withheld. */
    const mandate = await seedAgentMandate(setup, trh, agentId, writeDeps, {
      tag: "trh17",
      now: NOW,
      proposalScope: ["record-work"],
    });
    assert.equal(mandate.mandateRevision, 1);

    assert.equal(await countOf("external_recipients"), 0, "TRH has no recipient");
    assert.equal(await countOf("work_artifacts"), 0, "TRH has no draft");
    assert.equal(await countOf("departments"), 0, "TRH has no department, and that is legitimate");

    const candidateDeps = { recipients: dbDeps, artifacts: dbDeps, organization: dbDeps };
    const originationDeps = (text: string) =>
      ({
        resolveTenant: async () => trhCtx,
        env: MODEL_ENV,
        resolveDirectorEnabled: async () => true,
        selectTransport: () => ({ transport: transportReturning(text), transportProvenance: "fake" }),
        newCorrelationId: () => "corr-trh17",
        agentIdentity: dbDeps,
        candidates: candidateDeps,
        proposal: writeDeps,
        recordWork: writeDeps,
      }) as never;

    /* ═══════════════════════════════════════════════════════════════════════
     * 1. GAP 2 — ZERO SEND CANDIDATES NO LONGER SILENCES THE WHOLE RUNTIME.
     *
     * This is the gate that actually blocked Turkish Rug House. Before TRH-17 proposability was
     * `recipients > 0 && drafts > 0`, so this organization refused `no-candidates` BEFORE the model
     * was called — and widening the model vocabulary alone would have changed nothing for it.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const candidates = await buildOriginationCandidates(trhCtx, candidateDeps);
      assert.deepEqual(candidates.recipients, [], "nothing to send to");
      assert.deepEqual(candidates.drafts, [], "and nothing to send");
      assert.equal(sendIsProposable(candidates), false, "so a send is not proposable");

      assert.equal(
        candidates.work.organizationLevel,
        true,
        "but the organization itself is readable, so work about it can be proposed",
      );
      assert.deepEqual(
        candidates.work.departments,
        [],
        "with no departments — an empty list is a measured answer, not an unread state",
      );
      assert.equal(
        recordWorkIsProposable(candidates),
        true,
        "ZERO DEPARTMENTS != NOT PROPOSABLE — this is TRH-16's finding, reaching the candidate set",
      );
      assert.equal(
        candidatesAreProposable(candidates),
        true,
        "and the runtime is therefore reachable for an organization with no send candidates at all",
      );
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 2. NOTHING OF EITHER KIND STILL REFUSES — the gate was widened, not removed.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const unreadable = await buildOriginationCandidates(trhCtx, {
        recipients: dbDeps,
        artifacts: dbDeps,
        /* The organization seam cannot answer. UNREADABLE is not EMPTY. */
        organization: { getDb: () => null } as never,
      });
      assert.equal(unreadable.work.organizationLevel, false, "an unreadable organization offers nothing");
      assert.equal(recordWorkIsProposable(unreadable), false);
      assert.equal(sendIsProposable(unreadable), false);
      assert.equal(
        candidatesAreProposable(unreadable),
        false,
        "with neither kind proposable, the runtime still refuses before spending a model call",
      );

      let transportCalls = 0;
      const counting: ClaudeTransport = {
        async send(request) {
          transportCalls += 1;
          return transportReturning(recordWorkEnvelope({ kind: "organization-level" })).send(request);
        },
      };
      const refused = await originateAgentAction(
        { goal: GOAL },
        {
          resolveTenant: async () => trhCtx,
          env: MODEL_ENV,
          resolveDirectorEnabled: async () => true,
          selectTransport: () => ({ transport: counting, transportProvenance: "fake" }),
          agentIdentity: dbDeps,
          candidates: {
            recipients: dbDeps,
            artifacts: dbDeps,
            organization: { getDb: () => null },
          },
          proposal: writeDeps,
          recordWork: writeDeps,
        } as never,
      );
      assert.equal(refused.status, "refused");
      assert.equal(refused.status === "refused" ? refused.reason : "", "no-candidates");
      assert.equal(transportCalls, 0, "and NO model call was made — nothing was spent to learn this");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 3. GAP 1 — THE AGENT SELECTS `record-work`, AND A PENDING REQUEST LANDS.
     * ═════════════════════════════════════════════════════════════════════ */
    const requestsBefore = await countOf("heby_action_requests");
    assert.equal(requestsBefore, 0, "nothing is pending before the agent is asked");

    const proposed = await originateAgentAction(
      { goal: GOAL },
      originationDeps(recordWorkEnvelope({ kind: "organization-level" })),
    );
    assert.equal(
      proposed.status,
      "proposed",
      `TRH's Heby originated a record-work proposal (got ${JSON.stringify(proposed)})`,
    );
    if (proposed.status !== "proposed") throw new Error("unreachable");
    assert.equal(proposed.kind, "record-work", "and the result names WHICH action it chose");

    /* ═══════════════════════════════════════════════════════════════════════
     * 4. PENDING ONLY. PROPOSED != AUTHORIZED != PERMITTED != EXECUTED.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      assert.equal(await countOf("heby_action_requests"), 1, "EXACTLY ONE request was filed");
      assert.equal(await countOf("action_permits"), 0, "PROPOSED != PERMITTED — nothing was minted");
      assert.equal(await countOf("action_execution_attempts"), 0, "and nothing was executed");
      assert.equal(await countOf("work_items"), 0, "PROPOSED != RECORDED — the work register is empty");

      const row = (
        await setup.query<{
          status: string;
          actionKind: string;
          proposedByActorType: string | null;
          proposedByActorId: string | null;
          createdBy: string | null;
          targetKind: string | null;
          targetRef: string | null;
          canonicalPayload: unknown;
        }>(
          `select status, action_kind as "actionKind",
                  proposed_by_actor_type as "proposedByActorType",
                  proposed_by_actor_id as "proposedByActorId",
                  created_by as "createdBy",
                  target_kind as "targetKind", target_ref as "targetRef",
                  canonical_payload as "canonicalPayload"
             from heby_action_requests limit 1`,
        )
      ).rows[0]!;

      assert.equal(row.status, "pending", "it is waiting for a human — it is not decided");
      assert.equal(row.actionKind, "record-work", "the REGISTRY kind, not the model's alias");
      assert.equal(row.proposedByActorType, "agent", "THE PROPOSER IS THE AGENT");
      assert.equal(row.proposedByActorId, agentId, "and it is the REAL durable agent identity");
      assert.equal(
        row.createdBy,
        trh.userId,
        "while the human whose session caused the write is recorded separately — two facts, not one",
      );

      /*
       * THE MODEL-AUTHORED TITLE IS VISIBLE TO THE HUMAN BEFORE THE DECISION.
       *
       * A title a Director cannot read before deciding would make human review a formality. It is
       * in the payload the approval surface renders, VERBATIM — not summarized, not rewritten.
       */
      const payload = JSON.stringify(row.canonicalPayload);
      assert.ok(
        payload.includes(TITLE),
        `the agent's own title is in the pending payload a human reads (got ${payload})`,
      );

      /* NO TENANT ID, NO AGENT ID AND NO AUTHORIZATION FACT CAME FROM THE MODEL. */
      assert.ok(!payload.includes("approved"), "the payload carries no approval");
      assert.ok(!payload.includes("permit"), "and no permit");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 5. THE MANDATE CEILING IS STILL NECESSARY — `send` IS REFUSED FOR TRH.
     *
     * The agent is now offered a vocabulary of two. Its mandate admits one. The refusal comes from
     * the ONE enforcement seam, after the selection — not from hiding the option.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const before = await countOf("heby_action_requests");
      const sendAttempt = await originateAgentAction(
        { goal: GOAL },
        originationDeps(
          JSON.stringify({
            kind: "send",
            args: {
              recipientRef: "external-recipient/0f2b7d1a-3c4e-4a5b-8c9d-0e1f2a3b4c5d",
              draftRef: "work-artifact/1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5e@1",
            },
            reason: "Trying to send.",
          }),
        ),
      );
      assert.equal(sendAttempt.status, "refused", "TRH's agent cannot send");
      assert.equal(
        sendAttempt.status === "refused" ? sendAttempt.reason : "",
        "reference-not-offered",
        "and it is refused at the candidate membership check, because TRH offered no send candidates",
      );
      assert.equal(await countOf("heby_action_requests"), before, "no row was filed");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 5b. THE CEILING ITSELF REFUSES `send` — proved where membership CANNOT.
     *
     * Section 5 is honest but insufficient on its own: TRH offers no send candidates, so the
     * membership check refuses before the mandate is ever consulted. A guard that never runs is
     * not a guard that works. This organization HAS a recipient and a draft, so a send selection
     * passes membership and reaches the ONE enforcement seam with TRH's mandate shape.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const shop = (await seedLocalIdentity(setup, {
        companyName: "Kilim Shop",
        companySlug: "kilim-trh17",
        email: "director@kilim.test",
      })) as Seeded;
      const shopCtx = contextFor(shop, "trh17-shop");

      const shopAgent = await createDurableAgentIdentity(shopCtx, { name: "Heby" }, writeDeps);
      assert.equal(shopAgent.status, "established");
      const shopAgentId = shopAgent.status === "established" ? shopAgent.identity.agentId : "";
      /* TRH'S MANDATE SHAPE, on an organization that CAN send. `send` is withheld. */
      await seedAgentMandate(setup, shop, shopAgentId, writeDeps, {
        tag: "trh17kilim",
        now: NOW,
        proposalScope: ["record-work"],
      });

      const recipient = await createExternalRecipient(
        shopCtx,
        { displayName: "Ayşe Yılmaz", endpointKind: "email", endpointValue: "ayse@example.test" },
        writeDeps,
      );
      assert.equal(recipient.status, "created");
      const recipientRef = recipient.status === "created" ? recipient.recipient.recordRef : "";
      const draft = await createWorkArtifact(
        shopCtx,
        { artifactType: "message-draft", title: "Quarterly summary", content: "Merhaba Ayşe," },
        "operations",
        writeDeps,
      );
      assert.equal(draft.status, "created");
      const draftRef = draft.status === "created" ? draft.ref : "";

      const shopCandidates = await buildOriginationCandidates(shopCtx, candidateDeps);
      assert.equal(
        sendIsProposable(shopCandidates),
        true,
        "this organization CAN send, so membership will not be what refuses",
      );

      const before = await countOf("heby_action_requests");
      const refusedByCeiling = await originateAgentAction(
        { goal: GOAL },
        {
          resolveTenant: async () => shopCtx,
          env: MODEL_ENV,
          resolveDirectorEnabled: async () => true,
          selectTransport: () => ({
            transport: transportReturning(
              JSON.stringify({
                kind: "send",
                args: { recipientRef, draftRef },
                reason: "Ayşe is waiting on the summary.",
              }),
            ),
            transportProvenance: "fake",
          }),
          newCorrelationId: () => "corr-trh17-kilim",
          agentIdentity: dbDeps,
          candidates: candidateDeps,
          proposal: writeDeps,
          recordWork: writeDeps,
        } as never,
      );
      assert.equal(refusedByCeiling.status, "refused", "a send outside the mandate files nothing");
      assert.equal(
        refusedByCeiling.status === "refused" ? refusedByCeiling.reason : "",
        "proposal-refused",
        "the selection was valid; the AUTHORITY refused it",
      );
      assert.equal(
        refusedByCeiling.status === "refused" ? refusedByCeiling.detail : "",
        "action-outside-agent-mandate",
        "THE MANDATE CEILING IS WHAT REFUSED, and it says so distinguishably",
      );
      assert.equal(await countOf("heby_action_requests"), before, "and no row was filed");

      /* THE SAME AGENT, THE SAME MANDATE, THE ADMITTED KIND — the ceiling is a bound, not a wall. */
      const admitted = await originateAgentAction(
        { goal: GOAL },
        {
          resolveTenant: async () => shopCtx,
          env: MODEL_ENV,
          resolveDirectorEnabled: async () => true,
          selectTransport: () => ({
            transport: transportReturning(recordWorkEnvelope({ kind: "organization-level" })),
            transportProvenance: "fake",
          }),
          newCorrelationId: () => "corr-trh17-kilim2",
          agentIdentity: dbDeps,
          candidates: candidateDeps,
          proposal: writeDeps,
          recordWork: writeDeps,
        } as never,
      );
      assert.equal(
        admitted.status,
        "proposed",
        `the kind the mandate DOES admit is filed (${JSON.stringify(admitted)})`,
      );
      assert.equal(await countOf("heby_action_requests"), before + 1, "exactly one more request");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 6. A DEPARTMENT IS RESOLVED FROM TRUSTED CANDIDATES, BY SLUG, NEVER BY THE MODEL.
     * ═════════════════════════════════════════════════════════════════════ */
    const dept = await recordDepartment(trhCtx, { name: "Loom Floor", slug: "loom-floor" }, writeDeps);
    assert.equal(dept.status, "recorded");
    const departmentId = dept.status === "recorded" ? dept.department.departmentId : "";
    const departmentRef = formatDepartmentRef(departmentId);

    {
      const candidates = await buildOriginationCandidates(trhCtx, candidateDeps);
      assert.deepEqual(
        candidates.work.departments.map((d) => d.slug),
        ["loom-floor"],
        "the in-service department is offered BY SLUG",
      );
      assert.equal(
        candidates.work.departments[0]!.departmentRef,
        departmentRef,
        "and the authoritative reference is minted server-side, from an id the model never sees",
      );

      const before = await countOf("heby_action_requests");
      const scoped = await originateAgentAction(
        { goal: GOAL },
        originationDeps(
          recordWorkEnvelope(
            { kind: "department", departmentSlug: "loom-floor" },
            "Re-warp the standing loom on the floor",
          ),
        ),
      );
      assert.equal(scoped.status, "proposed", `a department-scoped proposal lands (${JSON.stringify(scoped)})`);
      assert.equal(await countOf("heby_action_requests"), before + 1, "exactly one more request");
      if (scoped.status !== "proposed") throw new Error("unreachable");

      /*
       * ADDRESSED BY THE RECEIPT'S OWN ID, never by "the newest row". Every write in this suite
       * shares one frozen clock, so `order by created_at` names an arbitrary row rather than this
       * one — an ordering that would make this assertion true or false by luck.
       */
      const scopedRow = (
        await setup.query<{ targetRef: string | null; canonicalPayload: unknown }>(
          `select target_ref as "targetRef", canonical_payload as "canonicalPayload"
             from heby_action_requests where id = $1`,
          [scoped.proposal.receipt.requestId],
        )
      ).rows[0]!;
      const payload = JSON.stringify(scopedRow.canonicalPayload);
      assert.ok(
        payload.includes(departmentRef),
        `the FILED proposal carries the authoritative reference the server resolved, not the slug the model named (got ${payload})`,
      );
      assert.ok(
        !payload.includes('"loom-floor"'),
        "and the slug the model named is NOT what was frozen into the approval",
      );
      assert.equal(
        scopedRow.targetRef,
        departmentRef,
        "the action targets the real department row",
      );

      /* ═══════════════════════════════════════════════════════════════════
       * NO DATABASE IDENTIFIER REACHES THE MODEL — captured at the real seam.
       *
       * `DepartmentCandidate` carries `departmentRef` so trusted code can resolve the chosen slug
       * inside the very list that was offered. That field is one careless template literal away
       * from being rendered into the prompt, and nothing about the type would stop it. So the
       * REAL `ModelGenerationRequest` is captured here, with a REAL department present, and the
       * reference is asserted absent from what the model was actually told.
       * ═══════════════════════════════════════════════════════════════════ */
      let captured: { readonly evidence?: readonly string[] } | null = null;
      await originateAgentAction(
        { goal: GOAL },
        {
          resolveTenant: async () => trhCtx,
          env: MODEL_ENV,
          resolveDirectorEnabled: async () => true,
          selectTransport: () => ({ transport: transportReturning("{}"), transportProvenance: "fake" }),
          newCorrelationId: () => "corr-trh17-capture",
          agentIdentity: dbDeps,
          candidates: candidateDeps,
          proposal: writeDeps,
          recordWork: writeDeps,
          generate: async (request: { readonly evidence?: readonly string[] }) => {
            captured = request;
            return { status: "refused", state: "not-configured" };
          },
        } as never,
      );
      assert.ok(captured, "the generator was reached, so there is a prompt to inspect");
      const grounding = ((captured as { evidence?: readonly string[] }).evidence ?? []).join("\n");

      assert.ok(
        grounding.includes("departmentSlug=loom-floor"),
        `the department is offered by the organization's OWN slug (got: ${grounding})`,
      );
      assert.ok(grounding.includes("Loom Floor"), "and by its recorded name, verbatim");
      assert.ok(
        grounding.includes("organization-level is available"),
        "and the departmentless truth is offered alongside it",
      );
      assert.ok(
        !grounding.includes("department/"),
        `NO department reference is rendered (got: ${grounding})`,
      );
      assert.ok(
        !/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(grounding),
        `NO uuid of any kind is rendered (got: ${grounding})`,
      );
      assert.ok(!grounding.includes(trh.tenantId), "no tenant id");
      assert.ok(!grounding.includes(agentId), "and no agent id");

      /* ── A FABRICATED DEPARTMENT IS REFUSED, AND FILES NOTHING ── */
      const after = await countOf("heby_action_requests");
      const invented = await originateAgentAction(
        { goal: GOAL },
        originationDeps(recordWorkEnvelope({ kind: "department", departmentSlug: "finance" })),
      );
      assert.equal(invented.status, "refused", "an invented department is refused");
      assert.equal(
        invented.status === "refused" ? invented.reason : "",
        "reference-not-offered",
        "before any authority is asked to resolve it",
      );
      assert.equal(await countOf("heby_action_requests"), after, "and nothing was filed");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 7. STILL NOTHING AUTHORIZED, PERMITTED OR EXECUTED — after everything above.
     * ═════════════════════════════════════════════════════════════════════ */
    assert.equal(await countOf("action_permits"), 0, "no permit exists");
    assert.equal(await countOf("action_execution_attempts"), 0, "no execution was attempted");
    assert.equal(await countOf("work_items"), 0, "and no organizational work was recorded");
    assert.equal(
      (await setup.query<{ n: number }>(
        `select count(*)::int as n from heby_action_requests where status <> 'pending'`,
      )).rows[0]!.n,
      0,
      "every request this suite filed is still PENDING — nothing was decided",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 8. THE HUMAN PATH IS UNTOUCHED — it still records a HUMAN proposer.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const human = await proposeRecordWorkAction(
        trhCtx,
        { title: "A human typed this one", department: { kind: "organization-level" } },
        writeDeps,
      );
      assert.equal(human.status, "proposed", "a person may still propose record-work directly");
      if (human.status !== "proposed") throw new Error("unreachable");
      const row = (
        await setup.query<{ proposedByActorType: string | null }>(
          `select proposed_by_actor_type as "proposedByActorType"
             from heby_action_requests where id = $1`,
          [human.receipt.requestId],
        )
      ).rows[0]!;
      assert.equal(
        row.proposedByActorType,
        "human",
        "TWO PATHS, TWO TRUTHS — teaching the model to select did not make the human path lie",
      );
    }

    console.log("PASS trh17-model-selectable-record-work origination (postgres)");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase().catch(() => {});
  }
}

void main();
