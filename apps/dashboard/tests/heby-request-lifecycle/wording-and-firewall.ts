/*
 * HEBY-REQUEST-LIFECYCLE — the wording claims no more than the rows, and the read boundary can reach
 * no writer, model or provider. Source text and pure functions only; no database.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describeRequestLifecycle, HebyOriginationAffordance } from "../../src/components/layout/heby/heby-origination-affordance";
import { HebyMyRequests } from "../../src/components/layout/heby/heby-my-requests";
import type { ActionRequestLifecycleView } from "../../src/features/action-authorization/read-action-authorizations.server";

const ROOT = path.resolve(__dirname, "../..");
const code = (f: string) =>
  readFileSync(path.join(ROOT, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
const ACTION = "src/app/(dashboard)/heby/request-lifecycle-actions.ts";
const AFFORDANCE = "src/components/layout/heby/heby-origination-affordance.tsx";
const MY_REQUESTS = "src/components/layout/heby/heby-my-requests.tsx";

/* ═══ 1. WORDING — one sentence per fact, nothing beyond it ═══════════════════════════════════ */
const T = "2026-10-12T10:00:00.000Z";
const base: ActionRequestLifecycleView = {
  requestId: "00000000-0000-4000-8000-000000000001",
  actionKind: "send-external-communication",
  label: "Send the update",
  proposedByActorType: "agent",
  proposedAt: T,
  decision: { status: "approved", at: T, standing: false },
  permit: { state: "consumed", expiresAt: T, consumedAt: T, revokedAt: null },
  execution: null,
  workOutcome: null,
};
const say = (v: Partial<ActionRequestLifecycleView>) => describeRequestLifecycle({ ...base, ...v }).join(" ");

assert.match(say({ execution: { status: "accepted", providerAccepted: true } }), /Delivered: the provider accepted it\./);
assert.match(say({ execution: { status: "accepted", providerAccepted: false } }), /outcome is unknown/, "accepted without a provider id is not delivered");
assert.match(say({ execution: { status: "unknown", providerAccepted: false } }), /cannot prove whether the provider received it/);
assert.match(say({ execution: { status: "refused", providerAccepted: false } }), /Nothing was sent\./);
assert.match(say({ execution: { status: "failed", providerAccepted: false } }), /did not take effect/);
assert.match(say({ execution: { status: "pending", providerAccepted: false } }), /outcome is not recorded yet/);
assert.match(say({ execution: null }), /no delivery attempt is recorded, so no effect can be claimed/, "a spent external permit with no attempt claims nothing");
assert.match(say({ actionKind: "record-work" }), /Executed .*the change is recorded\./, "internal acts commit with the spend");
assert.match(say({ actionKind: "place-human-in-department" }), /Executed /);
assert.match(say({ decision: { status: "approved", at: T, standing: true }, permit: { state: "active", expiresAt: T, consumedAt: null, revokedAt: null } }),
  /standing authorization a human signed in advance\. Authorized and not yet executed\./);
assert.match(say({ permit: null }), /No usable authorization is recorded/);
const pendingWords = say({ decision: { status: "pending" }, permit: null });
assert.ok(!/Approved|Executed|Delivered/.test(pendingWords), "pending says nothing about approval or effect");
const rejectedWords = say({ decision: { status: "rejected", at: T } });
assert.ok(!/Authorized|Executed|Delivered/.test(rejectedWords), "rejected stops at the decision");
assert.match(say({ proposedByActorType: "system" }), /by the system\./, "a system proposer is not called a person");
assert.match(say({ proposedByActorType: "human" }), /by a person\./);
assert.ok(!/ \./.test(say({ actionKind: "record-work", permit: { state: "consumed", expiresAt: T, consumedAt: null, revokedAt: null } })), "a missing instant leaves no dangling words");
for (const status of ["pending", "refused", "failed", "unknown"] as const) {
  assert.ok(!/Delivered|Executed/.test(say({ execution: { status, providerAccepted: false } })), `${status} never reads as an effect`);
}

/* ═══ 2. THE READ BOUNDARY — reaches no writer, model, provider or audit writer ════════════════ */
function valueImports(file: string): string[] {
  const out: string[] = [];
  const re = /^\s*(import|export)\s+(type\s+)?((?:(?!\bfrom\b)[\s\S])*?)\s*from\s*["']([^"']+)["']/gm;
  let m: RegExpExecArray | null;
  const src = code(file);
  while ((m = re.exec(src)) !== null) {
    if (m[2]) continue;
    const named = (m[3] ?? "").match(/\{([\s\S]*)\}/);
    if (named && !/(^|,)\s*(?!type\s)[A-Za-z_$]/.test(named[1]!) && !/^[^{]*[A-Za-z_$]/.test(m[3] ?? "")) continue;
    out.push(m[4]!);
  }
  return out;
}
function resolve(from: string, spec: string): string | null {
  const base = spec.startsWith("@/") ? path.join("src", spec.slice(2)) : spec.startsWith(".") ? path.normalize(path.join(path.dirname(from), spec)) : null;
  if (!base) return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (existsSync(path.join(ROOT, c)) && statSync(path.join(ROOT, c)).isFile()) return c;
  }
  return null;
}
const SESSION_RUNTIME = "src/features/auth-runtime/";
const seen = new Set<string>();
const queue = [ACTION];
while (queue.length) {
  const f = queue.pop()!;
  if (seen.has(f)) continue;
  seen.add(f);
  /* The session resolver writes session activity by design; it is the shared tenant door, not this read. */
  if (f.startsWith(SESSION_RUNTIME)) continue;
  for (const spec of valueImports(f)) {
    const r = resolve(f, spec);
    if (r) queue.push(r);
  }
}
const FORBIDDEN =
  /record-action-request|decide-action-request|consume-action-permit|revoke-action-permit|execute-|heby-model|heby-answer|agent-origination\/|provider-invocation|provider-(github|google|instagram|youtube)\/|adapters\/|audit-writer|\/write-/;
