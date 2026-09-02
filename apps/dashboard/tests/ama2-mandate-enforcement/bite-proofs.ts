/*
 * AMA-2 — DO THE GUARDS ACTUALLY BITE?
 *
 * Each mutation re-introduces exactly the defect one guard exists to catch, runs the target suite in
 * a CHILD PROCESS, and requires it to fail FOR THE STATED REASON. A mutation that did not APPLY
 * looks exactly like a guard that did not bite, so every mutation asserts the source changed first;
 * a child killed by a timeout also exits non-zero, so the run is bounded and the status is checked.
 *
 * Every mutation is restored in `finally` and the restore is verified byte-for-byte.
 *
 * NOTE FOR ANY RELEASE: this suite mutates real sources while it runs. Never commit while it is
 * running, and never run it concurrently with another suite.
 */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const FIREWALL = "tests/ama2-mandate-enforcement/enforcement-firewall.ts";
const AMA1_FIREWALL = "tests/ama1-agent-mandate/mandate-firewall.ts";

const SEAM = "src/features/action-authorization/record-action-request.server.ts";
const CONTRACTS = "src/features/action-authorization/contracts.ts";
const ORIGINATION = "src/features/agent-origination/contracts.ts";
const MANDATE_CONTRACTS = "src/features/agent-mandate/contracts.ts";

const abs = (p: string): string => path.join(ROOT, p);
const read = (p: string): string => readFileSync(abs(p), "utf8");
const CHILD_TIMEOUT_MS = 180_000;

function runSuite(suite: string): { ok: boolean; output: string; detail: string } {
  const r = spawnSync(process.execPath, ["--import", "tsx", suite], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: CHILD_TIMEOUT_MS,
    maxBuffer: 32 * 1024 * 1024,
  });
  const detail = [
    r.status === null ? null : `exit ${r.status}`,
    r.signal ? `signal ${r.signal}` : null,
    r.error ? `spawn error ${(r.error as NodeJS.ErrnoException).code ?? ""}`.trim() : null,
  ]
    .filter(Boolean)
    .join(", ");
  return { ok: r.status === 0, output: `${r.stdout ?? ""}\n${r.stderr ?? ""}`, detail };
}

function proof(
  label: string,
  file: string,
  from: string,
  to: string,
  expected: string,
  suite: string = FIREWALL,
): void {
  const original = read(file);
  const mutated = original.replace(from, to);
  assert.notEqual(mutated, original, `${label}: the mutation did not APPLY to ${file}`);
  try {
    writeFileSync(abs(file), mutated, "utf8");
    const { ok, output, detail } = runSuite(suite);
    assert.ok(!ok, `${label}: the suite PASSED with the defect present (${detail})`);
    assert.ok(
      output.includes(expected),
      `${label}: failed, but not for the stated reason. Expected "${expected}". Ran as: ${detail}. Output:\n${output}`,
    );
  } finally {
    writeFileSync(abs(file), original, "utf8");
  }
  assert.equal(read(file), original, `${label}: ${file} was not restored byte-for-byte`);
}

