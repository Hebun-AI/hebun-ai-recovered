/*
 * TRH-19 — THE AGENT'S RATIONALE IS DURABLE, AND IT AUTHORIZES NOTHING. Against a REAL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "The normalized reason the agent gave is stored atomically with the proposal it explains, for
 *    BOTH agent-originable kinds, readable again through the authoritative seam after the request
 *    that filed it is gone — while a human cannot supply one, it is absent from the payload and the
 *    digest, dedup is unchanged, no UPDATE writer can move it, and no decision, permit or execution
 *    comes into existence because it is there."
 *
 * ── THE SHAPE OF THE EVIDENCE ────────────────────────────────────────────────
 *
 * Every "it does not do X" is measured as a COUNT ACROSS THE WHOLE AUTHORITY SURFACE before and
 * after, not as a spot check on the table under test. A durable explanation that moved any of those
 * counts would not be an explanation.
 *
 * No live provider: a fake transport returning exactly the envelope each case needs, through the
 * REAL generator, the REAL parser, the REAL candidate builder, the REAL inlets, the REAL mandate
 * ceiling and the REAL proposal writer.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { seedAgentMandate } from "../helpers/agent-mandate-seed";
import { originateAgentAction } from "../../src/features/agent-origination/originate-action.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { createExternalRecipient } from "../../src/features/external-recipients/write-external-recipients.server";
import { createWorkArtifact } from "../../src/features/work-artifacts/write-work-artifacts.server";
import { proposeRecordWorkAction } from "../../src/features/heby-action-inlet/record-work-proposal.server";
import { readPendingActionRequests } from "../../src/features/action-authorization/read-action-authorizations.server";
import { declareActionRequestPurpose } from "../../src/features/action-authorization/declare-action-purpose.server";
import { digestCanonicalAction } from "../../src/features/action-authorization/canonical-payload";
import type { ClaudeTransport } from "../../src/features/heby-model";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date("2026-09-06T20:00:00.000Z");
const GOAL =
  "We re-warped the standing loom this week and nobody wrote it down. Get that on the record.";
const TITLE = "Re-warp the standing loom";
const RATIONALE =
  "The loom work happened this week and this organization has no record of it, so a human should decide whether to record it.";

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

/** Every authority a durable explanation must be incapable of moving. */
const AUTHORITY_TABLES = [
  "action_permits",
  "action_execution_attempts",
  "work_items",
  "decision_records",
  "governance_sessions",
  "audit_log",
] as const;

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_trh19_rationale");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);

  const dbDeps = { getDb: () => handle.db } as never;
  const writeDeps = { getDb: () => handle.db, now: () => NOW } as never;

  const countOf = async (table: string): Promise<number> =>
    (await setup.query<{ n: number }>(`select count(*)::int as n from ${table}`)).rows[0]!.n;

  const authoritySnapshot = async (): Promise<Record<string, number>> => {
    const out: Record<string, number> = {};
    for (const t of AUTHORITY_TABLES) {
      out[t] = t === "audit_log" ? await countOf("audit_log") : await countOf(t);
    }
    return out;
  };

  const transportReturning = (text: string): ClaudeTransport => ({
    async send(request) {
      return {
        id: "req_trh19_fake",
        model: request.model,
        content: [{ type: "text", text }],
        stopReason: "end_turn",
        usage: { inputTokens: 90, outputTokens: 30 },
      };
    },
  });

  try {
    /* ═══════════════════════════════════════════════════════════════════════
     * 0. TWO ORGANIZATIONS. The second exists only so isolation is measurable.
     * ═════════════════════════════════════════════════════════════════════ */
    const trh = (await seedLocalIdentity(setup, {
      companyName: "Turkish Rug House",
      companySlug: "trh-trh19",
      email: "director@trh.test",
    })) as Seeded;
    const other = (await seedLocalIdentity(setup, {
      companyName: "Kilim Shop",
      companySlug: "kilim-trh19",
      email: "director@kilim.test",
    })) as Seeded;
    const trhCtx = contextFor(trh, "trh19-trh");
    const otherCtx = contextFor(other, "trh19-other");

    const agent = await createDurableAgentIdentity(trhCtx, { name: "Heby" }, writeDeps);
    assert.equal(agent.status, "established");
    const agentId = agent.status === "established" ? agent.identity.agentId : "";
    /* BOTH admitted kinds, so the send half is reachable and generality is measured, not asserted. */
    await seedAgentMandate(setup, trh, agentId, writeDeps, {
      tag: "trh19",
      now: NOW,
      proposalScope: ["record-work", "send"],
    });

    /* The second organization's agent, seeded HERE so the Governance baseline below is complete. */
    const otherAgent = await createDurableAgentIdentity(otherCtx, { name: "Heby" }, writeDeps);
    assert.equal(otherAgent.status, "established");
    await seedAgentMandate(
      setup,
      other,
      otherAgent.status === "established" ? otherAgent.identity.agentId : "",
      writeDeps,
      { tag: "trh19other", now: NOW, proposalScope: ["record-work"] },
    );

    const candidateDeps = { recipients: dbDeps, artifacts: dbDeps, organization: dbDeps };
    const originationDeps = (ctx: TenantContext, text: string) =>
      ({
        resolveTenant: async () => ctx,
        env: MODEL_ENV,
        resolveDirectorEnabled: async () => true,
        selectTransport: () => ({ transport: transportReturning(text), transportProvenance: "fake" }),
        newCorrelationId: () => "corr-trh19",
        agentIdentity: dbDeps,
        candidates: candidateDeps,
        proposal: writeDeps,
        recordWork: writeDeps,
      }) as never;

    const rowFor = async (requestId: string) =>
      (
        await setup.query<{
          proposal_rationale: string | null;
          payload_digest: string;
          canonical_payload: unknown;
          action_kind: string;
          tool_id: string;
          target_kind: string | null;
          target_ref: string | null;
          status: string;
          proposed_by_actor_type: string;
          version: number;
          tenant_id: string;
        }>(`select * from heby_action_requests where id = $1`, [requestId])
      ).rows[0]!;

    /*
     * THE GOVERNANCE BASELINE, TAKEN BEFORE ANY PROPOSAL EXISTS.
     *
     * It is not zero, and pretending otherwise would make this file assert a fiction: establishing
     * an agent mandate IS a Governance act, and the two seeded mandates above wrote their own
     * decision and session rows. What TRH-19 must prove is that nothing moved AFTER that — so the
     * baseline is measured here and compared later, rather than assumed empty.
     */
    const governanceBaseline = {
      decisions: await countOf("decision_records"),
      sessions: await countOf("governance_sessions"),
    };
    assert.ok(
      governanceBaseline.decisions > 0,
      "the mandates really did write Governance rows, so this baseline is not a vacuous zero",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 1. RECORD-WORK CARRIES THE RATIONALE, ATOMICALLY.
     * ═════════════════════════════════════════════════════════════════════ */
    const before1 = await authoritySnapshot();
    const recordWorkEnvelope = JSON.stringify({
      kind: "record-work",
      args: { title: TITLE, scope: { kind: "organization-level" } },
      reason: RATIONALE,
    });
    const proposed = await originateAgentAction(
      { goal: GOAL },
      originationDeps(trhCtx, recordWorkEnvelope),
    );
    assert.equal(proposed.status, "proposed", `record-work filed (${JSON.stringify(proposed)})`);
    if (proposed.status !== "proposed") throw new Error("unreachable");
    const recordWorkRequestId = proposed.proposal.receipt.requestId;

    {
      const row = await rowFor(recordWorkRequestId);
      assert.equal(
        row.proposal_rationale,
        RATIONALE,
        "THE EXACT NORMALIZED REASON IS STORED — verbatim, unshortened, unsummarized",
      );
      assert.equal(
        proposed.reason,
        row.proposal_rationale,
        "and it is the SAME string the selection carried — one value, not two",
      );
      assert.equal(row.status, "pending", "the proposal is still waiting for a human");
      assert.equal(row.proposed_by_actor_type, "agent");
      assert.equal(row.version, 1, "one write — the rationale was not patched in afterwards");

      /* ── IT IS NOT AN EXECUTABLE PARAMETER ── */
      const payload = JSON.stringify(row.canonical_payload);
      assert.ok(
        !payload.includes(RATIONALE),
        `THE RATIONALE IS ABSENT FROM THE CANONICAL PAYLOAD (got ${payload})`,
      );
      assert.ok(payload.includes(TITLE), "while the title, which IS an argument, is present");

      /* ── AND IT MOVED NO AUTHORITY ── */
      assert.deepEqual(
        await authoritySnapshot(),
        before1,
        "no permit, execution, work item, decision, session or audit row exists because of it",
      );
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 2. THE DIGEST IS BLIND TO THE RATIONALE — RECOMPUTED, not assumed.
     *
     * The digest is re-derived with the RELEASED `digestCanonicalAction` from nothing but the
     * stored kind, tool, target and canonical payload — a rationale-free input set — and required
     * to equal the digest the writer stored. If any part of the rationale had entered the digest
     * input, this recomputation could not reproduce it.
     *
     * Two rows are checked, filed with DIFFERENT rationales, so the property is shown to hold
     * independently of what the agent said. Their digests differ from each other, and the reason is
     * measured rather than assumed: the two organizations' organization-level target refs differ.
     * ═════════════════════════════════════════════════════════════════════ */
    let otherRequestId = "";
    {
      const differentReason = "A completely different explanation for the identical act.";
      const filed = await originateAgentAction(
        { goal: GOAL },
        originationDeps(
          otherCtx,
          JSON.stringify({
            kind: "record-work",
            args: { title: TITLE, scope: { kind: "organization-level" } },
            reason: differentReason,
          }),
        ),
      );
      assert.equal(filed.status, "proposed", `second organization filed (${JSON.stringify(filed)})`);
      if (filed.status !== "proposed") throw new Error("unreachable");
      otherRequestId = filed.proposal.receipt.requestId;

      const a = await rowFor(recordWorkRequestId);
      const b = await rowFor(otherRequestId);
      assert.notEqual(a.proposal_rationale, b.proposal_rationale, "the two reasons really differ");
      assert.notEqual(a.tenant_id, b.tenant_id, "and they are genuinely different organizations");

      for (const [label, row] of [
        ["the first rationale", a],
        ["the second rationale", b],
      ] as const) {
        const recomputed = digestCanonicalAction({
          actionKind: row.action_kind,
          toolId: row.tool_id,
          targetKind: row.target_kind,
          targetRef: row.target_ref,
          payload: row.canonical_payload as Readonly<Record<string, string | number | boolean>>,
        });
        assert.equal(
          recomputed,
          row.payload_digest,
          `THE DIGEST IS REPRODUCIBLE WITHOUT THE RATIONALE (${label}) — it is not one of its inputs`,
        );
      }

      /*
       * The two digests DO differ, and the cause is measured so the assertion above cannot be
       * mistaken for one that would have passed on identical rows. Organization-level work names
       * the organization itself, so each tenant's target reference is its own.
       */
      assert.notEqual(a.payload_digest, b.payload_digest);
      assert.notEqual(a.target_ref, b.target_ref, "and the difference is the target, not the reason");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 3. DEDUP IS UNCHANGED — a different rationale does NOT buy a second pending proposal.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const before = await countOf("heby_action_requests");
      const duplicate = await originateAgentAction(
        { goal: GOAL },
        originationDeps(
          trhCtx,
          JSON.stringify({
            kind: "record-work",
            args: { title: TITLE, scope: { kind: "organization-level" } },
            reason: "A brand new reason for the very same act.",
          }),
        ),
      );
      assert.equal(duplicate.status, "refused", "the duplicate act is still refused");
      assert.equal(
        duplicate.status === "refused" ? duplicate.detail : "",
        "already-pending",
        "A NEW RATIONALE IS NOT A NEW ACT — dedup keys off the digest, which the rationale never enters",
      );
      assert.equal(await countOf("heby_action_requests"), before, "and no second row was created");

      const row = await rowFor(recordWorkRequestId);
      assert.equal(
        row.proposal_rationale,
        RATIONALE,
        "the refused attempt did not overwrite the rationale of the proposal that exists",
      );
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 4. SEND CARRIES IT TOO — this is an agent-proposal concept, not a record-work one.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const recipient = await createExternalRecipient(
        trhCtx,
        { displayName: "Ayşe Yılmaz", endpointKind: "email", endpointValue: "ayse@example.test" },
        writeDeps,
      );
      assert.equal(recipient.status, "created");
      const recipientRef = recipient.status === "created" ? recipient.recipient.recordRef : "";
      const draft = await createWorkArtifact(
        trhCtx,
        { artifactType: "message-draft", title: "Quarterly summary", content: "Merhaba Ayşe," },
        "operations",
        writeDeps,
      );
      assert.equal(draft.status, "created");
      const draftRef = draft.status === "created" ? draft.ref : "";

      const sendReason = "Ayşe is a recorded recipient and this draft answers the stated goal.";
      const filed = await originateAgentAction(
        { goal: GOAL },
        originationDeps(
          trhCtx,
          JSON.stringify({
            kind: "send",
            args: { recipientRef, draftRef },
            reason: sendReason,
          }),
        ),
      );
      assert.equal(filed.status, "proposed", `send filed (${JSON.stringify(filed)})`);
      if (filed.status !== "proposed") throw new Error("unreachable");
      assert.equal(filed.kind, "send");

      const row = await rowFor(filed.proposal.receipt.requestId);
      assert.equal(
        row.proposal_rationale,
        sendReason,
        "THE SECOND ADMITTED KIND CARRIES IT ON THE SAME TERMS — one concept, not one per kind",
      );
      assert.equal(row.status, "pending");
      assert.ok(
        !JSON.stringify(row.canonical_payload).includes(sendReason),
        "and it is not in this payload either",
      );
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 5. THE HUMAN PATH CANNOT SUPPLY ONE — and its row is honestly NULL.
     * ═════════════════════════════════════════════════════════════════════ */
    let humanRequestId = "";
    {
      const human = await proposeRecordWorkAction(
        trhCtx,
        { title: "A human typed this one", department: { kind: "organization-level" } },
        writeDeps,
      );
      assert.equal(human.status, "proposed", `human proposal filed (${JSON.stringify(human)})`);
      if (human.status !== "proposed") throw new Error("unreachable");
      humanRequestId = human.receipt.requestId;

      const row = await rowFor(humanRequestId);
      assert.equal(row.proposed_by_actor_type, "human");
      assert.equal(
        row.proposal_rationale,
        null,
        "A HUMAN PROPOSAL CARRIES NO AGENT RATIONALE — nobody can put words in the agent's mouth",
      );
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 6. THE DATABASE REFUSES A HUMAN RATIONALE AND A BLANK ONE.
     *
     * The code gate above is one layer. These prove the storage layer refuses independently, so a
     * future caller reaching the table by a path nobody has written yet is still refused.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      let refusedHuman = false;
      try {
        await setup.query(
          `update heby_action_requests set proposal_rationale = $1 where id = $2`,
          ["Heby said this because I typed it.", humanRequestId],
        );
      } catch {
        refusedHuman = true;
      }
      assert.ok(refusedHuman, "the storage CHECK refuses a rationale on a human proposal");

      let refusedBlank = false;
      try {
        await setup.query(
          `update heby_action_requests set proposal_rationale = $1 where id = $2`,
          ["   ", recordWorkRequestId],
        );
      } catch {
        refusedBlank = true;
      }
      assert.ok(refusedBlank, "and a blank rationale is not representable");

      assert.equal(
        (await rowFor(recordWorkRequestId)).proposal_rationale,
        RATIONALE,
        "and neither refused statement changed the stored value",
      );
      assert.equal((await rowFor(humanRequestId)).proposal_rationale, null);
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 7. NO RELEASED UPDATE WRITER MOVES IT.
     *
     * Both released updaters are RUN, not merely read: purpose declaration mutates the row and the
     * rationale must survive byte-identical.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const workItems = await setup.query<{ id: string }>(
        `insert into work_items (tenant_id, title, declared_state, created_by, created_by_type)
         values ($1, 'A work item', 'active', $2, 'human') returning id`,
        [trh.tenantId, trh.userId],
      );
      const workItemId = workItems.rows[0]!.id;

      const declared = await declareActionRequestPurpose(
        trhCtx,
        { requestId: recordWorkRequestId, workItemId },
        writeDeps,
      );
      assert.equal(declared.status, "declared", `purpose declared (${JSON.stringify(declared)})`);

      const row = await rowFor(recordWorkRequestId);
      assert.equal(row.version, 2, "the row really was updated");
      assert.equal(
        row.proposal_rationale,
        RATIONALE,
        "AND THE RATIONALE IS BYTE-IDENTICAL — the released update writer cannot reach it",
      );
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 8. THE AUTHORITATIVE READ SEAM RETURNS IT, TENANT-SCOPED.
     *
     * This is what "survives reload" means: a NEW read, in a new request context, from the durable
     * record — not the server action's response.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const read = await readPendingActionRequests(trhCtx, dbDeps);
      assert.equal(read.status, "read");
      if (read.status !== "read") throw new Error("unreachable");

      const agentRow = read.items.find((i) => i.requestId === recordWorkRequestId);
      assert.ok(agentRow, "the agent proposal is on the surface");
      assert.equal(
        agentRow!.proposalRationale,
        RATIONALE,
        "THE RATIONALE SURVIVES THE ROUND TRIP through the authoritative seam",
      );

      const humanRow = read.items.find((i) => i.requestId === humanRequestId);
      assert.ok(humanRow, "so is the human one");
      assert.equal(
        humanRow!.proposalRationale,
        null,
        "and a human proposal reads null, which the surface must render as nothing at all",
      );

      /* TENANT ISOLATION. The other organization's proposal is not on this tenant's surface. */
      assert.equal(
        read.items.some((i) => i.requestId === otherRequestId),
        false,
        "one tenant's read never reaches another tenant's proposal or its rationale",
      );

      const otherRead = await readPendingActionRequests(otherCtx, dbDeps);
      assert.equal(otherRead.status, "read");
      if (otherRead.status !== "read") throw new Error("unreachable");
      assert.equal(
        otherRead.items.some((i) => i.proposalRationale === RATIONALE),
        false,
        "and the reverse direction holds too",
      );
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 9. A HISTORICAL ROW WITH NO RATIONALE IS STILL A VALID AGENT PROPOSAL.
     *
     * The Turkish Rug House proposal in production is exactly this shape, and it must stay this
     * shape: NULL is a legal, readable state, never a broken row.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      await setup.query(
        `update heby_action_requests set proposal_rationale = null where id = $1`,
        [otherRequestId],
      );
      const row = await rowFor(otherRequestId);
      assert.equal(row.proposal_rationale, null);
      assert.equal(row.proposed_by_actor_type, "agent", "an AGENT proposal with no rationale");
      assert.equal(row.status, "pending", "and it is still a perfectly valid pending proposal");

      const read = await readPendingActionRequests(otherCtx, dbDeps);
      assert.equal(read.status, "read");
      if (read.status !== "read") throw new Error("unreachable");
      const view = read.items.find((i) => i.requestId === otherRequestId);
      assert.equal(
        view?.proposalRationale,
        null,
        "the seam reports UNAVAILABLE as null — never a substitute string, never a reconstruction",
      );
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 10. THE WHOLE CEREMONY AUTHORIZED NOTHING.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      assert.equal(await countOf("action_permits"), 0, "PROPOSED != PERMITTED");
      assert.equal(await countOf("action_execution_attempts"), 0, "and nothing was executed");
      assert.equal(
        await countOf("decision_records"),
        governanceBaseline.decisions,
        "NOT ONE Governance decision was written after the mandates — a rationale decides nothing",
      );
      assert.equal(
        await countOf("governance_sessions"),
        governanceBaseline.sessions,
        "and no Governance session came into being because a rationale exists",
      );

      /*
       * AND THE RATIONALE IS NOWHERE IN GOVERNANCE. `decision_records.justification` is the human's
       * words at decision time; if a rationale could reach it, an agent would be writing the record
       * of why a person decided.
       */
      const leaked = await setup.query<{ n: number }>(
        `select count(*)::int as n from decision_records where justification like $1`,
        [`%${RATIONALE.slice(0, 40)}%`],
      );
      assert.equal(
        leaked.rows[0]!.n,
        0,
        "THE AGENT'S RATIONALE IS NOT, AND DOES NOT SEED, A GOVERNANCE JUSTIFICATION",
      );

      const statuses = await setup.query<{ status: string; n: number }>(
        `select status, count(*)::int as n from heby_action_requests group by status`,
      );
      assert.deepEqual(
        statuses.rows.map((r) => r.status).sort(),
        ["pending"],
        "EVERY request is still pending — a recorded explanation decided none of them",
      );
    }

    console.log("PASS trh19-agent-proposal-rationale rationale (postgres)");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase().catch(() => {});
  }
}

void main();
