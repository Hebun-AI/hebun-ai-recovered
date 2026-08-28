/*
 * SELF-IMPROVING-AGENTS-2 — THE EVALUATION HOLDS NO AUTHORITY, AND GRADES NOTHING.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "Agent Evaluation can INTERPRET what SIA-1 observed and can CAUSE nothing. Its whole import
 *    closure performs no durable write, opens no socket, reaches no model and touches no
 *    credential. It cannot create or retire an agent, propose, decide, permit, execute, or mutate
 *    an agent's prompt, model, tools or targets. It writes no telemetry, no learning session and
 *    no improvement proposal, and it revives none of the dead evaluation scaffolding. It is a
 *    SECOND READER of SIA-1, never a second observation authority: it issues no statement of its
 *    own. It produces no score and no percentage — there is no representation in which either
 *    could be expressed. Its surface is a server component with no control."
 *
 * Structural assertions run over comment-stripped source: they are about what the code can reach,
 * not about what its prose promises.
 *
 * Pure. No database, no network, no model.
 */
// Loaded FIRST: the schema barrel is the only safe entry point for src/db/schema/*, which the
// projection reaches transitively through SIA-1.
import "../../src/db/schema";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { performsDurableWrite, codeOf } from "../helpers/durable-write-detector";
import {
  AGENT_EVALUATION_BOUNDARY,
  AGENT_EVALUATION_WORDING,
  EVALUATION_NON_CLAIMS,
  FORBIDDEN_EVALUATION_VOCABULARY,
  UNAVAILABLE_DIMENSIONS,
  shareAvailability,
} from "../../src/features/agent-evaluation/contracts";
import {
  deriveAgentEvaluation,
  deriveAgentEvaluationRead,
  readAgentEvaluation,
} from "../../src/features/agent-evaluation/agent-evaluation-projection.server";
import type { AgentOutcomeObservation } from "../../src/features/agent-outcome-observation/agent-outcome-projection.server";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");

const FEATURE_DIR = "src/features/agent-evaluation";
const CONTRACTS = `${FEATURE_DIR}/contracts.ts`;
const PROJECTION = `${FEATURE_DIR}/agent-evaluation-projection.server.ts`;
const SURFACE = "src/components/agents/agent-evaluation.tsx";
const ROUTE = "src/app/(dashboard)/agents/page.tsx";
const SIA1_PROJECTION =
  "src/features/agent-outcome-observation/agent-outcome-projection.server.ts";

/** Table definitions are imported wholesale by the drizzle client — see SIA-1's firewall header. */
const isTableDefinition = (file: string): boolean =>
  file.startsWith(path.join("src", "db", "schema"));

function resolveImport(spec: string, from: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = path.join("src", spec.slice(2));
  else if (spec.startsWith(".")) base = path.normalize(path.join(path.dirname(from), spec));
  else return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
    const absolute = path.join(ROOT, candidate);
    if (existsSync(absolute) && statSync(absolute).isFile()) return candidate;
  }
  return null;
}

function closure(entry: string): Set<string> {
  const seen = new Set<string>([entry]);
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.shift()!;
    let source: string;
    try {
      source = codeOf(read(file));
    } catch {
      continue;
    }
    for (const match of source.matchAll(/(?:import|export)[\s\S]*?from\s*["']([^"']+)["']/g)) {
      const resolved = resolveImport(match[1]!, file);
      if (resolved && !seen.has(resolved)) {
        seen.add(resolved);
        queue.push(resolved);
      }
    }
  }
  return seen;
}

function collect(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    return e.isDirectory() ? collect(rel) : /\.tsx?$/.test(e.name) ? [rel] : [];
  });
}

/** One observation, as SIA-1 would return it. Every field is overridable per scenario. */
function observation(over: Partial<AgentOutcomeObservation> = {}): AgentOutcomeObservation {
  return {
    agentName: "Heby",
    inService: true,
    retiredAt: null,
    establishedAt: new Date(0).toISOString(),
    activity: { proposalsFiled: 0, pending: 0, withdrawn: 0 },
    governance: {
      approved: 0,
      rejected: 0,
      permitsIssued: 0,
      permitsActive: 0,
      permitsExpired: 0,
      permitsConsumed: 0,
      permitsRevoked: 0,
      approvedWithoutExecution: 0,
    },
    execution: { attempts: 0, pending: 0, accepted: 0, refused: 0, failed: 0, unknown: 0 },
    modelUsage: {
      linkedInvocations: 0,
      inputTokens: 0,
      outputTokens: 0,
      invocationsWithoutReportedUsage: 0,
      distribution: [],
    },
    provenance: { proposalsWithInvocation: 0, proposalsWithoutInvocation: 0 },
    ...over,
  };
}

