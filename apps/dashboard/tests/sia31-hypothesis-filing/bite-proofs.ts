/*
 * SELF-IMPROVING-AGENTS-3.1 — DO THE FILING GUARDS ACTUALLY BITE?
 *
 * Each mutation re-introduces exactly the defect one guard exists to catch, runs the SIA-3.1
 * firewall in a CHILD PROCESS, and requires it to fail FOR THE STATED REASON. A mutation that did
 * not APPLY looks exactly like a guard that did not bite, so every mutation asserts the source
 * changed first; a child killed by a timeout also exits non-zero, so the run is bounded and the
 * status is checked.
 *
 * Every mutation is restored in `finally` and the restore is verified byte-for-byte.
 *
 * NOTE FOR ANY RELEASE: this suite mutates real sources while it runs. Never commit while it is
 * running, and never run it concurrently with another suite. If it is terminated abnormally the
 * `finally` never runs — check `git status` on `src/` before believing any subsequent result.
 */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const FIREWALL = "tests/sia31-hypothesis-filing/filing-firewall.ts";
/* The SIA-3 firewall too: SIA-3.1 amended its route census, so both must keep biting. */
const SIA3_FIREWALL = "tests/sia3-improvement-hypothesis/hypothesis-firewall.ts";

const FEATURE = "src/features/agent-improvement-hypothesis";
const WORDING = `${FEATURE}/filing-wording.ts`;
const FILING_ACTION = "src/app/(dashboard)/agents/actions.ts";
const DECISION_ACTION = "src/app/(dashboard)/governance/authority/actions.ts";
const FILING_CONTROL = "src/components/agents/agent-improvement-hypothesis-filing.tsx";
const DECISION_CONTROL = "src/components/governance-authority/undecided-hypothesis-card.tsx";
const SIA3_READ_SURFACE = "src/components/agents/agent-improvement-hypothesis.tsx";
const GOVERNANCE_PAGE = "src/app/(dashboard)/governance/authority/page.tsx";

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

