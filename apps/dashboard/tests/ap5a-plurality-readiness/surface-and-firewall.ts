/*
 * AP-5A — PLURALITY READINESS: pure contracts and firewall (no database).
 *
 *   S1. THE CHOOSER. With one agent (or none) it renders nothing and the caller sends nothing — the
 *       single-agent path is byte-identical. With several it asks, with no default, and sends the
 *       chosen id only when one was chosen.
 *   S2. WORDING. Agent-specific refusal sentences name the agent the human chose; none hard-codes
 *       "Heby" except the two sign-in sentences, which name the product surface.
 *   S3. THE PERSONA (G1). Both origination instruction variants open with the agent-neutral line,
 *       name no agent, stay minted, and the SCI-1 census of minting files is unchanged.
 *   F1. NO SECOND RESOLVER. Exactly two agent resolvers exist; the new chooser list reads the Agent
 *       Identity Authority's own seam.
 *   F2. MEDIA KEEPS "NAMED AGENT" (G2-A). Both writers pass the human's selection to the one
 *       authorship resolver, BEFORE the source revision is read, and no media writer reads the
 *       revision's author.
 *   F3. EVERY AGENT-ATTRIBUTED OPERATIONS DOOR CARRIES THE SELECTION, and the observation wrapper
 *       forwards it untouched.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import {
  agentChoiceRequired,
  agentNameFor,
  agentSelectionFor,
  AgentChoiceSelect,
} from "../../src/components/agents/agent-choice-select";
import {
  REFUSAL_WORDING,
  refusalWordingFor,
  withAgentName,
} from "../../src/components/decision-workspace/agent-proposal-request";
import {
  AGENT_ORIGINATION_SYSTEM_INSTRUCTIONS,
  AGENT_ORIGINATION_KNOWLEDGE_SYSTEM_INSTRUCTIONS,
} from "../../src/features/agent-origination/originate-action.server";
import { isHebunInstruction } from "../../src/features/heby-runtime/instruction-channel";
import { prepareContentDraftWithObservation } from "../../src/features/content-observation/prepare-with-observation.server";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
/** Source without comments, so a guard is proven in code and never in prose. */
const code = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const NEUTRAL = "You are a durable organizational agent inside the Hebun runtime.";
const A = { agentId: "10000000-0000-4000-8000-00000000a5a1", name: "Heby" };
const B = { agentId: "10000000-0000-4000-8000-00000000a5a2", name: "Atlas" };

