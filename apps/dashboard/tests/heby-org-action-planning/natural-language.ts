/*
 * NATURAL-LANGUAGE ACTION PLANNING — reaching `/plan` from an ordinary message.
 *
 *     RECOGNITION != AUTHORITY      THE MESSAGE NAMES A DEPARTMENT; ORGANIZATION AUTHORITY DECIDES
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PLAN_INTENT_TITLE,
  PLAN_INTENT_WORK_DOMAIN_LINES,
  recognizePlanIntent,
  resolvePlanDepartment,
} from "../../src/features/heby-commands/plan-intent";
import { planHebyCommand } from "../../src/features/heby-commands/dispatch";
import { findHebyCommandById } from "../../src/features/heby-commands/registry";
import { runHebyReadCommand } from "../../src/features/heby-commands/read-commands.server";
import type { DepartmentView, OrganizationStructure } from "../../src/features/organization-authority/contracts";
import type { WorkItemView, WorkRegister } from "../../src/features/organizational-work/read-work.server";
import type { AgentOriginationAvailability } from "../../src/features/origination-availability/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

/* 1 · 2 · 7 — RECOGNITION: the Director's phrasings plan; ordinary conversation does not. */
const PLANNING = [
  "Engineering departmanı için aksiyon planı hazırla.",
  "Engineering işlerini incele ve öncelikleri belirle.",
  "Engineering departmanındaki işler için ne yapmalıyız?",
  "Engineering için bir çalışma planı oluştur.",
  "Engineering departmanındaki işleri incele ve bana bir aksiyon planı hazırla.",
  "Plan the work in the Engineering department.",
  "Make an action plan for the Engineering department's work",
  "ENGINEERING İŞLERİNİ İNCELE VE ÖNCELİKLERİ BELİRLE",
];
for (const message of PLANNING) assert.equal(recognizePlanIntent(message), "plan", message);

const CONVERSATION = [
  "Merhaba Heby, bugün nasılsın?",
  "Bugün ne yapmalıyız?",
  "Instagram kampanyası için bir aksiyon planı hazırla.",
  "Engineering departmanında kaç kişi var?",
  "What should we post this week?",
  "Summarize the Knowledge sources for Engineering.",
  "Bir plan yapalım mı?",
  "Bu iş çok güzel oldu.",
];
for (const message of CONVERSATION) assert.equal(recognizePlanIntent(message), "none", message);

/* 6 · DEPARTMENT != WORK DOMAIN — a domain request is refused, never filtered as a department. */
assert.equal(recognizePlanIntent("Engineering work domain için aksiyon planı hazırla."), "work-domain");
assert.equal(recognizePlanIntent("Plan the work in the Engineering work domain."), "work-domain");
assert.equal(recognizePlanIntent("Engineering iş alanındaki işler için öncelikleri belirle."), "work-domain");
assert.match(PLAN_INTENT_WORK_DOMAIN_LINES.join(" "), /a work domain is not a department/);

/* 3 · 4 · 5 — RESOLUTION: only a department this organization recorded and keeps in service. */
const dept = (name: string, slug: string, inService = true): DepartmentView =>
  ({ departmentId: `d-${slug}`, name, slug, lifecycleStatus: inService ? "active" : "archived", inService, owner: null, createdAt: "", updatedAt: "" }) as DepartmentView;
const structure = (...departments: DepartmentView[]): OrganizationStructure => ({ status: "available", departments, detail: "d" });
const ORG = structure(dept("Engineering", "engineering"), dept("Finance", "finance"), dept("Customer Success", "customer-success"), dept("Legal", "legal", false));

assert.deepEqual(resolvePlanDepartment("Engineering departmanı için aksiyon planı hazırla.", ORG), { kind: "resolved", name: "Engineering" });
assert.deepEqual(resolvePlanDepartment("engineering'deki işler için ne yapmalıyız", ORG), { kind: "resolved", name: "Engineering" });
assert.deepEqual(resolvePlanDepartment("Plan the work in the customer success department", ORG), { kind: "resolved", name: "Customer Success" });
assert.deepEqual(resolvePlanDepartment("Plan the work for customer-success", ORG), { kind: "resolved", name: "Customer Success" });
assert.deepEqual(
  resolvePlanDepartment("Engineering ve Finance işleri için aksiyon planı hazırla", ORG),
  { kind: "ambiguous", names: ["Engineering", "Finance"] },
);
const unknown = resolvePlanDepartment("Mühendislik departmanı için aksiyon planı hazırla", ORG);
assert.deepEqual(unknown, { kind: "unnamed", names: ["Engineering", "Finance", "Customer Success"] });
assert.equal(resolvePlanDepartment("Legal işleri için aksiyon planı hazırla", ORG).kind, "unnamed", "a retired department is not planned");
assert.equal(resolvePlanDepartment("Engineers işleri için plan hazırla", ORG).kind, "unnamed", "a partial word is not a department");
assert.deepEqual(resolvePlanDepartment("Engineering", { status: "unavailable", reason: "read-failed", detail: "x" }), { kind: "unavailable" });

/* 8 · 9 — THE SAME `/plan`: a read plan, no prompt, no model, no execution. */
const descriptor = findHebyCommandById("plan")!;
const readPlan = planHebyCommand(descriptor, ["Engineering departmanı için aksiyon planı hazırla."], {
  surface: "full-workspace", contextLabel: "Heby", contextDetail: [], evidenceLines: [], returnLabel: "Home",
});
assert.equal(readPlan.kind, "read");
assert.ok(!("prompt" in readPlan), "a recognized request carries no prompt, so it has no path to the model");
assert.equal(descriptor.requiresModel, false);

