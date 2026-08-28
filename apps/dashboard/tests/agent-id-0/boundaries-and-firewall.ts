/*
 * AGENT-ID-0 — the boundary this phase must not cross, and the authority topology it must not blur.
 *
 * ── THE TOPOLOGY ────────────────────────────────────────────────────────────
 *
 * `features/persistence/supabase-postgres-adapter.ts` holds generic agent persistence primitives
 * that predate this phase. Its own first line calls it a PASSIVE persistence foundation. They are
 * not agent identity authority, and this file proves that in the only way that means anything:
 * they have no agent write callers, and the new authority does not reach them.
 *
 * That topology is not invented here. Knowledge already proves it — generic knowledge-node
 * primitives live in the same adapter while `knowledge/knowledge-write-authority.server.ts` owns
 * the domain and imports persistence zero times. Agents now match Knowledge.
 *
 * Source is read with comments STRIPPED. A firewall that reads raw text can be tripped by a comment
 * naming the very thing it forbids — this file names several of them on purpose.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (f: string): string => readFileSync(path.join(ROOT, f), "utf8");
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const AUTHORITY = "src/features/agent-identity/create-durable-agent-identity.server.ts";
const BARREL = "src/features/agent-identity/index.ts";
const FEATURE_DIR = "src/features/agent-identity";

const ADAPTER = "src/features/persistence/supabase-postgres-adapter.ts";
const STORAGE_MANAGER = "src/features/persistence/storage-manager.ts";
const RESOLVER = "src/features/canonical-read/actor-resolution.ts";
const GOVERNANCE_CONTRACTS = "src/features/governance-decision/contracts.ts";
const MIGRATIONS = "src/db/migrations";

/* Lifecycle verbs this phase must not own. Absent, not guarded — a missing verb cannot be called. */
const FORBIDDEN_VERBS = [
  "updateAgent",
  "deleteAgent",
  "archiveAgent",
  "restoreAgent",
  "activateAgent",
  "suspendAgent",
  "retireAgent",
  "authenticateAgent",
  "authorizeAgent",
  "executeAsAgent",
  "issueAgentCredential",
  "createAgentSession",
  "delegateToAgent",
] as const;

/* The seven human-only CHECK constraints. Named individually so a weakening names itself. */
const HUMAN_ONLY_CHECKS = [
  "action_permits_human_authorizer_chk",
  "decision_records_bootstrap_human_chk",
  "heby_action_requests_human_approver_chk",
  "identity_enrollment_requests_human_approver_chk",
  "knowledge_external_references_human_declarer_chk",
  "knowledge_external_references_human_withdrawer_chk",
  "membership_authorizations_human_authorizer_chk",
] as const;

/* Modules an identity writer must never reach. Identity is not authentication, and not runtime. */
const FORBIDDEN_REACH = [
  "src/features/auth-runtime/credential-repository.server.ts",
  "src/features/action-execution/execute-authorized-action.server.ts",
  "src/features/action-authorization/decide-action-request.server.ts",
  "src/features/governance-decision/decision-authority.server.ts",
] as const;

function resolveImport(spec: string, from: string): string | null {
  const base = spec.startsWith("@/")
    ? path.join("src", spec.slice(2))
    : spec.startsWith(".")
      ? path.join(path.dirname(from), spec)
      : null;
  if (!base) return null;
  for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const candidate = base + ext;
    if (existsSync(path.join(ROOT, candidate)) && statSync(path.join(ROOT, candidate)).isFile()) {
      return candidate;
    }
  }
  return null;
}

/** The REAL import graph, walked. A path-name rule would pass while a db handle smuggled the world in. */
function reachableFrom(entry: string): Set<string> {
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length > 0) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const code = codeOf(read(file));
    for (const match of code.matchAll(/from\s+"([^"]+)"/g)) {
      const target = resolveImport(match[1]!, file);
      if (target) stack.push(target);
    }
  }
  return seen;
}

function allSourceFiles(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) return allSourceFiles(rel);
    return entry.isFile() && /\.(ts|tsx)$/.test(entry.name) ? [rel] : [];
  });
}

