/*
 * E2-3 — LIVE MAP INTELLIGENCE — BITE-PROOFS.
 *
 * Every guarantee this milestone introduces is mutated in the SHIPPED SOURCE, and the suite
 * defending it must fail — for the INTENDED reason, not merely for some reason.
 *
 * Three conditions per mutation: the find-string is present (so the mutation APPLIES — one that
 * cannot be applied looks exactly like one that failed to bite), it reached disk, and the defending
 * suite failed naming the intended reason. Restoration runs in `finally` and is verified
 * byte-identically, so a failure never leaves mutated source behind.
 *
 * A child that exceeds its timeout is reported VOID rather than counted as bitten.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();

const TRUTH_SUITE = "tests/e23-live-map-intelligence/intelligence-truth.ts";
const FIREWALL_SUITE = "tests/e23-live-map-intelligence/firewall.ts";
const SHAPE_SUITE = "tests/e23-live-map-intelligence/query-shape.ts";

const PROJECTION = "src/features/live-map/read-live-map.server.ts";
const CONTRACTS = "src/features/live-map/contracts.ts";
const SEAM = "src/features/agent-outcome-observation/live-map-agent-outcome.server.ts";
const FACTS = "src/features/agent-outcome-observation/read-agent-outcome-facts.server.ts";

const CHILD_TIMEOUT_MS = 5 * 60 * 1000;

const abs = (f: string): string => path.join(ROOT, f);
const readFile = (f: string): string => readFileSync(abs(f), "utf8");
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

interface SuiteRun {
  readonly ok: boolean;
  readonly output: string;
  readonly timedOut: boolean;
}

function runSuite(suite: string): SuiteRun {
  const result = spawnSync(process.execPath, ["--import", "tsx", suite], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
    timeout: CHILD_TIMEOUT_MS,
  });
  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
    timedOut: result.signal === "SIGTERM" && result.status === null,
  };
}

interface Mutation {
  readonly label: string;
  readonly file: string;
  readonly suite: string;
  readonly find: string;
  readonly replace: string;
  readonly expect: string;
}

const MUTATIONS: readonly Mutation[] = [
  {
    /*
     * M1 — THE TENANT PREDICATE, GUTTED ON ONE STATEMENT.
     *
     * The dangerous shape, because the other twelve bindings remain: a substring check for "the
     * tenant column appears somewhere" still passes. Only a counted pin catches a statement that
     * quietly stopped scoping itself.
     */
    label: "M1 one statement stops binding the resolved tenant",
    file: FACTS,
    suite: FIREWALL_SUITE,
    find: `    where "heby_action_requests"."tenant_id" = \${resolved.tenantId}
      and "heby_action_requests"."proposed_by_actor_type" = 'agent'`,
    replace: `    where "heby_action_requests"."proposed_by_actor_type" = 'agent'`,
    expect: "every statement binds the resolved tenant on every table it touches",
  },
  {
    /* M2 — THE JOIN BY NAME. Two identities here share a name; a name join merges them. */
    label: "M2 the attachment is joined by agent name",
    file: PROJECTION,
    suite: TRUTH_SUITE,
    find: `    intelligence: agentIntelligence(outcome, identity.agentId),`,
    replace: `    intelligence: agentIntelligence(outcome, identity.name),`,
    expect: "its evidence was found under its own durable id",
  },
  {
    /* M3 — THE DERIVED ATTACHMENT CLAIMS THE NODE'S TRUTH CLASS. */
    label: "M3 the outcome observation calls itself authoritative",
    file: PROJECTION,
    suite: TRUTH_SUITE,
    find: `    status: "observed",
    truthClass: "derived",`,
    replace: `    status: "observed",
    truthClass: "authoritative",`,
    expect: "the ATTACHMENT is derived",
  },
  {
    /*
     * M4 — UNAVAILABLE BECOMES ZERO. The defect a Director cannot detect by looking: a read that
     * failed renders as an agent that has proposed nothing.
     */
    label: "M4 an unread observation is rendered as zero activity",
    file: PROJECTION,
    suite: TRUTH_SUITE,
    find: `  if (outcome.status !== "read") {
    return {
      status: "unavailable",
      truthClass: "derived",
      sourceAuthority: LIVE_MAP_AGENT_OUTCOME_AUTHORITY,
      detail: LIVE_MAP_AGENT_OUTCOME_UNAVAILABLE,
    };
  }`,
    replace: `  if (outcome.status !== "read") {
    return {
      status: "observed",
      truthClass: "derived",
      sourceAuthority: LIVE_MAP_AGENT_OUTCOME_AUTHORITY,
      basis: LIVE_MAP_AGENT_OUTCOME_BASIS,
      nonClaims: LIVE_MAP_AGENT_OUTCOME_NON_CLAIMS,
      groups: [
        {
          groupId: "proposals",
          label: "Proposals filed",
          measures: [{ label: "Filed", value: 0 }],
        },
      ],
    };
  }`,
    expect: "an unread observation stays unread",
  },
  {
    /* M5 — THE ORIGINATION WRITER IN A PICTURE'S GRAPH. */
    label: "M5 Live Map reaches the agent origination writer",
    file: PROJECTION,
    suite: FIREWALL_SUITE,
    find: `export interface LiveMapDeps {`,
    replace:
      `import { originateAgentAction } from "@/features/agent-origination/originate-action.server";\n` +
      `void originateAgentAction;\n` +
      `export interface LiveMapDeps {`,
    expect: "the agent origination writer",
  },
  {
    /* M6 — AND THE IDENTITY WRITER, WHICH THE BARREL WOULD HAVE SUPPLIED FOR FREE. */
    label: "M6 Live Map reaches the durable agent identity writer",
    file: PROJECTION,
    suite: FIREWALL_SUITE,
    find: `export interface LiveMapDeps {`,
    replace:
      `import { createDurableAgentIdentity } from "@/features/agent-identity/create-durable-agent-identity.server";\n` +
      `void createDurableAgentIdentity;\n` +
      `export interface LiveMapDeps {`,
    expect: "the agent identity writer",
  },
  {
    /* M7 — THE ADMISSION RULE. Widening the node's truth union is how fiction enters. */
    label: "M7 LiveMapTruth is widened to admit the derived class",
    file: CONTRACTS,
    suite: FIREWALL_SUITE,
    find: `export type LiveMapTruth = "authoritative";`,
    replace: `export type LiveMapTruth = "authoritative" | "derived";`,
    expect: "LiveMapTruth admits exactly one value",
  },
  {
    /*
     * M8 — THE FIRST DERIVED CLAIM. A proportion over these counts would have `accepted` as its
     * best numerator, and accepted is not delivered.
     */
    label: "M8 an approval rate is derived from the counts",
    file: PROJECTION,
    suite: TRUTH_SUITE,
    find: `          { label: "Rejected", value: observed.governance.rejected },`,
    replace:
      `          { label: "Rejected", value: observed.governance.rejected },\n` +
      `          { label: "Approval rate", value: observed.governance.approved },`,
    expect: 'must not produce "approval rate"',
  },
  {
    /* M9 — THE JOIN'S OWN SHORTFALL, DROPPED. Numbers that look whole are believed. */
    label: "M9 unresolved agent proposals stop being reported",
    file: PROJECTION,
    suite: TRUTH_SUITE,
    find: `    intelligenceCompleteness: intelligenceCompleteness(outcomeRead),`,
    replace: `    intelligenceCompleteness: undefined,`,
    expect: "the completeness signal is always present when read",
  },
  {
    /* M10 — CUMULATIVE EVIDENCE RELABELLED AS A PERIOD. */
    label: "M10 the attachment claims real-time activity",
    file: SEAM,
    suite: TRUTH_SUITE,
    find: `  "Counted from records other authorities already wrote, covering everything since this agent " +`,
    replace:
      `  "Real-time activity for this agent today. " +\n` +
      `  "Counted from records other authorities already wrote, covering everything since this agent " +`,
    expect: 'must not claim "real-time"',
  },
  {
    /* M11 — A NODE FOR AN ENTITY NOBODY GAVE LIVE MAP AUTHORITY OVER. */
    label: "M11 a proposal domain and proposal nodes appear on the map",
    file: PROJECTION,
    suite: TRUTH_SUITE,
    find: `    domains: [organization, agents, structure, people],`,
    replace:
      `    domains: [organization, agents, structure, people, {\n` +
      `      domainId: "proposals",\n` +
      `      label: "Proposals",\n` +
      `      state: {\n` +
      `        status: "available" as const,\n` +
      `        nodes: [{\n` +
      `          nodeId: "proposal:1",\n` +
      `          kind: "proposal" as never,\n` +
      `          label: "A proposal",\n` +
      `          truth: "authoritative" as const,\n` +
      `          sourceAuthority: "Heby Action Requests",\n` +
      `          detail: [],\n` +
      `        }],\n` +
      `      },\n` +
      `    }],`,
    expect: "the same four domains",
  },
  {
    /* M12 — AN EDGE ASSERTING A RELATIONSHIP THIS MILESTONE NEVER PROVED. */
    label: "M12 an agent to proposal edge is drawn",
    file: PROJECTION,
    suite: TRUTH_SUITE,
    find: `  return agents.state.nodes.map((agent) => ({
    fromNodeId: agent.nodeId,
    toNodeId: organizationNode.nodeId,
    relation: "belongs-to",
    basis:
      "agents.tenant_id — the durable column whose value is this organization's own identity. " +
      "No departmental placement, ownership or assignment is claimed by this edge. An AGENT is " +
      "assigned to a department through \`agents.department_id\`, which Agent Identity owns, and a " +
      "HUMAN is placed through the placement authority — neither is this edge, and neither is " +
      "inferred from it.",
  }));`,
    replace: `  return agents.state.nodes.flatMap((agent) => [
    {
      fromNodeId: agent.nodeId,
      toNodeId: organizationNode.nodeId,
      relation: "belongs-to" as const,
      basis:
        "agents.tenant_id — the durable column whose value is this organization's own identity. " +
        "No departmental placement, ownership or assignment is claimed by this edge. An AGENT is " +
        "assigned to a department through \`agents.department_id\`, which Agent Identity owns, and a " +
        "HUMAN is placed through the placement authority — neither is this edge, and neither is " +
        "inferred from it.",
    },
    {
      fromNodeId: agent.nodeId,
      toNodeId: "proposal:1",
      relation: "originated" as never,
      basis: "this agent filed a proposal",
    },
  ]);`,
    expect: "the one proven relation is still the only one",
  },
  {
    /*
     * M13 — THE PER-AGENT QUERY LOOP. Every rendered value stays correct, so no assertion about
     * VALUES can see this. Only a measured statement count can.
     */
    label: "M13 the evidence is re-read once per agent",
    file: SEAM,
    suite: SHAPE_SUITE,
    find: `  for (const [agentId, observation] of indexed.byAgentId) {`,
    replace:
      `  for (const [agentId, observation] of indexed.byAgentId) {\n` +
      `    await readAgentOutcomeObservationIndexed(tenant, deps);`,
    expect: "sixty agents must cost what one costs",
  },
  {
    /* M14 — APPROVED IS NOT EXECUTED, COLLAPSED BACK INTO APPROVED. */
    label: "M14 the approval gap is collapsed into the approval count",
    file: PROJECTION,
    suite: TRUTH_SUITE,
    find: `            value: observed.governance.approvedWithoutExecution,`,
    replace: `            value: observed.governance.approved,`,
    expect: "governance.Approved, never executed",
  },
];