/**
 * A refusal, in the English this repository actually writes.
 *
 * This was `\bnot\b` and it accused an honest sentence — "It says NOTHING about whether any of
 * them were good" is a refusal by any reading, and a word-boundary match on "not" does not see it.
 * R4C.2's rule: fix the detector, not the innocent prose.
 */
const REFUSES = /\b(not|nothing|never|neither|no)\b/i;

const metric = (e: ReturnType<typeof deriveAgentEvaluation>, key: string) => {
  const found = [...e.observed, ...e.derived].find((m) => m.key === key);
  assert.ok(found, `metric "${key}" exists`);
  return found!;
};

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. IT COMPOSES SIA-1 — AND WRITES NOTHING, ANYWHERE IN ITS CLOSURE.
 * ═════════════════════════════════════════════════════════════════════════ */
function composesSia1AndWritesNothing(): void {
  const graph = closure(PROJECTION);

  assert.ok(graph.has(SIA1_PROJECTION), "the evaluation reaches the released SIA-1 projection");
  assert.ok(
    graph.has("src/features/agent-outcome-observation/read-agent-outcome-facts.server.ts"),
    "and through it the authoritative aggregate reader",
  );

  for (const file of graph) {
    assert.ok(
      !performsDurableWrite(read(file)),
      `${file} performs a durable write — SELF-IMPROVING-AGENTS-2 is a reader`,
    );
  }

  for (const file of graph) {
    const code = codeOf(read(file));
    for (const raw of [/insert\s+into/i, /update\s+[a-z_"]+\s+set/i, /delete\s+from/i, /truncate\s+table/i]) {
      assert.ok(!raw.test(code), `${file} must not carry raw SQL matching ${raw}`);
    }
    assert.ok(!/\.transaction\(/.test(code), `${file} must not open a transaction`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. IT IS A SECOND READER, NEVER A SECOND OBSERVATION AUTHORITY.
 *
 * The load-bearing structural claim of the phase: SIA-2 owns no query. If it grew one, its numbers
 * could disagree with SIA-1's about the same rows, and there would be two answers to one question.
 * ═════════════════════════════════════════════════════════════════════════ */
function issuesNoStatementOfItsOwn(): void {
  for (const file of [CONTRACTS, PROJECTION, SURFACE]) {
    const code = codeOf(read(file));
    for (const forbidden of [".select(", "db.execute(", "sql`", "drizzle-orm", "@/db/client.server"]) {
      assert.ok(
        !code.includes(forbidden),
        `${file} must not reach "${forbidden}" — SIA-2 composes SIA-1 and owns no query`,
      );
    }
    /* It names no table, so it cannot be reading one behind SIA-1's back. */
    for (const table of [
      "heby_action_requests",
      "action_permits",
      "action_execution_attempts",
      "heby_origination_invocations",
      "hebyActionRequests",
      "actionPermits",
      "actionExecutionAttempts",
      "hebyOriginationInvocations",
      "agents",
    ]) {
      assert.ok(
        !new RegExp(`(?:from|join|insert|update|\\.)\\s*\\(?\\s*["']?${table}["']?\\s*\\)`).test(code),
        `${file} must not query "${table}" — that is SIA-1's job`,
      );
    }
  }

  assert.equal(AGENT_EVALUATION_BOUNDARY.isSecondObservationAuthority, false);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. IT CANNOT ACT, AND IT CANNOT TOUCH AN AGENT'S CONFIGURATION.
 * ═════════════════════════════════════════════════════════════════════════ */
function reachesNoConsequentialAuthority(): void {
  const graph = closure(PROJECTION);

  const FORBIDDEN_SYMBOLS = [
    "createDurableAgentIdentity",
    "retireDurableAgentIdentity",
    "originateAgentAction",
    "proposeSendAction",
    "proposeAgentOriginatedSendAction",
    "recordActionRequest",
    "registerInvocation",
    "finalizeInvocation",
    "approveActionRequest",
    "rejectActionRequest",
    "revokeActionPermit",
    "consumeActionPermit",
    "executeAuthorizedAction",
    "recordActionExecutionEventWithin",
    "recordActionAuthorizationEventWithin",
    "writeGovernanceDecisionWithin",
    "establishGovernanceAuthority",
    "resolveExternalSendAdapter",
    "createResendEmailTransport",
  ];

  for (const file of graph) {
    if (isTableDefinition(file)) continue;
    const code = codeOf(read(file));
    for (const symbol of FORBIDDEN_SYMBOLS) {
      assert.ok(!code.includes(symbol), `${file} must not reach "${symbol}" — the evaluation reports only`);
    }
    for (const forbidden of [
      "HEBUN_EXTERNAL_SEND_API_KEY",
      "HEBUN_MODEL_CREDENTIAL",
      "ANTHROPIC",
      "integrationCredentials",
      "node:http",
      "node:net",
      "node:tls",
      "globalThis.fetch",
      "https://",
    ]) {
      assert.ok(!code.includes(forbidden), `${file} must not reach "${forbidden}"`);
    }
    assert.ok(!/\bfetch\s*\(/.test(code), `${file} must make no network call`);
  }

  /*
   * AND IT NAMES NO AGENT CONFIGURATION COLUMN. These are the columns a "self-improving" phase
   * would reach for first, and every one of them has zero writers today.
   */
  for (const file of [CONTRACTS, PROJECTION, SURFACE]) {
    const code = codeOf(read(file));
    for (const column of [
      "performanceTargets",
      "performance_targets",
      "learningProfile",
      "telemetryProfile",
      "preferredModels",
      "preferredProviders",
      "allowedTools",
      "reasoningPreferences",
      "learningPreferences",
      "costLimits",
      "authorityCeiling",
    ]) {
      assert.ok(!code.includes(column), `${file} must not name the agent configuration column "${column}"`);
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. IT REVIVES NO DEAD EVALUATION, TELEMETRY OR LEARNING SCAFFOLDING.
 *
 * MEASURED, not assumed: `src/features/evaluation` has zero runtime callers and its own released
 * boundary test forbids it from importing a database driver. Promoting it here would be promoting
 * a scoring engine that structurally cannot read an authoritative record.
 * ═════════════════════════════════════════════════════════════════════════ */
function revivesNothingDead(): void {
  const graph = closure(PROJECTION);

  const DEAD_MODULES = [
    "features/evaluation",
    "features/observability",
    "features/learning",
    "db/schema/learning",
    "db/schema/telemetry",
    "db/schema/memory",
    "db/schema/working_memory",
    "db/schema/execution",
    "db/schema/workflow",
  ];
  const DEAD_SYMBOLS = [
    "learningSessions",
    "improvementProposals",
    "telemetryEvents",
    "workingMemories",
    "scoreEvaluation",
    "compareBaseline",
    "emitEvaluationResult",
    "EvaluationRegistry",
    "EvaluationRubric",
  ];

  for (const file of graph) {
    if (isTableDefinition(file)) continue;
    const code = codeOf(read(file));
    for (const deadModule of DEAD_MODULES) {
      assert.ok(!code.includes(deadModule), `${file} imports the dead module "${deadModule}"`);
    }
    for (const symbol of DEAD_SYMBOLS) {
      assert.ok(!code.includes(symbol), `${file} must not name the dead symbol "${symbol}"`);
    }
  }

  /* The dead scaffolding really is dead — re-measured here, so this suite fails if it wakes up. */
  const evaluationCallers = collect("src")
    .filter((f) => !f.startsWith(path.join("src", "features", "evaluation")))
    .filter((f) => /from\s+["']@\/features\/evaluation/.test(codeOf(read(f))));
  assert.deepEqual(
    evaluationCallers,
    [],
    "src/features/evaluation still has zero runtime callers — SIA-2 did not promote it",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. NO SCORE, NO PERCENTAGE — AND NO REPRESENTATION FOR EITHER.
 *
 * The strongest form of this guarantee is structural: a derived metric carries a numerator and a
 * denominator and no quotient, and nothing in the feature divides. A grade cannot be produced by
 * an edit that merely forgets a rule.
 * ═════════════════════════════════════════════════════════════════════════ */
function noScoreIsRepresentable(): void {
  for (const [capability, value] of Object.entries(AGENT_EVALUATION_BOUNDARY)) {
    assert.equal(value, false, `AGENT_EVALUATION_BOUNDARY.${capability} must be false in this phase`);
  }

  /* NOTHING DIVIDES. Measured over executable code, in the two modules that could. */
  for (const file of [PROJECTION, SURFACE]) {
    const code = codeOf(read(file));
    assert.ok(
      !/[)\]\w\s]\s\/\s[\w(]/.test(code.replace(/["'`][^"'`]*["'`]/g, '""')),
      `${file} must contain no division — a quotient is the one thing this phase cannot express`,
    );
  }

  /* No field is named after a grade. Walked over the composed shape, so a new field is caught. */
  const evaluation = deriveAgentEvaluation(
    observation({ activity: { proposalsFiled: 4, pending: 1, withdrawn: 0 } }),
  );
  const walk = (value: unknown, trail: string): void => {
    if (value === null || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((child, i) => walk(child, `${trail}[${i}]`));
      return;
    }
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      for (const banned of FORBIDDEN_EVALUATION_VOCABULARY) {
        assert.ok(
          !key.toLowerCase().includes(banned),
          `the evaluation must not expose a "${banned}" field (found at "${trail}.${key}")`,
        );
      }
      walk(child, `${trail}.${key}`);
    }
  };
  walk(evaluation, "evaluation");

  /* And no DERIVED metric carries a quotient-shaped field. */
  for (const derived of evaluation.derived) {
    const keys = Object.keys(derived);
    for (const banned of ["ratio", "rate", "percent", "value", "score", "quotient"]) {
      assert.ok(!keys.includes(banned), `a derived metric must not carry a "${banned}" field`);
    }
    assert.ok(keys.includes("numerator") && keys.includes("denominator"), "it carries n and d");
  }

  /*
   * AND NO TYPE DECLARES ONE EITHER.
   *
   * Found by a bite-proof: the runtime walk above cannot see an OPTIONAL field that is declared and
   * never assigned, so `readonly overallScore?: number` passed every check while sitting in the
   * public shape of the evaluation. A value can exist without a declaration and a declaration can
   * exist without a value; both need guarding.
   */
  for (const file of [CONTRACTS, PROJECTION]) {
    const source = codeOf(read(file));
    for (const banned of FORBIDDEN_EVALUATION_VOCABULARY) {
      assert.ok(
        !new RegExp(`readonly\\s+\\w*${banned}\\w*\\s*[?:]`, "i").test(source),
        `${file} must not expose a field named after "${banned}"`,
      );
    }
  }

  /* THERE IS NO AGENT-LEVEL SUMMARY NUMBER. The evaluation is a list of metrics, not a figure. */
  const topLevel = Object.entries(evaluation).filter(([, v]) => typeof v === "number");
  assert.deepEqual(topLevel, [], "no agent-level number exists that could read as an overall score");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6. EVERY DERIVED METRIC DECLARES ITS ARITHMETIC AND ITS REFUSAL.
 * ═════════════════════════════════════════════════════════════════════════ */
function everyMetricStatesWhatItIsNot(): void {
  const evaluation = deriveAgentEvaluation(
    observation({ activity: { proposalsFiled: 4, pending: 1, withdrawn: 0 } }),
  );

  assert.ok(evaluation.observed.length > 0 && evaluation.derived.length > 0);

  for (const m of evaluation.observed) {
    assert.equal(m.kind, "observed");
    assert.ok(m.source.length > 0, `${m.key} names the authoritative record it came from`);
    assert.ok(m.means.length > 0, `${m.key} says what it means`);
    assert.ok(REFUSES.test(m.doesNotMean), `${m.key} states what it does NOT mean`);
  }
  for (const m of evaluation.derived) {
    assert.equal(m.kind, "derived");
    assert.ok(m.source.length > 0, `${m.key} names its source`);
    assert.ok(/over/i.test(m.definition), `${m.key} states its numerator and denominator in words`);
    assert.ok(REFUSES.test(m.doesNotMean), `${m.key} states what it does NOT mean`);
    assert.ok(m.numerator >= 0 && m.denominator >= 0, `${m.key} has no negative side`);
    assert.ok(m.numerator <= m.denominator, `${m.key} numerator never exceeds its denominator`);
  }
  for (const d of evaluation.unavailable) {
    assert.equal(d.kind, "unavailable");
    assert.ok(d.explanation.length > 0, `${d.key} explains why Hebun cannot answer it`);
  }

  /* THE THREE KINDS ARE DISJOINT — a key never appears in two lists. */
  const keys = [
    ...evaluation.observed.map((m) => m.key),
    ...evaluation.derived.map((m) => m.key),
    ...evaluation.unavailable.map((d) => d.key),
  ];
  assert.equal(new Set(keys).size, keys.length, "every metric key is unique across the three kinds");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 7. THE SEMANTIC INVARIANTS, PINNED.
 * ═════════════════════════════════════════════════════════════════════════ */
function semanticInvariantsArePinned(): void {
  const claims = EVALUATION_NON_CLAIMS.join(" ").toLowerCase();
  for (const invariant of [
    "approved is not successful",
    "rejected is not failed",
    "accepted is not delivered",
    "accepted is not business success",
    "an execution failure is not an agent failure",
    "unknown is not failed",
    "a permit is not an execution",
    "missing provenance is not proof the proposal was deterministic",
    "missing provenance is not proof that no model was used",
    "token count is not quality",
    "frequency is not preference",
    "correlation is not causation",
  ]) {
    assert.ok(claims.includes(invariant), `the evaluation pins "${invariant}"`);
  }

  /*
   * THE ANTI-SUCCESS-RATE PROOF.
   *
   * `execution-resolution` is the metric most likely to be misread as a success rate, so its
   * numerator is proven to COUNT FAILURES. If a later edit narrowed it to `accepted`, this fails.
   */
  const e = deriveAgentEvaluation(
    observation({
      activity: { proposalsFiled: 4, pending: 0, withdrawn: 0 },
      execution: { attempts: 4, pending: 0, accepted: 1, refused: 1, failed: 1, unknown: 1 },
    }),
  );
  const resolution = metric(e, "execution-resolution") as { numerator: number; denominator: number };
  assert.equal(
    resolution.numerator,
    3,
    "accepted + failed + refused — a confirmed failure is a confirmed outcome",
  );
  assert.equal(resolution.denominator, 4);
  assert.notEqual(resolution.numerator, 1, "it is NOT the accepted count — that would be a success rate");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 8. THE UNAVAILABLE DIMENSIONS ARE NAMED, NOT OMITTED.
 * ═════════════════════════════════════════════════════════════════════════ */
function unavailableDimensionsAreDeclared(): void {
  const keys = UNAVAILABLE_DIMENSIONS.map((d) => d.key).sort();
  for (const required of [
    "delivery",
    "business-outcome",
    "decision-quality",
    "efficiency",
    "performance-target",
    "temporal-trend",
    "usefulness",
    "correctness",
  ]) {
    assert.ok(keys.includes(required), `the evaluation declares "${required}" unavailable`);
  }

  for (const d of UNAVAILABLE_DIMENSIONS) {
    assert.ok(
      ["no-authoritative-record", "no-evidence-yet", "definition-not-owned"].includes(d.reason),
      `${d.key} carries a closed reason`,
    );
  }

  /* A ZERO DENOMINATOR IS AN ABSENCE, NOT A RESULT. */
  const zero = shareAvailability(0);
  assert.equal(
    zero.state,
    "unavailable",
    "a zero denominator is an absence, not a result — nothing can be drawn from no evidence",
  );
  assert.equal(
    zero.state === "unavailable" ? zero.reason : "",
    "no-evidence-yet",
    "and the reason names the absence rather than the concept",
  );
  assert.equal(
    shareAvailability(1).state,
    "available",
    "a single observation is enough for a share to exist",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 9. THE SURFACE IS A SERVER COMPONENT WITH NO CONTROL, AND NO PERCENT SIGN.
 * ═════════════════════════════════════════════════════════════════════════ */
function theSurfaceOffersNoControl(): void {
  const code = codeOf(read(SURFACE));

  assert.ok(!code.includes("use client"), "the evaluation is a server component");
  for (const forbidden of [
    "<button",
    "<form",
    "<input",
    "onClick",
    "onSubmit",
    "onChange",
    "useState",
    "useTransition",
    "useEffect",
    "revalidatePath",
    "agents/actions",
  ]) {
    assert.ok(!code.includes(forbidden), `the evaluation surface must not contain "${forbidden}"`);
  }
  for (const action of [
    "createDurableAgentIdentityAction",
    "retireDurableAgentIdentityAction",
    "approveActionRequestAction",
    "executeAuthorizedActionAction",
  ]) {
    assert.ok(!code.includes(action), `the evaluation surface must not reach "${action}"`);
  }
  for (const label of [
    ">Tune<",
    ">Retrain<",
    ">Optimize<",
    ">Improve<",
    ">Adjust<",
    ">Configure<",
    ">Set target<",
    ">Apply<",
  ]) {
    assert.ok(!code.includes(label), `the evaluation surface must not offer "${label}"`);
  }

  /* NO PERCENT SIGN, ANYWHERE. A grade cannot be rendered even by accident. */
  assert.ok(!read(SURFACE).includes("%"), "the evaluation surface renders no percentage");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 10. THE TENANT COMES FROM THE AUTHORIZED CONTEXT, AND NOTHING ELSE.
 * ═════════════════════════════════════════════════════════════════════════ */
async function tenantIsolationIsStructural(): Promise<void> {
  const code = codeOf(read(PROJECTION));
  assert.ok(
    /export async function readAgentEvaluation\(\s*tenant: TenantContext \| null,/.test(code),
    "the entry point takes the branded authorized context, never a caller-supplied id",
  );
  for (const forbidden of ["tenantId:", "tenantId?:", "allTenants", "crossTenant", "everyTenant"]) {
    assert.ok(!code.includes(forbidden), `no cross-tenant or client-supplied form: "${forbidden}"`);
  }
  assert.ok(
    /readAgentOutcomeObservation\(tenant, deps\)/.test(code),
    "the tenant is handed straight to SIA-1, which owns every predicate",
  );

  const noTenant = await readAgentEvaluation(null);
  assert.equal(noTenant.status, "unavailable", "no authorized tenant means no evaluation");
  assert.equal(
    noTenant.status === "unavailable" ? noTenant.reason : "",
    "no-authorized-tenant-context",
    "and SIA-1's reason is carried verbatim, never re-worded",
  );

  const tenant = asHumanTenantContext({
    tenantId: "11111111-1111-4111-8111-111111111111",
    userId: "22222222-2222-4222-8222-222222222222",
    authIdentityId: "33333333-3333-4333-8333-333333333333",
    membershipId: "44444444-4444-4444-8444-444444444444",
    membershipVersion: 1,
    roleId: "55555555-5555-4555-8555-555555555555",
    sessionContextId: "66666666-6666-4666-8666-666666666666",
    provider: "local",
    assuranceLevel: "aal1",
    mfaVerified: false,
    requestId: "sia2-firewall",
    authenticatedAt: new Date(0).toISOString(),
  });
  const unreadable = await readAgentEvaluation(tenant, { getDb: () => null });
  assert.equal(unreadable.status, "unavailable", "an unreadable store never renders as no agents");

  /* AN UNREADABLE OBSERVATION MAKES THE EVALUATION UNAVAILABLE — never a confident empty answer. */
  const derivedFromFailure = deriveAgentEvaluationRead({ status: "unavailable", reason: "read-failed" });
  assert.equal(derivedFromFailure.status, "unavailable");
  assert.equal(
    derivedFromFailure.status === "unavailable" ? derivedFromFailure.reason : "",
    "read-failed",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 11. THE ROUTE READS ONCE AND DERIVES — IT DOES NOT READ TWICE.
 * ═════════════════════════════════════════════════════════════════════════ */
function theRouteReadsOnce(): void {
  const route = codeOf(read(ROUTE));

  assert.ok(route.includes("<AgentEvaluationSurface"), "the route renders the evaluation surface");
  assert.ok(route.includes("deriveAgentEvaluationRead(outcomes)"), "derived from the SAME observation");
  assert.ok(
    !route.includes("readAgentEvaluation("),
    "the route must NOT issue a second read — the two cards would be free to disagree",
  );

  const reads = route.match(/readAgentOutcomeObservation\(/g) ?? [];
  assert.equal(reads.length, 1, "SIA-1's six statements are issued exactly once per render");

  /* Order: ceremony, then observation, then evaluation. Act first, observe, then interpret. */
  assert.ok(
    route.indexOf("<DurableAgentIdentityCard") < route.indexOf("<AgentOutcomeObservationSurface"),
    "the ceremony renders above the observation",
  );
  assert.ok(
    route.indexOf("<AgentOutcomeObservationSurface") < route.indexOf("<AgentEvaluationSurface"),
    "and the observation above the evaluation — you cannot interpret what you have not observed",
  );

  /* Nothing released was lost. */
  assert.ok(route.includes("<AgentsTruthSurface"), "the released registry surface is unchanged");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 12. SIA-2 DID NOT WEAKEN SIA-1.
 *
 * Measured against the released files rather than trusted: this phase must add a reader, not edit
 * the authority beneath it.
 * ═════════════════════════════════════════════════════════════════════════ */
function sia1IsUnweakened(): void {
  const sia1 = codeOf(read(SIA1_PROJECTION));
  assert.ok(
    /export async function readAgentOutcomeObservation\(\s*tenant: TenantContext \| null,/.test(sia1),
    "SIA-1's entry point still takes the branded context",
  );
  assert.ok(
    sia1.includes("composeAgentOutcomes"),
    "SIA-1's pure composer is still the thing its read uses",
  );
  assert.ok(
    !performsDurableWrite(read(SIA1_PROJECTION)),
    "SIA-1 is still a reader",
  );

  /* SIA-2 added no writer to the repository, measured as a census over src/. */
  const attemptWriters = collect("src")
    .filter((f) => /\.\s*(?:insert|update)\s*\(\s*actionExecutionAttempts\s*\)/.test(codeOf(read(f))))
    .sort();
  assert.deepEqual(
    attemptWriters,
    [path.join("src", "features", "action-execution", "execute-authorized-action.server.ts")],
    "still exactly one writer of the attempt table",
  );
  const agentWriters = collect("src")
    .filter((f) => /\.\s*(?:insert|update)\s*\(\s*agents\s*\)/.test(codeOf(read(f))))
    .sort();
  assert.deepEqual(
    agentWriters,
    [
      path.join("src", "features", "agent-identity", "create-durable-agent-identity.server.ts"),
      path.join("src", "features", "agent-identity", "retire-durable-agent-identity.server.ts"),
    ],
    "still exactly two writers of the agents table — SIA-2 added no agent mutation",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 13. A ZERO-EVIDENCE AGENT YIELDS UNAVAILABLE, NEVER ZERO.
 * ═════════════════════════════════════════════════════════════════════════ */
function zeroEvidenceIsNotZeroResult(): void {
  const e = deriveAgentEvaluation(observation());
  assert.equal(e.hasNoEvidence, true);
  for (const m of e.derived) {
    assert.equal(
      m.availability.state,
      "unavailable",
      `${m.key} must be unavailable, not "0 of 0" — an absence is not a finding`,
    );
    assert.equal(
      m.availability.state === "unavailable" ? m.availability.reason : "",
      "no-evidence-yet",
    );
  }
  /* The observed counts are still zero, and that IS a fact. */
  assert.equal(metric(e, "proposals-filed").kind, "observed");
  assert.ok(e.unavailable.length > 0, "and the unanswerable dimensions are still named");

  assert.ok(
    /unavailable rather than zero/i.test(AGENT_EVALUATION_WORDING.zeroActivity),
    "and the surface says so in words",
  );
}

async function main(): Promise<void> {
  composesSia1AndWritesNothing();
  issuesNoStatementOfItsOwn();
  reachesNoConsequentialAuthority();
  revivesNothingDead();
  noScoreIsRepresentable();
  everyMetricStatesWhatItIsNot();
  semanticInvariantsArePinned();
  unavailableDimensionsAreDeclared();
  theSurfaceOffersNoControl();
  await tenantIsolationIsStructural();
  theRouteReadsOnce();
  sia1IsUnweakened();
  zeroEvidenceIsNotZeroResult();

  console.log("sia2-agent-evaluation/evaluation-firewall: OK");
}

void main();
