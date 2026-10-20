/*
 * PLAN-FOLLOW-UP-LINEAGE-1 — an AI plan says when Work already records an OPEN follow-up for the items
 * a recommendation names, and the work register names each follow-up with its current state.
 *
 * Pure: the runtime runs with a fake generator and injected tenant-scoped reads; one component is
 * rendered. No database, no network, no model. The reader's own tenant predicate is proven against
 * PostgreSQL in `plan-follow-up-reference-v1/provenance-postgres.ts` (another tenant reads nothing).
 */
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { runAiOperationalPlan } from "../../src/features/heby-commands/ai-operational-plan.server";
import { existingFollowUpAdvisory, type PlanFollowUp } from "../../src/features/heby-commands/plan-follow-up";
import {
  existingFollowUpsFor,
  isOpenFollowUp,
  type WorkFollowUpLinksRead,
} from "../../src/features/organizational-work/follow-up-source-work.server";
import type { WorkItemView, WorkRegister } from "../../src/features/organizational-work/read-work.server";
import { WorkRegisterPanel } from "../../src/components/organizational-work/work-register";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

/* A router that does nothing: the register renders inside the App Router in production. */
const INERT_ROUTER = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {} };
const TENANT = { tenantId: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222", sessionContextId: "s" } as unknown as TenantContext;
const NOW = new Date("2026-10-21T12:00:00.000Z");
const PLAN_REF = "P-0123456789ab";
const DEPT = { departmentId: "aaaaaaaa-0000-4000-8000-000000000001", name: "Engineering" };
const id = (n: number) => `bbbbbbbb-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`;
const view = (n: number, title: string, p: Partial<WorkItemView> = {}): WorkItemView => ({
  workItemId: id(n), title, declaredState: "active", lifecycleStatus: "active", inService: true, department: DEPT,
  accountableActorId: "cccccccc-0000-4000-8000-000000000001", accountableCurrentlyActiveMember: true,
  recordedAt: new Date(NOW.getTime() - 90 * 86_400_000).toISOString(), updatedAt: new Date(NOW.getTime() - 86_400_000).toISOString(), ...p,
});

/* Newest first, as the register reads. Sources S1 (blocked) and S2 (blocked); follow-ups F-open, F-done, F-retired. */
const F_OPEN = view(1, "Find what unblocks the loom");
const F_DONE = view(2, "Old dye follow-up", { declaredState: "complete" });
const F_RETIRED = view(3, "Abandoned loom follow-up", { inService: false, lifecycleStatus: "archived" });
const S1 = view(4, "Blocked loom repair", { declaredState: "blocked" });
const S2 = view(5, "Blocked dye order", { declaredState: "blocked" });
const ITEMS = [F_OPEN, F_DONE, F_RETIRED, S1, S2];
const REGISTER: WorkRegister = { status: "available", items: ITEMS, truncated: false, detail: "d" };
const link = (follow: WorkItemView, source: WorkItemView) => ({ workItemId: follow.workItemId, sourceWorkItemId: source.workItemId });
const LINKS: WorkFollowUpLinksRead = {
  status: "read",
  truncated: false,
  links: [link(F_OPEN, S1), link(F_RETIRED, S1), link(F_DONE, S2)],
};

/* ── 1 · Work's rule, and the reads it needs: open, done, retired, none, unknown. ─────────────── */
{
  assert.equal(isOpenFollowUp(F_OPEN), true);
  assert.equal(isOpenFollowUp(F_DONE), false, "a complete follow-up is not open");
  assert.equal(isOpenFollowUp(F_RETIRED), false, "a retired follow-up is not open");

  assert.deepEqual(existingFollowUpsFor([S1.workItemId], LINKS, ITEMS), {
    status: "known",
    open: [{ title: "Find what unblocks the loom", declaredState: "active" }],
  }, "1 · an open follow-up is named; the retired one beside it is not");
  assert.deepEqual(existingFollowUpsFor([S2.workItemId], LINKS, ITEMS), { status: "known", open: [] }, "2 · only a complete follow-up: none open");
  assert.deepEqual(existingFollowUpsFor([F_DONE.workItemId], LINKS, ITEMS), { status: "known", open: [] }, "4 · no relationship: none, not unknown");

  for (const [label, links, items] of [
    ["truncated relationship read", { ...LINKS, truncated: true }, ITEMS],
    ["unavailable relationship read", { status: "unavailable" }, ITEMS],
    ["no complete register", LINKS, null],
    ["a recorded follow-up outside the register", LINKS, ITEMS.filter((i) => i !== F_OPEN)],
  ] as const) {
    assert.deepEqual(existingFollowUpsFor([S1.workItemId], links as WorkFollowUpLinksRead, items), { status: "unknown" }, `5 · ${label} is unknown`);
  }

  assert.equal(existingFollowUpAdvisory({ status: "known", open: [{ title: "Find what unblocks the loom", declaredState: "active" }] }),
    "An existing follow-up is already recorded: Find what unblocks the loom (active).");
  assert.equal(existingFollowUpAdvisory({ status: "known", open: [] }), null, "no advisory when Work records none open");
  assert.match(existingFollowUpAdvisory({ status: "unknown" })!, /could not be read/, "unknown is said, never turned into none");
}

/* ── 2 · The runtime: read AFTER the model, from the trusted tenant; the model request is unchanged. ── */
async function plan(links: WorkFollowUpLinksRead | "throws", register: WorkRegister = REGISTER) {
  const events: string[] = [];
  const requests: string[] = [];
  const minted: unknown[] = [];
  const result = await runAiOperationalPlan({ message: "AI ile Engineering için aksiyon planı hazırla" }, {
    resolveTenant: async () => TENANT,
    readStructure: async () => ({ status: "available", detail: "d", departments: [{ ...DEPT, slug: "engineering", lifecycleStatus: "active", inService: true }] }) as never,
    readWork: async () => register,
    readEvidence: async () => ({ status: "available", references: [] }),
    declare: () => ({ tenantId: TENANT.tenantId, actorUserId: TENANT.userId, purpose: "work-planning", dataClasses: ["operational-record"] }),
    resolveDirectorEnabled: async () => true,
    selectTransport: () => ({ transport: {} as never, transportProvenance: "live" }),
    env: {},
    mintRef: () => PLAN_REF,
    now: () => NOW,
    mintBinding: (t, step) => (minted.push({ tenant: t.tenantId, ...step }), "signed"),
    readFollowUpLinks: async (t) => {
      events.push(`links:${t?.tenantId}`);
      if (links === "throws") throw new Error("boom");
      return links;
    },
    generate: async (request) => {
      events.push("model");
      requests.push(JSON.stringify(request));
      const projection = JSON.parse(request.evidence[0]!).projection as { items: { alias: string; state: string }[] };
      const blocked = projection.items.filter((i) => i.state === "blocked").map((i) => i.alias);
      return {
        status: "generated",
        result: { text: JSON.stringify({ planRef: PLAN_REF, steps: blocked.map((alias, n) => ({ step: n + 1, move: "review-blocked", items: [alias], because: ["state:blocked"], priority: "high", afterStep: null })), uncertainty: "low" }) },
      } as never;
    },
  });
  assert.equal(result.status, "ok");
  const out = (result as Extract<typeof result, { status: "ok" }>).result;
  return { out, followUps: (out.followUps ?? []) as readonly PlanFollowUp[], events, requests, minted };
}

async function main(): Promise<void> {
  const known = await plan(LINKS);
  assert.equal(known.out.tone, "info", known.out.lines.join("\n"));
  assert.equal(known.followUps.length, 2, "one recommendation per blocked source");
  const bySource = (title: string) => {
    const rec = known.out.lines.find((l) => l.trim().startsWith("Items:") && l.includes(title));
    assert.ok(rec, `fixture sanity: a recommendation names ${title}`);
    return known.followUps[known.out.lines.filter((l) => l.trim().startsWith("Items:")).indexOf(rec!)]!;
  };
  assert.deepEqual(bySource("Blocked loom repair").existing, { status: "known", open: [{ title: "Find what unblocks the loom", declaredState: "active" }] });
  assert.deepEqual(bySource("Blocked dye order").existing, { status: "known", open: [] });
  assert.ok(known.followUps.every((f) => f.goal.startsWith("Create a follow-up task: ") && f.binding === "signed"), "the offer itself is unchanged");

  /* 6/7 · the read comes from the authenticated tenant, AFTER the one model call; nothing of it reaches the model. */
  assert.deepEqual(known.events, ["model", `links:${TENANT.tenantId}`]);
  for (const leaked of [F_OPEN.title, F_DONE.title, F_RETIRED.title, F_OPEN.workItemId, "follow-up", "followUp"]) {
    assert.ok(!known.requests[0]!.includes(leaked), `the model request never carries ${leaked}`);
  }
  const unlinked = await plan({ status: "read", truncated: false, links: [] });
  const sansCorrelation = (r: string) => r.replace(/"correlationId":"[^"]*",/, "");
  assert.equal(sansCorrelation(unlinked.requests[0]!), sansCorrelation(known.requests[0]!), "7 · the model request is identical with and without recorded follow-ups (only the per-call correlation id differs)");

  /* 8 · the PFR binding is minted from exactly what it was minted from before. */
  assert.deepEqual(known.minted, unlinked.minted);
  assert.ok(known.minted.every((m) => Object.keys(m as object).sort().join() === "move,planRef,step,tenant,workItemIds"), "no new binding field");

  /* 5 · reads that do not answer are unknown — and a failed read never fails the plan. */
  for (const links of [{ status: "unavailable" } as const, { ...LINKS, truncated: true }, "throws" as const]) {
    const r = await plan(links);
    assert.equal(r.out.tone, "info", "the plan is still shown");
    assert.ok(r.followUps.every((f) => f.existing.status === "unknown"), `unknown for ${JSON.stringify(links).slice(0, 40)}`);
  }
  /* 6 · a link naming a work item this tenant's register does not hold is unknown, never a title. */
  const foreign = await plan({ status: "read", truncated: false, links: [{ workItemId: "dddddddd-0000-4000-8000-000000000099", sourceWorkItemId: S1.workItemId }] });
  assert.ok(foreign.followUps.some((f) => f.existing.status === "unknown"));
  assert.ok(!JSON.stringify(foreign.followUps).includes("dddddddd-"), "no foreign identifier reaches the browser");

  /* ── 9 · The work register names each follow-up with its CURRENT state, and says when it cannot. ── */
  const render = (followUpLinks: readonly { workItemId: string; sourceWorkItemId: string }[] | null, followUpLinksTruncated = false) =>
    renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: INERT_ROUTER as never }, createElement(WorkRegisterPanel as never, {
      register: REGISTER, structure: { status: "available", detail: "d", departments: [] }, members: { status: "unavailable" },
      accountableLabels: [], evidence: [], evidenceReadable: true, factOptions: [], artifactOptions: [], workScopeChoices: [],
      followUpLinks, followUpLinksTruncated,
    } as never))).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
  const page = render(LINKS.status === "read" ? LINKS.links : null);
  assert.ok(page.includes("Follow-up work recorded for this item: Find what unblocks the loom (declared active); Abandoned loom follow-up (retired)."), page.slice(0, 400));
  assert.ok(page.includes("Follow-up work recorded for this item: Old dye follow-up (declared complete)."));
  assert.ok(page.includes("Follows up: Blocked loom repair."), "the other direction is unchanged");
  assert.ok(!page.includes("could not be read") && !page.includes("Only the oldest"), "a complete read says nothing extra");
  assert.ok(render(null).includes("Follow-up relationships could not be read right now"), "unavailable is said");
  assert.ok(render([], true).includes("Only the oldest recorded follow-up relationships were read"), "truncated is said");

  console.log("plan-follow-up-lineage-1/lineage: OK");
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
