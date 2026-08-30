/*
 * E2-5 — DURABLE AGENT GROUNDING SEMANTICS.
 *
 * What this proves: Heby can ground an answer in the durable agents this organization established
 * and in what became of what each proposed — and cannot, through this class, learn or imply what
 * any agent is FOR, may do, or was told to do.
 *
 * The distinction is the whole milestone. "Heby filed 3 proposals, 3 await a decision, 0 approved,
 * 0 executed" is an outcome and is what this source says. "Heby handles customer outreach" is a
 * mandate, nobody in Hebun owns it, and it must remain unsayable — not filtered out, but absent
 * from the facts that travel.
 *
 *     OUTCOME          != MANDATE
 *     APPROVED         != EXECUTED
 *     RUNTIME AGENT    != WORKFORCE IDENTITY
 *     UNAVAILABLE      != NO AGENTS
 *
 * No database, no network, no key, no model. Every seam is injected.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  readAgentGroundingSource,
  AGENT_GROUNDING_PROVENANCE,
  AGENT_GROUNDING_NO_AGENTS,
} from "../../src/features/agent-outcome-observation/heby-agent-source.server";
import type {
  AgentOutcomeObservation,
  AgentOutcomeObservationRead,
} from "../../src/features/agent-outcome-observation/agent-outcome-projection.server";
import { HEBY_SOURCE_CLASSES } from "../../src/features/heby-integration";
import { resolveHebyWorkspaceContext } from "../../src/features/heby-integration/workspace-registry";
import { resolveSource } from "../../src/features/heby-runtime/source-resolver";
import { assembleEvidence } from "../../src/features/heby-runtime/evidence-assembler";
import { buildResponse } from "../../src/features/heby-runtime/response-builder";
import { validateResponse } from "../../src/features/heby-runtime/response-validator";
import {
  toStoredSourceEvidence,
  fromStoredSourceEvidence,
} from "../../src/features/heby-conversation/answer-evidence";
import { answerHebyModelRequest } from "../../src/features/heby-answer/model-answer.server";
import type { ModelGenerationRequest, SourceResolution } from "../../src/features/heby-runtime";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");

const TENANT = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
} as unknown as TenantContext;

/*
 * The fixture name is deliberately ordinary, for the reason E2-1's fixture is: `validateResponse`
 * matches forbidden action claims by bare substring against the answer body, and the body carries
 * an item's LABEL — so an agent literally named "Approved" would be withheld. That is a
 * PRE-EXISTING property of the validator, not something this phase introduces, and this test does
 * not smuggle a fix for it in behind an unusual fixture.
 */
function agent(overrides: Partial<AgentOutcomeObservation> = {}): AgentOutcomeObservation {
  return {
    agentName: "Heby",
    inService: true,
    retiredAt: null,
    establishedAt: "2026-08-01T00:00:00.000Z",
    activity: { proposalsFiled: 3, pending: 3, withdrawn: 0 },
    governance: {
      approved: 0,
      rejected: 0,
      permitsIssued: 0,
      permitsActive: 0,
      permitsExpired: 0,
      permitsConsumed: 0,
      permitsRevoked: 0,
      approvedWithoutExecution: 0,
    },
    execution: { attempts: 0, pending: 0, accepted: 0, refused: 0, failed: 0, unknown: 0 },
    modelUsage: {
      linkedInvocations: 0,
      inputTokens: 0,
      outputTokens: 0,
      invocationsWithoutReportedUsage: 0,
      distribution: [],
    },
    selection: {
      attributed: 0,
      registered: 0,
      notDispatched: 0,
      dispatchFailed: 0,
      selectionInvalid: 0,
      noAction: 0,
      selectionValid: 0,
      filingNotAttempted: 0,
      filingProposed: 0,
      filingRefused: 0,
      filingFailed: 0,
    },
    provenance: { proposalsWithInvocation: 0, proposalsWithoutInvocation: 3 },
    ...overrides,
  };
}

function readOf(agents: readonly AgentOutcomeObservation[]): AgentOutcomeObservationRead {
  return {
    status: "read",
    agents,
    unattributedInvocations: 0,
    unresolvedAgentProposals: 0,
    historicallyUnattributedInvocations: 0,
    attributionConflicts: 0,
    distributionTruncated: false,
    distributionLimit: 50,
  };
}

const groundOn = (result: AgentOutcomeObservationRead): Promise<SourceResolution> =>
  readAgentGroundingSource(TENANT, { readOutcome: async () => result });