const HOOK = readFileSync("src/components/layout/heby/use-heby-conversation.ts", "utf8");
const routed = HOOK.indexOf("recognizePlanIntent(parsed.prompt)");
assert.ok(routed > 0 && routed < HOOK.indexOf("await askHebyAction("), "recognition happens before the one model dispatch");
const INTENT = readFileSync("src/features/heby-commands/plan-intent.ts", "utf8");
assert.doesNotMatch(INTENT, /^import(?!\s+type)/m, "the recognizer imports no runtime module: no model, no database, no writer");

/* 3 · 4 · 5 · 8 · 10 · 11 · 12 — THE SERVER READ. */
let n = 0;
const work = (over: Partial<WorkItemView> = {}): WorkItemView => ({
  workItemId: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
  title: `Work ${n}`, declaredState: "active", lifecycleStatus: "active", inService: true,
  department: { departmentId: "d-engineering", name: "Engineering" },
  accountableActorId: "u1", accountableCurrentlyActiveMember: true,
  recordedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...over,
});
const REGISTER: WorkRegister = {
  status: "available", truncated: false, detail: "d",
  items: [work({ title: "Fix CI", declaredState: "blocked" }), work({ title: "Close books", department: { departmentId: "d-finance", name: "Finance" } })],
};
const AVAILABLE: AgentOriginationAvailability = {
  status: "available", agent: { agentId: "a1", name: "Heby" },
  mandate: { revision: 4, purpose: "p", proposalScope: ["record-work"] }, originable: "record-work", workScopes: [],
};

void (async () => {
  const TENANT = { tenantId: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222" } as unknown as TenantContext;
  const seen: string[] = [];
  const deps = {
    resolveTenant: async () => TENANT,
    readStructure: async (t: TenantContext) => (assert.equal(t, TENANT), seen.push("structure"), ORG),
    readWork: async (t: TenantContext) => (assert.equal(t, TENANT), seen.push("work"), REGISTER),
    readOriginationAvailability: async (t: TenantContext) => (assert.equal(t, TENANT), seen.push("origination"), AVAILABLE),
  };
  const ask = (message: string, d: object = deps) =>
    runHebyReadCommand({ commandId: "plan", args: [message], route: "/heby", phrasing: "natural-language" }, d as never);

  const resolved = await ask("Engineering departmanındaki işleri incele ve bana bir aksiyon planı hazırla.");
  assert.ok(resolved.status === "ok" && resolved.result.tone === "info", JSON.stringify(resolved));
  const lines = resolved.status === "ok" ? resolved.result.lines.join("\n") : "";
  assert.equal(resolved.status === "ok" && resolved.result.title, "Action plan · Engineering");
  assert.match(lines, /^Read your message as an action-planning request for the Engineering department.*same plan as \/plan Engineering\./);
  assert.match(lines, /"Fix CI"/);
  assert.doesNotMatch(lines, /Close books/, "another department's work is not in this plan");
  assert.match(lines, /Execution: Recommendation only/);
  assert.match(lines, /No model wrote this plan/);
  assert.deepEqual(seen.sort(), ["origination", "structure", "work"], "the session tenant reaches every read, and nothing else is read");

  for (const [message, pattern] of [
    ["Engineering ve Finance işleri için aksiyon planı hazırla", /names more than one department: "Engineering", "Finance"/],
    ["Mühendislik departmanı için aksiyon planı hazırla", /names none of this organization's departments in service[\s\S]*Departments in service: "Engineering", "Finance", "Customer Success"/],
  ] as const) {
    seen.length = 0;
    const result = await ask(message);
    assert.ok(result.status === "ok" && result.result.title === PLAN_INTENT_TITLE && result.result.tone === "unavailable");
    assert.match(result.status === "ok" ? result.result.lines.join("\n") : "", pattern);
    assert.deepEqual(seen, ["structure"], "an unresolved department reads no work: nothing is planned on a guess");
  }

  seen.length = 0;
  const down = await ask("Engineering işleri için aksiyon planı hazırla", { ...deps, readStructure: async () => ({ status: "unavailable", reason: "read-failed", detail: "x" }) });
  assert.ok(down.status === "ok" && /could not be read right now/.test(down.result.lines.join(" ")));
  assert.deepEqual(seen, [], "an unreadable structure is not treated as 'no departments'");

  // 8 · EXISTING /plan UNCHANGED: no phrasing, no structure read, the argument is the filter as before.
  seen.length = 0;
  const slash = await runHebyReadCommand({ commandId: "plan", args: ["Engineering"], route: "/heby" }, deps as never);
  assert.ok(slash.status === "ok" && slash.result.title === "Action plan · Engineering");
  assert.ok(slash.status === "ok" && !slash.result.lines.some((l) => l.startsWith("Read your message")));
  assert.deepEqual(seen.sort(), ["origination", "work"]);

  // 10 · TENANT ISOLATION: no session, no read of any kind.
  seen.length = 0;
  assert.deepEqual(await ask("Engineering işleri için aksiyon planı hazırla", { ...deps, resolveTenant: async () => null }), { status: "unauthorized" });
  assert.deepEqual(seen, []);

  console.log("PASS heby-org-action-planning natural-language");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
