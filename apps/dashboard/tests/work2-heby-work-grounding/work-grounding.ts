/*
 * WORK-2 — HEBY GROUNDS ON RECORDED WORK, AND GAINS NOTHING FROM IT.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "Heby can state what work this organization has RECORDED it is doing, what state a human
 *    DECLARED each to be in, which department it belongs to and who is accountable — from the
 *    Organizational Work Authority's own authoritative record. It distinguishes recorded work, a
 *    measured empty register and an unreachable authority, and never merges the last two. Every
 *    item carries the denial that a declared state is not an observed one and that declared
 *    complete is not successful. Nothing in the class can be read as an observation, an outcome or
 *    a grant."
 *
 * The pins:
 *
 *   RECORDED WORK     != OBSERVED ACTIVITY
 *   DECLARED STATE    != VERIFIED STATE
 *   DECLARED COMPLETE != SUCCESSFUL != OUTCOME ACHIEVED
 *   ACCOUNTABLE HUMAN != AUTHORIZED EXECUTOR
 *   DEPARTMENT REF    != THE HUMAN BELONGS TO THAT DEPARTMENT
 *   WORK ITEM         != WORK ARTIFACT
 *   UNAVAILABLE       != NONE RECORDED
 *
 * Pure: no database, no network, no model. Every read seam is injected.
 */
import assert from "node:assert/strict";
import {
  WORK_GROUNDING_PROVENANCE,
  WORK_LABEL_UNAVAILABLE,
  WORK_NONE_RECORDED_STATEMENT,
  WORK_NON_CLAIM,
  readWorkGroundingSource,
} from "../../src/features/organizational-work/heby-work-source.server";
import {
  WORK_DECLARED_STATES,
  WORK_DECLARED_STATE_MEANING,
} from "../../src/features/organizational-work/work-contracts";
import { HEBY_SOURCE_CLASSES } from "../../src/features/heby-integration/contracts";
import { resolveSource } from "../../src/features/heby-runtime/source-resolver";
import {
  HEBY_PROFILED_WORKSPACES,
  getHebyWorkspaceProfile,
} from "../../src/features/heby-integration/workspace-registry";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import type { WorkItemView, WorkRegister } from "../../src/features/organizational-work/read-work.server";

const TENANT = { tenantId: "t-1", userId: "u-1" } as unknown as TenantContext;

const ITEM: WorkItemView = {
  workItemId: "w-1",
  title: "Hebun Era III development",
  declaredState: "active",
  lifecycleStatus: "active",
  inService: true,
  department: { departmentId: "d-1", name: "Engineering" },
  accountableActorId: "u-1",
  accountableCurrentlyActiveMember: true,
  recordedAt: "2026-09-01T14:23:21.224Z",
  updatedAt: "2026-09-01T14:23:21.224Z",
};

const available = (items: readonly WorkItemView[], truncated = false): WorkRegister => ({
  status: "available",
  items,
  truncated,
  detail: "detail",
});

const labelsFor = (m: Record<string, string>): ReadonlyMap<string, string> => new Map(Object.entries(m));