async function main(): Promise<void> {
  /* ── 1 · THE CLASS EXISTS AND IS DECLARED BY EXACTLY ONE WORKSPACE ───────── */
  {
    assert.ok(HEBY_SOURCE_CLASSES.includes("agents"), "`agents` must be a declared source class");

    const command = resolveHebyWorkspaceContext({ workspace: "command" });
    assert.ok(
      command.sources.some((source) => source.sourceClass === "agents"),
      "Command must declare the agents class",
    );

    /*
     * WORKFORCE MUST NOT GAIN IT. Its released profile says "not a runtime agent", and that
     * boundary is the reason this milestone added a class instead of connecting that one.
     */
    const workforce = resolveHebyWorkspaceContext({ workspace: "workforce" });
    assert.ok(
      !workforce.sources.some((source) => source.sourceClass === "agents"),
      "Workforce must NOT declare the agents class — its profile says 'not a runtime agent'",
    );
    assert.ok(
      workforce.mayExplain.some((line) => /not a runtime agent/i.test(line)),
      "the workforce boundary sentence this phase relies on must still be released",
    );
  }

  /* ── 2 · THE PURE RESOLVER REPORTS A SERVER READ, NOT AN ABSENT CONNECTION ─ */
  {
    const pure = resolveSource("agents");
    assert.equal(pure.sourceClass, "agents");
    assert.notEqual(pure.state, "resolved", "the pure resolver holds no tenant and can read nothing");
    assert.equal(pure.items.length, 0, "the pure resolution carries no items");
    /*
     * G6D's correction, inherited deliberately. `withAgents` also falls back to this resolution when
     * the real read THROWS, so it must not claim a permanent absence of connection.
     */
    assert.match(
      pure.unavailableReason ?? "",
      /tenant-scoped on the server/i,
      "the pure resolution must state that the read is server-side, not that nothing is connected",
    );
    assert.ok(
      !/no connected/i.test(pure.unavailableReason ?? ""),
      "the pure resolution must not report a permanent absence of connection",
    );
  }

  /* ── 3 · A RESOLVED READ CARRIES ONE ITEM PER DURABLE AGENT ──────────────── */
  {
    const resolution = await groundOn(readOf([agent(), agent({ agentName: "Auditor" })]));
    assert.equal(resolution.state, "resolved");
    assert.equal(resolution.items.length, 2, "one item per durable agent");
    assert.deepEqual(
      resolution.items.map((item) => item.recordRef),
      ["Heby", "Auditor"],
      "the record reference is the agent's own name",
    );
    assert.equal(resolution.provenance, AGENT_GROUNDING_PROVENANCE);
  }

  /* ── 4 · IT IS DERIVED, AND SAYS SO ─────────────────────────────────────── */
  {
    const resolution = await groundOn(readOf([agent()]));
    assert.equal(
      resolution.authoritative,
      false,
      "E2-3 released this observation as DERIVED; importing it may not upgrade its standing",
    );
    assert.match(
      resolution.provenance,
      /derived \(authoritative: false\)/i,
      "the provenance must state the standing in words, because one boolean covers the whole class",
    );
    assert.match(
      resolution.provenance,
      /recomputed/i,
      "the provenance must say the counts are recomputed on read",
    );
  }

  /* ── 5 · NO AGENT ID TRAVELS, EVER ──────────────────────────────────────── */
  {
    const resolution = await groundOn(readOf([agent()]));
    const serialized = JSON.stringify(resolution);
    assert.ok(
      !/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(serialized),
      "no uuid may appear anywhere in the resolution",
    );
    assert.ok(
      !serialized.includes(TENANT.tenantId),
      "the tenant id must never appear in grounding evidence",
    );

    const source = read("src/features/agent-outcome-observation/heby-agent-source.server.ts");
    for (const symbol of ["agentId", "byAgentId", "readAgentOutcomeObservationIndexed"]) {
      assert.ok(!source.includes(symbol), `the agent source must not reference ${symbol}`);
    }
  }

  /* ── 6 · A MANDATE IS ABSENT, NOT FILTERED ──────────────────────────────── */
  {
    const resolution = await groundOn(readOf([agent()]));
    const detail = resolution.items[0]!.detail;
    /*
     * Asserted on the DETAIL LINE, not on the file, because the claim is about what travels. The
     * observation carries no capability, permission, owner or instruction field, so there is
     * nothing to filter — the words simply cannot appear.
     */
    for (const word of ["capability", "permission", "owner", "instruction", "prompt", "purpose"]) {
      assert.ok(
        !new RegExp(`\\b${word}`, "i").test(detail),
        `an agent's ${word} must not travel under this class`,
      );
    }
  }

  /* ── 7 · APPROVED != EXECUTED IS STATED, NOT LEFT TO SUBTRACTION ─────────── */
  {
    const resolution = await groundOn(
      readOf([
        agent({
          activity: { proposalsFiled: 5, pending: 1, withdrawn: 0 },
          governance: {
            approved: 4,
            rejected: 0,
            permitsIssued: 4,
            permitsActive: 1,
            permitsExpired: 0,
            permitsConsumed: 3,
            permitsRevoked: 0,
            approvedWithoutExecution: 1,
          },
          execution: { attempts: 3, pending: 0, accepted: 2, refused: 1, failed: 0, unknown: 0 },
        }),
      ]),
    );
    const detail = resolution.items[0]!.detail;
    assert.match(detail, /governance approvals 4/, "the approval count travels");
    assert.match(detail, /execution attempts 3/, "the attempt count travels separately");
    assert.match(
      detail,
      /approvals with no execution attempt 1/,
      "the gap between approval and execution is stated explicitly",
    );
    assert.match(detail, /provider acceptances 2/, "acceptance is qualified as a provider's, not a delivery");

    /*
     * THE DETAIL LINE MUST NEVER CONTAIN A FORBIDDEN ACTION CLAIM.
     *
     * `detail` flows into Heby's own deterministic body, and `validateResponse` scans that body by
     * bare substring. The first draft wrote "approved 4 · rejected 0" and the validator withheld
     * the ENTIRE response — every answer citing an agent rendered as "Response withheld". This
     * pins the wording so a later readability edit cannot silently reintroduce it.
     */
    for (const claim of ["approved", "rejected", "authorized", "executed", "deployed", "deleted"]) {
      assert.ok(
        !detail.toLowerCase().includes(claim),
        `the detail line must not contain the forbidden action claim "${claim}"`,
      );
    }
  }

  /* ── 8 · A MEASURED ZERO IS RESOLVED; AN UNREAD ONE IS UNAVAILABLE ───────── */
  {
    const none = await groundOn(readOf([]));
    assert.equal(none.state, "resolved", "a successful read that found nothing is RESOLVED");
    assert.equal(none.items.length, 1, "the measured zero is stated in words, not as silence");
    assert.equal(none.items[0]!.detail, AGENT_GROUNDING_NO_AGENTS);
    assert.match(none.items[0]!.detail, /measured zero, not a failed read/i);

    const broken = await groundOn({ status: "unavailable", reason: "read-failed" });
    assert.equal(broken.state, "unavailable", "a read that could not run is UNAVAILABLE");
    assert.equal(broken.items.length, 0, "an unavailable resolution contributes no item");
    assert.equal(broken.unavailableReason, "read-failed");
    assert.notEqual(
      broken.unavailableReason,
      none.items[0]!.detail,
      "an unread observation and an organization with no agents must never say the same thing",
    );
  }

  /* ── 9 · A RETIRED AGENT IS CITED AS RETIRED, NEVER DROPPED ──────────────── */
  {
    const resolution = await groundOn(
      readOf([agent({ inService: false, retiredAt: "2026-08-20T00:00:00.000Z" })]),
    );
    assert.equal(resolution.items.length, 1, "a retired agent stays in the evidence set");
    assert.equal(resolution.items[0]!.lifecycle, "retired");
    assert.match(resolution.items[0]!.detail, /retired 2026-08-20/);
  }

  /* ── 10 · THE EVIDENCE SURVIVES ASSEMBLY, VALIDATION AND STORAGE ─────────── */
  {
    const resolutions = [await groundOn(readOf([agent()]))];
    const assembled = assembleEvidence(resolutions);
    assert.deepEqual(
      assembled.map((e) => `${e.sourceClass}/${e.recordRef}`),
      ["agents/Heby"],
      "the agent contributes its own evidence identity",
    );

    const response = buildResponse("INVESTIGATE", { workspace: "command", route: "/heby" }, resolutions);
    const validation = validateResponse(response, assembled, "advisory-only");
    assert.equal(validation.valid, true, "agent grounding must not trip the response honesty gate");

    /*
     * A FORGED AGENT MUST NOT VALIDATE. The model can never invent a citation under this class,
     * for the reason E2-1 proved it for organizations: the reference is owned by the retrieval
     * layer, and the validator checks the answer's references against assembled evidence.
     */
    const forged = {
      ...response,
      evidence: [
        ...response.evidence,
        { sourceClass: "agents" as const, recordRef: "Ghost", label: "Ghost", ordinal: 99 },
      ],
    } as typeof response;
    const forgedVerdict = validateResponse(forged, assembled, "advisory-only");
    assert.equal(forgedVerdict.valid, false, "an invented agent must not validate");
    assert.ok(
      forgedVerdict.issues.some((issue) => /agents\/Ghost/.test(issue)),
      "the rejection names the unsupported agent reference",
    );
  }

  /* ── 10b · IT PERSISTS AND REPLAYS WITH ITS STANDING INTACT ──────────────── */
  {
    const resolutions = [await groundOn(readOf([agent()]))];
    const rows = toStoredSourceEvidence(resolutions);

    const agentRow = rows.find((row) => row.sourceClass === "agents");
    assert.ok(agentRow, "the agent citation is stored by the released projection");
    assert.equal(agentRow!.recordRef, "Heby");
    assert.equal(
      agentRow!.authoritative,
      false,
      "the DERIVED standing is snapshotted, so a reload cannot promote it",
    );

    const replayed = fromStoredSourceEvidence(
      rows.map((row) => ({
        sourceClass: row.sourceClass,
        recordRef: row.recordRef,
        label: row.label,
        detail: row.detail,
        authoritative: row.authoritative,
        ordinal: row.ordinal,
      })),
    );
    const group = replayed.find((g) => g.sourceClass === "agents");
    assert.ok(group, "the agent group survives the round trip");
    assert.equal(group!.authoritative, false);
    assert.match(
      group!.items[0]!.detail,
      /approvals with no execution attempt 0/,
      "the approved-is-not-executed statement survives the round trip",
    );
  }

  /* ── 11 · END TO END: THE CLASS REACHES THE MODEL REQUEST ────────────────── */
  {
    let captured: ModelGenerationRequest | undefined;
    await answerHebyModelRequest(
      {
        prompt: "What durable agents does this organization have, and what became of what they proposed?",
        route: "/heby",
      },
      {
        resolveTenant: async () => TENANT,
        readOverview: () => undefined,
        getConversationRepo: () => null,
        resolveDirectorEnabled: async () => true,
        env: {
          HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
          HEBUN_MODEL_PROVIDER: "claude",
          HEBUN_MODEL_ID: "synthetic-test-model",
          HEBUN_MODEL_CREDENTIAL: "synthetic-not-a-real-key",
          HEBUN_MODEL_TRANSPORT: "fake",
        },
        resolveAgents: async () => groundOn(readOf([agent()])),
        generate: async (request) => {
          captured = request;
          return {
            status: "unavailable" as const,
            state: "TRANSPORT_UNAVAILABLE" as const,
            modelStatus: { available: false, reason: "provider-unavailable" as const, detail: "test" },
          };
        },
      },
    );

    assert.ok(captured, "the answer flow must have composed a model request");
    const grounding = captured!.evidence.join("\n");
    assert.match(grounding, /\[agents\/Heby\]/, "the agent citation must reach the model request");
    assert.match(grounding, /proposals filed 3/, "the outcome numbers must reach the model request");
    assert.ok(
      !/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(grounding),
      "no uuid may reach the model request through this class",
    );
  }

  /* ── 12 · A THROWING READ DEGRADES; IT NEVER DELETES ANOTHER SOURCE ──────── */
  {
    let captured: ModelGenerationRequest | undefined;
    await answerHebyModelRequest(
      { prompt: "What are my agents doing?", route: "/heby" },
      {
        resolveTenant: async () => TENANT,
        readOverview: () => undefined,
        getConversationRepo: () => null,
        resolveDirectorEnabled: async () => true,
        env: {
          HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
          HEBUN_MODEL_PROVIDER: "claude",
          HEBUN_MODEL_ID: "synthetic-test-model",
          HEBUN_MODEL_CREDENTIAL: "synthetic-not-a-real-key",
          HEBUN_MODEL_TRANSPORT: "fake",
        },
        resolveAgents: async () => {
          throw new Error("agent read exploded");
        },
        generate: async (request) => {
          captured = request;
          return {
            status: "unavailable" as const,
            state: "TRANSPORT_UNAVAILABLE" as const,
            modelStatus: { available: false, reason: "provider-unavailable" as const, detail: "test" },
          };
        },
      },
    );

    assert.ok(captured, "a throwing agent read must not abort the answer");
    const grounding = captured!.evidence.join("\n");
    assert.ok(
      !/proposals filed/.test(grounding),
      "a failed read must never fabricate an agent outcome",
    );
    assert.ok(
      !/no durable agent/i.test(grounding),
      "a failed read must never imply the organization has no agents",
    );
  }

  console.log("e25-agent-grounding/agent-grounding: OK");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
