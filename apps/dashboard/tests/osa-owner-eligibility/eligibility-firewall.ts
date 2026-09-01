/*
 * OSA OWNER ELIGIBILITY HARDENING — NO AUTHORITY MOVED.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "Hardening the owner check changed what the Organization Structure Authority ACCEPTS and nothing
 *    about what it OWNS. The eligibility rule is a pure predicate, not an authority: no handle, no
 *    query, no writer, and not even a `.server` module. Identity still owns `users`, Membership
 *    Authority still owns `memberships`, and OSA still writes one table. No roster appeared, no
 *    assignment appeared, no schema and no migration were added, Heby was not touched, and the
 *    dormant agent-department writer in the passive persistence adapter is exactly as unreachable
 *    as it was."
 *
 * The pins:
 *
 *   A PREDICATE != AN AUTHORITY        ELIGIBLE != AUTHORIZED
 *   VERIFYING A FACT != OWNING IT      HARDENED != WIDENED
 *
 * Structural assertions run over COMMENT-STRIPPED source. Pure: no database, no network, no model.
 */
import "../../src/db/schema";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import {
  ACTIVE_LIFECYCLE,
  ACTIVE_MEMBERSHIP_STATUS,
} from "../../src/features/auth-runtime/member-eligibility";
import { ACTIVE_LIFECYCLE_STATUS } from "../../src/features/organization-authority/read-structure.server";
import { ORGANIZATION_STRUCTURE_AUTHORITY_MODEL } from "../../src/features/organization-authority/structure-contracts";
import { HEBY_SOURCE_CLASSES } from "../../src/features/heby-integration/contracts";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
const withoutComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const ELIGIBILITY = "src/features/auth-runtime/member-eligibility.ts";
const WRITER = "src/features/organization-authority/write-structure.server.ts";
/* WORK-1 — the second authority that names an accountable human, and the read beside it. */
const WORK_WRITER = "src/features/organizational-work/write-work.server.ts";
const WORK_READER = "src/features/organizational-work/read-work.server.ts";
const READER = "src/features/organization-authority/read-structure.server.ts";
const PICKER = "src/features/auth-runtime/human-label-read.server.ts";
const IDENTITY_REPO = "src/features/auth-runtime/identity-repository.server.ts";
const PASSIVE_ADAPTER = "src/features/persistence/supabase-postgres-adapter.ts";

