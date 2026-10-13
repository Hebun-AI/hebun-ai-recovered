/*
 * CONTROLLED AGENT REASONING · PHASE 2 — the operational planning projection.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *   "From this tenant's own Work register and WEV-1 declarations, Hebun derives a bounded projection
 *    whose every value is Work's own state or a flag with a stated rule, keyed by invocation-local
 *    aliases whose map never enters the projection. Nothing unreadable, truncated or incomplete becomes
 *    a value; it becomes `unavailable`. No title, name, id, date or secret appears in the result. The
 *    module reads two seams, writes nothing, calls no model and nothing at runtime imports it. `/plan`
 *    and its department filter and staleness rule are the same ones it uses."
 *
 * No database, no provider. The register and evidence values are the released types with realistic
 * content; the logic under test is the projection's own. Tenant isolation at the SQL level is the
 * readers' own predicate, pinned below at its source.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import {
  OPERATIONAL_PLANNING_FIELDS,
  OPERATIONAL_PLANNING_MAX_ITEMS,
  validateOperationalPlanningProjection,
} from "../../src/features/external-ai-data-use/operational-record-contract";
import { composeActionPlan, isStale, STALE_AFTER_DAYS } from "../../src/features/heby-commands/action-plan";
import {
  projectOperationalPlanning,
  readOperationalPlanningProjection,
  type OperationalPlanningProjection,
} from "../../src/features/heby-commands/operational-planning-projection.server";
import type { WorkItemView, WorkRegister } from "../../src/features/organizational-work/read-work.server";
import {
  MAX_WORK_EVIDENCE_REFERENCES,
  type WorkEvidenceRead,
  type WorkEvidenceReferenceView,
} from "../../src/features/organizational-work/read-work-evidence.server";
import { MAX_WORK_ITEMS_READ, WORK_DECLARED_STATES } from "../../src/features/organizational-work/work-contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import type { AgentOriginationAvailability } from "../../src/features/origination-availability/contracts";

const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const codeOf = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
function walk(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir)).flatMap((name) => {
    const rel = path.join(dir, name);
    if (name === "node_modules") return [];
    return statSync(path.join(ROOT, rel)).isDirectory() ? walk(rel) : /\.(ts|tsx)$/.test(name) ? [rel] : [];
  });
}
const MODULE = "src/features/heby-commands/operational-planning-projection.server.ts";

const NOW = new Date("2026-10-13T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const ENG = { departmentId: "aaaaaaaa-0000-4000-8000-000000000001", name: "Engineering" };
const MKT = { departmentId: "aaaaaaaa-0000-4000-8000-000000000002", name: "Marketing" };
let seq = 0;
function work(patch: Partial<WorkItemView> = {}): WorkItemView {
  seq += 1;
  return {
    workItemId: `bbbbbbbb-0000-4000-8000-${String(seq).padStart(12, "0")}`,
    title: `Supplier contract with Ayşe Yılmaz #${seq} sk-ant-api03-SECRET`,
    declaredState: "active",
    lifecycleStatus: "active",
    inService: true,
    department: ENG,
    accountableActorId: "cccccccc-0000-4000-8000-000000000001",
    accountableCurrentlyActiveMember: true,
    recordedAt: ago(90 * DAY),
    updatedAt: ago(DAY),
    ...patch,
  };
}
const register = (items: readonly WorkItemView[], truncated = false): WorkRegister => ({ status: "available", items, truncated, detail: "d" });
const declaration = (workItemId: string, referent: WorkEvidenceReferenceView["referent"] = { label: "Refund policy", standing: "authoritative" } as never): WorkEvidenceReferenceView =>
  ({ referenceId: "dddddddd-0000-4000-8000-000000000001", workItemId, kind: "knowledge-fact", referentId: "eeeeeeee-0000-4000-8000-000000000001", declaredAt: ago(2 * DAY), referent }) as WorkEvidenceReferenceView;
const evidence = (references: readonly WorkEvidenceReferenceView[] = []): WorkEvidenceRead => ({ status: "available", references });
const project = (items: readonly WorkItemView[], refs: readonly WorkEvidenceReferenceView[] = [], scope = "Engineering") =>
  projectOperationalPlanning({ register: register(items), evidence: evidence(refs), scope, now: NOW });
const projected = (r: OperationalPlanningProjection) => {
  assert.equal(r.status, "projected", JSON.stringify(r));
  return r as Extract<OperationalPlanningProjection, { status: "projected" }>;
};

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const ISO = /\d{4}-\d{2}-\d{2}/;

async function main(): Promise<void> {
  /* ── 9 · STATE: Work's own enum, value for value. ─────────────────────────────────────────── */
  {
    const items = WORK_DECLARED_STATES.map((declaredState) => work({ declaredState }));
    const r = projected(project(items));
    assert.deepEqual(r.projection.items.map((i) => i.state), [...WORK_DECLARED_STATES], "every declared state maps to itself");
  }

  /* ── 10 · ACCOUNTABLE: a human is RECORDED; not who, not whether still a member. ──────────── */
  {
    const r = projected(project([
      work({ accountableActorId: null, accountableCurrentlyActiveMember: null }),
      work({ accountableCurrentlyActiveMember: true }),
      work({ accountableCurrentlyActiveMember: false }),
    ]));
    assert.deepEqual(r.projection.items.map((i) => i.accountable), [false, true, true], "recorded is recorded; membership is Identity's and is not projected");
  }

  /* ── 11 · STALE: `/plan`'s own rule, at its edge. ─────────────────────────────────────────── */
  {
    const edge = STALE_AFTER_DAYS * DAY;
    const items = [work({ updatedAt: ago(edge) }), work({ updatedAt: ago(edge - 1) }), work({ updatedAt: ago(edge + DAY), declaredState: "blocked" })];
    const r = projected(project(items));
    assert.deepEqual(r.projection.items.map((i) => i.stale), [true, false, true]);
    assert.deepEqual(r.projection.items.map((i) => i.stale), items.map((i) => isStale(i, NOW)), "the shared rule, not a copy");
    /* The same rule `/plan` counts with: its Derived line agrees with the projection over open items. */
    const plan = composeActionPlan({ scope: "Engineering", register: register(items), availability: { status: "unavailable", reason: "x" } as unknown as AgentOriginationAvailability, now: NOW });
    const openStale = r.projection.items.filter((i) => i.state !== "complete" && i.stale).length;
    assert.ok(plan.lines.some((l) => l.startsWith(`Derived: ${openStale} open item`)), "the /plan Derived line and the projection agree");
  }

  /* ── 12 · EVIDENCE: a current WEV-1 declaration, never an inference; unreadable is not false. ─ */
  {
    const [a, b, c] = [work(), work(), work()];
    const r = projected(project([a, b, c], [declaration(a.workItemId), declaration(c.workItemId, null)]));
    assert.deepEqual(r.projection.items.map((i) => i.evidenceDeclared), [true, false, true], "declared → true (even with an unresolved referent); none recorded → false");
    const foreign = projected(project([a, b], [declaration("ffffffff-0000-4000-8000-000000000009")]));
    assert.deepEqual(foreign.projection.items.map((i) => i.evidenceDeclared), [false, false], "a declaration for a work item outside this register marks nothing");
    assert.deepEqual(
      projectOperationalPlanning({ register: register([a]), evidence: { status: "unavailable", detail: "x" }, scope: "", now: NOW }),
      { status: "unavailable", reason: "evidence-unavailable" },
      "an unreadable evidence seam is unavailable, never false",
    );
    const full = Array.from({ length: MAX_WORK_EVIDENCE_REFERENCES }, () => declaration(b.workItemId));
    assert.deepEqual(project([a, b], full), { status: "unavailable", reason: "evidence-incomplete" }, "a read at its bound may be partial: unavailable, never false");
  }

  /* ── 3 · DEPARTMENT SCOPE: `/plan`'s filter; retired work excluded. ───────────────────────── */
  {
    const items = [work(), work({ department: MKT }), work({ department: null }), work({ inService: false, lifecycleStatus: "archived" }), work({ department: { ...ENG, name: "  engineering " } })];
    assert.equal(projected(project(items)).projection.items.length, 2, "Engineering only, in service only, case and spacing as /plan matches");
    assert.equal(projected(project(items, [], "")).projection.items.length, 4, "no scope: every in-service item");
    assert.deepEqual(project(items, [], "Finance"), { status: "unavailable", reason: "nothing-in-scope" });
    assert.deepEqual(project([work({ inService: false })], [], ""), { status: "unavailable", reason: "nothing-in-scope" });
  }

  /* ── 4 · STABLE ALIASES in the register's order; the map stays beside the projection. ─────── */
  {
    const items = [work(), work(), work()];
    const one = projected(project(items));
    const two = projected(project(items));
    assert.deepEqual(one.projection, two.projection, "deterministic");
    assert.deepEqual([...one.aliases], [...two.aliases]);
    assert.deepEqual([...one.aliases], items.map((item, i) => [`W${i + 1}`, item.workItemId]), "W1.. follow the register's order");
    /* An alias resolves only in the map that minted it. */
    const other = projected(project([work()]));
    assert.notEqual(other.aliases.get("W1"), one.aliases.get("W1"), "the same alias names a different record in another invocation");
    assert.equal(other.aliases.get("W2"), undefined);
  }

  /* ── 5 · BOUNDS: 40 projects, 41 refuses, a truncated register refuses. ───────────────────── */
  {
    const forty = Array.from({ length: OPERATIONAL_PLANNING_MAX_ITEMS }, () => work());
    assert.equal(projected(project(forty)).projection.items.length, OPERATIONAL_PLANNING_MAX_ITEMS);
    assert.deepEqual(project([...forty, work()]), { status: "unavailable", reason: "too-many-items" }, "refused, never truncated");
    assert.deepEqual(
      projectOperationalPlanning({ register: register([work()], true), evidence: evidence(), scope: "", now: NOW }),
      { status: "unavailable", reason: "register-truncated" },
      `a register past ${MAX_WORK_ITEMS_READ} rows may hide in-scope work`,
    );
    assert.deepEqual(
      projectOperationalPlanning({ register: { status: "unavailable", detail: "x" }, evidence: evidence(), scope: "", now: NOW }),
      { status: "unavailable", reason: "register-unavailable" },
    );
  }

  /* ── 6 · 7 · 8 · 13 · NOTHING BUT THE FIVE FIELDS; NO ID, TEXT, DATE OR SECRET. ───────────── */
  {
    const items = [work({ declaredState: "blocked", accountableActorId: null }), work()];
    const r = projected(project(items, [declaration(items[1]!.workItemId)]));
    for (const item of r.projection.items) assert.deepEqual(Object.keys(item), [...OPERATIONAL_PLANNING_FIELDS], "exactly the contract's fields, in its order");
    assert.deepEqual(Object.keys(r.projection), ["items"]);
    assert.ok(validateOperationalPlanningProjection(r.projection).ok, "the contract accepts it");
    assert.deepEqual(r.dataClasses, ["operational-record"], "derived flags included, the class is declared");
    for (const serialized of [JSON.stringify(r.projection), JSON.stringify(r)]) {
      assert.doesNotMatch(serialized, UUID, "no work, actor, department, referent or tenant id");
      assert.doesNotMatch(serialized, ISO, "no timestamp");
      for (const leak of ["Supplier", "Ayşe", "sk-ant", "SECRET", "Engineering", "Refund", items[0]!.workItemId]) {
        assert.ok(!serialized.includes(leak), `no ${leak}`);
      }
    }
    assert.match(String(r.aliases.get("W1")), UUID, "the id lives only in the server-side map");
  }

  /* ── 1 · 2 · TRUSTED TENANT: both seams, the SAME authenticated tenant; none without one. ─── */
  {
    const tenant = { tenantId: "11111111-1111-4111-8111-111111111111", userId: "u" } as unknown as TenantContext;
    const asked: unknown[] = [];
    const r = await readOperationalPlanningProjection(tenant, "Engineering", {
      readWork: async (t) => (asked.push(t), register([work()])),
      readEvidence: async (t) => (asked.push(t), evidence()),
      now: () => NOW,
    });
    assert.equal(r.status, "projected");
    assert.equal(asked.length, 2);
    assert.ok(asked.every((t) => t === tenant), "both reads are handed the one authenticated tenant");
    let called = 0;
    const none = await readOperationalPlanningProjection(null, "", {
      readWork: async () => (called++, register([work()])),
      readEvidence: async () => (called++, evidence()),
    });
    assert.deepEqual(none, { status: "unavailable", reason: "no-tenant" });
    assert.equal(called, 0, "no tenant, no read");
    /* The readers take no tenant, department or item parameter, and predicate on the session tenant. */
    assert.match(codeOf(read("src/features/organizational-work/read-work.server.ts")), /\.where\(eq\(workItems\.tenantId, tenant\.tenantId\)\)/);
    assert.match(codeOf(read("src/features/organizational-work/read-work-evidence.server.ts")), /eq\(workEvidenceReferences\.tenantId, tenant\.tenantId\)/);
    assert.match(codeOf(read(MODULE)), /\(deps\.readWork \?\? readWorkRegister\)\(tenant\),\s*\(deps\.readEvidence \?\? readWorkEvidenceReferences\)\(tenant\),/, "the wrapper cannot pair two tenants");
  }

  /* ── 14 · 15 · 16 · 17 · READ-ONLY; NO MODEL, GOVERNANCE OR EXECUTION; INERT. ─────────────── */
  {
    const code = codeOf(read(MODULE));
    assert.deepEqual(
      [...code.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]),
      [
        "@/features/auth/tenant/tenant-context",
        "@/features/external-ai-data-use/operational-record-contract",
        "@/features/organizational-work/read-work.server",
        "@/features/organizational-work/read-work-evidence.server",
        "@/features/organizational-work/work-contracts",
        "./action-plan",
      ],
      "two Work read seams, the Work vocabulary, the contract and /plan's rules — nothing else",
    );
    for (const forbidden of ["insert(", "update(", "delete(", "transaction(", "getDb", "fetch(", "console.", "heby-model", "heby-answer", "governance", "action-authorization", "action-execution", "machine-execution", "permit", "audit"]) {
      assert.ok(!code.includes(forbidden), `the projection does not reach ${forbidden}`);
    }
    const action = codeOf(read("src/features/heby-commands/action-plan.ts"));
    for (const forbidden of ["import ", "fetch(", "getDb"]) {
      if (forbidden === "import ") {
        assert.deepEqual([...action.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]).filter((m) => !m.startsWith("@/features/organizational-work/") && !m.startsWith("@/features/origination-availability/")), [], "/plan's rules stay pure");
      } else assert.ok(!action.includes(forbidden));
    }
    const importers = walk("src").filter((f) => f !== MODULE && /operational-planning-projection/.test(read(f)));
    assert.deepEqual(importers, [], "nothing at runtime imports the projection: it reaches no surface, client or model");
  }

  console.log("PASS heby-operational-planning-projection projection");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
