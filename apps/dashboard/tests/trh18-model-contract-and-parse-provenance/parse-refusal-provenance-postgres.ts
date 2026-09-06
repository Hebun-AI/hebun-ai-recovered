/*
 * TRH-18 — A STRUCTURED-OUTPUT PARSE REFUSAL PERSISTS ITS EXACT DIAGNOSTIC CODE, AND CHANGES
 * NOTHING ELSE. Against a REAL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "When a real provider answers and the answer is not the contract, the invocation row records
 *    WHICH bound was broken — the exact released `StructuredOutputRefusal`, verbatim — while the
 *    filing, authorization, permit and execution semantics of that origination are byte-for-byte
 *    what they were: no proposal, no permit, no execution, no work item, no decision, and the same
 *    refusal returned to the caller."
 *
 * ── WHY "IT WROTE THE CODE" IS THE WEAKER HALF ───────────────────────────────
 *
 * Persisting a diagnostic is only safe if it is INERT. So each case measures the whole authority
 * surface before and after, and asserts every one of those counts is unmoved — the same evidence
 * shape TRH-17 used for `PROPOSED != PERMITTED != EXECUTED`. A diagnostic that moved any of them
 * would not be a diagnostic.
 *
 * ── AND THAT NO PROVIDER TEXT REACHES THE COLUMN ─────────────────────────────
 *
 * The malformed responses below deliberately contain a recognizable sentence. The row is asserted
 * NOT to contain it. That is what makes "a closed code Hebun wrote, never a sentence a provider
 * wrote" a measurement rather than a claim about intentions.
 *
 * No live provider: a fake transport returning exactly the text each case needs, through the REAL
 * generator, the REAL parser, the REAL candidate builder, the REAL inlet and the REAL provenance
 * writer.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { seedAgentMandate } from "../helpers/agent-mandate-seed";
import { originateAgentAction } from "../../src/features/agent-origination/originate-action.server";
import { readInvocationProvenance } from "../../src/features/agent-origination/invocation-provenance.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { MAX_ORIGINATION_REASON_LENGTH } from "../../src/features/agent-origination/contracts";
import { MAX_WORK_TITLE_LENGTH } from "../../src/features/organizational-work/work-contracts";
import type { ClaudeTransport } from "../../src/features/heby-model";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date("2026-09-06T10:00:00.000Z");
const GOAL =
  "We re-warped the standing loom this week and nobody wrote it down. Get that on the record.";
const TITLE = "Re-warp the standing loom";

/** A sentence no closed Hebun vocabulary contains. If it reaches the row, the row leaked. */
const PROVIDER_SENTENCE = "I have already taken care of this for you.";

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

