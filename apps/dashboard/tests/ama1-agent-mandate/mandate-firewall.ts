/*
 * AMA-1 — A MANDATE IS A CEILING, NOT A GRANT.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "The Agent Mandate Authority owns mandate state and NOTHING else. It adds exactly ONE writer
 *    and ONE Governance subject. It cannot execute, approve, mint a permit, reach a provider, read
 *    a credential, grant a permission, modify Governance, or mutate an agent. It cannot widen
 *    itself: its scope type is the released origination vocabulary, so a superset does not compile.
 *    Governance gained no mandate-state writer. `agents.authority_ceiling` gained no writer. And
 *    EXACTLY ONE module outside this feature reads a mandate to constrain anything — AMA-2's
 *    enforcement seam — proved by census rather than trusted."
 *
 * ── WHAT AMA-2 AND AMA-3 CHANGED IN THIS FILE, AND WHAT NEITHER DID ──────────
 *
 * ONE census has been INVERTED TWICE and RELAXED NEITHER TIME.
 *
 * AMA-1 measured "no proposal path reads a mandate". AMA-2 made that absence a bounded presence —
 * one named file, with every other file in all four proposal-path directories still blind to a
 * mandate. AMA-3 connected the product and Heby, taking the census to EIGHT named modules: three
 * product files that let a human read and record a ceiling, and one grounding consumer that lets
 * Heby report its own.
 *
 * The enforcement claim did not move. Reading a mandate to SHOW it is not reading one to REFUSE an
 * act, and AMA-2's own firewall proves that separately against the single seam that makes it.
 *
 * Every other assertion here is untouched: neither phase changed mandate state, the table, the
 * writer, the vocabulary or the ledger.
 *
 * The pins:
 *
 *   AGENT IDENTITY  != AGENT MANDATE
 *   AGENT MANDATE   != CAPABILITY
 *   AGENT MANDATE   != GOVERNANCE AUTHORIZATION
 *   AGENT MANDATE   != PERMIT
 *   AGENT MANDATE   != EXECUTION
 *   MANDATE RECORDED != PROPOSAL-ENFORCED
 *   IN MANDATE      != AUTHORIZED
 *   NO MANDATE      != UNBOUNDED
 *   UNAVAILABLE     != NO MANDATE
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
  AGENT_MANDATE_AUDIT_ACTIONS,
  AGENT_MANDATE_AUTHORITY_BOUNDARY,
  AGENT_MANDATE_BOUNDED_OUTCOME,
  AGENT_MANDATE_DECISION_TYPE,
  AGENT_MANDATE_DOMAIN,
  AGENT_MANDATE_ENTITY_TYPE,
  AGENT_MANDATE_SUBJECT_TYPE,
  MANDATE_CAPABILITY_LADDER,
  MANDATE_DOES_NOT_MEAN,
  MANDATE_SCOPE_VOCABULARY,
  canonicaliseMandateScope,
  isMandateScopeKind,
} from "../../src/features/agent-mandate/contracts";
import { AGENT_ORIGINABLE_ACTION_KINDS } from "../../src/features/agent-origination/contracts";
import { governanceDomainEnum } from "../../src/db/schema/_enums";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");

const FEATURE = "src/features/agent-mandate";
const WRITER = `${FEATURE}/establish-agent-mandate.server.ts`;
const READER = `${FEATURE}/read-agent-mandate.server.ts`;
const CONTRACTS = `${FEATURE}/contracts.ts`;
const BARREL = `${FEATURE}/index.ts`;
const SCHEMA = "src/db/schema/agent-mandate.ts";
const AUDIT = "src/features/governance-audit/agent-mandate-audit.server.ts";
const MIGRATION = "src/db/migrations/20260831110423_ama1_agent_mandate_authority.sql";

function collect(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    return e.isDirectory() ? collect(rel) : /\.tsx?$/.test(e.name) ? [rel] : [];
  });
}

const featureFiles = (): string[] => collect(FEATURE);

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. EXACTLY ONE MANDATE WRITER, AND AMA-1 MUTATES NO AGENT.
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
    writersOf("agentMandates"),
    [path.join(FEATURE, "establish-agent-mandate.server.ts")],
    "exactly ONE module writes a mandate",
  );

  /*
   * AND THE AGENTS TABLE STILL HAS THE SAME TWO WRITERS IT HAD BEFORE THIS PHASE. This is the
   * central boundary claim stated as a census: a mandate cannot change an agent, because no file in
   * this feature writes `agents` at all — and no new writer appeared anywhere else either.
   */
  assert.deepEqual(
    writersOf("agents"),
    [
      path.join("src", "features", "agent-identity", "create-durable-agent-identity.server.ts"),
      path.join("src", "features", "agent-identity", "retire-durable-agent-identity.server.ts"),
    ],
    "still exactly two writers of `agents` — AGENT IDENTITY != AGENT MANDATE",
  );

  /* The permission catalog stays inert. AMA-1 activated neither table. */
  for (const inert of ["permissions", "rolePermissions"]) {
    assert.deepEqual(
      writersOf(inert),
      [],
      `\`${inert}\` still has zero writers — a mandate is not a permission`,
    );
  }

  /* Only the writer writes anything durable. The reader and the contracts write nothing. */
  for (const file of [READER, CONTRACTS, BARREL]) {
    assert.ok(
      !performsDurableWrite(read(file)),
      `${file} performs no durable write — only the one writer does`,
    );
  }

  /*
   * THE READ SEAM HOLDS NO MUTATION AT ALL. Not "does not currently call one" — contains no
   * insert, update, delete or transaction, so there is nothing for a later edit to reach for.
   */
  const reader = codeOf(read(READER));
  for (const verb of ["insert", "update", "delete", "transaction"]) {
    assert.ok(
      !new RegExp(`\\.\\s*${verb}\\s*\\(`).test(reader),
      `the read seam contains no \`.${verb}(\` — it is read-only in a way that can be proved`,
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. GOVERNANCE GAINED NO MANDATE-STATE WRITER.
 *
 * The load-bearing boundary of the whole program. Governance owns the DECISION; the Agent Mandate
 * Authority owns the MANDATE. If a Governance module could write `agent_mandates`, "what this agent
 * is for" would become a Governance-derived fact — the exact collapse this program exists to avoid.
 * ═════════════════════════════════════════════════════════════════════════ */
function governanceOwnsNoMandateState(): void {
  for (const file of collect("src/features/governance-decision")) {
    const source = codeOf(read(file));
    assert.ok(
      !/\bagentMandates\b/.test(source) && !/db\/schema\/agent-mandate/.test(source),
      `${file} never names the mandate table — Governance decides about a mandate and owns none of it`,
    );
  }

  /*
   * The audit sibling is the one Governance-adjacent module that may name the mandate VOCABULARY,
   * and it still may not write the table. It imports the contracts and the shared `audit_log` sink,
   * and nothing else.
   */
  const audit = codeOf(read(AUDIT));
  assert.ok(
    !/\.\s*(?:insert|update|delete)\s*\(\s*agentMandates\s*\)/.test(audit),
    "the audit sibling appends history and never writes mandate state",
  );
  assert.ok(
    !/db\/schema\/agent-mandate/.test(audit),
    "the audit sibling does not even import the mandate table",
  );

  /*
   * AND THE DECISION WRITER LEARNED EXACTLY ONE NEW SUBJECT. `decision_records.subject_type` is
   * text, so this cost no migration — and the subject is the REVISION, never the agent.
   */
  const decisionWriter = codeOf(read("src/features/governance-decision/decision-authority.server.ts"));
  assert.ok(
    decisionWriter.includes("AGENT_MANDATE_SUBJECT_TYPE"),
    "the transaction-joinable Governance writer accepts the mandate subject",
  );
  assert.ok(
    decisionWriter.includes("AGENT_MANDATE_BOUNDED_OUTCOME"),
    "and maps it to its own outcome, checked before the generic branches",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. NO CONSEQUENTIAL CAPABILITY IS REACHABLE FROM THIS FEATURE.
 *
 * Asserted as UNREACHABLE IMPORTS rather than as unwritten calls: a module that does not import a
 * capability cannot invoke one, however it is later edited.
 * ═════════════════════════════════════════════════════════════════════════ */
function noConsequentialCapabilityIsReachable(): void {
  const forbiddenImports = [
    /* Execution and permits. */
    "action-execution",
    "single-spend",
    "consume-action-permit",
    "revoke-action-permit",
    "decide-action-request",
    "execute-",
    /* Proposal creation — AMA-1 does not participate in proposing anything. */
    "record-action-request",
    "agent-origination/originate-action",
    "heby-action-inlet",
    /* Providers, credentials and models. */
    "provider-google",
    "provider-github",
    "provider-invocation",
    "provider-connectivity",
    "integration-credential",
    "secret-encryption",
    "claude-transport",
    "heby-model",
    /* Agent lifecycle mutation and the seeded fiction. */
    "create-durable-agent-identity",
    "retire-durable-agent-identity",
    "agent-crud",
    "agents/mock",
    /* Permission and policy activation. */
    "role-permission",
    "schema/permission",
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
   * AND `agents.authority_ceiling` IS NEVER NAMED. Its column has no writer and DOES have a reader:
   * `canonical-read/actor-resolution.ts` summarizes it into `authority_ceiling_summary`. Writing a
   * mandate there would publish a CONSTRAINT as an AUTHORITY through canonical actor resolution,
   * with no test failing — so the ban is on the identifier, in both casings, across this feature
   * and its schema.
   */
  for (const file of [...featureFiles(), SCHEMA, AUDIT, MIGRATION]) {
    const source = /\.sql$/.test(file) ? read(file) : codeOf(read(file));
    assert.ok(
      !/authorityCeiling/.test(source) && !/authority_ceiling/.test(source),
      `${file} never names authority_ceiling — a mandate is not an authority ceiling`,
    );
  }

  /*
   * AND THE ONLY `agents` COLUMNS THIS FEATURE TOUCHES ARE IDENTITY AND SERVICE STATE.
   *
   * Enumerated, so a future edit that reaches for a configuration column fails here even if it only
   * READS one — reading a tool profile is how a feature starts to have an opinion about it.
   */
  const agentColumnRefs = new Set(
    featureFiles().flatMap((f) =>
      [...codeOf(read(f)).matchAll(/\bagents\s*\.\s*([A-Za-z][A-Za-z0-9_]*)/g)].map((m) => m[1]!),
    ),
  );
  assert.deepEqual(
    [...agentColumnRefs].sort(),
    ["agentLifecycleStatus", "deletedAt", "id", "retiredAt", "tenantId"],
    "the mandate authority reads an agent's identity and whether it is in service — nothing else",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. THE CEILING CANNOT BE WIDENED, AND ITS TYPE IS THE RELEASED VOCABULARY.
 * ═════════════════════════════════════════════════════════════════════════ */
function theCeilingCannotBeWidened(): void {
  /*
   * THE RELEASED ORIGINABLE VOCABULARY IS UNCHANGED, and this is asserted FIRST.
   *
   * If AMA-1 had quietly narrowed or widened what an agent may propose, every check below would
   * still be internally consistent — the mandate vocabulary IS that constant, so both would move
   * together and the identity assertion would still hold. Only pinning the VALUE catches it, and
   * it must come before the membership probes so the failure names the right defect.
   *
   * Moving that constant into a per-agent record is AMA-2's work. Changing it here would be
   * enforcement smuggled in as a default.
   */
  assert.deepEqual(
    [...AGENT_ORIGINABLE_ACTION_KINDS],
    ["send", "record-work"],
    "the released originable vocabulary is what the origination feature says it is — AMA-1 changed neither member",
  );

  /*
   * NOT A COPY — THE SAME ARRAY. `MANDATE_SCOPE_VOCABULARY` is `AGENT_ORIGINABLE_ACTION_KINDS`
   * itself, so a mandate can never admit a kind the origination path does not, and the two cannot
   * drift apart by anyone editing one of them.
   */
  assert.equal(
    MANDATE_SCOPE_VOCABULARY,
    AGENT_ORIGINABLE_ACTION_KINDS as readonly string[],
    "the mandate vocabulary IS the released originable vocabulary — the same reference, not a copy",
  );

  /* Membership, never repair. */
  for (const outside of ["grant-permission", "modify-governance-policy", "device-action", "SEND", "*", ""]) {
    assert.equal(isMandateScopeKind(outside), false, `${JSON.stringify(outside)} is not admissible`);
  }
  for (const inside of MANDATE_SCOPE_VOCABULARY) {
    assert.equal(isMandateScopeKind(inside), true, `${inside} is admissible`);
  }

  /*
   * A SCOPE NAMING ANYTHING OUTSIDE IS REFUSED WHOLE, NEVER NARROWED. Silently dropping the
   * inadmissible member would record a mandate nobody authorized — narrower than what the human
   * typed, and therefore a different mandate.
   */
  const REFUSED_WHOLE =
    "a scope naming anything outside the vocabulary is refused WHOLE by canonicaliseMandateScope";
  assert.equal(canonicaliseMandateScope(["send", "grant-permission"]), null, REFUSED_WHOLE);
  assert.equal(canonicaliseMandateScope("send"), null, REFUSED_WHOLE);
  assert.equal(canonicaliseMandateScope(null), null, REFUSED_WHOLE);

  /* An EMPTY scope is legal and means withdrawal. NO MANDATE != EMPTY MANDATE. */
  assert.deepEqual(
    canonicaliseMandateScope([]),
    [],
    "an empty scope is admissible and means withdrawal",
  );

  /* Canonical form: de-duplicated, in the vocabulary's own order — never locale collation. */
  assert.deepEqual(
    canonicaliseMandateScope(["send", "send"]),
    ["send"],
    "canonicaliseMandateScope de-duplicates into the vocabulary's own order",
  );

  /*
   * THE DATABASE AGREES WITH THE TYPE. The table's CHECK repeats the vocabulary in SQL because a
   * CHECK cannot import TypeScript, and this is where the two are pinned equal.
   */
  const schema = read(SCHEMA);
  const sqlList = /array\[([^\]]*)\]::text\[\]/.exec(schema);
  assert.ok(sqlList, "the schema states the vocabulary in SQL");
  const sqlKinds = sqlList![1]!
    .split(",")
    .map((s) => s.trim().replace(/^'|'$/g, ""))
    .filter(Boolean)
    .sort();
  assert.deepEqual(
    sqlKinds,
    [...AGENT_ORIGINABLE_ACTION_KINDS].sort(),
    "the storage-layer CHECK admits exactly the released originable kinds — no more, no fewer",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. THE TABLE CLAIMS NO FACT AMA-1 CANNOT PROVE.
 * ═════════════════════════════════════════════════════════════════════════ */
function theTableClaimsNothingExtra(): void {
  const schema = codeOf(read(SCHEMA));
  const migration = read(MIGRATION);

  for (const forbidden of [
    "status",
    "withdrawn",
    "is_current",
    "isCurrent",
    "superseded_at",
    "supersededAt",
    "enforced",
    "applied_at",
    "appliedAt",
    "permit",
    "credential",
    "secret",
    "token",
  ]) {
    assert.ok(
      !new RegExp(`\\b${forbidden}\\b`).test(schema),
      `the mandate schema declares no \`${forbidden}\` — AMA-1 may not claim that fact`,
    );
  }

  /* The five structural guarantees, present in the migration as constraints rather than as hopes. */
  for (const constraint of [
    "agent_mandates_scope_subset_chk",
    "agent_mandates_human_establisher_chk",
    "agent_mandates_lineage_chk",
    "agent_mandates_tenant_agent_fk",
    "agent_mandates_tenant_agent_revision_uq",
  ]) {
    assert.ok(migration.includes(constraint), `the migration creates ${constraint}`);
  }

  /* AMA-1 touches ONE table. The migration creates no other, and alters no existing one. */
  const created = [...migration.matchAll(/CREATE TABLE "([a-z_]+)"/g)].map((m) => m[1]!);
  assert.deepEqual(created, ["agent_mandates"], "exactly one table is created");
  const alteredTables = new Set(
    [...migration.matchAll(/ALTER TABLE "([a-z_]+)"/g)].map((m) => m[1]!),
  );
  assert.deepEqual(
    [...alteredTables],
    ["agent_mandates"],
    "no existing table is altered — `agents` in particular is byte-unchanged by this migration",
  );

  /* One enum value added, and it is the mandate domain. */
  const enumAdds = [...migration.matchAll(/ALTER TYPE "public"\."([a-z_]+)" ADD VALUE '([^']+)'/g)];
  assert.deepEqual(
    enumAdds.map((m) => [m[1]!, m[2]!]),
    [["governance_domain", AGENT_MANDATE_DOMAIN]],
    "exactly one enum value is added, and it is the mandate's own Governance domain",
  );
  assert.ok(
    (governanceDomainEnum.enumValues as readonly string[]).includes(AGENT_MANDATE_DOMAIN),
    "the schema enum carries the value the migration adds",
  );
  /*
   * AND `agent-registration` STAYS UNUSED. It has existed since the foundation baseline, and
   * reusing it would have said an agent came into existence — an act `features/agent-identity`
   * owns and a mandate decision never performs.
   */
  const domainUsers = collect("src")
    .filter((f) => new RegExp(`["']agent-registration["']`).test(codeOf(read(f))))
    .filter((f) => !f.startsWith(path.join("src", "db", "schema")));
  assert.deepEqual(domainUsers, [], "`agent-registration` is still claimed by nobody");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6. AMA-1 IS NOT PROPOSAL ENFORCEMENT, AND THE ABSENCE IS MEASURED.
 *
 * The truth requirement of this phase. A mandate exists and NOTHING reads it to constrain a
 * proposal — so the proof is that no module outside this feature imports it at all.
 * ═════════════════════════════════════════════════════════════════════════ */
function noProposalEnforcementExists(): void {
  const importers = collect("src")
    .filter((f) => !f.startsWith(FEATURE))
    .filter((f) => {
      const source = codeOf(read(f));
      /*
       * The relative form is checked too. The schema barrel re-exports the table as
       * `export * from "./agent-mandate"`, which neither absolute pattern matches — and a census
       * that silently missed the one module re-exporting the table would be measuring the wrong
       * absence.
       */
      return (
        /features\/agent-mandate/.test(source) ||
        /db\/schema\/agent-mandate/.test(source) ||
        /["']\.\/agent-mandate["']/.test(source)
      );
    })
    .sort();

  /*
   * EXACTLY EIGHT, EXACTLY ONE OF WHICH ENFORCES — INVERTED TWICE, RELAXED NEITHER TIME.
   *
   * AMA-1's census read "exactly three, and NONE is a proposal path", and that sentence was the
   * measured absence of enforcement. AMA-2 does not delete it and does not widen it to "any
   * proposal module may read a mandate": it names the ONE module that may, so a second enforcement
   * point added anywhere still fails here.
   *
   * The schema barrel re-exports the table, as it does every table. The Governance decision writer
   * learned the subject type. The audit sibling names the vocabulary. The agent-originated proposal
   * writer READS the effective mandate before it writes — the seam AMA-2 exists to be.
   *
   * AMA-3 ADDED FOUR, AND NONE OF THEM ENFORCES ANYTHING. Three product files let a human read and
   * record a ceiling, and one grounding consumer lets Heby report its own. Reading a mandate to
   * SHOW it, and reading one to REFUSE an act, are different things — AMA-2's firewall proves the
   * enforcement claim separately, against the one seam that makes it.
   *
   *     RENDERING A CEILING != ENFORCING ONE     GROUNDING ON ONE != ENFORCING ONE
   */
  assert.deepEqual(
    importers,
    [
      /* AMA-3. The product surface a human records a mandate through, and the surface that shows one. */
      path.join("src", "app", "(dashboard)", "agents", "actions.ts"),
      path.join("src", "app", "(dashboard)", "agents", "page.tsx"),
      path.join("src", "components", "agents", "agent-mandate-card.tsx"),
      path.join("src", "db", "schema", "index.ts"),
      path.join("src", "features", "action-authorization", "record-action-request.server.ts"),
      path.join("src", "features", "governance-audit", "agent-mandate-audit.server.ts"),
      path.join("src", "features", "governance-decision", "decision-authority.server.ts"),
      /* AMA-3. Heby's answer flow, which imports the mandate authority's own read projection. */
      path.join("src", "features", "heby-answer", "model-answer.server.ts"),
    ],
    "eight modules know a mandate exists, and each is named: the schema barrel, the audit sibling, the Governance decision writer, ONE proposal writer, THREE product files and ONE grounding consumer",
  );

  /*
   * THE ENFORCEMENT SEAM IS ONE FILE, AND EVERY OTHER PROPOSAL-PATH FILE IS STILL BLIND TO A
   * MANDATE. Enumerated as an exemption of one named file rather than an exemption of its
   * directory: `action-authorization` holds the decision writer, the permit consumer, the revoker
   * and the executor's neighbours, and none of those may acquire a ceiling of its own.
   */
  const ENFORCEMENT_SEAM = path.join(
    "src",
    "features",
    "action-authorization",
    "record-action-request.server.ts",
  );
  for (const dir of [
    "src/features/agent-origination",
    "src/features/action-authorization",
    "src/features/heby-action-inlet",
    "src/features/heby-actions",
  ]) {
    for (const file of collect(dir)) {
      if (file === ENFORCEMENT_SEAM) continue;
      const source = codeOf(read(file));
      /*
       * BANNED: REACHING A MANDATE. Not the SUBSTRING `agent-mandate`, which the refusal vocabulary
       * in `action-authorization/contracts.ts` legitimately contains — `no-agent-mandate` and
       * `action-outside-agent-mandate` are the names of two refusals, and a name is not a read.
       * AMA-1 already learned this shape once, on the writer that must SAY the words it denies:
       * a guard that punishes honest vocabulary is aimed wrong. So the ban is on the import, the
       * table and the read symbol — the three ways a module could actually consult a mandate.
       */
      for (const reach of [
        /features\/agent-mandate/,
        /db\/schema\/agent-mandate/,
        /\bagentMandates\b/,
        /\breadEffectiveAgentMandate\b/,
        /\breadAgentMandateHistory\b/,
      ]) {
        assert.ok(
          !reach.test(source),
          `${file} does not read a mandate (${reach.source}) — enforcement is ONE seam, not a directory`,
        );
      }
    }
  }

  /*
   * AND THE SEAM ITSELF READS, WITHOUT REACHING THE WRITER.
   *
   * It imports the READ SEAM MODULE, never `@/features/agent-mandate` — the barrel re-exports
   * `establishAgentMandate`, and pulling it into the proposal path's import graph would put a
   * Governance-bound mandate writer one call away from the module that files proposals. Asserted
   * as an import, so it is unreachable rather than merely uncalled.
   */
  const seam = codeOf(read(ENFORCEMENT_SEAM));
  assert.ok(
    seam.includes("agent-mandate/read-agent-mandate.server"),
    "the enforcement seam reads through the released read seam",
  );
  assert.ok(
    seam.includes("readEffectiveAgentMandate"),
    "and asks for the EFFECTIVE mandate — the highest revision, derived and never stored",
  );
  for (const forbidden of [
    '"@/features/agent-mandate"',
    "establishAgentMandate",
    "agentMandates",
    "readAgentMandateHistory",
  ]) {
    assert.ok(
      !seam.includes(forbidden),
      `the enforcement seam does not reach ${forbidden} — enforcing a bound cannot alter one`,
    );
  }
  assert.ok(
    !/\.\s*(?:insert|update|delete)\s*\(\s*agentMandates\s*\)/.test(seam),
    "and writes no mandate state",
  );

  /* The ladder says so too, and it cannot lose a rung. */
  const reached = MANDATE_CAPABILITY_LADDER.filter((r) => r.reached).map((r) => r.rung);
  assert.deepEqual(
    reached,
    ["MANDATE RECORDED", "PROPOSAL-ENFORCED"],
    "exactly two rungs are reached at AMA-2 — recording and proposal enforcement, and nothing above",
  );
  for (const unreached of ["HEBY-GROUNDED", "PERMIT-BEARING", "EXECUTABLE"]) {
    assert.ok(
      MANDATE_CAPABILITY_LADDER.some((r) => r.rung === unreached && !r.reached),
      `${unreached} is declared unreached`,
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 7. THE VOCABULARY MEANS WHAT IT SAYS.
 * ═════════════════════════════════════════════════════════════════════════ */
function theVocabularyIsHonest(): void {
  assert.equal(AGENT_MANDATE_SUBJECT_TYPE, "agent_mandate");
  assert.equal(AGENT_MANDATE_ENTITY_TYPE, "agent_mandate");
  assert.equal(AGENT_MANDATE_DECISION_TYPE, "approve");
  assert.equal(AGENT_MANDATE_DOMAIN, "agent-mandate");
  /*
   * THE OUTCOME IS NOT `approved`. A ledger row read years later must not suggest an agent was
   * approved, or that an act was authorized. What was approved is a BOUND.
   */
  assert.equal(AGENT_MANDATE_BOUNDED_OUTCOME, "agent-mandate-bounded");
  assert.ok(!/authorized|approved|granted|permitted/.test(AGENT_MANDATE_BOUNDED_OUTCOME));

  /* Two audit actions, both about a record changing. Neither claims enforcement or application. */
  assert.deepEqual(
    [...AGENT_MANDATE_AUDIT_ACTIONS],
    ["agent-mandate.established", "agent-mandate.revised"],
    "the audit vocabulary is closed at the two forms of the one write",
  );
  for (const action of AGENT_MANDATE_AUDIT_ACTIONS) {
    assert.ok(
      !/applied|enforced|executed|granted|authorized/.test(action),
      `${action} claims no capability AMA-1 lacks`,
    );
  }

  /* The eight things a mandate never means. The list cannot lose an entry. */
  assert.deepEqual(
    [...MANDATE_DOES_NOT_MEAN],
    [
      "authorized to execute",
      "authorized to approve",
      "authorized to issue permits",
      "authorized to access a provider",
      "authorized to grant permissions",
      "authorized to modify Governance",
      "authorized to widen its own mandate",
      "authorized to perform every technically available capability",
    ],
    "every consequence a mandate must never imply is named",
  );

  /* Six owners, six concerns, and the mandate owns exactly one of them. */
  assert.deepEqual(
    Object.keys(AGENT_MANDATE_AUTHORITY_BOUNDARY).sort(),
    [
      "actionAuthorization",
      "agentIdentity",
      "agentMandate",
      "capabilityRegistry",
      "execution",
      "governance",
    ],
    "the six-owner boundary is stated as data",
  );

  /*
   * THE WRITER DOES NOT ADVERTISE A CAPABILITY IT LACKS. Scoped to the writer's own code rather
   * than a directory-wide substring ban, because `MANDATE_DOES_NOT_MEAN` must SAY these words —
   * denying them is its whole job, and a guard that punishes an honest denial is aimed wrong.
   */
  const writer = codeOf(read(WRITER));
  for (const banned of ["executeAction", "issuePermit", "grantPermission", "dispatch("]) {
    assert.ok(!writer.includes(banned), `the writer contains no ${banned}`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 8. THE BARREL EXPORTS NO SECOND TRANSITION.
 * ═════════════════════════════════════════════════════════════════════════ */
function noSecondTransitionIsExported(): void {
  const barrel = codeOf(read(BARREL));
  for (const verb of [
    "updateAgentMandate",
    "deleteAgentMandate",
    "withdrawAgentMandate",
    "enforceAgentMandate",
    "applyAgentMandate",
    "mandateAllows",
    "checkAgentMandate",
  ]) {
    assert.ok(!barrel.includes(verb), `the barrel exports no ${verb} — no such surface exists`);
  }
  assert.ok(barrel.includes("establishAgentMandate"), "the one transition is exported");
  assert.ok(barrel.includes("readEffectiveAgentMandate"), "the effective read is exported");
  assert.ok(barrel.includes("readAgentMandateHistory"), "the history read is exported");
}

exactlyOneWriter();
governanceOwnsNoMandateState();
noConsequentialCapabilityIsReachable();
theCeilingCannotBeWidened();
theTableClaimsNothingExtra();
noProposalEnforcementExists();
theVocabularyIsHonest();
noSecondTransitionIsExported();

console.log("ama1-agent-mandate/mandate-firewall: OK");
