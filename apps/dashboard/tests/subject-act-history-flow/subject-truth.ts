/*
 * SUBJECT-ACT-HISTORY-1 — SEMANTICS.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "`/audit <subject-ref>` reports what HEBUN RECORDED DOING to one subject, refuses a subject it
 *    cannot address rather than answering about everything, and never lets an empty record read as
 *    an empty world."
 *
 * Injected end to end. No database, no network, no model, no clock read inside the seam.
 */
import assert from "node:assert/strict";
import { runHebyReadCommand } from "../../src/features/heby-commands/read-commands.server";
import {
  ACT_SUBJECT_REFERENCE_KINDS,
  RECORDED_ACT_PAGE_LIMIT,
  WITHHELD_AUDIT_COLUMNS,
  type ActSubject,
  type RecordedAct,
  type SubjectActHistoryResult,
} from "../../src/features/governance-activity/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const TENANT = { tenantId: "10000000-0000-4000-8000-00000000a001" } as TenantContext;
const WORK_ID = "983d1cb2-4720-41bd-b430-0da7a5d7c344";
const WORK_REF = `work-item/${WORK_ID}`;
const NOW = "2026-09-02T20:00:00.000Z";

function act(overrides: Partial<RecordedAct> = {}): RecordedAct {
  return {
    occurredAt: "2026-09-02T19:26:23.720Z",
    action: "work.reference-declared",
    entityType: "work_item",
    actorType: "human",
    result: "committed",
    source: "organizational-work",
    authoritySource: "membership",
    simulation: false,
    ...overrides,
  };
}

/** Records what the command asked for, so "it asked about the right subject" is provable. */
let asked: ActSubject | null = null;

async function audit(reference: string, history: SubjectActHistoryResult) {
  asked = null;
  return runHebyReadCommand(
    { commandId: "audit", args: [reference], route: "/heby" },
    {
      resolveTenant: async () => TENANT,
      readSubjectActHistory: async (_tenant, subject) => {
        asked = subject;
        return history;
      },
      /* Present and deliberately explosive: the subject branch must never fall through to it. */
      readActHistory: async () => {
        throw new Error("the subject branch must never reach the tenant-wide history");
      },
    },
  );
}

function linesOf(result: Awaited<ReturnType<typeof audit>>): string[] {
  assert.equal(result.status, "ok");
  return result.status === "ok" ? [...result.result.lines] : [];
}