/** Every authority a diagnostic must be incapable of touching. */
const AUTHORITY_TABLES = [
  "heby_action_requests",
  "action_permits",
  "action_execution_attempts",
  "work_items",
  "decision_records",
  "audit_log",
] as const;

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_trh18_parse_refusal");
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
    for (const table of AUTHORITY_TABLES) out[table] = await countOf(table);
    return out;
  };

  try {
    /* ═══════════════════════════════════════════════════════════════════════
     * 0. TURKISH RUG HOUSE'S EXACT SHAPE — the organization this phase is about.
     * ═════════════════════════════════════════════════════════════════════ */
    const trh = (await seedLocalIdentity(setup, {
      companyName: "Turkish Rug House",
      companySlug: "trh-trh18",
      email: "director@trh.test",
    })) as Seeded;
    const trhCtx = contextFor(trh, "trh18-trh");

    const agent = await createDurableAgentIdentity(trhCtx, { name: "Heby" }, writeDeps);
    assert.equal(agent.status, "established");
    const agentId = agent.status === "established" ? agent.identity.agentId : "";
    await seedAgentMandate(setup, trh, agentId, writeDeps, {
      tag: "trh18",
      now: NOW,
      proposalScope: ["record-work"],
    });

    const candidateDeps = { recipients: dbDeps, artifacts: dbDeps, organization: dbDeps };

    let transportCalls = 0;
    const originationDeps = (text: string) =>
      ({
        resolveTenant: async () => trhCtx,
        env: MODEL_ENV,
        resolveDirectorEnabled: async () => true,
        selectTransport: () => ({
          transport: {
            async send(request) {
              transportCalls += 1;
              return {
                id: "req_trh18_fake",
                model: request.model,
                content: [{ type: "text", text }],
                stopReason: "end_turn",
                usage: { inputTokens: 88, outputTokens: 24 },
              };
            },
          } satisfies ClaudeTransport,
          transportProvenance: "fake",
        }),
        newCorrelationId: () => "corr-trh18",
        agentIdentity: dbDeps,
        candidates: candidateDeps,
        proposal: writeDeps,
        recordWork: writeDeps,
      }) as never;

    const lastInvocation = async () =>
      (
        await setup.query<{
          id: string;
          state: string;
          failure_code: string | null;
          provider: string | null;
          provider_request_id: string | null;
          input_tokens: number | null;
          output_tokens: number | null;
          filing_outcome: string;
          filing_refusal: string | null;
          agent_id: string | null;
        }>(`select * from heby_origination_invocations order by created_at, id`)
      ).rows.at(-1)!;

    /* ═══════════════════════════════════════════════════════════════════════
     * 1. EACH MALFORMED SHAPE PERSISTS ITS OWN EXACT DIAGNOSTIC — AND ONLY THAT.
     *
     * Six responses, six DIFFERENT refusals. Before TRH-18 all six wrote NULL and were
     * indistinguishable in the record: `selection-invalid` said only that something was wrong.
     * ═════════════════════════════════════════════════════════════════════ */
    const CASES: readonly { readonly label: string; readonly text: string; readonly code: string }[] =
      [
        {
          label: "prose instead of an object",
          text: PROVIDER_SENTENCE,
          code: "not-a-structured-object",
        },
        {
          label: "an object with an extra key",
          text: JSON.stringify({
            kind: "none",
            reason: "Nothing warrants a proposal.",
            note: PROVIDER_SENTENCE,
          }),
          code: "unexpected-shape",
        },
        {
          label: "a kind the contract does not admit",
          text: JSON.stringify({ kind: "grant-permission", args: {}, reason: PROVIDER_SENTENCE }),
          code: "unsupported-action-kind",
        },
        {
          label: "a blank reason",
          text: JSON.stringify({ kind: "none", reason: "   " }),
          code: "invalid-reason",
        },
        {
          label: "a reason one character over the bound the model was given",
          text: JSON.stringify({
            kind: "none",
            reason: "x".repeat(MAX_ORIGINATION_REASON_LENGTH + 1),
          }),
          code: "invalid-reason",
        },
        {
          label: "a record-work title over the bound the model was given",
          text: JSON.stringify({
            kind: "record-work",
            args: {
              title: "x".repeat(MAX_WORK_TITLE_LENGTH + 1),
              scope: { kind: "organization-level" },
            },
            reason: "The loom work happened.",
          }),
          code: "invalid-arguments",
        },
        {
          label: "a department this organization never offered",
          text: JSON.stringify({
            kind: "record-work",
            args: { title: TITLE, scope: { kind: "department", departmentSlug: "dyeing" } },
            reason: "The loom work happened.",
          }),
          code: "reference-not-offered",
        },
      ];

    const seen = new Set<string>();
    for (const testCase of CASES) {
      const before = await authoritySnapshot();
      const callsBefore = transportCalls;

      const result = await originateAgentAction({ goal: GOAL }, originationDeps(testCase.text));

      assert.equal(result.status, "refused", `${testCase.label}: no proposal was produced`);
      assert.equal(
        result.status === "refused" ? result.reason : "",
        testCase.code,
        `${testCase.label}: the caller is told the same code that is stored — one fact, not two`,
      );

      const row = await lastInvocation();
      assert.equal(row.state, "selection-invalid", `${testCase.label}: the MODEL side is the failure`);
      assert.equal(
        row.failure_code,
        testCase.code,
        `${testCase.label}: THE EXACT DIAGNOSTIC IS PERSISTED, verbatim and unreworded`,
      );
      seen.add(testCase.code);

      /* THE PROVIDER STILL ANSWERED, AND THAT IS RECORDED — the call was real and was spent. */
      assert.equal(row.provider, "claude", `${testCase.label}: the provider facts are still kept`);
      assert.equal(row.provider_request_id, "req_trh18_fake");
      assert.equal(row.input_tokens, 88);
      assert.equal(row.agent_id, agentId, `${testCase.label}: attribution is unchanged`);

      /* ── FILING, AUTHORIZATION, PERMIT AND EXECUTION SEMANTICS ARE UNMOVED ── */
      assert.equal(
        row.filing_outcome,
        "not-attempted",
        `${testCase.label}: nothing was filed — recording WHY is not attempting anything`,
      );
      assert.equal(row.filing_refusal, null, `${testCase.label}: and no filing refusal was invented`);
      assert.deepEqual(
        await authoritySnapshot(),
        before,
        `${testCase.label}: NO proposal, permit, execution, work item, decision or audit row moved`,
      );
      assert.equal(
        transportCalls,
        callsBefore + 1,
        `${testCase.label}: EXACTLY ONE model turn — a refusal is not retried`,
      );

      /* ── NO PROVIDER TEXT AND NO MODEL BYTES REACHED THE ROW ── */
      const stored = JSON.stringify(row);
      assert.ok(
        !stored.includes(PROVIDER_SENTENCE),
        `${testCase.label}: the sentence the provider wrote is NOT in the record`,
      );
      assert.ok(
        !stored.includes("xxxxxxxxxx"),
        `${testCase.label}: and no fragment of the over-long payload is either`,
      );

      /* The read seam a human would use says the same thing the row does. */
      const view = await readInvocationProvenance(trhCtx, row.id, dbDeps);
      assert.equal(view?.failureCode, testCase.code, `${testCase.label}: the read seam agrees`);
      assert.equal(
        view?.causedActionRequestId,
        null,
        `${testCase.label}: and NO proposal names this invocation`,
      );
    }

    assert.equal(
      seen.size,
      6,
      "six DISTINCT diagnostics were persisted, where before all of them were one silence",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 2. A CONNECTIVITY CODE AND A PARSE CODE STILL OCCUPY DIFFERENT STATES.
     *
     * Both vocabularies now share the column. If they could not be told apart, the column would
     * have gained ambiguity rather than information. `state` is what separates them, and it always
     * did — this asserts the addition did not blur it.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const rows = (
        await setup.query<{ state: string; failure_code: string | null }>(
          `select state, failure_code from heby_origination_invocations`,
        )
      ).rows;
      for (const row of rows) {
        if (row.failure_code === null) continue;
        assert.ok(
          ["selection-invalid", "not-dispatched", "dispatch-failed"].includes(row.state),
          `a failure code only ever accompanies a failure state (got ${row.state})`,
        );
      }
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 3. THE VALID PATH IS UNTOUCHED — a good selection still proposes, and records NO failure.
     *
     * The strongest evidence that a diagnostic changed no semantics is that the semantics still
     * work: TRH-17's own success condition, re-measured after the change.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      assert.equal(await countOf("heby_action_requests"), 0, "nothing was filed by any refusal");

      const proposed = await originateAgentAction(
        { goal: GOAL },
        originationDeps(
          JSON.stringify({
            kind: "record-work",
            args: { title: TITLE, scope: { kind: "organization-level" } },
            reason: "The loom work happened and this organization has no record of it.",
          }),
        ),
      );
      assert.equal(proposed.status, "proposed", `a valid selection still files (${JSON.stringify(proposed)})`);

      const row = await lastInvocation();
      assert.equal(row.state, "selection-valid");
      assert.equal(row.failure_code, null, "A SUCCESSFUL SELECTION RECORDS NO FAILURE CODE");
      assert.equal(row.filing_outcome, "proposed");

      assert.equal(await countOf("heby_action_requests"), 1, "exactly one pending request");
      assert.equal(await countOf("action_permits"), 0, "PROPOSED != PERMITTED");
      assert.equal(await countOf("action_execution_attempts"), 0, "and nothing was executed");
      assert.equal(await countOf("work_items"), 0, "PROPOSED != RECORDED");

      const request = (
        await setup.query<{ status: string; actionKind: string; invocationId: string | null }>(
          `select status, action_kind as "actionKind",
                  origination_invocation_id as "invocationId"
             from heby_action_requests limit 1`,
        )
      ).rows[0]!;
      assert.equal(request.status, "pending", "it is waiting for a human");
      assert.equal(request.actionKind, "record-work");
      assert.equal(request.invocationId, row.id, "and it names the invocation that caused it");
    }

    console.log("PASS trh18-model-contract-and-parse-provenance parse refusal provenance");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase().catch(() => {});
  }
}

void main();
