/*
 * SELF-SERVICE SIGNUP — the boundaries, proved from source.
 *
 * A behaviour suite proves what signup DOES. This proves what it is incapable of doing, by proving
 * the fields, imports and identifiers required to do it are absent.
 *
 * The single most important property here is the one Director Decision 3 turns on: a human who
 * signs up receives authority inside the tenant they just created and NOWHERE ELSE. That is not
 * asserted as a sentence — it is asserted by measuring every authority in the repository that
 * consults a role band, and by measuring that the deployment-global provider control has no writer.
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

const CONTRACTS = "src/features/self-service-signup/contracts.ts";
const SIGNUP = "src/features/self-service-signup/create-account.server.ts";
const ACTION = "src/app/register/actions.ts";
const PAGE = "src/app/register/page.tsx";
const AUTHORITY = "src/features/tenant-provisioning/provision-tenant.server.ts";

const CONTRACTS_CODE = codeOf(read(CONTRACTS));
const SIGNUP_CODE = codeOf(read(SIGNUP));
const ACTION_CODE = codeOf(read(ACTION));

/* ── A · the browser cannot supply trusted identity ────────────────────────── */

function theInputTypeHasNoTrustedField(): void {
  const block = CONTRACTS_CODE.slice(
    CONTRACTS_CODE.indexOf("interface SignupInput"),
    CONTRACTS_CODE.indexOf("}", CONTRACTS_CODE.indexOf("interface SignupInput")),
  );
  assert.deepEqual(
    [...block.matchAll(/readonly (\w+):/g)].map((m) => m[1]!).sort(),
    ["email", "fullName", "organizationName", "password"],
    "four fields, all of them things only the human knows — and no fifth",
  );
  /*
   * NOT "IGNORED IF PRESENT" — ABSENT FROM THE TYPE. There is no field for a forged value to arrive
   * in, which is what makes this a shape rather than a validation rule somebody must remember.
   */
  for (const forged of [
    "tenantId",
    "companyId",
    "membershipId",
    "roleId",
    "role",
    "provisioningSource",
    "slug",
    "userId",
  ]) {
    assert.ok(!block.includes(forged), `SignupInput must not carry ${forged}`);
  }
}

