/*
 * SELF-IMPROVING-AGENTS-1 — THE OBSERVATION SURFACE HOLDS NO AUTHORITY.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "Agent Outcome Observation can SHOW what became of what an agent proposed and can CAUSE
 *    nothing. Its whole import closure performs no durable write, opens no socket, reaches no
 *    model and touches no credential. It cannot create or retire an agent, originate a proposal,
 *    approve, reject, permit, revoke, execute, or mutate an attempt. It writes no audit, no
 *    Knowledge, no memory and no telemetry, and it revives none of the dead learning tables. Its
 *    surface is a server component with no control of any kind. The tenant comes from the
 *    authorized context and no parameter can name another. It observes and measures; it evaluates
 *    nothing. And the phase added no writer to the repository."
 *
 * Structural assertions run over comment-stripped source: they are about what the code can reach,
 * not about what its prose promises.
 *
 * Pure. No database, no network, no model.
 */
// Loaded FIRST: the schema barrel is the only safe entry point for src/db/schema/*, which the
// projection reaches transitively. Importing a single table module first re-enters `_base` before
// it has initialized, and the failure looks nothing like an ordering problem.
import "../../src/db/schema";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { performsDurableWrite, codeOf } from "../helpers/durable-write-detector";
import {
  AGENT_OUTCOME_BOUNDARY,
  AGENT_OUTCOME_NON_CLAIMS,
  AGENT_OUTCOME_STAGES,
  AGENT_OUTCOME_STAGE_MEANING,
  AGENT_OUTCOME_WORDING,
  AGENT_PERMIT_STATES,
  AGENT_PROPOSAL_STATUSES,
  FORBIDDEN_OUTCOME_VOCABULARY,
  PROVENANCE_COVERAGE_WORDING,
  isExpiredPermit,
} from "../../src/features/agent-outcome-observation/contracts";
import {
  approvedButUnexecuted,
  composeAgentOutcomes,
  readAgentOutcomeObservation,
} from "../../src/features/agent-outcome-observation/agent-outcome-projection.server";
import { MODEL_DISTRIBUTION_LIMIT } from "../../src/features/agent-outcome-observation/read-agent-outcome-facts.server";
import { derivePermitState } from "../../src/features/action-authorization/read-action-authorizations.server";
import { hebyActionRequestStatusEnum, actionPermitStatusEnum } from "../../src/db/schema/_enums";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");

const FEATURE_DIR = "src/features/agent-outcome-observation";
const CONTRACTS = `${FEATURE_DIR}/contracts.ts`;
const READER = `${FEATURE_DIR}/read-agent-outcome-facts.server.ts`;
const PROJECTION = `${FEATURE_DIR}/agent-outcome-projection.server.ts`;
const SURFACE = "src/components/agents/agent-outcome-observation.tsx";
const ROUTE = "src/app/(dashboard)/agents/page.tsx";

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

/** The REAL import graph, walked in comment-stripped code — not a list somebody maintained. */
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

/**
 * Files under `src/db/schema/` are TABLE DEFINITIONS, and the drizzle client imports the barrel
 * wholesale — so every feature in this repository has every table's definition in its closure.
 *
 * They are excluded from the symbol bans below DELIBERATELY, and the exclusion is narrow: a table
 * definition grants no capability. Banning one would be the false accusation R4C.2 warned about —
 * a firewall that cries wolf is one somebody eventually relaxes, and this one would fire on every
 * read surface in the repository over an import the database client makes on its own behalf.
 *
 * What actually matters is whether anything in the closure READS or WRITES those tables, and that
 * is answered by the write detector, by the reader-symbol bans, and by the SQL census below.
 */
const isTableDefinition = (file: string): boolean =>
  file.startsWith(path.join("src", "db", "schema"));

