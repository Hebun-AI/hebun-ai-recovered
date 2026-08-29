/*
 * SELF-IMPROVING-AGENTS-3 — A HYPOTHESIS IS A QUESTION, NOT A CHANGE.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "SIA-3 can propose and nothing more. It cannot mutate an agent, a prompt, a model, a tool, a
 *    permission or a policy; it cannot execute, mint a permit, read a credential, or write Memory,
 *    Learning, Knowledge or telemetry. It is not a Governance authority and cannot approve itself.
 *    It fabricates no score and claims no business outcome. It adds exactly ONE writer, ONE
 *    Governance subject, and no second observation authority. And no surface offers an Apply."
 *
 * The pins:
 *
 *   PROPOSED IMPROVEMENT ≠ IMPROVEMENT
 *   APPROVED HYPOTHESIS  ≠ APPLIED CHANGE
 *   APPLIED CHANGE       ≠ SUCCESS
 *   SELECTION VALIDITY   ≠ BUSINESS SUCCESS
 *   GOVERNANCE           ≠ EXECUTION
 *   EVALUATION           ≠ AUTHORITY
 *
 * Structural assertions run over comment-stripped source, so the phase's own honest prose about
 * what it refuses to do can never satisfy — or trip — a check about what it does.
 * Pure: no database, no network, no model.
 */
import "../../src/db/schema";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { performsDurableWrite, codeOf } from "../helpers/durable-write-detector";
import {
  EVIDENCE_FINDING_KEYS,
  EVIDENCE_MEANING,
  EVIDENCE_SOURCE,
  FORBIDDEN_HYPOTHESIS_VOCABULARY,
  HYPOTHESIS_LIMITATIONS,
  IMPROVEMENT_HYPOTHESIS_ACCEPTED_OUTCOME,
  IMPROVEMENT_HYPOTHESIS_BOUNDARY,
  IMPROVEMENT_HYPOTHESIS_DECLINED_OUTCOME,
  IMPROVEMENT_HYPOTHESIS_DOMAIN,
  IMPROVEMENT_HYPOTHESIS_SUBJECT_TYPE,
  IMPROVEMENT_HYPOTHESIS_WORDING,
  IMPROVEMENT_TARGETS,
} from "../../src/features/agent-improvement-hypothesis/contracts";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");

const FEATURE = "src/features/agent-improvement-hypothesis";
const WRITER = `${FEATURE}/write-improvement-hypothesis.server.ts`;
const DECIDER = `${FEATURE}/decide-improvement-hypothesis.server.ts`;
const READER = `${FEATURE}/read-improvement-hypotheses.server.ts`;
const CONTRACTS = `${FEATURE}/contracts.ts`;
const SCHEMA = "src/db/schema/agent-improvement-hypothesis.ts";
const SURFACE = "src/components/agents/agent-improvement-hypothesis.tsx";
const PAGE = "src/app/(dashboard)/agents/page.tsx";
const MIGRATION = "src/db/migrations/20260828190630_sia3_agent_improvement_hypothesis.sql";

function collect(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    return e.isDirectory() ? collect(rel) : /\.tsx?$/.test(e.name) ? [rel] : [];
  });
}

const featureFiles = (): string[] => collect(FEATURE);

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. EXACTLY ONE HYPOTHESIS WRITER, AND SIA-3 MUTATES NO AGENT.
 *
 * A census over all of `src/`, so a second writer added anywhere fails here rather than passing a
 * narrower check about the files this phase happened to touch.
 * ═════════════════════════════════════════════════════════════════════════ */