async function main(): Promise<void> {
  /* ── S1. THE CHOOSER ─────────────────────────────────────────────────────── */
  assert.equal(agentChoiceRequired([]), false, "S1: no agents, no choice");
  assert.equal(agentChoiceRequired([A]), false, "S1: one agent, no choice");
  assert.equal(agentChoiceRequired([A, B]), true, "S1: two agents, a choice is required");
  assert.deepEqual(agentSelectionFor([A], A.agentId), {}, "S1: one agent sends nothing, even if an id is held");
  assert.deepEqual(agentSelectionFor([], ""), {}, "S1: no list sends nothing");
  assert.deepEqual(agentSelectionFor([A, B], ""), {}, "S1: several and none chosen sends nothing — the server refuses ambiguity");
  assert.deepEqual(agentSelectionFor([A, B], B.agentId), { agentId: B.agentId }, "S1: several and one chosen sends that id");
  assert.equal(agentNameFor([A], ""), "Heby", "S1: one agent is named without a choice");
  assert.equal(agentNameFor([A, B], B.agentId), "Atlas", "S1: the chosen agent is named");
  assert.equal(agentNameFor([A, B], ""), null, "S1: unchosen is unnamed, never guessed");
  assert.equal(AgentChoiceSelect({ id: "x", value: "", onChange: () => {}, agents: [A] }), null, "S1: renders nothing for one agent");
  assert.notEqual(AgentChoiceSelect({ id: "x", value: "", onChange: () => {}, agents: [A, B] }), null, "S1: renders for several");
  const chooser = code("src/components/agents/agent-choice-select.tsx");
  assert.ok(/<option value="">Choose an agent<\/option>/.test(chooser), "S1: the empty option names nobody — no default");
  assert.ok(!/import /.test(chooser), "S1: the chooser reads nothing and imports nothing");

  /* ── S2. WORDING ─────────────────────────────────────────────────────────── */
  const heby = Object.entries(REFUSAL_WORDING).filter(([, s]) => /\bHeby\b/.test(s));
  assert.deepEqual(
    heby.map(([k]) => k).sort(),
    ["no-authorized-tenant-context", "unauthenticated"],
    "S2: only the two sign-in sentences name the product; every agent sentence is agent-aware",
  );
  assert.equal(
    refusalWordingFor("no-action-proposed", "Atlas"),
    "Atlas considered the goal and proposed no action. Nothing was filed.",
    "S2: the chosen agent is named",
  );
  assert.equal(
    refusalWordingFor("no-action-proposed", "Heby"),
    "Heby considered the goal and proposed no action. Nothing was filed.",
    "S2: with Heby as the agent, the released sentence is unchanged",
  );
  assert.equal(withAgentName("{agent}'s answer", null), "The agent's answer", "S2: unknown is 'the agent', never Heby");
  for (const [reason] of Object.entries(REFUSAL_WORDING)) {
    assert.ok(!refusalWordingFor(reason as never, "Atlas").includes("{agent}"), `S2: ${reason} is fully filled`);
  }
  const affordance = code("src/components/layout/heby/heby-origination-affordance.tsx");
  assert.ok(affordance.includes("refusalWordingFor(state.reason, state.agentName)"), "S2: the Heby affordance names the agent asked");
  const panel = code("src/components/decision-workspace/agent-proposal-request.tsx");
  assert.ok(panel.includes("refusalWordingFor(outcome.reason, agentName)"), "S2: the /approvals panel names the agent asked");

  /* ── S3. THE PERSONA (G1) ────────────────────────────────────────────────── */
  for (const [label, text] of [
    ["plain", AGENT_ORIGINATION_SYSTEM_INSTRUCTIONS],
    ["knowledge", AGENT_ORIGINATION_KNOWLEDGE_SYSTEM_INSTRUCTIONS],
  ] as const) {
    assert.ok(text.startsWith(`${NEUTRAL} `), `S3 ${label}: opens with the agent-neutral persona`);
    assert.ok(!/\bHeby\b/.test(text), `S3 ${label}: names no agent`);
    assert.ok(isHebunInstruction(text), `S3 ${label}: still minted (SCI-1)`);
  }
  const origination = code("src/features/agent-origination/originate-action.server.ts");
  assert.equal(origination.split(NEUTRAL).length - 1, 1, "S3: the line is a repository literal, once, inside the instruction array");
  assert.ok(!origination.includes("You are Heby"), "S3: the Agent #1 persona is gone from origination");
  /* The chat assistant persona is the PRODUCT's, untouched by this phase. */
  assert.ok(read("src/features/heby-answer/model-answer.server.ts").includes("You are Heby, an advisory assistant"), "S3: the assistant persona is unchanged");

  /* ── F1. NO SECOND RESOLVER ──────────────────────────────────────────────── */
  const files: string[] = [];
  const walk = (rel: string) => {
    for (const e of readdirSync(path.join(ROOT, rel))) {
      const r = path.join(rel, e);
      if (statSync(path.join(ROOT, r)).isDirectory()) walk(r);
      else if (/\.tsx?$/.test(e)) files.push(r);
    }
  };
  walk("src");
  const resolvers = files
    .flatMap((f) => [...code(f).matchAll(/export async function (resolveAgent[A-Za-z]*)\(/g)].map((m) => m[1]!))
    .sort();
  assert.deepEqual(
    resolvers,
    ["resolveAgentAuthorship", "resolveAgentProposer", "resolveAgentProposerDisplays"],
    "F1: the two released resolvers and the released display reader — nothing new",
  );
  const ops = code("src/app/(dashboard)/operations/actions.ts");
  const listing = ops.slice(ops.indexOf("export async function listInServiceAgentsAction"));
  assert.ok(
    /readDurableAgentIdentityState\(await resolveTenantContext\(\)\)/.test(listing.slice(0, 400)),
    "F1: the chooser list is the Agent Identity Authority's own read",
  );
  for (const f of [
    "src/components/agents/agent-choice-select.tsx",
    "src/app/(dashboard)/operations/actions.ts",
    "src/components/operations-preparation/operations-preparation.tsx",
  ]) {
    assert.ok(!/from\(agents\)|schema\/agent"/.test(code(f)), `F1: ${f} reads no agents table directly`);
  }
  assert.ok(!/listEligibleAgents|record-work/.test(code("src/components/agents/agent-choice-select.tsx")), "F1/G3: the chooser is not record-work eligibility");
  assert.ok(!/listEligibleAgents/.test(listing.slice(0, 600)), "G3: preparation's list is identity, not eligibility");

  /* ── F2. MEDIA KEEPS "NAMED AGENT" (G2-A) ────────────────────────────────── */
  for (const f of [
    "src/features/media-assets/request-media-generation.server.ts",
    "src/features/media-assets/async-generation-lifecycle.server.ts",
  ]) {
    const c = code(f);
    assert.ok(
      c.includes("resolveAgentAuthorship(tenant, { getDb: () => db }, { agentId: input.agentId })"),
      `F2: ${f} passes the human's selection to the one authorship resolver`,
    );
    assert.ok(!/authoredByActor|authored_by_actor/.test(c), `F2: ${f} never reads the revision's author`);
    assert.ok(
      c.indexOf("resolveAgentAuthorship(") < c.indexOf("workArtifactRevisions.contentDigest"),
      `F2: ${f} resolves the agent before it reads the source revision (AP-1 B1 order)`,
    );
  }
  assert.ok(!/agent/i.test(code("src/features/media-assets/input-digest.ts")), "F2: the input identity carries no agent");

  /* ── F3. EVERY OPERATIONS DOOR CARRIES THE SELECTION ─────────────────────── */
  assert.ok(
    code("src/features/work-artifacts/prepare-work-artifact.server.ts").includes(
      "resolveAgentAuthorship(tenant, deps.agentIdentity ?? {}, { agentId: input.agentId })",
    ),
    "F3: preparation passes the selection to the authorship resolver",
  );
  for (const [f, n] of [
    ["src/components/operations-preparation/prepare-with-hebun.tsx", 2],
    ["src/components/operations-preparation/generate-image-with-hebun.tsx", 1],
    ["src/components/operations-preparation/generate-video-with-hebun.tsx", 1],
    ["src/components/decision-workspace/agent-proposal-request.tsx", 1],
  ] as const) {
    assert.equal(code(f).split("agentSelectionFor(").length - 1, n, `F3: ${f} sends the selection at every call`);
  }
  /* The reference card uses the same chooser under MEDIA-5's vocabulary rule (no "select" in its body). */
  const reference = code("src/components/operations-preparation/revision-media-assets.tsx");
  assert.ok(reference.includes("const namedAgentFor = agentSelectionFor;"), "F3: the reference card aliases the shared selection");
  assert.equal(reference.split("namedAgentFor(agents, agentId)").length - 1, 1, "F3: the reference edit sends the selection");
  assert.ok(ops.includes("agentId: input?.agentId ?? null"), "F3: the video action forwards the selection");
  assert.ok(
    /<AgentProposalRequest workScopeChoices=\{workScopeChoices\} agentOptions=\{agentOptions\} \/>/.test(
      code("src/app/(dashboard)/approvals/page.tsx"),
    ),
    "F3: /approvals hands the panel the in-service agents it already reads",
  );

  const seen: unknown[] = [];
  await prepareContentDraftWithObservation(
    { prompt: "p", route: "/operations", artifactType: "content-draft", title: "t", agentId: B.agentId },
    {
      resolveTenant: async () => null,
      prepare: (async (input: unknown) => {
        seen.push(input);
        return { status: "refused", reason: "unauthenticated" };
      }) as never,
    } as never,
  );
  assert.equal((seen[0] as { agentId?: string }).agentId, B.agentId, "F3: the observation wrapper forwards the selection untouched");

  console.log("ap5a-plurality-readiness/surface-and-firewall: passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
