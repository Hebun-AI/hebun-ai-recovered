/*
 * DEPARTMENTAL PLACEMENT — THE WHOLE PATH IS CONNECTED, AND NOTHING ELSE MOVED.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "A placement travels placement authority -> read seam -> projection -> source resolution ->
 *    Command workspace -> MODEL CONTEXT -> answer, end to end, AND onto a product surface. And it
 *    took nothing with it: no membership write, no department write, no Governance decision, no
 *    action kind, no permit, no mandate, no execution, no provider capability, and no second
 *    source of truth."
 *
 * A DECLARED SOURCE CLASS WITH NO RUNTIME SUBSTITUTION IS NOT CONNECTED.
 * A SUBSTITUTION WITH NO WORKSPACE REACHABILITY IS NOT AVAILABLE.
 * A CONTEXT ITEM THAT NEVER REACHES THE ANSWER PATH IS NOT PRODUCT REACHABILITY.
 * A BACKEND SEAM WITH NO SURFACE IS NOT A CAPABILITY.
 *
 * Structural assertions run over COMMENT-STRIPPED source, so this capability's own honest prose
 * about what it refuses to do can never satisfy — or trip — a check about what it does.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { codeOf } from "../helpers/durable-write-detector";
import { answerHebyModelRequest } from "../../src/features/heby-answer/model-answer.server";
import { readPlacementGroundingSource } from "../../src/features/organization-authority/heby-placement-source.server";
import { HEBY_SOURCE_CLASSES } from "../../src/features/heby-integration/contracts";
import { AGENT_ORIGINABLE_ACTION_KINDS } from "../../src/features/agent-origination/contracts";
import { GOVERNANCE_SUBJECT_TYPES } from "../../src/features/governance-decision/contracts";
import { DEPARTMENTAL_PLACEMENT_AUTHORITY_MODEL } from "../../src/features/organization-authority/placement-contracts";
import { ORGANIZATION_STRUCTURE_AUTHORITY_MODEL } from "../../src/features/organization-authority/structure-contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import type { PlacementRegister } from "../../src/features/organization-authority/read-placement.server";
import type { ModelGenerationRequest } from "../../src/features/heby-runtime/contracts";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
const withoutComments = (s: string): string => codeOf(s);

const FEATURE = "src/features/organization-authority";
const GROUNDING = `${FEATURE}/heby-placement-source.server.ts`;
const WRITER = `${FEATURE}/write-placement.server.ts`;
const READER = `${FEATURE}/read-placement.server.ts`;
const STRUCTURE_WRITER = `${FEATURE}/write-structure.server.ts`;
const SCHEMA = "src/db/schema/department-placement.ts";
const AUDIT = "src/features/governance-audit/departmental-placement-audit.server.ts";
const MODEL_ANSWER = "src/features/heby-answer/model-answer.server.ts";
const PAGE = "src/app/(dashboard)/director/organization/page.tsx";
const PANEL = "src/components/organization-domain/departmental-placement.tsx";
const ACTIONS = "src/app/(dashboard)/director/organization/actions.ts";
const JOURNAL = "src/db/migrations/meta/_journal.json";

const TENANT = { tenantId: "t-1", userId: "u-1" } as unknown as TenantContext;

const REGISTER: PlacementRegister = {
  status: "available",
  truncated: false,
  detail: "detail",
  placements: [
    {
      placementId: "p-1",
      userId: "u-1",
      departmentId: "d-1",
      departmentName: "Engineering",
      departmentSlug: "engineering",
      departmentInService: true,
      currentlyActiveMember: true,
    },
  ],
};

/* ── the import-graph walker, the shape OSA-1, WORK-1 and WORK-2 established ── */
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
  for (const c of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    const abs = path.join(ROOT, c);
    if (existsSync(abs) && statSync(abs).isFile()) return c;
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
    for (const spec of valueEdges(file)) {
      const r = resolveSpecifier(file, spec);
      if (r && !seen.has(r)) queue.push(r);
    }
  }
  return seen;
}
function walk(dir: string): string[] {
  if (!existsSync(path.join(ROOT, dir))) return [];
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return e.isFile() && (p.endsWith(".ts") || p.endsWith(".tsx")) ? [p] : [];
  });
}

