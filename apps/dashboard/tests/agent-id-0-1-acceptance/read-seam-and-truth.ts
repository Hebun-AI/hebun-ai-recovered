/*
 * AGENT-ID-0.1 PRODUCTION ACCEPTANCE — the read seam that makes the first ceremony truthful, and
 * the product claim that stopped being true when the ceremony shipped.
 *
 * ── WHAT THIS PHASE IS ALLOWED TO BE ────────────────────────────────────────
 *
 * A COUNT and a SENTENCE. It adds one entry to a closed list in an existing read-only ceremony
 * report, and it repairs one dashboard tile whose copy AGENT-ID-0.1 falsified. It creates no
 * authority, no writer, no second production-read path, and no agent.
 *
 * ── THE THREE CLAIMS THIS FILE DEFENDS ──────────────────────────────────────
 *
 * 1. THE READ SEAM IS AN EXTENSION, NOT A NEW SYSTEM. `platform:preflight` remains the only
 *    production-read command; it still writes nothing, still reads no row content, and still counts
 *    only tables named by a compile-time literal it does not accept from an operator.
 * 2. THE PRODUCT NO LONGER DENIES ITS OWN CAPABILITY, and the simulation is still a simulation —
 *    relabelled where it was misleading, never wired to the durable authority.
 * 3. THE AGENT-ID AUTHORITY DID NOT MOVE. Both writers are byte-identical to their released
 *    commit, the human-only constraints are intact, and no migration was authored.
 *
 * Source is read with comments STRIPPED where a rule could otherwise be tripped by prose that
 * names the very thing it forbids — this file and its subjects name several of them on purpose.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (f: string): string => readFileSync(path.join(ROOT, f), "utf8");
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const PREFLIGHT = "scripts/platform-preflight.ts";
const QUICK_ACTIONS = "src/components/dashboard/quick-actions.tsx";
const COMMAND_REGISTRY = "src/features/commands/registry.ts";
const MOCK_WORKSPACE = "src/components/agents/agent-registry-workspace.tsx";
const CREATE_AUTHORITY = "src/features/agent-identity/create-durable-agent-identity.server.ts";
const RETIRE_AUTHORITY = "src/features/agent-identity/retire-durable-agent-identity.server.ts";
const GOVERNANCE_CONTRACTS = "src/features/governance-decision/contracts.ts";
const MIGRATIONS = "src/db/migrations";

/** The released commit these authorities must still match, byte for byte. */
const AGENT_ID_0_1_RELEASE = "bcade6a";

/*
 * The seven human-only CHECK constraints RELEASED BEFORE THIS PHASE. Named individually so a
 * weakening names itself.
 *
 * This list is a MUST-EXIST set, not an exhaustive census — each name is asserted present below,
 * and the count is compared with `>=`. SIA-3 later added an eighth
 * (`agent_improvement_hypotheses_human_author_chk`); it is deliberately absent here, because
 * nothing in this phase depends on it and adding it would make an unrelated suite move whenever a
 * future phase constrains another author to human. The exhaustive censuses live in
 * `agent-runtime-0` and `agent-proposal-1`.
 */
const HUMAN_ONLY_CHECKS = [
  "action_permits_human_authorizer_chk",
  "decision_records_bootstrap_human_chk",
  "heby_action_requests_human_approver_chk",
  "identity_enrollment_requests_human_approver_chk",
  "knowledge_external_references_human_declarer_chk",
  "knowledge_external_references_human_withdrawer_chk",
  "membership_authorizations_human_authorizer_chk",
] as const;

/** The surfaces the preflight counts, in order. `agents` is the only entry this phase added. */
const EXPECTED_SURFACES = [
  "companies",
  "users",
  "auth_identities",
  "auth_credentials",
  "memberships",
  "roles",
  "genesis_nominations",
  "provider_connectivity_controls",
  "audit_log",
  "agents",
] as const;