function walk(dir: string): string[] {
  const abs = path.join(ROOT, dir);
  if (!existsSync(abs)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(abs)) {
    const rel = path.join(dir, entry);
    if (statSync(path.join(ROOT, rel)).isDirectory()) out.push(...walk(rel));
    else if (/\.tsx?$/.test(rel)) out.push(rel);
  }
  return out;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. THE RULE IS A PREDICATE. IT CANNOT BECOME AN AUTHORITY.
 * ═══════════════════════════════════════════════════════════════════════════ */
{
  const code = withoutComments(read(ELIGIBILITY));
  for (const forbidden of [
    ".insert(",
    ".update(",
    ".delete(",
    ".transaction(",
    ".select(",
    "getControlPlaneDb",
    "ControlPlaneDatabase",
    "TenantContext",
    "resolveGovernanceAuthority",
  ]) {
    assert.ok(!code.includes(forbidden), `the eligibility rule holds no ${forbidden}`);
  }
  assert.ok(!ELIGIBILITY.endsWith(".server.ts"), "and it is pure, so it is not a .server module");

  /*
   * WHY THAT LAST ONE MATTERS. OSA's released firewall pins the WRITER's reachable `.server.ts`
   * modules to an exact list. A rule shipped as a server module would have forced that list open;
   * a pure one does not appear in it at all, and that assertion still passes untouched.
   */
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. THE SEMANTICS ARE BORROWED, NOT INVENTED.
 * ═══════════════════════════════════════════════════════════════════════════ */
{
  /*
   * THE DUPLICATION PIN THE MODULE'S OWN COMMENT PROMISES. `member-eligibility` states the active
   * lifecycle value as a literal because it must not depend on a feature above it; OSA states the
   * same value for its own reasons. Two constants with one meaning drift unless something reads
   * both, so this does.
   */
  assert.equal(
    ACTIVE_LIFECYCLE,
    ACTIVE_LIFECYCLE_STATUS,
    "the shared rule and OSA agree on what 'in service' means",
  );
  assert.equal(ACTIVE_MEMBERSHIP_STATUS, "active");

  /*
   * THE MEMBERSHIP HALF IS THE SESSION PREDICATE. `identity-repository.server.ts` decides whether a
   * human may hold a session in a tenant, and this milestone deliberately reused that rule rather
   * than authoring one. Asserted against the file that owns it, so a change there is visible here.
   */
  const identity = withoutComments(read(IDENTITY_REPO));
  for (const condition of [
    'eq(memberships.status, "active")',
    'eq(memberships.lifecycleStatus, "active")',
    "isNull(memberships.revokedAt)",
  ]) {
    assert.ok(
      identity.includes(condition),
      `the session path still applies ${condition} — the rule this milestone borrowed`,
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. ONE DEFINITION, AND THE THREE CONSUMERS THAT SHARE IT.
 * ═══════════════════════════════════════════════════════════════════════════ */
{
  const consumers = [...walk("src/features"), ...walk("src/app"), ...walk("src/components")]
    .filter((file) => file !== ELIGIBILITY)
    .filter((file) => read(file).includes("member-eligibility"));

  /*
   * FIVE CONSUMERS, AND THE COUNT GREW FOR THE RIGHT REASON.
   *
   * WORK-1 established a second authority that names an accountable human, so it MUST consult this
   * rule rather than re-type it — that is the entire point of the rule existing. Its writer takes
   * the full predicate, and its read takes the membership half for the same derived-flag reason the
   * structure read does.
   *
   * The assertion is widened, never weakened: it is still an EXACT list, so a sixth consumer
   * appearing without a deliberate edit still fails here. What must never happen is a module
   * enforcing eligibility with its own copy of the conditions, and §2 above is what catches that.
   */
  assert.deepEqual(
    consumers.sort(),
    [PICKER, READER, WRITER, WORK_READER, WORK_WRITER].sort(),
    "the eligibility rule has exactly five consumers: the two writers that enforce it, the picker " +
      "that offers by it, and the two reads that derive their accountability flag from its " +
      "membership half",
  );

  /* The writer takes the WHOLE rule. The reader takes the membership half and says so. */
  assert.match(
    withoutComments(read(WRITER)),
    /eligibleTenantMemberWhere\(tenantId, userId\)/,
    "the writer enforces the full rule for one named human",
  );
  assert.match(
    withoutComments(read(READER)),
    /activeMembershipOnlyConditions\(tenant\.tenantId\)/,
    "the reader takes the membership half, because it may not name `users`",
  );
  assert.ok(
    !/\busers\b/.test(withoutComments(read(READER))),
    "and it still names `users` nowhere, so no name or email can travel with a department",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. NOTHING WAS ADDED THAT THIS MILESTONE WAS FORBIDDEN TO ADD.
 * ═══════════════════════════════════════════════════════════════════════════ */
{
  assert.equal(ORGANIZATION_STRUCTURE_AUTHORITY_MODEL.humanRoster, false, "still no roster");
  assert.equal(ORGANIZATION_STRUCTURE_AUTHORITY_MODEL.humanAssignment, false, "still no assignment");
  assert.equal(ORGANIZATION_STRUCTURE_AUTHORITY_MODEL.agentAssignmentWriter, false);

  const migrations = readdirSync(path.join(ROOT, "src/db/migrations")).filter((f) =>
    f.endsWith(".sql"),
  );
  /* WORK-1 grew the ledger 41 -> 42: the Organizational Work Authority table. */
  assert.equal(migrations.length, 42, "no migration was added by the hardening — the ledger grew only for WORK-1");

  assert.equal(HEBY_SOURCE_CLASSES.length, 17, "Heby's source-class census is unchanged");
  const eligibilityConsumersUnderHeby = walk("src/features")
    .filter((f) => f.includes("heby"))
    .filter((f) => read(f).includes("member-eligibility"));
  assert.deepEqual(eligibilityConsumersUnderHeby, [], "and no Heby module reaches the rule");

  /* No Governance vocabulary entered any of the three changed files. */
  for (const file of [ELIGIBILITY, READER, PICKER]) {
    const code = withoutComments(read(file));
    for (const forbidden of ["decisionRecords", "governanceSessions", "actionPermits"]) {
      assert.ok(!code.includes(forbidden), `${file} names no Governance table: ${forbidden}`);
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. THE DORMANT ASSIGNMENT PATH DID NOT WAKE UP.
 *
 * The brief is explicit: if this change made `supabase-postgres-adapter.ts`'s agent-department
 * writer reachable, that is a STOP rather than a scope widening. It did not — measured, not assumed.
 * ═══════════════════════════════════════════════════════════════════════════ */
{
  const adapter = withoutComments(read(PASSIVE_ADAPTER));
  assert.match(adapter, /set department_id/, "the dormant writer is still there, unchanged");

  const adapterConsumers = [...walk("src/features"), ...walk("src/app"), ...walk("src/components")]
    .filter((file) => file !== PASSIVE_ADAPTER)
    .filter((file) => withoutComments(read(file)).includes("supabase-postgres-adapter"));
  assert.deepEqual(
    adapterConsumers.sort(),
    [
      "src/features/persistence/provider-registry.ts",
      "src/features/tenant-registry/durable-registry-repository.server.ts",
    ].sort(),
    "its consumers are unchanged — this milestone added no caller and no reachability",
  );

  /* And nothing this milestone touched imports it. */
  for (const file of [ELIGIBILITY, WRITER, READER, PICKER]) {
    assert.ok(
      !read(file).includes("supabase-postgres-adapter"),
      `${file} does not reach the passive adapter`,
    );
  }
}

console.log("OSA owner eligibility (firewall): all assertions passed.");
