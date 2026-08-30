/*
 * E2-6 — RECORDED ACT GROUNDING SEMANTICS.
 *
 * What this proves: Heby can ground an answer in what this organization actually DID, as Hebun's
 * own writers recorded it — and cannot, through this class, claim that is everything that happened,
 * name who did it, or read a payload.
 *
 * The distinction is the whole milestone. E2-4 gave Heby "18 recorded acts, most recent 21h ago";
 * this gives it the acts. A count is not a history.
 *
 *     A COUNT OF ACTS != A HISTORY OF ACTS
 *     CONSTITUTION    != HISTORY
 *     RECORDED ACT    != ALL ORGANIZATIONAL ACTIVITY
 *     RECENT          != IMPORTANT
 *     UNAVAILABLE     != EMPTY
 *
 * No database, no network, no key, no model. Every seam is injected.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  readRecordedActGroundingSource,
  RECORDED_ACT_GROUNDING_PROVENANCE,
  RECORDED_ACT_GROUNDING_EMPTY,
} from "../../src/features/governance-activity/heby-recorded-act-source.server";
import {
  RECORDED_ACT_PAGE_LIMIT,
  WITHHELD_AUDIT_COLUMNS,
  type RecordedAct,
  type RecordedActHistoryResult,
} from "../../src/features/governance-activity/contracts";
import { HEBY_SOURCE_CLASSES } from "../../src/features/heby-integration";
import { resolveHebyWorkspaceContext } from "../../src/features/heby-integration/workspace-registry";
import { resolveSource } from "../../src/features/heby-runtime/source-resolver";
import { assembleEvidence } from "../../src/features/heby-runtime/evidence-assembler";
import { buildResponse } from "../../src/features/heby-runtime/response-builder";
import { validateResponse } from "../../src/features/heby-runtime/response-validator";
import { answerHebyModelRequest } from "../../src/features/heby-answer/model-answer.server";
import type { ModelGenerationRequest, SourceResolution } from "../../src/features/heby-runtime";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");

const TENANT = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
} as unknown as TenantContext;

/** Shaped exactly like production's rows. */
function act(overrides: Partial<RecordedAct> = {}): RecordedAct {
  return {
    occurredAt: "2026-08-29T14:32:38.314Z",
    action: "integration.credential.replaced",
    entityType: "integration_credential",
    actorType: "human",
    result: "committed",
    source: "integration-credentials",
    authoritySource: "membership",
    simulation: false,
    ...overrides,
  };
}

function recorded(
  acts: readonly RecordedAct[],
  totalRecordedActs = acts.length,
): RecordedActHistoryResult {
  return {
    status: "recorded",
    tenantId: TENANT.tenantId,
    generatedAt: "2026-08-30T09:00:00.000Z",
    page: { acts, totalRecordedActs, truncated: totalRecordedActs > acts.length },
  };
}

const groundOn = (result: RecordedActHistoryResult): Promise<SourceResolution> =>
  readRecordedActGroundingSource(TENANT, { readHistory: async () => result });

