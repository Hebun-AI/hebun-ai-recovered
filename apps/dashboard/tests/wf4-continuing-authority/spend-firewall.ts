/*
 * WF-4 — the spend boundary READS agent authority and can write none. Source text only.
 *
 *   - from consume-action-permit.server.ts no agent, mandate, decision, approval, revocation or
 *     issuance writer is reachable, by real value-import reachability;
 *   - the continuing-authority check lives in the ONE shared `spendPermit`, which both doors call;
 *   - its ids come off the request row, never from a caller parameter.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const code = (f: string) =>
  readFileSync(path.join(ROOT, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
const SPEND = "src/features/action-authorization/consume-action-permit.server.ts";

function valueEdges(file: string): string[] {
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
  for (const c of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
    if (existsSync(path.join(ROOT, c)) && statSync(path.join(ROOT, c)).isFile()) return c;
  }
  return null;
}
const seen = new Set<string>();
for (const queue = [SPEND]; queue.length > 0; ) {
  const f = queue.pop()!;
  if (seen.has(f)) continue;
  seen.add(f);
  for (const s of valueEdges(f)) {
    const r = resolve(f, s);
    if (r && !seen.has(r)) queue.push(r);
  }
}

assert.ok(seen.has("src/features/agent-identity/read-durable-agent-identity.server.ts"), "reads agent liveness");
assert.ok(seen.has("src/features/agent-mandate/read-agent-mandate.server.ts"), "reads the effective mandate");
for (const writer of [
  "src/features/agent-identity/create-durable-agent-identity.server.ts",
  "src/features/agent-identity/retire-durable-agent-identity.server.ts",
  "src/features/agent-mandate/establish-agent-mandate.server.ts",
  "src/features/action-authorization/decide-action-request.server.ts",
  "src/features/action-authorization/revoke-action-permit.server.ts",
  "src/features/action-authorization/record-action-request.server.ts",
  "src/features/standing-mutation-authority/issue-permit-under-standing-authorization.server.ts",
  "src/features/governance-decision/decision-authority.server.ts",
]) {
  assert.equal(seen.has(writer), false, `the spend boundary cannot reach ${writer}`);
}

const spend = code(SPEND);
const body = spend.slice(spend.indexOf("async function spendPermit("), spend.indexOf("export async function consumeActionPermit("));
/* L-2b — the same request-row key, now read FOR SHARE on the spend's own transaction. */
assert.ok(
  /readDurableAgentLivenessForShareWithin\(\s*tx as unknown as ControlPlaneDatabase,\s*caller\.tenantId,\s*request\.proposedByActorId/.test(body),
  "liveness keyed off the request row",
);
assert.ok(/readEffectiveAgentMandateForRuntime\(caller\.tenantId, request\.proposedByActorId/.test(body), "mandate keyed off the request row");
assert.ok(/refuseOutsideAgentMandate\(mandate, request\.actionKind\)/.test(body), "decided by the one shared ceiling");
assert.ok(body.indexOf("proposedByActorType") < body.indexOf("ACTION_AUDIT_PERMIT_CONSUMED"), "checked before the consumption audit");
const doors = spend.slice(spend.indexOf("export async function consumeActionPermit("));
assert.equal((doors.match(/return spendPermit\(/g) ?? []).length, 2, "both doors spend through spendPermit");

console.log("PASS wf4-continuing-authority spend-firewall");
