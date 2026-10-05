/*
 * APF-1 — BITE PROOFS. Each load-bearing gate is removed in turn, the containment suite is run
 * against the defect, and it must FAIL for the stated reason. A gate whose removal leaves the suite
 * green is decoration, and this file refuses to call it a gate.
 *
 * Every mutation is restored in `finally` and the restore is verified byte-for-byte — the same
 * mechanism the AMA-2 bite proofs use.
 */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const SUITE = "tests/apf1-agent-containment/containment-postgres.ts";
const ISSUER = "src/features/standing-mutation-authority/issue-permit-under-standing-authorization.server.ts";
const EXECUTOR = "src/features/governed-machine-execution/execute-record-work-as-machine.server.ts";
const REACH = "src/features/tenant-machine-execution-authority/resolve-machine-execution-reachability.server.ts";
const CREATE = "src/features/agent-identity/create-durable-agent-identity.server.ts";
const RETIRE = "src/features/agent-identity/retire-durable-agent-identity.server.ts";

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
    assert.notEqual(r.status, 0, `${label}: the suite PASSED with the gate removed`);
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
  "issuance reachability (root control + organization lifecycle)",
  ISSUER,
  `if (reachability.status !== "reachable") {`,
  `if (false && reachability.status !== "reachable") {`,
  "a disarmed deployment gets no permits minted for it",
);
proof(
  "organization lifecycle inside reachability",
  REACH,
  `if (!active) return { status: "refused", reason: "tenant-not-active" };`,
  ``,
  "a suspended organization gets no permits minted for it",
);
proof(
  "issuance mandate ceiling",
  ISSUER,
  `if (ceiling) throw new IssuanceAbort(ceiling);`,
  ``,
  "a withdrawn mandate refuses issuance",
);
proof(
  "delivery mandate ceiling",
  EXECUTOR,
  `if (ceiling) {`,
  `if (false && ceiling) {`,
  "withdrawing the mandate after issuance stops delivery",
);
proof(
  "standing issuance audit event",
  ISSUER,
  `await recordActionAuthorizationEventWithin(`,
  `void (async (..._ignored: unknown[]) => undefined)(`,
  "exactly one audit event names the standing-issued permit",
);
proof(
  "create — no Governance in the organization",
  CREATE,
  `if (!authority.bootstrapDecisionId) {`,
  `if (false && !authority.bootstrapDecisionId) {`,
  "an organization with no Governance authority cannot create its agent",
);
proof(
  "create — member without Governance",
  CREATE,
  `if (!authority.authorized) {`,
  `if (false && !authority.authorized) {`,
  "an authenticated member without Governance authority cannot create",
);
proof(
  "retire — owner without Governance",
  RETIRE,
  `if (!authority.bootstrapDecisionId) {`,
  `if (false && !authority.bootstrapDecisionId) {`,
  "owning an agent is no longer enough to retire it",
);

console.log("PASS apf1 bite proofs — every load-bearing gate bites");
