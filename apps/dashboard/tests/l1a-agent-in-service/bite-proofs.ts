/*
 * L-1a — every load-bearing line bites. Each proof removes one guarantee from source, runs the
 * PostgreSQL suite, requires it to FAIL for the stated reason, and restores the file byte-for-byte.
 *
 * Mutates src while it runs: never run it in parallel with other suites against the same tree.
 */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const SUITE = "tests/l1a-agent-in-service/in-service-postgres.ts";
const RULE = "src/features/agent-identity/in-service.ts";
const READER = "src/features/agent-identity/read-durable-agent-identity.server.ts";
const APPROVAL = "src/features/action-authorization/decide-action-request.server.ts";
const PLACEMENT_WRITER = "src/features/organization-authority/write-agent-placement.server.ts";

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
  "B1 the rule ignores suspended_at",
  RULE,
  `    facts.suspendedAt === null &&\n`,
  ``,
  "suspended_at → not in service (identity reader)",
);
proof(
  "B2 the rule goes back to the 'not retired' denylist",
  RULE,
  `(facts.lifecycle === null || facts.lifecycle === IN_SERVICE_AGENT_LIFECYCLE_STATUS)`,
  `facts.lifecycle !== "retired"`,
  "'paused' is out of the allowlist",
);
proof(
  "B3 the runtime liveness seam stops asking the rule",
  READER,
  `    return isAgentInService(row) ? "in-service" : "not-in-service";\n  } catch {`,
  `    return "in-service";\n  } catch {`,
  "suspended_at → not in service (runtime liveness)",
);
proof(
  "B4 approval stops refusing an out-of-service proposer",
  APPROVAL,
  `if (liveness !== "in-service") throw new Error(PROPOSING_AGENT_NOT_IN_SERVICE);`,
  `if (false && liveness !== "in-service") throw new Error(PROPOSING_AGENT_NOT_IN_SERVICE);`,
  "a suspended proposer's request cannot be approved",
);
proof(
  "B5 the in-transaction liveness read stops locking the agent row",
  READER,
  `    .for("share")\n`,
  ``,
  "approval waits on the agent row a retirement holds FOR UPDATE",
);
proof(
  "B6 the placement writer stops asking the rule",
  PLACEMENT_WRITER,
  `if (!isAgentInService(agent)) {`,
  `if (false && !isAgentInService(agent)) {`,
  "a suspended agent cannot be placed",
);

console.log("PASS l1a bite proofs — every load-bearing line bites");
