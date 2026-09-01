/*
 * WORK-1 — THE ORGANIZATIONAL WORK AUTHORITY OWNS WORK, AND NOTHING ELSE.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "WORK-1 writes exactly ONE table — `work_items` — plus the audit sink every governed writer
 *    uses. It cannot write `companies`, `departments`, `memberships`, `users`, `roles`, `agents`,
 *    `agent_mandates`, `decision_records`, any knowledge table, any permit table, or ANY table in
 *    the dead work island. It creates no Governance decision, adds no `governance_domain` value and
 *    no Governance subject type, adds no Heby source class and no workspace entry, changes Live Map
 *    not at all, and gives agents ZERO new authority. Its migration is additive: no DROP, no data
 *    migration, no INSERT. The product route holds no authority and resolves its tenant on the
 *    server."
 *
 * The pins:
 *
 *   WORK ITEM        != WORK ARTIFACT       WORK EXISTS      != WORK DESCRIPTION
 *   WORK STATE       != BUSINESS OUTCOME    ACCOUNTABILITY   != PERMISSION
 *   WORK RECORD      != TASK EXECUTION      WORK             != KNOWLEDGE
 *   DECLARED         != OBSERVED != VERIFIED != SUCCESSFUL != OUTCOME ACHIEVED
 *   UNAVAILABLE      != EMPTY               RECORDED         != AUTHORIZED
 *
 * Structural assertions run over COMMENT-STRIPPED source, so this milestone's own honest prose
 * about what it refuses to do can never satisfy — or trip — a check about what it does.
 * Pure: no database, no network, no model.
 */
import "../../src/db/schema";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { codeOf } from "../helpers/durable-write-detector";
import {
  MAX_WORK_TITLE_LENGTH,
  ORGANIZATIONAL_WORK_AUTHORITY_MODEL,
  WORK_AUDIT_ACTIONS,
  WORK_DECLARED_STATES,
  WORK_DECLARED_STATE_MEANING,
  WORK_ITEM_ENTITY_TYPE,
  WORK_NON_CLAIMS,
  isWellFormedWorkTitle,
  isWorkDeclaredState,
} from "../../src/features/organizational-work/work-contracts";
import { governanceDomainEnum, workDeclaredStateEnum } from "../../src/db/schema/_enums";
import { GOVERNANCE_SUBJECT_TYPES } from "../../src/features/governance-decision/contracts";
import { HEBY_SOURCE_CLASSES } from "../../src/features/heby-integration/contracts";
import { AGENT_ORIGINABLE_ACTION_KINDS } from "../../src/features/agent-origination/contracts";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");

const FEATURE = "src/features/organizational-work";
const WRITER = `${FEATURE}/write-work.server.ts`;
const READER = `${FEATURE}/read-work.server.ts`;
const CONTRACTS = `${FEATURE}/work-contracts.ts`;
const AUDIT = "src/features/governance-audit/organizational-work-audit.server.ts";
const SCHEMA = "src/db/schema/work-item.ts";
const MIGRATION = "src/db/migrations/20260901122013_work1_organizational_work_authority.sql";
const ACTIONS = "src/app/(dashboard)/director/work/actions.ts";
const PAGE = "src/app/(dashboard)/director/work/page.tsx";
const PANEL = "src/components/organizational-work/work-register.tsx";

/** The eight tables the WORK-0 gate measured as dead. WORK-1 activates none of them. */
const DEAD_WORK_ISLAND_SCHEMA = [
  "src/db/schema/task.ts",
  "src/db/schema/goal.ts",
  "src/db/schema/plan.ts",
  "src/db/schema/mission.ts",
  "src/db/schema/workflow.ts",
  "src/db/schema/command.ts",
  "src/db/schema/execution.ts",
  "src/db/schema/reasoning.ts",
];
const DEAD_WORK_ISLAND_SYMBOLS = [
  "tasks",
  "goals",
  "plans",
  "missions",
  "workflows",
  "commands",
  "executions",
  "reasoningTraces",
];

/* ── import-graph machinery, the shape OSA-1's structure firewall established ── */

function withoutComments(source: string): string {
  return codeOf(source);
}

