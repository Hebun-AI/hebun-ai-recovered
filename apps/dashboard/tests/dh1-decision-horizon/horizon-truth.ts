/*
 * DH-1 — WHAT ACTUALLY NEEDS A HUMAN DECISION ACROSS HEBUN.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "The horizon gathers everything this organization has recorded as awaiting a human decision
 *    from ALL THREE authorities that own one, keeps each item attributed to its owner and routed to
 *    the surface where its decision is actually taken, and states whether the gathering was
 *    COMPLETE. `Nothing is awaiting a decision` is said only when every source answered and every
 *    one of them answered with nothing — one unreadable source makes the horizon partial and names
 *    the authority that could not answer."
 *
 * The pins:
 *
 *   COMPOSED       != OWNED           GATHERED    != DECIDED
 *   PARTIAL        != EMPTY           UNAVAILABLE != HOLDS NOTHING
 *   UNDECIDED      != DECLINED        DIFFERENT KINDS != ONE RANKED QUEUE
 *   DERIVED HORIZON, AUTHORITATIVE ITEMS
 *
 * Pure: no database, no network, no model. Every read seam is injected.
 */
import assert from "node:assert/strict";
import {
  DECISION_SOURCE_KEYS,
  DECISION_SOURCE_OWNERS,
  HORIZON_EMPTY_STATEMENT,
  HORIZON_NON_CLAIMS,
  MAX_HORIZON_ITEMS_PER_SOURCE,
  horizonPartialStatement,
} from "../../src/features/decision-horizon/contracts";
import {
  decisionRouteFor,
  horizonCoversEverySource,
  readDecisionHorizon,
  type DecisionHorizon,
} from "../../src/features/decision-horizon/read-decision-horizon.server";
import {
  DECISION_HORIZON_NON_CLAIM,
  DECISION_HORIZON_PROVENANCE,
  readDecisionHorizonGroundingSource,
} from "../../src/features/decision-horizon/heby-decision-horizon-source.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const TENANT = { tenantId: "t-1", userId: "u-1" } as unknown as TenantContext;

/* eslint-disable @typescript-eslint/no-explicit-any */
const action = (requestId: string) => ({
  requestId,
  actionKind: "send",
  expectedEffect: "An email leaves Hebun.",
  targetLabel: "somebody@example.test",
  sideEffect: "external",
  reversibility: "irreversible",
  consequences: ["A third party receives it."],
  evidence: { status: "none" as const },
  proposedByActorType: "agent",
  proposedByAgentName: "Scout",
  proposedByAgentInService: true,
  proposedAt: "2026-09-01T10:00:00Z",
});

const hypothesis = (id: string, undecided = true) => ({
  hypothesisId: id,
  agentName: "Scout",
  inService: true,
  improvementTarget: "Reduce refusals",
  evidenceFindingKey: "refusals" as never,
  evidenceSource: "audit",
  evidenceObservedValue: 1,
  evidenceObservedTotal: 10,
  evidenceObservedAt: "2026-09-01T09:00:00Z",
  candidateChange: "Narrow the mandate",
  expectedEffect: "Fewer refusals",
  limitations: "None recorded",
  filedAt: "2026-09-01T09:30:00Z",
  decision: undecided ? { status: "undecided" as const } : { status: "decided" as const, decisionId: "d", outcome: "accepted", accepted: true, decidedAt: null, justification: "j" },
});

const deps = (o: {
  actions?: unknown;
  hypotheses?: unknown;
  versions?: unknown;
  decided?: unknown;
}) =>
  ({
    readActionRequests: async () => o.actions ?? { status: "read", items: [] },
    readHypotheses: async () => o.hypotheses ?? { status: "read", hypotheses: [], truncated: false, limit: 50 },
    readKnowledgeVersions: async () => o.versions ?? { status: "read", versions: [] },
    readDecidedKnowledge: async () => o.decided ?? { status: "read", decidedNodeIds: new Set<string>() },
  }) as any;

const blockOf = (h: DecisionHorizon, source: string) => {
  assert.equal(h.status, "read");
  if (h.status !== "read") throw new Error("unreachable");
  const block = h.blocks.find((b) => b.source === source);
  assert.ok(block, `the horizon must always account for ${source}`);
  return block!;
};