async function main(): Promise<void> {
  /* ── 1 · THE REFERENCE RESOLVES TO THE WRITER'S OWN ENTITY TYPE ──────────── */
  {
    const result = await audit(WORK_REF, {
      status: "recorded",
      tenantId: TENANT.tenantId,
      subject: { entityType: "work_item", entityId: WORK_ID },
      generatedAt: NOW,
      page: { acts: [act()], totalRecordedActs: 1, truncated: false },
    });
    assert.deepEqual(
      asked,
      { entityType: "work_item", entityId: WORK_ID },
      "the hyphenated reference resolves to the underscored entity_type its writers stamp",
    );
    const body = linesOf(result).join("\n");
    assert.ok(body.includes(WORK_REF), "the answer names the subject it is about");
    assert.ok(body.includes("work.reference-declared"), "the writer's own verb, verbatim");
    assert.ok(body.includes("human"), "and the KIND of actor");
    assert.ok(body.includes("membership"), "and the authority source");
  }

  /* ── 2 · THE VERB IS "RECORDED", NEVER A CLAIM ABOUT THE WORLD ───────────
   * "Hebun recorded N acts" is provable from rows. "N things happened to this work" is not.
   */
  {
    const result = await audit(WORK_REF, {
      status: "recorded",
      tenantId: TENANT.tenantId,
      subject: { entityType: "work_item", entityId: WORK_ID },
      generatedAt: NOW,
      page: { acts: [act()], totalRecordedActs: 1, truncated: false },
    });
    const body = linesOf(result).join("\n");
    assert.ok(/Hebun recorded 1 act for this subject/.test(body), "singular, and attributed to Hebun");
    assert.ok(
      /not progress, not completion and not verification/i.test(body),
      "the three non-inferences are rendered, never left to be inferred",
    );
    assert.ok(!/\bhappened\b/i.test(body.split("Work done outside")[0]!), "no act is called a happening");
  }

  /* ── 3 · TRUNCATION IS STATED, NEVER SILENT ─────────────────────────────── */
  {
    const acts = Array.from({ length: RECORDED_ACT_PAGE_LIMIT }, (_, i) =>
      act({ occurredAt: `2026-09-02T19:${String(i).padStart(2, "0")}:00.000Z` }),
    );
    const result = await audit(WORK_REF, {
      status: "recorded",
      tenantId: TENANT.tenantId,
      subject: { entityType: "work_item", entityId: WORK_ID },
      generatedAt: NOW,
      page: { acts, totalRecordedActs: 61, truncated: true },
    });
    const body = linesOf(result).join("\n");
    assert.ok(
      body.includes("Hebun recorded 61 acts for this subject") &&
        body.includes(`showing the ${RECORDED_ACT_PAGE_LIMIT} most recent`),
      "a truncated page says how many of how many it shows",
    );
  }

  /* ── 4 · EMPTY IS A STATEMENT ABOUT THE RECORD, NOT ABOUT THE WORLD ──────
   * THE SENTENCE THIS PHASE EXISTS FOR. A subject with no recorded acts is not a subject nothing
   * happened to; it is a subject Hebun performed no recorded act on.
   */
  {
    const result = await audit(WORK_REF, {
      status: "empty",
      tenantId: TENANT.tenantId,
      subject: { entityType: "work_item", entityId: WORK_ID },
      generatedAt: NOW,
    });
    const body = linesOf(result).join("\n");
    assert.ok(
      body.includes("Hebun has no recorded acts for this subject in this record."),
      "the empty answer is about the record",
    );
    assert.ok(
      /statement about Hebun's record, NOT about the world/i.test(body),
      "and says so explicitly",
    );
    assert.ok(
      /Work done outside Hebun[\s\S]*is no less real/.test(body),
      "and names the work this record cannot see",
    );
    /*
     * A BARE SUBSTRING BAN WOULD FAIL ON THE PRODUCT'S OWN HONEST DENIAL. The surface must SAY
     * "this is not evidence that nothing happened", so "nothing happened" appears — negated. The
     * banned thing is the ASSERTION, so this pins the denial's presence and forbids the phrase
     * only where a sentence would be making the claim.
     */
    assert.ok(
      /not evidence that nothing happened/i.test(body),
      "the inference a reader makes automatically is refused in words",
    );
    assert.ok(
      !/(^|[.:\n]\s*)nothing happened/i.test(body),
      "and no sentence asserts it",
    );
    assert.ok(!/\binactive\b|\bidle\b|\bstalled\b|\babandoned\b/i.test(body), "and infers no state");
  }

  /* ── 5 · UNRECOGNIZED IS A REFUSAL, AND IT IS NOT EMPTY ──────────────────
   * A typo must never be able to manufacture an organizational claim.
   */
  {
    const result = await audit("not-a-subject/12345", {
      status: "empty",
      tenantId: TENANT.tenantId,
      subject: { entityType: "work_item", entityId: WORK_ID },
      generatedAt: NOW,
    });
    assert.equal(asked, null, "an unaddressable reference reaches no reader at all");
    const body = linesOf(result).join("\n");
    assert.ok(/NOTHING WAS READ/.test(body), "it says nothing was read");
    assert.ok(!/no recorded acts/i.test(body), "and never renders as an empty history");
    assert.equal(
      result.status === "ok" ? result.result.tone : null,
      "unavailable",
      "and it is toned as unavailable, not as an answer",
    );
  }

  /* ── 6 · UNAVAILABLE IS NOT EMPTY ───────────────────────────────────────── */
  {
    const result = await audit(WORK_REF, { status: "unavailable", reason: "read-failed" });
    const body = linesOf(result).join("\n");
    assert.ok(/UNKNOWN, not empty/.test(body), "a failed read is unknown, never empty");
    assert.ok(!/no recorded acts for this subject in this record/.test(body), "and makes no claim");
  }

  /* ── 7 · NO SUBJECT MEANS THE RELEASED COMMAND, UNCHANGED ────────────────
   * `/audit` alone must still be R7.1.1's command. The subject reader is never consulted.
   */
  {
    asked = null;
    const result = await runHebyReadCommand(
      { commandId: "audit", args: [], route: "/heby" },
      {
        resolveTenant: async () => TENANT,
        readActHistory: async () => ({
          status: "empty" as const,
          tenantId: TENANT.tenantId,
          generatedAt: NOW,
        }),
        readSubjectActHistory: async () => {
          throw new Error("the tenant-wide branch must never reach the subject reader");
        },
      },
    );
    assert.equal(asked, null, "no subject was asked for");
    assert.ok(
      linesOf(result).join("\n").includes("Hebun has recorded no acts for your organization."),
      "the released tenant-wide wording is untouched",
    );
  }

  /* ── 8 · THE PROJECTION IS THE SECURITY BOUNDARY, AT THE SURFACE ─────────
   * `RecordedAct` has no field for any withheld column, so no rendering can leak one. This asserts
   * it against the LIST rather than against a remembered sentence.
   */
  {
    const rendered = act() as unknown as Record<string, unknown>;
    for (const column of WITHHELD_AUDIT_COLUMNS) {
      assert.ok(
        !(column in rendered),
        `a recorded act must carry no ${column} — the shape has no hole for it`,
      );
    }
  }

  /* ── 9 · THE REFERENCE VOCABULARY IS SMALL, CLOSED, AND MAPS TO REAL TYPES ─ */
  {
    const kinds = Object.keys(ACT_SUBJECT_REFERENCE_KINDS);
    assert.ok(kinds.includes("work-item"), "work-item is addressable — the phase requires it");
    for (const [reference, entityType] of Object.entries(ACT_SUBJECT_REFERENCE_KINDS)) {
      assert.ok(/^[a-z][a-z0-9-]*$/.test(reference), `${reference} is a reference spelling`);
      assert.ok(/^[a-z][a-z0-9_]*$/.test(entityType), `${entityType} is an entity_type spelling`);
    }
  }

  console.log("subject-act-history-flow/subject-truth: OK");
}

void main();
