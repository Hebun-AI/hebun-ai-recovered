/*
 * PRINCIPAL-FW-1 — `TenantContext` MEANS AN AUTHORIZED **HUMAN** TENANT MEMBER, MECHANICALLY.
 *
 * ── WHAT THIS PHASE DID AND DID NOT DO ──────────────────────────────────────
 *
 * It changed a TYPE, not a behaviour. No credential, session, membership, role, permission,
 * runtime, execution, provider binding or machine ingress was created, and no schema moved. The
 * only thing that is now true which was not true before is that a value of type `TenantContext`
 * cannot be produced outside the human session runtime.
 *
 * ── WHY THAT MATTERS BEFORE ANY AGENT AUTHENTICATION EXISTS ─────────────────
 *
 * The census below counts the call sites that stamp `actor_type = 'human'` with an id taken from
 * this context. They are correct only because the type cannot carry a non-human. The seven
 * human-only CHECK constraints do NOT protect them — a CHECK validates the literal the writer
 * supplied, not the principal that supplied it — so if an agent principal ever became passable to
 * one of those writers, every constraint would still report green while the attribution was false.
 *
 * The brand makes that unrepresentable now, while it is still free.
 *
 * ── WHAT THE BRAND IS NOT ───────────────────────────────────────────────────
 *
 * COMPILE-TIME ONLY. It is not a runtime principal check and this file never claims it is. The
 * runtime human firewall is unchanged: `auth_identities`, `user_session_contexts` and `memberships`
 * all carry NOT NULL foreign keys to `users`, so an agent cannot obtain a session at all.
 *
 * Source is read with comments STRIPPED wherever a rule could otherwise be satisfied — or tripped —
 * by prose. This file and its subjects discuss the very things they forbid.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (f: string): string => readFileSync(path.join(ROOT, f), "utf8");
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const CONTRACT = "src/features/auth/tenant/tenant-context.ts";
const PRODUCER = "src/features/auth-runtime/session-service.server.ts";
const AUTH_BARREL = "src/features/auth/index.ts";
const SERVER_BARREL = "src/features/auth/server.ts";
const MIGRATIONS = "src/db/migrations";

/** Released authorities this phase must not have moved. */
const UNTOUCHED: readonly (readonly [string, string])[] = [
  ["src/features/agent-identity/create-durable-agent-identity.server.ts", "253fc03"],
  ["src/features/agent-identity/retire-durable-agent-identity.server.ts", "bcade6a"],
  ["src/db/schema/auth-credential.ts", "edc303c"],
  ["src/db/schema/auth-identity.ts", "edc303c"],
  ["src/db/schema/user-session-context.ts", "edc303c"],
  ["src/db/schema/user.ts", "edc303c"],
  ["src/db/schema/membership.ts", "edc303c"],
  ["src/features/auth-runtime/credential-repository.server.ts", "edc303c"],
  ["src/features/auth-runtime/identity-repository.server.ts", "edc303c"],
  ["src/features/auth-runtime/password-hash.server.ts", "edc303c"],
  ["src/features/auth-runtime/request-session.server.ts", "edc303c"],
  ["src/middleware.ts", "edc303c"],
];

const HUMAN_ONLY_CHECKS = [
  "action_permits_human_authorizer_chk",
  "decision_records_bootstrap_human_chk",
  "heby_action_requests_human_approver_chk",
  "identity_enrollment_requests_human_approver_chk",
  "knowledge_external_references_human_declarer_chk",
  "knowledge_external_references_human_withdrawer_chk",
  "membership_authorizations_human_authorizer_chk",
] as const;

function walk(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return walk(rel);
    return /\.tsx?$/.test(entry.name) ? [rel] : [];
  });
}