/* Table shapes are data, not behaviour; every other reached module is checked. */
for (const f of seen) if (!f.startsWith("src/db/schema/")) assert.ok(!FORBIDDEN.test(f), `the lifecycle read reaches no writer or runtime: ${f}`);
const actionSrc = code(ACTION);
assert.ok(!/\.(insert|update|delete)\(|transaction\(/.test(actionSrc), "the action writes nothing");
assert.match(actionSrc, /readActionRequestLifecycle\(await resolveTenantContext\(\), input\?\.requestId\)/, "tenant from the session, id as a lookup key");

/* ═══ 3. THE AFFORDANCE — read only on an explicit click; rendering calls nothing ═════════════ */
const ui = code(AFFORDANCE);
assert.equal((ui.match(/readHebyRequestLifecycleAction\(/g) ?? []).length, 1, "the lifecycle is read from one place");
const readBody = ui.slice(ui.indexOf("const readLifecycle = "), ui.indexOf('if (state.kind === "closed"'));
assert.ok(readBody.includes("readHebyRequestLifecycleAction({ requestId: current.requestId })"), "only the receipt's request id is sent");
assert.match(ui, /onClick=\{\(\) => readLifecycle\(state\)\}/, "only on a click");
assert.ok(!/useEffect|useLayoutEffect|setInterval|setTimeout/.test(ui), "nothing polls or runs on render");
/* The filing-time sentence is dated as such and gives way once the current state has been read. */
assert.match(ui, /When filed, it was waiting for review in/);
assert.ok(!/It is waiting for review in/.test(ui), "no present-tense claim that can go stale beside the read");
assert.match(ui, /requestId: result\.proposal\.receipt\.requestId/, "the id comes from the server's own receipt");

/* ═══ 4. HEBY-MY-REQUESTS — no input, read only on open/refresh, nothing that acts ═══════════ */
assert.match(actionSrc, /export async function readMyHebyRequestsAction\(\): Promise<MyActionRequestLifecyclesRead> \{\s*return readMyActionRequestLifecycles\(await resolveTenantContext\(\)\);/,
  "the list action takes no input: the person is the session's human");
const mr = code(MY_REQUESTS);
assert.equal((mr.match(/readMyHebyRequestsAction\(/g) ?? []).length, 1, "read from one place");
assert.ok(!/useEffect|useLayoutEffect|setInterval|setTimeout/.test(mr), "nothing polls or runs on render");
assert.match(mr, /if \(next\) load\(\);/, "opening reads once");
assert.match(mr, /onClick=\{load\}/, "Refresh reads on a click");
for (const i of [...mr.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!)) {
  assert.ok(!/\.server$|approvals\/actions|decide-action|action-execution|governance|heby-model|\/actions"?$/.test(i) || i === "@/app/(dashboard)/heby/request-lifecycle-actions",
    `the list imports no writer or acting action: ${i}`);
}
assert.ok(!/approve|execute\(|revoke/i.test(mr.replace(/Approvals/g, "")), "the list offers no decision or execution");
/* HEBY-CONVERSATION-CONTINUITY-1 put the conversation list beside it, in the same top-bar slot. */
assert.match(code("src/components/layout/heby/heby-workspace-client.tsx"), /headerAction=\{\s*<>[^]*?<HebyMyRequests \/>\s*<\/>\s*\}/, "mounted in the Heby top bar");

const realFetch = globalThis.fetch;
globalThis.fetch = (async () => {
  throw new Error("rendering must not fetch");
}) as typeof fetch;
try {
  assert.match(renderToStaticMarkup(createElement(HebyOriginationAffordance, { goal: "Record the loom repair." })), /Propose as organizational work…/);
  const closedList = renderToStaticMarkup(createElement(HebyMyRequests));
  assert.match(closedList, /Your requests/, "closed: one button");
  assert.ok(!/data-heby-my-requests/.test(closedList), "closed: no list is shown or read");
} finally {
  globalThis.fetch = realFetch;
}

console.log("PASS heby-request-lifecycle wording-and-firewall");
