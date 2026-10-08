/*
 * WF-1 — the structural boundary of the origination recommendation. Source text and rendering only;
 * no database, no provider.
 *
 *   - the availability projection and its read action reach no writer of any kind, no generator, no
 *     model client, no origination, request, Governance, permit or execution module and no
 *     disclosure audit writer — by REAL import reachability, not by feature name;
 *   - the read action takes no input at all;
 *   - the Heby affordance calls origination exactly once, only on explicit confirmation, with the
 *     human's message unchanged, and reads availability only on an explicit click — never on render;
 *   - the browser sends no tenant, agent, scope or availability;
 *   - rendering the affordance calls nothing; the turn list stays pure.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const ROOT = path.resolve(__dirname, "../..");
const read = (f: string) => readFileSync(path.join(ROOT, f), "utf8");
const code = (f: string) => read(f).replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

const PROJECTION = "src/features/origination-availability/read-origination-availability.server.ts";
const CONTRACTS = "src/features/origination-availability/contracts.ts";
const ACTION = "src/app/(dashboard)/heby/origination-availability-actions.ts";
const AFFORDANCE = "src/components/layout/heby/heby-origination-affordance.tsx";
const TURNS = "src/components/layout/heby/heby-turns.tsx";
const WORKSPACE_CLIENT = "src/components/layout/heby/heby-workspace-client.tsx";

/* ── the import-graph walker (value edges only), the shape OSA-1 / WORK-2 established ── */
function valueEdges(file: string): string[] {
  const out: string[] = [];
  const re = /^\s*(import|export)\s+(type\s+)?((?:(?!\bfrom\b)[\s\S])*?)\s*from\s*["']([^"']+)["']/gm;
  let m: RegExpExecArray | null;
  const src = code(file);
  while ((m = re.exec(src)) !== null) {
    if (m[2]) continue;
    const clause = m[3] ?? "";
    const named = clause.match(/\{([\s\S]*)\}/);
    if (named && !/(^|,)\s*(?!type\s)[A-Za-z_$]/.test(named[1]!) && !/^[^{]*[A-Za-z_$]/.test(clause)) continue;
    out.push(m[4]!);
  }
  return out;
}
function resolveSpecifier(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = path.join("src", spec.slice(2));
  else if (spec.startsWith(".")) base = path.normalize(path.join(path.dirname(from), spec));
  else return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (existsSync(path.join(ROOT, c)) && statSync(path.join(ROOT, c)).isFile()) return c;
  }
  return null;
}
function reachable(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const f = queue.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    for (const s of valueEdges(f)) {
      const r = resolveSpecifier(f, s);
      if (r && !seen.has(r)) queue.push(r);
    }
  }
  return seen;
}

