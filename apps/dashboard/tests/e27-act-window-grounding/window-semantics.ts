/*
 * E2-7 — WINDOWED RECORDED-ACT SEMANTICS.
 *
 * What this proves: Heby can ground an answer in how many acts Hebun recorded inside an EXPLICIT
 * half-open period, and cannot, through this class, say what the difference between two periods
 * means.
 *
 *     TIME WINDOW != TREND        CHANGE != CAUSATION
 *     MORE        != BETTER       LESS   != WORSE
 *     RECENT      != IMPORTANT    UNAVAILABLE != A QUIET PERIOD
 *     A RECENT PAGE != A PERIOD COUNT
 *
 * The boundary proofs (before / exactly-on / inside / after) live in the postgres suite beside this
 * one, because a half-open interval is a property of the SQL and asserting it against a fake would
 * prove only that the fake was written to agree.
 *
 * No database, no network, no model here. Every seam is injected.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  readActWindowGroundingSource,
  ACT_WINDOW_GROUNDING_PROVENANCE,
  ACT_WINDOW_NON_CLAIMS,
  ACT_WINDOW_MEASURED_ZERO,
  ACT_WINDOW_COMPARISON_REFUSAL,
} from "../../src/features/governance-activity/heby-act-window-source.server";
import {
  RECORDED_ACT_WINDOW_DAYS,
  RECORDED_ACT_WINDOW_BOUNDARY,
  type RecordedActWindow,
  type RecordedActWindowResult,
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

const EVALUATED_AT = "2026-08-30T09:00:00.000Z";
const CURRENT_SINCE = "2026-08-23T09:00:00.000Z";
const PREVIOUS_SINCE = "2026-08-16T09:00:00.000Z";

function win(
  since: string,
  until: string,
  acts: number,
  byEntityKind: RecordedActWindow["byEntityKind"] = [],
): RecordedActWindow {
  return { since, until, acts, byEntityKind };
}

function observed(current: RecordedActWindow, previous: RecordedActWindow): RecordedActWindowResult {
  return {
    status: "observed",
    tenantId: TENANT.tenantId,
    comparison: { evaluatedAt: EVALUATED_AT, windowDays: RECORDED_ACT_WINDOW_DAYS, current, previous },
  };
}

const groundOn = (result: RecordedActWindowResult): Promise<SourceResolution> =>
  readActWindowGroundingSource(TENANT, { readWindows: async () => result });

const DEFAULT = observed(
  win(CURRENT_SINCE, EVALUATED_AT, 12, [
    { entityType: "integration_credential", acts: 8 },
    { entityType: "knowledge_fact", acts: 4 },
  ]),
  win(PREVIOUS_SINCE, CURRENT_SINCE, 6, [{ entityType: "knowledge_fact", acts: 6 }]),
);

async function main(): Promise<void> {
  /* ── 1 · THE CLASS EXISTS AND EXACTLY ONE WORKSPACE DECLARES IT ──────────── */
  {
    assert.ok(HEBY_SOURCE_CLASSES.includes("recorded-act-windows"));
    assert.ok(
      resolveHebyWorkspaceContext({ workspace: "command" }).sources.some(
        (s) => s.sourceClass === "recorded-act-windows",
      ),
      "Command must declare the class",
    );
    for (const workspace of ["governance", "intelligence", "operations"] as const) {
      assert.ok(
        !resolveHebyWorkspaceContext({ workspace }).sources.some(
          (s) => s.sourceClass === "recorded-act-windows",
        ),
        `${workspace} must NOT declare a period count`,
      );
    }
  }

  /* ── 2 · THE PURE RESOLVER REPORTS A SERVER READ ─────────────────────────── */
  {
    const pure = resolveSource("recorded-act-windows");
    assert.equal(pure.sourceClass, "recorded-act-windows");
    assert.notEqual(pure.state, "resolved");
    assert.equal(pure.items.length, 0);
    assert.match(pure.unavailableReason ?? "", /tenant-scoped on the server/i);
    assert.ok(!/no connected/i.test(pure.unavailableReason ?? ""));
  }

  /* ── 3 · EVERY WINDOW CARRIES ITS EXACT, HALF-OPEN BOUNDARIES ────────────── */
  {
    const resolution = await groundOn(DEFAULT);
    assert.equal(resolution.items.length, 3, "current, previous, and the two side by side");

    const current = resolution.items[0]!;
    assert.equal(current.recordRef, `window:current-${RECORDED_ACT_WINDOW_DAYS}d`);
    assert.match(current.detail, new RegExp(`from ${CURRENT_SINCE} \\(inclusive\\)`));
    assert.match(current.detail, new RegExp(`to ${EVALUATED_AT} \\(exclusive\\)`));
    assert.match(current.detail, /12 recorded acts/);
    assert.match(current.detail, /integration_credential 8, knowledge_fact 4/);
    assert.match(current.detail, /counted with no bound, so this is the exact number/);

    const previous = resolution.items[1]!;
    assert.match(previous.detail, new RegExp(`from ${PREVIOUS_SINCE} \\(inclusive\\)`));
    assert.match(previous.detail, new RegExp(`to ${CURRENT_SINCE} \\(exclusive\\)`));
    assert.match(previous.detail, /6 recorded acts/);
  }

  /* ── 4 · THE WINDOWS ARE ADJACENT AND DO NOT OVERLAP ─────────────────────── */
  {
    /*
     * `previous.until` IS `current.since`. If they drifted apart, every act in the gap would be
     * counted in neither period while both counts still looked reasonable.
     */
    const { current, previous } = DEFAULT.status === "observed"
      ? DEFAULT.comparison
      : (() => { throw new Error("fixture"); })();
    assert.equal(previous.until, current.since, "the periods must partition time exactly");
    assert.equal(
      new Date(current.until).getTime() - new Date(current.since).getTime(),
      new Date(previous.until).getTime() - new Date(previous.since).getTime(),
      "the periods must be equal in length to be comparable",
    );
  }

  /* ── 5 · TWO COUNTS, AND NO INTERPRETATION OF THEM ───────────────────────── */
  {
    const resolution = await groundOn(DEFAULT);
    const comparison = resolution.items[2]!;
    assert.equal(comparison.recordRef, "window:comparison");
    assert.match(comparison.detail, /12 recorded acts in the current 7-day period and 6 in the/);

    /*
     * NO JUDGEMENT VOCABULARY IN THE ITEMS. 12 vs 6 is exactly the shape that invites "doubled",
     * "up", "improving" — none of which Hebun can vouch for.
     *
     * SCOPED TO THE ITEMS, NOT THE PROVENANCE, and that scoping is the point rather than a
     * convenience: the provenance legitimately NAMES what it refuses to compute — "no difference,
     * direction, rate, percentage, trend or projection" — so a ban run over it fails on the
     * source's own denial. This repository has now recorded that trap in E2-4, E2-5 and E2-6; the
     * settled remedy is to assert the denial by equality (section 8) and run the vocabulary ban
     * over only what the source CLAIMS.
     */
    /* The refusal is pinned by equality; the ban then runs over what is left — the CLAIMS. */
    assert.ok(
      comparison.detail.endsWith(ACT_WINDOW_COMPARISON_REFUSAL),
      "the comparison item must carry the refusal verbatim",
    );
    const everything = JSON.stringify(resolution.items)
      .replace(ACT_WINDOW_COMPARISON_REFUSAL, "")
      .toLowerCase();
    for (const word of [
      "trend", "increas", "decreas", "improv", "worsen", "spike", "surge", "drop",
      "doubled", "growth", "decline", "better", "worse", "healthy", "unhealthy",
      "priority", "urgent", "risk", "anomal",
    ]) {
      assert.ok(!everything.includes(word), `the evidence must not contain judgement word "${word}"`);
    }
    /* And no computed delta field exists to be filled later. */
    for (const field of ["delta", "difference", "direction", "rate", "percent", "projection"]) {
      assert.ok(
        !JSON.stringify(resolution.items.map((i) => Object.keys(i))).includes(field),
        `no ${field} field may exist on a window item`,
      );
    }
  }

  /* ── 6 · A MEASURED ZERO IS A PERIOD FACT, NOT AN ABSENCE ────────────────── */
  {
    const quiet = await groundOn(
      observed(win(CURRENT_SINCE, EVALUATED_AT, 0), win(PREVIOUS_SINCE, CURRENT_SINCE, 3, [
        { entityType: "knowledge_fact", acts: 3 },
      ])),
    );
    assert.match(quiet.items[0]!.detail, new RegExp(ACT_WINDOW_MEASURED_ZERO));
    assert.match(quiet.items[0]!.detail, /measured zero, not a failed read/);
    /* The boundaries are still stated for an empty period. */
    assert.match(quiet.items[0]!.detail, new RegExp(`from ${CURRENT_SINCE} \\(inclusive\\)`));
    /* And no kind breakdown is rendered as an empty list beside it. */
    assert.ok(!/by kind:/.test(quiet.items[0]!.detail));
  }

  /* ── 7 · UNAVAILABLE != A QUIET PERIOD ───────────────────────────────────── */
  {
    const broken = await groundOn({ status: "unavailable", reason: "read-failed" });
    assert.equal(broken.state, "unavailable");
    assert.equal(broken.items.length, 0, "an unavailable resolution contributes no period");
    assert.equal(broken.unavailableReason, "read-failed");
    assert.ok(
      !/recorded act/i.test(JSON.stringify(broken.items)),
      "a failed read must never render as a period in which nothing happened",
    );

    const noTenant = await readActWindowGroundingSource(null, {
      readWindows: async () => ({ status: "unavailable", reason: "no-authorized-tenant-context" }),
    });
    assert.equal(noTenant.state, "unavailable");
    assert.equal(noTenant.unavailableReason, "no-authorized-tenant-context");
  }

  /* ── 8 · DERIVED, AND THE NON-CLAIMS TRAVEL WITH THE NUMBERS ─────────────── */
  {
    const resolution = await groundOn(DEFAULT);
    assert.equal(resolution.authoritative, false);
    assert.equal(resolution.provenance, ACT_WINDOW_GROUNDING_PROVENANCE);
    assert.equal(RECORDED_ACT_WINDOW_BOUNDARY.isAuthoritative, false);
    assert.equal(RECORDED_ACT_WINDOW_BOUNDARY.showsTrend, false);
    assert.equal(RECORDED_ACT_WINDOW_BOUNDARY.definesRecent, false);

    assert.match(resolution.provenance, /TWO WINDOWS ARE TWO INDEPENDENT COUNTS AND NOTHING ELSE/);
    assert.match(resolution.provenance, /no difference, direction, rate, percentage, trend or projection/i);
    /* Hebun owns no definition of "recent", and the provenance says so rather than implying it. */
    assert.match(resolution.provenance, /NO definition of 'recent' or 'current'/);
    assert.match(resolution.provenance, /stated observation boundary, never a policy/);
    assert.match(resolution.provenance, /not everything the organization does/i);

    assert.ok(ACT_WINDOW_NON_CLAIMS.length >= 4);
    assert.ok(ACT_WINDOW_NON_CLAIMS.some((c) => /not a trend/.test(c)));
    assert.ok(ACT_WINDOW_NON_CLAIMS.some((c) => /more recorded acts is not better/.test(c)));
  }

  /* ── 9 · TENANT SCOPING IS UNREPRESENTABLE, AND NO HANDLE IS HELD ────────── */
  {
    const source = read("src/features/governance-activity/heby-act-window-source.server.ts");
    const signature = source.slice(
      source.indexOf("export async function readActWindowGroundingSource"),
      source.indexOf("): Promise<SourceResolution> {"),
    );
    for (const parameter of ["tenantId:", "since", "until", "windowDays", "limit"]) {
      assert.ok(!signature.includes(parameter), `a caller must not be able to name ${parameter}`);
    }
    assert.match(signature, /tenant:\s*TenantContext \| null/);
    for (const symbol of ["getControlPlaneDb", "auditLog", "db.select", "drizzle", "gte(", "lt("]) {
      assert.ok(!source.includes(symbol), `the projection must not hold ${symbol}`);
    }
  }

  /* ── 10 · THE COMPOSED ANSWER IS NOT WITHHELD ───────────────────────────── */
  {
    const resolutions = [await groundOn(DEFAULT)];
    const assembled = assembleEvidence(resolutions);
    const response = buildResponse("INVESTIGATE", { workspace: "command", route: "/heby" }, resolutions);
    const verdict = validateResponse(response, assembled, "advisory-only");
    assert.equal(verdict.valid, true, `must pass validation; issues: ${verdict.issues.join(" | ")}`);
    assert.match(verdict.response.body.join(" "), /12 recorded acts/);
  }

  /* ── 11 · END TO END: THE PERIODS REACH THE MODEL CONTEXT ────────────────── */
  {
    let captured: ModelGenerationRequest | undefined;
    await answerHebyModelRequest(
      {
        prompt: "How many acts did Hebun record in the last 7 days, and how many in the 7 days before?",
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
        resolveActWindows: async () => groundOn(DEFAULT),
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
    assert.match(grounding, /\[recorded-act-windows\/window:current-7d\]/);
    assert.match(grounding, /\[recorded-act-windows\/window:comparison\]/);
    assert.match(grounding, new RegExp(CURRENT_SINCE), "the exact boundary reaches the model");
    assert.match(grounding, /interprets neither/, "the refusal travels with the numbers");
  }

  /* ── 12 · A THROWING READ DEGRADES; IT NEVER INVENTS A PERIOD ────────────── */
  {
    let captured: ModelGenerationRequest | undefined;
    await answerHebyModelRequest(
      { prompt: "What changed in the last 7 days?", route: "/heby" },
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
        resolveActWindows: async () => {
          throw new Error("window read exploded");
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
    assert.ok(captured);
    const grounding = captured!.evidence.join("\n");
    assert.ok(!/recorded act.? in the current/i.test(grounding), "no period is fabricated");
    assert.ok(!/measured zero/i.test(grounding), "a failed read never implies a quiet period");
  }

  console.log("e27-act-window-grounding/window-semantics: OK");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