async function main(): Promise<void> {
  /* ═════════════════════════════════════════════════════════════════════════
   * 1. `work` IS A DECLARED SOURCE CLASS, AND THE PURE RESOLVER KNOWS IT.
   * ═══════════════════════════════════════════════════════════════════════ */
  assert.ok(HEBY_SOURCE_CLASSES.includes("work"), "`work` is a declared Heby source class");
  assert.equal(HEBY_SOURCE_CLASSES.length, 20, "the census is twenty — WORK-2 added the 18th, Departmental Placement the 19th, OSA-4 the 20th");

  const pure = resolveSource("work");
  assert.equal(pure.sourceClass, "work");
  assert.equal(pure.state, "unavailable", "the PURE resolver holds no tenant, so it reads nothing");
  assert.match(
    pure.unavailableReason ?? "",
    /tenant-scoped on the server/,
    "and it explains the SEAM rather than claiming the organization has no work",
  );
  assert.ok(
    !/no work|none recorded|nothing recorded/i.test(pure.unavailableReason ?? ""),
    "UNAVAILABLE != NONE RECORDED — the pure default must never read as an absence",
  );

  /* ═════════════════════════════════════════════════════════════════════════
   * 2. WORKSPACE SCOPE IS EXACT: COMMAND, AND ONLY COMMAND.
   * ═══════════════════════════════════════════════════════════════════════ */
  const carrying = HEBY_PROFILED_WORKSPACES.filter((w) =>
    getHebyWorkspaceProfile(w).sourceClasses.includes("work"),
  );
  assert.deepEqual(carrying, ["command"], "exactly one workspace declares `work`, and it is Command");
  for (const w of ["workforce", "operations", "intelligence", "knowledge", "governance", "platform", "decisions"] as const) {
    assert.ok(
      !getHebyWorkspaceProfile(w).sourceClasses.includes("work"),
      `${w} must not gain \`work\` — scope is exact, not convenient`,
    );
  }
  assert.equal(HEBY_PROFILED_WORKSPACES.length, 8, "no ninth workspace was created");

  /* ═════════════════════════════════════════════════════════════════════════
   * 3. RECORDED WORK REACHES THE MODEL, WITH EVERY FACT THE DIRECTOR ASKED FOR.
   * ═══════════════════════════════════════════════════════════════════════ */
  const resolved = await readWorkGroundingSource(TENANT, {
    readRegister: async () => available([ITEM]),
    resolveNames: async () => labelsFor({ "u-1": "Şenol Sevim" }),
  });
  assert.equal(resolved.state, "resolved");
  assert.equal(resolved.sourceClass, "work");
  assert.equal(resolved.authoritative, true, "`work_items` IS the record; the class says so");
  assert.equal(resolved.provenance, WORK_GROUNDING_PROVENANCE, "provenance is carried unchanged");
  assert.equal(resolved.items.length, 1);

  const item = resolved.items[0]!;
  assert.equal(item.recordRef, "work-item/w-1", "a reference the model can never invent");
  assert.equal(item.label, "Hebun Era III development", "the TITLE reaches context");
  assert.equal(item.lifecycle, "settled");
  assert.match(item.detail, /declared state: active/, "the DECLARED STATE reaches context");
  assert.match(item.detail, /Engineering/, "the DEPARTMENT NAME reaches context");
  assert.match(item.detail, /\(d-1\)/, "and its identifier travels with it");
  assert.match(item.detail, /Şenol Sevim/, "the ACCOUNTABLE HUMAN'S READABLE LABEL reaches context");
  assert.match(item.detail, /\(u-1\)/, "THE LABEL IS NOT THE KEY — the identifier travels beside it");
  assert.match(item.detail, /in service/);
  assert.match(item.detail, /recorded 2026-09-01T14:23:21\.224Z/);

  /* ═════════════════════════════════════════════════════════════════════════
   * 4. THE TRUTH SEMANTICS TRAVEL AS DATA, NOT AS PROMPT PROSE.
   * ═══════════════════════════════════════════════════════════════════════ */
  assert.match(item.detail, /DECLARED state, not an observed or verified one/i);
  assert.match(item.detail, /declared complete is not successful and is not an outcome/i);
  assert.match(item.detail, /attributed, not authorized to execute/i);
  assert.match(item.detail, /does not say the accountable human belongs to that/i);
  assert.ok(item.detail.includes(WORK_NON_CLAIM), "the standing non-claim rides on every item");

  for (const phrase of [
    /EVERY STATE IS A DECLARATION/,
    /did not observe the work, did not verify it/,
    /DECLARED COMPLETE IS NOT VERIFIED, NOT SUCCESSFUL, AND NOT AN OUTCOME/,
    /grants that person nothing/,
    /never ratified/,
    /No progress, health, priority, due date or outcome is carried/,
  ]) {
    assert.match(WORK_GROUNDING_PROVENANCE, phrase, `provenance carries ${phrase}`);
  }

  /* Every declared state's MEANING names the declarer — asserted for all four, not just one. */
  for (const state of WORK_DECLARED_STATES) {
    const one = await readWorkGroundingSource(TENANT, {
      readRegister: async () => available([{ ...ITEM, declaredState: state }]),
      resolveNames: async () => labelsFor({}),
    });
    const d = one.items[0]!.detail;
    assert.match(d, new RegExp(`declared state: ${state}`), `${state} reaches context`);
    assert.ok(
      d.includes(WORK_DECLARED_STATE_MEANING[state]),
      `${state} carries its meaning, which names who declared it`,
    );
  }

  /* DECLARED COMPLETE IS NOT VERIFIED — the single most dangerous confusion, asserted directly. */
  const complete = await readWorkGroundingSource(TENANT, {
    readRegister: async () => available([{ ...ITEM, declaredState: "complete" }]),
    resolveNames: async () => labelsFor({}),
  });
  const completeDetail = complete.items[0]!.detail;
  assert.match(completeDetail, /Declared complete by an authorized human/);
  assert.match(completeDetail, /did not verify it, did not observe it/);
  assert.ok(
    !/\bverified complete\b|\bsuccessfully\b|\bfinished in reality\b|\boutcome achieved\b/i.test(
      completeDetail,
    ),
    "nothing in a completed item's detail asserts verification, success or an outcome",
  );

  /* ═════════════════════════════════════════════════════════════════════════
   * 5. AN EMPTY REGISTER IS A MEASURED ANSWER. AN OUTAGE IS NOT.
   * ═══════════════════════════════════════════════════════════════════════ */
  const empty = await readWorkGroundingSource(TENANT, {
    readRegister: async () => available([]),
    resolveNames: async () => labelsFor({}),
  });
  assert.equal(empty.state, "resolved", "looked, found none — a REAL answer, never an outage");
  assert.equal(empty.items.length, 1);
  assert.ok(empty.items[0]!.detail.includes(WORK_NONE_RECORDED_STATEMENT));
  assert.match(
    empty.items[0]!.detail,
    /never a statement that the organization is doing nothing/,
    "the measured absence refuses to become a claim about the organization",
  );

  const down = await readWorkGroundingSource(TENANT, {
    readRegister: async () => ({ status: "unavailable", detail: "d" }) as WorkRegister,
    resolveNames: async () => labelsFor({}),
  });
  assert.equal(down.state, "unavailable", "an unreachable authority is UNAVAILABLE");
  assert.equal(down.items.length, 0, "and contributes no item a model could read as work");
  assert.match(down.unavailableReason ?? "", /UNAVAILABLE IS NOT NONE/);
  assert.notEqual(
    down.unavailableReason,
    empty.items[0]!.detail,
    "the outage sentence and the measured-absence sentence are never the same words",
  );

  const noTenant = await readWorkGroundingSource(null);
  assert.equal(noTenant.state, "unavailable");
  assert.equal(noTenant.unavailableReason, "no-authorized-tenant-context");

  /* ═════════════════════════════════════════════════════════════════════════
   * 6. NO BLOCKED WORK STAYS ABSENT. NOTHING IS INFERRED.
   * ═══════════════════════════════════════════════════════════════════════ */
  const nothingBlocked = await readWorkGroundingSource(TENANT, {
    readRegister: async () => available([ITEM]),
    resolveNames: async () => labelsFor({ "u-1": "Şenol Sevim" }),
  });
  const allDetail = nothingBlocked.items.map((i) => i.detail).join(" ");
  assert.ok(
    !/declared state: blocked/.test(allDetail),
    "no item claims a blocked state when none is recorded — a blocker is never inferred",
  );
  assert.ok(
    !/blocker|impediment|at risk|stalled|overdue|behind schedule/i.test(allDetail),
    "and no blocker vocabulary is manufactured anywhere in the class",
  );

  /* ═════════════════════════════════════════════════════════════════════════
   * 7. AN UNRESOLVED HUMAN IS SAID TO BE UNRESOLVED, NEVER GUESSED.
   * ═══════════════════════════════════════════════════════════════════════ */
  const unlabelled = await readWorkGroundingSource(TENANT, {
    readRegister: async () => available([ITEM]),
    resolveNames: async () => labelsFor({}),
  });
  assert.match(unlabelled.items[0]!.detail, new RegExp(WORK_LABEL_UNAVAILABLE));
  assert.match(unlabelled.items[0]!.detail, /\(u-1\)/, "the identifier is still there");

  /* A legibility outage must not take the work down with it. */
  const labelThrew = await readWorkGroundingSource(TENANT, {
    readRegister: async () => available([ITEM]),
    resolveNames: async () => { throw new Error("identity down"); },
  });
  assert.equal(labelThrew.state, "resolved", "work survives a legibility failure");
  assert.match(labelThrew.items[0]!.detail, new RegExp(WORK_LABEL_UNAVAILABLE));

  /* Nobody accountable is its own answer, and not an unresolved name. */
  const unowned = await readWorkGroundingSource(TENANT, {
    readRegister: async () => available([{ ...ITEM, accountableActorId: null, accountableCurrentlyActiveMember: null }]),
    resolveNames: async () => labelsFor({}),
  });
  assert.match(unowned.items[0]!.detail, /No human is recorded accountable/);
  assert.ok(!unowned.items[0]!.detail.includes(WORK_LABEL_UNAVAILABLE));

  /* A human who has since left is still NAMED, and their standing is stated. */
  const departed = await readWorkGroundingSource(TENANT, {
    readRegister: async () => available([{ ...ITEM, accountableCurrentlyActiveMember: false }]),
    resolveNames: async () => labelsFor({ "u-1": "Şenol Sevim" }),
  });
  assert.match(departed.items[0]!.detail, /no longer an active member/);
  assert.match(departed.items[0]!.detail, /Şenol Sevim/, "history is not rewritten");

  /* No department recorded is its own answer too. */
  const noDept = await readWorkGroundingSource(TENANT, {
    readRegister: async () => available([{ ...ITEM, department: null }]),
    resolveNames: async () => labelsFor({}),
  });
  assert.match(noDept.items[0]!.detail, /No department is recorded/);

  /* ═════════════════════════════════════════════════════════════════════════
   * 8. RETIRED WORK IS RETURNED AND LABELLED, NEVER HIDDEN.
   * ═══════════════════════════════════════════════════════════════════════ */
  const retired = await readWorkGroundingSource(TENANT, {
    readRegister: async () => available([{ ...ITEM, inService: false, lifecycleStatus: "archived" }]),
    resolveNames: async () => labelsFor({}),
  });
  assert.equal(retired.items[0]!.lifecycle, "retired", "the retrieval layer's own word for it");
  assert.match(retired.items[0]!.detail, /retired from service/);

  /* ═════════════════════════════════════════════════════════════════════════
   * 9. A BOUNDED LIST SAYS SO.
   * ═══════════════════════════════════════════════════════════════════════ */
  const bounded = await readWorkGroundingSource(TENANT, {
    readRegister: async () => available([ITEM], true),
    resolveNames: async () => labelsFor({}),
  });
  const boundedItem = bounded.items.find((i) => i.recordRef === "work:bounded");
  assert.ok(boundedItem, "a truncated register contributes an explicit bound item");
  assert.match(boundedItem!.detail, /never of\s+what the organization holds/);

  console.log("PASS work2-heby-work-grounding/work-grounding");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