function exactlyOneWriter(): void {
  const writersOf = (symbol: string): string[] =>
    collect("src")
      .filter((f) =>
        new RegExp(`\\.\\s*(?:insert|update|delete)\\s*\\(\\s*${symbol}\\s*\\)`).test(codeOf(read(f))),
      )
      .sort();

  assert.deepEqual(
    writersOf("agentImprovementHypotheses"),
    [path.join(FEATURE, "write-improvement-hypothesis.server.ts")],
    "exactly ONE module writes a hypothesis",
  );

  /*
   * AND THE AGENTS TABLE STILL HAS THE SAME TWO WRITERS IT HAD BEFORE THIS PHASE. This is the
   * central firewall claim stated as a census: SIA-3 cannot change an agent because no file in it
   * writes `agents` at all.
   */
  assert.deepEqual(
    writersOf("agents"),
    [
      path.join("src", "features", "agent-identity", "create-durable-agent-identity.server.ts"),
      path.join("src", "features", "agent-identity", "retire-durable-agent-identity.server.ts"),
    ],
    "still exactly two writers of `agents` — a hypothesis mutates no agent",
  );

  /* The decider and the reader write nothing durable of their own. */
  for (const file of [DECIDER, READER, CONTRACTS, SURFACE]) {
    assert.ok(
      !performsDurableWrite(read(file)),
      `${file} performs no durable write — only the one writer does`,
    );
  }

  /*
   * THE DECIDER IN PARTICULAR WRITES NOTHING TO THE HYPOTHESIS. It holds no update statement
   * against the table at all, which is what makes "a decision cannot corrupt a historical record" a
   * property of the code rather than a promise.
   */
  const decider = codeOf(read(DECIDER));
  assert.ok(
    !/\.\s*update\s*\(\s*agentImprovementHypotheses\s*\)/.test(decider),
    "the Governance seam never updates the hypothesis row — a decision is not a column here",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. SIA-3 CANNOT MUTATE AN AGENT'S CONFIGURATION, IN ANY FORM.
 *
 * Asserted as UNREACHABLE IMPORTS rather than as unwritten calls: a module that does not import a
 * mutation authority cannot invoke one, however it is later edited.
 * ═════════════════════════════════════════════════════════════════════════ */
function noAgentMutationIsReachable(): void {
  const forbiddenImports = [
    /* Agent lifecycle and configuration. */
    "create-durable-agent-identity",
    "retire-durable-agent-identity",
    "agent-crud",
    /* Execution, permits and providers. */
    "single-spend",
    "action-execution",
    "execute-",
    "issue-permit",
    "revoke-action-permit",
    "claude-transport",
    "provider-",
    "integration-credential",
    /* Other authorities' writers. */
    "write-knowledge",
    "write-memory",
    "learning",
    "telemetry",
  ];
  for (const file of featureFiles()) {
    const source = codeOf(read(file));
    const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);
    for (const forbidden of forbiddenImports) {
      assert.ok(
        !imports.some((i) => i.includes(forbidden)),
        `${file} does not import ${forbidden} — that capability is unreachable, not merely unused`,
      );
    }
  }

  /*
   * AND THE MUTABLE AGENT COLUMNS ARE NEVER REFERENCED.
   *
   * Scoped to actual COLUMN REFERENCES — `agents.systemPrompt`, or the snake_case name in a SQL
   * string — rather than to bare substrings. A bare-substring ban failed here on the phase's own
   * honest denial: `IMPROVEMENT_HYPOTHESIS_BOUNDARY` declares `mutatesPermission: false` and
   * `mutatesPolicy: false`, which is exactly the naming this repository requires, and a guard that
   * punishes a module for stating what it refuses to do is a guard aimed at the wrong thing.
   */
  const MUTABLE_AGENT_COLUMNS = [
    "systemPrompt",
    "preferredModel",
    "toolPermissions",
    "permissions",
    "policy",
    "performanceTargets",
    "executionPosture",
  ] as const;
  for (const file of featureFiles()) {
    const source = codeOf(read(file));
    for (const column of MUTABLE_AGENT_COLUMNS) {
      assert.ok(
        !new RegExp(`\\bagents\\s*\\.\\s*${column}\\b`).test(source),
        `${file} never references \`agents.${column}\` — SIA-3 proposes about it and cannot touch it`,
      );
    }
  }

  /*
   * AND THE ONLY `agents` COLUMNS THIS FEATURE TOUCHES AT ALL ARE IDENTITY AND SCOPE.
   *
   * Enumerated, so a future edit that reaches for a configuration column fails here even if it
   * only READS it — reading a prompt is how a feature starts to have an opinion about one.
   */
  const agentColumnRefs = new Set(
    featureFiles().flatMap((f) => [
      ...codeOf(read(f)).matchAll(/\bagents\s*\.\s*([A-Za-z][A-Za-z0-9_]*)/g),
    ].map((m) => m[1]!)),
  );
  assert.deepEqual(
    [...agentColumnRefs].sort(),
    ["id", "name", "retiredAt", "tenantId"],
    "SIA-3 reads an agent's identity and tenant scope, and nothing that configures it",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. SIA-3 IS NOT A GOVERNANCE AUTHORITY, AND CANNOT APPROVE ITSELF.
 * ═════════════════════════════════════════════════════════════════════════ */
function governanceIsNotDuplicated(): void {
  /*
   * THE WRITER NEVER TOUCHES GOVERNANCE AT ALL. Filing a hypothesis resolves no authority and
   * writes no decision — so "SIA-3 cannot approve itself" is true because the module that creates a
   * hypothesis has no way to decide one.
   */
  const writer = codeOf(read(WRITER));
  for (const forbidden of [
    "governance",
    "decisionRecords",
    "decision_records",
    "resolveGovernanceAuthority",
    "writeGovernanceDecisionWithin",
  ]) {
    assert.ok(
      !writer.includes(forbidden),
      `the hypothesis writer never references ${forbidden} — it files, it never decides`,
    );
  }

  /*
   * THE DECIDER USES THE RELEASED AUTHORITY AND WRITES NO DECISION ITSELF. It must call BOTH the
   * one resolver and the one transaction-joinable writer, and must never insert into
   * `decisionRecords` directly — that would be a second Governance machine.
   */
  const decider = codeOf(read(DECIDER));
  assert.ok(
    decider.includes("resolveGovernanceAuthority"),
    "the decider resolves authority through the ONE released resolver",
  );
  assert.ok(
    decider.includes("writeGovernanceDecisionWithin"),
    "and writes through the ONE released transaction-joinable writer",
  );
  assert.ok(
    !/\.\s*insert\s*\(\s*decisionRecords\s*\)/.test(decider),
    "and never inserts a decision record itself",
  );
  assert.ok(
    !/\.\s*insert\s*\(\s*governanceSessions\s*\)/.test(decider),
    "and never opens a governance session itself",
  );

  /* No role, permission or membership answers the authority question. That is G2's rule, kept. */
  for (const shortcut of ["roles", "role_permissions", "permissions", "memberships", "authority_rank"]) {
    assert.ok(
      !decider.includes(shortcut),
      `the decider consults no ${shortcut} — authority comes from decision_records and nothing else`,
    );
  }

  /*
   * THE SUBJECT IS ONE, AND IT IS OWNED HERE. A second subject constant would be a second concept
   * wearing this phase's name.
   */
  assert.equal(IMPROVEMENT_HYPOTHESIS_SUBJECT_TYPE, "agent_improvement_hypothesis");
  assert.equal(IMPROVEMENT_HYPOTHESIS_DOMAIN, "learning");

  /*
   * AND THE LEDGER OUTCOME NEVER SAYS A CHANGE WAS MADE. This is the one string a reader will meet
   * years later with no context.
   */
  for (const outcome of [
    IMPROVEMENT_HYPOTHESIS_ACCEPTED_OUTCOME,
    IMPROVEMENT_HYPOTHESIS_DECLINED_OUTCOME,
  ]) {
    assert.ok(
      !/applied|improved|succeeded|success|fixed/i.test(outcome),
      `the ledger outcome '${outcome}' claims no application and no success`,
    );
  }
  assert.equal(IMPROVEMENT_HYPOTHESIS_ACCEPTED_OUTCOME, "improvement-hypothesis-accepted");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. NO SCORE, NO PROBABILITY, NO BUSINESS OUTCOME — ANYWHERE.
 * ═════════════════════════════════════════════════════════════════════════ */
function nothingIsFabricated(): void {
  /*
   * THE VOCABULARY BAN, APPLIED TO THE FEATURE'S OWN IDENTIFIERS. Scoped to declarations rather
   * than to raw text, so this phase's honest prose about what it refuses to claim cannot trip it —
   * the R6D lesson, kept.
   */
  for (const file of [...featureFiles(), SCHEMA, SURFACE]) {
    const source = codeOf(read(file));
    const identifiers = [...source.matchAll(/(?:readonly\s+|const\s+|let\s+)([A-Za-z_][A-Za-z0-9_]*)/g)]
      .map((m) => m[1]!.toLowerCase())
      .filter((name) => name.length > 2);
    for (const banned of FORBIDDEN_HYPOTHESIS_VOCABULARY) {
      const offender = identifiers.find((name) => name.includes(banned));
      assert.ok(
        !offender,
        `${file} declares \`${offender}\`, whose name contains the banned word '${banned}'`,
      );
    }
  }

  /*
   * AND NOTHING DIVIDES THE EVIDENCE PAIR. A numerator and a denominator that are never divided
   * cannot become a rate through an edit that merely forgets a rule.
   */
  for (const file of [...featureFiles(), SURFACE]) {
    const source = codeOf(read(file));
    assert.ok(
      !/evidenceObservedValue\s*\/|\/\s*evidenceObservedTotal/.test(source),
      `${file} never divides the observed pair — it is a measurement, never a rate`,
    );
    assert.ok(
      !/Math\.round|toFixed|%/.test(source.replace(/%s|100%|w-full/g, "")) ||
        !/evidenceObserved/.test(source),
      `${file} computes no percentage from the observed pair`,
    );
  }

  /* The boundary value says all of this as data, so a test asserts it rather than trusting prose. */
  for (const [claim, value] of Object.entries(IMPROVEMENT_HYPOTHESIS_BOUNDARY)) {
    assert.equal(value, false, `IMPROVEMENT_HYPOTHESIS_BOUNDARY.${claim} must be false`);
  }
  /* Every capability this phase must not have is NAMED, so an omission is visible. */
  for (const required of [
    "mutatesAgentConfiguration",
    "mutatesPrompt",
    "mutatesPreferredModel",
    "mutatesToolPermission",
    "mutatesPermission",
    "mutatesPolicy",
    "mutatesTenantIdentity",
    "isGovernanceAuthority",
    "approvesItself",
    "bypassesGovernance",
    "applies",
    "executes",
    "mintsPermit",
    "readsCredential",
    "isSecondObservationAuthority",
    "mutatesObservation",
    "persistsEvaluationAsAuthoritativeTruth",
    "writesMemory",
    "writesLearning",
    "writesTelemetry",
    "claimsImprovement",
    "claimsBusinessOutcome",
    "producesScore",
    "producesProbability",
    "producesConfidence",
    "learnsAutonomously",
  ]) {
    assert.ok(
      required in IMPROVEMENT_HYPOTHESIS_BOUNDARY,
      `the boundary declares ${required} rather than leaving it unstated`,
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. SIA-1 AND SIA-2 ARE READ, NEVER REWRITTEN OR RE-DERIVED.
 * ═════════════════════════════════════════════════════════════════════════ */
function noSecondObservationAuthority(): void {
  const writer = codeOf(read(WRITER));

  /*
   * THE EVIDENCE COMES FROM SIA-1'S OWN RELEASED SEAMS. If the writer queried the invocation table
   * itself it would be a SECOND observation authority, and the two could disagree about the same
   * agent on the same page.
   */
  assert.ok(
    writer.includes("readAgentSelectionFacts") && writer.includes("readAgentProposalFacts"),
    "the writer reads evidence through SIA-1's released fact seams",
  );
  assert.ok(
    !/heby_origination_invocations/.test(writer),
    "and never queries the origination table itself — SIA-1 owns that read",
  );
  assert.ok(
    !/\bsql`/.test(writer),
    "the writer authors no SQL of its own for evidence",
  );

  /*
   * AND THE CALLER CANNOT SUPPLY THE NUMBERS. There is no parameter for them, so fabricated
   * evidence is UNREPRESENTABLE rather than rejected after the fact.
   */
  const inputBlock = writer.slice(writer.indexOf("export async function fileImprovementHypothesis"));
  const signature = inputBlock.slice(0, inputBlock.indexOf("): Promise<HypothesisResult>"));
  for (const forbidden of [
    "evidenceObservedValue",
    "evidenceObservedTotal",
    "evidenceObservedAt",
    "evidenceSource",
    "proposedByActorType",
    "proposedByActorId",
    "tenantId",
  ]) {
    assert.ok(
      !signature.includes(forbidden),
      `no caller can supply \`${forbidden}\` — it is server-derived`,
    );
  }

  /* SIA-1's and SIA-2's own modules are untouched by this phase's writers. */
  for (const file of featureFiles()) {
    const source = codeOf(read(file));
    assert.ok(
      !/\.\s*(?:insert|update|delete)\s*\(\s*(?:hebyOriginationInvocations|hebyActionRequests|agents)\s*\)/.test(
        source,
      ),
      `${file} mutates no SIA-1 record — historical observation is never rewritten`,
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6. THE FIRST TARGET BOUNDARY IS CLOSED, AND CLOSED IN THE DATABASE TOO.
 * ═════════════════════════════════════════════════════════════════════════ */
function theTargetIsOneThing(): void {
  assert.deepEqual(
    [...IMPROVEMENT_TARGETS],
    ["selection-behaviour"],
    "one improvement target, and it is selection behaviour",
  );

  /*
   * THE TYPE AND THE RUNTIME ARRAY CANNOT DRIFT — found by this phase's own bite-proof.
   *
   * Widening only `ImprovementTarget` used to pass here, because every check ran against the array.
   * Nothing would have been admitted at runtime (the writer validates against the array and the
   * database CHECK refuses anyway), so it was not an exploitable hole — but it was a TYPE THAT
   * LIED, and this repository has already been bitten by a type-level claim the runtime did not
   * share. The two are now pinned to each other, so widening either alone fails.
   */
  const declaredUnion = [
    ...codeOf(read(CONTRACTS))
      .slice(
        codeOf(read(CONTRACTS)).indexOf("export type ImprovementTarget"),
        codeOf(read(CONTRACTS)).indexOf(";", codeOf(read(CONTRACTS)).indexOf("export type ImprovementTarget")),
      )
      .matchAll(/"([^"]+)"/g),
  ].map((m) => m[1]!);
  assert.deepEqual(
    declaredUnion.sort(),
    [...IMPROVEMENT_TARGETS].sort(),
    "the declared ImprovementTarget union and the runtime vocabulary are the same set",
  );

  /* The CHECK carries the same set, so the vocabulary is enforced where the rows live. */
  const migration = read(MIGRATION);
  assert.ok(
    /agent_improvement_hypotheses_target_chk[\s\S]{0,200}'selection-behaviour'/.test(migration),
    "the target vocabulary is a database CHECK, not merely a TypeScript union",
  );
  for (const forbidden of ["prompt", "model", "tool", "permission", "policy"]) {
    assert.ok(
      !new RegExp(`improvement_target[\\s\\S]{0,200}'${forbidden}'`).test(migration),
      `'${forbidden}' is not an admissible target — such a hypothesis cannot be STORED`,
    );
  }

  /*
   * AND THE MIGRATION IS ADDITIVE. One table, zero DROP, zero backfill, and it alters no released
   * table's columns.
   */
  assert.ok(!/\bDROP\b/i.test(migration), "the migration drops nothing");
  assert.ok(!/^\s*UPDATE\s/im.test(migration), "and backfills nothing");
  assert.ok(
    !/ALTER TABLE (?!"agent_improvement_hypotheses")/i.test(migration),
    "and alters no table other than the one it creates",
  );

  /* Every evidence key names a released measurement and carries both its meaning and its source. */
  assert.equal(EVIDENCE_FINDING_KEYS.length, 8);
  for (const key of EVIDENCE_FINDING_KEYS) {
    assert.ok(EVIDENCE_MEANING[key], `${key} states what it means`);
    assert.ok(EVIDENCE_SOURCE[key], `${key} names its authoritative column`);
    /*
     * AND EACH ONE SAYS WHAT IT IS NOT. `no-action` is not a failure and `dispatch-failed` is not a
     * business failure — the two readings this phase most needs a human not to make.
     */
    assert.ok(
      /\bnot\b|\bnever\b|\bNOT\b/.test(EVIDENCE_MEANING[key]),
      `${key} states what it does NOT mean, not only what it does`,
    );
  }
  assert.ok(
    /NOT a failure|not a failure/.test(EVIDENCE_MEANING["no-action"]),
    "choosing no action is explicitly not a failure",
  );
  assert.ok(
    /NOT a business failure|not a business failure/i.test(EVIDENCE_MEANING["dispatch-failed"]),
    "a transport failure is explicitly not a business failure",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 7. THE SURFACE OFFERS NO CONTROL, AND NO APPLY.
 * ═════════════════════════════════════════════════════════════════════════ */
function theSurfaceOffersNothing(): void {
  const surface = read(SURFACE);
  const code = codeOf(surface);

  assert.ok(!code.includes('"use client"'), "the surface is a server component — no client boundary");
  for (const control of ["<button", "<form", "<input", "onClick", "onSubmit", "useState", "action="]) {
    assert.ok(!code.includes(control), `the surface renders no ${control}`);
  }

  /*
   * AND NEITHER THE WRITER NOR THE DECIDER IS REACHABLE FROM IT. With nothing imported that could
   * mutate, an Apply control has nothing it could be wired to — the absence is structural.
   */
  for (const forbidden of ["fileImprovementHypothesis", "decideImprovementHypothesis"]) {
    assert.ok(!code.includes(forbidden), `the surface cannot reach ${forbidden}`);
  }

  /* No word on the surface offers to apply, retry, tune or enable anything. */
  for (const verb of ["Apply", "Retry", "Tune", "Retrain", "Enable", "Disable", "Execute"]) {
    assert.ok(
      !new RegExp(`>\\s*${verb}\\b`).test(surface),
      `the surface offers no '${verb}' affordance`,
    );
  }

  /* The page renders it and imports no SIA-3 mutation either. */
  const page = codeOf(read(PAGE));
  assert.ok(page.includes("AgentImprovementHypothesisSurface"), "the page renders the surface");
  assert.ok(page.includes("readImprovementHypotheses"), "and reaches it through the READ seam");
  for (const forbidden of ["fileImprovementHypothesis", "decideImprovementHypothesis"]) {
    assert.ok(!page.includes(forbidden), `the page cannot reach ${forbidden}`);
  }

  /*
   * ── THE ROUTE CENSUS, NARROWED TO AN ENUMERATION BY SIA-3.1 ────────────────
   *
   * This read "no route anywhere imports a SIA-3 mutation", which was true and load-bearing while
   * SIA-3 had no product write path. SIA-3.1 gave it one, so the claim that survives is not
   * "nowhere" but "exactly here, and nowhere else".
   *
   * THE REPAIR IS STRICTER THAN LOOSENING IT WOULD HAVE BEEN. Two alternatives were available and
   * both are weaker: deleting the census would let any future page expose either authority
   * silently, and excluding `actions.ts` files by name would exempt nine unrelated action modules
   * at once. Naming the two exact files means a THIRD route reaching either authority fails here,
   * and it also fails if one of these two ever reaches for the OTHER authority — which is the
   * separation SIA-3.1 exists to hold:
   *
   *   /agents                FILES a hypothesis, and cannot decide one
   *   /governance/authority  DECIDES a hypothesis, and cannot file one
   *
   * A single route holding both would put an author one click from accepting their own argument.
   */
  const EXPOSED_BY: Readonly<Record<string, string>> = {
    fileImprovementHypothesis: path.join("src", "app", "(dashboard)", "agents", "actions.ts"),
    decideImprovementHypothesis: path.join(
      "src",
      "app",
      "(dashboard)",
      "governance",
      "authority",
      "actions.ts",
    ),
  };
  const routes = collect("src/app");
  for (const [symbol, permitted] of Object.entries(EXPOSED_BY)) {
    const exposing = routes.filter((route) => codeOf(read(route)).includes(symbol)).sort();
    assert.deepEqual(
      exposing,
      [permitted],
      `exactly one route exposes ${symbol}, and it is ${permitted}`,
    );
  }

  /*
   * AND THE TRANSPORT IS TRANSPORT. Neither action file may hold an INSERT of its own — the
   * one-writer census in section 1 proves that over all of `src/`, and this is the same claim
   * stated where a reviewer of this phase will look for it.
   */
  for (const route of Object.values(EXPOSED_BY)) {
    const source = codeOf(read(route));
    assert.ok(
      !/\.\s*(?:insert|update|delete)\s*\(/.test(source),
      `${route} performs no durable write of its own — it calls the authority and returns what it said`,
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 8. THE WORDING KEEPS APPROVAL AND APPLICATION APART.
 * ═════════════════════════════════════════════════════════════════════════ */
function thewordingIsHonest(): void {
  const w = IMPROVEMENT_HYPOTHESIS_WORDING;
  /* The four sections exist and are named, because blending them is the whole failure mode. */
  for (const title of [w.evidenceTitle, w.evaluationTitle, w.hypothesisTitle, w.decisionTitle]) {
    assert.ok(title.length > 0, "each of the four sections is named");
  }
  /*
   * ASSERTED ON THE REFERENCE, NOT ON THE LITERAL. The surface renders wording through the frozen
   * contract, so the sentence appears in the component as a KEY — checking for the prose itself
   * would only prove the string had been duplicated into the markup, which is the thing this
   * indirection exists to prevent.
   */
  assert.ok(
    codeOf(read(SURFACE)).includes("approvalIsNotApplication"),
    "the surface renders the sentence that separates approval from application",
  );
  assert.ok(
    /does NOT mean the change was applied/.test(w.approvalIsNotApplication),
    "and that sentence says it in those words",
  );
  /*
   * AND IT IS RENDERED EXACTLY WHERE A READER COMPLETES THE SENTENCE THEMSELVES — inside the
   * accepted branch of the decision section, not in a footnote further down the page.
   */
  const surfaceCode = codeOf(read(SURFACE));
  const acceptedAt = surfaceCode.indexOf("decision.accepted");
  assert.ok(acceptedAt > 0, "the surface branches on acceptance");
  assert.ok(
    surfaceCode.slice(acceptedAt, acceptedAt + 400).includes("approvalIsNotApplication"),
    "and the correction sits inside the acceptance, where the misreading happens",
  );
  assert.ok(/no apply/i.test(w.noApplyControl), "the surface states it offers no apply");
  assert.ok(
    /not an improvement/i.test(w.hypothesisIsNotImprovement),
    "a hypothesis is not an improvement, said at the top",
  );
  /* An absence is never rendered as a result. */
  assert.ok(/not rejected/i.test(w.undecidedIsNotRejected));
  assert.ok(/not an empty one/i.test(w.unavailableIsNotEmpty));
  assert.ok(/never that/i.test(w.noneIsNotNothingToImprove));
  assert.ok(/does not withdraw/i.test(w.supersessionIsNotWithdrawal));

  /* The limitations are declared rather than omitted, and name application and outcome first. */
  const keys = HYPOTHESIS_LIMITATIONS.map((l) => l.key);
  for (const required of ["no-application", "no-outcome-measurement", "no-business-outcome"]) {
    assert.ok(keys.includes(required), `the surface declares the '${required}' limitation`);
  }
  assert.ok(
    read(SURFACE).includes("HYPOTHESIS_LIMITATIONS"),
    "and renders them rather than declaring them unused",
  );
}

function main(): void {
  exactlyOneWriter();
  noAgentMutationIsReachable();
  governanceIsNotDuplicated();
  nothingIsFabricated();
  noSecondObservationAuthority();
  theTargetIsOneThing();
  theSurfaceOffersNothing();
  thewordingIsHonest();
  console.log("sia3-improvement-hypothesis/hypothesis-firewall: OK");
}

main();
