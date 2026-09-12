/*
 * MEMBERSHIP LIFECYCLE — the boundaries, proved from source.
 *
 * The postgres suite proves what the authority DOES. This proves what nothing else may do: that
 * `memberships` has exactly one UPDATE writer in the whole repository, that the writer cannot be
 * aimed by email, and that it did not quietly become a session, user or role authority.
 *
 * The single-writer property is the one worth guarding by scan. A second `update(memberships)`
 * added anywhere — for a "suspend" button, a backfill script, an admin surface — would silently
 * create a second lifecycle with its own idea of what a revoked row looks like, and the eligibility
 * reader would honour whichever shape happened to be written.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
/** Source with comments stripped. A rule about CODE must not be broken by prose that denies it. */
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

function collect(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) return collect(p);
    return entry.isFile() && /\.tsx?$/.test(entry.name) ? [p.replace(/\\/g, "/")] : [];
  });
}

const AUTHORITY = "src/features/membership-lifecycle/revoke-membership.server.ts";
const AUDIT = "src/features/governance-audit/membership-lifecycle-audit.server.ts";
const AUTHORITY_CODE = codeOf(read(AUTHORITY));
const AUDIT_CODE = codeOf(read(AUDIT));

/* ── 1 · exactly one UPDATE writer of `memberships`, and it is this one ────── */

function membershipsHasASingleUpdateWriter(): void {
  const writers = collect("src")
    .filter((file) => /update\(\s*memberships\s*\)/.test(codeOf(read(file))))
    .sort();
  assert.deepEqual(
    writers,
    [AUTHORITY],
    `exactly one module may UPDATE memberships — found: ${writers.join(", ") || "none"}`,
  );

  /*
   * The two INSERT writers are unchanged and still the only ones. Named explicitly rather than
   * counted, so adding a third membership-creating path has to be a deliberate edit to this list.
   */
  const inserters = collect("src")
    .filter((file) => /insert\(\s*memberships\s*\)/.test(codeOf(read(file))))
    .sort();
  assert.deepEqual(
    inserters,
    [
      "src/features/human-onboarding/accept-invitation.server.ts",
      "src/features/tenant-provisioning/provision-tenant.server.ts",
    ],
    "membership creation still has exactly its two released paths",
  );

  /* And nothing deletes a membership anywhere. */
  const deleters = collect("src").filter((file) =>
    /delete\(\s*memberships\s*\)/.test(codeOf(read(file))),
  );
  assert.deepEqual(deleters, [], "no module deletes a membership row");
}

/* ── 2 · one transition, not a membership editor ───────────────────────────── */

function itWritesOneTransitionAndNoOther(): void {
  assert.match(
    AUTHORITY_CODE,
    /status: "revoked"/,
    "the transition it writes is `revoked`",
  );
  for (const forbidden of ["suspended", "expired", "pending"]) {
    assert.ok(
      !new RegExp(`status: "${forbidden}"`).test(AUTHORITY_CODE),
      `it cannot write \`${forbidden}\` — that is a different transition needing its own reasons`,
    );
  }
  /* It never reinstates: `active` is only ever COMPARED, never assigned to `status`. */
  assert.ok(
    !/status:\s*ACTIVE|status:\s*"active"/.test(AUTHORITY_CODE),
    "it cannot reactivate a membership",
  );
  /* It cannot move a membership between roles, humans or tenants. */
  for (const column of ["roleId:", "userId:", "tenantId:"]) {
    assert.ok(
      !new RegExp(`\\.set\\([^)]*${column}`, "s").test(AUTHORITY_CODE),
      `the update never assigns ${column} — this is not a membership editor`,
    );
  }
  /*
   * `lifecycle_status` is deliberately untouched: it is the soft-delete axis, and writing it would
   * be a SECOND signal for the same fact. The postgres suite asserts the row keeps `active`.
   */
  assert.ok(
    !/lifecycleStatus:/.test(AUTHORITY_CODE),
    "it does not write lifecycle_status — no second revocation signal",
  );
}

/* ── 3 · it is not a user, identity, role, tenant or session authority ─────── */