function main(): void {
  const contract = read(CONTRACT);
  const contractCode = codeOf(contract);
  const producerCode = codeOf(read(PRODUCER));
  const srcFiles = walk("src");

  /* ── 1. THE TYPE IS NOMINAL, AND THE MARKER IS UNREACHABLE ────────────────
   *
   * `declare const` with no `export` is the whole mechanism: a symbol another module cannot name is
   * a property another module cannot supply. If the marker were ever exported, the type would go
   * back to being forgeable by anyone willing to import it.
   */
  assert.ok(
    /declare const humanTenantContextBrand: unique symbol;/.test(contractCode),
    "the nominal marker is declared as a unique symbol",
  );
  assert.ok(
    !/export\s+(declare\s+)?const humanTenantContextBrand/.test(contractCode),
    "the nominal marker is NOT exported — an exported marker is a forgeable type",
  );
  assert.ok(
    /interface TenantContext extends TenantContextFields \{[\s\S]*?readonly \[humanTenantContextBrand\]: true;/.test(
      contractCode,
    ),
    "`TenantContext` carries the marker, so an object with the right fields is still not one",
  );
  /* The marker must not leak through any other module, barrel included. */
  const leaks = srcFiles.filter(
    (f) => f !== CONTRACT && codeOf(read(f)).includes("humanTenantContextBrand"),
  );
  assert.deepEqual(leaks, [], "no module outside the contract can even name the marker");

  /* ── 2. EXACTLY ONE MINT, AND EXACTLY ONE PRODUCTION CALLER ───────────────
   *
   * Two separate facts. The FIRST is that only one function applies the marker; the second is that
   * only one place in `src/` calls it. A second caller would be a second authority minting the same
   * authorization out of different evidence, which is precisely what "one owner" forbids.
   */
  const minters = srcFiles.filter((f) => /export function asHumanTenantContext\b/.test(read(f)));
  assert.deepEqual(minters, [CONTRACT], "exactly one module defines the mint");

  const callers = srcFiles.filter(
    (f) =>
      f !== CONTRACT &&
      f !== SERVER_BARREL &&
      /\basHumanTenantContext\s*\(/.test(codeOf(read(f))),
  );
  assert.deepEqual(
    callers,
    [PRODUCER],
    "exactly one production module mints an authority projection — the human session runtime",
  );

  /*
   * AND THE CAST CANNOT BECOME A GENERIC ESCAPE HATCH. `TenantContext` extends `TenantContextFields`,
   * so the mint NARROWS a value the compiler already checked field by field. There is no `unknown`
   * step, which is what stops it laundering an arbitrary object.
   */
  assert.ok(
    /return fields as TenantContext;/.test(contractCode),
    "the mint narrows an already-checked value",
  );
  assert.ok(
    !/as unknown as TenantContext/.test(contractCode),
    "the mint never launders through `unknown` — that would switch off field checking",
  );
  /*
   * OUTSIDE THE CONTRACT, THE ONLY TOLERATED CAST IS NULL-NARROWING.
   *
   * Several released authorities take `TenantContext | null`, refuse null in a guard, and then
   * write `tenant as TenantContext` to drop the null. That forges nothing — the value was already
   * branded by the session runtime; the cast only removes a union member the guard has excluded.
   *
   * What must never appear is a cast whose OPERAND is not already a `TenantContext`: an object
   * literal (`} as TenantContext`) would manufacture authority from a shape, and an `unknown` step
   * would launder anything at all. So the rule is on the operand, not on the keyword.
   */
  const forging: string[] = [];
  for (const f of srcFiles) {
    if (f === CONTRACT) continue;
    const code = codeOf(read(f));
    for (const m of code.matchAll(/(\S+)\s+as\s+TenantContext\b/g)) {
      const operand = m[1]!;
      if (operand === "}" || operand.endsWith("}") || operand === "unknown") forging.push(`${f}: ${m[0]}`);
    }
    if (/as\s+unknown\s+as\s+TenantContext/.test(code)) forging.push(`${f}: unknown-laundering`);
  }
  assert.deepEqual(
    forging,
    [],
    "no module manufactures a `TenantContext` from a literal or launders one through `unknown`",
  );

  /* ── 3. THE PRODUCER IS THE HUMAN SESSION RUNTIME, AND STILL EARNS IT ─────
   *
   * The mint is downstream of the guards, not a replacement for them. If the role requirement were
   * removed, an authenticated human with no authority would receive an authority projection.
   */
  assert.ok(
    /const tenantContextFields: TenantContextFields = \{/.test(producerCode),
    "the producer builds the fields under their own type, so every field stays checked",
  );
  assert.ok(
    /asHumanTenantContext\(tenantContextFields\)/.test(producerCode),
    "the producer mints from exactly those fields",
  );
  for (const guard of [
    'if (!membership.roleId) {',
    'roleId: row.membershipRoleId!,',
  ]) {
    assert.ok(
      producerCode.includes(guard),
      `the producer still requires an authorizing role (\`${guard}\`)`,
    );
  }
  assert.ok(
    /export async function selectTenantForSession\(/.test(producerCode),
    "`selectTenantForSession` remains the explicit transition into tenant-bound authorization",
  );
  assert.ok(
    /current\.activeTenantId !== null \|\|\s*\n?\s*current\.activeMembershipId !== null/.test(
      producerCode,
    ),
    "the transition refuses a session that is ALREADY tenant-bound — it is a transition, not a re-mint",
  );

  /* ── 4. THE PRE-TENANT PATH MINTS NOTHING ─────────────────────────────────
   *
   * Authenticated-but-not-authorized already exists for humans, and must keep producing no
   * authority projection at all. Scoped to the function body, because a module-wide search would
   * match the authorized path further down the same file and could never fail.
   */
  const preStart = producerCode.indexOf("async function issuePreTenantSession");
  assert.ok(preStart > 0, "the pre-tenant issuer was located");
  const preEnd = producerCode.indexOf("export async function resolveSessionFromReference", preStart);
  assert.ok(preEnd > preStart, "the pre-tenant issuer's end was located");
  const preTenant = producerCode.slice(preStart, preEnd);
  assert.ok(
    !preTenant.includes("asHumanTenantContext") && !preTenant.includes("TenantContextFields"),
    "the pre-tenant path mints no authority projection — authenticated is not authorized",
  );
  for (const nulled of ["activeTenantId: null", "activeMembershipId: null", "membershipVersion: null"]) {
    assert.ok(
      preTenant.includes(nulled),
      `the pre-tenant receipt carries no authorization (\`${nulled}\`)`,
    );
  }

  /* ── 5. NO `actorType` UNION, NO GENERIC PRINCIPAL ────────────────────────
   *
   * The whole point is that a future agent principal is a DIFFERENT type. Widening this one would
   * have turned every human-stamping writer into a latent false attribution instead.
   */
  assert.ok(
    !/actorType/.test(contractCode),
    "`TenantContext` gained no actorType — it is human by identity, not by a field a caller sets",
  );
  const principalAbstractions = srcFiles.filter((f) =>
    /\b(interface|type)\s+AuthenticatedPrincipal\b/.test(codeOf(read(f))),
  );
  assert.deepEqual(
    principalAbstractions,
    [],
    "no generic principal abstraction was introduced — that waits for a real machine ingress",
  );

  /* ── 6. THE AGENT SIDE GAINED NOTHING ─────────────────────────────────────── */
  const authSurface = [
    "src/features/auth",
    "src/features/auth-runtime",
  ].flatMap((d) => walk(d));
  for (const f of authSurface) {
    const code = codeOf(read(f));
    assert.ok(
      !/actorType\s*[:=]\s*"agent"/.test(code) && !/"agent"\s*===\s*actorType/.test(code),
      `${f} introduces no agent principal path into human authentication`,
    );
  }
  /*
   * `agents.tenant_id` REMAINS OWNERSHIP, NOT PERMISSION. Every reader uses it as a scoping
   * predicate beside a human's own tenant id; none treats it as a grant.
   *
   * EXTENDED BY SIA-2.6 AND AGAIN BY SIA-3, AND EXTENDED RATHER THAN RELAXED BOTH TIMES.
   *
   * The two TABLE DEFINITIONS below name `agents.tenantId` as half of a composite foreign key, so
   * that neither an origination invocation nor an improvement hypothesis can be attached to
   * another tenant's agent. That is not a reader treating tenancy as a grant — it is the same
   * ownership claim made structural, enforced by the database instead of by a predicate somebody
   * has to remember.
   *
   * SIA-3 adds a READER as well, and it is the permitted kind: its read model joins
   * `agents.tenantId` to the hypothesis row's own tenant so an agent NAME can only ever come from
   * an agent this tenant owns. A scoping predicate beside the human's tenant id — never a grant.
   *
   * AMA-1 adds two more, both permitted kinds. `db/schema/agent-mandate.ts` names
   * `agents.tenantId` as the second half of a composite foreign key — the same tenant-safety
   * mechanism SIA-2.6 and SIA-3 use, which makes bounding another tenant's agent a DATABASE error
   * rather than a predicate somebody can forget. `establish-agent-mandate.server.ts` uses it as a
   * scoping predicate when it resolves the subject agent. Neither is a grant, and neither reads a
   * configuration column: the AMA-1 firewall enumerates the `agents` columns that feature may
   * touch at all.
   *
   * The census stays EXACT, which is the whole value of it: a ninth file still fails here.
   */
  const agentTenantReaders = srcFiles.filter((f) => /agents\.tenantId/.test(codeOf(read(f))));
  assert.deepEqual(
    agentTenantReaders.sort(),
    [
      "src/features/agent-identity/create-durable-agent-identity.server.ts",
      "src/features/agent-identity/read-durable-agent-identity.server.ts",
      "src/features/agent-identity/retire-durable-agent-identity.server.ts",
      "src/db/schema/heby-origination-invocation.ts",
      "src/db/schema/agent-improvement-hypothesis.ts",
      "src/features/agent-improvement-hypothesis/read-improvement-hypotheses.server.ts",
      "src/db/schema/agent-mandate.ts",
      "src/features/agent-mandate/establish-agent-mandate.server.ts",
    ].sort(),
    "`agents.tenant_id` is a tenant SCOPE in five readers and a composite-key target in three table definitions — a grant in none of them",
  );

  /* ── 7. NO MACHINE INGRESS ────────────────────────────────────────────────
   *
   * Counted by name rather than number, so a new endpoint fails the suite whatever it is called.
   */
  const routes = walk("src/app").filter((f) => /\/route\.tsx?$/.test(f));
  assert.deepEqual(
    routes.sort(),
    [
      "src/app/api/integrations/github/setup/route.ts",
      "src/app/api/integrations/github/start/route.ts",
      "src/app/api/integrations/google/callback/route.ts",
      "src/app/api/integrations/google/start/route.ts",
    ],
    "no ingress was added — the four OAuth browser-redirect handlers are still the only routes",
  );

  /* ── 8. NO ESCAPE HATCHES IN THE FILES THIS PHASE OWNS ────────────────────── */
  for (const f of [CONTRACT, PRODUCER, AUTH_BARREL, SERVER_BARREL]) {
    const code = codeOf(read(f));
    for (const escape of ["@ts-ignore", "@ts-expect-error", ": any", "<any>", "as any"]) {
      assert.ok(!code.includes(escape), `${f} contains no \`${escape}\` — the compiler is not silenced`);
    }
  }

  /* ── 9. RELEASED AUTHORITIES ARE BYTE-IDENTICAL ───────────────────────────── */
  /*
   * `src/db/schema/agent.ts` MOVED OUT OF THAT LIST BY SIA-2.6 — and is pinned HARDER here, not
   * released from scrutiny.
   *
   * That phase added the composite-foreign-key anchor `agents_tenant_id_uq`, so byte-identity to
   * `edc303c` is no longer true. Deleting the entry would have been the weak repair: it would let
   * any future edit to the agents table pass unnoticed. Instead the released text is reconstructed
   * forward — apply exactly the KNOWN additions to `edc303c` and require the result to equal the
   * file on disk. Anything else that moved in that file, by a byte, fails here.
   *
   * OSA-1 added two more, and they are declared rather than absorbed: the `foreignKey` import, and
   * the replacement of `department_id`'s UNSAFE single-column reference with a documented plain
   * column whose composite FK lives in the index block. That FK is the repair OSA-0 identified as
   * the milestone's strongest architectural risk — a single-column FK to `departments` that would
   * have let an agent be pointed at another tenant's department the day departments existed.
   */
  {
    const released = execFileSync("git", ["show", "edc303c:apps/dashboard/src/db/schema/agent.ts"], {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    });
    const withImport = released.replace("  timestamp,\n  uuid,", "  timestamp,\n  uniqueIndex,\n  uuid,");
    assert.notEqual(withImport, released, "the uniqueIndex import is the first known addition");
    const withForeignKey = withImport.replace("import {\n  index,", "import {\n  foreignKey,\n  index,");
    assert.notEqual(withForeignKey, withImport, "the foreignKey import is the second (OSA-1)");
    const current = read("src/db/schema/agent.ts");
    /* OSA-1's column change, taken from the file and required to be exactly this shape. */
    const columnStart = current.indexOf("    /**\n     * WHICH DEPARTMENT THIS AGENT BELONGS TO.");
    const columnEnd = current.indexOf('    name: text("name").notNull(),');
    assert.ok(columnStart > 0 && columnEnd > columnStart, "the department column carries its OSA-1 note");
    const withColumn = withForeignKey.replace(
      '    departmentId: uuid("department_id").references(() => departments.id),\n',
      current.slice(columnStart, columnEnd),
    );
    assert.notEqual(withColumn, withForeignKey, "the single-column department FK is gone (OSA-1)");
    const anchorAt = current.indexOf('    uniqueIndex("agents_tenant_id_uq").on(t.tenantId, t.id),');
    assert.ok(anchorAt > 0, "the composite anchor is present");
    const reconstructed = withColumn.replace(
      '  (t) => [index("agents_execution_posture_idx").on(t.executionPosture)],',
      current.slice(
        current.indexOf('  (t) => [\n    index("agents_execution_posture_idx")'),
        current.indexOf("  ],", anchorAt) + "  ],".length,
      ),
    );
    assert.equal(
      current,
      reconstructed,
      "src/db/schema/agent.ts differs from edc303c by EXACTLY the composite anchor, the two " +
        "imports, and OSA-1's department column and its tenant-safe composite FK",
    );
    /*
     * And the added block introduces no COLUMN and no CHECK. Scoped to the table's constraint
     * block — an earlier version sliced the file by a prefix the new import line had already
     * displaced, so it scanned the whole file and accused the column definitions of being the
     * addition.
     *
     * `foreignKey(` LEFT THIS LIST AT OSA-1, and it is the one exception that had to be stated
     * rather than absorbed: the block now carries `agents_tenant_department_fk`, which REPLACED a
     * single-column FK that PostgreSQL could not use to enforce same-tenant. The ban is therefore
     * narrowed to "no SECOND foreign key", by count, so the block cannot quietly grow another one.
     */
    const block = current.slice(current.indexOf("  (t) => ["), current.indexOf("  ],", anchorAt));
    for (const forbidden of ["notNull", "default(", "check(", "jsonb(", "text("]) {
      assert.ok(
        !block.includes(forbidden),
        `the agents-table addition introduces no ${forbidden} — it is indexes and one FK repair`,
      );
    }
    assert.equal(
      block.split("foreignKey(").length - 1,
      1,
      "exactly ONE foreign key in the block — OSA-1's tenant-safe department binding, and no other",
    );
    assert.match(
      block,
      /agents_tenant_department_fk[\s\S]*foreignColumns: \[departments\.tenantId, departments\.id\]/,
      "and it binds the tenant and the department together, which is the whole repair",
    );
  }
  for (const [file, release] of UNTOUCHED) {
    const released = execFileSync("git", ["show", `${release}:apps/dashboard/${file}`], {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    });
    assert.equal(read(file), released, `${file} is byte-identical to ${release}`);
  }

  /* ── 10. SCHEMA, LEDGER AND HUMAN SUPREMACY UNTOUCHED ─────────────────────── */
  const sqlCount = readdirSync(path.join(ROOT, MIGRATIONS)).filter((f) => f.endsWith(".sql")).length;
  assert.equal(sqlCount, 47, "this phase authored no migration — a type needs none"); /* WEV-1 grew the ledger 44 -> 45; PBGA-1 45 -> 46; CGO-1 46 -> 47 (content-draft + destination). */
  const journal = JSON.parse(read(path.join(MIGRATIONS, "meta/_journal.json")));
  assert.equal(journal.entries.length, sqlCount, "and the journal agrees with the files on disk");
  const allMigrations = readdirSync(path.join(ROOT, MIGRATIONS))
    .filter((f) => f.endsWith(".sql"))
    .map((f) => read(path.join(MIGRATIONS, f)))
    .join("\n");
  for (const check of HUMAN_ONLY_CHECKS) {
    assert.ok(allMigrations.includes(check), `\`${check}\` still exists`);
  }
  assert.ok(
    /GOVERNANCE_SUBJECT_TYPES: readonly GovernanceSubjectType\[\] = \["knowledge_node"\];/.test(
      codeOf(read("src/features/governance-decision/contracts.ts")),
    ),
    'governance subject types are still exactly ["knowledge_node"]',
  );

  /* ── 11. THE CENSUS THIS FIREWALL PROTECTS ────────────────────────────────
   *
   * Measured, not inherited. The number is reported rather than pinned to a constant, because it
   * legitimately grows; what must stay true is that every one of them takes the branded type.
   */
  const stampers = walk("src/features").filter((f) =>
    /ByActorType: "human"|ByType: "human"|actorType: "human"/.test(codeOf(read(f))),
  );
  const stampSites = stampers.reduce(
    (total, f) =>
      total + (codeOf(read(f)).match(/ByActorType: "human"|ByType: "human"|actorType: "human"/g) ?? []).length,
    0,
  );
  assert.ok(stampSites > 0 && stampers.length > 0, "the human-stamping census is non-empty");
  /*
   * SCOPED TO PARAMETER POSITION. A first pass matched `tenant:` anywhere and flagged an inert
   * descriptor module that merely declares a FIELD called `tenant` on an interface — it accepts no
   * principal and writes nothing. A rule about what a function is handed has to read parameter
   * lists, not every colon in the file.
   */
  /*
   * THE INVARIANT IS ABOUT ATTRIBUTION, NOT ABOUT SCOPING.
   *
   * Six audit writers take `{ readonly tenantId: string } | null` or `Pick<TenantContext,
   * "tenantId">`: they need a tenant to file a row under and deliberately receive LESS than a
   * principal. That is least privilege and must stay legal. The writers this firewall exists for are
   * the ones that name a HUMAN — they read `tenant.userId` and stamp it beside `actor_type='human'`,
   * and those must receive the branded type or the attribution is unverified.
   */
  const attributing = stampers.filter((f) => /tenant\.userId/.test(codeOf(read(f))));
  assert.ok(attributing.length > 0, "the human-attributing census is non-empty");
  const looseStampers = attributing.filter((f) => {
    const code = codeOf(read(f));
    /*
     * The whole type text, not its first identifier. One audit writer takes
     * `Pick<TenantContext, "tenantId">` — deliberately LESS than a principal, which is least
     * privilege rather than a looser principal, and a first-identifier match called it `Pick`.
     * What matters is that the parameter derives from `TenantContext` at all.
     */
    const params = [...code.matchAll(/\(\s*\n\s+tenant:\s*([^,\n]+)/g)].map((m) => m[1]!);
    return params.length > 0 && params.some((t) => !t.includes("TenantContext"));
  });
  assert.deepEqual(
    looseStampers,
    [],
    "every writer that attributes a human from the context receives the branded `TenantContext`",
  );

  console.log(
    `principal-firewall/human-tenant-context: TenantContext is nominal, 1 mint, 1 production ` +
      `caller, pre-tenant mints nothing, ${stampSites} human-stamping sites across ` +
      `${stampers.length} modules protected without edit`,
  );
}

main();
