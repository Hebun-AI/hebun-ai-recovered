/*
 * AP-5A — BITE PROOFS. Each guard is removed, the suite that pins it must fail for THAT reason, and
 * the source is restored byte-identically. A guard no suite notices is not a guard.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const abs = (f: string) => path.join(ROOT, f);
const read = (f: string) => readFileSync(abs(f), "utf8");
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

const PURE = "tests/ap5a-plurality-readiness/surface-and-firewall.ts";
const PG = "tests/ap5a-plurality-readiness/readiness-postgres.ts";

interface Mutation { label: string; file: string; find: string; replace: string; suite: string; because: string }

const MUTATIONS: Mutation[] = [
  {
    label: "B1 sync media ignores the named agent",
    file: "src/features/media-assets/request-media-generation.server.ts",
    find: "resolveAgentAuthorship(tenant, { getDb: () => db }, { agentId: input.agentId })",
    replace: "resolveAgentAuthorship(tenant, { getDb: () => db })",
    suite: PG,
    because: "M3 sync: naming Atlas proceeds",
  },
  {
    label: "B2 async media ignores the named agent",
    file: "src/features/media-assets/async-generation-lifecycle.server.ts",
    find: "resolveAgentAuthorship(tenant, { getDb: () => db }, { agentId: input.agentId })",
    replace: "resolveAgentAuthorship(tenant, { getDb: () => db })",
    suite: PG,
    because: "M3 async: naming Atlas proceeds",
  },
  {
    label: "B3 sync media accepts a malformed agent id",
    file: "src/features/media-assets/request-media-generation.server.ts",
    find: "return agent === undefined || agent === null || isUuid(agent);",
    replace: "return agent === agent;",
    suite: PG,
    because: "M5 sync: a malformed id",
  },
  {
    label: "B4 sync media collapses a named-agent refusal into 'no durable agent'",
    file: "src/features/media-assets/request-media-generation.server.ts",
    find: '        : authorship.reason === "selected-agent-unresolvable" || authorship.reason === "selected-agent-retired"\n          ? authorship.reason\n          : "no-durable-agent",',
    replace: '        : "no-durable-agent",',
    suite: PG,
    because: "M5 sync: another organization's agent",
  },
  {
    label: "B5 preparation ignores the named agent",
    file: "src/features/work-artifacts/prepare-work-artifact.server.ts",
    find: "resolveAgentAuthorship(tenant, deps.agentIdentity ?? {}, { agentId: input.agentId })",
    replace: "resolveAgentAuthorship(tenant, deps.agentIdentity ?? {})",
    suite: PG,
    because: "P3: naming Atlas prepares",
  },
  {
    label: "B6 the persona names Agent #1 again",
    file: "src/features/agent-origination/originate-action.server.ts",
    find: '  "You are a durable organizational agent inside the Hebun runtime.",',
    replace: '  "You are Heby, a durable organizational agent inside the Hebun runtime.",',
    suite: PG,
    because: "O3: the agent-neutral persona",
  },
  {
    label: "B7 the chooser sends an id for a single agent",
    file: "src/components/agents/agent-choice-select.tsx",
    find: 'return agentChoiceRequired(agents) && chosenAgentId !== "" ? { agentId: chosenAgentId } : {};',
    replace: 'return chosenAgentId !== "" ? { agentId: chosenAgentId } : {};',
    suite: PURE,
    because: "S1: one agent sends nothing",
  },
  {
    label: "B8 the chooser defaults to the first agent",
    file: "src/components/agents/agent-choice-select.tsx",
    find: "  return agents.find((agent) => agent.agentId === chosenAgentId)?.name ?? null;",
    replace: "  return agents.find((agent) => agent.agentId === chosenAgentId)?.name ?? agents[0]?.name ?? null;",
    suite: PURE,
    because: "S1: unchosen is unnamed",
  },
  {
    label: "B9 the /approvals panel drops the selection",
    file: "src/components/decision-workspace/agent-proposal-request.tsx",
    find: "        ...agentSelectionFor(agentOptions, agentId),\n",
    replace: "",
    suite: PURE,
    because: "F3: src/components/decision-workspace/agent-proposal-request.tsx sends the selection",
  },
  {
    label: "B10 an agent refusal sentence hard-codes Heby",
    file: "src/components/decision-workspace/agent-proposal-request.tsx",
    find: '    "{agent} considered the goal and proposed no action. Nothing was filed.",',
    replace: '    "Heby considered the goal and proposed no action. Nothing was filed.",',
    suite: PURE,
    because: "S2: only the two sign-in sentences",
  },
  {
    label: "B11 media reads the revision's author",
    file: "src/features/media-assets/request-media-generation.server.ts",
    find: "      .select({ contentDigest: workArtifactRevisions.contentDigest })",
    replace: "      .select({ contentDigest: workArtifactRevisions.contentDigest, author: workArtifactRevisions.authoredByActorId })",
    suite: PURE,
    because: "F2: src/features/media-assets/request-media-generation.server.ts never reads the revision's author",
  },
];

function proveOne(m: Mutation): { label: string; bit: boolean; detail: string } {
  const before = read(m.file);
  const digest = sha(before);
  const n = before.split(m.find).length - 1;
  if (n !== 1) return { label: m.label, bit: false, detail: `anchor found ${n} times in ${m.file}` };
  let output = "";
  let ok = false;
  try {
    writeFileSync(abs(m.file), before.replace(m.find, m.replace), "utf8");
    const r = spawnSync(process.execPath, ["--import", "tsx", m.suite], { cwd: ROOT, encoding: "utf8", env: process.env, maxBuffer: 64 * 1024 * 1024, timeout: 600_000 });
    output = `${r.stdout ?? ""}${r.stderr ?? ""}`;
    ok = r.status === 0;
  } finally {
    writeFileSync(abs(m.file), before, "utf8");
  }
  assert.equal(sha(read(m.file)), digest, `${m.label}: source restored byte-identically`);
  if (ok) return { label: m.label, bit: false, detail: "the suite PASSED against mutated source" };
  if (!output.includes(m.because)) return { label: m.label, bit: false, detail: `failed, but not for: ${m.because}` };
  return { label: m.label, bit: true, detail: `bit on: ${m.because}` };
}

for (const suite of [PURE, PG]) {
  const r = spawnSync(process.execPath, ["--import", "tsx", suite], { cwd: ROOT, encoding: "utf8", env: process.env, maxBuffer: 64 * 1024 * 1024, timeout: 600_000 });
  assert.equal(r.status, 0, `baseline: ${suite} must pass unmutated before any bite counts`);
}
const verdicts = MUTATIONS.map(proveOne);
for (const v of verdicts) console.log(`${v.bit ? "BIT " : "MISS"}  ${v.label} — ${v.detail}`);
const missed = verdicts.filter((v) => !v.bit);
assert.equal(missed.length, 0, `every guard must bite; missed: ${missed.map((v) => v.label).join(", ")}`);
console.log(`ap5a-plurality-readiness/bite-proofs: ${verdicts.length} mutations bit`);