function itOwnsNothingElse(): void {
  for (const table of ["users", "authIdentities", "authCredentials", "roles", "companies", "userSessionContexts"]) {
    assert.ok(
      !new RegExp(`(insert|update|delete)\\(\\s*${table}\\s*\\)`).test(AUTHORITY_CODE),
      `it never writes ${table}`,
    );
  }
  /*
   * `roles` IS read — to answer whether the tenant would be left with no owner — and that read is
   * the only contact. Asserted positively so the boundary is legible rather than merely absent.
   */
  assert.match(AUTHORITY_CODE, /\.from\(roles\)|innerJoin\(roles/, "it reads roles for the owner count");

  /* No session writer, and no session revocation smuggled in as orchestration. */
  for (const session of ["revokeSession", "revokeSessionByReference", "revokeSessionIfActive"]) {
    assert.ok(
      !AUTHORITY_CODE.includes(session),
      `it does not call ${session} — session termination is a separate authority`,
    );
  }
}

/* ── 4 · no email may ever aim it ──────────────────────────────────────────── */

function itCannotBeAimedByEmail(): void {
  assert.ok(
    !/email/i.test(AUTHORITY_CODE),
    "the authority never mentions email — a membership is named by id, never by address",
  );
  assert.ok(
    !/email/i.test(AUDIT_CODE),
    "and no address reaches the audit append either",
  );
  /* The tenant is never a parameter; it comes from the resolved context. */
  assert.ok(
    !/tenantId:\s*string/.test(AUTHORITY_CODE.replace(/interface RevokeMembershipInput[\s\S]*?\}/, "")),
    "no caller-supplied tenant id is accepted",
  );
  assert.match(
    AUTHORITY_CODE,
    /eq\(memberships\.tenantId, tenant\.tenantId\)/,
    "every statement is predicated on the resolved tenant",
  );
}

/* ── 5 · authority, lockout and audit are structural, not optional ─────────── */

function theSafetyPropertiesArePresent(): void {
  assert.match(
    AUTHORITY_CODE,
    /resolveGovernanceAuthority\(tenant/,
    "Governance authority is resolved from the released resolver",
  );
  /* Authority is checked BEFORE the target row is read, so refusals leak nothing. */
  const authorityAt = AUTHORITY_CODE.indexOf("resolveGovernanceAuthority");
  const selectAt = AUTHORITY_CODE.indexOf(".from(memberships)");
  assert.ok(authorityAt > 0 && selectAt > 0, "both call sites were located");
  assert.ok(
    authorityAt < selectAt,
    "authority is resolved before the target is read — a refusal cannot become an existence oracle",
  );

  assert.match(AUTHORITY_CODE, /"would-strand-tenant"/, "the lockout refusal exists");
  assert.match(AUTHORITY_CODE, /\.for\("update"\)/, "the target row is locked against a concurrent revocation");
  assert.match(
    AUTHORITY_CODE,
    /recordMembershipRevokedWithin\(\s*tx/,
    "the audit joins the SAME transaction — an unaudited revocation is unrepresentable",
  );
  assert.match(
    AUTHORITY_CODE,
    /revokedByType: "human"/,
    "the actor pair is written, satisfying memberships_revocation_actor_chk",
  );
}

/* ── 6 · the owner role type cannot drift from the one provisioning writes ─── */

async function theOwnerRoleTypeMatchesProvisioning(): Promise<void> {
  /*
   * `membership-lifecycle` spells `"owner"` itself instead of importing it, to stay outside R4A's
   * tenant-provisioning census — see the contracts header. This is the compensating control: the
   * two constants are compared HERE, where referencing provisioning costs nothing, so the copy can
   * never silently diverge from the value a bootstrapped tenant actually gets.
   */
  const { OWNER_ROLE_TYPE } = await import("../../src/features/membership-lifecycle/contracts");
  const { BOOTSTRAP_ROLE_TYPE } = await import("../../src/features/tenant-provisioning/contracts");
  assert.equal(
    OWNER_ROLE_TYPE,
    BOOTSTRAP_ROLE_TYPE,
    "the owner role type must equal the one tenant provisioning writes at bootstrap",
  );
}

async function main(): Promise<void> {
  membershipsHasASingleUpdateWriter();
  itWritesOneTransitionAndNoOther();
  itOwnsNothingElse();
  itCannotBeAimedByEmail();
  theSafetyPropertiesArePresent();
  await theOwnerRoleTypeMatchesProvisioning();
  console.log("Membership lifecycle firewall checks passed");
}

void main();