function collect(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    return e.isDirectory() ? collect(rel) : /\.tsx?$/.test(e.name) ? [rel] : [];
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. THE READ PATH REACHES THE AUTHORITATIVE RECORDS — AND NO WRITER, ANYWHERE.
 *
 * The positive half matters as much as the negative: a firewall that only forbids would still pass
 * if the surface stopped consulting the durable rows and started inventing them.
 * ═════════════════════════════════════════════════════════════════════════ */
function readsTheRecordsAndWritesNothing(): void {
  const graph = closure(PROJECTION);

  assert.ok(graph.has(READER), "the projection reaches its aggregate reader");
  assert.ok(
    graph.has("src/features/agent-identity/read-durable-agent-identity.server.ts"),
    "and the released agent identity read seam — it mints no second identity store",
  );

  /* The reader names every authoritative table this phase composes, and no other. */
  const readerCode = codeOf(read(READER));
  for (const table of [
    "heby_action_requests",
    "action_permits",
    "action_execution_attempts",
    "heby_origination_invocations",
  ]) {
    assert.ok(readerCode.includes(table), `the reader must compose "${table}"`);
  }

  /*
   * NO DURABLE WRITE IN THE ENTIRE CLOSURE, measured by the shared detector rather than a second
   * spelling of the same question. This is the load-bearing assertion of the phase.
   */
  for (const file of graph) {
    assert.ok(
      !performsDurableWrite(read(file)),
      `${file} performs a durable write — SELF-IMPROVING-AGENTS-1 is a reader`,
    );
  }

  /* And no raw statement smuggles one past the builder-shaped detector. */
  for (const file of graph) {
    const code = codeOf(read(file));
    for (const raw of [
      /insert\s+into/i,
      /update\s+[a-z_"]+\s+set/i,
      /delete\s+from/i,
      /truncate\s+table/i,
    ]) {
      assert.ok(!raw.test(code), `${file} must not carry raw SQL matching ${raw}`);
    }
    assert.ok(!/\.transaction\(/.test(code), `${file} must not open a transaction`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. IT CANNOT CREATE, RETIRE, PROPOSE, DECIDE, PERMIT, EXECUTE OR SEND.
 *
 * Asserted as SYMBOLS over the whole closure, so the guarantee is about what the code can call —
 * not about which module it politely chose to import.
 * ═════════════════════════════════════════════════════════════════════════ */
function reachesNoConsequentialAuthority(): void {
  const graph = closure(PROJECTION);

  const FORBIDDEN_SYMBOLS = [
    /* agent identity */
    "createDurableAgentIdentity",
    "retireDurableAgentIdentity",
    /* origination and proposal */
    "originateAgentAction",
    "proposeSendAction",
    "proposeAgentOriginatedSendAction",
    "recordActionRequest",
    "registerInvocation",
    "finalizeInvocation",
    /* decision and permit */
    "approveActionRequest",
    "rejectActionRequest",
    "revokeActionPermit",
    "consumeActionPermit",
    /* execution */
    "executeAuthorizedAction",
    /* audit and governance writes */
    "recordActionExecutionEventWithin",
    "recordActionAuthorizationEventWithin",
    "writeGovernanceDecisionWithin",
    "establishGovernanceAuthority",
    /* provider */
    "resolveExternalSendAdapter",
    "createResendEmailTransport",
  ];

  for (const file of graph) {
    const code = codeOf(read(file));
    for (const symbol of FORBIDDEN_SYMBOLS) {
      assert.ok(
        !code.includes(symbol),
        `${file} must not reach "${symbol}" — the observation reports only`,
      );
    }
  }

  /* No credential and no network primitive is reachable from a surface that only reports. */
  for (const file of graph) {
    if (isTableDefinition(file)) continue;
    const code = codeOf(read(file));
    for (const forbidden of [
      "HEBUN_EXTERNAL_SEND_API_KEY",
      "HEBUN_MODEL_CREDENTIAL",
      "ANTHROPIC",
      "integrationCredentials",
      "integration_credentials",
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

  /* No model touches the answer: an agent's record may not be summarized, softened or classified. */
  for (const file of graph) {
    const lower = codeOf(read(file)).toLowerCase();
    for (const forbidden of ["anthropic", "selectmodeltransport", "generatehebymodelanswer"]) {
      assert.ok(!lower.includes(forbidden), `${file} must not reach the model via "${forbidden}"`);
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. IT REVIVES NOTHING THAT IS DEAD.
 *
 * The learning tables, memories, telemetry and the generic CRUD persistence are the exact places a
 * "self-improving agents" phase would drift into. Named as symbols AND as table names, over the
 * whole closure, so an import taken "just for a type" trips this.
 * ═════════════════════════════════════════════════════════════════════════ */
function revivesNothingDead(): void {
  const graph = closure(PROJECTION);

  /**
   * The dead schema MODULES. Importing one is how a read path acquires a dead table, and it is
   * unambiguous in a way a bare word is not.
   */
  const DEAD_MODULES = [
    "db/schema/execution",
    "db/schema/learning",
    "db/schema/memory",
    "db/schema/working_memory",
    "db/schema/telemetry",
    "db/schema/workflow",
  ];

  /**
   * The dead table SYMBOLS that are unambiguous identifiers.
   *
   * `executions`, `memories` and `workflows` are DELIBERATELY not in this list. Each is also an
   * ordinary English plural, and banning the bare word accuses innocent code — R4C.2's rule that a
   * firewall which cries wolf is one somebody eventually relaxes. They are caught below, where it
   * counts: in the statements, and in the imports.
   */
  const DEAD_SYMBOLS = [
    "learningSessions",
    "improvementProposals",
    "telemetryEvents",
    "workingMemories",
    "workflowRuns",
  ];

  /** The dead TABLE names, as a statement would have to spell them. */
  const DEAD_TABLES = [
    "learning_sessions",
    "improvement_proposals",
    "memories",
    "working_memories",
    "telemetry_events",
    "workflows",
    "executions",
  ];

  for (const file of graph) {
    if (isTableDefinition(file)) continue;
    const code = codeOf(read(file));

    for (const deadModule of DEAD_MODULES) {
      assert.ok(
        !code.includes(deadModule),
        `${file} imports the dead schema module "${deadModule}" — this phase revives nothing`,
      );
    }
    for (const symbol of DEAD_SYMBOLS) {
      assert.ok(!code.includes(symbol), `${file} must not name the dead table "${symbol}"`);
    }

    /*
     * AND NO STATEMENT NAMES A DEAD TABLE. This is what the table-definition exclusion is paid for
     * by: a statement is what actually reaches a table, and every statement in this closure is
     * visible here.
     */
    for (const statement of code.matchAll(/sql`([\s\S]*?)`/g)) {
      for (const table of DEAD_TABLES) {
        assert.ok(
          !statement[1]!.includes(table),
          `${file} runs a statement naming the dead table "${table}"`,
        );
      }
    }
  }

  /*
   * THE STATEMENTS NAME EXACTLY THE FOUR AUTHORITATIVE TABLES THIS PHASE COMPOSES.
   *
   * A census rather than a denylist: a denylist can only ever forbid the tables somebody already
   * thought of, while this fails on ANY fifth table a later edit reaches for.
   */
  const readerSql = [...codeOf(read(READER)).matchAll(/sql`([\s\S]*?)`/g)]
    .map((m) => m[1]!)
    .join("\n");
  const named = new Set(
    [...readerSql.matchAll(/(?:from|join)\s+"([a-z_]+)"/g)].map((m) => m[1]!),
  );
  assert.deepEqual(
    [...named].sort(),
    [
      "action_execution_attempts",
      "action_permits",
      "heby_action_requests",
      "heby_origination_invocations",
    ],
    "the aggregate reads exactly the four authoritative tables and no other",
  );

  /* The surface and the contracts name none of them either — a label is a claim too. */
  for (const file of [SURFACE, CONTRACTS]) {
    const code = codeOf(read(file));
    for (const symbol of [...DEAD_SYMBOLS, "improvement_proposals", "telemetry_events"]) {
      assert.ok(!code.includes(symbol), `${file} must not name "${symbol}"`);
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. THE PHASE ADDED NO WRITER TO THE REPOSITORY.
 *
 * Measured as a census over `src/`, not asserted about the three new files: a phase that quietly
 * gave some OTHER module a write to one of these tables would pass a narrower check.
 * ═════════════════════════════════════════════════════════════════════════ */
function noNewWriterExists(): void {
  const writersOf = (table: string): string[] =>
    collect("src")
      .filter((f) => {
        const code = codeOf(read(f));
        return new RegExp(`\\.\\s*(?:insert|update|delete)\\s*\\(\\s*${table}\\s*\\)`).test(code);
      })
      .sort();

  assert.deepEqual(
    writersOf("actionExecutionAttempts"),
    [path.join("src", "features", "action-execution", "execute-authorized-action.server.ts")],
    "exactly one module writes the attempt table, and it is the released executor",
  );
  assert.deepEqual(
    writersOf("hebyOriginationInvocations"),
    [path.join("src", "features", "agent-origination", "invocation-provenance.server.ts")],
    "exactly one module writes the invocation table, and it is the released provenance seam",
  );
  assert.deepEqual(
    writersOf("agents"),
    [
      path.join("src", "features", "agent-identity", "create-durable-agent-identity.server.ts"),
      path.join("src", "features", "agent-identity", "retire-durable-agent-identity.server.ts"),
    ],
    "exactly two modules write the agents table, and both are the released identity authorities",
  );

  /* The three new files name no write verb against any table at all. */
  for (const file of [CONTRACTS, READER, PROJECTION, SURFACE]) {
    assert.ok(!performsDurableWrite(read(file)), `${file} must perform no durable write`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. THE SURFACE IS A SERVER COMPONENT WITH NO CONTROL.
 *
 * The absence of a "tune this agent" control is STRUCTURAL, not editorial: with no client boundary
 * and no imported action, there is nothing a control could be wired to.
 * ═════════════════════════════════════════════════════════════════════════ */
function theSurfaceOffersNoControl(): void {
  const code = codeOf(read(SURFACE));

  assert.ok(!code.includes("use client"), "the observation is a server component — no client boundary");
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
    "startTransition",
    "revalidatePath",
    "agents/actions",
  ]) {
    assert.ok(!code.includes(forbidden), `the observation surface must not contain "${forbidden}"`);
  }

  /* It imports no server action, so no mutation boundary is reachable from it. */
  for (const action of [
    "createDurableAgentIdentityAction",
    "retireDurableAgentIdentityAction",
    "approveActionRequestAction",
    "rejectActionRequestAction",
    "revokeActionPermitAction",
    "executeAuthorizedActionAction",
  ]) {
    assert.ok(!code.includes(action), `the observation surface must not reach "${action}"`);
  }

  /*
   * AND NO CONTROL VOCABULARY IS RENDERED. A label is what a human reads as an offer, so the ban
   * is on the rendered words rather than only on the handlers behind them.
   */
  for (const label of [
    ">Retry<",
    ">Retrain<",
    ">Tune<",
    ">Optimize<",
    ">Improve<",
    ">Adjust<",
    ">Configure<",
    ">Disable agent<",
    ">Retire<",
    ">Approve<",
    ">Reject<",
  ]) {
    assert.ok(!code.includes(label), `the observation surface must not offer "${label}"`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6. THE TENANT COMES FROM THE AUTHORIZED CONTEXT, AND NOTHING ELSE.
 * ═════════════════════════════════════════════════════════════════════════ */
async function tenantIsolationIsStructural(): Promise<void> {
  const projection = codeOf(read(PROJECTION));
  const reader = codeOf(read(READER));

  assert.ok(
    /export async function readAgentOutcomeObservation\(\s*tenant: TenantContext \| null,/.test(
      projection,
    ),
    "the entry point takes the branded authorized context, never a caller-supplied id",
  );
  for (const forbidden of ["tenantId:", "tenantId?:", "allTenants", "crossTenant", "everyTenant"]) {
    assert.ok(
      !projection.includes(forbidden),
      `no cross-tenant or client-supplied form in the projection: "${forbidden}"`,
    );
  }

  /* The projection issues no statement of its own, so the reader's predicates are the only scope. */
  assert.ok(
    !projection.includes("db.execute("),
    "the projection adds no statement — it composes the reader",
  );

  /*
   * EVERY statement carries the session tenant, and the tenant value can only come from the guard.
   * Counted rather than spot-checked: five aggregate statements, five tenant-bound predicates on
   * the driving table, and the joins carry their own.
   */
  const tenantBindings = reader.match(/\$\{resolved\.tenantId\}/g) ?? [];
  assert.ok(
    tenantBindings.length >= 11,
    `every statement binds the resolved tenant on every table (found ${tenantBindings.length})`,
  );
  assert.ok(
    !/\$\{[^}]*tenant\.tenantId[^}]*\}/.test(reader),
    "the tenant is bound from the guard's resolved value, never re-read from the argument",
  );

  /* A missing context is refused before any read is attempted. */
  const noTenant = await readAgentOutcomeObservation(null);
  assert.equal(noTenant.status, "unavailable", "no authorized tenant means no observation");
  assert.equal(
    noTenant.status === "unavailable" ? noTenant.reason : "",
    "no-authorized-tenant-context",
  );

  /* An unreadable store is UNAVAILABLE — never an organization with no agents. */
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
    requestId: "sia1-firewall",
    authenticatedAt: new Date(0).toISOString(),
  });
  const unavailable = await readAgentOutcomeObservation(tenant, { getDb: () => null });
  assert.equal(unavailable.status, "unavailable", "an unreadable store never renders as empty");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 7. IT OBSERVES AND MEASURES. IT EVALUATES NOTHING.
 * ═════════════════════════════════════════════════════════════════════════ */
function observesWithoutEvaluating(): void {
  for (const [capability, value] of Object.entries(AGENT_OUTCOME_BOUNDARY)) {
    assert.equal(value, false, `AGENT_OUTCOME_BOUNDARY.${capability} must be false in this phase`);
  }

  /*
   * NO FIELD IS NAMED AFTER A VERDICT. Walked over the composed shape, so a field added later is
   * caught by its NAME rather than by somebody remembering to update a list.
   */
  const composed = composeAgentOutcomes({
    identities: [
      {
        agentId: "11111111-1111-4111-8111-111111111111",
        name: "Heby",
        humanOwnerId: null,
        humanOwnerType: null,
        createdAt: new Date(0).toISOString(),
        retiredAt: null,
        inService: true,
      },
    ],
    proposals: [],
    permits: [],
    executions: [],
    invocations: [],
    distribution: [],
  });

  const walk = (value: unknown, trail: string): void => {
    if (value === null || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      for (const banned of FORBIDDEN_OUTCOME_VOCABULARY) {
        assert.ok(
          !key.toLowerCase().includes(banned),
          `the observation must not expose a "${banned}" field (found at "${trail}.${key}") — a count is not a verdict`,
        );
      }
      walk(child, `${trail}.${key}`);
    }
  };
  walk(composed, "observation");

  /* The contract types declare none either. */
  const contracts = codeOf(read(CONTRACTS));
  const projection = codeOf(read(PROJECTION));
  for (const banned of FORBIDDEN_OUTCOME_VOCABULARY) {
    for (const [label, source] of [["contracts", contracts], ["projection", projection]] as const) {
      assert.ok(
        !new RegExp(`readonly\\s+\\w*${banned}\\w*\\s*[?:]`, "i").test(source),
        `no ${label} field is named after "${banned}"`,
      );
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 8. THE SEVEN STAGES STAY SEVEN, AND EACH SAYS WHAT IT IS NOT.
 * ═════════════════════════════════════════════════════════════════════════ */
function stagesAreNotCollapsed(): void {
  assert.deepEqual(
    [...AGENT_OUTCOME_STAGES],
    ["PROPOSED", "AUTHORIZED", "PERMITTED", "EXECUTED", "ACCEPTED", "FAILED", "UNKNOWN"],
    "seven stages, in the order the authorities produce them",
  );
  assert.equal(new Set(AGENT_OUTCOME_STAGES).size, 7, "and no two are the same stage");

  /* TOTAL over the vocabulary: every stage names its source and states a refusal. */
  for (const stage of AGENT_OUTCOME_STAGES) {
    const meaning = AGENT_OUTCOME_STAGE_MEANING[stage];
    assert.ok(meaning, `${stage} has a meaning`);
    assert.ok(meaning.source.length > 0, `${stage} names the record it comes from`);
    assert.ok(meaning.means.length > 0, `${stage} says what it means`);
    assert.ok(
      /\bnot\b/i.test(meaning.doesNotMean),
      `${stage} states what it does NOT mean — the whole point of keeping seven`,
    );
  }

  /* THE FOUR SEMANTIC PINS, as sentences the surface actually carries. */
  const claims = AGENT_OUTCOME_NON_CLAIMS.join(" ").toLowerCase();
  assert.ok(claims.includes("accepted is not delivered"), "accepted != delivered");
  assert.ok(claims.includes("approved is not executed"), "approved != executed");
  assert.ok(claims.includes("a permit is not an execution"), "permit != execution");
  assert.ok(
    claims.includes("not proof that no model was used"),
    "missing provenance != model-not-used",
  );
  assert.ok(
    claims.includes("not proof that the proposal was deterministic"),
    "missing provenance != deterministic",
  );

  /* ACCEPTED never claims delivery, in its own meaning. */
  assert.ok(
    /not delivered/i.test(AGENT_OUTCOME_STAGE_MEANING.ACCEPTED.doesNotMean),
    "ACCEPTED refuses delivery explicitly",
  );
  /* UNKNOWN is never a failure. */
  assert.ok(
    /not a failure/i.test(AGENT_OUTCOME_STAGE_MEANING.UNKNOWN.doesNotMean),
    "UNKNOWN refuses to be read as a failure",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 9. THE VOCABULARIES ARE THE DATABASE'S, AND EXPIRY IS THE RELEASED RULE.
 * ═════════════════════════════════════════════════════════════════════════ */
function vocabulariesMatchTheDatabase(): void {
  /*
   * TOTAL, NOT A SPOT CHECK. A value added to the enum without a counter here would be silently
   * uncounted, and a total that omits rows is a lie with a number attached.
   */
  assert.deepEqual(
    [...AGENT_PROPOSAL_STATUSES].sort(),
    [...hebyActionRequestStatusEnum.enumValues].sort(),
    "the proposal statuses counted are exactly the ones the database admits",
  );
  assert.ok(
    !AGENT_PROPOSAL_STATUSES.includes("expired" as never),
    "there is no expired proposal state — a count of one would be derived from a clock, not a record",
  );

  /* The permit vocabulary is the stored one PLUS the derived `expired`, and nothing else. */
  assert.deepEqual(
    [...AGENT_PERMIT_STATES].sort(),
    [...actionPermitStatusEnum.enumValues, "expired"].sort(),
    "permit states are the stored ones plus the one derived from the clock",
  );

  /*
   * THE EQUIVALENCE PROOF (R6B). The aggregate restates the expiry rule in SQL because a
   * TypeScript function is not reachable from inside PostgreSQL. `isExpiredPermit` is the pure
   * mirror of that SQL filter, and it must agree with the RELEASED display rule on every
   * combination of stored status and both sides of the clock.
   */
  const now = new Date("2026-08-28T12:00:00.000Z");
  const before = new Date(now.getTime() - 1_000);
  const after = new Date(now.getTime() + 1_000);
  for (const status of [...actionPermitStatusEnum.enumValues, "unknown-future-status"]) {
    for (const expiresAt of [before, now, after]) {
      assert.equal(
        isExpiredPermit(status, expiresAt, now),
        derivePermitState(status, expiresAt, now) === "expired",
        `the aggregate's expiry mirror must agree with derivePermitState for ${status} @ ${expiresAt.toISOString()}`,
      );
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 10. APPROVED IS NOT EXECUTED, AS ARITHMETIC.
 * ═════════════════════════════════════════════════════════════════════════ */
function approvalGapIsHonest(): void {
  assert.equal(approvedButUnexecuted(4, 3), 1, "one approved act never happened");
  assert.equal(approvedButUnexecuted(3, 3), 0);
  assert.equal(
    approvedButUnexecuted(2, 5),
    0,
    "a transient disagreement floors at zero — never a negative a reader must interpret",
  );
  assert.equal(approvedButUnexecuted(0, 0), 0);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 11. A ZERO-ROW AGENT IS AN ANSWER, NOT AN ABSENCE.
 * ═════════════════════════════════════════════════════════════════════════ */
function zeroRowAgentSurvivesTheJoin(): void {
  const composed = composeAgentOutcomes({
    identities: [
      {
        agentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        name: "Silent",
        humanOwnerId: null,
        humanOwnerType: null,
        createdAt: new Date(0).toISOString(),
        retiredAt: null,
        inService: true,
      },
    ],
    proposals: [],
    permits: [],
    executions: [],
    invocations: [],
    distribution: [],
  });
  assert.equal(composed.agents.length, 1, "an agent with no facts does not fall out of the join");
  assert.equal(composed.agents[0]!.activity.proposalsFiled, 0);
  assert.equal(composed.agents[0]!.modelUsage.inputTokens, 0);

  /*
   * AND A FACT ROW WITH NO IDENTITY IS COUNTED, NOT DROPPED. A join that discards rows
   * under-reports, and an under-report here reads as an agent having proposed less than it did.
   */
  const orphaned = composeAgentOutcomes({
    identities: [],
    proposals: [
      {
        agentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        filed: 7,
        pending: 7,
        approved: 0,
        rejected: 0,
        withdrawn: 0,
        withInvocationLink: 0,
        withoutInvocationLink: 7,
      },
    ],
    permits: [],
    executions: [],
    invocations: [],
    distribution: [],
  });
  assert.equal(orphaned.agents.length, 0);
  assert.equal(
    orphaned.unresolvedAgentProposals,
    7,
    "proposals whose agent identity did not resolve are counted, never silently dropped",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 12. THE PROVENANCE GAP IS REPORTED, NEVER REPAIRED.
 * ═════════════════════════════════════════════════════════════════════════ */
function provenanceIsNeverInvented(): void {
  const projection = codeOf(read(PROJECTION));
  const reader = codeOf(read(READER));
  for (const forbidden of ["backfill", "infer", "approximate", "estimate", "guess", "assume"]) {
    for (const [label, source] of [["projection", projection], ["reader", reader]] as const) {
      assert.ok(
        !new RegExp(`\\b${forbidden}\\w*\\s*\\(`, "i").test(source),
        `the ${label} must call nothing named "${forbidden}"`,
      );
    }
  }

  assert.ok(
    /not evidence that no model was used/i.test(PROVENANCE_COVERAGE_WORDING.unprovenIsNotAbsence),
    "an absent invocation record is not evidence a model was unused",
  );
  assert.ok(
    /never reconstructed/i.test(PROVENANCE_COVERAGE_WORDING.neverBackfilled),
    "and it is never reconstructed",
  );

  /* The coverage split is a PARTITION of the proposals — one cannot be silently lost. */
  const composed = composeAgentOutcomes({
    identities: [
      {
        agentId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        name: "Heby",
        humanOwnerId: null,
        humanOwnerType: null,
        createdAt: new Date(0).toISOString(),
        retiredAt: null,
        inService: true,
      },
    ],
    proposals: [
      {
        agentId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        filed: 9,
        pending: 4,
        approved: 3,
        rejected: 1,
        withdrawn: 1,
        withInvocationLink: 5,
        withoutInvocationLink: 4,
      },
    ],
    permits: [],
    executions: [],
    invocations: [],
    distribution: [],
  });
  const agent = composed.agents[0]!;
  assert.equal(
    agent.provenance.proposalsWithInvocation + agent.provenance.proposalsWithoutInvocation,
    agent.activity.proposalsFiled,
    "coverage partitions the proposals",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 13. THE BOUND IS DISCLOSED, AND IT IS THE ONLY ONE.
 * ═════════════════════════════════════════════════════════════════════════ */
function theBoundIsDisclosed(): void {
  const reader = codeOf(read(READER));

  /*
   * EXACTLY ONE BOUNDED STATEMENT IN THE READER.
   *
   * R6B's lesson is that a bound correct for a list is silently wrong for a count, so every
   * aggregate here is unbounded and only the provider/model breakdown carries one. Measured by
   * walking the statements rather than counting the word, so a `limit` added to a counting query
   * fails here.
   */
  const statements = [...reader.matchAll(/sql`([\s\S]*?)`/g)].map((m) => m[1]!);
  const bounded = statements.filter((statement) => /\blimit\b/i.test(statement));
  assert.equal(bounded.length, 1, "exactly one statement is bounded");
  assert.ok(
    bounded[0]!.includes('"provider"'),
    "and it is the provider/model breakdown — the only result set that is not one row per agent",
  );
  for (const statement of statements) {
    if (statement === bounded[0]) continue;
    assert.ok(
      !/\blimit\b/i.test(statement),
      "no counting statement carries a bound — a bounded count is a wrong number with no error",
    );
  }
  assert.equal(MODEL_DISTRIBUTION_LIMIT, 50);

  /* And the surface says so when the bound bites. */
  const surface = codeOf(read(SURFACE));
  assert.ok(
    surface.includes("distributionTruncated"),
    "the surface renders the truncation disclosure rather than truncating in silence",
  );
  assert.ok(
    /bounded list is not the whole record/i.test(AGENT_OUTCOME_WORDING.distributionTruncated),
    "and the disclosure says a bounded list is not the whole record",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 13b. THE PROJECTION WITHHOLDS THE AGENT IDENTIFIER.
 *
 * APP-2 settled the principle on `/approvals` and AGENT-PROPOSAL-2 built the seam that made it
 * unnecessary: a raw uuid is not a name. The name is already in hand here, so carrying the id as
 * well would ship an internal identifier that nothing renders and nobody can resolve.
 * ═════════════════════════════════════════════════════════════════════════ */
function theProjectionWithholdsTheAgentId(): void {
  const projection = codeOf(read(PROJECTION));
  const start = projection.indexOf("export interface AgentOutcomeObservation {");
  assert.ok(start >= 0, "the observation view type exists");
  const body = projection.slice(start, projection.indexOf("}", start));
  assert.ok(
    !/readonly\s+agentId\s*[?:]/.test(body),
    "the view crossing to the client must not carry the raw agent id",
  );
  assert.ok(
    /readonly\s+agentName\s*:/.test(body),
    "it carries the resolvable name instead",
  );

  /* And the surface renders no identifier field of any kind. */
  const surface = codeOf(read(SURFACE));
  assert.ok(!surface.includes("agentId"), "the surface names no agent id");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 14. THE ROUTE RESOLVES THE SURFACE, AND THE CEREMONY STILL COMES FIRST.
 * ═════════════════════════════════════════════════════════════════════════ */
function theRouteRenders(): void {
  const route = codeOf(read(ROUTE));
  assert.ok(route.includes("readAgentOutcomeObservation"), "the route reads the observation");
  assert.ok(
    route.includes("<AgentOutcomeObservationSurface"),
    "and renders the observation surface",
  );
  assert.ok(
    route.indexOf("<DurableAgentIdentityCard") < route.indexOf("<AgentOutcomeObservationSurface"),
    "the ceremony renders above the observation — act first, observe second",
  );

  /* THE ROUTE DID NOT LOSE ANYTHING. The released surfaces are still there. */
  assert.ok(route.includes("<AgentsTruthSurface"), "the released registry surface is unchanged");
  assert.ok(
    route.includes("readDurableAgentIdentityState"),
    "and the released identity read is unchanged",
  );

  /* The tenant is resolved server-side, once, and passed to nothing that could widen it. */
  assert.ok(
    route.includes("await resolveTenantContext()"),
    "the tenant comes from the server-resolved session",
  );
  assert.ok(
    route.includes("readAgentOutcomeObservation(tenant)"),
    "and is handed straight to the projection with no caller-supplied override",
  );
}

async function main(): Promise<void> {
  readsTheRecordsAndWritesNothing();
  reachesNoConsequentialAuthority();
  revivesNothingDead();
  noNewWriterExists();
  theSurfaceOffersNoControl();
  await tenantIsolationIsStructural();
  observesWithoutEvaluating();
  stagesAreNotCollapsed();
  vocabulariesMatchTheDatabase();
  approvalGapIsHonest();
  zeroRowAgentSurvivesTheJoin();
  provenanceIsNeverInvented();
  theBoundIsDisclosed();
  theProjectionWithholdsTheAgentId();
  theRouteRenders();

  console.log("sia1-agent-outcomes/outcome-read-firewall: OK");
}

void main();