function main(): void {
  for (const suite of [FIREWALL, AMA1_FIREWALL]) {
    const baseline = runSuite(suite);
    assert.ok(baseline.ok, `baseline: ${suite} must pass before any mutation (${baseline.detail})`);
  }

  /* ── 1. THE CEILING IS CONSULTED AFTER THE WRITE ────────────────────────
   *
   * The defect that would make every refusal a lie: the row lands, and the ceiling is checked
   * afterwards. A proposal a mandate excluded would already be sitting in front of a human.
   * ─────────────────────────────────────────────────────────────────────── */
  proof(
    "the ceiling is consulted after the insert",
    SEAM,
    `  const ceiling = await mandateCeilingRefusal(tenant, pair.actorId, prepared.actionKind, deps);
  if (ceiling) return refused(ceiling);

  return insertActionRequest(tenant, prepared, pair, deps, originationInvocationId);`,
    `  const written = await insertActionRequest(tenant, prepared, pair, deps, originationInvocationId);
  const ceiling = await mandateCeilingRefusal(tenant, pair.actorId, prepared.actionKind, deps);
  if (ceiling) return refused(ceiling);

  return written;`,
    "THE CEILING IS CONSULTED BEFORE THE INSERT",
  );

  /* ── 2. THE GATE IS SKIPPED ENTIRELY ────────────────────────────────────
   *
   * Enforcement removed while the IMPORT stays. This is the shape a census alone cannot catch: the
   * module still looks like a mandate reader, and nothing is enforced. The call-site count is what
   * sees it.
   * ─────────────────────────────────────────────────────────────────────── */
  proof(
    "enforcement is removed from the proposal writer",
    SEAM,
    `  const ceiling = await mandateCeilingRefusal(tenant, pair.actorId, prepared.actionKind, deps);
  if (ceiling) return refused(ceiling);
`,
    "",
    "never zero, never twice",
  );

  /* ── 3. NO MANDATE IS TREATED AS AN UNLIMITED MANDATE ───────────────────
   *
   * The single most dangerous defect this phase can have, and the one a careless "make the tests
   * pass" edit reaches for first: an unbounded agent proceeding because nobody bounded it.
   * ─────────────────────────────────────────────────────────────────────── */
  proof(
    "an absent mandate is treated as permission",
    SEAM,
    `  if (!read.mandate) return "no-agent-mandate";`,
    `  if (!read.mandate) return null;`,
    "NO MANDATE != UNLIMITED MANDATE",
    "tests/ama2-mandate-enforcement/enforcement-postgres.ts",
  );

  /* ── 4. AN OUTAGE COLLAPSES INTO AN ABSENCE ─────────────────────────────
   *
   * A fabricated absence: on a database failure the system would state that this organization had
   * declined to bound its agent. The two states must stay two.
   * ─────────────────────────────────────────────────────────────────────── */
  proof(
    "an unreachable mandate authority is reported as no mandate",
    SEAM,
    `  if (read.status === "unavailable") return "agent-mandate-authority-unavailable";`,
    `  if (read.status === "unavailable") return "no-agent-mandate";`,
    "UNAVAILABLE != NO MANDATE",
    "tests/ama2-mandate-enforcement/enforcement-postgres.ts",
  );

  /* ── 5. AN OUTAGE IS TREATED AS PERMISSION ──────────────────────────────
   *
   * Fail-OPEN. The gate stops constraining anything the moment the control plane wobbles.
   * ─────────────────────────────────────────────────────────────────────── */
  proof(
    "an unreachable mandate authority lets the proposal through",
    SEAM,
    `  if (read.status === "unavailable") return "agent-mandate-authority-unavailable";`,
    `  if (read.status === "unavailable") return null;`,
    "UNAVAILABLE != NO MANDATE",
    "tests/ama2-mandate-enforcement/enforcement-postgres.ts",
  );

  /* ── 6. AN EMPTY SCOPE ADMITS EVERYTHING ────────────────────────────────
   *
   * Withdrawal quietly inverted: `[].some(...)` is `false`, and a `||` that treats an empty ceiling
   * as "unspecified, therefore allowed" is exactly how a withdrawal becomes a no-op.
   * ─────────────────────────────────────────────────────────────────────── */
  proof(
    "an empty scope is read as an unspecified one",
    SEAM,
    `  return admitted ? null : "action-outside-agent-mandate";`,
    `  return admitted || read.mandate.proposalScope.length === 0 ? null : "action-outside-agent-mandate";`,
    "an empty ceiling admits nothing",
    "tests/ama2-mandate-enforcement/enforcement-postgres.ts",
  );

  /* ── 7. THE ALIAS MAP IS DELETED AND THE VOCABULARIES COMPARED DIRECTLY ──
   *
   * The trap this phase found: `mandate.proposalScope` holds `"send"` and `prepared.actionKind` is
   * `"send-external-communication"`. Comparing them directly refuses EVERYTHING while looking
   * perfectly fail-closed — the failure mode a test that only checked refusals would bless.
   * ─────────────────────────────────────────────────────────────────────── */
  proof(
    "the ceiling compares the alias vocabulary against the registry vocabulary",
    SEAM,
    `    (alias) => AGENT_ORIGINABLE_REGISTRY_KIND[alias] === actionKind,`,
    `    (alias) => (alias as string) === (actionKind as string),`,
    "an in-scope act proceeds through the released path",
    "tests/ama2-mandate-enforcement/enforcement-postgres.ts",
  );

  /* ── 8. THE HUMAN PATH IS PUT UNDER THE AGENT'S CEILING ─────────────────
   *
   * Agent Mandate Authority quietly becoming an organizational policy engine. A person's authority
   * to propose is not derived from what a machine was bounded to.
   * ─────────────────────────────────────────────────────────────────────── */
  proof(
    "the human writer is put under the agent ceiling",
    SEAM,
    `  return insertActionRequest(
    tenant,
    prepared,
    { actorType: "human", actorId: tenant.userId },
    deps,
  );`,
    `  void mandateCeilingRefusal;
  return insertActionRequest(
    tenant,
    prepared,
    { actorType: "human", actorId: tenant.userId },
    deps,
  );`,
    "AGENT MANDATE CONSTRAINS AGENTS, NOT HUMANS",
  );

  /* ── 9. THE CEILING IS LOOKED UP BY A CALLER-SUPPLIED ID ────────────────
   *
   * The confused deputy: bounding is checked against the acting human's id rather than the verified
   * agent's, so the agent's own mandate is never the thing consulted.
   * ─────────────────────────────────────────────────────────────────────── */
  proof(
    "the ceiling is resolved against the human id instead of the verified agent",
    SEAM,
    `await mandateCeilingRefusal(tenant, pair.actorId, prepared.actionKind, deps)`,
    `await mandateCeilingRefusal(tenant, tenant.userId, prepared.actionKind, deps)`,
    "the ceiling is looked up by the VERIFIED proposer's id",
  );

  /* ── 10. A SECOND ENFORCEMENT POINT APPEARS ─────────────────────────────
   *
   * Two gates can disagree, and the second one is always the one nobody maintains.
   * ─────────────────────────────────────────────────────────────────────── */
  proof(
    "a second module learns to consult a mandate",
    "src/features/heby-actions/action-preparer.ts",
    `export function prepareAction(`,
    `export type { EffectiveAgentMandateRead } from "@/features/agent-mandate/read-agent-mandate.server";

export function prepareAction(`,
    "does not enforce a mandate",
  );

  /* ── 11. THE CEILING GAINS THE ABILITY TO CHANGE A MANDATE ──────────────
   *
   * Enforcing a bound must never become a way to alter one. Caught at the IMPORT, before any call
   * to the writer could exist.
   * ─────────────────────────────────────────────────────────────────────── */
  proof(
    "the enforcement seam reaches the mandate writer",
    SEAM,
    `import { readEffectiveAgentMandate } from "@/features/agent-mandate/read-agent-mandate.server";`,
    `import { readEffectiveAgentMandate } from "@/features/agent-mandate/read-agent-mandate.server";
import { establishAgentMandate } from "@/features/agent-mandate/establish-agent-mandate.server";`,
    "does not import agent-mandate/establish-agent-mandate",
  );

  /* ── 12. THE CEILING WIDENS THE RELEASED VOCABULARY ─────────────────────
   *
   * A mandate may only ever SUBTRACT. A phase that admitted a new originable kind while claiming to
   * bound one would be widening what an agent may do under the name of constraining it.
   *
   * TOTALITY CATCHES IT BEFORE THE PIN DOES, and that is the better failure: a new alias with no
   * declared registry kind leaves the map incomplete, so the ceiling would silently read the new
   * kind as "outside every scope" — enforced-looking, and enforcing the wrong thing. In TypeScript
   * this is also a compile error; the assertion is what catches it in a world where someone
   * silenced the compiler.
   * ─────────────────────────────────────────────────────────────────────── */
  proof(
    "the originable vocabulary is widened by the enforcement phase",
    ORIGINATION,
    `export const AGENT_ORIGINABLE_ACTION_KINDS = ["send", "record-work"] as const;`,
    `export const AGENT_ORIGINABLE_ACTION_KINDS = ["send", "record-work", "grant-permission"] as const;`,
    "the map is TOTAL over the released originable vocabulary",
  );

  /* ── 13. THE THREE REFUSALS COLLAPSE INTO ONE ───────────────────────────
   *
   * Three different facts about the organization reported as one, which is how an outage becomes
   * indistinguishable from a deliberate withdrawal.
   * ─────────────────────────────────────────────────────────────────────── */
  proof(
    "the three fail-closed states collapse into one",
    CONTRACTS,
    `  | "no-agent-mandate"`,
    `  | "agent-mandate-authority-unavailable-duplicate"`,
    "the refusal vocabulary declares no-agent-mandate",
  );

  /* ── 14. THE LADDER CLAIMS A RUNG THIS PHASE DID NOT CLIMB ──────────────
   *
   * The phase declaring itself Heby-grounded, or permit-bearing, when nothing reads a mandate for
   * an answer and a mandate still mints nothing.
   * ─────────────────────────────────────────────────────────────────────── */
  proof(
    "the ladder claims Heby grounding",
    MANDATE_CONTRACTS,
    `    rung: "HEBY-GROUNDED",
    reached: false,`,
    `    rung: "HEBY-GROUNDED",
    reached: true,`,
    "two rungs, and the second is the one AMA-2 climbed",
  );

  console.log("ama2-mandate-enforcement/bite-proofs: OK (14/14 bite)");
}

main();
