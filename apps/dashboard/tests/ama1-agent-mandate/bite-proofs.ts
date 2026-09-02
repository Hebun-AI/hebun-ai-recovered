/*
 * AMA-1 — DO THE GUARDS ACTUALLY BITE?
 *
 * Each mutation re-introduces exactly the defect one guard exists to catch, runs the firewall in a
 * CHILD PROCESS, and requires it to fail FOR THE STATED REASON. A mutation that did not APPLY looks
 * exactly like a guard that did not bite, so every mutation asserts the source changed first; a
 * child killed by a timeout also exits non-zero, so the run is bounded and the status is checked.
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
const FIREWALL = "tests/ama1-agent-mandate/mandate-firewall.ts";

const FEATURE = "src/features/agent-mandate";
const WRITER = `${FEATURE}/establish-agent-mandate.server.ts`;
const READER = `${FEATURE}/read-agent-mandate.server.ts`;
const CONTRACTS = `${FEATURE}/contracts.ts`;
const BARREL = `${FEATURE}/index.ts`;
const SCHEMA = "src/db/schema/agent-mandate.ts";
const ORIGINATION = "src/features/agent-origination/contracts.ts";

const abs = (p: string): string => path.join(ROOT, p);
const read = (p: string): string => readFileSync(abs(p), "utf8");
const CHILD_TIMEOUT_MS = 120_000;

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

function proof(label: string, file: string, from: string, to: string, expected: string): void {
  const original = read(file);
  const mutated = original.replace(from, to);
  assert.notEqual(mutated, original, `${label}: the mutation did not APPLY to ${file}`);
  try {
    writeFileSync(abs(file), mutated, "utf8");
    const { ok, output, detail } = runSuite(FIREWALL);
    assert.ok(!ok, `${label}: the firewall PASSED with the defect present (${detail})`);
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
  const baseline = runSuite(FIREWALL);
  assert.ok(baseline.ok, `baseline: the firewall must pass before any mutation (${baseline.detail})`);

  /* ── 1. THE MANDATE WRITER ACQUIRES THE ABILITY TO MUTATE AN AGENT ─────
   *
   * The single most consequential defect this phase can have: the mandate authority bounding an
   * agent AND changing it. Reaching for the agent writer must be caught at the import, before any
   * call exists.
   * ────────────────────────────────────────────────────────────────────── */
  proof(
    "the mandate writer reaches for an agent mutation authority",
    WRITER,
    'import { RETIRED_AGENT_LIFECYCLE_STATUS } from "@/features/agent-identity/retirement-contracts";',
    'import { RETIRED_AGENT_LIFECYCLE_STATUS } from "@/features/agent-identity/retirement-contracts";\n' +
      'import { retireDurableAgentIdentity } from "@/features/agent-identity/retire-durable-agent-identity.server";',
    "does not import retire-durable-agent-identity",
  );

  /* ── 2. THE MANDATE IS WRITTEN INTO `agents.authority_ceiling` ─────────
   *
   * The hazard the boundary discovery found and named. That column has no writer and DOES have a
   * reader — `canonical-read/actor-resolution.ts` summarizes it — so filling it publishes a
   * CONSTRAINT as an AUTHORITY through canonical actor resolution, with nothing else failing.
   * ────────────────────────────────────────────────────────────────────── */
  proof(
    "a mandate is written into the agent's authority ceiling",
    WRITER,
    "      lifecycle: agents.agentLifecycleStatus,",
    "      lifecycle: agents.agentLifecycleStatus,\n      ceiling: agents.authorityCeiling,",
    "never names authority_ceiling",
  );

  /* ── 3. THE FEATURE STARTS READING AN AGENT'S CONFIGURATION ────────────
   *
   * Reading a tool profile is how a feature starts to have an opinion about one. The enumerated
   * column census catches a READ, not only a write.
   * ────────────────────────────────────────────────────────────────────── */
  proof(
    "the mandate authority begins reading agent configuration",
    WRITER,
    "      retiredAt: agents.retiredAt,",
    "      retiredAt: agents.retiredAt,\n      tools: agents.allowedTools,",
    "reads an agent's identity and whether it is in service",
  );

  /* ── 4. THE CEILING BECOMES WIDER THAN THE RELEASED VOCABULARY ─────────
   *
   * The invariant of the whole program: a mandate may only SUBTRACT. A vocabulary of its own —
   * even one that happens to be a superset today — is the first step to a mandate that grants.
   * ────────────────────────────────────────────────────────────────────── */
  proof(
    "the mandate vocabulary stops being the released origination vocabulary",
    CONTRACTS,
    "export const MANDATE_SCOPE_VOCABULARY: readonly AgentOriginableActionKind[] =\n  AGENT_ORIGINABLE_ACTION_KINDS;",
    "export const MANDATE_SCOPE_VOCABULARY: readonly AgentOriginableActionKind[] = [\n" +
      "  ...AGENT_ORIGINABLE_ACTION_KINDS,\n];",
    "the same reference, not a copy",
  );

  /* ── 5. AN INADMISSIBLE SCOPE IS SILENTLY NARROWED INSTEAD OF REFUSED ──
   *
   * Dropping the inadmissible member and continuing records a mandate NOBODY AUTHORIZED — narrower
   * than what the human typed, and therefore a different mandate, stored under their name.
   * ────────────────────────────────────────────────────────────────────── */
  proof(
    "an inadmissible scope is quietly narrowed rather than refused whole",
    CONTRACTS,
    "  if (!value.every(isMandateScopeKind)) return null;",
    "  void isMandateScopeKind;",
    "refused WHOLE by canonicaliseMandateScope",
  );

  /* ── 6. THE STORAGE-LAYER CHECK DRIFTS FROM THE RELEASED VOCABULARY ────
   *
   * The CHECK cannot import TypeScript, so the two lists are pinned equal by a test. If that pin
   * did not bite, a widened CHECK would admit a kind the origination path never offered.
   * ────────────────────────────────────────────────────────────────────── */
  proof(
    "the storage-layer ceiling admits a kind the released vocabulary does not",
    SCHEMA,
    "const ORIGINABLE_ACTION_KINDS_SQL = sql`array['send','record-work']::text[]`;",
    "const ORIGINABLE_ACTION_KINDS_SQL = sql`array['send','record-work','grant-permission']::text[]`;",
    "admits exactly the released originable kinds",
  );

  /* ── 7. GOVERNANCE ACQUIRES A MANDATE-STATE WRITER ─────────────────────
   *
   * The load-bearing boundary of the program. If a Governance module can write `agent_mandates`,
   * "what this agent is for" becomes a Governance-derived fact — the exact collapse the boundary
   * discovery rejected architecture A for.
   * ────────────────────────────────────────────────────────────────────── */
  proof(
    "Governance acquires the mandate table",
    "src/features/governance-decision/decision-authority.server.ts",
    'import { decisionRecords, governanceSessions } from "@/db/schema/governance";',
    'import { decisionRecords, governanceSessions } from "@/db/schema/governance";\n' +
      'import { agentMandates } from "@/db/schema/agent-mandate";',
    "never names the mandate table",
  );

  /* ── 8. THE READ SEAM ACQUIRES A MUTATION ──────────────────────────────
   *
   * "Read-only in a way that can be proved" means the verbs are ABSENT, not merely uncalled.
   * ────────────────────────────────────────────────────────────────────── */
  proof(
    "the read seam acquires a mutation verb",
    READER,
    "    const rows = await db\n      .select(SELECTION)",
    "    await db.transaction(async () => undefined);\n    const rows = await db\n      .select(SELECTION)",
    "it is read-only in a way that can be proved",
  );

  /* ── 9. A PROPOSAL PATH STARTS READING A MANDATE ───────────────────────
   *
   * The AMA-1 truth requirement. A mandate exists and NOTHING constrains a proposal with it. The
   * day that changes it is AMA-2, and it must not happen by accident inside AMA-1.
   * ────────────────────────────────────────────────────────────────────── */
  proof(
    "the origination path begins enforcing a mandate",
    ORIGINATION,
    "export const AGENT_ORIGINABLE_ACTION_KINDS = [\"send\", \"record-work\"] as const;",
    'import type { MandateScopeKind } from "@/features/agent-mandate/contracts";\n' +
      "export type UnusedMandateBinding = MandateScopeKind;\n" +
      "export const AGENT_ORIGINABLE_ACTION_KINDS = [\"send\", \"record-work\"] as const;",
    "know a mandate exists",
  );

  /* ── 10. THE RELEASED ORIGINABLE VOCABULARY IS QUIETLY CHANGED ─────────
   *
   * AMA-1 must leave what an agent may propose exactly as it found it. Moving that constant into a
   * record is AMA-2's work, and narrowing it here would be enforcement smuggled in as a default.
   * ────────────────────────────────────────────────────────────────────── */
  proof(
    "AMA-1 quietly changes what an agent may originate",
    ORIGINATION,
    "export const AGENT_ORIGINABLE_ACTION_KINDS = [\"send\", \"record-work\"] as const;",
    "export const AGENT_ORIGINABLE_ACTION_KINDS = [] as const;",
    "the released originable vocabulary is what the origination feature says it is",
  );

  /* ── 11. A SECOND TRANSITION APPEARS ON THE BARREL ─────────────────────
   *
   * One authority, one transition. An `enforce` or `allows` export is the surface AMA-2 would add,
   * and its absence is what makes "AMA-1 is not proposal enforcement" a fact about the code.
   * ────────────────────────────────────────────────────────────────────── */
  proof(
    "an enforcement surface appears on the barrel",
    BARREL,
    "export {\n  establishAgentMandate,",
    "export const mandateAllows = (): boolean => true;\nexport {\n  establishAgentMandate,",
    "the barrel exports no mandateAllows",
  );

  /* ── 12. THE TABLE ACQUIRES A STATUS COLUMN ────────────────────────────
   *
   * A status column is a second copy of a Governance decision, free to disagree with the ledger.
   * SIA-3 established the rule; this proves AMA-1 is held to it.
   * ────────────────────────────────────────────────────────────────────── */
  proof(
    "the mandate table acquires a status column",
    SCHEMA,
    "    mandateRevision: integer(\"mandate_revision\").notNull(),",
    "    status: text(\"status\").notNull(),\n    mandateRevision: integer(\"mandate_revision\").notNull(),",
    "declares no `status`",
  );

  console.log("ama1-agent-mandate/bite-proofs: OK");
}

main();
