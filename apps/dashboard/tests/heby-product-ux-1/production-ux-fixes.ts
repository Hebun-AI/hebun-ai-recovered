/*
 * HEBY-PRODUCT-UX-1 — six defects found in Heby's first live end-to-end acceptance (1709ad1c).
 * Pure functions, the real answer flow with an injected transport, and source text. No database.
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { loadBindings, transform } from "next/dist/build/swc";
import { answerHebyModelRequest } from "../../src/features/heby-answer/model-answer.server";
import type { ModelGenerationRequest, SourceResolution } from "../../src/features/heby-runtime";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import type { AgentOriginationAvailability } from "../../src/features/origination-availability/contracts";
import {
  describeOriginationForGrounding,
  ORGANIZATIONAL_WORK_STAGES,
} from "../../src/features/origination-availability/capability-truth";
import { permitDeliverySentence } from "../../src/features/action-authorization/delivery-legibility";
import { hiddenPendingRequests, type QueueItem } from "../../src/features/approvals-dashboard/model";
import { parameterDisplay } from "../../src/components/decision-workspace/action-authorizations";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");

/* ═══ 1. CAPABILITY AWARENESS — through the WF-1 availability seam, as grounding data ═════════════ */
const AVAILABLE: AgentOriginationAvailability = {
  status: "available",
  agent: { agentId: "a1", name: "Heby" },
  mandate: { revision: 4, purpose: "p", proposalScope: ["record-work"] },
  originable: "record-work",
  workScopes: [],
};
assert.match(describeOriginationForGrounding(AVAILABLE), /^Offered now: Heby can be asked to propose record-work \(mandate revision 4\)/);
assert.match(
  describeOriginationForGrounding({ status: "unavailable", reason: "mandate-unavailable" }),
  /^Not offered right now: the agent has no mandate in effect\.$/,
);
assert.match(describeOriginationForGrounding({ status: "unavailable", reason: "temporarily-unavailable" }), /unknown, not refused/);
for (const stage of [/Proposal/, /Human Governance decision/, /Authorized internal execution/, /Completion/]) {
  assert.match(ORGANIZATIONAL_WORK_STAGES, stage);
}
assert.match(ORGANIZATIONAL_WORK_STAGES, /Heby itself cannot approve, authorize, execute or record anything/);

