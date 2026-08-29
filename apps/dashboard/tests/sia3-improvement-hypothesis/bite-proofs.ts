/*
 * SELF-IMPROVING-AGENTS-3 — DO THE GUARDS ACTUALLY BITE?
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
const FIREWALL = "tests/sia3-improvement-hypothesis/hypothesis-firewall.ts";

const FEATURE = "src/features/agent-improvement-hypothesis";
const WRITER = `${FEATURE}/write-improvement-hypothesis.server.ts`;
const DECIDER = `${FEATURE}/decide-improvement-hypothesis.server.ts`;
const CONTRACTS = `${FEATURE}/contracts.ts`;
const SURFACE = "src/components/agents/agent-improvement-hypothesis.tsx";
const MIGRATION = "src/db/migrations/20260828190630_sia3_agent_improvement_hypothesis.sql";

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

  /* ── 1. THE HYPOTHESIS WRITER ACQUIRES THE ABILITY TO MUTATE AN AGENT ──
   *
   * The single most consequential defect this phase can have: SIA-3 proposing a change AND making
   * it. Reaching for the agent writer must be caught at the import, before any call exists.
   * ────────────────────────────────────────────────────────────────────── */
  proof(
    "SIA-3 reaches for an agent mutation authority",
    WRITER,
    'import { readDurableAgentIdentityState } from "@/features/agent-identity/read-durable-agent-identity.server";',
    'import { readDurableAgentIdentityState } from "@/features/agent-identity/read-durable-agent-identity.server";\n' +
      'import { retireDurableAgentIdentity } from "@/features/agent-identity/retire-durable-agent-identity.server";',
    "does not import retire-durable-agent-identity",
  );

  /* ── 2. THE WRITER STARTS READING AN AGENT'S CONFIGURATION ─────────────
   *
   * Reading a prompt is how a feature starts to have an opinion about one. The enumerated column
   * census catches a READ, not only a write.
   * ────────────────────────────────────────────────────────────────────── */
  proof(
    "SIA-3 begins reading agent configuration",
    WRITER,
    "  const agentId = typeof input?.agentId === \"string\" ? input.agentId.trim() : \"\";",
    '  const configured = agents.systemPrompt;\n' +
      "  const agentId = typeof input?.agentId === \"string\" ? input.agentId.trim() : \"\";",
    "never references `agents.systemPrompt`",
  );

  /* ── 3. THE CALLER GETS TO SUPPLY THE EVIDENCE ─────────────────────────
   *
   * The property the whole phase rests on. With a parameter for the numbers, a hypothesis can cite
   * evidence that was never observed — and it would look identical to one that was.
   * ────────────────────────────────────────────────────────────────────── */
  proof(
    "evidence becomes a caller's claim",
    WRITER,
    "    readonly evidenceFindingKey: string;",
    "    readonly evidenceFindingKey: string;\n    readonly evidenceObservedValue?: number;",
    "no caller can supply `evidenceObservedValue`",
  );

  /* ── 4. THE WRITER BECOMES A SECOND OBSERVATION AUTHORITY ──────────────
   *
   * Querying the invocation table directly would let SIA-3 and SIA-1 disagree about the same agent
   * on the same page.
   * ────────────────────────────────────────────────────────────────────── */
  proof(
    "a second observation authority appears",
    WRITER,
    "  const [selectionRead, proposalRead] = await Promise.all([",
    '  const shadow = "select count(*) from heby_origination_invocations";\n' +
      "  const [selectionRead, proposalRead] = await Promise.all([",
    "never queries the origination table itself",
  );

  /* ── 5. THE WRITER ACQUIRES THE ABILITY TO DECIDE ──────────────────────
   *
   * "SIA-3 cannot approve itself" is true because the module that CREATES a hypothesis has no way
   * to decide one. Giving it the resolver is the first half of self-approval.
   * ────────────────────────────────────────────────────────────────────── */
  proof(
    "the filer acquires Governance authority",
    WRITER,
    'import type { TenantContext } from "@/features/auth/tenant/tenant-context";',
    'import type { TenantContext } from "@/features/auth/tenant/tenant-context";\n' +
      'import { resolveGovernanceAuthority } from "@/features/governance-decision/authority-read.server";',
    "the hypothesis writer never references governance",
  );

  /* ── 6. THE DECIDER BECOMES A SECOND GOVERNANCE MACHINE ────────────────
   *
   * Writing a decision record itself, rather than through the one released writer, is how a
   * subsystem quietly becomes a parallel Governance with its own softer rules.
   * ────────────────────────────────────────────────────────────────────── */
  proof(
    "a second Governance machine appears",
    DECIDER,
    "      const { decisionId, sessionId } = await writeGovernanceDecisionWithin(",
    "      await tx.insert(decisionRecords).values({});\n" +
      "      const { decisionId, sessionId } = await writeGovernanceDecisionWithin(",
    "performs no durable write — only the one writer does",
  );

  /* ── 7. A DECISION STAMPS ITSELF ONTO THE HYPOTHESIS ───────────────────
   *
   *   HYPOTHESIS STATUS ≠ GOVERNANCE DECISION
   *
   * A copy of a decision is a copy that can disagree with it — and writing it would also mutate a
   * historical record.
   * ────────────────────────────────────────────────────────────────────── */
  proof(
    "the decision is copied onto the hypothesis",
    DECIDER,
    "      recorded = { decisionId, sessionId };",
    "      await tx.update(agentImprovementHypotheses).set({});\n" +
      "      recorded = { decisionId, sessionId };",
    "exactly ONE module writes a hypothesis",
  );

  /* ── 8. THE AUTHORITY QUESTION GETS A SECOND ANSWER ────────────────────
   *
   * G2's rule, kept: authority comes from `decision_records` and from nothing else. A role lookup
   * here would be a permission system growing quietly beside Governance.
   * ────────────────────────────────────────────────────────────────────── */
  proof(
    "a role band starts answering the authority question",
    DECIDER,
    "  const authority = await resolveGovernanceAuthority(tenant, deps);",
    '  const band = "authority_rank";\n' +
      "  const authority = await resolveGovernanceAuthority(tenant, deps);",
    "the decider consults no authority_rank",
  );

  /* ── 9. THE TARGET BOUNDARY OPENS TO A PROMPT MUTATION ─────────────────
   *
   * The first target boundary is one value. Admitting `prompt` would let SIA-3 propose editing an
   * agent's prompt — the exact expansion this phase is scoped to refuse.
   * ────────────────────────────────────────────────────────────────────── */
  proof(
    "the target vocabulary admits a prompt change",
    CONTRACTS,
    'export type ImprovementTarget = "selection-behaviour";',
    'export type ImprovementTarget = "selection-behaviour" | "prompt";',
    "the declared ImprovementTarget union and the runtime vocabulary are the same set",
  );

  /* ── 10. THE LEDGER OUTCOME CLAIMS AN APPLICATION ──────────────────────
   *
   *   APPROVED HYPOTHESIS ≠ APPLIED CHANGE
   *
   * This is the one string a reader meets years later with no context.
   * ────────────────────────────────────────────────────────────────────── */
  proof(
    "the ledger says the change was applied",
    CONTRACTS,
    'export const IMPROVEMENT_HYPOTHESIS_ACCEPTED_OUTCOME = "improvement-hypothesis-accepted" as const;',
    'export const IMPROVEMENT_HYPOTHESIS_ACCEPTED_OUTCOME = "improvement-applied" as const;',
    "claims no application and no success",
  );

  /* ── 11. A SUCCESS PROBABILITY IS FABRICATED ───────────────────────────
   *
   * Hebun holds no record a forecast could be drawn from, so a number here would be invented and
   * would read as a measurement.
   * ────────────────────────────────────────────────────────────────────── */
  proof(
    "a probability is fabricated",
    CONTRACTS,
    "export interface HypothesisLimitation {",
    "export interface HypothesisLimitation {\n  readonly successProbability?: number;",
    "whose name contains the banned word",
  );

  /* ── 12. THE SURFACE GROWS AN APPLY CONTROL ────────────────────────────
   *
   * The absence is structural — no client boundary, nothing imported that could mutate. A button
   * is the visible half of that guarantee.
   * ────────────────────────────────────────────────────────────────────── */
  proof(
    "the surface offers an Apply",
    SURFACE,
    "export function AgentImprovementHypothesisSurface({",
    "export function ApplyControl() {\n  return <button>Apply</button>;\n}\n\n" +
      "export function AgentImprovementHypothesisSurface({",
    "the surface renders no <button",
  );

  /* ── 13. THE SURFACE STOPS SAYING APPROVAL IS NOT APPLICATION ──────────
   *
   * Removing the sentence from the accepted branch is exactly where the misreading happens, and it
   * would look like a harmless tidy-up in a diff.
   * ────────────────────────────────────────────────────────────────────── */
  proof(
    "the acceptance stops correcting itself",
    SURFACE,
    "{IMPROVEMENT_HYPOTHESIS_WORDING.approvalIsNotApplication}",
    "{IMPROVEMENT_HYPOTHESIS_WORDING.decisionCaption}",
    "the surface renders the sentence that separates approval from application",
  );

  /* ── 14. THE MIGRATION ACQUIRES AN APPLICATION COLUMN ──────────────────
   *
   * `applied_at` is a fact SIA-3 cannot prove. A nullable column nobody writes is indistinguishable
   * from one somebody forgot to write — so it must not exist at all.
   * ────────────────────────────────────────────────────────────────────── */
  proof(
    "the schema grows an application column",
    MIGRATION,
    'ALTER TABLE "agent_improvement_hypotheses" ADD CONSTRAINT "agent_improvement_hypotheses_tenant_id_companies_id_fk"',
    'ALTER TABLE "agents" ADD COLUMN "applied_at" timestamp;--> statement-breakpoint\n' +
      'ALTER TABLE "agent_improvement_hypotheses" ADD CONSTRAINT "agent_improvement_hypotheses_tenant_id_companies_id_fk"',
    "alters no table other than the one it creates",
  );

  /* ── 15. AN EVIDENCE KEY STOPS SAYING WHAT IT IS NOT ───────────────────
   *
   * "Choosing no action is not a failure" is the sentence that stops a hypothesis being built on a
   * misreading of correct behaviour.
   * ────────────────────────────────────────────────────────────────────── */
  proof(
    "an evidence key drops its non-claim",
    CONTRACTS,
    '"no-action":\n    "The model declined to select an action. Choosing nothing is NOT a failure; declining to act " +\n' +
      '    "can be the correct answer, and a hypothesis here must argue why this case was not.",',
    '"no-action": "The model declined to select an action.",',
    "no-action states what it does NOT mean, not only what it does",
  );

  console.log("sia3-improvement-hypothesis/bite-proofs: OK");
}

main();