async function main(): Promise<void> {
  /* ═════════════════════════════════════════════════════════════════════════
   * 1. THE VOCABULARY IS CLOSED, AND EVERY SOURCE HAS AN OWNER AND A ROUTE.
   * ═══════════════════════════════════════════════════════════════════════ */
  assert.deepEqual(
    [...DECISION_SOURCE_KEYS],
    ["action-requests", "improvement-hypotheses", "knowledge-review"],
    "three sources, named exactly — a fourth is a deliberate edit",
  );
  for (const source of DECISION_SOURCE_KEYS) {
    const owner = DECISION_SOURCE_OWNERS[source];
    assert.ok(owner.authority.length > 0, `${source} names its owning authority`);
    assert.match(owner.route, /^\//, `${source} routes to a real surface, not to this feature`);
    assert.ok(owner.subject.length > 0, `${source} says what kind of decision it is`);
    assert.equal(decisionRouteFor(source), owner.route);
  }
  assert.ok(Object.isFrozen(HORIZON_NON_CLAIMS));
  assert.equal(HORIZON_NON_CLAIMS.length, 6);
  assert.ok(HORIZON_NON_CLAIMS.some((c) => /composed, not owned/.test(c)), "COMPOSED != OWNED");
  assert.ok(HORIZON_NON_CLAIMS.some((c) => /never merged into one queue/.test(c)), "no false equivalence");
  assert.ok(HORIZON_NON_CLAIMS.some((c) => /partial horizon is never an empty one/.test(c)));

  /* ═════════════════════════════════════════════════════════════════════════
   * 2. EVERY SOURCE IS ACCOUNTED FOR IN EVERY READING.
   * ═══════════════════════════════════════════════════════════════════════ */
  {
    const horizon = await readDecisionHorizon(TENANT, deps({}));
    assert.ok(horizoncovers(horizon), "silence about a source would read as `that source has nothing`");
    assert.equal(horizon.status === "read" && horizon.completeness, "complete");
    assert.equal(horizon.status === "read" && horizon.answeredTotal, 0);
    for (const source of DECISION_SOURCE_KEYS) {
      const block = blockOf(horizon, source);
      assert.equal(block.status, "answered");
      assert.equal(block.status === "answered" && block.total, 0);
    }
  }

  /* ═════════════════════════════════════════════════════════════════════════
   * 3. ALL THREE KINDS ARRIVE, EACH ATTRIBUTED AND EACH KEPT APART.
   * ═══════════════════════════════════════════════════════════════════════ */
  {
    const horizon = await readDecisionHorizon(
      TENANT,
      deps({
        actions: { status: "read", items: [action("r-1")] },
        hypotheses: { status: "read", hypotheses: [hypothesis("h-1")], truncated: false, limit: 50 },
        versions: { status: "read", versions: [{ nodeId: "n-1", authoredAt: "2026-08-01T00:00:00Z" }, { nodeId: "n-2", authoredAt: null }] },
        decided: { status: "read", decidedNodeIds: new Set(["n-2"]) },
      }),
    );
    assert.equal(horizon.status, "read");
    if (horizon.status !== "read") throw new Error("unreachable");
    assert.equal(horizon.completeness, "complete");
    assert.equal(horizon.answeredTotal, 3, "one of each kind — counted, never ranked");

    const actions = blockOf(horizon, "action-requests");
    assert.equal(actions.status === "answered" && actions.items[0]!.recordId, "r-1");
    assert.match(
      (actions.status === "answered" && actions.items[0]!.label) || "",
      /send — irreversible, external/,
      "the label is STORED PROPERTIES of the frozen proposal, never a judgement",
    );

    const hypotheses = blockOf(horizon, "improvement-hypotheses");
    assert.equal(hypotheses.status === "answered" && hypotheses.total, 1);

    /* THE SUBTRACTION WORKED: the decided node is gone, the undecided one remains. */
    const knowledge = blockOf(horizon, "knowledge-review");
    assert.equal(knowledge.status === "answered" && knowledge.total, 1, "n-2 was decided and is absent");
    assert.equal(knowledge.status === "answered" && knowledge.items[0]!.recordId, "n-1");
    assert.ok(
      knowledge.status === "answered" &&
        !/statement|content|title/i.test(knowledge.items[0]!.label),
      "the Knowledge item carries no ratifiable text — only the version a decision would name",
    );
  }

  /* A DECIDED HYPOTHESIS IS NOT WAITING. UNDECIDED IS A THIRD STATE. */
  {
    const horizon = await readDecisionHorizon(
      TENANT,
      deps({ hypotheses: { status: "read", hypotheses: [hypothesis("h-1", false)], truncated: false, limit: 50 } }),
    );
    const block = blockOf(horizon, "improvement-hypotheses");
    assert.equal(block.status === "answered" && block.total, 0, "a decided hypothesis is not awaiting a decision");
  }

  /* ═════════════════════════════════════════════════════════════════════════
   * 4. THE COMPLETENESS RULE. THE SENTENCE THIS FEATURE EXISTS TO PROTECT.
   * ═══════════════════════════════════════════════════════════════════════ */
  for (const [label, injected, expected] of [
    ["the action authority", { actions: { status: "unavailable", reason: "db-down" } }, "action-requests"],
    ["the hypothesis authority", { hypotheses: { status: "unavailable", reason: "db-down" } }, "improvement-hypotheses"],
    ["Knowledge", { versions: { status: "unavailable", reason: "db-down" } }, "knowledge-review"],
    ["Governance's decision record", { decided: { status: "unavailable", reason: "db-down" } }, "knowledge-review"],
  ] as const) {
    const horizon = await readDecisionHorizon(TENANT, deps(injected as never));
    assert.equal(horizon.status, "read");
    if (horizon.status !== "read") throw new Error("unreachable");
    assert.equal(horizon.completeness, "partial", `${label} being unreadable makes the horizon PARTIAL`);
    assert.deepEqual([...horizon.unavailableSources], [expected], "and it names which source");
    const block = blockOf(horizon, expected);
    assert.equal(block.status, "unavailable");
  }

  /*
   * THE SUBTRACTION FAILS CLOSED IN BOTH DIRECTIONS. A readable version list with an unreadable
   * decision set would make EVERY current version look undecided — the specific falsehood.
   */
  {
    const horizon = await readDecisionHorizon(
      TENANT,
      deps({
        versions: { status: "read", versions: [{ nodeId: "n-1", authoredAt: null }] },
        decided: { status: "unavailable", reason: "governance-down" },
      }),
    );
    const block = blockOf(horizon, "knowledge-review");
    assert.equal(block.status, "unavailable", "one half missing makes the block unavailable, never zero");
    assert.match(
      (block.status === "unavailable" && block.reason) || "",
      /^governance-decision:/,
      "and it names WHICH half, in that authority's own words",
    );
  }

  /* ONE SOURCE FAILING DOES NOT HIDE THE OTHERS. */
  {
    const horizon = await readDecisionHorizon(
      TENANT,
      deps({
        actions: { status: "read", items: [action("r-1")] },
        hypotheses: { status: "unavailable", reason: "db-down" },
      }),
    );
    assert.equal(horizon.status === "read" && horizon.completeness, "partial");
    assert.equal(horizon.status === "read" && horizon.answeredTotal, 1, "the answered sources still answer");
    const actions = blockOf(horizon, "action-requests");
    assert.equal(actions.status, "answered");
  }

  /* ═════════════════════════════════════════════════════════════════════════
   * 5. TRUNCATION DECLARES ITSELF, AND CARRIES THE SOURCE'S OWN BOUND TOO.
   * ═══════════════════════════════════════════════════════════════════════ */
  {
    const many = Array.from({ length: MAX_HORIZON_ITEMS_PER_SOURCE + 3 }, (_, i) => action(`r-${i}`));
    const horizon = await readDecisionHorizon(TENANT, deps({ actions: { status: "read", items: many } }));
    const block = blockOf(horizon, "action-requests");
    assert.equal(block.status === "answered" && block.truncated, true);
    assert.equal(block.status === "answered" && block.total, many.length, "the TOTAL is the source's, not the page's");
    assert.equal(block.status === "answered" && block.items.length, MAX_HORIZON_ITEMS_PER_SOURCE);
  }
  {
    /* The released hypothesis reader's OWN bound travels, even when this ceiling did not bite. */
    const horizon = await readDecisionHorizon(
      TENANT,
      deps({ hypotheses: { status: "read", hypotheses: [hypothesis("h-1")], truncated: true, limit: 50 } }),
    );
    const block = blockOf(horizon, "improvement-hypotheses");
    assert.equal(block.status === "answered" && block.truncated, true,
      "a truncated upstream read must not be absorbed into a complete-looking block");
  }

  /* ═════════════════════════════════════════════════════════════════════════
   * 6. THE GROUNDING PROJECTION: THREE OWNERS, ONE CLASS, NO FALSE EMPTINESS.
   * ═══════════════════════════════════════════════════════════════════════ */
  const queueResolution = (items: readonly { recordRef: string; label: string; detail: string }[]) =>
    ({
      sourceClass: "decision-records" as const,
      state: "resolved" as const,
      provenance: "queue provenance",
      authoritative: true,
      items: items.map((i) => ({ ...i, lifecycle: "settled" as const })),
    });

  {
    const resolution = await readDecisionHorizonGroundingSource(TENANT, {
      readQueue: async () =>
        queueResolution([
          { recordRef: "heby-action-request/r-1", label: "send — awaiting a human decision", detail: "rich detail from the released projection" },
        ]),
      readHorizon: async () =>
        ({
          status: "read",
          completeness: "complete",
          unavailableSources: [],
          answeredTotal: 1,
          blocks: [
            {
              source: "improvement-hypotheses",
              status: "answered",
              total: 1,
              truncated: false,
              items: [{ source: "improvement-hypotheses", recordId: "h-1", label: "Scout — Reduce refusals", recordedAt: "2026-09-01T09:30:00Z" }],
            },
            { source: "knowledge-review", status: "answered", total: 0, truncated: false, items: [] },
          ],
        }) as never,
    });

    assert.equal(resolution.sourceClass, "decision-records", "the CLASS is unchanged — it was always this question");
    assert.equal(resolution.state, "resolved");
    assert.equal(resolution.authoritative, true);
    const text = JSON.stringify(resolution.items);

    assert.match(text, /rich detail from the released projection/,
      "the action half travels VERBATIM from the released projection — no re-derivation");
    assert.match(text, /improvement-hypotheses\/h-1/, "the hypothesis reaches the model");
    assert.match(text, /Agent Improvement Hypothesis Authority/, "attributed to its owner");
    assert.match(text, /\/governance\/authority/, "and routed to where the decision is actually taken");
    assert.ok(text.includes(DECISION_HORIZON_NON_CLAIM), "the standing non-claim rides on composed items");
    assert.match(text, /decision-horizon:complete/, "and the completeness verdict is always present");

    for (const [claim, pattern] of [
      ["composed, not owned", /COMPOSED, NOT OWNED/],
      ["three authorities named", /Action Authorization owns/],
      ["different kinds, never merged", /DIFFERENT KINDS OF DECISION/],
      ["no priority exists", /no priority, urgency, risk score or deadline/],
      ["completeness is stated", /STATES WHETHER IT IS COMPLETE/],
    ] as const) {
      assert.match(DECISION_HORIZON_PROVENANCE, pattern, `the provenance states: ${claim}`);
    }
  }

  /* THE EMPTY SENTENCE IS SAID ONLY WHEN ALL THREE ANSWERED AND ALL THREE WERE EMPTY. */
  {
    const resolution = await readDecisionHorizonGroundingSource(TENANT, {
      readQueue: async () => queueResolution([{ recordRef: "heby-action-request:none-pending", label: "Nothing", detail: "empty" }]),
      readHorizon: async () =>
        ({
          status: "read", completeness: "complete", unavailableSources: [], answeredTotal: 0,
          blocks: [
            { source: "improvement-hypotheses", status: "answered", total: 0, truncated: false, items: [] },
            { source: "knowledge-review", status: "answered", total: 0, truncated: false, items: [] },
          ],
        }) as never,
    });
    const text = JSON.stringify(resolution.items);
    assert.match(text, /decision-horizon:none/);
    assert.ok(text.includes(HORIZON_EMPTY_STATEMENT.slice(0, 60)), "the measured-absence sentence");
    assert.ok(!text.includes("none-pending"), "the single source's own empty item is dropped — emptiness is a horizon judgement");
  }

  /* AND IT IS NEVER SAID WHEN A SOURCE COULD NOT ANSWER. */
  for (const broken of ["queue", "horizon-block"] as const) {
    const resolution = await readDecisionHorizonGroundingSource(TENANT, {
      readQueue: async () =>
        broken === "queue"
          ? ({ sourceClass: "decision-records", state: "unavailable", provenance: "p", authoritative: true, items: [], unavailableReason: "db-down" } as never)
          : queueResolution([]),
      readHorizon: async () =>
        ({
          status: "read", completeness: broken === "horizon-block" ? "partial" : "complete",
          unavailableSources: broken === "horizon-block" ? ["knowledge-review"] : [],
          answeredTotal: 0,
          blocks: [
            { source: "improvement-hypotheses", status: "answered", total: 0, truncated: false, items: [] },
            broken === "horizon-block"
              ? { source: "knowledge-review", status: "unavailable", reason: "knowledge:db-down" }
              : { source: "knowledge-review", status: "answered", total: 0, truncated: false, items: [] },
          ],
        }) as never,
    });
    const text = JSON.stringify(resolution.items);
    assert.match(text, /decision-horizon:partial/, `${broken}: a partial horizon says so`);
    assert.ok(
      !text.includes("Nothing is awaiting a human decision in this organization right now"),
      `${broken}: PARTIAL IS NEVER EMPTY — the most expensive sentence this class can get wrong`,
    );
    assert.match(text, /NOTHING HERE SAYS THAT SOURCE HOLDS/, "and it says what cannot be concluded");
  }

  /* NO TENANT, NO HORIZON. */
  {
    const horizon = await readDecisionHorizon(null, deps({}));
    assert.equal(horizon.status, "unavailable");
    assert.equal(horizon.status === "unavailable" && horizon.reason, "no-authorized-tenant-context");
    const resolution = await readDecisionHorizonGroundingSource(null);
    assert.equal(resolution.state, "unavailable");
    assert.equal(resolution.items.length, 0);
  }

  assert.ok(horizonPartialStatement(["A"]).includes("PARTIAL"));
  console.log("PASS dh1-decision-horizon/horizon-truth");
}

function horizoncovers(h: DecisionHorizon): boolean {
  return horizonCoversEverySource(h);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
