/*
 * ENTERPRISE-OPERATIONS-1 — the governed organizational work loop, checked where a customer meets it.
 *
 *   Command → (Heby plan / proposal) → Approvals → Execute → work register
 *
 * For every changed surface this asserts: (1) the route's page mounts the component, (2) the
 * rendered markup carries the new handoff or wording, (3) the stale claim it replaced is gone, and
 * (4) nothing gained authority — links and words only. Static render, no database, no session, no
 * provider. The negative controls (bite-proofs) are in `bite-proofs.ts` next to this file.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { CommandOverview } from "../../src/components/command-overview/command-overview";
import { DecisionHandoffAndBoundary } from "../../src/components/decision-workspace/decision-handoff-boundary";
import { DirectorIntent } from "../../src/components/director-intent/director-intent";
import { PermitRow } from "../../src/components/decision-workspace/action-authorizations";
import { AgentOutcomeObservationSurface } from "../../src/components/agents/agent-outcome-observation";
import { executionRefusalWording } from "../../src/components/decision-workspace/execution-refusal-wording";
import {
  workStateAgentChoice,
  NOT_RESPONSIBLE_NOTE,
  KIND_OUTSIDE_MANDATE_NOTE,
  ELIGIBILITY_UNKNOWN_NOTE,
} from "../../src/components/layout/heby/heby-work-state-affordance";
import { composeWorkStateAgentChoices } from "../../src/features/origination-availability/read-origination-availability.server";
import { getDirectorIntentModel } from "../../src/features/director-intent/workspace-model";
import type { ActionPermitView } from "../../src/features/action-authorization/read-action-authorizations.server";
import type { AgentOutcomeObservation } from "../../src/features/agent-outcome-observation/agent-outcome-projection.server";
import { commandProps } from "../helpers/command-composition";

const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const page = (route: string) => read(path.join("src/app/(dashboard)", route, "page.tsx"));
/** Client components read the pathname as they do under the App Router; give them their route. */
const at = (route: string, element: ReturnType<typeof createElement>) =>
  renderToStaticMarkup(createElement(PathnameContext.Provider, { value: route }, element));
const stripComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

/** Command's work region leads to the work register, not to Operations (which shows no work). */
function commandLeadsToTheWorkRegister(): void {
  assert.match(page("command"), /<CommandOverview\b/);
  assert.match(page("director/work"), /<WorkRegisterPanel\b/, "the register is a mounted route");
  const markup = renderToStaticMarkup(createElement(CommandOverview, commandProps()));
  const region = markup.slice(markup.indexOf('id="work-in-motion"'));
  const work = region.slice(0, region.indexOf("</section>") === -1 ? undefined : region.indexOf("</section>"));
  assert.match(work, /href="\/director\/work"/, "Work in motion links to the work register");
  assert.match(work, /Open work register/);
  for (const stale of [/Record work in Operations/, /Progress lives in Operations/i, /Open Operations/]) {
    assert.doesNotMatch(work, stale, `Work in motion no longer says ${stale}`);
  }
}

/** /approvals no longer says Operations runs authorized work, and names where executed work lands. */
function approvalsNamesWhereWorkLands(): void {
  assert.match(page("approvals"), /<DecisionWorkspace\b/);
  assert.match(read("src/components/decision-workspace/decision-workspace.tsx"), /<DecisionHandoffAndBoundary \/>/);
  const markup = at("/approvals", createElement(DecisionHandoffAndBoundary));
  assert.doesNotMatch(markup, /Operations runs the authorized work/);
  assert.match(markup, /href="\/director\/work"/);
  assert.match(markup, /Execute now on this surface/);
}

/** Director Intent hands off to Heby and states the model's own count of connected runtimes. */
function directorIntentIsTruthful(): void {
  assert.match(page("command/intent"), /<DirectorIntent model=\{getDirectorIntentModel\(\)\} \/>/);
  const model = getDirectorIntentModel();
  const markup = at("/command/intent", createElement(DirectorIntent, { model }));
  assert.match(markup, /href="\/heby"/, "the intent is written in Heby, and the page says where");
  assert.doesNotMatch(markup, /No language model connected/);
  assert.doesNotMatch(markup, /One action kind has a connected execution/);
  assert.ok(model.connectedMutationCount > 1, "the registry holds several connected runtimes");
  assert.match(markup.replace(/<!-- -->/g, ""), new RegExp(`${model.connectedMutationCount} consequential action kinds have a connected execution runtime`));
  assert.match(markup, /never authorizes/, "Heby still never authorizes");
}

