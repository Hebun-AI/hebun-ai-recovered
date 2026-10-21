/*
 * WORK-UPDATE-AGENT-SELECTION-1 — the work-state chooser, without a database.
 *
 *   C1  composition: only in-service identities of the read are listed, in its order; `responsible`
 *       comes from the eligibility read; a foreign eligibility id is ignored; unreadable = unavailable
 *   C2  the surface rule: zero / one / two agents, missing, explicit, invalid and non-responsible choices
 *   C3  the chooser renders a non-responsible agent as listed but not choosable; single-agent unchanged
 *   C4  wiring: the affordance sends only the rule's selection through the released action, the action
 *       forwards it to the released origination, which resolves it with the one proposer resolver
 *   C5  no new resolver, no writer, nothing model-facing
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import {
  composeWorkStateAgentChoices,
  readWorkStateAgentChoices,
} from "../../src/features/origination-availability/read-origination-availability.server";
import { workStateAgentChoice, NOT_RESPONSIBLE_NOTE } from "../../src/components/layout/heby/heby-work-state-affordance";
import { AgentChoiceSelect } from "../../src/components/agents/agent-choice-select";
import { WORK_STATE_ORIGINATION_SYSTEM_INSTRUCTIONS } from "../../src/features/agent-origination/originate-work-state.server";

const ROOT = process.cwd();
const code = (file: string) => readFileSync(path.join(ROOT, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const S = "33333333-3333-4333-8333-333333333333";
const FOREIGN = "44444444-4444-4444-8444-444444444444";
const identity = (agentId: string, name: string, serviceStatus: "in-service" | "suspended" | "retired") => ({
  agentId,
  name,
  humanOwnerId: null,
  humanOwnerType: null,
  createdAt: "2026-10-17T00:00:00.000Z",
  retiredAt: serviceStatus === "retired" ? "2026-10-17T00:00:00.000Z" : null,
  suspendedAt: serviceStatus === "suspended" ? "2026-10-17T00:00:00.000Z" : null,
  inService: serviceStatus === "in-service",
  serviceStatus,
});
const known = (...ids: ReturnType<typeof identity>[]) => ({ status: "known" as const, genesisSpent: true, identities: ids });
const eligible = (...ids: string[]) => ({ status: "read" as const, agents: ids.map((agentId) => ({ agentId, name: "x" })) });

async function main(): Promise<void> {
  /* ── C1 · composition ── */
  assert.deepEqual(composeWorkStateAgentChoices(known(), eligible()), { status: "read", agents: [] }, "C1: zero agents");
  assert.deepEqual(
    composeWorkStateAgentChoices(known(identity(A, "Heby", "in-service"), identity(S, "Sleepy", "suspended"), identity(B, "Atlas", "in-service")), eligible(A, S, FOREIGN)),
    {
      status: "read",
      agents: [
        { agentId: A, name: "Heby", responsible: true },
        { agentId: B, name: "Atlas", responsible: false },
      ],
    },
    "C1: suspended never listed, even when its mandate is eligible; foreign eligibility ignored; read order kept",
  );
  assert.deepEqual(composeWorkStateAgentChoices({ status: "unavailable" }, eligible(A)), { status: "unavailable" }, "C1: identity unreadable");
  assert.deepEqual(composeWorkStateAgentChoices(known(identity(A, "Heby", "in-service")), { status: "unavailable" }), { status: "unavailable" }, "C1: eligibility unreadable");
  assert.deepEqual(await readWorkStateAgentChoices(null, A), { status: "unavailable" }, "C1: no tenant");
  assert.deepEqual(
    await readWorkStateAgentChoices({ tenantId: FOREIGN, userId: FOREIGN } as never, A, { getDb: () => null }),
    { status: "unavailable" },
    "C1: no database fails closed",
  );

  /* ── C2 · the surface rule ── */
  const read = (...agents: { agentId: string; name: string; responsible: boolean }[]) => ({ status: "read" as const, agents });
  const heby = { agentId: A, name: "Heby", responsible: true };
  const atlas = { agentId: B, name: "Atlas", responsible: true };
  const idle = { agentId: B, name: "Atlas", responsible: false };

  for (const [label, choices] of [
    ["loading", null],
    ["unavailable", { status: "unavailable" as const }],
    ["zero agents", read()],
    ["one agent", read(heby)],
    ["one agent, not responsible", read({ ...heby, responsible: false })],
  ] as const) {
    const rule = workStateAgentChoice(choices, A);
    assert.equal(rule.required, false, `C2 ${label}: no choice`);
    assert.equal(rule.ready, true, `C2 ${label}: the released single-agent path is unchanged — the server decides`);
    assert.deepEqual(rule.selection, {}, `C2 ${label}: nothing is sent`);
    assert.equal(rule.agentName, "Heby", `C2 ${label}: single-agent wording unchanged`);
  }

  const two = workStateAgentChoice(read(heby, atlas), "");
  assert.deepEqual([two.required, two.ready, two.selection, two.agentName], [true, false, {}, null], "C2: two agents, missing selection: nobody by default, cannot ask");
  const explicit = workStateAgentChoice(read(heby, atlas), B);
  assert.deepEqual([explicit.ready, explicit.selection, explicit.agentName], [true, { agentId: B }, "Atlas"], "C2: explicit selection is sent");
  const invalid = workStateAgentChoice(read(heby, atlas), FOREIGN);
  assert.deepEqual([invalid.ready, invalid.selection], [false, {}], "C2: an id the server did not list is never sent");
  const notResponsible = workStateAgentChoice(read(heby, idle), B);
  assert.deepEqual([notResponsible.ready, notResponsible.selection], [false, {}], "C2: a non-responsible agent cannot be chosen");
  assert.equal(notResponsible.agents[1]!.unavailableNote, NOT_RESPONSIBLE_NOTE);
  assert.equal(notResponsible.noneResponsible, false);
  const none = workStateAgentChoice(read({ ...heby, responsible: false }, idle), A);
  assert.deepEqual([none.required, none.noneResponsible, none.ready], [true, true, false], "C2: two agents, zero responsible: nothing can be asked");

  /* ── C3 · the chooser ── */
  assert.equal(AgentChoiceSelect({ id: "x", value: "", onChange: () => {}, agents: workStateAgentChoice(read(heby), "").agents }), null, "C3: one agent, no chooser");
  const html = renderToStaticMarkup(createElement(AgentChoiceSelect, { id: "x", value: "", onChange: () => {}, agents: notResponsible.agents }));
  assert.match(html, /<option value="" selected="">Choose an agent<\/option>/, "C3: the empty option names nobody and is the starting value");
  assert.match(html, new RegExp(`<option value="${A}">Heby</option>`), "C3: a responsible agent is choosable");
  assert.match(html, new RegExp(`<option value="${B}" disabled="">Atlas — ${NOT_RESPONSIBLE_NOTE}</option>`), "C3: a non-responsible agent is listed, not choosable");

  /* ── C4 · wiring ── */
  const affordance = code("src/components/layout/heby/heby-work-state-affordance.tsx");
  assert.match(affordance, /proposeWorkStateChangeAction\(\{ workItemId, toState, \.\.\.agent\.selection \}\)/, "C4: only the rule's selection is sent");
  assert.match(affordance, /disabled=\{pending \|\| toState === "" \|\| !agent\.ready\}/, "C4: asking waits for a valid choice");
  assert.match(affordance, /readWorkStateAgentChoicesAction\(\{ workItemId \}\)/, "C4: the list is the server's");
  const action = code("src/app/(dashboard)/heby/work-state-origination-actions.ts");
  assert.match(action, /\.\.\.\(typeof input\?\.agentId === "string" \? \{ agentId: input\.agentId \} : \{\}\)/, "C4: the action forwards a string id only");
  assert.match(action, /readWorkStateAgentChoices\(await resolveTenantContext\(\),/, "C4: the list is read for the session's tenant");
  const origination = code("src/features/agent-origination/originate-work-state.server.ts");
  assert.match(origination, /resolveAgentProposer\(tenant, deps\.agentIdentity \?\? \{\}, \{\s*agentId: typeof input\.agentId === "string" \? input\.agentId : null,\s*\}\)/, "C4: the one proposer resolver decides");
  const projection = code("src/features/origination-availability/read-origination-availability.server.ts");
  const fn = projection.slice(projection.indexOf("export async function readWorkStateAgentChoices("));
  assert.match(fn, /readWorkStateTarget\(tenant, workItemId, deps\)/, "C4: the item through the Work Authority's tenant-scoped read");
  /* WORK-UPDATE-ORGANIZATION-SCOPE-1 (Director-approved 2026-10-21): the item's own recorded scope, organization or domain. */
  assert.match(fn, /listEligibleAgents\(tenant, target\.target\.workScope, deps, kind\)/, "C4: responsibility through the eligibility projection, for this kind");
  assert.match(fn, /readDurableAgentIdentityState\(tenant, deps\)/, "C4: identity through the Agent Identity Authority's read");

  /* ── C5 · boundaries ── */
  for (const f of [
    "src/features/origination-availability/read-origination-availability.server.ts",
    "src/app/(dashboard)/heby/work-state-origination-actions.ts",
    "src/components/layout/heby/heby-work-state-affordance.tsx",
    "src/components/agents/agent-choice-select.tsx",
  ]) {
    assert.ok(!/\.(insert|update|delete)\(|\.transaction\(|export async function resolveAgent/.test(code(f)), `C5: ${f} writes nothing and adds no resolver`);
    assert.ok(!/from\(agents\)|schema\/agent"/.test(code(f)), `C5: ${f} reads no agents table directly`);
  }
  assert.ok(!/agentId|[0-9a-f]{8}-[0-9a-f]{4}/i.test(String(WORK_STATE_ORIGINATION_SYSTEM_INSTRUCTIONS)), "C5: no agent id in the model's instruction");

  console.log("work-update-agent-selection-1/choice-and-surface: OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