function allSourceFiles(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) return allSourceFiles(rel);
    return entry.isFile() && /\.(ts|tsx)$/.test(entry.name) ? [rel] : [];
  });
}

function main(): void {
  const preflight = codeOf(read(PREFLIGHT));

  /* ── 1. THE READ SEAM IS STILL READ-ONLY ──────────────────────────────────── */
  for (const write of [
    /\binsert\s+into\b/i,
    /\bupdate\s+"?\w+"?\s+set\b/i,
    /\bdelete\s+from\b/i,
    /\balter\s+table\b/i,
    /\bcreate\s+table\b/i,
    /\bdrop\s+/i,
    /\btruncate\b/i,
    /\.insert\(/,
    /\.update\(/,
    /\.delete\(/,
  ]) {
    assert.ok(
      !write.test(preflight),
      `${PREFLIGHT} contains no ${write} — the one command an operator may point at production writes nothing, in any posture, ever`,
    );
  }
  assert.ok(
    !/\bbegin\b|\bcommit\b|\brollback\b/i.test(preflight),
    "the preflight opens no transaction — there is nothing to commit",
  );

  /* ── 2. IT IS ONE QUERY SHAPE, AND THE TABLE IS NEVER AN ARGUMENT ─────────── */
  const queries = [...preflight.matchAll(/client\.query[^(]*\(\s*`([^`]*)`/g)].map((m) => m[1]!);
  assert.deepEqual(
    queries,
    ['select count(*)::text as n from "${table}"'],
    "the preflight issues exactly ONE query shape of its own: a count over a table from the closed list",
  );
  /*
   * THE CEREMONY BASELINE ADDED NO READ. It is derived from the counts the loop already took, so
   * the query census above is the whole cost of this phase's seam. If the baseline ever grows a
   * query of its own, the assertion above fails rather than this claim quietly becoming false.
   */
  assert.ok(
    /const counts = new Map</.test(preflight),
    "the baseline reads from a map of counts already taken, not from the database a second time",
  );
  assert.ok(
    !/\$\d/.test(queries[0]!),
    "the count query has no bind parameter — an operator cannot name a table to count",
  );

  /* ── 3. COUNTS ONLY. NO ROW CONTENT, NO SECRET, NO PROFILE ────────────────── */
  for (const forbidden of [
    "select *",
    "human_owner",
    "manager_actor",
    "authority_ceiling",
    "agent_lifecycle_status",
    "execution_posture",
    "allowed_tools",
    "tool_profile",
    "reasoning_profile",
    "secret",
    "password",
    "credential_hash",
    "token",
    "tenant_id",
  ]) {
    assert.ok(
      !preflight.toLowerCase().includes(forbidden),
      `${PREFLIGHT} never names \`${forbidden}\` — it reads counts, not rows, and no agent profile, runtime or credential column`,
    );
  }

  /* ── 4. THE SURFACE LIST IS CLOSED, AND `agents` IS THE ONLY ADDITION ─────── */
  const surfaceBlock = preflight.slice(
    preflight.indexOf("const SURFACES = ["),
    preflight.indexOf("] as const;", preflight.indexOf("const SURFACES = [")),
  );
  assert.deepEqual(
    [...surfaceBlock.matchAll(/"(\w+)"/g)].map((m) => m[1]!),
    [...EXPECTED_SURFACES],
    "the counted surfaces are exactly these ten, in this order — `agents` extends the list and nothing else moved",
  );
  assert.ok(
    surfaceBlock.includes('"agents"'),
    "`agents` is counted — the first-agent ceremony has an authoritative baseline to read",
  );

  /*
   * THE BASELINE ADDRESSES THE LIST BY INDEX, SO THE INDICES ARE THE CONTRACT.
   *
   * G4 pins every governed table name to the SURFACES literal and nowhere else in that file, which
   * is what makes "counts only" structural. The baseline therefore cannot say `counts.get("…")`
   * for a governed table, and reads positions instead. That trade moves the risk here: a reorder of
   * SURFACES would silently relabel a printed number. These assertions are what stop it.
   */
  const positions = Object.fromEntries(EXPECTED_SURFACES.map((t, i) => [t, i]));
  for (const [constant, table] of [
    ["TENANTS", "companies"],
    ["HUMANS", "users"],
    ["CREDENTIALS", "auth_credentials"],
    ["MEMBERSHIP_ROWS", "memberships"],
    ["AGENTS", "agents"],
  ] as const) {
    const declared = new RegExp(`const ${constant} = (\\d+);`).exec(preflight);
    assert.ok(declared, `the baseline declares a position constant \`${constant}\``);
    assert.equal(
      Number(declared![1]),
      positions[table],
      `\`${constant}\` must be the index of \`${table}\` in SURFACES — a reorder must not relabel a printed number`,
    );
  }

  /* ── 5. NO SECOND PRODUCTION-READ SYSTEM WAS CREATED ──────────────────────── */
  const scripts = readdirSync(path.join(ROOT, "scripts"), { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".ts"))
    .map((e) => `scripts/${e.name}`);
  const agentReaders = scripts.filter(
    (f) => f !== PREFLIGHT && /\bagents\b/.test(codeOf(read(f))),
  );
  assert.deepEqual(
    agentReaders,
    [],
    "no script other than the preflight names `agents` — there is one production-read path, not two",
  );
  assert.ok(
    !preflight.includes("agent-identity"),
    "the preflight does not import the agent identity authority — reading a count is not holding a writer",
  );

  /* ── 6. THE PER-TENANT BOUND IS DISCLOSED, NOT GLOSSED ────────────────────── */
  const raw = read(PREFLIGHT);
  assert.ok(
    raw.includes("the genesis one-shot is per tenant"),
    "a platform-wide count states its own bound: zero settles every tenant, non-zero identifies none",
  );
  assert.ok(
    raw.includes("NO AGENT IDENTITY was created by this command"),
    "the closing banner says plainly that this command created no agent identity",
  );

  /* ── 7. THE PRODUCT NO LONGER DENIES ITS OWN CAPABILITY ───────────────────── */
  const quick = read(QUICK_ACTIONS);
  assert.ok(
    !/until live creation flows exist/.test(codeOf(quick)),
    "no surface still claims live creation flows do not exist — a durable creation ceremony is deployed",
  );
  const agentTile = quick.slice(quick.indexOf('label: "Create Agent"'));
  assert.ok(agentTile.length > 0, "the Create Agent tile was located");
  const tile = agentTile.slice(0, agentTile.indexOf("},"));
  assert.ok(
    /href: "\/agents"/.test(tile),
    "the tile routes to the surface that actually owns the ceremony",
  );
  assert.ok(
    !/comingSoon/.test(tile),
    "the tile is no longer marked Coming Soon — the capability it names exists",
  );
  assert.ok(
    !/creates|will create|creating an agent/i.test(tile.replace(/\/\*[\s\S]*?\*\//g, "")),
    "the tile promises routing, not creation — clicking it writes nothing",
  );

  /* ── 8. THE SIMULATION IS STILL A SIMULATION ──────────────────────────────── */
  const registry = codeOf(read(COMMAND_REGISTRY));
  const agentCreate = registry.slice(registry.indexOf('type: "agent.create"'));
  assert.ok(agentCreate.length > 0, "the agent.create command spec was located");
  const spec = agentCreate.slice(0, agentCreate.indexOf("});"));
  assert.ok(
    /Simulated a new agent registration/.test(spec),
    "the command bus entry still describes its own result as SIMULATED",
  );
  assert.ok(
    !/agent-identity|createDurableAgentIdentity|retireDurableAgentIdentity/.test(registry),
    "the simulation command bus is NOT wired to the durable authority — a simulated command may not become a durable write",
  );
  assert.ok(
    /simulate:/.test(registry),
    "the registry's commands are registered with a `simulate` implementation, not an executor",
  );
  /* And the mock workspace still names what it creates, exactly as AGENT-ID-0.1 left it. */
  const mock = read(MOCK_WORKSPACE);
  assert.ok(
    !/>\s*Create Agent\s*</.test(mock) && !mock.includes('"Create Agent"'),
    "no control in the simulation reads `Create Agent` — that sentence belongs to a real authority",
  );
  assert.ok(
    mock.includes("Create simulated definition"),
    "the simulation's creation control still names what it actually creates",
  );

  /* ── 9. THE AGENT-ID AUTHORITY DID NOT MOVE ───────────────────────────────── */
  for (const authority of [CREATE_AUTHORITY, RETIRE_AUTHORITY]) {
    const released = execFileSync(
      "git",
      ["show", `${AGENT_ID_0_1_RELEASE}:apps/dashboard/${authority}`],
      { cwd: ROOT, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
    );
    assert.equal(
      read(authority),
      released,
      `${authority} is byte-identical to ${AGENT_ID_0_1_RELEASE} — this phase changed no writer's behaviour`,
    );
  }

  /* ── 10. HUMAN SUPREMACY, GOVERNANCE AND THE LEDGER ARE UNTOUCHED ─────────── */
  const allMigrations = readdirSync(path.join(ROOT, MIGRATIONS))
    .filter((f) => f.endsWith(".sql"))
    .map((f) => read(path.join(MIGRATIONS, f)))
    .join("\n");
  for (const check of HUMAN_ONLY_CHECKS) {
    assert.ok(
      allMigrations.includes(check),
      `\`${check}\` still exists — a read seam weakens no human-only constraint`,
    );
  }
  assert.ok(
    /GOVERNANCE_SUBJECT_TYPES: readonly GovernanceSubjectType\[\] = \["knowledge_node"\];/.test(
      codeOf(read(GOVERNANCE_CONTRACTS)),
    ),
    'governance subject types are still exactly ["knowledge_node"]',
  );
  const sqlCount = readdirSync(path.join(ROOT, MIGRATIONS)).filter((f) => f.endsWith(".sql")).length;
  assert.equal(sqlCount, 44, "this phase authored no migration — counting a table needs none"); /* GIA-1 grew the ledger 43 -> 44: the `record-work` mandate-scope CHECK. */
  const journal = JSON.parse(read(path.join(MIGRATIONS, "meta/_journal.json")));
  assert.equal(journal.entries.length, sqlCount, "and the journal agrees with the files on disk");

  /* ── 11. NO NEW CLIENT-CROSSABLE WRITER APPEARED ──────────────────────────── */
  assert.deepEqual(
    allSourceFiles("src")
      .filter((f) => read(f).includes('"use server"'))
      .sort(),
    [
      "src/app/(dashboard)/agents/actions.ts",
      "src/app/(dashboard)/approvals/actions.ts",
      /* OSA-1 — the Organization Structure Authority's product path. Declared, not silent. */
      "src/app/(dashboard)/director/organization/actions.ts",
      /* WORK-1 — the Organizational Work Authority's server actions. They hold no authority either. */
      "src/app/(dashboard)/director/work/actions.ts",
      "src/app/(dashboard)/foundation/actions.ts",
      "src/app/(dashboard)/governance/authority/actions.ts",
      "src/app/(dashboard)/governance/genesis/actions.ts",
      "src/app/(dashboard)/heby/actions.ts",
      "src/app/(dashboard)/knowledge/actions.ts",
      "src/app/(dashboard)/operations/actions.ts",
      "src/app/login/actions.ts",
      "src/app/login/onboarding-actions.ts",
    ],
    "the server-action boundaries are exactly these — this phase added no writer",
  );

  console.log(
    "agent-id-0-1-acceptance/read-seam-and-truth: one count added, one stale claim repaired, no authority moved",
  );
}

main();