async function main(): Promise<void> {
  /* ── 1 · THE CLASS EXISTS AND EXACTLY ONE WORKSPACE DECLARES IT ──────────── */
  {
    assert.ok(HEBY_SOURCE_CLASSES.includes("recorded-acts"), "`recorded-acts` must be declared");

    const command = resolveHebyWorkspaceContext({ workspace: "command" });
    assert.ok(
      command.sources.some((s) => s.sourceClass === "recorded-acts"),
      "Command must declare the recorded-acts class",
    );
    /*
     * GOVERNANCE MUST NOT GAIN IT. That class carries the CONSTITUTION — who holds authority —
     * and every one of its items is complete. This one is a BOUNDED history, and one profile
     * asserting both would blur which of the two an answer rests on.
     */
    const governance = resolveHebyWorkspaceContext({ workspace: "governance" });
    assert.ok(
      !governance.sources.some((s) => s.sourceClass === "recorded-acts"),
      "Governance must NOT declare the recorded-acts class",
    );
  }

  /* ── 2 · THE PURE RESOLVER REPORTS A SERVER READ, NOT AN ABSENT CONNECTION ─ */
  {
    const pure = resolveSource("recorded-acts");
    assert.equal(pure.sourceClass, "recorded-acts");
    assert.notEqual(pure.state, "resolved");
    assert.equal(pure.items.length, 0);
    assert.match(pure.unavailableReason ?? "", /tenant-scoped on the server/i);
    assert.ok(!/no connected/i.test(pure.unavailableReason ?? ""));
  }

  /* ── 3 · TENANT SCOPING IS UNREPRESENTABLE, NOT REFUSED ──────────────────── */
  {
    const source = read("src/features/governance-activity/heby-recorded-act-source.server.ts");
    const signature = source.slice(
      source.indexOf("export async function readRecordedActGroundingSource"),
      source.indexOf("): Promise<SourceResolution> {"),
    );
    for (const parameter of ["tenantId:", "slug", "limit", "offset", "since", "until"]) {
      assert.ok(
        !signature.includes(parameter),
        `a caller must not be able to name ${parameter} — it is unrepresentable, not refused`,
      );
    }
    assert.match(signature, /tenant:\s*TenantContext \| null/);

    /* No handle, no table, no query of its own — the authority keeps all three. */
    for (const symbol of ["getControlPlaneDb", "auditLog", "db.select", "drizzle"]) {
      assert.ok(!source.includes(symbol), `the projection must not hold ${symbol}`);
    }
  }

  /* ── 4 · PROVENANCE STATES THE BOUND AND THE DENIALS ─────────────────────── */
  {
    const resolution = await groundOn(recorded([act()]));
    assert.equal(resolution.provenance, RECORDED_ACT_GROUNDING_PROVENANCE);
    assert.equal(resolution.authoritative, false, "the released boundary declares it non-authoritative");
    assert.match(resolution.provenance, new RegExp(`${RECORDED_ACT_PAGE_LIMIT}`), "the bound is stated");
    assert.match(resolution.provenance, /not a complete history/i);
    assert.match(resolution.provenance, /no intrusion, incident, threat/i);
  }

  /* ── 5 · THE PAGE ALWAYS STATES WHAT IT IS A PAGE OF ─────────────────────── */
  {
    const complete = await groundOn(recorded([act(), act()], 2));
    const coverage = complete.items[0]!;
    assert.equal(coverage.recordRef, "recorded-acts:coverage");
    assert.match(coverage.detail, /2 of 2 recorded acts carried/);
    assert.match(coverage.detail, /this is every act Hebun recorded/);

    const partial = await groundOn(recorded([act(), act()], 137));
    assert.match(partial.items[0]!.detail, /2 of 137 recorded acts carried/);
    assert.match(partial.items[0]!.detail, /holds more than this page shows/);
  }

  /* ── 6 · UNAVAILABLE != EMPTY, AND NEITHER IS A ZERO ─────────────────────── */
  {
    const empty = await groundOn({
      status: "empty",
      tenantId: TENANT.tenantId,
      generatedAt: "2026-08-30T09:00:00.000Z",
    });
    assert.equal(empty.state, "resolved", "a successful read that found nothing is RESOLVED");
    assert.equal(empty.items.length, 1);
    assert.equal(empty.items[0]!.detail, RECORDED_ACT_GROUNDING_EMPTY);
    assert.match(empty.items[0]!.detail, /measured zero, not a failed read/i);

    const broken = await groundOn({ status: "unavailable", reason: "read-failed" });
    assert.equal(broken.state, "unavailable");
    assert.equal(broken.items.length, 0, "an unavailable resolution contributes no item");
    assert.notEqual(
      broken.unavailableReason,
      empty.items[0]!.detail,
      "an unread ledger and an organization that did nothing must never say the same thing",
    );
  }

  /* ── 7 · NO WITHHELD COLUMN, NO IDENTIFIER, CAN TRAVEL ───────────────────── */
  {
    const resolution = await groundOn(recorded([act()]));
    const serialized = JSON.stringify(resolution);
    for (const column of WITHHELD_AUDIT_COLUMNS) {
      assert.ok(
        !serialized.includes(column),
        `${column} is withheld by the reader and must not appear in grounding`,
      );
    }
    assert.ok(
      !/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(serialized),
      "no uuid may travel — not an entity id, not an actor id, not the tenant",
    );
    /* The reference is an ORDINAL on this page, never a record identifier. */
    assert.equal(resolution.items[1]!.recordRef, "act-1");
  }

  /* ── 8 · THE WRITER'S VERB AND THE RAW OUTCOME LIVE IN `content`, NEVER `detail` ── */
  {
    /*
     * THE DEFECT THIS PREVENTS is E2-5's, re-armed by different data. `audit_result` is a closed
     * enum containing `rejected`, and `action` is a free writer verb that could end in `deleted`.
     * Both are consequential-act tokens in Heby's own prose, and `detail` flows into that prose.
     * They travel VERBATIM in `content`, which reaches the model and never Heby's sentences.
     */
    const adversarial = [
      act({ action: "governance.decision.approved", result: "committed" }),
      act({ action: "knowledge.node.deleted", result: "rejected" }),
      act({ action: "integration.connection.created", result: "rolled-back" }),
    ];
    const resolution = await groundOn(recorded(adversarial));

    for (const item of resolution.items) {
      for (const claim of ["approved", "rejected", "authorized", "executed", "deployed", "deleted"]) {
        assert.ok(
          !item.detail.toLowerCase().includes(claim),
          `the detail line must never carry the forbidden claim "${claim}": ${item.detail}`,
        );
      }
    }

    /* And the verbatim record is not lost — it is carried, unreinterpreted, in `content`. */
    const contents = resolution.items.map((i) => i.content ?? "").join(" ");
    assert.match(contents, /governance\.decision\.approved/);
    assert.match(contents, /knowledge\.node\.deleted/);
    assert.match(contents, /recorded result "rejected"/);
    assert.match(contents, /recorded result "rolled-back"/);

    /* The three outcomes stay DISTINCT in Heby's prose — mapped, never merged. */
    const details = resolution.items.map((i) => i.detail);
    assert.ok(details.some((d) => /outcome committed/.test(d)));
    assert.ok(details.some((d) => /outcome not committed/.test(d)));
    assert.ok(details.some((d) => /outcome rolled back/.test(d)));
  }

  /* ── 9 · A SIMULATED ACT SAYS SO ─────────────────────────────────────────── */
  {
    const resolution = await groundOn(recorded([act({ simulation: true })]));
    assert.match(resolution.items[1]!.detail, /SIMULATION — no real effect occurred/);
  }

  /* ── 10 · THE COMPOSED ANSWER IS NOT WITHHELD ───────────────────────────── */
  {
    const resolutions = [
      await groundOn(
        recorded([
          act({ action: "knowledge.node.deleted", result: "rejected" }),
          act({ action: "governance.role.provisioned" }),
        ]),
      ),
    ];
    const assembled = assembleEvidence(resolutions);
    const response = buildResponse("INVESTIGATE", { workspace: "command", route: "/heby" }, resolutions);
    const verdict = validateResponse(response, assembled, "advisory-only");
    assert.equal(
      verdict.valid,
      true,
      `the recorded-act composition must pass validation; issues: ${verdict.issues.join(" | ")}`,
    );
    assert.notEqual(verdict.response.title, "Response withheld");
    assert.match(verdict.response.body.join(" "), /recorded acts carried/);
  }

  /* ── 11 · END TO END: THE CLASS REACHES THE MODEL REQUEST ────────────────── */
  {
    let captured: ModelGenerationRequest | undefined;
    await answerHebyModelRequest(
      { prompt: "What has this organization recently done that Hebun recorded?", route: "/heby" },
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
        resolveRecordedActs: async () => groundOn(recorded([act()], 18)),
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
    assert.match(grounding, /\[recorded-acts\/act-1\]/, "the act citation reaches the model");
    assert.match(grounding, /1 of 18 recorded acts carried/, "the bound reaches the model");
    assert.match(grounding, /integration\.credential\.replaced/, "the verbatim verb reaches the model");
    assert.ok(
      !/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(grounding),
      "no uuid reaches the model through this class",
    );
  }

  /* ── 12 · A THROWING READ DEGRADES; IT NEVER INVENTS OR DENIES ───────────── */
  {
    let captured: ModelGenerationRequest | undefined;
    await answerHebyModelRequest(
      { prompt: "What changed recently?", route: "/heby" },
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
        resolveRecordedActs: async () => {
          throw new Error("ledger read exploded");
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

    assert.ok(captured, "a throwing ledger read must not abort the answer");
    const grounding = captured!.evidence.join("\n");
    assert.ok(!/recorded acts carried/.test(grounding), "a failed read must not fabricate a history");
    assert.ok(
      !/no recorded act/i.test(grounding),
      "a failed read must never imply the organization has done nothing",
    );
  }

  console.log("e26-recorded-act-grounding/recorded-act-grounding: OK");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
