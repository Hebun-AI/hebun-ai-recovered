/*
 * AGENT-PROPOSAL-1 — STRUCTURAL BOUNDARIES.
 *
 * `origination-postgres.ts` proves what the code DOES. This proves what it does NOT contain — and
 * in this phase that matters more than usual, because a machine that may now originate a
 * consequential proposal is exactly the thing whose blast radius must be asserted rather than
 * described.
 *
 * ── THE CLAIM THIS PHASE HAD TO PRESERVE ─────────────────────────────────────
 *
 * R3A.1 asserts, over the whole `heby-action-inlet` feature, that THE MODEL SELECTS NOTHING. That
 * is a released truth about the `/send` slash command and it is still true. AGENT-PROPOSAL-1 did
 * not weaken it: the model lives in a SEPARATE feature and hands the inlet two already-validated
 * references. This file re-asserts R3A.1's own firewall from the outside, so that "we kept it"
 * is measured here rather than assumed.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  isAgentProposer,
  resolveAgentProposer,
} from "../../src/features/action-authorization/agent-proposer.server";
import { AGENT_ORIGINABLE_ACTION_KINDS } from "../../src/features/agent-origination";
import { getActionToolByKind } from "../../src/features/heby-actions/action-registry";

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

const ORIGINATION_FILES = collect("src/features/agent-origination");
const ORIGINATION_CODE = ORIGINATION_FILES.map((f) => codeOf(read(f))).join("\n");
const INLET_FILES = collect("src/features/heby-action-inlet");
const INLET_CODE = INLET_FILES.map((f) => codeOf(read(f))).join("\n");

const PROPOSER = "src/features/action-authorization/agent-proposer.server.ts";
const WRITER = "src/features/action-authorization/record-action-request.server.ts";
const READ_SEAM = "src/features/agent-identity/read-durable-agent-identity.server.ts";

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. R3A.1's CLAIM SURVIVED — THE INLET STILL SELECTS NOTHING.
 * ═════════════════════════════════════════════════════════════════════════ */