function theActionReadsOnlyTheFourFields(): void {
  const fields = [...ACTION_CODE.matchAll(/formData\.get\("([^"]+)"\)/g)].map((m) => m[1]!).sort();
  assert.deepEqual(
    fields,
    ["email", "fullName", "organizationName", "password"],
    "the action reads four form fields and no others",
  );
}

function theProvenanceIsAServerLiteral(): void {
  assert.ok(
    SIGNUP_CODE.includes("TENANT_PROVISIONING_SOURCE_SELF_SERVICE"),
    "the provenance is a named constant supplied by the server",
  );
  assert.ok(
    SIGNUP_CODE.includes("provisioningSource:"),
    "the provenance is written on the bootstrap input",
  );
  assert.ok(
    !/input\.(provisioningSource|tenantId|roleId|membershipId|slug|userId)/.test(SIGNUP_CODE),
    "no authoritative value is ever read from the caller's input",
  );
  /* And the literal it writes is the self-service one, never an operator root. */
  assert.ok(
    !/local-operator-ceremony|production-operator-ceremony/.test(SIGNUP_CODE),
    "signup may never claim an operator ceremony root",
  );
}

/* ── B · signup writes nothing itself ──────────────────────────────────────── */

function signupOwnsNoTable(): void {
  /*
   * It is an ORCHESTRATOR. Every row it causes is written by the authority that owns it, so it must
   * import no schema and issue no mutation of its own — except the human's own name, which it sets
   * on the row Identity just created because `insertLocalIdentity` takes only an email.
   */
  const schemaImports = [...SIGNUP_CODE.matchAll(/from "@\/db\/schema\/([a-z-]+)"/g)].map(
    (m) => m[1]!,
  );
  assert.deepEqual(schemaImports, ["user"], "signup names exactly one table, to set the human's name");
  assert.ok(!/\.insert\(/.test(SIGNUP_CODE), "signup inserts nothing itself");
  assert.ok(!/\.delete\(/.test(SIGNUP_CODE), "signup deletes nothing");
  const updates = [...SIGNUP_CODE.matchAll(/\.update\((\w+)\)/g)].map((m) => m[1]!);
  assert.deepEqual(updates, ["users"], "the only update is the human's own name");
  /* And it is predicated so it cannot reach another human's row. */
  assert.match(
    SIGNUP_CODE,
    /eq\(users\.id, identity\.userId\)/,
    "the name update names the row just created",
  );
  assert.match(SIGNUP_CODE, /isNull\(users\.name\)/, "…and only while that name is unset");
}

function signupDelegatesToTheReleasedAuthorities(): void {
  for (const authority of [
    "insertLocalIdentity",
    "establishFirstPasswordCredential",
    "provisionTenant",
  ]) {
    assert.ok(SIGNUP_CODE.includes(authority), `signup calls ${authority} rather than reimplementing it`);
  }
  /* No second hasher, no second session model, no second tenant writer. */
  for (const forbidden of ["scrypt", "pbkdf2", "createHash", "bcrypt", "hashPassword"]) {
    assert.ok(!SIGNUP_CODE.includes(forbidden), `signup must not hash anything itself — found ${forbidden}`);
  }
}

/* ── C · one transaction ───────────────────────────────────────────────────── */

function everyWriteIsInOneTransaction(): void {
  const transactions = [...SIGNUP_CODE.matchAll(/\.transaction\(/g)].length;
  assert.equal(transactions, 1, "exactly one transaction, so partial provisioning is unrepresentable");
  const tx = SIGNUP_CODE.slice(SIGNUP_CODE.indexOf(".transaction("));
  for (const call of [
    "insertLocalIdentity",
    "establishFirstPasswordCredential",
    "provisionTenant",
  ]) {
    assert.ok(tx.includes(call), `${call} happens INSIDE the transaction`);
  }
  /*
   * A REFUSAL FROM THE TENANT AUTHORITY MUST ABORT. It returns rather than throws, so signup has to
   * turn that into a throw — otherwise the identity and credential above would commit into a world
   * with no organization.
   */
  assert.match(tx, /throw new SignupAbort/, "a tenant refusal aborts the transaction");
}

/* ── D · no authority beyond the new tenant ────────────────────────────────── */

function signupCreatesNoProviderGovernanceOrExecutionState(): void {
  for (const forbidden of [
    "integration",
    "credential_",
    "providerConnectivityControls",
    "governance",
    "decision_records",
    "genesis",
    "action_permits",
    "knowledge",
    "heby",
    "mandate",
    "invitation",
    "observation",
  ]) {
    assert.ok(
      !SIGNUP_CODE.toLowerCase().includes(forbidden.toLowerCase()),
      `signup must not reach ${forbidden}`,
    );
  }
}

/**
 * THE DECISION-3 MEASUREMENT: what does an `owner` actually reach?
 *
 * Not asserted from prose. Every authority in the repository that consults a role band is found by
 * searching for the band sets themselves, and each one is checked to be TENANT-PREDICATED.
 */
function ownerAuthorityIsBoundedByItsOwnTenant(): void {
  const srcFiles = collect("src");

  /* 1. The only role-band authority that exists is Knowledge authoring, and it is tenant-scoped. */
  const bandConsumers = srcFiles.filter((f) =>
    /KNOWLEDGE_AUTHOR_ROLE_TYPES|PROVIDER_CONTROL_ROLE_TYPES/.test(codeOf(read(f))),
  );
  assert.deepEqual(
    bandConsumers.sort(),
    ["src/features/knowledge/knowledge-write-authority.server.ts"],
    "exactly one connected authority consults a role band",
  );
  const knowledge = codeOf(read("src/features/knowledge/knowledge-write-authority.server.ts"));
  assert.match(
    knowledge,
    /eq\(roles\.tenantId, tenantId\)/,
    "role resolution is predicated on the caller's own tenant",
  );

  /*
   * 2. R5-1's invariant, re-measured rather than trusted: the deployment-global provider control has
   *    NO writer under src. This is the one escalation R4A's header warned an owner might reach, and
   *    it is the reason Director Decision 3's STOP condition is not triggered.
   */
  const controlWriters = srcFiles.filter((f) => {
    const code = codeOf(read(f));
    return /\.(insert|update|delete)\(providerConnectivityControls\)/.test(code);
  });
  assert.deepEqual(controlWriters, [], "no module under src may write provider_connectivity_controls");
  assert.ok(
    !collect("src").some((f) => codeOf(read(f)).includes("PROVIDER_CONTROL_ROLE_TYPES")),
    "PROVIDER_CONTROL_ROLE_TYPES does not exist — there is no owner-gated global control",
  );

  /* 3. `owner` is never granted through the invitation path, so it can only come from tenant birth. */
  const onboarding = codeOf(read("src/features/human-onboarding/contracts.ts"));
  assert.match(
    onboarding,
    /ONBOARDING_MEMBERSHIP_ROLE_TYPE = "member"/,
    "invitation onboarding produces `member` only",
  );
}

/* ── E · the password ──────────────────────────────────────────────────────── */

function thePlaintextPasswordIsNeverPersistedOrLogged(): void {
  for (const [label, code] of [
    ["signup", SIGNUP_CODE],
    ["action", ACTION_CODE],
  ] as const) {
    assert.ok(!/console\.(log|info|warn|error|debug)/.test(code), `${label}: logs nothing`);
  }
  /* The password never reaches a redirect, so it can never land in a URL, a referrer or a log. */
  const redirects = [...ACTION_CODE.matchAll(/redirect\(([^)]*)\)/g)].map((m) => m[1]!);
  for (const target of redirects) {
    assert.ok(!/password|email|fullName|organizationName/.test(target), `no input in a redirect: ${target}`);
  }
  /* And the refusal reason is a CODE, never an echoed sentence. */
  assert.match(ACTION_CODE, /error=\$\{encodeURIComponent\(outcome\.reason/, "the reason travels as a code");
}

/* ── F · the session is the released one ───────────────────────────────────── */

function theSessionIsMintedByProvingTheCredential(): void {
  assert.match(
    ACTION_CODE,
    /issueLocalSession\(/,
    "the session comes from the released session authority, by verifying the password",
  );
  /*
   * NO SECOND SESSION MODEL. The action must not mint, sign or fabricate session material; it hands
   * the reference the session service returned to the released cookie seam.
   */
  for (const forbidden of ["jwt", "sign(", "createSession", "new Session", "setCookie("]) {
    assert.ok(!ACTION_CODE.includes(forbidden), `the action must not mint session material — ${forbidden}`);
  }
  assert.match(ACTION_CODE, /setSessionCookie\(issued\.reference/, "it sets the released cookie");
  /* It cannot name a tenant: there is no tenant id anywhere in the action. */
  assert.ok(!/tenantId/.test(ACTION_CODE), "the action never names a tenant — the session resolves it");
}

/* ── G · the page provisions nothing ───────────────────────────────────────── */

function thePageIsAFormAndNothingElse(): void {
  const page = codeOf(read(PAGE));
  assert.ok(!/createSelfServiceAccount|provisionTenant/.test(page), "the page provisions nothing");
  assert.ok(!/"use client"/.test(page), "the page is a server component");
  assert.match(page, /action=\{registerAction\}/, "the form posts to the server action");
}

/* ── H · the authority is not a second one ─────────────────────────────────── */

function thereIsExactlyOneTenantWriter(): void {
  const writers = collect("src").filter((f) => {
    const code = codeOf(read(f));
    return /\.insert\(companies\)/.test(code);
  });
  assert.deepEqual(writers, [AUTHORITY], "exactly one module inserts companies");

  const membershipWriters = collect("src").filter((f) =>
    /\.insert\(memberships\)/.test(codeOf(read(f))),
  );
  /*
   * TWO, AND BOTH ARE DECLARED. Tenant birth writes the bootstrap membership; `accept-invitation`
   * writes every later one. A third would be a membership authority nobody approved.
   */
  assert.deepEqual(
    membershipWriters.sort(),
    ["src/features/human-onboarding/accept-invitation.server.ts", AUTHORITY].sort(),
    "memberships have exactly two writers: tenant birth, and invitation acceptance",
  );
}

function main(): void {
  theInputTypeHasNoTrustedField();
  theActionReadsOnlyTheFourFields();
  theProvenanceIsAServerLiteral();
  signupOwnsNoTable();
  signupDelegatesToTheReleasedAuthorities();
  everyWriteIsInOneTransaction();
  signupCreatesNoProviderGovernanceOrExecutionState();
  ownerAuthorityIsBoundedByItsOwnTenant();
  thePlaintextPasswordIsNeverPersistedOrLogged();
  theSessionIsMintedByProvingTheCredential();
  thePageIsAFormAndNothingElse();
  thereIsExactlyOneTenantWriter();
  console.log("self-service signup firewall checks passed");
}

main();