const permit = (over: Partial<ActionPermitView>): ActionPermitView => ({
  permitId: "p-1",
  requestId: "r-1",
  actionKind: "record-work",
  toolId: "heby.work.record",
  targetLabel: null,
  state: "consumed",
  issuedAt: "2026-10-25T08:00:00.000Z",
  expiresAt: "2026-10-26T08:00:00.000Z",
  consumedAt: "2026-10-25T08:05:00.000Z",
  revokedAt: null,
  revocationReason: null,
  boundPayloadDigest: "d",
  executionStatus: null,
  providerAccepted: false,
  providerMessageId: null,
  proposedByActorType: "human",
  standingAuthorizationId: null,
  ...over,
});
const row = (item: ActionPermitView) => renderToStaticMarkup(createElement("ul", null, createElement(PermitRow, { item })));

/** A spent internal permit links to the work register; nothing else does. */
function executedWorkLinksToTheRegister(): void {
  assert.match(read("src/components/approvals-dashboard/approvals-dashboard.tsx"), /<PermitRow\b/);
  assert.match(row(permit({})), /href="\/director\/work"[^>]*>Open the work register/);
  assert.match(row(permit({ actionKind: "set-work-declared-state" })), /href="\/director\/work"/);
  assert.doesNotMatch(row(permit({ actionKind: "send-external-communication" })), /\/director\/work/, "an external send has no work-register outcome");
  assert.doesNotMatch(row(permit({ state: "active", consumedAt: null })), /\/director\/work/, "an unspent permit claims no outcome");
}

/** Every refusal an /approvals act can return is worded; the server's code is kept at the end. */
function everyApprovalsRefusalIsWorded(): void {
  const union = (file: string, name: string): string[] => {
    const code = stripComments(read(file));
    const start = code.indexOf(`export type ${name} =`);
    assert.ok(start >= 0, `${name} exists in ${file}`);
    const body = code.slice(start, code.indexOf(";", start));
    return [...body.matchAll(/"([a-z][a-z-]+)"/g)].map((m) => m[1]!);
  };
  const codes = new Set([
    ...union("src/features/governed-internal-action/execute-record-work.server.ts", "InternalActRefusal"),
    ...union("src/features/governed-internal-action/execute-set-work-state.server.ts", "WorkStateActRefusal"),
    ...union("src/features/action-authorization/contracts.ts", "ActionDecisionRefusal"),
    ...union("src/features/action-authorization/contracts.ts", "ActionRevocationRefusal"),
    /* A work-authority refusal carries the register's own reason; that reason is shown too. */
    ...union("src/features/organizational-work/work-contracts.ts", "WorkRefusal"),
  ]);
  assert.ok(codes.size > 30, `the vocabularies were read (${codes.size})`);
  for (const code of codes) {
    const words = executionRefusalWording(code);
    assert.notEqual(words, code, `"${code}" is shown in words, not as a bare code`);
    assert.ok(words.endsWith(`[${code}]`), `"${code}" keeps the server's reason`);
  }
  assert.equal(executionRefusalWording("a-future-reason"), "a-future-reason", "an unknown reason is never guessed at");
  /* The call sites word what they show. */
  const component = read("src/components/decision-workspace/action-authorizations.tsx");
  /* Approve/refuse and revoke word their refusal. (Purpose declaration keeps its writer's verdict verbatim, by design.) */
  assert.equal((component.match(/`Refused: \$\{executionRefusalWording\(result\.reason\)\}`/g) ?? []).length, 2, "approve/refuse and revoke word their refusal");
  assert.equal((component.match(/`Refused: \$\{result\.reason\}`/g) ?? []).length, 1, "only the purpose declaration shows its writer's code verbatim");
  assert.match(component, /executionRefusalText\(result\.authorityReason \?\? result\.reason\)/);
  assert.doesNotMatch(read("src/components/approvals-dashboard/approvals-dashboard.tsx"), /answer\.status === "refused" \? answer\.reason :/);
}

/** AP5-WORKSTATE-REASON-COPY-1: the chooser names why an agent is not eligible. */
function chooserNamesTheRealReason(): void {
  const A = "11111111-1111-4111-8111-111111111111";
  const B = "22222222-2222-4222-8222-222222222222";
  const C = "33333333-3333-4333-8333-333333333333";
  const D = "44444444-4444-4444-8444-444444444444";
  const identity = (agentId: string, name: string) => ({
    agentId, name, humanOwnerId: null, humanOwnerType: null, createdAt: "2026-10-17T00:00:00.000Z",
    retiredAt: null, suspendedAt: null, inService: true, serviceStatus: "in-service" as const,
  });
  const known = { status: "known" as const, genesisSpent: true, identities: [identity(A, "Heby"), identity(B, "Engineering"), identity(C, "Ops"), identity(D, "New")] };
  const eligible = { status: "read" as const, agents: [{ agentId: A, name: "Heby" }] };
  const admits = new Map([[A, true], [B, false], [C, true]]); // D's mandate unreadable
  const choices = composeWorkStateAgentChoices(known, eligible, admits);
  assert.equal(choices.status, "read");
  if (choices.status !== "read") return;
  assert.deepEqual(choices.agents.map((a) => [a.name, a.responsible, a.ineligible ?? null]), [
    ["Heby", true, null],
    ["Engineering", false, "kind-outside-mandate"],
    ["Ops", false, null],
    ["New", false, "unknown"],
  ]);
  const notes = workStateAgentChoice(choices, "").agents.map((a) => a.unavailableNote ?? null);
  assert.deepEqual(notes, [null, KIND_OUTSIDE_MANDATE_NOTE, NOT_RESPONSIBLE_NOTE, ELIGIBILITY_UNKNOWN_NOTE]);
  /* Without the mandate answer the released shape is unchanged. */
  const released = composeWorkStateAgentChoices(known, eligible);
  assert.ok(released.status === "read" && released.agents.every((a) => !("ineligible" in a)));
  /* The reader really supplies it. */
  assert.match(read("src/features/origination-availability/read-origination-availability.server.ts"), /composeWorkStateAgentChoices\(identity, eligible, admitsKind\)/);
}