function withMutation(mutation: Mutation, body: () => void): void {
  const original = readFile(mutation.file);
  const before = sha(original);
  assert.ok(
    original.includes(mutation.find),
    `${mutation.label}: the find-string is not present in ${mutation.file} — the mutation would prove nothing`,
  );
  const mutated = original.replace(mutation.find, mutation.replace);
  assert.notEqual(mutated, original, `${mutation.label}: the mutation changed nothing`);
  try {
    writeFileSync(abs(mutation.file), mutated, "utf8");
    assert.equal(sha(readFile(mutation.file)), sha(mutated), `${mutation.label}: the mutation did not reach disk`);
    body();
  } finally {
    writeFileSync(abs(mutation.file), original, "utf8");
  }
  assert.equal(sha(readFile(mutation.file)), before, `${mutation.file} was not restored byte-identically`);
}

function main(): void {
  let bitten = 0;
  for (const mutation of MUTATIONS) {
    withMutation(mutation, () => {
      const run = runSuite(mutation.suite);
      assert.equal(
        run.timedOut,
        false,
        `${mutation.label}: the defending suite TIMED OUT after ${CHILD_TIMEOUT_MS}ms. That is a ` +
          "VOID result, not a bite.",
      );
      assert.equal(
        run.ok,
        false,
        `${mutation.label}: the mutation SURVIVED — ${mutation.suite} still passed.\n` +
          `--- actual ---\n${run.output.slice(-2000)}`,
      );
      assert.ok(
        run.output.includes(mutation.expect),
        `${mutation.label}: the suite failed, but not for the intended reason. Expected output ` +
          `containing "${mutation.expect}".\n--- actual ---\n${run.output.slice(-2500)}`,
      );
    });
    bitten += 1;
    console.log(`BITE ${mutation.label}`);
  }
  assert.equal(bitten, MUTATIONS.length, "every mutation must have been proved to bite");
  console.log(`e23-live-map-intelligence/bite-proofs: ${bitten} mutations bit`);
}

main();
