/*
 * AP-1 — BITE PROOFS for explicit selection and the B1/B2/B3 acceptance invariants.
 *
 * Each proof makes ONE targeted change to real source, runs the suite that must object, and requires
 * the anchor to be UNIQUE, the mutation to APPLY, the suite to FAIL FOR THE INTENDED REASON, and the
 * file to come back byte-identical. A killed child is VOID, never a bite. Run sequentially: two
 * bite-proof files restoring the same source in parallel corrupt it.
 *
 * (The genesis decision and the canonical-name index are bitten in tests/agent-id-0/bite-proofs.ts;
 * the in-service name predicate in tests/agent-id-0-1/bite-proofs.ts.)
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const abs = (f: string): string => path.join(ROOT, f);
const read = (f: string): string => readFileSync(abs(f), "utf8");
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

const PROPOSER = "src/features/action-authorization/agent-proposer.server.ts";
const AUTHORSHIP = "src/features/work-artifacts/agent-authorship.server.ts";
const ORIGINATION = "src/features/agent-origination/originate-action.server.ts";
const MEDIA = "src/features/media-assets/request-media-generation.server.ts";
const HYPOTHESIS = "src/features/agent-improvement-hypothesis/write-improvement-hypothesis.server.ts";
const GROUNDING = "src/features/agent-outcome-observation/heby-agent-source.server.ts";
const AVAILABILITY = "src/features/origination-availability/read-origination-availability.server.ts";

const PG_SUITE = "tests/ap1-plurality-foundation/plurality-postgres.ts";
const E25_SUITE = "tests/e25-agent-grounding/agent-grounding.ts";
const WF1_SUITE = "tests/wf1-origination-recommendation/availability-postgres.ts";

const CHILD_TIMEOUT_MS = 300_000;

interface Mutation {
  readonly label: string;
  readonly file: string;
  readonly suite: string;
  readonly find: string;
  readonly replace: string;
  readonly because: string;
}

const MUTATIONS: readonly Mutation[] = [
  {
    label: "S1 the proposer ignores an explicit selection",
    file: PROPOSER,
    suite: PG_SUITE,
    find: "  if (selectedId) {",
    replace: "  if (false as boolean) {",
    because: "the selection names Atlas",
  },
  {
    label: "S2 the proposer resolves an id that is not this tenant's",
    file: PROPOSER,
    suite: PG_SUITE,
    find: '    if (!selected) return { status: "refused", reason: "selected-agent-unresolvable" };',
    replace:
      '    if (!selected) return { status: "resolved", proposer: { agentId: selectedId, [AGENT_PROPOSER_BRAND]: true } };',
    because: "selects nothing — foreign and unknown are indistinguishable",
  },
  {
    label: "S3 a retired agent may be chosen as proposer",
    file: PROPOSER,
    suite: PG_SUITE,
    find: '    if (!selected.inService) return { status: "refused", reason: "selected-agent-retired" };',
    replace: "    /* mutated: retirement does not matter when chosen */",
    because: "a retired agent cannot be chosen",
  },
  {
    label: "S4 authorship ignores an explicit selection",
    file: AUTHORSHIP,
    suite: PG_SUITE,
    find: "  if (selectedId) {",
    replace: "  if (false as boolean) {",
    because: "the authorship selection names Atlas too",
  },
  {
    label: "S5 origination drops the human's choice on the floor",
    file: ORIGINATION,
    suite: PG_SUITE,
    find: '    agentId: typeof input.agentId === "string" ? input.agentId : null,',
    replace: "    agentId: null,",
    because: "selected-agent-unresolvable",
  },
  {
    label: "S6 availability offers a retired agent as a candidate",
    file: AVAILABILITY,
    suite: WF1_SUITE,
    find: "            .filter((i) => i.inService)\n",
    replace: "",
    because: "the candidates are exactly the IN-SERVICE agents",
  },
  {
    label: "B1 media generation reports two agents as none",
    file: MEDIA,
    suite: PG_SUITE,
    /* AP-5A re-anchored: the mapping now also names a refused selection; collapsing ambiguity is the same defect. */
    find: 'authorship.reason === "ambiguous-durable-agent-identity"\n        ? "ambiguous-durable-agent"\n',
    replace: 'authorship.reason === "ambiguous-durable-agent-identity"\n        ? "no-durable-agent"\n',
    because: "B1: two agents in service is NOT 'no durable agent'",
  },
  {
    label: "B2 a hypothesis about one agent supersedes one about another",
    file: HYPOTHESIS,
    suite: PG_SUITE,
    find: '      if (predecessor[0]!.agentId !== agentId) return refused("supersedes-other-agent");\n',
    replace: "",
    because: "B2: a hypothesis about Atlas cannot supersede one about Heby",
  },
  {
    label: "B3 the grounding citation goes back to the agent's name",
    file: GROUNDING,
    suite: E25_SUITE,
    find: "    recordRef: `agent/${agentId}`,",
    replace: "    recordRef: agent.agentName,",
    because: "the record reference is the agent's id",
  },
];

interface Run {
  readonly ok: boolean;
  readonly void: boolean;
  readonly output: string;
}

function runSuite(suite: string): Run {
  const result = spawnSync(process.execPath, ["--import", "tsx", suite], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
    timeout: CHILD_TIMEOUT_MS,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const killed = result.signal !== null || result.status === null;
  return { ok: result.status === 0, void: killed, output };
}

function withMutation(mutation: Mutation, body: () => void): void {
  const original = read(mutation.file);
  const before = sha(original);
  const occurrences = original.split(mutation.find).length - 1;
  assert.equal(
    occurrences,
    1,
    `${mutation.label}: the mutation anchor must appear exactly once in ${mutation.file}, found ${occurrences}`,
  );
  try {
    writeFileSync(abs(mutation.file), original.replace(mutation.find, mutation.replace), "utf8");
    assert.notEqual(sha(read(mutation.file)), before, `${mutation.label}: the mutation did not apply`);
    body();
  } finally {
    writeFileSync(abs(mutation.file), original, "utf8");
    assert.equal(sha(read(mutation.file)), before, `${mutation.label}: ${mutation.file} was not restored`);
  }
}

function main(): void {
  const voided: string[] = [];
  let bitten = 0;
  for (const mutation of MUTATIONS) {
    withMutation(mutation, () => {
      const run = runSuite(mutation.suite);
      if (run.void) {
        voided.push(mutation.label);
        return;
      }
      assert.equal(run.ok, false, `${mutation.label}: the suite still PASSED — the guard does not bite`);
      assert.ok(
        run.output.includes(mutation.because),
        `${mutation.label}: the suite failed, but not for the intended reason. Expected output containing ` +
          `"${mutation.because}".\n--- actual ---\n${run.output.slice(-2500)}`,
      );
    });
    if (!voided.includes(mutation.label)) {
      bitten += 1;
      console.log(`BITE ${mutation.label}`);
    }
  }
  assert.deepEqual(voided, [], `these proofs were VOID (child killed), not passes: ${voided.join(", ")}`);
  assert.equal(bitten, MUTATIONS.length, "every mutation must have been proved to bite");
  console.log(`ap1-plurality-foundation/bite-proofs: ${bitten} mutations bit, 0 void`);
}

main();