/** Agents links an owed decision or a live authorization to the place it is acted on — no control. */
function agentsLinksToDecisions(): void {
  assert.match(page("agents"), /<AgentOutcomeObservationSurface observation=\{outcomes\} \/>/);
  const base: AgentOutcomeObservation = {
    agentName: "Heby", inService: true, serviceStatus: "in-service", suspendedAt: null, retiredAt: null,
    establishedAt: "2026-10-01T00:00:00.000Z",
    activity: { proposalsFiled: 2, pending: 1, withdrawn: 0 },
    governance: { approved: 1, rejected: 0, permitsIssued: 1, permitsActive: 0, permitsExpired: 0, permitsConsumed: 1, permitsRevoked: 0, approvedWithoutExecution: 0 },
    execution: { attempts: 0, pending: 0, accepted: 0, refused: 0, failed: 0, unknown: 0 },
    modelUsage: { linkedInvocations: 0, inputTokens: 0, outputTokens: 0, invocationsWithoutReportedUsage: 0, distribution: [] },
    selection: { attributed: 0, registered: 0, notDispatched: 0, dispatchFailed: 0, selectionInvalid: 0, noAction: 0, selectionValid: 0, filingNotAttempted: 0, filingProposed: 0, filingRefused: 0, filingFailed: 0 },
    provenance: { proposalsWithInvocation: 0, proposalsWithoutInvocation: 2 },
  };
  const render = (agent: AgentOutcomeObservation) =>
    renderToStaticMarkup(createElement(AgentOutcomeObservationSurface, {
      observation: { status: "read", agents: [agent], unattributedInvocations: 0, unresolvedAgentProposals: 0, historicallyUnattributedInvocations: 0, attributionConflicts: 0, distributionTruncated: false, distributionLimit: 50 },
    }));
  assert.match(render(base), /href="\/approvals"/, "a pending proposal links to Decisions");
  assert.doesNotMatch(render({ ...base, activity: { ...base.activity, pending: 0 } }), /href="\/approvals"/, "nothing owed, no link");
  assert.doesNotMatch(stripComments(read("src/components/agents/agent-outcome-observation.tsx")), /<button|onClick|use client/, "still no control");
}

/** AI-PLAN-UI-THROW-1 at its root: no server-action call in the conversation hook is left uncaught. */
function noThrownActionLeavesAPlaceholder(): void {
  const hook = stripComments(read("src/components/layout/heby/use-heby-conversation.ts"));
  const tokens = [...hook.matchAll(/\btry \{|\} catch\b|\} finally \{/g)].map((m) => m[0]);
  let finals = 0;
  tokens.forEach((token, index) => {
    if (token !== "} finally {") return;
    finals += 1;
    assert.equal(tokens[index - 1], "} catch", `finally #${finals} in the Heby hook is preceded by a catch`);
  });
  assert.ok(finals >= 7, `every awaited action site was found (${finals})`);
  assert.match(hook, /interrupted\("AI plan"/, "the AI plan names its own fallback");
  /* The writing branches never say nothing happened. */
  assert.match(hook, /Hebun could not confirm whether this request was filed\./);
  assert.match(hook, /Whether your question was recorded is not known/);

  const affordance = stripComments(read("src/components/layout/heby/heby-origination-affordance.tsx"));
  const check = affordance.slice(affordance.indexOf("const check = "), affordance.indexOf("const confirm = "));
  assert.match(check, /catch \{[\s\S]*temporarily-unavailable/, "the availability check cannot spin forever");
  const workState = stripComments(read("src/components/layout/heby/heby-work-state-affordance.tsx"));
  assert.match(workState, /try \{\s*setResult\(await proposeWorkStateChangeAction[\s\S]*?\} catch \{/);
}

commandLeadsToTheWorkRegister();
approvalsNamesWhereWorkLands();
directorIntentIsTruthful();
executedWorkLinksToTheRegister();
everyApprovalsRefusalIsWorded();
chooserNamesTheRealReason();
agentsLinksToDecisions();
noThrownActionLeavesAPlaceholder();
console.log("PASS enterprise-operations-1: work loop handoffs mounted, rendered, worded, bounded");