/* ═══ 1. THE PROJECTION IS A READ — by what it can actually reach ═══════════════════════════════ */
const FORBIDDEN_MODULES = [
  "src/features/heby-model/heby-model-generation.server.ts",
  "src/features/heby-model/claude-model-client.ts",
  "src/features/heby-model/index.ts",
  "src/features/governance-audit/external-ai-disclosure-audit.server.ts",
  "src/features/agent-origination/originate-action.server.ts",
  "src/features/agent-origination/invocation-provenance.server.ts",
  "src/features/action-authorization/record-action-request.server.ts",
  "src/features/action-authorization/decide-action-request.server.ts",
  "src/features/agent-mandate/establish-agent-mandate.server.ts",
  "src/features/agent-identity/create-durable-agent-identity.server.ts",
  "src/features/agent-identity/retire-durable-agent-identity.server.ts",
  "src/app/(dashboard)/heby/actions.ts",
];
const FORBIDDEN_DIRS = [
  "src/features/action-execution/",
  "src/features/action-execution-live/",
  "src/features/governed-internal-action/",
  "src/features/governed-machine-execution/",
  "src/features/standing-mutation-authority/",
  "src/features/governance-audit/",
];
/* Governance: its vocabulary and DB resolver are shared reads; every other module there decides. */
const GOVERNANCE_READS = new Set(["src/features/governance-decision/contracts.ts", "src/features/governance-decision/persistence.server.ts"]);
for (const entry of [PROJECTION, ACTION]) {
  const graph = reachable(entry);
  for (const f of FORBIDDEN_MODULES) assert.ok(!graph.has(f), `${entry} must not reach ${f}`);
  for (const f of graph) {
    for (const d of FORBIDDEN_DIRS) assert.ok(!f.startsWith(d), `${entry} must not reach ${f}`);
    assert.ok(!f.startsWith("src/features/governance-decision/") || GOVERNANCE_READS.has(f), `${entry} must not reach Governance ${f}`);
    /*
     * The ACTION also reaches the R1 session runtime (`resolveTenantContext`), which every server
     * action shares and which maintains its own session rows. That is the session gate, not a
     * writer this read can direct; the PROJECTION gets no such exemption.
     */
    if (entry === ACTION && f.startsWith("src/features/auth-runtime/")) continue;
    assert.ok(
      !/\.insert\(|\.update\(|\.delete\(|insert\s+into|delete\s+from|\.send\(/i.test(code(f)),
      `${entry} reaches ${f}, which writes or sends — the projection must reach no writer`,
    );
  }
  console.log(`  ${entry}: ${graph.size} reachable modules, none writes`);
}
const projection = code(PROJECTION);
assert.ok(!projection.includes("heby-model-live"), "the projection names no transport");
assert.ok(!/\bgenerate\w*\(/.test(projection), "the projection generates nothing");
assert.match(projection, /authorizeExternalAiDisclosure\(/, "the gate's own decision is asked, not re-implemented");
assert.match(projection, /refuseOutsideAgentMandate\(/, "the shared mandate ceiling is asked, not re-implemented");
assert.match(projection, /resolveAgentProposer\(/, "origination's own proposer resolver is asked");
for (const leak of ["accountRef", "processorAttestationId", "tenantAuthorizationId", "apiKey", "credential"]) {
  assert.ok(!code(CONTRACTS).includes(leak), `the client contract carries no ${leak}`);
}

/* ═══ 2. THE READ ACTION TAKES NOTHING ═══════════════════════════════════════════════════════ */
const action = code(ACTION);
assert.ok(read(ACTION).startsWith('"use server";'), "a server action module");
const exported = [...action.matchAll(/export\s+async\s+function\s+(\w+)\s*\(([^)]*)\)/g)];
assert.equal(exported.length, 1, "exactly one exported action");
assert.equal(exported[0]![1], "readAgentOriginationAvailabilityAction");
/* AP-1, by name: one optional lookup key (WHICH in-service agent), verified server-side. Nothing else. */
assert.equal(
  exported[0]![2]!.replace(/\s+/g, " ").trim(),
  "input?: { readonly agentId?: string },",
  "the read action takes only an optional agent lookup key — no tenant, no scope, no availability",
);
assert.match(action, /resolveTenant: resolveTenantContext/, "the tenant comes from the session");

/* ═══ 3. THE AFFORDANCE — one confirmation, one origination, the goal as written ═════════════ */
const ui = code(AFFORDANCE);
assert.equal((ui.match(/originateHebyActionProposalAction\(/g) ?? []).length, 1, "origination is called from exactly one place");
/* AP-1: the goal exactly as written, plus the chosen agent's id ONLY when a human chose one. */
assert.ok(
  /* AP-4B: and the work scope the human chose, carried beside it. */
  ui.includes("const input = chosenAgentId ? { goal, agentId: chosenAgentId, workScope: scope } : { goal, workScope: scope };"),
  "with the human's message exactly as written (and no agent id unless a human chose one)",
);
const confirmBody = ui.slice(ui.indexOf("const confirm = "), ui.indexOf("if (state.kind === \"closed\""));
assert.ok(confirmBody.includes("originateHebyActionProposalAction(input)"), "origination runs only inside the explicit confirmation");
assert.equal((ui.match(/readAgentOriginationAvailabilityAction\(/g) ?? []).length, 1, "availability is read from one place");
const checkBody = ui.slice(ui.indexOf("const check = "), ui.indexOf("const confirm = "));
assert.ok(
  checkBody.includes("readAgentOriginationAvailabilityAction(agentId ? { agentId } : undefined)"),
  "availability is read only on an explicit click (AP-1: for the agent a human chose, if any)",
);
assert.ok(!/useEffect|useLayoutEffect/.test(ui), "nothing runs on render");
/* The offer speaks in Heby's own terms: a pending proposal for human review, not a redirect to another surface. */
const offer = ui.slice(ui.indexOf("data-wf1-offer"), ui.indexOf('if (state.kind === "asking")'));
assert.match(offer, /the result is a pending proposal for\s+human review\./, "the offer names the outcome as a pending proposal for human review");
assert.ok(!/Approvals/.test(offer), "the offer does not send the human to Approvals");
assert.ok(!/\b(retry|setTimeout|setInterval)\b/.test(ui), "nothing retries");
for (const claim of ["tenantId", "proposalScope:", "status: \"available\""]) {
  assert.ok(!ui.includes(claim), `the browser never supplies ${claim}`);
}
/*
 * AP-1: an agent id reaches the browser's requests ONLY from a server-provided candidate a human
 * clicked — never typed, never derived, never defaulted.
 */
assert.equal((ui.match(/check\(candidate\.agentId\)/g) ?? []).length, 1, "the only source of an agent id is a clicked candidate");
assert.equal((ui.match(/setChosenAgentId\(/g) ?? []).length, 1, "and it is recorded in exactly one place");
const uiImports = [...ui.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);
for (const i of uiImports) {
  assert.ok(!/\.server$|record-action-request|decide-action|action-execution|governance|heby-model/.test(i), `the affordance imports no writer or runtime: ${i}`);
}
assert.ok(uiImports.includes("@/app/(dashboard)/heby/actions"), "it reuses the released origination action");

/* The turn list stays pure; the container supplies the control. */
assert.ok(!/from\s+"@\/app\//.test(code(TURNS)), "the turn list imports no server action");
assert.match(code(WORKSPACE_CLIENT), /userTurnAction=\{\(content\) => <HebyOriginationAffordance goal=\{content\} \/>\}/, "the container hands each human message to the affordance unchanged");

/* ═══ 4. RENDERING CALLS NOTHING ═══════════════════════════════════════════════════════════════ */
async function renders(): Promise<void> {
  const realFetch = globalThis.fetch;
  let fetched = 0;
  globalThis.fetch = (async () => {
    fetched += 1;
    throw new Error("WF-1: rendering must not fetch");
  }) as typeof fetch;
  try {
    const { HebyOriginationAffordance } = await import("../../src/components/layout/heby/heby-origination-affordance");
    const { HebyTurnList } = await import("../../src/components/layout/heby/heby-turns");
    const closed = renderToStaticMarkup(createElement(HebyOriginationAffordance, { goal: "Record the floor move as work." }));
    assert.match(closed, /Propose as organizational work…/, "closed: one quiet text control");
    assert.ok(!/Ask .* to propose|data-wf1-offer/.test(closed), "closed: no offer is shown before the human asks");
    assert.equal(renderToStaticMarkup(createElement(HebyOriginationAffordance, { goal: "/help" })), "", "a slash command is not a goal");

    const seen: string[] = [];
    const list = renderToStaticMarkup(
      createElement(HebyTurnList, {
        turns: [
          { key: "u1", role: "user", content: "Record the floor move as work.", durable: true },
          { key: "h1", role: "heby", content: "Answer.", durable: true },
        ],
        pending: "still typing",
        asking: true,
        userTurnAction: (content: string) => {
          seen.push(content);
          return createElement("span", { "data-probe": "" }, "probe");
        },
      }),
    );
    assert.deepEqual(seen, ["Record the floor move as work."], "only settled human turns get the control, with their exact text");
    assert.equal((list.match(/data-probe/g) ?? []).length, 1, "rendered once, under the human turn");
    assert.equal(fetched, 0, "rendering reached no network");
  } finally {
    globalThis.fetch = realFetch;
  }
}

renders()
  .then(() => console.log("PASS wf1-origination-recommendation firewall-and-surface"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