function theInletIsStillModelFree(): void {
  for (const forbidden of [
    "provider-invocation",
    "features/providers",
    "anthropic",
    "openai",
    "fetch(",
    "heby-answer",
    "model-answer",
    "generateHebyModelAnswer",
    "selectModelTransport",
    "ClaudeTransport",
    "agent-origination",
    "parseAgentActionSelection",
    "systemInstructions",
  ]) {
    assert.ok(
      !INLET_CODE.toLowerCase().includes(forbidden.toLowerCase()),
      `the inlet must not reach ${forbidden} — R3A.1's firewall is not weakened by this phase`,
    );
  }

  /* The dependency direction is one-way: origination imports the inlet, never the reverse. */
  assert.ok(
    ORIGINATION_CODE.includes("heby-action-inlet/send-proposal.server"),
    "origination calls the inlet",
  );

  /* The action kind is STILL a constant in the inlet — the model never sets it. */
  const contracts = codeOf(read("src/features/heby-action-inlet/contracts.ts"));
  assert.ok(
    /SEND_ACTION_KIND\s*=\s*"send-external-communication"\s*as const/.test(contracts),
    "the action kind is still a literal constant",
  );

  /* The privacy boundary R3A.1 established still holds across the inlet. */
  assert.ok(!INLET_CODE.includes("endpointValue"), "the raw address never enters the proposal");
  assert.ok(!/console\.(log|info|warn|error)/.test(INLET_CODE), "the inlet logs nothing");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. ORIGINATION GRANTS NOTHING.
 * ═════════════════════════════════════════════════════════════════════════ */

function originationGrantsNoAuthority(): void {
  const FORBIDDEN: readonly [RegExp, string][] = [
    [/actionPermits|action_permits|issuePermit/, "a permit"],
    [/decisionRecords|governanceSessions|resolveGovernanceAuthority/, "a Governance decision"],
    [/approveActionRequest|rejectActionRequest|decideActionRequest/, "an approval"],
    [/consumeActionPermit|revokeActionPermit/, "permit consumption"],
    [/actionExecutionAttempts|executeAuthorizedAction|action-execution/, "execution"],
    [/@\/db\/schema\/membership|@\/db\/schema\/role|@\/db\/schema\/permission/, "a principal grant"],
    [/authCredentials|insertLocalIdentity|establishFirstPassword/, "a credential"],
    [/createSession|session-service|sessionCookie/, "a session"],
    [/nodemailer|sendgrid|smtp|postmark|mailgun/i, "an email transport"],
    [/child_process|\bexecSync|\bspawn\(/, "a shell"],
    [/node:fs\b|from "fs"/, "filesystem access"],
    [/setInterval|setTimeout|cron|queue|enqueue|scheduler/i, "a background loop"],
    [/asHumanTenantContext|asTenantContext\s*\(/, "a manufactured TenantContext"],
  ];
  for (const file of ORIGINATION_FILES) {
    const code = codeOf(read(file));
    for (const [pattern, what] of FORBIDDEN) {
      assert.equal(pattern.test(code), false, `${file} must not reach ${what}`);
    }
  }

  /*
   * THE AGENT NEVER BECOMES A PRINCIPAL. Nothing in this phase constructs a TenantContext, so
   * there is no representation in which a resolved agent identity could be handed onward as an
   * authorization context. PRINCIPAL-FW-1 is untouched by construction, not by policy.
   */
  for (const file of [...ORIGINATION_FILES, PROPOSER]) {
    assert.equal(
      /asHumanTenantContext/.test(codeOf(read(file))),
      false,
      `${file} must not manufacture a TenantContext`,
    );
  }

  /* No outbound call of any kind lives in this feature — the only I/O is the injected transport. */
  assert.equal(
    /\bfetch\s*\(|\baxios\b/.test(ORIGINATION_CODE),
    false,
    "origination makes no outbound call of its own",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. ONE PROPOSAL AUTHORITY, TWO TRUTHFUL ENTRY POINTS.
 * ═════════════════════════════════════════════════════════════════════════ */

function oneProposalAuthority(): void {
  /* Exactly one module inserts into the proposal table. */
  const writers = collect("src").filter((f) =>
    /\.insert\(\s*hebyActionRequests/.test(codeOf(read(f))),
  );
  assert.deepEqual(writers, [WRITER], "exactly one module writes proposals");

  const code = codeOf(read(WRITER));

  /* Both proposer columns come from ONE resolved pair — never from two different places. */
  const types = [...code.matchAll(/proposedByActorType\s*:\s*([A-Za-z_.]+)/g)].map((m) => m[1]);
  const ids = [...code.matchAll(/proposedByActorId\s*:\s*([A-Za-z_.]+)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(types)], ["proposer.actorType"], "one source for the actor type");
  assert.deepEqual([...new Set(ids)], ["proposer.actorId"], "one source for the actor id");

  /*
   * THE DEFECT THIS LINEAGE KEEPS REPAIRING, ASSERTED AS AN ABSENCE. A hard-coded `"agent"` beside
   * a human id — or a human id in the proposer column at all — must never come back in any spacing.
   */
  assert.equal(
    /proposedByActorType\s*:\s*"agent"/.test(code),
    false,
    "the actor type is never a literal — it comes from the resolved pair",
  );
  assert.equal(
    /proposedByActorId\s*:\s*tenant\.userId/.test(code),
    false,
    "THE HUMAN USER ID IS NEVER WRITTEN DIRECTLY INTO THE PROPOSER COLUMN",
  );

  /* The agent entry point cannot be called without a proposer, and has no default. */
  const signature = code.slice(code.indexOf("export function recordAgentOriginatedActionRequest("));
  assert.ok(
    /proposer:\s*AgentProposer,/.test(signature.slice(0, 400)),
    "the agent writer takes a required AgentProposer",
  );
  assert.equal(
    /proposer:\s*AgentProposer\s*=/.test(signature.slice(0, 400)),
    false,
    "and must not default it — a default would be an unverified proposer",
  );
  assert.ok(code.includes("isAgentProposer"), "the writer checks the brand at runtime");

  /* Nothing anywhere forges a proposer with a cast. */
  const casters = collect("src").filter(
    (f) => f !== PROPOSER && /as\s+(unknown\s+as\s+)?AgentProposer/.test(codeOf(read(f))),
  );
  assert.deepEqual(casters, [], "no module in src/ forges an AgentProposer with a cast");

  /* The runtime guard really does reject the shapes a caller could manufacture. */
  assert.equal(isAgentProposer({ agentId: "11111111-1111-4111-8111-111111111111" }), false);
  assert.equal(isAgentProposer({ agentId: "" }), false);
  assert.equal(isAgentProposer(null), false);
  assert.equal(isAgentProposer({}), false);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. THE PROPOSER IS NOT THE ARTIFACT AUTHOR — TWO BRANDS, ON PURPOSE.
 * ═════════════════════════════════════════════════════════════════════════ */

function proposerIsNotAuthorship(): void {
  const proposer = codeOf(read(PROPOSER));
  assert.equal(
    /AgentAuthorship|agent-authorship/.test(proposer),
    false,
    "the proposer authority does not reuse the artifact-authorship token",
  );
  assert.ok(
    proposer.includes("readDurableAgentIdentityState"),
    "it reads through the released AGENT-ID-0.1 seam and nothing else",
  );
  /* It is not a second lookup authority: no query, no handle, no table. */
  for (const banned of [
    "@/db/schema/agent",
    "getControlPlaneDb",
    "resolveGovernanceDbOrNull",
    "drizzle-orm",
    ".select(",
    ".insert(",
    ".update(",
  ]) {
    assert.equal(
      proposer.includes(banned),
      false,
      `${PROPOSER} must contain no query of its own ("${banned}")`,
    );
  }

  /* And the read seam it depends on is still read-only, exactly as released. */
  const readSeam = codeOf(read(READ_SEAM));
  for (const banned of [".insert(", ".update(", ".delete(", ".transaction(", "lock table"]) {
    assert.equal(readSeam.includes(banned), false, `${READ_SEAM} must remain read-only`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. THE ADMITTED SET IS SMALLER THAN THE REGISTRY.
 * ═════════════════════════════════════════════════════════════════════════ */

function theAdmittedSetIsBounded(): void {
  assert.deepEqual([...AGENT_ORIGINABLE_ACTION_KINDS], ["send"], "exactly one admitted kind");

  /*
   * The admitted kind maps to a tool whose authority requirement is human review. Admitting a kind
   * that did not require review would be admitting one an agent could originate straight past a
   * person, which is the thing this whole phase exists to make impossible.
   */
  const tool = getActionToolByKind("send-external-communication");
  assert.ok(tool);
  assert.equal(tool!.authorityRequirement, "human-review-required");
  assert.equal(tool!.governanceGated, true);

  /* The dangerous kinds are absent from the origination feature entirely, not merely unlisted. */
  for (const kind of [
    "grant-permission",
    "modify-governance-policy",
    "device-action",
    "restart-workflow",
  ]) {
    assert.equal(
      ORIGINATION_CODE.includes(kind),
      false,
      `"${kind}" must not appear in the origination feature at all`,
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6. NO MOCK OR SIMULATED AGENT SYSTEM IS ON THIS PATH.
 * ═════════════════════════════════════════════════════════════════════════ */

function noSimulationEntersTheProductionPath(): void {
  for (const file of [...ORIGINATION_FILES, PROPOSER, WRITER]) {
    const code = codeOf(read(file));
    for (const banned of [
      "@/features/agent-runtime",
      "@/features/agent-crud",
      "@/features/agents/mock",
      "@/features/agent-context",
      "AgentRuntimeEngine",
      "AgentRegistry",
      "runtimeProjectionRegistry",
      "getSnapshot",
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
 * 7. MULTI-AGENT FITNESS — the rule is a property, not a name.
 * ═════════════════════════════════════════════════════════════════════════ */

function nothingIsHardCodedToOneAgent(): void {
  const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  for (const file of [...ORIGINATION_FILES, PROPOSER]) {
    const code = codeOf(read(file));
    assert.equal(UUID_RE.test(code), false, `${file} must contain no literal uuid`);
    for (const banned of ["genesis", "firstAgent", "primaryAgent", "defaultAgent"]) {
      assert.equal(
        code.toLowerCase().includes(banned.toLowerCase()),
        false,
        `${file} must not select an agent by "${banned}"`,
      );
    }
  }
  /*
   * "Heby" appears ONLY inside the model's system instructions, where it is the agent's name spoken
   * to the agent — never a selector. The selection code must not contain it.
   */
  for (const file of [PROPOSER, "src/features/agent-origination/candidate-set.server.ts"]) {
    assert.equal(
      /["'`]Heby["'`]/.test(codeOf(read(file))),
      false,
      `${file} must not name one agent`,
    );
  }

  assert.ok(
    read(PROPOSER).includes("ambiguous-durable-agent-identity"),
    "more than one serving identity is refused, never silently resolved to the first",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 8. ZERO SCHEMA, ZERO MIGRATION.
 * ═════════════════════════════════════════════════════════════════════════ */

function schemaIsUntouched(): void {
  const sql = readdirSync(path.join(ROOT, "src/db/migrations")).filter((f) => f.endsWith(".sql"));
  /*
   * RE-PINNED BY AGENT-PROPOSAL-4B, WHICH APPENDED MIGRATION 37.
   *
   * This states "AGENT-PROPOSAL-1 adds no migration" the same way it always did — by pinning the
   * total. A filename filter for this phase's own tag was considered and rejected: no migration
   * here is named after its phase, so such a filter is empty for every possible repository state
   * and could never fail. An absolute pin can rot, but it cannot lie.
   */
  assert.equal(sql.length, 40, "AGENT-PROPOSAL-1 adds no migration");
  const journal = JSON.parse(read("src/db/migrations/meta/_journal.json")) as {
    entries: readonly unknown[];
  };
  assert.equal(journal.entries.length, 40, "and the ledger is unchanged");
  /* And the ledger still agrees with the files on disk — an integrity check that cannot rot. */
  assert.equal(journal.entries.length, sql.length, "the ledger and the migration files agree");

  const schema = read("src/db/schema/action-authorization.ts");
  /* `agent` was already representable; this phase added no column and no CHECK. */
  assert.ok(schema.includes('proposedByActorType: actorTypeEnum("proposed_by_actor_type")'));
  assert.ok(schema.includes('proposedByActorId: uuid("proposed_by_actor_id")'));
  assert.equal(
    /proposed_by_actor_type[^)]*human/.test(schema),
    false,
    "no human CHECK was added to the proposer — it stays deliberately unconstrained",
  );
  /* The two that ARE human-constrained still are. */
  assert.ok(schema.includes("heby_action_requests_human_approver_chk"));
  assert.ok(schema.includes("action_permits_human_authorizer_chk"));

  for (const file of [...ORIGINATION_FILES, PROPOSER]) {
    assert.equal(/pgTable\s*\(/.test(codeOf(read(file))), false, `${file} declares no table`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 9. THE REFUSAL VOCABULARY HAS NO ESCAPE HATCH.
 * ═════════════════════════════════════════════════════════════════════════ */

async function refusalsAreHonest(): Promise<void> {
  const noTenant = await resolveAgentProposer(null);
  assert.equal(noTenant.status, "refused");
  assert.equal(
    noTenant.status === "refused" ? noTenant.reason : "",
    "no-authorized-tenant-context",
  );

  const proposer = codeOf(read(PROPOSER));
  for (const banned of ["fallback", "randomUUID", "?? tenant.userId", "|| tenant.userId"]) {
    assert.equal(proposer.includes(banned), false, `the resolver must not use "${banned}"`);
  }
  assert.equal(
    /tenant\.userId/.test(proposer),
    false,
    "THE RESOLVER NEVER READS THE HUMAN USER ID — it could not fall back to it if it tried",
  );

  /* Origination never repairs a malformed selection. */
  const parser = codeOf(read("src/features/agent-origination/structured-output.ts"));
  for (const banned of ["JSON.parse(text.slice", ".match(/\\{", "indexOf(\"{\")", "lastIndexOf"]) {
    assert.equal(
      parser.includes(banned),
      false,
      `the parser must not hunt for JSON inside prose ("${banned}")`,
    );
  }
  /* There is exactly one JSON.parse, and it parses the whole body. */
  assert.equal(
    (parser.match(/JSON\.parse\(/g) ?? []).length,
    1,
    "one parse, of the whole response — never a search over fragments",
  );
}

async function main(): Promise<void> {
  theInletIsStillModelFree();
  originationGrantsNoAuthority();
  oneProposalAuthority();
  proposerIsNotAuthorship();
  theAdmittedSetIsBounded();
  noSimulationEntersTheProductionPath();
  nothingIsHardCodedToOneAgent();
  schemaIsUntouched();
  await refusalsAreHonest();
  console.log("PASS agent-proposal-1 boundaries and firewall");
}

void main();
