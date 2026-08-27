/*
 * AGENT-RUNTIME-0 — STRUCTURAL BOUNDARIES.
 *
 * `attribution-postgres.ts` proves what the code DOES. This file proves what it does NOT contain,
 * because a phase that names an agent as an author is exactly the phase where authority would leak
 * in if it were going to: the tempting next line is always "and while we have the agent, let it …".
 *
 * The claims here are absences, and an absence is only evidence when it is asserted:
 *
 *   • no schema column, no migration, no environment variable, no credential, no ingress
 *   • no second agent lookup authority, and no second artifact writer
 *   • no proposal, no permit, no execution, no Governance, no role/membership/permission
 *   • no mock or simulated agent system anywhere on the production authorship path
 *   • no hard-coded agent name, uuid, or genesis identifier — the rule is a PROPERTY
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  isAgentAuthorship,
  resolveAgentAuthorship,
} from "../../src/features/work-artifacts/agent-authorship.server";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");

/** Source with comments stripped: assertions are about CODE, not about what prose discusses. */
function codeOf(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function collect(dir: string, ext = /\.tsx?$/): string[] {
  const abs = path.join(ROOT, dir);
  return readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) return collect(rel, ext);
    return ext.test(e.name) ? [rel] : [];
  });
}

const AUTHORSHIP = "src/features/work-artifacts/agent-authorship.server.ts";
const WRITER = "src/features/work-artifacts/write-work-artifacts.server.ts";
const SEAM = "src/features/work-artifacts/prepare-work-artifact.server.ts";
const READ_SEAM = "src/features/agent-identity/read-durable-agent-identity.server.ts";

/** Every file this phase touched or created. The blast radius, stated. */
const PHASE_FILES = [AUTHORSHIP, WRITER, SEAM, "src/features/work-artifacts/contracts.ts"];

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. THE AUTHORITY BOUNDARY — attribution grants nothing.
 * ═════════════════════════════════════════════════════════════════════════ */