function valueEdges(file: string): string[] {
  const source = withoutComments(read(file));
  const specifiers: string[] = [];
  const re = /^\s*(import|export)\s+(type\s+)?((?:(?!\bfrom\b)[\s\S])*?)\s*from\s*["']([^"']+)["']/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    if (m[2]) continue;
    const clause = m[3] ?? "";
    if (clause.includes("=")) continue;
    const named = clause.match(/\{([\s\S]*)\}/);
    if (named && !/(^|,)\s*(?!type\s)[A-Za-z_$]/.test(named[1]!) && !/^[^{]*[A-Za-z_$]/.test(clause)) {
      continue;
    }
    specifiers.push(m[4]!);
  }
  return specifiers;
}

function resolveSpecifier(from: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = path.join("src", specifier.slice(2));
  else if (specifier.startsWith(".")) base = path.normalize(path.join(path.dirname(from), specifier));
  else return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    const absolute = path.join(ROOT, candidate);
    if (existsSync(absolute) && statSync(absolute).isFile()) return candidate;
  }
  return null;
}

function transitiveGraph(entries: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const specifier of valueEdges(file)) {
      const resolved = resolveSpecifier(file, specifier);
      if (resolved && !seen.has(resolved)) queue.push(resolved);
    }
  }
  return seen;
}

function walk(dir: string): string[] {
  if (!existsSync(path.join(ROOT, dir))) return [];
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(p);
    return entry.isFile() && (p.endsWith(".ts") || p.endsWith(".tsx")) ? [p] : [];
  });
}

