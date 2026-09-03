/*
 * AMA-2 — THE CEILING IS ENFORCED IN EXACTLY ONE PLACE, AND IT SUBTRACTS ONLY.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "Agent Mandate Authority constrains agent-originated proposal creation through ONE seam — the
 *    writer that makes such a proposal durable — and through nothing else. No UI, no prompt, no
 *    capability descriptor, no seeded workforce adapter, no Governance module, no execution path
 *    and no provider adapter consults a mandate. The gate runs BEFORE the insert. The HUMAN writer
 *    reads no mandate at all. AMA-2 added no table, no migration, no column, no enum value, no
 *    action kind, no permission, no permit, no execution and no agent authentication — the ceiling
 *    can only ever SUBTRACT from what the released origination vocabulary already permitted."
 *
 * The pins:
 *
 *   MANDATE RECORDED  != PROPOSAL-ENFORCED   (AMA-1's pin — now crossed, deliberately, once)
 *   IN MANDATE        != AUTHORIZED
 *   NO MANDATE        != UNLIMITED MANDATE
 *   UNAVAILABLE       != NO MANDATE
 *   PROPOSAL REFUSED  != GOVERNANCE REJECTION
 *
 * Structural assertions run over comment-stripped source, so this phase's own honest prose about
 * what it refuses to do can never satisfy — or trip — a check about what it does.
 * Pure: no database, no network, no model.
 */
import "../../src/db/schema";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { codeOf } from "../helpers/durable-write-detector";
import {
  AGENT_ORIGINABLE_ACTION_KINDS,
  AGENT_ORIGINABLE_REGISTRY_KIND,
  SEND_ORIGINATION_ALIAS,
} from "../../src/features/agent-origination/contracts";
import { SEND_ACTION_KIND } from "../../src/features/heby-action-inlet/contracts";
import { MANDATE_CAPABILITY_LADDER } from "../../src/features/agent-mandate/contracts";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");

const SEAM = "src/features/action-authorization/record-action-request.server.ts";
/* AMA-3. The product surface that RENDERS a mandate. It reads one; it enforces nothing. */
const PRODUCT_SURFACE = "src/app/(dashboard)/agents/page.tsx";
const CONTRACTS = "src/features/action-authorization/contracts.ts";
const ORIGINATION_CONTRACTS = "src/features/agent-origination/contracts.ts";
const MANDATE_FEATURE = "src/features/agent-mandate";
const JOURNAL = "src/db/migrations/meta/_journal.json";

/** The three refusals AMA-2 added. Stated here so the census below cannot quietly lose one. */
const MANDATE_REFUSALS = [
  "agent-mandate-authority-unavailable",
  "no-agent-mandate",
  "action-outside-agent-mandate",
] as const;

function collect(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    return e.isDirectory() ? collect(rel) : /\.tsx?$/.test(e.name) ? [rel] : [];
  });
}

