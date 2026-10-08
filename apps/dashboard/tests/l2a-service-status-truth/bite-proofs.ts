/*
 * L-2a — every load-bearing line bites. Each proof removes one guarantee from source, runs the
 * PostgreSQL suite, requires it to FAIL for the stated reason, and restores the file byte-for-byte.
 *
 * Mutates src while it runs: never run it in parallel with other suites against the same tree.
 */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const SUITE = "tests/l2a-service-status-truth/status-postgres.ts";
const STATUS = "src/features/agent-identity/service-status.ts";
const READER = "src/features/agent-identity/read-durable-agent-identity.server.ts";
const LIVE_MAP = "src/features/live-map/read-live-map.server.ts";
const MANDATE_SOURCE = "src/features/agent-mandate/heby-mandate-source.server.ts";
const AGENT_SOURCE = "src/features/agent-outcome-observation/heby-agent-source.server.ts";

const abs = (p: string): string => path.join(ROOT, p);
const read = (p: string): string => readFileSync(abs(p), "utf8");

function proof(label: string, file: string, from: string, to: string, expected: string): void {
  const original = read(file);
  const mutated = original.replace(from, to);
  assert.notEqual(mutated, original, `${label}: the mutation did not APPLY to ${file}`);
  try {
    writeFileSync(abs(file), mutated, "utf8");
    const r = spawnSync(process.execPath, ["--import", "tsx", SUITE], {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 600_000,
      maxBuffer: 32 * 1024 * 1024,
    });
    const output = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
    assert.notEqual(r.status, 0, `${label}: the suite PASSED with the guarantee removed`);
    assert.ok(
      output.includes(expected),
      `${label}: failed, but not for the stated reason. Expected "${expected}". Output:\n${output}`,
    );
  } finally {
    writeFileSync(abs(file), original, "utf8");
  }
  assert.equal(read(file), original, `${label}: ${file} was not restored byte-for-byte`);
  console.log(`bites: ${label}`);
}

proof(
  "B1 the identity seam infers status from inService",
  READER,
  `serviceStatus: agentServiceStatus(row),`,
  `serviceStatus: isAgentInService(row) ? ("in-service" as const) : ("retired" as const),`,
  "Paused reads as suspended",
);
proof(
  "B2 suspension without its lifecycle is accepted as suspended",
  STATUS,
  `return present(suspendedAt) && lifecycle === "suspended" ? "suspended" : "indeterminate";`,
  `return "suspended";`,
  "Conflict reads as indeterminate",
);
proof(
  "B3 Live Map draws a suspended agent as retired",
  LIVE_MAP,
  `suspended: { label: "Suspended", tone: "suspended" },`,
  `suspended: { label: "Retired", tone: "retired" },`,
  "a suspended agent is drawn as suspended",
);
proof(
  "B4 Heby mandate source goes back to in-service-or-retired",
  MANDATE_SOURCE,
  "`. The agent is ${agentServiceSentence(identity.serviceStatus, identity)}. ` +",
  '`. The agent is ${identity.inService ? "in service" : "retired from service"}. ` +',
  "The agent is suspended from service since",
);
proof(
  "B5 Heby agent source marks every out-of-service agent retired",
  AGENT_SOURCE,
  `lifecycle: agent.serviceStatus === "retired" ? "retired" : "settled",`,
  `lifecycle: agent.inService ? "settled" : "retired",`,
  "a suspended agent's record is current, not retired",
);

console.log("PASS l2a bite proofs — every load-bearing line bites");