const TENANT = { tenantId: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222" } as unknown as TenantContext;
const MANDATE: SourceResolution = {
  sourceClass: "agent-mandate",
  state: "resolved",
  provenance: "test",
  authoritative: true,
  items: [{ recordRef: "agent-mandate/m1", label: "Heby — effective mandate, revision 4", detail: "May propose: record-work.", lifecycle: "settled" }],
};
async function answerWith(readOrigination: (t: TenantContext) => Promise<AgentOriginationAvailability>) {
  let captured: ModelGenerationRequest | undefined;
  const result = await answerHebyModelRequest(
    { prompt: "Can you record a work item for the new onboarding checklist?", route: "/heby" },
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
      resolveAgentMandate: async () => MANDATE,
      readOriginationAvailability: readOrigination,
      generate: async (request) => {
        captured = request;
        return { status: "unavailable" as const, state: "TRANSPORT_UNAVAILABLE" as const, modelStatus: { available: false, reason: "provider-unavailable" as const, detail: "test" } };
      },
    },
  );
  assert.ok(captured, "the answer flow must compose a model request");
  return { model: captured!, human: JSON.stringify(result) };
}
void (async () => {
  const offered = await answerWith(async () => AVAILABLE);
  /* The human sees the derived availability as evidence. */
  assert.match(offered.human, /Offered now: Heby can be asked to propose record-work/);
  /* The model is told the stages (tenant-free) — never the tenant's availability: the EAI boundary is unchanged. */
  const instructions = String(offered.model.systemInstructions);
  assert.ok(instructions.includes(ORGANIZATIONAL_WORK_STAGES));
  assert.match(instructions, /never say it is or is not available/);
  assert.match(instructions, /Never say a work item cannot be recorded/);
  assert.match(instructions, /You never approve, authorize, execute/, "the no-authority rule is kept");
  const grounding = offered.model.evidence.join("\n");
  assert.match(grounding, /\[agent-mandate\] withheld — not disclosed to the external model/);
  assert.doesNotMatch(grounding, /Offered now|Not offered/, "agent-mandate stays withheld from the external model");

  const refused = (await answerWith(async () => ({ status: "unavailable", reason: "proposal-scope-unavailable" }))).human;
  assert.match(refused, /Not offered right now: the agent's mandate does not admit proposing organizational work/);
  assert.doesNotMatch(refused, /Offered now/);

  const thrown = (await answerWith(async () => { throw new Error("db down"); })).human;
  assert.match(thrown, /unknown, not refused/, "a failed read is unknown, never 'cannot'");

  /* ═══ 6. TYPOGRAPHY — Next's SWC drops a JSX text node's leading space when it holds an entity ═══ */
  await loadBindings();
  const files = execSync("grep -rl '&[a-z]*;' src --include=*.tsx").toString().trim().split("\n");
  const norm = (x: string) => x.replace(/\s+/g, " ");
  const lits = (code: string) =>
    new Set([...code.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => { try { return norm(JSON.parse(`"${m[1]!.replace(/\n/g, "\\n")}"`)); } catch { return norm(m[1]!); } }));
  const dropped: string[] = [];
  for (const f of files) {
    const src = read(f);
    const tsOut = lits(ts.transpileModule(src, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: 99, module: 99 } }).outputText);
    const swcOut = lits((await transform(src, { filename: "x.tsx", jsc: { parser: { syntax: "typescript", tsx: true }, transform: { react: { runtime: "automatic" } }, target: "es2020" } })).code);
    for (const s of tsOut) if (/^ \S/.test(s) && !swcOut.has(s) && swcOut.has(s.slice(1))) dropped.push(`${f}: ${s.slice(0, 60)}`);
  }
  assert.deepEqual(dropped, [], "no rendered sentence may lose the space after an expression (\"Hebyis\")");
  console.log("heby-product-ux-1: all assertions passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

/* ═══ 2. YOUR REQUESTS — `fixed`, so the workspace's overflow-hidden section cannot clip it ════════ */
const myRequests = read("src/components/layout/heby/heby-my-requests.tsx");
assert.match(myRequests, /className="fixed z-\(--z-dropdown\) overflow-y-auto/, "above the --z-sticky sidebar and rail");
assert.doesNotMatch(myRequests, /absolute right-0/);
assert.doesNotMatch(myRequests, /\bz-50\b/);
assert.match(myRequests, /const vw = document\.documentElement\.clientWidth;/, "the gutter is measured inside any scrollbar");
assert.match(myRequests, /const width = Math\.min\(416, vw - 32\);/);
assert.match(
  myRequests,
  /const left = Math\.min\(Math\.max\(16, rect\.right - width\), vw - 16 - width\);/,
  "both edges clamped to a 16px gutter",
);
/* The clamp itself, at the widths the live acceptance measured (button rects from production). */
const clampLeft = (vw: number, buttonRight: number) => {
  const width = Math.min(416, vw - 32);
  const left = Math.min(Math.max(16, buttonRight - width), vw - 16 - width);
  return { left, right: left + width };
};
for (const [vw, buttonRight] of [[375, 183.7], [900, 554.2], [1440, 1100], [320, 40], [375, 370]] as const) {
  const { left, right } = clampLeft(vw, buttonRight);
  assert.ok(left >= 16 && right <= vw - 16, `inside the 16px gutter at ${vw}px (button right ${buttonRight})`);
}
assert.match(myRequests, /maxHeight: `calc\(100dvh - \$\{top \+ 16\}px\)`/, "the whole list stays reachable by scrolling");

/* ═══ 3. APPROVALS — a restored filter cannot silently hide pending requests ══════════════════════ */
const request = { kind: "request", filters: ["Pending"] } as unknown as QueueItem;
const draft = { kind: "content", filters: ["Drafts"] } as unknown as QueueItem;
assert.equal(hiddenPendingRequests([request, draft], "Drafts"), 1);
assert.equal(hiddenPendingRequests([request, draft], "Pending"), 0);
assert.equal(hiddenPendingRequests([request, draft], "All"), 0);
const dashboard = read("src/components/approvals-dashboard/approvals-dashboard.tsx");
assert.match(dashboard, /useState<Filter>\("All"\)/, "the default view is unchanged");
assert.match(dashboard, /setFilter\("Pending"\)/, "the notice offers, never forces, the pending view");

/* ═══ 4. MACHINE EXECUTION — wording follows the authority the page read, never a permit ══════════ */
const awaiting = { band: "awaiting-delivery" } as const;
assert.match(permitDeliverySentence(awaiting, "not-enabled")!, /Automatic delivery is not enabled for your organization/);
assert.doesNotMatch(permitDeliverySentence(awaiting, "not-enabled")!, /Awaiting automatic delivery/);
assert.match(permitDeliverySentence(awaiting, "enabled")!, /Automatic delivery is enabled for your organization/);
assert.equal(permitDeliverySentence(awaiting), permitDeliverySentence(awaiting, "unknown"), "unknown keeps the conditional sentence");
assert.doesNotMatch(dashboard, /may be delivered by the existing machine runtime/);
const page = read("src/app/(dashboard)/approvals/page.tsx");
assert.match(page, /resolveMachineExecutionReachability\(tenant\.tenantId, RECORD_WORK_ACTION_KIND\)/);
assert.match(page, /persistence-unavailable" \? "unknown"/, "an unreadable control plane is unknown, not 'not enabled'");
assert.match(page, /\(\) => "unknown" as const/, "a thrown read is unknown, never enabled");

/* ═══ 5. SCOPE — department and work domain are named apart; values and payload are untouched ═════ */
assert.deepEqual(parameterDisplay({ name: "departmentScope", value: "organization-level" }), {
  label: "Organizational scope (department)",
  value: "The organization itself, no single department (organization-level)",
});
assert.deepEqual(parameterDisplay({ name: "workScope", value: "domain" }), {
  label: "Work-domain scope (kind of work)",
  value: "One recorded work domain (domain)",
});
assert.deepEqual(parameterDisplay({ name: "workDomainRef", value: "work-domain/x" }), { label: "Work domain", value: "work-domain/x" });
assert.deepEqual(parameterDisplay({ name: "title", value: "t" }), { label: "title", value: "t" });