/** The agent entry point's own body — every ordering claim is scoped to it, never to the file. */
function agentEntryBody(): string {
  const code = codeOf(read(SEAM));
  const start = code.indexOf("recordAgentOriginatedActionRequest(");
  assert.notEqual(start, -1, "the agent entry point exists under its released name");
  const end = code.indexOf("function isUniqueViolation", start);
  assert.notEqual(end, -1, "the body is bounded by the next declaration, not by the file end");
  return code.slice(start, end);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. EXACTLY ONE ENFORCEMENT SEAM, MEASURED OVER ALL OF `src/`.
 *
 * A census, not an inspection of the files this phase happened to touch. A second module that
 * learned to consult a mandate — anywhere, for any reason — fails here.
 * ═════════════════════════════════════════════════════════════════════════ */
function exactlyOneEnforcementSeam(): void {
  const consumers = collect("src")
    .filter((f) => !f.startsWith(MANDATE_FEATURE))
    .filter((f) => {
      const source = codeOf(read(f));
      return (
        /\breadEffectiveAgentMandate\b/.test(source) || /\breadAgentMandateHistory\b/.test(source)
      );
    })
    .sort();

  /*
   * TWO READERS, AND ONLY ONE OF THEM ENFORCES — AMA-3 INVERTED THIS NARROWLY, IT DID NOT RELAX IT.
   *
   * AMA-2's census read "exactly ONE module reads a mandate", which was the same sentence as
   * "exactly one module enforces one" only while nothing could DISPLAY a mandate. AMA-3 gave the
   * product a surface, and a surface that renders a ceiling constrains nothing — it writes no
   * request row, and it is not on any proposal path.
   *
   * So the two claims are separated: the readers are named exhaustively, and the ENFORCEMENT claim
   * is asserted below against the seam alone. A third reader added anywhere still fails here.
   */
  assert.deepEqual(
    consumers,
    [PRODUCT_SURFACE, SEAM],
    "exactly TWO modules outside the mandate authority read a mandate: the product surface renders one, the proposal writer enforces one",
  );

  /*
   * AND THE PRODUCT SURFACE ENFORCES NOTHING. It holds no proposal writer, no request table and no
   * ceiling gate — reading a mandate to show a human is not reading one to refuse an act.
   *
   *     RENDERING A CEILING != ENFORCING ONE
   */
  const surface = codeOf(read(PRODUCT_SURFACE));
  for (const forbidden of [
    "recordAgentOriginatedActionRequest",
    "recordActionRequest",
    "hebyActionRequests",
    "mandateCeilingRefusal",
    "AGENT_ORIGINABLE_REGISTRY_KIND",
  ]) {
    assert.ok(
      !surface.includes(forbidden),
      `the product surface does not reach ${forbidden} — it renders a ceiling, it does not apply one`,
    );
  }

  /*
   * AND IT CONSULTS IT EXACTLY ONCE. Two call sites would be two gates, and two gates can disagree
   * — the ordinary way an "enforced" constraint quietly becomes enforced on only one branch. Zero
   * call sites is the other failure: the import would remain, so the census above would still list
   * this module while nothing was actually being enforced.
   */
  const seam = codeOf(read(SEAM));
  assert.equal(
    (seam.match(/readEffectiveAgentMandate\s*\(/g) ?? []).length,
    1,
    "the mandate is read at exactly one call site",
  );
  assert.equal(
    (seam.match(/mandateCeilingRefusal\s*\(/g) ?? []).length,
    2,
    "the gate is declared once and invoked exactly once — never zero, never twice",
  );

  /*
   * THE HUMAN WRITER IS NOT THE SEAM. `recordActionRequest`'s own body must contain no mandate
   * anything: a human's authority to propose is not derived from what an agent was bounded to.
   */
  const humanStart = seam.indexOf("recordActionRequest(");
  const humanEnd = seam.indexOf("recordAgentOriginatedActionRequest(", humanStart);
  assert.ok(humanStart !== -1 && humanEnd > humanStart, "the human entry point is locatable");
  const humanBody = seam.slice(humanStart, humanEnd);
  for (const banned of ["mandateCeilingRefusal", "readEffectiveAgentMandate", "Mandate"]) {
    assert.ok(
      !humanBody.includes(banned),
      `the human writer never mentions ${banned} — AGENT MANDATE CONSTRAINS AGENTS, NOT HUMANS`,
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. ENFORCEMENT IS NOWHERE IT MUST NOT BE.
 *
 * Named surfaces, each of which would turn a constraint into either advice or a second authority.
 * Asserted as UNREACHABLE, because a directory that does not mention a mandate cannot consult one
 * however it is later edited.
 * ═════════════════════════════════════════════════════════════════════════ */
function enforcementIsNotSmearedAcrossTheSystem(): void {
  const FORBIDDEN_HOMES: readonly string[] = [
    /* A UI gate is advice: the server is still reachable without it. */
    "src/app",
    "src/components",
    /* A prompt gate is a suggestion to a model, and a model is not an enforcement mechanism. */
    "src/features/agent-origination",
    "src/features/heby-model",
    "src/features/heby-answer",
    /* A descriptor gate would make the ceiling a property of the capability, not of the agent. */
    "src/features/heby-actions",
    /* Execution and permits are downstream: a ceiling that reached them would be a second gate. */
    "src/features/action-execution",
    /* Providers are further downstream still. */
    "src/features/providers",
  ];
  /*
   * AMA-3's THREE PRODUCT FILES ARE EXEMPTED BY NAME, NEVER BY DIRECTORY.
   *
   * A human must be able to read and record a mandate, and that surface lives under `src/app` and
   * `src/components` — the two trees this section otherwise bans outright. Exempting the
   * DIRECTORIES would have let any page in the product acquire a ceiling of its own; exempting
   * three named files keeps the ban exactly as strong everywhere else, and each of the three is
   * proved below to enforce nothing.
   */
  const PRODUCT_EXEMPT = new Set(
    [
      "src/app/(dashboard)/agents/page.tsx",
      "src/app/(dashboard)/agents/actions.ts",
      "src/components/agents/agent-mandate-card.tsx",
      /*
       * AMA-3 — HEBY'S ANSWER FLOW READS A MANDATE AS EVIDENCE, AND AMA-2's CLAIM IS UNCHANGED.
       *
       * This directory was banned because "a model is not an enforcement mechanism". It still is
       * not: nothing here gates an act on a mandate, and the class it composes reaches model
       * context as GROUNDING DATA. Heby can now say what it may propose; it still cannot decide
       * whether anything may be proposed, and the seam that does is untouched.
       *
       *     GROUNDING ON A CEILING != ENFORCING ONE
       */
      "src/features/heby-answer/model-answer.server.ts",
    ].map((f) => path.join(...f.split("/"))),
  );
  for (const dir of FORBIDDEN_HOMES) {
    for (const file of collect(dir)) {
      if (PRODUCT_EXEMPT.has(file)) continue;
      const source = codeOf(read(file));
      for (const reach of [
        /features\/agent-mandate/,
        /db\/schema\/agent-mandate/,
        /\bagentMandates\b/,
        /\breadEffectiveAgentMandate\b/,
      ]) {
        assert.ok(
          !reach.test(source),
          `${file} does not enforce a mandate (${reach.source}) — enforcement is ONE writer seam`,
        );
      }
    }
  }

  /*
   * AND THE THREE EXEMPTED FILES ENFORCE NOTHING. Each may read a mandate and one may call the
   * released writer; none may reach the proposal path, the request table or the ceiling gate.
   *
   *     RENDERING A CEILING != ENFORCING ONE     RECORDING A CEILING != ENFORCING ONE
   */
  for (const file of PRODUCT_EXEMPT) {
    const source = codeOf(read(file));
    for (const forbidden of [
      "recordAgentOriginatedActionRequest",
      "recordActionRequest",
      "hebyActionRequests",
      "mandateCeilingRefusal",
      "AGENT_ORIGINABLE_REGISTRY_KIND",
      "agentMandates",
    ]) {
      assert.ok(
        !source.includes(forbidden),
        `${file} does not reach ${forbidden} — the product asks an authority, it is not one`,
      );
    }
  }

  /*
   * GOVERNANCE IS A NARROWER BAN, AND DELIBERATELY SO. `decision-authority.server.ts` imports the
   * mandate CONTRACTS — it learned the subject type at AMA-1, which is how a human authorizes a
   * mandate change at all. Banning the whole feature path there would punish a released, correct
   * import; what must stay true is that Governance never READS mandate state and never becomes the
   * thing that applies a ceiling. AMA-1 already proves it names no table; this adds the read.
   */
  for (const file of collect("src/features/governance-decision")) {
    const source = codeOf(read(file));
    for (const reach of [/\breadEffectiveAgentMandate\b/, /\breadAgentMandateHistory\b/, /\bagentMandates\b/]) {
      assert.ok(
        !reach.test(source),
        `${file} reads no mandate state (${reach.source}) — Governance decides ABOUT a mandate and applies none`,
      );
    }
  }

  /*
   * AND THE SEEDED WORKFORCE FICTION IN PARTICULAR. A mandate read from mock data would make the
   * ceiling a display property of a demo rather than a fact about a durable agent.
   */
  const seeded = collect("src").filter((f) => /mock|seed|fixture/i.test(path.basename(f)));
  for (const file of seeded) {
    assert.ok(
      !/agent-mandate|agentMandates|readEffectiveAgentMandate/.test(codeOf(read(file))),
      `${file} holds no mandate — a ceiling is never a seeded property`,
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. THE GATE RUNS BEFORE THE WRITE, AND THE REFUSAL IS THE ONLY OTHER EXIT.
 * ═════════════════════════════════════════════════════════════════════════ */
function theGatePrecedesTheWrite(): void {
  const body = agentEntryBody();
  const gate = body.indexOf("mandateCeilingRefusal(");
  const insert = body.indexOf("insertActionRequest(");
  assert.notEqual(gate, -1, "the agent entry point consults the ceiling");
  assert.notEqual(insert, -1, "and still delegates to the one writer");
  assert.ok(
    gate < insert,
    "THE CEILING IS CONSULTED BEFORE THE INSERT — a refusal therefore leaves no row to withdraw",
  );

  /* The gate's result is refused, never logged-and-continued. */
  assert.ok(
    /if\s*\(\s*ceiling\s*\)\s*return\s+refused\(\s*ceiling\s*\)/.test(body.replace(/\s+/g, " ")),
    "an out-of-ceiling result RETURNS a refusal — there is no continue-anyway branch",
  );

  /*
   * AND THE WRITER ITSELF IS UNCHANGED IN ARITY. `insertActionRequest` is still called from exactly
   * two places — the human entry point and the agent one — so AMA-2 added no third path into the
   * table that could bypass the gate.
   */
  const seam = codeOf(read(SEAM));
  assert.equal(
    (seam.match(/insertActionRequest\s*\(/g) ?? []).length,
    3,
    "the private writer is declared once and called from exactly the two entry points",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. THREE STATES, THREE NAMES, AND NONE OF THEM CLAIMS AN AUTHORITY.
 * ═════════════════════════════════════════════════════════════════════════ */
function theRefusalVocabularyIsHonest(): void {
  const contracts = codeOf(read(CONTRACTS));
  for (const refusal of MANDATE_REFUSALS) {
    assert.ok(
      contracts.includes(`"${refusal}"`),
      `the refusal vocabulary declares ${refusal}`,
    );
  }
  assert.equal(
    new Set(MANDATE_REFUSALS).size,
    3,
    "three DISTINCT values — an outage, an absence and an exclusion never collapse into one",
  );

  /*
   * NONE OF THEM SAYS ANYTHING ABOUT AUTHORIZATION. A refusal to FILE a proposal is not a
   * Governance rejection, and a name that suggested otherwise would put a decision in the ledger's
   * vocabulary that no human ever took.
   */
  for (const refusal of MANDATE_REFUSALS) {
    assert.ok(
      !/approved|rejected|denied|authorized|permitted|granted/.test(refusal),
      `${refusal} claims no decision — PROPOSAL REFUSED != GOVERNANCE REJECTION`,
    );
  }

  /*
   * AND THE SEAM RETURNS EXACTLY THESE THREE FROM THE GATE. Typed as an `Extract` of the released
   * refusal union, so a value that is not already an admissible refusal does not compile — the gate
   * cannot invent a vocabulary of its own.
   */
  const seam = codeOf(read(SEAM));
  assert.ok(
    /type\s+MandateCeilingRefusal\s*=\s*Extract<\s*ActionRequestRefusal/.test(seam),
    "the gate's result type is carved out of the released refusal union, never declared beside it",
  );
  for (const refusal of MANDATE_REFUSALS) {
    assert.ok(seam.includes(`"${refusal}"`), `the gate can return ${refusal}`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. THE ALIAS MAP IS TOTAL, AND IT IS THE RELEASED CONSTANTS.
 *
 * The defect this map exists to prevent: `mandate.proposalScope` speaks ALIASES and
 * `prepared.actionKind` speaks REGISTRY KINDS. Comparing them directly matches nothing, so a naive
 * ceiling would refuse every proposal — including the ones a mandate admits — while looking
 * perfectly fail-closed.
 * ═════════════════════════════════════════════════════════════════════════ */
function theAliasMapIsTotalAndReleased(): void {
  assert.notEqual(
    SEND_ORIGINATION_ALIAS as string,
    SEND_ACTION_KIND as string,
    "the alias and the registry kind really are different strings — the map is not decoration",
  );
  assert.deepEqual(
    Object.keys(AGENT_ORIGINABLE_REGISTRY_KIND).sort(),
    [...AGENT_ORIGINABLE_ACTION_KINDS].sort(),
    "the map is TOTAL over the released originable vocabulary — no alias is missing a kind",
  );
  assert.equal(
    AGENT_ORIGINABLE_REGISTRY_KIND[SEND_ORIGINATION_ALIAS],
    SEND_ACTION_KIND,
    "and it maps to the released constant itself, so the inlet and the ceiling cannot drift",
  );
  assert.ok(
    Object.isFrozen(AGENT_ORIGINABLE_REGISTRY_KIND),
    "the map cannot be widened at runtime",
  );

  /*
   * THE VOCABULARY IS NOT THIS PHASE'S TO CHANGE. AMA-2 admits nothing new; it can only subtract.
   * GIA-1 admitted `record-work` — through the origination vocabulary, its total map and the
   * storage-layer CHECK together — which is why this value moved without this file's mechanism
   * moving at all.
   */
  assert.deepEqual(
    [...AGENT_ORIGINABLE_ACTION_KINDS],
    ["send", "record-work"],
    "AGENT_ORIGINABLE_ACTION_KINDS is what the origination feature released — a ceiling never widens the floor",
  );

  /*
   * THE MAP HAS NO REVERSE DIRECTION. A registry-kind-to-alias lookup would let a kind no alias
   * denotes resolve to one, which is exactly what a ceiling has to be able to refuse.
   */
  const source = codeOf(read(ORIGINATION_CONTRACTS));
  for (const banned of ["REGISTRY_KIND_ALIAS", "aliasForRegistryKind", "registryKindToAlias"]) {
    assert.ok(!source.includes(banned), `no reverse map (${banned}) exists`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6. AMA-2 CREATED NO SCHEMA, NO CAPABILITY AND NO NEW AUTHORITY.
 * ═════════════════════════════════════════════════════════════════════════ */
function amA2AddedNothingToTheDatabase(): void {
  /*
   * THE LEDGER DID NOT MOVE. AMA-1 carried it 39 -> 40; enforcement is a read, and a read needs no
   * migration. Pinned as an exact count so a migration added anywhere in this phase fails here.
   */
  const journal = JSON.parse(read(JOURNAL)) as { entries: readonly unknown[] };
  assert.equal(
    journal.entries.length,
    47, /* WEV-1 grew the ledger 44 -> 45; PBGA-1 45 -> 46; CGO-1 46 -> 47 (content-draft + destination). */
    "the migration ledger is unchanged by AMA-2 — it is a read, not a schema change", /* WORK-1 grew the ledger 41 -> 42: the Organizational Work Authority table. */
  );

  /*
   * EXACTLY ONE MIGRATION EVER TOUCHED `agent_mandates`, AND IT IS AMA-1'S.
   *
   * Scoped to the table rather than to the word "enforce": released migrations unrelated to this
   * program legitimately use that word about other things, and a guard that failed on them would be
   * measuring the wrong absence. What matters is that AMA-2 altered no mandate storage.
   */
  const migrations = readdirSync(path.join(ROOT, "src/db/migrations")).filter((f) =>
    f.endsWith(".sql"),
  );
  const mandateMigrations = migrations
    .filter((f) => /agent_mandates/.test(read(path.join("src/db/migrations", f))))
    .sort();
  /*
   * TWO MIGRATIONS NOW NAME THE TABLE, AND NEITHER IS AMA-2'S.
   *
   * AMA-1 created it. GIA-1 widened ONE CHECK — the `proposal_scope` subset test — because the
   * released origination vocabulary gained `record-work` and this table's storage-layer ceiling is
   * that vocabulary's echo. It added no column, no index, no status flag and no writer, which is
   * what the per-column assertions below still prove about BOTH files.
   *
   * The list is pinned by name rather than by count so a third migration touching mandate storage
   * fails here, loudly, whoever authors it.
   */
  assert.deepEqual(
    mandateMigrations,
    [
      "20260831110423_ama1_agent_mandate_authority.sql",
      "20260902115846_gia1_record_work_mandate_scope.sql",
    ],
    "only AMA-1's table and GIA-1's scope widening ever touched mandate storage — AMA-2 altered none",
  );
  const mandateSql = mandateMigrations
    .map((file) => read(path.join("src/db/migrations", file)))
    .join("\n");
  for (const forbidden of ["enforced", "applied_at", "consumed_at", "last_checked_at"]) {
    assert.ok(
      !new RegExp(`\\b${forbidden}\\b`).test(mandateSql),
      `mandate storage declares no \`${forbidden}\` — enforcement writes nothing back`,
    );
  }

  /* The permission catalog is still inert. A mandate is not a permission, before or after AMA-2. */
  const writersOf = (symbol: string): string[] =>
    collect("src")
      .filter((f) =>
        new RegExp(`\\.\\s*(?:insert|update|delete)\\s*\\(\\s*${symbol}\\s*\\)`).test(
          codeOf(read(f)),
        ),
      )
      .sort();
  for (const inert of ["permissions", "rolePermissions"]) {
    assert.deepEqual(writersOf(inert), [], `\`${inert}\` still has zero writers`);
  }
  assert.deepEqual(
    writersOf("agentMandates"),
    [path.join(MANDATE_FEATURE, "establish-agent-mandate.server.ts")],
    "still exactly ONE mandate writer — enforcing a bound did not become a way to change one",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 7. THE SEAM GAINED NO CONSEQUENTIAL REACH.
 *
 * The enforcement seam is now the module that knows the most about an agent in this repository.
 * That is exactly the module that must be proved unable to do anything with the knowledge.
 * ═════════════════════════════════════════════════════════════════════════ */
function theSeamGainedNoCapability(): void {
  const source = codeOf(read(SEAM));
  const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);
  for (const forbidden of [
    /* Permits, decisions, execution. */
    "action-permit",
    "decide-action-request",
    "consume-action-permit",
    "revoke-action-permit",
    "action-execution",
    "execute-",
    "schema/action-permit",
    /* Governance authority. */
    "bootstrap-authority",
    "decision-authority",
    "authority-read",
    /* Providers, credentials, models. */
    "provider-google",
    "provider-github",
    "provider-invocation",
    "integration-credential",
    "secret-encryption",
    "claude-transport",
    "heby-model",
    /* Mandate MUTATION. The barrel that re-exports it is banned separately, by EXACT specifier. */
    "agent-mandate/establish-agent-mandate",
    /* Agent lifecycle mutation. */
    "create-durable-agent-identity",
    "retire-durable-agent-identity",
    /* Permission activation. */
    "role-permission",
    "schema/permission",
  ]) {
    assert.ok(
      !imports.some((i) => i.includes(forbidden)),
      `the enforcement seam does not import ${forbidden} — unreachable, not merely unused`,
    );
  }

  /*
   * THE BARREL IS BANNED BY EXACT SPECIFIER, NOT BY SUBSTRING.
   *
   * `@/features/agent-mandate` re-exports `establishAgentMandate`; importing it would put a
   * Governance-bound mandate writer into the proposal path's import graph — the defect G6C repaired
   * in Heby's graph, where a database-handle import dragged `establishGovernanceAuthority` in
   * behind it. A substring ban cannot express this, because the legitimate read-seam import
   * `@/features/agent-mandate/read-agent-mandate.server` contains the barrel's own specifier.
   */
  assert.ok(
    !imports.includes("@/features/agent-mandate"),
    "the enforcement seam imports the read seam module, never the feature barrel",
  );
  assert.ok(
    imports.includes("@/features/agent-mandate/read-agent-mandate.server"),
    "and it really does import that read seam",
  );

  /*
   * AND IT NEVER NAMES `agents.authority_ceiling`. Its column has no writer and DOES have a reader
   * that summarizes it into canonical actor resolution, so a mandate expressed there would publish
   * a CONSTRAINT as an AUTHORITY. AMA-1 banned the identifier inside the mandate feature; AMA-2
   * extends the ban to the one module outside it that now knows what a mandate says.
   */
  assert.ok(
    !/authorityCeiling|authority_ceiling/.test(source),
    "the enforcement seam never names authority_ceiling — a ceiling is not an authority",
  );

  /*
   * NO AGENT AUTHENTICATION WAS INTRODUCED. The agent id still arrives only through the branded
   * proposer, which is minted from a server-side identity read; nothing here accepts a credential,
   * a token or a caller-supplied agent id.
   */
  for (const banned of ["agentToken", "agentCredential", "authenticateAgent", "agentSecret"]) {
    assert.ok(!source.includes(banned), `no agent authentication (${banned}) exists`);
  }
  assert.ok(
    /mandateCeilingRefusal\(\s*tenant,\s*pair\.actorId/.test(source.replace(/\s+/g, " ")),
    "the ceiling is looked up by the VERIFIED proposer's id, never by a caller-supplied one",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 8. THE LADDER RECORDS EXACTLY WHAT WAS REACHED, AND NOTHING ABOVE IT.
 * ═════════════════════════════════════════════════════════════════════════ */
function theLadderStopsAtProposalEnforcement(): void {
  assert.deepEqual(
    MANDATE_CAPABILITY_LADDER.filter((r) => r.reached).map((r) => r.rung),
    ["MANDATE RECORDED", "PROPOSAL-ENFORCED"],
    "two rungs, and the second is the one AMA-2 climbed",
  );
  for (const unreached of ["HEBY-GROUNDED", "PERMIT-BEARING", "EXECUTABLE"]) {
    assert.ok(
      MANDATE_CAPABILITY_LADDER.some((r) => r.rung === unreached && !r.reached),
      `${unreached} is still declared unreached — enforcement climbed exactly one rung`,
    );
  }

  /*
   * HEBY-GROUNDED IS UNREACHED AND MEASURED SO. No answer path reads a mandate, so Heby still
   * cannot state what an agent is for; this is the census that keeps the ladder's claim honest.
   */
  for (const dir of ["src/features/heby-answer", "src/features/heby-integration"]) {
    for (const file of collect(dir)) {
      assert.ok(
        !/readEffectiveAgentMandate|agentMandates/.test(codeOf(read(file))),
        `${file} grounds no answer on a mandate — AMA-2 is not Heby grounding`,
      );
    }
  }
}

exactlyOneEnforcementSeam();
enforcementIsNotSmearedAcrossTheSystem();
theGatePrecedesTheWrite();
theRefusalVocabularyIsHonest();
theAliasMapIsTotalAndReleased();
amA2AddedNothingToTheDatabase();
theSeamGainedNoCapability();
theLadderStopsAtProposalEnforcement();

console.log("ama2-mandate-enforcement/enforcement-firewall: OK");
