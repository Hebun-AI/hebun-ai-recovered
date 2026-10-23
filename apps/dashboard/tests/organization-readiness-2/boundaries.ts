/*
 * ORGANIZATION-READINESS-2 — the in-app assistance decision is a narrow surface over the released
 * writer. No database, no network.
 *
 *   1 · the pairs are the recorded policy's assistance cells, and nothing else
 *   2 · the actions accept no tenant, purpose, scope or policy; the card sends none
 *   3 · the control is offered to a Governance holder only, and the card keeps data-use authorization,
 *       provider availability and a model call apart
 *   4 · readiness now points the Governance authority at the page instead of an operator ceremony
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { assistanceScopePairs } from "../../src/features/external-ai-data-use/assistance-data-use.server";
import { describeOrganizationReadiness } from "../../src/features/organization-readiness/organization-readiness";

const ROOT = process.cwd();
const code = (p: string): string =>
  readFileSync(path.join(ROOT, p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

/* 1 ─ pairs */
assert.deepEqual(assistanceScopePairs(), [
  { purpose: "assistance", dataClass: "conversation" },
  { purpose: "assistance", dataClass: "knowledge" },
  { purpose: "assistance", dataClass: "work-artifact" },
]);

/* 2 ─ actions and card send nothing forgeable */
const actions = code("src/app/(dashboard)/governance/authority/actions.ts");
const signature = (name: string) => {
  const m = actions.match(new RegExp(`export async function ${name}\\(input: \\{([^}]*)\\}`));
  assert.ok(m, `${name} exists`);
  return [...m[1]!.matchAll(/(\w+)\s*:/g)].map((k) => k[1]).sort();
};
assert.deepEqual(signature("authorizeAssistanceDataUseAction"), ["attestationId", "justification", "observedRevision"]);
assert.deepEqual(signature("withdrawAssistanceDataUseAction"), ["justification", "observedRevision"]);
assert.ok(!/authorizeTenantExternalAiDataUseAction|withdrawTenantExternalAiDataUseAction/.test(actions), "the client-scope actions are gone");

const card = code("src/components/governance-authority/ai-assistance-decision-card.tsx");
assert.match(card, /^"use client";/);
for (const call of card.match(/(authorize|withdraw)AssistanceDataUseAction\(\{[^}]*\}\)/g) ?? []) {
  assert.ok(!/tenant|scope|purpose|policy|account/i.test(call), `the card sends nothing forgeable: ${call}`);
}
assert.equal((card.match(/(authorize|withdraw)AssistanceDataUseAction\(\{/g) ?? []).length, 2);
assert.ok(!/accountRef|process\.env|credential/i.test(card), "no account reference, environment or credential reaches the client");

/* 3 ─ who sees the control, and what the card refuses to imply */
assert.match(card, /!view\.viewerIsGovernanceAuthority \?/, "the control is behind Governance");
assert.match(card, /!view\.governanceEstablished \?/);
assert.match(card, /does not connect or switch on a provider/);
assert.match(card, /sends nothing by itself/);
assert.match(card, /This authorizes data use only/);
const page = code("src/app/(dashboard)/governance/authority/page.tsx");
assert.match(page, /readAssistanceDataUse\(tenant\)/, "read for the session's tenant");
assert.match(page, /assistanceDataUse\.status === "read" \? \([\s\S]*?<AssistanceDataUseCard view=\{assistanceDataUse\} \/>/, "unreadable shows no card");

/* 4 ─ readiness wording */
const fresh = describeOrganizationReadiness({
  governance: { status: "read", established: true, viewerIsAuthority: true },
  externalAi: { status: "absent" },
  modelDispatch: "permitted",
  capabilities: { status: "read", available: [], unavailableCount: 0 },
  publishing: { status: "read", tenantArming: "never-armed", effectiveSend: "blocked" },
  workDomains: { status: "read", count: 0 },
});
const ai = fresh.find((r) => r.key === "external-ai")!;
assert.equal(ai.next?.actor, "governance-authority");
assert.match(ai.next?.text ?? "", /AI assistance data use below/);
assert.doesNotMatch(ai.next?.text ?? "", /platform operator/);

console.log("PASS organization-readiness-2 boundaries");