function proofAgainst(
  suite: string,
  label: string,
  file: string,
  from: string,
  to: string,
  expected: string,
): void {
  const original = read(file);
  const mutated = original.replace(from, to);
  assert.notEqual(mutated, original, `${label}: the mutation did not APPLY to ${file}`);
  try {
    writeFileSync(abs(file), mutated, "utf8");
    const { ok, output, detail } = runSuite(suite);
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

const proof = (label: string, file: string, from: string, to: string, expected: string): void =>
  proofAgainst(FIREWALL, label, file, from, to, expected);

function main(): void {
  for (const suite of [FIREWALL, SIA3_FIREWALL]) {
    const baseline = runSuite(suite);
    assert.ok(baseline.ok, `baseline: ${suite} must pass before any mutation (${baseline.detail})`);
  }

  /* ── 1. THE FILING SEAM ACQUIRES THE ABILITY TO DECIDE ──────────────────
   *
   * The most consequential defect this phase can have, and the whole reason the two acts live on
   * two surfaces: an author one click from accepting their own argument.
   */
  proof(
    "M1 the filing action reaches the decider",
    FILING_ACTION,
    `import { fileImprovementHypothesis } from "@/features/agent-improvement-hypothesis/write-improvement-hypothesis.server";`,
    `import { fileImprovementHypothesis } from "@/features/agent-improvement-hypothesis/write-improvement-hypothesis.server";\nimport { decideImprovementHypothesis } from "@/features/agent-improvement-hypothesis/decide-improvement-hypothesis.server";`,
    "the filing seam cannot decide",
  );

  /* ── 2. THE DECISION SEAM ACQUIRES THE ABILITY TO FILE ──────────────────
   *
   * The same collapse from the other direction: an authority authoring what it decides.
   */
  proof(
    "M2 the decision action reaches the writer",
    DECISION_ACTION,
    `import { decideImprovementHypothesis } from "@/features/agent-improvement-hypothesis/decide-improvement-hypothesis.server";`,
    `import { decideImprovementHypothesis } from "@/features/agent-improvement-hypothesis/decide-improvement-hypothesis.server";\nimport { fileImprovementHypothesis } from "@/features/agent-improvement-hypothesis/write-improvement-hypothesis.server";`,
    "the decision seam cannot file",
  );

  /* ── 3. THE CLIENT GAINS A PARAMETER FOR THE TENANT ─────────────────────
   *
   * The single field that would turn a lookup key into an authority. It must be unrepresentable,
   * not filtered.
   */
  proof(
    "M3 the filing action accepts a tenant id",
    FILING_ACTION,
    `  readonly agentId: string;\n  readonly improvementTarget: string;`,
    `  readonly agentId: string;\n  readonly tenantId: string;\n  readonly improvementTarget: string;`,
    "has no `tenantId` parameter",
  );

  /* ── 4. THE CLIENT GAINS A PARAMETER FOR THE EVIDENCE ───────────────────
   *
   * Fabricated evidence must stay unrepresentable. A count the caller can name is a count the
   * caller can invent.
   */
  proof(
    "M4 the filing action accepts an evidence count",
    FILING_ACTION,
    `  readonly limitations: string;\n  readonly supersedesHypothesisId?: string | null;`,
    `  readonly limitations: string;\n  readonly evidenceObservedValue: number;\n  readonly supersedesHypothesisId?: string | null;`,
    "has no `evidenceObservedValue` parameter",
  );

  /* ── 5. THE CLIENT GAINS A PARAMETER FOR THE AUTHOR ─────────────────────
   *
   * Impersonating another human. The writer stamps the session's user and the database CHECK
   * enforces `human`; this proves the transport offers no way around either.
   */
  proof(
    "M5 the filing action accepts an author id",
    FILING_ACTION,
    `  readonly candidateChange: string;`,
    `  readonly proposedByActorId: string;\n  readonly candidateChange: string;`,
    "has no `proposedByActorId` parameter",
  );

  /* ── 6. THE TRANSPORT BECOMES AN AUTHORITY ──────────────────────────────
   *
   * A transport that can reach the database can eventually query around the authority it fronts.
   */
  proof(
    "M6 the filing action imports the database client",
    FILING_ACTION,
    `import { revalidatePath } from "next/cache";`,
    `import { revalidatePath } from "next/cache";\nimport { getControlPlaneDb } from "@/db/client.server";`,
    "does not import db/client.server",
  );

  /* ── 7. THE TRANSPORT STOPS RESOLVING THE TENANT FROM THE SESSION ───────
   *
   * Minting a context instead of resolving one is how a transport starts choosing organizations.
   */
  proof(
    "M7 the filing action mints a tenant context",
    FILING_ACTION,
    `import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";`,
    `import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";\nimport { asHumanTenantContext } from "@/features/auth/tenant/tenant-context";`,
    "cannot mint a tenant context",
  );

  /* ── 8. THE FILING SEAM ACQUIRES GOVERNANCE ─────────────────────────────
   *
   * Filing that wrote a decision would make FILED ≠ APPROVED false in one edit.
   */
  proof(
    "M8 the filing action reaches Governance",
    FILING_ACTION,
    `import { revalidatePath } from "next/cache";`,
    `import { revalidatePath } from "next/cache";\nimport { resolveGovernanceAuthority } from "@/features/governance-decision/authority-read.server";`,
    /*
     * THE PATH IS WHAT FIRES, NOT THE SYMBOL — and that is the stronger of the two checks, so the
     * expectation names it. `governance-decision` appears in the import specifier, so the ban trips
     * before the symbol ban has anything to look at. A Governance module cannot be reached under a
     * different symbol name either, which a symbol-only guard would have allowed.
     */
    "the filing seam does not reach governance-decision",
  );

  /* ── 9. A THIRD ROUTE EXPOSES THE WRITER ────────────────────────────────
   *
   * The census, tested. This is the guard that replaced SIA-3's "no route anywhere", and it is
   * only stricter if a THIRD route actually fails — so the mutation is made in a route neither
   * census names, and as real code rather than a comment. (The first attempt put the symbol in a
   * comment and the firewall passed, correctly: both censuses read comment-stripped source, so a
   * mention in prose is not an exposure. A bite-proof that mutates only a comment proves nothing.)
   */
  const THIRD_ROUTE = "src/app/(dashboard)/approvals/actions.ts";
  proof(
    "M9 a third route exposes the writer",
    THIRD_ROUTE,
    `import { revalidatePath } from "next/cache";`,
    `import { revalidatePath } from "next/cache";\nimport { fileImprovementHypothesis } from "@/features/agent-improvement-hypothesis/write-improvement-hypothesis.server";`,
    "exactly one route can file a hypothesis",
  );

  /*
   * AND THE SAME MUTATION MUST FAIL SIA-3'S OWN AMENDED CENSUS. If only one of the two noticed,
   * the amendment would have MOVED the guard rather than kept it.
   */
  proofAgainst(
    SIA3_FIREWALL,
    "M9b and SIA-3's amended census catches it too",
    THIRD_ROUTE,
    `import { revalidatePath } from "next/cache";`,
    `import { revalidatePath } from "next/cache";\nimport { fileImprovementHypothesis } from "@/features/agent-improvement-hypothesis/write-improvement-hypothesis.server";`,
    "exactly one route exposes fileImprovementHypothesis",
  );

  /* And the same for the decider, from the other direction. */
  proofAgainst(
    SIA3_FIREWALL,
    "M9c a third route exposes the decider",
    THIRD_ROUTE,
    `import { revalidatePath } from "next/cache";`,
    `import { revalidatePath } from "next/cache";\nimport { decideImprovementHypothesis } from "@/features/agent-improvement-hypothesis/decide-improvement-hypothesis.server";`,
    "exactly one route exposes decideImprovementHypothesis",
  );

  /* ── 10. THE SIA-3 READ SURFACE ACQUIRES A CONTROL ──────────────────────
   *
   * SIA-3.1 deliberately did not touch it. Its zero-control proof must still bite.
   */
  proof(
    "M10 the SIA-3 read surface gains a client boundary",
    SIA3_READ_SURFACE,
    `import {\n  EVIDENCE_MEANING,`,
    `"use client";\nimport {\n  EVIDENCE_MEANING,`,
    "the SIA-3 read surface is still a server component",
  );

  /* ── 11. A CONTROL OFFERS TO APPLY THE CHANGE ───────────────────────────
   *
   * The defect this entire lineage exists to prevent, on the surface where it would look most
   * natural — the one that accepts the proposal.
   */
  proof(
    "M11 the decision control offers an Apply",
    DECISION_CONTROL,
    `{W.declineControl}`,
    `Apply</Button><Button>{W.declineControl}`,
    "offers no 'Apply' affordance",
  );

  /* ── 12. THE ACCEPT CONTROL IS REWORDED AS AN APPROVAL ──────────────────
   *
   * "Approve" is the word a reader finishes for themselves as "so it was done".
   */
  proof(
    "M12 the accept control is reworded 'Approve'",
    WORDING,
    `acceptControl: "Accept as worth pursuing",`,
    `acceptControl: "Approve",`,
    "the accept control is not worded 'Approve'",
  );

  /* ── 13. A CLIENT BOUND DRIFTS FROM THE AUTHORITY'S ─────────────────────
   *
   * A form that promises a length the writer refuses. The two are pinned to each other.
   */
  proof(
    "M13 the client prose bound is widened alone",
    WORDING,
    `export const FILING_MAX_CANDIDATE_CHANGE = 2_000;`,
    `export const FILING_MAX_CANDIDATE_CHANGE = 8_000;`,
    "candidate-change bound",
  );

  /* ── 14. A REFUSAL LOSES ITS SENTENCE ───────────────────────────────────
   *
   * A refusal a reader cannot distinguish from a silent success. The map is exhaustive against the
   * authority's own union, so deleting an entry fails.
   */
  proof(
    "M14 a refusal loses its explanation",
    WORDING,
    `  "no-evidence-yet":`,
    `  "no-evidence-yet-renamed":`,
    "the filing refusal 'no-evidence-yet' has a sentence a reader can act on",
  );

  /* ── 15. A REFUSAL STOPS SAYING NOTHING WAS WRITTEN ─────────────────────
   *
   * Naming a cause without naming the effect leaves the reader to guess whether a partial write
   * occurred.
   */
  proof(
    "M15 a refusal stops saying nothing was written",
    WORDING,
    `  "agent-unresolvable":\n    "No such durable agent exists in this organization. Nothing was written.",`,
    `  "agent-unresolvable":\n    "No such durable agent exists in this organization.",`,
    "states that nothing was written",
  );

  /* ── 16. THE DECISION CONTROL LOSES ITS AUTHORITY GATE ──────────────────
   *
   * A control offered to every reader, every use of which would be refused — a false affordance,
   * and the shape in which a surface starts implying an authority nobody holds.
   */
  proof(
    "M16 the decision control is offered to everyone",
    GOVERNANCE_PAGE,
    `      {authority?.viewerIsGovernanceAuthority ? (\n        <div className="min-w-0 max-w-2xl">\n          <UndecidedHypothesisCard`,
    `      {true ? (\n        <div className="min-w-0 max-w-2xl">\n          <UndecidedHypothesisCard`,
    "offered only to this tenant's Governance authority",
  );

  /* ── 17. AN UNREADABLE LIST IS RENDERED AS AN EMPTY ONE ─────────────────
   *
   * "Hebun could not look" and "Hebun looked and found none" are different facts. This lineage has
   * repaired that collapse repeatedly.
   */
  proof(
    "M17 an unreadable hypothesis list reads as none awaiting",
    GOVERNANCE_PAGE,
    `            unavailable={hypotheses.status !== "read"}`,
    `            unavailable={false}`,
    "reported as unavailable, never as none awaiting a decision",
  );

  /* ── 18. THE GOVERNANCE PAGE BECOMES A SECOND READER ────────────────────
   *
   * A second projection can disagree with the one /agents renders.
   */
  proof(
    "M18 the Governance page queries hypotheses itself",
    GOVERNANCE_PAGE,
    `import { readImprovementHypotheses } from "@/features/agent-improvement-hypothesis/read-improvement-hypotheses.server";`,
    `import { readImprovementHypotheses } from "@/features/agent-improvement-hypothesis/read-improvement-hypotheses.server";\nimport { agentImprovementHypotheses } from "@/db/schema/agent-improvement-hypothesis";`,
    "does not query hypotheses itself",
  );

  /* ── 19. THE FILING CONTROL OFFERS A PROMPT TARGET ──────────────────────
   *
   * The target vocabulary is closed at one entry BECAUSE prompt, model, tools, permissions and
   * policy are mutations with their own owners. A control offering one implies it exists.
   */
  proof(
    "M19 the filing control offers a prompt target",
    FILING_CONTROL,
    `        improvementTarget: IMPROVEMENT_TARGETS[0] ?? "",`,
    `        improvementTarget: "prompt",`,
    "the control sends the contract's target rather than a string of its own",
  );

  /* ── 20. THE FILING CONTROL DROPS ITS NON-CLAIM ─────────────────────────
   *
   * The sentence that separates filing from improving is the entire shape of the phase, and it is
   * rendered BEFORE the button rather than after it.
   */
  proof(
    "M20 the filing control stops saying it changes no agent",
    FILING_CONTROL,
    `{W.filingIsNotImproving}`,
    `{W.regionSummary}`,
    "renders the sentence that separates filing from improving",
  );

  /* ── 21. THE FILING SEAM ACQUIRES AN AGENT WRITER ───────────────────────
   *
   * Filing that could also change the agent would collapse HYPOTHESIS ≠ CHANGE in one edit.
   */
  proof(
    "M21 the filing control reaches an agent writer",
    FILING_CONTROL,
    `import { fileImprovementHypothesisAction } from "@/app/(dashboard)/agents/actions";`,
    `import { fileImprovementHypothesisAction } from "@/app/(dashboard)/agents/actions";\nimport { createDurableAgentIdentity } from "@/features/agent-identity/create-durable-agent-identity.server";`,
    "does not import create-durable-agent-identity",
  );

  /* ── 22. THE TRANSPORT WRITES A ROW OF ITS OWN ──────────────────────────
   *
   * The one-writer census is SIA-3's; this proves the transport cannot become a second writer.
   */
  proof(
    "M22 the filing action inserts a row itself",
    FILING_ACTION,
    `  if (result.status === "filed") revalidatePath("/agents");`,
    `  await Promise.resolve().then(() => ({}).insert(null));\n  if (result.status === "filed") revalidatePath("/agents");`,
    "contains no INSERT, UPDATE or DELETE of its own",
  );

  console.log("sia31-hypothesis-filing/bite-proofs: OK");
}

main();
