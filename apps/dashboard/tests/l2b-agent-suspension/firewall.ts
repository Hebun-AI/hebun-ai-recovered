/*
 * L-2b — structural guarantees, read from source. No database.
 *
 * F1 The suspension writer reaches no permit, standing, mandate, placement or execution WRITER: it
 *    neither revokes nor restores any other subsystem's authority. It reads two seams (F5).
 * F2 It judges with the L-2a derivation and guards the suspend UPDATE with the L-1a rule.
 * F3 Its decision and audit are written inside its transaction, after the guarded UPDATE.
 * F4 The /agents actions are transport: they resolve the tenant and call the writer, nothing else.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (p: string): string => readFileSync(path.join(process.cwd(), p), "utf8");
const code = (p: string): string =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

const WRITER = "src/features/agent-identity/suspend-durable-agent-identity.server.ts";
const ACTIONS = "src/app/(dashboard)/agents/actions.ts";

/* ── F1 ── */
{
  /* Decision 1 admits exactly two READ seams, owned by their authorities (F5). */
  const READ_SEAMS = new Set([
    "@/features/action-authorization/agent-usable-permits.server",
    "@/features/standing-mutation-authority/agent-valid-envelope.server",
  ]);
  const imports = [...code(WRITER).matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]).filter((i) => !READ_SEAMS.has(i!));
  for (const forbidden of [/action-authorization/, /standing-mutation/, /agent-mandate/, /organization-authority/, /execution/, /permit/]) {
    assert.ok(!imports.some((i) => forbidden.test(i)), `the suspension writer imports nothing matching ${forbidden}`);
  }
  assert.ok(!/actionPermits|standingMutation/.test(code(WRITER)), "and names no permit or envelope table");
}

/* ── F2 ── */
{
  const w = code(WRITER);
  assert.match(w, /agentServiceStatus\(row\)/, "judged by the L-2a derivation");
  assert.match(w, /\?\s*agentInServiceCondition\(\)/, "the suspend UPDATE is guarded by the L-1a rule");
  assert.match(w, /\.for\("update"\)/, "the row is locked before it is judged");
}

/* ── F3 ── */
{
  const w = code(WRITER);
  const tx = w.indexOf("db.transaction(");
  const update = w.indexOf(".update(agents)");
  assert.ok(tx > 0 && update > tx, "the UPDATE is inside the transaction");
  assert.ok(w.indexOf("writeGovernanceDecisionWithin(") > update, "the decision is written after the UPDATE");
  assert.ok(w.indexOf("recordGovernanceEventWithin(") > w.indexOf("writeGovernanceDecisionWithin("), "then the audit event");
  assert.ok(w.indexOf("validateJustification(") < tx, "the reason is checked before the transaction opens");
}

/* ── F4 ── */
{
  const a = code(ACTIONS);
  for (const name of ["suspendDurableAgentIdentityAction", "reactivateDurableAgentIdentityAction"]) {
    const start = a.indexOf(`export async function ${name}`);
    assert.ok(start > 0, `${name} exists`);
    const body = a.slice(start, a.indexOf("\n}\n", start));
    assert.match(body, /resolveTenantContext\(\)/);
    assert.ok(!/tenantId:|userId:/.test(body), `${name} passes no client-chosen tenant or actor`);
  }
}

/*
 * F5 Security closure. The reactivation guard reads permits and envelopes only through the two
 *    read seams their owners hold; the spend and standing issuance hold the agent row FOR SHARE
 *    in their own transaction; every external executor re-asks after the proposing agent
 *    immediately before its provider call.
 */
{
  const w = code(WRITER);
  const imports = [...w.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(imports.includes("@/features/action-authorization/agent-usable-permits.server"));
  assert.ok(imports.includes("@/features/standing-mutation-authority/agent-valid-envelope.server"));
  for (const seam of ["src/features/action-authorization/agent-usable-permits.server.ts", "src/features/standing-mutation-authority/agent-valid-envelope.server.ts"]) {
    assert.ok(!/\.(insert|update|delete)\(/.test(code(seam)), `${seam} reads only — no second revocation system`);
  }
  assert.match(code("src/features/action-authorization/consume-action-permit.server.ts"), /await readDurableAgentLivenessForShareWithin\(/, "the spend holds the agent row FOR SHARE");
  const issuance = code("src/features/standing-mutation-authority/issue-permit-under-standing-authorization.server.ts");
  const share = issuance.indexOf("readDurableAgentLivenessForShareWithin(tx,");
  assert.ok(share > 0 && share < issuance.indexOf(".from(standingMutationAuthorizations)"), "issuance locks the agent before the envelope");
  const exec = code("src/features/action-execution/execute-authorized-action.server.ts");
  for (const call of ["await adapter.send(", "withToken(tenant, payload.integrationId, (token) =>", "const input: YouTubeUploadInput = {"]) {
    const at = exec.indexOf(call);
    const check = exec.lastIndexOf("proposingAgentStillInService(", at);
    assert.ok(at > 0 && check > 0, `a liveness re-check precedes ${call}`);
    const between = exec.slice(check, at);
    assert.ok(!/await (verifyPackage|instagramPackageVerdictFor|resolveExternalSendReachability|readVerifiedVideo)/.test(between), `nothing slow sits between the re-check and ${call}`);
  }
}

console.log("l2b firewall: ok");