async function main(): Promise<void> {
  /* ═════════════════════════════════════════════════════════════════════════
   * 1. END TO END — THE CLASS REACHES THE MODEL REQUEST.
   *
   * The REAL answer flow with the REAL projection; only the authority's own read seam is injected.
   * ═══════════════════════════════════════════════════════════════════════ */
  let captured: ModelGenerationRequest | undefined;
  await answerHebyModelRequest(
    { prompt: "Who works in Engineering?", route: "/heby" },
    {
      resolveTenant: async () => TENANT,
      readOverview: () => undefined,
      getConversationRepo: () => null,
      resolveDirectorEnabled: async () => true,
      env: {
        HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
        HEBUN_MODEL_PROVIDER: "claude",
        HEBUN_MODEL_ID: "synthetic-test-model",
        HEBUN_MODEL_CREDENTIAL: "synthetic-not-a-real-key",
        HEBUN_MODEL_TRANSPORT: "fake",
      },
      resolvePlacements: async (tenant) =>
        readPlacementGroundingSource(tenant, {
          readRegister: async () => REGISTER,
          resolveNames: async () => new Map([["u-1", "Pat Preferred"]]),
        }),
      generate: async (request) => {
        captured = request;
        return {
          status: "unavailable" as const,
          state: "TRANSPORT_UNAVAILABLE" as const,
          modelStatus: { available: false, reason: "provider-unavailable" as const, detail: "test" },
        };
      },
    },
  );

  assert.ok(captured, "the answer flow must have composed a model request");
  const grounding = captured!.evidence.join("\n");
  assert.match(grounding, /\[placement\/placement\/p-1\]/, "the placement citation reaches the model");
  assert.match(grounding, /Pat Preferred/, "the human's PROVIDER-SAFE name reaches the model");
  assert.match(grounding, /\(u-1\)/, "and the identifier travels beside it");
  assert.match(grounding, /Engineering/, "the department reaches the model");
  assert.match(grounding, /RECORDED BY AN AUTHORIZED HUMAN/, "the provenance reaches the model");
  assert.match(
    grounding,
    /NOT A ROLE, NOT A JOB TITLE, NOT A REPORTING LINE/,
    "the truth semantics reach the model as data, not as prompt prose",
  );

  /* NO ADDRESS, ANYWHERE IN THE WHOLE REQUEST. The disclosure boundary, applied at design time. */
  assert.ok(
    !JSON.stringify(captured).includes("@"),
    "no email address reaches the provider through this class",
  );

  /* ═════════════════════════════════════════════════════════════════════════
   * 2. A THROWING READ DEGRADES; IT NEVER INVENTS OR DENIES.
   * ═══════════════════════════════════════════════════════════════════════ */
  let degraded: ModelGenerationRequest | undefined;
  await answerHebyModelRequest(
    { prompt: "Who works where?", route: "/heby" },
    {
      resolveTenant: async () => TENANT,
      readOverview: () => undefined,
      getConversationRepo: () => null,
      resolveDirectorEnabled: async () => true,
      env: {
        HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
        HEBUN_MODEL_PROVIDER: "claude",
        HEBUN_MODEL_ID: "synthetic-test-model",
        HEBUN_MODEL_CREDENTIAL: "synthetic-not-a-real-key",
        HEBUN_MODEL_TRANSPORT: "fake",
      },
      resolvePlacements: async () => {
        throw new Error("placement read exploded");
      },
      generate: async (request) => {
        degraded = request;
        return {
          status: "unavailable" as const,
          state: "TRANSPORT_UNAVAILABLE" as const,
          modelStatus: { available: false, reason: "provider-unavailable" as const, detail: "test" },
        };
      },
    },
  );
  const degradedGrounding = degraded!.evidence.join("\n");
  assert.match(degradedGrounding, /\[placement\] unavailable/, "the class degrades to the pure resolution");
  assert.match(degradedGrounding, /tenant-scoped on the server/);
  assert.ok(
    !/nobody is placed|no placements|nobody works/i.test(degradedGrounding),
    "A THROWN READ MUST NEVER READ AS 'NOBODY WORKS ANYWHERE'",
  );

  /* ═════════════════════════════════════════════════════════════════════════
   * 3. HEBY HAS NO PLACEMENT WRITER — measured over the REAL import graph.
   * ═══════════════════════════════════════════════════════════════════════ */
  const answerGraph = transitiveGraph([MODEL_ANSWER]);
  assert.ok(answerGraph.has(GROUNDING), "the answer path reaches the placement PROJECTION");
  assert.ok(!answerGraph.has(WRITER), "and it must NEVER reach the placement WRITER");

  const answerCode = withoutComments(read(MODEL_ANSWER));
  for (const mutation of ["placeHumanInDepartment", "withdrawPlacement", "departmentPlacements"]) {
    assert.ok(
      !answerCode.includes(mutation),
      `the answer path must not name ${mutation} — HEBY GROUNDS ON PLACEMENT != HEBY CAN PLACE ANYBODY`,
    );
  }

  /* The projection itself is read-only, and provably. */
  const groundingCode = withoutComments(read(GROUNDING));
  for (const verb of ["insert", "update", "delete", "transaction"]) {
    assert.ok(
      !new RegExp(`\\.${verb}\\(`).test(groundingCode),
      `the placement projection must contain no ${verb}`,
    );
  }
  assert.ok(
    !groundingCode.includes("write-placement.server"),
    "the projection imports the READ seam, never the writer",
  );
  assert.ok(!groundingCode.includes("@/db/schema"), "and holds no table of its own");

  /* AND ITS NAME READ IS THE PROVIDER-SAFE ONE. Designed in, not discovered later. */
  assert.ok(groundingCode.includes("resolveHumanNames"), "the projection resolves provider-safe NAMES");
  assert.ok(
    !groundingCode.includes("resolveHumanLabels"),
    "and never the product label that floors at an email address",
  );

  /* ═════════════════════════════════════════════════════════════════════════
   * 4. THE WRITER WRITES ONE TABLE, AND NEVER THE SESSION'S OWN ROW.
   *
   * This is the boundary that chose the table over a `memberships.department_id` column.
   * ═══════════════════════════════════════════════════════════════════════ */
  const writerCode = withoutComments(read(WRITER));
  const writeChain = /\.(insert|update|delete)\(\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*\)/g;
  const written = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = writeChain.exec(writerCode)) !== null) written.add(m[2]!);
  assert.deepEqual(
    [...written].sort(),
    ["departmentPlacements"],
    "the writer writes EXACTLY ONE table by name; the audit row is written by its own sink",
  );
  for (const forbidden of ["memberships)", "departments)", "users)", "roles)"]) {
    assert.ok(
      !writerCode.includes(`.update(${forbidden}`) && !writerCode.includes(`.insert(${forbidden}`),
      `the placement writer never writes ${forbidden}`,
    );
  }

  /*
   * THE STRUCTURAL WRITER IS UNTOUCHED, AND ITS RELEASED CLAIM STILL HOLDS. This capability was
   * shaped around that claim rather than around it.
   */
  const structureCode = withoutComments(read(STRUCTURE_WRITER));
  const structureWrites = new Set<string>();
  writeChain.lastIndex = 0;
  while ((m = writeChain.exec(structureCode)) !== null) structureWrites.add(m[2]!);
  assert.deepEqual(
    [...structureWrites].sort(),
    ["departments"],
    "`write-structure.server.ts` still writes `departments` alone — this capability did not widen it",
  );
  assert.ok(
    !structureCode.includes("departmentPlacements") && !structureCode.includes("write-placement"),
    "and it knows nothing about placements",
  );

  /* The reader is read-only too. */
  const readerCode = withoutComments(read(READER));
  for (const verb of ["insert", "update", "delete", "transaction"]) {
    assert.ok(!new RegExp(`\\.${verb}\\(`).test(readerCode), `the read seam contains no ${verb}`);
  }

  /* ═════════════════════════════════════════════════════════════════════════
   * 5. THE GATE AND THE SHARED ELIGIBILITY RULE, BOTH PRESENT AND BOTH IMPORTED.
   * ═══════════════════════════════════════════════════════════════════════ */
  assert.ok(
    writerCode.includes("resolveGovernanceAuthority"),
    "every placement act is gated on this organization's Governance authority",
  );
  assert.ok(
    writerCode.includes("eligibleTenantMemberWhere"),
    "and the eligible-member rule is IMPORTED, not re-typed — one definition, four consumers",
  );
  /* ORDER IS THE GUARANTEE: authorization before any subject is looked at. */
  const gateBody = writerCode.slice(writerCode.indexOf("async function gate("));
  assert.ok(
    gateBody.indexOf("resolveAuthority") < gateBody.indexOf("resolveDbOrNull"),
    "authorization is resolved BEFORE a database handle is even taken",
  );

  /* ═════════════════════════════════════════════════════════════════════════
   * 6. NO AUTHORITY EXPANSION OF ANY KIND.
   * ═══════════════════════════════════════════════════════════════════════ */
  /* GIA-1 admitted `record-work`. OSA-3 admitted neither member, which is what this pins. */
  assert.deepEqual(
    [...AGENT_ORIGINABLE_ACTION_KINDS],
    ["send", "record-work"],
    "no action kind was added by OSA-3",
  );
  assert.deepEqual(
    [...GOVERNANCE_SUBJECT_TYPES],
    ["knowledge_node"],
    "no Governance subject type was added",
  );
  assert.equal(DEPARTMENTAL_PLACEMENT_AUTHORITY_MODEL.writesGovernanceDecision, false);
  assert.equal(DEPARTMENTAL_PLACEMENT_AUTHORITY_MODEL.governanceDomainAdded, false);
  assert.ok(
    !writerCode.includes("decision_records") && !writerCode.includes("decisionRecords"),
    "no Governance decision row is written by any path here",
  );
  for (const forbidden of ["actionPermits", "actionExecutionAttempts", "agentMandates", "workItems"]) {
    assert.ok(!writerCode.includes(forbidden), `the writer never reaches ${forbidden}`);
  }

  /* THE STRUCTURAL MODEL WAS REPAIRED, NOT LEFT LYING. */
  assert.equal(
    ORGANIZATION_STRUCTURE_AUTHORITY_MODEL.humanAssignment,
    true,
    "OSA-1's `humanAssignment: false` was TRUE when written and is false now — it was repaired",
  );
  assert.equal(
    ORGANIZATION_STRUCTURE_AUTHORITY_MODEL.humanAssignmentWriter,
    "organization-authority/write-placement.server.ts",
    "and it names the module that owns it, so a reader is never left looking",
  );
  assert.equal(
    ORGANIZATION_STRUCTURE_AUTHORITY_MODEL.humanRoster,
    false,
    "a placement register is still not a member roster",
  );
  assert.deepEqual(
    [...ORGANIZATION_STRUCTURE_AUTHORITY_MODEL.writesTables],
    ["departments"],
    "and OSA-1 still writes exactly one table",
  );

  /* ═════════════════════════════════════════════════════════════════════════
   * 7. THE SCHEMA IS ADDITIVE, TENANT-SAFE, AND ACTIVATES NOTHING DORMANT.
   * ═══════════════════════════════════════════════════════════════════════ */
  const journal = JSON.parse(read(JOURNAL)) as { entries: readonly { tag: string }[] };
  assert.equal(journal.entries.length, 47, "the ledger grew by exactly one, and by exactly one more since"); /* WEV-1 grew the ledger 44 -> 45; PBGA-1 45 -> 46; CGO-1 46 -> 47 (content-draft + destination). */
  const sqlFiles = readdirSync(path.join(ROOT, "src/db/migrations")).filter((f) => f.endsWith(".sql"));
  assert.equal(sqlFiles.length, 47, "and the files agree");

  /*
   * PHASE-RELATIVE, NOT ABSOLUTE. This used to read "the newest migration is this one", which was
   * true the day it was written and is falsified by every later phase that authors one. What OSA-3
   * actually claims is that it authored EXACTLY ONE migration, and that claim never expires.
   */
  const own = journal.entries.filter((entry) => /osa3_departmental_placement$/.test(entry.tag));
  assert.equal(own.length, 1, "OSA-3 authored exactly one migration");
  const migrationTag = own[0]!.tag;
  const migration = read(`src/db/migrations/${migrationTag}.sql`);
  assert.match(migration, /CREATE TABLE "department_placements"/, "it creates the table");
  for (const forbidden of ["DROP ", "INSERT INTO", "DELETE FROM", "ALTER TABLE \"memberships\""]) {
    assert.ok(!migration.includes(forbidden), `the migration contains no ${forbidden.trim()}`);
  }
  assert.match(
    migration,
    /FOREIGN KEY \("tenant_id","department_id"\) REFERENCES "public"\."departments"\("tenant_id","id"\)/,
    "TENANT SAFETY IS STRUCTURAL — the composite foreign key, not a checked predicate",
  );
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "department_placements_tenant_user_active_uq"[\s\S]*?WHERE [\s\S]*?'active'/,
    "one ACTIVE placement per human, enforced by a partial unique index",
  );

  /* `organizations` stays dead; no legacy table was activated to carry this. */
  const schemaCode = withoutComments(read(SCHEMA));
  for (const dormant of ["organizations", "teams", "reportingLines", "positions"]) {
    assert.ok(!schemaCode.includes(dormant), `no dormant concept was activated: ${dormant}`);
  }

  /* ═════════════════════════════════════════════════════════════════════════
   * 8. THE AUDIT SINK IS APPEND-ONLY AND ITS SUBJECT IS THE PLACEMENT.
   * ═══════════════════════════════════════════════════════════════════════ */
  const auditCode = withoutComments(read(AUDIT));
  for (const forbidden of [".update(", ".delete("]) {
    assert.ok(!auditCode.includes(forbidden), `the audit sink is append-only: ${forbidden}`);
  }
  assert.ok(auditCode.includes("PLACEMENT_ENTITY_TYPE"), "the entity type is fixed, never from input");
  assert.ok(
    auditCode.includes('result: "committed"') && auditCode.includes("simulation: false"),
    "the result and the simulation flag are fixed by the writer, not supplied",
  );
  /* NO READABLE NAME IN AN AUDIT ROW. An export must not become a copy of the identity store. */
  for (const forbidden of ["label", "displayName", "email", "resolveHumanNames", "resolveHumanLabels"]) {
    assert.ok(!auditCode.includes(forbidden), `no human legibility enters an audit row: ${forbidden}`);
  }

  /* ═════════════════════════════════════════════════════════════════════════
   * 9. IT IS PRODUCT-REACHABLE. A BACKEND SEAM ALONE IS NOT A CAPABILITY.
   * ═══════════════════════════════════════════════════════════════════════ */
  const pageCode = withoutComments(read(PAGE));
  assert.ok(pageCode.includes("readPlacementRegister"), "the page performs the placement read");
  assert.ok(pageCode.includes("DepartmentalPlacementPanel"), "and renders the surface");

  const actionsCode = withoutComments(read(ACTIONS));
  assert.ok(actionsCode.includes('"use server"'), "the actions are server actions");
  for (const action of ["placeHumanInDepartmentAction", "withdrawPlacementAction"]) {
    assert.ok(actionsCode.includes(action), `the surface can reach ${action}`);
  }
  assert.ok(
    actionsCode.includes("resolveTenantContext()"),
    "and the tenant is resolved SERVER-SIDE — there is no parameter for a browser to name one",
  );

  /*
   * THE PANEL IS A CLIENT COMPONENT THAT CAN READ NOTHING. It imports the shapes and calls the
   * released actions; a component able to call the read would be a database handle in a bundle.
   */
  const panel = read(PANEL);
  const panelCode = withoutComments(panel);
  for (const forbidden of [
    "readPlacementRegister(",
    "placeHumanInDepartment(",
    "withdrawPlacement(",
    "getControlPlaneDb",
    "resolveHumanNames",
  ]) {
    assert.ok(!panelCode.includes(forbidden), `the surface performs no read or write: ${forbidden}`);
  }
  assert.match(
    panel,
    /import type \{[\s\S]*?PlacementRegister[\s\S]*?\} from "@\/features\/organization-authority\/read-placement\.server"/,
    "the panel imports the placement SHAPES and never the functions",
  );
  /* THE IDENTIFIER IS NEVER ERASED, and no name is invented. */
  assert.ok(panelCode.includes("placement.userId"), "the recorded identifier is rendered");
  assert.ok(panelCode.includes("LABEL_UNAVAILABLE"), "and an unresolved human is RENDERED as unresolved");

  /* ═════════════════════════════════════════════════════════════════════════
   * 10. NO OTHER FEATURE LEARNED ABOUT ANY OF THIS.
   * ═══════════════════════════════════════════════════════════════════════ */
  const groundingConsumers = [...walk("src/features"), ...walk("src/app"), ...walk("src/components")]
    .filter((f) => f !== GROUNDING)
    .filter((f) => withoutComments(read(f)).includes("heby-placement-source"));
  assert.deepEqual(
    groundingConsumers,
    [MODEL_ANSWER],
    "exactly one consumer imports the placement projection: the answer path, and nothing else",
  );

  /*
   * MEASURED AS VALUE IMPORTS, NOT AS TEXT.
   *
   * A text search answered THREE files and all three were honest: the server actions (a real value
   * import), the client panel (`import type` only — it erases at compile time), and
   * `structure-contracts.ts`, which merely NAMES this module in a string so a reader is not left
   * hunting for the writer. Only the first can call anything, so only the first is a consumer.
   *
   *     NAMING A MODULE != IMPORTING IT.    IMPORTING A TYPE != REACHING THE CODE.
   */
  const writerValueConsumers = [...walk("src/features"), ...walk("src/app"), ...walk("src/components")]
    .filter((f) => f !== WRITER)
    .filter((f) =>
      valueEdges(f).some((spec) => resolveSpecifier(f, spec) === WRITER),
    );
  assert.deepEqual(
    writerValueConsumers,
    [ACTIONS],
    "exactly one module can CALL the writer: the server actions the page invokes, and nothing else",
  );

  /* And the two text matches are proved harmless, by name, rather than excused. */
  assert.match(
    read(PANEL),
    /import type \{ PlacementWriteResult \} from "@\/features\/organization-authority\/write-placement\.server"/,
    "the panel imports the writer's RESULT TYPE and never the writer",
  );
  assert.ok(
    withoutComments(read(`${FEATURE}/structure-contracts.ts`)).includes(
      '"organization-authority/write-placement.server.ts"',
    ),
    "and the structural model NAMES the writer in a string, which imports nothing",
  );

  /*
   * ALSO MEASURED AS VALUE IMPORTS. A text search answered a third file — `placement-contracts.ts`,
   * whose `owns: ["human-department-placement"]` merely CONTAINS the module's filename as a
   * substring of a vocabulary term. That is the third time in this file that matching prose would
   * have measured the wrong thing, and each time the fix was the same: ask the import graph.
   */
  const schemaConsumers = walk("src/features")
    .filter((f) => valueEdges(f).some((spec) => resolveSpecifier(f, spec) === SCHEMA));
  assert.deepEqual(
    schemaConsumers.sort(),
    [READER, WRITER].sort(),
    "exactly two modules hold the placement table: its read seam and its writer",
  );

  assert.ok(HEBY_SOURCE_CLASSES.includes("placement"));
  assert.equal(HEBY_SOURCE_CLASSES.length, 20); /* OSA-4 added `people` as the 20th. */

  console.log("PASS osa3-departmental-placement/firewall");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