const FEATURE_FILES = walk(FEATURE);

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. THE WRITER REACHES NO OTHER AUTHORITY'S WRITER.
 *
 * Measured over the REAL transitive import graph, not over path names.
 *
 * WHY THIS IS NOT A CENSUS OF REACHABLE SCHEMA MODULES: `db/client.server.ts` imports
 * `db/schema/index.ts`, so EVERY writer in this repository transitively "reaches" every table
 * module. A path-based ban on `db/schema/task.ts` would therefore fail for this writer exactly as
 * it fails for every other one — it measures the barrel, not the authority. R3W, R6D and OSA-1 all
 * recorded this failure mode, and the dead-island claim is proved separately by SOURCE SHAPE below
 * and by the absence of a foreign key in the Postgres suite.
 * ═══════════════════════════════════════════════════════════════════════════ */
{
  const graph = transitiveGraph([WRITER]);
  const serverModules = [...graph].filter((file) => file.endsWith(".server.ts")).sort();
  assert.deepEqual(
    serverModules,
    [
      /* The shared control-plane handle every writer in this repository opens. */
      "src/db/client.server.ts",
      "src/features/governance-audit/knowledge-mutation-audit.server.ts",
      "src/features/governance-audit/organizational-work-audit.server.ts",
      "src/features/governance-decision/authority-read.server.ts",
      "src/features/governance-decision/persistence.server.ts",
      "src/features/organizational-work/read-work.server.ts",
      "src/features/organizational-work/write-work.server.ts",
    ],
    "the work writer reaches its own read, its own audit, the shared audit-actor helper, and " +
      "Governance's READ-ONLY authority resolver — and no other authority's writer. A new entry " +
      "here is a deliberate edit, not an accident.",
  );

  for (const forbidden of [
    "src/features/governance-decision/decision-authority.server.ts",
    "src/features/governance-decision/bootstrap-authority.server.ts",
    "src/features/organization-authority/write-structure.server.ts",
    "src/features/membership-authority/authorize-membership.server.ts",
    "src/features/agent-identity/create-durable-agent-identity.server.ts",
    "src/features/agent-identity/retire-durable-agent-identity.server.ts",
    "src/features/agent-mandate/establish-agent-mandate.server.ts",
    "src/features/knowledge/durable-knowledge-writer.server.ts",
    "src/features/knowledge/retract-source.server.ts",
    "src/features/knowledge-ratification/ratify-version.server.ts",
    "src/features/action-authorization/record-action-request.server.ts",
    "src/features/action-execution/execute-authorized-action.server.ts",
    "src/features/work-artifacts/write-work-artifacts.server.ts",
    "src/features/tenant-role-baseline/provision-member-role.server.ts",
  ]) {
    assert.ok(!graph.has(forbidden), `the work writer must not reach ${forbidden}`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. WORK-1 MUTATES ONE TABLE, BY SOURCE SHAPE.
 * ═══════════════════════════════════════════════════════════════════════════ */
{
  const writerCode = withoutComments(read(WRITER));

  for (const table of [
    "departments",
    "memberships",
    "users",
    "companies",
    "roles",
    "agents",
    "agentMandates",
    "organizations",
    "decisionRecords",
    "governanceSessions",
    "knowledgeNodes",
    "knowledgeFacts",
    "permissions",
    "rolePermissions",
    "actionPermits",
    "hebyActionRequests",
    "actionExecutionAttempts",
    "workArtifacts",
    ...DEAD_WORK_ISLAND_SYMBOLS,
  ]) {
    for (const verb of ["insert", "update", "delete"]) {
      const pattern = new RegExp(`\\.${verb}\\(\\s*${table}\\b`);
      assert.ok(
        !pattern.test(writerCode),
        `the work writer must not ${verb} ${table} — that state belongs to another authority`,
      );
    }
  }

  /* It DOES mutate its own table, or the claim above would be vacuous. */
  assert.match(writerCode, /\.insert\(\s*workItems\b/, "the writer inserts its own table");
  assert.match(writerCode, /\.update\(\s*workItems\b/, "the writer updates its own table");

  /* NO DELETE ANYWHERE IN THE FEATURE. WORK-1 retires in place. */
  for (const file of FEATURE_FILES) {
    assert.ok(
      !/\.delete\(/.test(withoutComments(read(file))),
      `${file} must contain no delete — WORK-1 retires in place and deletes nothing`,
    );
  }

  /* THE READ IS READ-ONLY, and provably so. */
  const readerCode = withoutComments(read(READER));
  for (const verb of ["insert", "update", "delete", "transaction"]) {
    assert.ok(
      !new RegExp(`\\.${verb}\\(`).test(readerCode),
      `the work read must contain no ${verb} — it grants nothing and starts nothing`,
    );
  }

  /* THE CONTRACTS MODULE IS PURE: no handle, no query, no server import. */
  const contractsCode = withoutComments(read(CONTRACTS));
  for (const forbidden of ["db/client.server", "drizzle-orm", "getControlPlaneDb", ".server\""]) {
    assert.ok(
      !contractsCode.includes(forbidden),
      `the work contracts must not reach ${forbidden} — it is pure by design`,
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. THE DEAD WORK ISLAND STAYS DEAD.
 * ═══════════════════════════════════════════════════════════════════════════ */
{
  /* No WORK-1 module names any dead-island schema module. */
  for (const file of [...FEATURE_FILES, AUDIT, SCHEMA, ACTIONS, PAGE, PANEL]) {
    const code = withoutComments(read(file));
    for (const dead of DEAD_WORK_ISLAND_SCHEMA) {
      const specifier = dead.replace(/^src\//, "@/").replace(/\.ts$/, "");
      assert.ok(
        !code.includes(specifier),
        `${file} must not import ${specifier} — the dead work island is not activated by WORK-1`,
      );
    }
  }

  /* And the table itself declares no foreign key to any of them. */
  const schemaCode = withoutComments(read(SCHEMA));
  for (const symbol of DEAD_WORK_ISLAND_SYMBOLS) {
    assert.ok(
      !new RegExp(`=>\\s*${symbol}\\.`).test(schemaCode),
      `work_items must hold no reference to ${symbol}`,
    );
  }

  /* Not one of those eight tables gained a writer anywhere in the repository during WORK-1. */
  const authoritativeSeams = walk("src/features").filter((file) => {
    const code = withoutComments(read(file));
    return /from\s+["']@\/db\/schema/.test(code);
  });
  for (const file of authoritativeSeams) {
    const code = withoutComments(read(file));
    for (const symbol of DEAD_WORK_ISLAND_SYMBOLS) {
      for (const verb of ["insert", "update", "delete"]) {
        assert.ok(
          !new RegExp(`\\.${verb}\\(\\s*${symbol}\\b`).test(code),
          `${file} must not ${verb} ${symbol} — that island has no writer and WORK-1 gave it none`,
        );
      }
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. THE MIGRATION IS ADDITIVE. No DROP, no data migration, no INSERT.
 * ═══════════════════════════════════════════════════════════════════════════ */
{
  const sql = read(MIGRATION);
  for (const forbidden of [
    /\bDROP\s+TABLE\b/i,
    /\bDROP\s+COLUMN\b/i,
    /\bDROP\s+CONSTRAINT\b/i,
    /\bDROP\s+INDEX\b/i,
    /\bDROP\s+TYPE\b/i,
    /\bINSERT\s+INTO\b/i,
    /\bUPDATE\s+"/i,
    /\bDELETE\s+FROM\b/i,
    /\bTRUNCATE\b/i,
  ]) {
    assert.ok(!forbidden.test(sql), `the WORK-1 migration must not contain ${forbidden}`);
  }

  /* It touches no EXISTING table: every ALTER names `work_items` and nothing else. */
  const alters = [...sql.matchAll(/ALTER\s+TABLE\s+"([^"]+)"/gi)].map((m) => m[1]);
  assert.deepEqual(
    [...new Set(alters)],
    ["work_items"],
    "the migration alters only the table it creates — no existing table is modified",
  );
  assert.match(sql, /CREATE TABLE "work_items"/, "it creates the one table");
  assert.match(sql, /CREATE TYPE "public"\."work_declared_state"/, "and the one enum");

  /* The composite same-tenant department FK is present, and it binds the PAIR. */
  assert.match(
    sql,
    /work_items_tenant_department_fk"\s+FOREIGN KEY \("tenant_id","department_id"\)/,
    "the department reference is same-tenant enforced by PostgreSQL",
  );

  /* No dead-island table is named anywhere in it. */
  for (const dead of ["tasks", "goals", "plans", "missions", "workflows", "commands", "executions"]) {
    assert.ok(
      !new RegExp(`"${dead}"`).test(sql),
      `the migration must not name ${dead} — the dead island is untouched`,
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. GOVERNANCE IS A GATE, NOT A DECISION.
 * ═══════════════════════════════════════════════════════════════════════════ */
{
  const writerCode = withoutComments(read(WRITER));
  const auditCode = withoutComments(read(AUDIT));

  for (const forbidden of ["decisionRecords", "governanceSessions", "actionPermits", "hebyActionRequests"]) {
    assert.ok(
      !writerCode.includes(forbidden),
      `the work writer must not name ${forbidden} — recording work is not a Governance decision`,
    );
    assert.ok(!auditCode.includes(forbidden), `the work audit must not name ${forbidden}`);
  }

  /*
   * No `governance_domain` value was added for work.
   *
   * Asserted by EXACT value rather than by substring: the enum has carried `workflow` since the
   * foundation baseline, and a substring ban would fail against a released value this milestone
   * never touched — a test that trips on somebody else's vocabulary proves nothing about this one.
   */
  for (const forbidden of ["work", "organizational-work", "work-item", "work-register"]) {
    assert.ok(
      !(governanceDomainEnum.enumValues as readonly string[]).includes(forbidden),
      `no governance_domain value may be ${forbidden} — recording work is not a Governance decision`,
    );
  }

  /* No Governance SUBJECT type was added. WORK-1 leaves that closed list exactly as it found it. */
  assert.deepEqual(
    [...GOVERNANCE_SUBJECT_TYPES],
    ["knowledge_node"],
    "WORK-1 adds no Governance subject type — a work item is not a thing Governance decides about yet",
  );

  /* The audit is APPEND-ONLY: one exported write, no update, no delete, no correction helper. */
  assert.ok(!/\.update\(/.test(auditCode), "the work audit has no update path");
  assert.ok(!/\.delete\(/.test(auditCode), "the work audit has no delete path");
  assert.match(auditCode, /authoritySource:\s*"membership"/, "an administrative human act");
  assert.match(auditCode, /actorType:\s*"human"/, "a work act is always a human's");
  assert.ok(
    !/actorType:\s*[a-zA-Z]/.test(auditCode.replace(/actorType:\s*"human"/g, "")),
    "the actor type is a literal and is never taken from input",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6. AGENTS GAIN ZERO AUTHORITY.
 * ═══════════════════════════════════════════════════════════════════════════ */
{
  /* The originable vocabulary is untouched: still exactly one kind, and it is not work. */
  assert.deepEqual(
    [...AGENT_ORIGINABLE_ACTION_KINDS],
    ["send"],
    "WORK-1 adds no originable action kind — an agent may not propose a work mutation",
  );

  /* No WORK-1 module reaches agent identity, agent mandates or agent origination. */
  for (const file of [...FEATURE_FILES, AUDIT, ACTIONS, PAGE, PANEL]) {
    const code = withoutComments(read(file));
    for (const forbidden of [
      "@/features/agent-identity",
      "@/features/agent-mandate",
      "@/features/agent-origination",
      "@/features/agent-runtime",
      "@/db/schema/agent",
    ]) {
      assert.ok(
        !code.includes(forbidden),
        `${file} must not reach ${forbidden} — WORK-1 gives agents nothing`,
      );
    }
  }

  /*
   * The accountable actor TYPE is a literal, never a value that travelled from a caller.
   *
   * Asserted by enumerating every assignment to it in the writer and requiring each to be one of
   * the two literal forms. An `|| true` escape hatch was written here first and deleted: an
   * assertion that cannot fail is not a test, and this one has to be able to fail if a later edit
   * lets the type through from input.
   */
  const writerCode = withoutComments(read(WRITER));
  const typeAssignments = [...writerCode.matchAll(/accountableActorType:\s*([^,\n]+)/g)].map((m) =>
    m[1]!.trim(),
  );
  assert.ok(typeAssignments.length > 0, "the writer does assign the accountable actor type");
  for (const assignment of typeAssignments) {
    assert.ok(
      assignment === "null" || assignment === 'accountableUserId === null ? null : "human"',
      `the accountable actor type must be a literal, found: ${assignment}`,
    );
  }
  assert.ok(
    !/accountableActorType:\s*input\./.test(writerCode),
    "the accountable actor TYPE is never taken from caller input",
  );
  assert.equal(ORGANIZATIONAL_WORK_AUTHORITY_MODEL.agentAccountablePossible, false);
  assert.equal(ORGANIZATIONAL_WORK_AUTHORITY_MODEL.agentAuthorityAdded, false);

  /* The schema forbids it structurally, and that is the claim that survives a code edit. */
  const schemaCode = withoutComments(read(SCHEMA));
  assert.match(
    schemaCode,
    /work_items_human_accountable_chk/,
    "an agent as accountable party is rejected by PostgreSQL, not by application code",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 7. HEBY AND LIVE MAP ARE UNTOUCHED.
 * ═══════════════════════════════════════════════════════════════════════════ */
{
  /*
   * THE `work` SOURCE CLASS EXISTS, AND IT IS NOT WORK-1'S.
   *
   * This read "the released seventeen are exactly the seventeen" and asserted that no `work` class
   * existed at all. WORK-2 added it — deliberately, as its whole purpose — so the assertion is
   * REPOINTED at what WORK-1 actually owns rather than deleted: none of WORK-1's OWN modules
   * declares or reaches a source class, and the eighteenth was authored by a later milestone in a
   * file WORK-1 did not write.
   *
   * Restating the old claim would now be false, and dropping it would lose a real guarantee.
   */
  assert.equal(
    HEBY_SOURCE_CLASSES.length,
    18,
    "the census is eighteen since WORK-2; WORK-1 itself authored none of them",
  );

  /*
   * WORK-2's grounding projection lives in this directory and legitimately imports Heby's TYPE
   * contracts — the released pattern every authority-owned projection uses (E2-1, E2-5, AMA-3).
   * It is named and excluded here rather than silently widening the ban, so every OTHER file in
   * the feature stays under it.
   */
  const WORK2_GROUNDING = `${FEATURE}/heby-work-source.server.ts`;
  assert.ok(
    FEATURE_FILES.includes(WORK2_GROUNDING),
    "the WORK-2 projection is where this exclusion says it is",
  );

  /* No WORK-1 module reaches Heby or Live Map. */
  for (const file of [...FEATURE_FILES, AUDIT, ACTIONS, PAGE, PANEL]) {
    if (file === WORK2_GROUNDING) continue;
    const code = withoutComments(read(file));
    for (const forbidden of ["@/features/heby", "@/features/live-map"]) {
      assert.ok(
        !code.includes(forbidden),
        `${file} must not reach ${forbidden} — WORK-1 changes neither`,
      );
    }
  }

  /*
   * LIVE MAP still knows nothing about work, and `heby-integration` still holds no work module.
   *
   * `heby-answer/model-answer.server.ts` DOES import the projection since WORK-2 — that is the
   * grounding path — so the sweep is scoped to the two directories whose independence WORK-1
   * actually claimed, and the answer path's own boundary is proved by WORK-2's firewall instead
   * (it asserts the answer graph reaches the projection and NEVER the writer).
   */
  for (const file of [...walk("src/features/heby-integration"), ...walk("src/features/live-map")]) {
    const code = withoutComments(read(file));
    assert.ok(
      !code.includes("organizational-work"),
      `${file} must not reach the work authority — grounding goes through the answer path`,
    );
  }

  /*
   * These two model fields were measurements of WORK-1 and remain true OF WORK-1: it shipped no
   * source class and changed no Live Map. WORK-2 added a class without touching this authority's
   * write surface, which is why the fields still read false rather than being flipped.
   */
  assert.equal(ORGANIZATIONAL_WORK_AUTHORITY_MODEL.hebySourceClassAdded, false);
  assert.equal(ORGANIZATIONAL_WORK_AUTHORITY_MODEL.liveMapChanged, false);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 8. THE PRODUCT SURFACE HOLDS NO AUTHORITY.
 * ═══════════════════════════════════════════════════════════════════════════ */
{
  const actionsCode = withoutComments(read(ACTIONS));
  const pageCode = withoutComments(read(PAGE));
  const panelCode = withoutComments(read(PANEL));

  /* NO CLIENT-SUPPLIED TENANT AUTHORITY. The tenant is resolved server-side, with no argument. */
  for (const [label, code] of [
    ["actions", actionsCode],
    ["page", pageCode],
  ] as const) {
    assert.ok(
      code.includes("resolveTenantContext()"),
      `the ${label} resolves the tenant with no argument`,
    );
    assert.ok(
      !/resolveTenantContext\(\s*[A-Za-z_$"'{]/.test(code),
      `the ${label} passes nothing to resolveTenantContext — there is no parameter for another organization`,
    );
    assert.ok(
      !/tenantId/.test(code),
      `the ${label} never names a tenant id — a browser cannot supply one`,
    );
  }

  /* The actions hold no database handle, no drizzle and no authority resolution of their own. */
  for (const forbidden of ["drizzle-orm", "@/db/schema", "getControlPlaneDb", "resolveGovernanceAuthority"]) {
    assert.ok(
      !actionsCode.includes(forbidden),
      `the work server actions must not reach ${forbidden} — every gate lives in the writer`,
    );
  }

  /* The client component reaches no server module except the action file and released types. */
  assert.ok(
    !panelCode.includes("@/db/"),
    "the work panel holds no schema — it renders what the server handed it",
  );
  assert.ok(panelCode.startsWith('"use client"'), "the panel is a client component");

  /* THE ROUTE USES THE AUTHORITATIVE SEAMS, and reads structure through the ONE organization seam. */
  assert.ok(pageCode.includes("readWorkRegister"), "the route reads the work authority");
  assert.ok(
    pageCode.includes("readOrganizationAuthority"),
    "the route reads structure through the one seam every consumer calls",
  );
  assert.ok(
    !pageCode.includes("readOrganizationStructure"),
    "and not through the structural half directly — no second way to ask is learned here",
  );
  assert.ok(
    pageCode.includes("resolveHumanLabels") && pageCode.includes("readSelectableMembers"),
    "human legibility is Identity's released projection, composed here and never merged",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 9. THE LABEL IS NOT THE KEY, AND NO NAME IS PERSISTED.
 * ═══════════════════════════════════════════════════════════════════════════ */
{
  const schemaCode = withoutComments(read(SCHEMA));
  for (const forbidden of ["name", "email", "displayName", "label"]) {
    assert.ok(
      !new RegExp(`\\b${forbidden}:\\s*text\\(`).test(schemaCode),
      `work_items must hold no ${forbidden} column — a label is Identity's answer, never a stored fact`,
    );
  }

  /* Neither the reader nor the writer selects a human name or email. */
  for (const file of [READER, WRITER]) {
    const code = withoutComments(read(file));
    assert.ok(
      !/users\.(name|email|displayName)/.test(code),
      `${file} must not select a human's name or email`,
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 10. THE VOCABULARY IS ONE VOCABULARY.
 * ═══════════════════════════════════════════════════════════════════════════ */
{
  /* Contracts and the database enum cannot diverge. */
  assert.deepEqual(
    [...WORK_DECLARED_STATES],
    [...workDeclaredStateEnum.enumValues],
    "the declared-state vocabulary and the database enum are the same four values",
  );
  for (const state of workDeclaredStateEnum.enumValues) {
    assert.ok(isWorkDeclaredState(state), `${state} is recognised by the product predicate`);
  }
  assert.ok(!isWorkDeclaredState("done"), "a value outside the vocabulary is refused");

  /* The audit vocabulary is closed and every verb names work. */
  assert.equal(WORK_AUDIT_ACTIONS.length, 5);
  for (const action of WORK_AUDIT_ACTIONS) {
    assert.ok(action.startsWith("work."), `${action} is a work verb`);
  }
  assert.equal(WORK_ITEM_ENTITY_TYPE, "work_item");

  /* A title is accepted exactly as given or refused — never repaired. */
  assert.ok(isWellFormedWorkTitle("Q3 supplier audit"));
  assert.ok(!isWellFormedWorkTitle(""));
  assert.ok(!isWellFormedWorkTitle(" padded"));
  assert.ok(!isWellFormedWorkTitle("padded "));
  assert.ok(!isWellFormedWorkTitle("x".repeat(MAX_WORK_TITLE_LENGTH + 1)));
  assert.ok(isWellFormedWorkTitle("x".repeat(MAX_WORK_TITLE_LENGTH)));

  /* THE SIX WORDS ARE HELD APART, on the surface and not only in a comment. */
  const panelCode = read(PANEL);
  assert.match(
    panelCode,
    /DECLARED by an authorized human/,
    "the surface says the state is declared, in words a reader sees",
  );
  assert.match(
    panelCode,
    /did not observe it, did not verify/,
    "and says what Hebun did not do",
  );

  /*
   * The same claim, asserted against the exported VALUE rather than the source text, because a
   * string split across a concatenation is invisible to a source regex and a surface must not be
   * able to lose this sentence by reflowing a line.
   */
  assert.match(
    WORK_DECLARED_STATE_MEANING.complete,
    /Declared complete by an authorized human/,
    "the meaning of `complete` names the declarer",
  );
  assert.match(
    WORK_DECLARED_STATE_MEANING.complete,
    /did not verify it, did not observe it/,
    "and states what Hebun did not do",
  );
  assert.match(
    WORK_DECLARED_STATE_MEANING.blocked,
    /Hebun did not detect this/,
    "`blocked` is a declaration, never a detection",
  );

  /* The non-claims are values a test can read, not prose nobody ships. */
  assert.ok(WORK_NON_CLAIMS.length >= 5);
  assert.ok(
    WORK_NON_CLAIMS.some((claim) => /not verified/i.test(claim)),
    "declared complete is stated as not verified",
  );
  assert.ok(
    WORK_NON_CLAIMS.some((claim) => /grants that human nothing/i.test(claim)),
    "accountability is stated as granting nothing",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 11. THE BOUNDARY MODEL IS A MEASUREMENT.
 * ═══════════════════════════════════════════════════════════════════════════ */
{
  assert.deepEqual(ORGANIZATIONAL_WORK_AUTHORITY_MODEL.writesTables, ["work_items"]);
  assert.equal(ORGANIZATIONAL_WORK_AUTHORITY_MODEL.writesGovernanceDecision, false);
  assert.equal(ORGANIZATIONAL_WORK_AUTHORITY_MODEL.writesActionAuthorization, false);
  assert.equal(ORGANIZATIONAL_WORK_AUTHORITY_MODEL.writesExecutionAttempt, false);
  assert.equal(ORGANIZATIONAL_WORK_AUTHORITY_MODEL.governanceDomainAdded, false);
  assert.equal(ORGANIZATIONAL_WORK_AUTHORITY_MODEL.governanceSubjectTypeAdded, false);
  assert.equal(ORGANIZATIONAL_WORK_AUTHORITY_MODEL.deadWorkIslandActivated, false);
  assert.equal(ORGANIZATIONAL_WORK_AUTHORITY_MODEL.recordsOutcome, false);
  assert.equal(ORGANIZATIONAL_WORK_AUTHORITY_MODEL.recordsVerification, false);
  assert.match(
    ORGANIZATIONAL_WORK_AUTHORITY_MODEL.limitation,
    /verifies nothing, measures nothing/,
  );
}

console.log("PASS work1-organizational-work/work-firewall");