function main(): void {
  const authority = codeOf(read(AUTHORITY));
  const featureFiles = allSourceFiles(FEATURE_DIR);
  const featureCode = featureFiles.map((f) => codeOf(read(f))).join("\n");

  /* ── 1. ONE TRANSITION, NOT CRUD ──────────────────────────────────────────── */
  for (const verb of FORBIDDEN_VERBS) {
    assert.ok(
      !featureCode.includes(verb),
      `\`${verb}\` must not exist in ${FEATURE_DIR} — this authority owns one transition, not a lifecycle`,
    );
  }
  const exported = [...codeOf(read(BARREL)).matchAll(/\b(createDurableAgentIdentity|isWellFormedAgentName)\b/g)];
  assert.ok(exported.length > 0, "the barrel exports the single creation authority");
  /*
   * AGENT-ID-0 asserted a COUNT of one here. AGENT-ID-0.1 gave the feature its second and last
   * transition (retirement) plus a read, so a count of one became false. It is repaired by becoming
   * STRICTER, not looser: the exact SET of exported async functions is pinned by name, so a fourth
   * one — or a rename of any of these three — fails here rather than sliding under a bumped number.
   */
  assert.deepEqual(
    (featureCode.match(/export async function (\w+)/g) ?? [])
      .map((match) => match.replace("export async function ", ""))
      .sort(),
    ["createDurableAgentIdentity", "readDurableAgentIdentityState", "retireDurableAgentIdentity"],
    "the feature exports exactly these three async functions: two one-way transitions and one read",
  );

  /* ── 2. THE AUTHORITY DOES NOT REACH THE GENERIC PERSISTENCE SUBSTRATE ────── */
  const reach = reachableFrom(AUTHORITY);
  assert.ok(
    !reach.has(ADAPTER),
    `${AUTHORITY} must not reach ${ADAPTER} — the passive substrate is not agent identity authority`,
  );
  assert.ok(
    ![...reach].some((f) => f.startsWith("src/features/persistence/")),
    "the authority reaches no persistence-adapter module at all, exactly as the Knowledge authority does not",
  );
  assert.equal(
    featureCode.includes("@/features/persistence"),
    false,
    "no file in the feature imports the persistence adapter",
  );

  /* ── 3. THE GENERIC AGENT PRIMITIVES STAY CALLER-FREE ─────────────────────── */
  const adapterCode = codeOf(read(ADAPTER));
  for (const primitive of ["insertAgentRow", "updateAgentRow"]) {
    assert.ok(
      adapterCode.includes(primitive),
      `\`${primitive}\` still exists — this phase records that debt rather than deleting it`,
    );
    const callers = allSourceFiles("src/features")
      .filter((f) => f !== ADAPTER)
      .filter((f) => codeOf(read(f)).includes(primitive));
    assert.deepEqual(
      callers,
      [],
      `\`${primitive}\` has no caller outside the adapter — it cannot become a competing lifecycle authority`,
    );
  }
  const postgresAdapterUsers = allSourceFiles("src/features").filter((f) =>
    codeOf(read(f)).includes("createPostgresAdapter"),
  );
  assert.deepEqual(
    postgresAdapterUsers.sort(),
    [
      "src/features/persistence/provider-registry.ts",
      "src/features/persistence/supabase-postgres-adapter.ts",
      "src/features/tenant-registry/durable-registry-repository.server.ts",
    ],
    "the postgres adapter still has exactly its pre-existing three call sites, and agent-identity is not among them",
  );
  assert.ok(
    codeOf(read("src/features/persistence/provider-registry.ts")).includes("agentAdapter.health()"),
    "the only agent-collection adapter instance is still a health probe",
  );
  assert.ok(
    !/agentAdapter\.(create|update|delete|save|clear)\b/.test(
      codeOf(read("src/features/persistence/provider-registry.ts")),
    ),
    "the agent-collection adapter instance is never asked to write",
  );

  /* ── 4. MEMORY REMAINS THE GENERIC AGENT CRUD PROVIDER ────────────────────── */
  assert.ok(
    /const ACTIVE_PROVIDER: StorageProvider = "memory";/.test(codeOf(read(STORAGE_MANAGER))),
    "generic agent CRUD is still memory-backed — this phase did not flip a global provider to fake durability",
  );

  /* ── 5. IDENTITY IS NOT AUTHENTICATION, AUTHORIZATION OR RUNTIME ──────────── */
  for (const forbidden of FORBIDDEN_REACH) {
    assert.ok(
      !reach.has(forbidden),
      `${AUTHORITY} must not reach ${forbidden} — an identity grants no credential, permit, decision or execution`,
    );
  }
  for (const banned of ["auth_credentials", "user_session_contexts", "action_permits", "decision_records"]) {
    assert.ok(
      !authority.includes(banned),
      `the authority never names \`${banned}\` — it writes one table`,
    );
  }
  const insertTargets = [...authority.matchAll(/\.insert\((\w+)\)/g)].map((m) => m[1]);
  assert.deepEqual(
    insertTargets,
    ["agents"],
    "the authority performs exactly one insert, into `agents`, and nothing else",
  );

  /* ── 6. THE CALLER CANNOT NAME A TENANT OR AN OWNER ───────────────────────── */
  const signature = authority.slice(
    authority.indexOf("export async function createDurableAgentIdentity"),
    authority.indexOf("): Promise<CreateDurableAgentIdentityResult>"),
  );
  assert.ok(signature.length > 0, "the authority signature was located");
  assert.ok(
    /input:\s*\{\s*readonly name: unknown\s*\}/.test(signature),
    "the only caller-supplied field is the name — there is no tenant or owner parameter to abuse",
  );
  for (const smuggled of ["tenantId:", "humanOwnerId:", "ownerId:", "actorId:"]) {
    assert.ok(
      !signature.includes(smuggled),
      `the signature exposes no \`${smuggled}\` field — tenant and owner come from resolved server context only`,
    );
  }
  assert.ok(
    authority.includes("tenant.tenantId") && authority.includes("tenant.userId"),
    "tenant and owner are read from the resolved context",
  );

  /* ── 7. NOTHING IS FABRICATED ─────────────────────────────────────────────── */
  const values = authority.slice(authority.indexOf(".values({"), authority.indexOf("})\n      .returning"));
  for (const invented of [
    "managerActorType",
    "managerActorId",
    "departmentId",
    "authorityCeiling",
    "agentType",
    "riskLevel",
    "agentHealth",
    "agentLifecycleStatus",
    "executionPosture",
    "allowedTools",
    "toolProfile",
    "reasoningProfile",
  ]) {
    assert.ok(
      !values.includes(invented),
      `\`${invented}\` is not written — a missing fact stays missing rather than being invented`,
    );
  }

  /* ── 8. HUMAN SUPREMACY IS UNTOUCHED ──────────────────────────────────────── */
  const allMigrations = readdirSync(path.join(ROOT, MIGRATIONS))
    .filter((f) => f.endsWith(".sql"))
    .map((f) => read(path.join(MIGRATIONS, f)))
    .join("\n");
  for (const check of HUMAN_ONLY_CHECKS) {
    assert.ok(
      allMigrations.includes(check),
      `\`${check}\` still exists — an agent identity weakens no human-only constraint`,
    );
  }
  assert.equal(
    (allMigrations.match(/= 'human'/g) ?? []).length >= HUMAN_ONLY_CHECKS.length,
    true,
    "the human-only predicates are still present in the ledger",
  );

  /* ── 9. NO SCHEMA CHANGE, NO MIGRATION ────────────────────────────────────── */
  const sqlCount = readdirSync(path.join(ROOT, MIGRATIONS)).filter((f) => f.endsWith(".sql")).length;
  assert.equal(sqlCount, 37, "AGENT-ID-0 authored no migration — this phase needed none");
  const journal = JSON.parse(read(path.join(MIGRATIONS, "meta/_journal.json")));
  assert.equal(journal.entries.length, sqlCount, "and the journal agrees with the files on disk");

  /* ── 10. GOVERNANCE IS NOT WIDENED ────────────────────────────────────────── */
  assert.ok(
    /GOVERNANCE_SUBJECT_TYPES: readonly GovernanceSubjectType\[\] = \["knowledge_node"\];/.test(
      codeOf(read(GOVERNANCE_CONTRACTS)),
    ),
    "governance subject types are still exactly [\"knowledge_node\"] — an agent is not a governance subject",
  );

  /* ── 11. THE CANONICAL READER IS UNCHANGED AND UNDUPLICATED ───────────────── */
  const resolverDiff = execFileSync("git", ["diff", "--", RESOLVER], { cwd: ROOT, encoding: "utf8" });
  assert.equal(
    resolverDiff.trim(),
    "",
    `${RESOLVER} is byte-unchanged — the durable identity is read by the existing seam, not a new one`,
  );
  const rivalReaders = allSourceFiles("src/features")
    .filter((f) => !f.startsWith("src/features/canonical-read/"))
    .filter((f) => /from\s+public\.agents|from\s+agents\b/.test(codeOf(read(f))));
  assert.deepEqual(
    rivalReaders.filter((f) => !f.startsWith("src/features/persistence/")),
    [],
    "no second canonical agent reader was created",
  );

  /* ── 12. THE SHADOW READ STAYS DIAGNOSTIC ─────────────────────────────────── */
  const shadow = codeOf(read("src/features/actor-shadow-read/service.ts"));
  for (const authorityVerb of [".insert(", ".update(", ".delete("]) {
    assert.ok(
      !shadow.includes(authorityVerb),
      `actor-shadow-read performs no \`${authorityVerb}\` — it remains diagnostic, with no authorization effect`,
    );
  }

  console.log("agent-id-0/boundaries-and-firewall: one transition, one table, no second authority");
}

main();