function grantsNoAuthority(): void {
  const FORBIDDEN: readonly [RegExp, string][] = [
    [/actionPermits|action_permits/, "a permit"],
    [/hebyActionRequests|recordActionRequest/, "an action proposal"],
    [/decisionRecords|governanceSessions|resolveGovernanceAuthority/, "a Governance decision"],
    [/actionExecutionAttempts|executeAuthorizedAction/, "an execution"],
    [/@\/db\/schema\/membership|@\/db\/schema\/role|@\/db\/schema\/permission/, "a principal grant"],
    [/insertLocalIdentity|establishFirstPasswordCredential|authCredentials/, "a credential"],
    [/createSession|sessionCookie|session-service/, "a session"],
    [/process\.env/, "an environment read"],
    [/\bfetch\s*\(/, "an outbound call"],
  ];
  for (const file of PHASE_FILES) {
    const code = codeOf(read(file));
    for (const [pattern, what] of FORBIDDEN) {
      assert.equal(pattern.test(code), false, `${file} must not reach ${what}`);
    }
  }

  /*
   * THE AGENT NEVER BECOMES A PRINCIPAL. `asHumanTenantContext` is the nominal firewall's only
   * constructor (PRINCIPAL-FW-1); nothing in this phase calls it, so there is no representation in
   * which a resolved agent identity could be handed onward as an authorization context.
   */
  for (const file of PHASE_FILES) {
    assert.equal(
      /asHumanTenantContext|asTenantContext\s*\(/.test(codeOf(read(file))),
      false,
      `${file} must not manufacture a TenantContext — the agent is never a principal`,
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. THE READ SEAM IS NOT DUPLICATED, AND STAYS READ-ONLY.
 * ═════════════════════════════════════════════════════════════════════════ */

function oneAgentLookupAuthority(): void {
  /* The authorship module owns a DECISION, not a query. It touches no table and no handle. */
  const authorship = codeOf(read(AUTHORSHIP));
  for (const banned of [
    "@/db/schema/agent",
    "getControlPlaneDb",
    "resolveGovernanceDbOrNull",
    "drizzle-orm",
    ".select(",
    ".insert(",
    ".update(",
    ".delete(",
  ]) {
    assert.equal(
      authorship.includes(banned),
      false,
      `${AUTHORSHIP} must contain no query of its own ("${banned}") — it is not a second lookup authority`,
    );
  }
  assert.ok(
    authorship.includes("readDurableAgentIdentityState"),
    "it reads through the released AGENT-ID-0.1 seam and nothing else",
  );

  /* And that seam is still read-only, exactly as AGENT-ID-0.1 released it. */
  const readSeam = codeOf(read(READ_SEAM));
  for (const banned of [".insert(", ".update(", ".delete(", ".transaction(", "lock table"]) {
    assert.equal(
      readSeam.includes(banned),
      false,
      `${READ_SEAM} must remain read-only ("${banned}")`,
    );
  }

  /* Exactly one module in `src/` resolves an agent author. */
  const resolvers = collect("src").filter(
    (f) => f !== AUTHORSHIP && /resolveAgentAuthorship\s*\(/.test(codeOf(read(f))),
  );
  assert.deepEqual(resolvers, [SEAM], "the preparation seam is the only caller of the resolver");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. THE WRITER IS STILL THE ONLY WRITER, AND THE AGENT ID IS NEVER THE HUMAN'S.
 * ═════════════════════════════════════════════════════════════════════════ */

function attributionCannotRegress(): void {
  const WRITE_RE = /\.(insert|update|delete)\(\s*workArtifact/;
  const writers = collect("src").filter((f) => WRITE_RE.test(codeOf(read(f))));
  assert.deepEqual(writers, [WRITER], "exactly one module still writes work artifacts");

  const code = codeOf(read(WRITER));

  /*
   * THE DEFECT THIS PHASE REPAIRED, ASSERTED AS AN ABSENCE. `authoredByActorId: tenant.userId` is
   * the exact line that made one row assert two contradictory things, and it must never come back
   * in any spacing.
   */
  assert.equal(
    /authoredByActorId\s*:\s*tenant\.userId/.test(code),
    false,
    "THE HUMAN USER ID MUST NEVER BE WRITTEN INTO THE AUTHOR COLUMN",
  );
  /* Both author columns come from the same resolved pair — never from two different places. */
  const pairs = [...code.matchAll(/authoredByActorId\s*:\s*([A-Za-z_.]+)/g)].map((m) => m[1]);
  assert.deepEqual(
    [...new Set(pairs)],
    ["author.actorId"],
    "every author id comes from the single resolved author pair",
  );

  /* The agent entry points cannot be called without an authorship — there is no default. */
  for (const fn of ["createWorkArtifactFromHebyPreparation", "reviseWorkArtifactFromHebyPreparation"]) {
    const signature = code.slice(code.indexOf(`export function ${fn}(`));
    assert.ok(
      /authorship:\s*AgentAuthorship,/.test(signature.slice(0, 400)),
      `${fn} takes a required AgentAuthorship`,
    );
    assert.equal(
      /authorship:\s*AgentAuthorship\s*=/.test(signature.slice(0, 400)),
      false,
      `${fn} must not default its authorship — a default would be an unverified author`,
    );
  }

  /* And a forged authorship is rejected at RUNTIME, not merely by the type system. */
  assert.ok(code.includes("isAgentAuthorship"), "the writer checks the brand at runtime");
  assert.equal(isAgentAuthorship({ agentId: "11111111-1111-4111-8111-111111111111" }), false);
  assert.equal(isAgentAuthorship(null), false);
  assert.equal(isAgentAuthorship(undefined), false);
  assert.equal(isAgentAuthorship({}), false);

  /* Nothing outside the authorship module may cast its way to an authorship. */
  const casters = collect("src").filter(
    (f) => f !== AUTHORSHIP && /as\s+(unknown\s+as\s+)?AgentAuthorship/.test(codeOf(read(f))),
  );
  assert.deepEqual(casters, [], "no module in src/ forges an AgentAuthorship with a cast");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. NO MOCK OR SIMULATED AGENT SYSTEM IS ON THE PRODUCTION PATH.
 * ═════════════════════════════════════════════════════════════════════════ */

function noSimulationEntersTheProductionPath(): void {
  /*
   * `features/agent-runtime`, `features/agent-crud` and `features/agents/mock` are in-process
   * simulations fed by seeded fixtures. A durable author resolved from any of them would be a
   * fabricated organizational fact wearing a real column.
   */
  for (const file of [...PHASE_FILES, READ_SEAM]) {
    const code = codeOf(read(file));
    for (const banned of [
      "@/features/agent-runtime",
      "@/features/agent-crud",
      "@/features/agents/mock",
      "@/features/agent-context",
      "AgentRuntimeEngine",
      "AgentRegistry",
      "getSnapshot",
      "runtimeProjectionRegistry",
    ]) {
      assert.equal(
        code.includes(banned),
        false,
        `${file} must not consume the agent simulation ("${banned}")`,
      );
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. MULTI-AGENT FITNESS — the rule is a property, not a name.
 * ═════════════════════════════════════════════════════════════════════════ */

function nothingIsHardCodedToOneAgent(): void {
  const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  for (const file of PHASE_FILES) {
    const code = codeOf(read(file));
    assert.equal(UUID_RE.test(code), false, `${file} must contain no literal uuid`);
    assert.equal(
      /["'`]Heby["'`]/.test(code),
      false,
      `${file} must not name one agent — a department agent must need no new code`,
    );
    for (const banned of ["genesis", "firstAgent", "primaryAgent", "defaultAgent"]) {
      assert.equal(
        code.toLowerCase().includes(banned.toLowerCase()),
        false,
        `${file} must not select an agent by "${banned}"`,
      );
    }
  }

  /*
   * The seam does not pick when the answer is ambiguous. Today genesis makes a second in-service
   * identity unreachable; the refusal is the boundary that keeps it that way, so that the day
   * Marketing exists the CALLER must say which agent — never this module by guessing.
   */
  assert.ok(
    read(AUTHORSHIP).includes("ambiguous-durable-agent-identity"),
    "more than one serving identity is refused, never silently resolved to the first",
  );
  const authorshipCode = codeOf(read(AUTHORSHIP));
  assert.equal(
    /serving\[0\]!?\.agentId/.test(authorshipCode) && !authorshipCode.includes("serving.length > 1"),
    false,
    "the single-identity read is guarded by the ambiguity refusal, never taken blindly",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6. ZERO SCHEMA, ZERO MIGRATION.
 * ═════════════════════════════════════════════════════════════════════════ */

function schemaIsUntouched(): void {
  const sql = readdirSync(path.join(ROOT, "src/db/migrations")).filter((f) => f.endsWith(".sql"));
  assert.equal(sql.length, 36, "AGENT-RUNTIME-0 adds no migration");
  const journal = JSON.parse(read("src/db/migrations/meta/_journal.json")) as {
    entries: readonly unknown[];
  };
  assert.equal(journal.entries.length, 36, "and the ledger is unchanged");

  /* The two tables this phase writes and reads gained no column. */
  const artifactSchema = read("src/db/schema/work-artifact.ts");
  assert.ok(artifactSchema.includes('authoredByActorType: actorTypeEnum("authored_by_actor_type")'));
  assert.ok(artifactSchema.includes('authoredByActorId: uuid("authored_by_actor_id")'));
  assert.equal(
    /agentId:\s*uuid\("agent_id"\)/.test(artifactSchema),
    false,
    "no agent-specific column was added — the polymorphic pair already said it",
  );

  /* No file in this phase declares a table at all. */
  for (const file of PHASE_FILES) {
    assert.equal(
      /pgTable\s*\(/.test(codeOf(read(file))),
      false,
      `${file} declares no table`,
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 7. THE HUMAN-ONLY CHECKS ARE STILL DECLARED, ALL SEVEN.
 * ═════════════════════════════════════════════════════════════════════════ */

function humanOnlyChecksAreIntact(): void {
  const declared = collect("src/db/schema", /\.ts$/)
    .flatMap((f) => {
      const source = read(f);
      return [...source.matchAll(/check\(\s*\n?\s*"([a-z0-9_]+)"/g)]
        .map((m) => ({ name: m[1]!, file: f }))
        .filter(({ name }) => {
          const at = source.indexOf(`"${name}"`);
          return /= '?human'?/.test(source.slice(at, at + 400));
        });
    })
    .map((c) => c.name)
    .sort();

  assert.deepEqual(
    declared,
    [
      "action_permits_human_authorizer_chk",
      "decision_records_bootstrap_human_chk",
      "heby_action_requests_human_approver_chk",
      "identity_enrollment_requests_human_approver_chk",
      "knowledge_external_references_human_declarer_chk",
      "knowledge_external_references_human_withdrawer_chk",
      "membership_authorizations_human_authorizer_chk",
    ],
    "the seven human-only CHECKs are exactly as released — this phase widened none of them",
  );

  /*
   * ARTIFACT AUTHORSHIP IS NOT PROPOSAL CAPABILITY.
   *
   * AGENT-RUNTIME-0 originally pinned this as "the proposal writer hard-codes `human`, so
   * AGENT_PROPOSAL_CAPABLE is NO". AGENT-PROPOSAL-1 deliberately changed that fact, and a green
   * test asserting the old sentence would be green BECAUSE a stale claim survived — the failure
   * this repository has already been taught once by the R3W canonical migration.
   *
   * What AGENT-RUNTIME-0 actually guaranteed, and still guarantees, is narrower and is what is
   * asserted now: NOTHING IN THIS PHASE'S BLAST RADIUS PROPOSES ANYTHING. An artifact-authorship
   * token cannot become a proposer, and no work-artifact module writes a proposal column. Whether
   * some OTHER phase may propose is that phase's claim to make, not this one's.
   */
  const requestWriter = codeOf(read("src/features/action-authorization/record-action-request.server.ts"));
  assert.equal(
    /AgentAuthorship|agent-authorship/.test(requestWriter),
    false,
    "the proposal writer cannot be reached with an ARTIFACT-AUTHORSHIP token",
  );
  for (const file of PHASE_FILES) {
    const code = codeOf(read(file));
    for (const banned of [
      "proposedByActorType",
      "proposedByActorId",
      "recordActionRequest",
      "recordAgentOriginatedActionRequest",
      "hebyActionRequests",
    ]) {
      assert.equal(
        code.includes(banned),
        false,
        `${file} must not touch the proposal authority ("${banned}") — authorship proposes nothing`,
      );
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 8. THE REFUSAL VOCABULARY IS CLOSED AND DISTINGUISHES REAL DIFFERENCES.
 * ═════════════════════════════════════════════════════════════════════════ */

async function refusalsAreHonest(): Promise<void> {
  /* No tenant is refused before any read happens — the resolver never guesses a tenant. */
  const noTenant = await resolveAgentAuthorship(null);
  assert.equal(noTenant.status, "refused");
  assert.equal(
    noTenant.status === "refused" ? noTenant.reason : "",
    "no-authorized-tenant-context",
  );

  const source = read(AUTHORSHIP);
  for (const reason of [
    "no-authorized-tenant-context",
    "agent-identity-authority-unavailable",
    "no-durable-agent-identity",
    "durable-agent-identity-retired",
    "ambiguous-durable-agent-identity",
  ]) {
    assert.ok(source.includes(reason), `the refusal "${reason}" is declared`);
  }

  /* There is no availability-preserving escape hatch anywhere in the vocabulary. */
  const code = codeOf(source);
  for (const banned of ["fallback", "randomUUID", "crypto.", "?? tenant.userId", "|| tenant.userId"]) {
    assert.equal(
      code.includes(banned),
      false,
      `the resolver must not preserve availability with "${banned}"`,
    );
  }
  assert.equal(
    /tenant\.userId/.test(code),
    false,
    "THE RESOLVER NEVER READS THE HUMAN USER ID — it could not fall back to it if it tried",
  );
}

async function main(): Promise<void> {
  grantsNoAuthority();
  oneAgentLookupAuthority();
  attributionCannotRegress();
  noSimulationEntersTheProductionPath();
  nothingIsHardCodedToOneAgent();
  schemaIsUntouched();
  humanOnlyChecksAreIntact();
  await refusalsAreHonest();
  console.log("PASS agent-runtime-0 boundaries and firewall");
}

void main();
