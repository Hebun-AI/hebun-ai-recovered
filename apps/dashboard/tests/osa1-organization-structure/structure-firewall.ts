/*
 * OSA-1 — THE ORGANIZATION STRUCTURE AUTHORITY OWNS STRUCTURE, AND NOTHING ELSE.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "OSA writes exactly ONE table — `departments` — plus the audit sink every governed writer uses.
 *    It cannot write `companies`, `memberships`, `roles`, `agents`, `agent_mandates`,
 *    `decision_records`, `governance_sessions`, any knowledge table, or `organizations`. It creates
 *    no Governance decision and no `governance_domain` value. It ships no human roster, no
 *    human-to-department assignment and no agent-assignment writer. Naming a department owner is
 *    attribution, not authority: nothing in this repository reads `owner_actor_id` to decide
 *    anything, and the Governance authority resolver has never heard of a department."
 *
 * The pins:
 *
 *   DEPARTMENT OWNER != GOVERNANCE AUTHORITY   DEPARTMENT OWNER != APPROVER
 *   DEPARTMENT OWNER != TENANT MEMBERSHIP      DEPARTMENT       != ROLE
 *   DEPARTMENT       != TEAM                   STRUCTURE        != PERMISSION
 *   UNAVAILABLE      != EMPTY                  RECORDED         != AUTHORIZED
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
  DEPARTMENT_AUDIT_ACTIONS,
  DEPARTMENT_ENTITY_TYPE,
  MAX_DEPARTMENT_NAME_LENGTH,
  MAX_DEPARTMENT_SLUG_LENGTH,
  ORGANIZATION_STRUCTURE_AUTHORITY_MODEL,
  isWellFormedDepartmentName,
  isWellFormedDepartmentSlug,
} from "../../src/features/organization-authority/structure-contracts";
import { ORGANIZATION_AUTHORITY_MODEL } from "../../src/features/organization-authority/contracts";
import { governanceDomainEnum } from "../../src/db/schema/_enums";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");

const FEATURE = "src/features/organization-authority";
const WRITER = `${FEATURE}/write-structure.server.ts`;
const READER = `${FEATURE}/read-structure.server.ts`;
const CONTRACTS = `${FEATURE}/structure-contracts.ts`;
const L3_READ = `${FEATURE}/read-organization.server.ts`;
const GROUNDING = `${FEATURE}/heby-organization-source.server.ts`;
const AUDIT = "src/features/governance-audit/organization-structure-audit.server.ts";
const SCHEMA = "src/db/schema/department.ts";
const AGENT_SCHEMA = "src/db/schema/agent.ts";
const MIGRATION = "src/db/migrations/20260831212454_osa1_department_structure_authority.sql";
const ACTIONS = "src/app/(dashboard)/director/organization/actions.ts";
const PANEL = "src/components/organization-domain/department-structure.tsx";

/* ── import-graph machinery, the shape E2-6's grounding firewall established ── */

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

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. OSA WRITES ONE TABLE. Measured over the writer's REAL transitive graph.
 * ═══════════════════════════════════════════════════════════════════════════ */
{
  const graph = transitiveGraph([WRITER]);

  /*
   * WHY THIS IS NOT A CENSUS OF REACHABLE SCHEMA MODULES.
   *
   * `db/client.server.ts` imports `db/schema/index.ts`, so EVERY writer in this repository
   * transitively "reaches" every table module. A path-based ban on `db/schema/company.ts` would
   * therefore fail for the structure writer exactly as it fails for the Knowledge writer — it
   * measures the barrel, not the authority. R3W and R6D both recorded this failure mode.
   *
   * So the graph assertion is on OTHER AUTHORITIES' SERVER MODULES, which is what a writer would
   * have to reach to borrow somebody else's mutation, and the table claim is proved separately by
   * source shape below.
   */
  const serverModules = [...graph].filter((file) => file.endsWith(".server.ts")).sort();
  assert.deepEqual(
    serverModules,
    [
      /* The shared control-plane handle every writer in this repository opens. */
      "src/db/client.server.ts",
      "src/features/governance-audit/knowledge-mutation-audit.server.ts",
      "src/features/governance-audit/organization-structure-audit.server.ts",
      "src/features/governance-decision/authority-read.server.ts",
      "src/features/governance-decision/persistence.server.ts",
      "src/features/organization-authority/read-structure.server.ts",
      "src/features/organization-authority/write-structure.server.ts",
    ],
    "the structure writer reaches its own read, its own audit, the shared audit-actor helper, and " +
      "Governance's READ-ONLY authority resolver — and no other authority's writer. A new entry " +
      "here is a deliberate edit, not an accident.",
  );

  /* Every one of those is a READ or an APPEND. None of them mutates another authority's state. */
  for (const forbidden of [
    "src/features/governance-decision/decision-authority.server.ts",
    "src/features/governance-decision/bootstrap-authority.server.ts",
    "src/features/membership-authority/authorize-membership.server.ts",
    "src/features/agent-identity/create-durable-agent-identity.server.ts",
    "src/features/agent-identity/retire-durable-agent-identity.server.ts",
    "src/features/agent-mandate/establish-agent-mandate.server.ts",
    "src/features/knowledge/durable-knowledge-writer.server.ts",
    "src/features/knowledge/retract-source.server.ts",
    "src/features/knowledge-ratification/ratify-version.server.ts",
    "src/features/action-authorization/record-action-request.server.ts",
    "src/features/action-execution/execute-authorized-action.server.ts",
    "src/features/tenant-role-baseline/provision-member-role.server.ts",
  ]) {
    assert.ok(!graph.has(forbidden), `the structure writer must not reach ${forbidden}`);
  }

  /*
   * THE TABLE CLAIM, BY SOURCE SHAPE. What a writer can actually mutate is what it names as an
   * insert/update/delete target, and this is the only file in the feature that mutates anything.
   */
  const writerCode = withoutComments(read(WRITER));
  for (const table of [
    "memberships",
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
  ]) {
    for (const verb of ["insert", "update", "delete"]) {
      const pattern = new RegExp(`\\.${verb}\\(\\s*${table}\\b`);
      assert.ok(
        !pattern.test(writerCode),
        `the structure writer must not ${verb} ${table} — that state belongs to another authority`,
      );
    }
  }
  assert.match(writerCode, /\.insert\(departments\)/, "it does insert the table it owns");
  assert.match(writerCode, /\.update\(departments\)/, "and update it");
  assert.ok(!/\.delete\(/.test(writerCode), "and deletes nothing, anywhere");

  /*
   * `memberships` is READ inside the writer — verification, never mutation.
   *
   * REPAIRED AT THE OWNER-ELIGIBILITY HARDENING, and stricter than what it replaced. The old pin was
   * `.from(memberships)`, a literal that died when the owner check began joining `users` for two
   * lifecycle columns. The claim it was making — membership is READ here and never written — is
   * unchanged, so it is now asserted by naming both halves of the read and re-stating the mutation
   * ban that gives it meaning.
   */
  assert.match(writerCode, /\.innerJoin\(memberships/, "membership is read to verify an owner");
  assert.match(
    writerCode,
    /eligibleTenantMemberWhere/,
    "and the owner check uses the SHARED eligibility rule, not one it re-typed for itself",
  );
  for (const verb of ["insert", "update", "delete"]) {
    assert.ok(
      !new RegExp(`\\.${verb}\\(\\s*memberships\\b`).test(writerCode),
      `reading membership never became writing it: no .${verb}(memberships)`,
    );
    assert.ok(
      !new RegExp(`\\.${verb}\\(\\s*users\\b`).test(writerCode),
      `and the identity table is read-only to this authority: no .${verb}(users)`,
    );
  }

  /*
   * THE WRITER LEARNED NO NAME. Hardening reaches `users` for `lifecycle_status` and `deleted_at`
   * and for nothing else — a projection carrying a name would make this authority a roster read.
   */
  for (const column of ["users.name", "users.email", "users.displayName", "display_name"]) {
    assert.ok(
      !writerCode.includes(column),
      `the structure writer never selects ${column} — eligibility is a yes/no, not a description`,
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. NO GOVERNANCE DECISION, AND NO NEW DOMAIN.
 * ═══════════════════════════════════════════════════════════════════════════ */
{
  const writerCode = withoutComments(read(WRITER));
  assert.ok(
    !/writeGovernanceDecisionWithin/.test(writerCode),
    "OSA writes no Governance decision — recording structure moves no authority",
  );
  assert.ok(
    !/decisionRecords|governanceSessions/.test(writerCode),
    "and names no Governance table as a value",
  );

  /* It DOES consume the resolver, as a gate. Reading authority is not writing a decision. */
  assert.match(
    writerCode,
    /resolveGovernanceAuthority/,
    "the administrative gate is the existing Governance authority resolver",
  );

  assert.equal(
    ORGANIZATION_STRUCTURE_AUTHORITY_MODEL.writesGovernanceDecision,
    false,
    "the boundary model says so too, where a test can read it",
  );

  /*
   * NO `governance_domain` VALUE WAS ADDED. Measured against the enum itself rather than trusted:
   * `organizational-role` already exists and belongs to the tenant role baseline, and OSA
   * deliberately does not borrow it.
   */
  const domains = governanceDomainEnum.enumValues as readonly string[];
  assert.ok(
    !domains.includes("department") && !domains.includes("organization-structure"),
    "no department-shaped governance domain was added",
  );
  assert.equal(ORGANIZATION_STRUCTURE_AUTHORITY_MODEL.governanceDomainAdded, false);
  const migration = read(MIGRATION);
  assert.ok(
    !/ALTER TYPE .*governance_domain/i.test(migration),
    "the migration adds no governance_domain value",
  );
  for (const forbidden of [
    /\bDROP\s+TABLE\b/i,
    /\bDROP\s+COLUMN\b/i,
    /\bDELETE\s+FROM\b/i,
    /\bTRUNCATE\b/i,
    /\bCREATE\s+TABLE\b/i,
    /\bINSERT\s+INTO\b/i,
  ]) {
    assert.ok(
      !forbidden.test(migration),
      `the hardening migration is ADDITIVE — it must not contain ${forbidden}`,
    );
  }
  assert.match(
    migration,
    /ALTER TABLE "agents" DROP CONSTRAINT "agents_department_id_departments_id_fk"/,
    "it does replace the unsafe single-column FK",
  );
  assert.ok(
    migration.indexOf('CREATE UNIQUE INDEX "departments_tenant_id_uq"') <
      migration.indexOf('ADD CONSTRAINT "agents_tenant_department_fk"'),
    "the anchor is created BEFORE the FK that references it, or PostgreSQL refuses the migration",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. DEPARTMENT OWNER != GOVERNANCE AUTHORITY, AND != MEMBERSHIP AUTHORITY.
 *
 * The strongest form of this claim is a CENSUS: nothing anywhere reads the owner column to decide
 * anything, and the two authorities that DO decide have never heard of a department.
 * ═══════════════════════════════════════════════════════════════════════════ */
{
  const authorityRead = withoutComments(read("src/features/governance-decision/authority-read.server.ts"));
  assert.ok(
    !/department/i.test(authorityRead),
    "the Governance authority resolver does not consult a department, in any form",
  );

  const membershipWriter = withoutComments(
    read("src/features/membership-authority/authorize-membership.server.ts"),
  );
  assert.ok(
    !/department/i.test(membershipWriter),
    "membership authorization does not consult a department either",
  );

  /*
   * WHO READS `ownerActorId` AT ALL? Exactly the three modules that RENDER or REPORT it, and no
   * decision path. A fourth reader is a deliberate edit here.
   */
  /*
   * SCOPED TO THE DEPARTMENT OWNER. `ownerActorId` is a column name several tables carry —
   * `platform-core/knowledge/types.ts` declares its own, and always did — so a bare name search
   * would census an unrelated concept and call the result a boundary. The census is therefore over
   * files that name the DEPARTMENT owner: the column reached through `departments`.
   */
  const readers = [...walk("src/features"), ...walk("src/app"), ...walk("src/components")].filter(
    (file) => {
      const code = withoutComments(read(file));
      return /departments\.ownerActor|departments\.owner_actor/.test(code);
    },
  );
  assert.deepEqual(
    readers.sort(),
    [WRITER, READER].sort(),
    "only the structure writer and its own read seam name the owner column — no gate reads it",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. NO ROSTER, NO ASSIGNMENT WRITER, NO TEAMS.
 * ═══════════════════════════════════════════════════════════════════════════ */
{
  assert.equal(ORGANIZATION_STRUCTURE_AUTHORITY_MODEL.humanRoster, false);
  assert.equal(ORGANIZATION_STRUCTURE_AUTHORITY_MODEL.humanAssignment, false);
  assert.equal(ORGANIZATION_STRUCTURE_AUTHORITY_MODEL.agentAssignmentWriter, false);

  const featureFiles = walk(FEATURE);
  for (const file of featureFiles) {
    const code = withoutComments(read(file));
    assert.ok(
      !/\.update\(\s*agents\)|\.insert\(\s*agents\)/.test(code),
      `${file} must not write agents — assignment is Agent Identity's to own, not OSA's`,
    );
    assert.ok(
      !/departmentId\s*:/.test(code) || !/agents/.test(code),
      `${file} must not set an agent's department`,
    );
  }

  /* No team concept was introduced anywhere. */
  assert.ok(
    !existsSync(path.join(ROOT, "src/db/schema/team.ts")),
    "OSA-1 introduces no team table",
  );

  /*
   * THE ROSTER CLAIM, MEASURED. The structural read touches `memberships`, and it must do so ONLY
   * through a bounded per-owner predicate — never a listing. `users` is not reachable at all, so no
   * name or email can travel with a department.
   */
  const readerCode = withoutComments(read(READER));
  assert.ok(
    !/\busers\b/.test(readerCode),
    "the structure read names `users` nowhere, so no name or email can travel with a department",
  );
  assert.match(readerCode, /inArray\(memberships\.userId/, "membership status is an id-bounded read");
  assert.ok(
    !/\.insert\(|\.update\(|\.delete\(|\.transaction\(/.test(readerCode),
    "and the structure read is READ-ONLY, provably: no insert, update, delete or transaction",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. ONE ORGANIZATION READ SYSTEM. Consumers inherit; they do not re-implement.
 * ═══════════════════════════════════════════════════════════════════════════ */
{
  /*
   * The ONLY module outside this feature that may reach the structure read is L3's own seam — and
   * inside the feature, only the writer's lifecycle constants. Anything else building its own
   * structural interpretation is the second read system this milestone must not create.
   */
  const consumers = [...walk("src/features"), ...walk("src/app"), ...walk("src/components")].filter(
    (file) =>
      file !== READER &&
      valueEdges(file).some((spec) => resolveSpecifier(file, spec) === READER),
  );
  assert.deepEqual(
    consumers.sort(),
    [L3_READ, WRITER].sort(),
    "only the L3 seam and the writer reach the structure read — every surface inherits through L3",
  );

  const l3 = withoutComments(read(L3_READ));
  assert.ok(
    !/from\s+["']@\/db\/schema\/department["']/.test(l3),
    "the L3 seam gained no department query of its own — it delegates",
  );
  assert.match(l3, /readOrganizationStructure/, "and it does delegate");

  assert.equal(
    ORGANIZATION_AUTHORITY_MODEL.structuralAuthorityExists,
    true,
    "L3 now records that a structural authority exists",
  );
  assert.equal(
    ORGANIZATION_AUTHORITY_MODEL.writerCreated,
    false,
    "and that the L3 read itself still creates no writer",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6. HEBY INHERITS. NO NEW SOURCE CLASS, NO MODEL-SPECIFIC TRUTH.
 * ═══════════════════════════════════════════════════════════════════════════ */
{
  const grounding = withoutComments(read(GROUNDING));
  assert.match(grounding, /sourceClass:\s*"organization"/, "the grounding class is unchanged");
  assert.ok(
    !/from\s+["']@\/db\/schema\/department["']/.test(grounding),
    "Heby's grounding reads no department table — it inherits through the L3 seam",
  );
  assert.ok(
    !/readOrganizationStructure/.test(grounding),
    "and does not call the structure read directly either",
  );

  const classes = withoutComments(read("src/features/heby-integration/contracts.ts"));
  assert.ok(
    !/"organization-structure"|"departments"/.test(classes),
    "no new Heby source class was added for structure",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 7. THE PRODUCT PATH HOLDS NO AUTHORITY.
 * ═══════════════════════════════════════════════════════════════════════════ */
{
  const actions = withoutComments(read(ACTIONS));
  assert.match(actions, /^"use server";/, "the actions module is server-only");
  assert.match(actions, /resolveTenantContext\(\)/, "the tenant is resolved SERVER-SIDE");
  assert.ok(
    !/tenantId\s*[:=]/.test(actions),
    "no action accepts or constructs a tenant id — a browser cannot name another organization",
  );
  for (const forbidden of [/\.insert\(/, /\.update\(/, /\.transaction\(/, /drizzle-orm/]) {
    assert.ok(!forbidden.test(actions), `the actions module holds no persistence: ${forbidden}`);
  }

  const panel = withoutComments(read(PANEL));
  assert.ok(
    !/agents\/mock|features\/agents/.test(panel),
    "the department surface promotes no seeded department",
  );
  assert.match(
    panel,
    /grants them nothing/,
    "and states on the surface that ownership grants nothing",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 8. THE SCHEMA SAYS WHAT THE CONTRACTS SAY.
 * ═══════════════════════════════════════════════════════════════════════════ */
{
  const schema = read(SCHEMA);
  assert.match(schema, /departments_no_second_parent_chk/, "the second parent is unrepresentable");
  assert.match(schema, /departments_human_owner_chk/, "an agent owner is unrepresentable");
  assert.match(schema, /departments_tenant_id_uq/, "the composite anchor exists");
  assert.match(schema, /where\(sql`\$\{t\.lifecycleStatus\} = 'active'`\)/, "slug uniqueness is partial");

  /* The slug rule is stated ONCE in the writer's vocabulary and MIRRORED in the database. */
  const dbPattern = /\^\[a-z0-9\]\+\(-\[a-z0-9\]\+\)\*\$/;
  assert.match(schema, dbPattern, "the database carries the canonical slug shape");
  assert.match(read(CONTRACTS), dbPattern, "and the released vocabulary carries the same one");
  for (const good of ["finance", "people-ops", "a1", "x-y-z"]) {
    assert.ok(isWellFormedDepartmentSlug(good), `${good} is canonical`);
  }
  for (const bad of ["Finance", "-lead", "trail-", "double--hyphen", "has space", ""]) {
    assert.ok(!isWellFormedDepartmentSlug(bad), `${bad} is refused`);
  }
  assert.ok(!isWellFormedDepartmentName(" padded "), "a name is never trimmed into validity");
  assert.ok(!isWellFormedDepartmentName("x".repeat(MAX_DEPARTMENT_NAME_LENGTH + 1)));
  assert.ok(!isWellFormedDepartmentSlug("a".repeat(MAX_DEPARTMENT_SLUG_LENGTH + 1)));

  /*
   * `manager_actor_*` IS LEFT ALONE. No constraint, no writer, no projection — a later milestone
   * that needs a manager inherits a clean column rather than one this phase shaped for a purpose it
   * never had.
   */
  const featureCode = walk(FEATURE).map((f) => withoutComments(read(f))).join("\n");
  assert.ok(
    !/managerActor/.test(featureCode),
    "OSA-1 writes and exposes no manager — an owner and a manager are two different facts",
  );

  /* The agent schema carries the repair, and no assignment writer came with it. */
  const agentSchema = read(AGENT_SCHEMA);
  assert.match(agentSchema, /agents_tenant_department_fk/, "the composite FK is declared");
  assert.ok(
    !/departmentId: uuid\("department_id"\)\.references/.test(agentSchema),
    "the unsafe single-column reference is gone from the schema too",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 9. THE AUDIT VOCABULARY IS CLOSED, AND OSA-OWNED.
 * ═══════════════════════════════════════════════════════════════════════════ */
{
  assert.equal(DEPARTMENT_ENTITY_TYPE, "department");
  assert.equal(DEPARTMENT_AUDIT_ACTIONS.length, 4, "four acts, four verbs");
  for (const action of DEPARTMENT_AUDIT_ACTIONS) {
    assert.match(action, /^organization\.department\./, `${action} is namespaced to this authority`);
  }
  const auditCode = withoutComments(read(AUDIT));
  for (const forbidden of [/\.update\(/, /\.delete\(/, /upsert/i]) {
    assert.ok(!forbidden.test(auditCode), `the audit writer is APPEND-ONLY: ${forbidden}`);
  }
  assert.match(auditCode, /actorType: "human"/, "every structural act is attributed to a human");
}

console.log("osa1-organization-structure/structure-firewall: OK");
