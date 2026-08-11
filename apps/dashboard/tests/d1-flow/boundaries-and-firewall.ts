/*
 * D1 — structural boundaries around the credential authority.
 *
 * These are the properties a runtime test cannot prove, because they are claims
 * about what does NOT exist: no second sign-in path, no dev bypass, no route by
 * which secret material reaches a browser, and no way for Heby, voice, or a
 * slash command to authenticate anybody.
 *
 * Runtime behaviour is proved in `authentication-postgres.ts`. This file proves
 * the shape that keeps that behaviour the ONLY behaviour.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

function collect(dir: string, ext = /\.tsx?$/): string[] {
  const abs = path.join(ROOT, dir);
  return readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) return collect(rel, ext);
    return e.isFile() && ext.test(e.name) ? [rel] : [];
  });
}

const CREDENTIAL_REPOSITORY = "src/features/auth-runtime/credential-repository.server.ts";
const PASSWORD_HASH = "src/features/auth-runtime/password-hash.server.ts";
const SESSION_SERVICE = "src/features/auth-runtime/session-service.server.ts";
const LOGIN_ACTION = "src/app/login/actions.ts";
const LOGIN_PAGE = "src/app/login/page.tsx";
const CREDENTIAL_SCHEMA = "src/db/schema/auth-credential.ts";

function main(): void {
  /* ── T: secret material is confined to the credential authority ───────────── */
  {
    // Only these files may name the stored secret columns at all. If a fourth
    // file appears here, credential material has started travelling.
    const allowed = new Set([CREDENTIAL_SCHEMA, CREDENTIAL_REPOSITORY, PASSWORD_HASH]);
    const offenders = [...collect("src")].filter((file) => {
      if (allowed.has(file)) return false;
      const src = readFileSync(path.join(ROOT, file), "utf8");
      return /secretHash|secret_hash/.test(src);
    });
    assert.deepEqual(
      offenders,
      [],
      "only the schema, the repository and the hasher may mention the stored secret",
    );
  }

  /* ── T: no client component can reach the credential modules ──────────────── */
  {
    const clientFiles = [...collect("src/components"), ...collect("src/app")].filter(
      (file) => /^\s*["']use client["']/m.test(readFileSync(path.join(ROOT, file), "utf8")),
    );
    assert.ok(clientFiles.length > 0, "there really are client components to check");
    for (const file of clientFiles) {
      const src = readFileSync(path.join(ROOT, file), "utf8");
      assert.doesNotMatch(
        src,
        /credential-repository|password-hash|auth-credential/,
        `${file}: a client component must not import the credential authority`,
      );
      assert.doesNotMatch(
        src,
        /secretHash|secret_hash|scrypt/,
        `${file}: no credential material or hashing in a client bundle`,
      );
    }
  }

  /* ── The credential repository is the only reader of the secret columns ───── */
  {
    const repo = read(CREDENTIAL_REPOSITORY);
    assert.match(repo, /salt: authCredentials\.salt/, "the repository does select them");
    // …and it is server-only by naming convention, like every other durable seam.
    assert.ok(
      CREDENTIAL_REPOSITORY.endsWith(".server.ts"),
      "the credential repository is server-only",
    );
    assert.ok(PASSWORD_HASH.endsWith(".server.ts"), "the hasher is server-only");
    assert.match(
      read(PASSWORD_HASH),
      /Password hashing is server-only/,
      "the hasher refuses to run in a browser",
    );
  }

  /* ── U: nothing in the auth path logs, and the password is never re-emitted ─ */
  {
    for (const file of [SESSION_SERVICE, LOGIN_ACTION, CREDENTIAL_REPOSITORY, PASSWORD_HASH]) {
      const src = read(file);
      assert.doesNotMatch(
        src,
        /console\.(log|info|warn|error|debug)/,
        `${file}: the authentication path must not log`,
      );
    }
    // The action must not put the password anywhere it could survive the request.
    const action = read(LOGIN_ACTION);
    assert.doesNotMatch(
      action,
      /redirect\([^)]*password/,
      "the password is never placed in a redirect URL",
    );
    assert.doesNotMatch(
      action,
      /setSessionCookie\([^)]*password/,
      "the password never enters a cookie",
    );
  }

  /* ── V: the pre-D1 email-only shortcut is GONE, not merely discouraged ────── */
  {
    const service = read(SESSION_SERVICE);

    // A session may be minted only after the credential has been checked.
    const verifyAt = service.indexOf("await verifyPasswordCredential(");
    const mintAt = service.indexOf("generateSessionReference()");
    assert.ok(verifyAt > 0, "the password is verified in the sign-in path");
    assert.ok(mintAt > 0, "session material is generated in the sign-in path");
    assert.ok(
      verifyAt < mintAt,
      "verification happens BEFORE any session reference exists — order is the security property",
    );

    // EVERY non-verified verdict must terminate the ceremony. If a new outcome is
    // added to the union without a refusal here, this fails.
    for (const outcome of ["no-credential", "locked", "rejected"]) {
      assert.match(
        service,
        new RegExp(`verification\\.outcome === "${outcome}"`),
        `the sign-in path explicitly handles and refuses "${outcome}"`,
      );
    }
    // The success path is reached only by falling through all of them.
    assert.ok(
      service.indexOf('verification.outcome === "rejected"') <
        service.indexOf("recordSuccessfulVerification(db,"),
      "success is downstream of every refusal branch",
    );

    // There is exactly ONE sign-in entry point in the whole app.
    const signInCallers = collect("src").filter((file) =>
      /issueLocalSession\s*\(/.test(readFileSync(path.join(ROOT, file), "utf8")),
    );
    assert.deepEqual(
      signInCallers.sort(),
      [LOGIN_ACTION, SESSION_SERVICE].sort(),
      "only the login action calls the sign-in service — there is no second door",
    );

    // And no environment flag can turn verification off.
    assert.doesNotMatch(
      service,
      /process\.env/,
      "no environment switch can disable credential verification",
    );
    assert.doesNotMatch(
      read(LOGIN_ACTION),
      /NODE_ENV|DEV_|BYPASS|SKIP_/,
      "the login action has no development bypass of any kind",
    );
  }

  /* ── L, M: the client supplies a password, never an authority ─────────────── */
  {
    const action = read(LOGIN_ACTION);
    const formReads = [...action.matchAll(/formData\.get\("([^"]+)"\)/g)].map((m) => m[1]);
    assert.deepEqual(
      formReads.sort(),
      ["email", "password"],
      "the form supplies exactly two fields — nothing identity- or authority-bearing",
    );
    for (const forged of [
      "authIdentityId",
      "auth_identity_id",
      "userId",
      "tenantId",
      "roleId",
      "membershipId",
      "assuranceLevel",
      "mfaVerified",
    ]) {
      assert.ok(
        !formReads.includes(forged),
        `the client cannot supply ${forged} — it is resolved server-side`,
      );
    }
    // The identity, tenant, membership and role all come from the database.
    const service = read(SESSION_SERVICE);
    assert.match(service, /findActiveLocalIdentityByEmail\(db,/, "identity is looked up");
    assert.match(service, /findPrimaryActiveMembership\(db,/, "membership is looked up");
    assert.match(
      service,
      /roleId: row\.membershipRoleId!/,
      "the role comes from the membership row, never from the request",
    );
  }

  /* ── N, O restated structurally: sign-in writes no authorization ──────────── */
  {
    const service = read(SESSION_SERVICE);
    for (const forbidden of ["insert(memberships)", "insert(roles)", "insert(users)"]) {
      assert.ok(
        !service.includes(forbidden),
        `the sign-in path must never ${forbidden}`,
      );
    }
    // The only thing it inserts is a session context.
    assert.match(service, /insertSessionContext\(db,/, "it does create a session");
  }

  /* ── W: high-authority flows still resolve their actor server-side ────────── */
  {
    for (const file of [
      "src/app/(dashboard)/platform/actions.ts", // R2E kill-switch
      "src/app/(dashboard)/knowledge/actions.ts", // K2 create / K3 supersede
    ]) {
      const src = read(file);
      assert.match(
        src,
        /resolveTenantContext\(\)/,
        `${file}: the actor is still resolved from the session, not from the request`,
      );
      assert.doesNotMatch(
        src,
        /formData\.get\("(tenantId|actorId|roleId|userId|membershipId)"\)/,
        `${file}: authority fields are never read from the client`,
      );
    }
  }

  /* ── Heby, voice and slash commands cannot authenticate anybody ───────────── */
  {
    const surfaces = [
      ...collect("src/features/heby-commands"),
      ...collect("src/features/heby-voice"),
      ...collect("src/features/heby-answer"),
      ...collect("src/features/heby-model"),
      ...collect("src/components/layout/heby"),
      ...collect("src/app/(dashboard)/heby"),
    ];
    assert.ok(surfaces.length > 20, "the Heby surface really is being scanned");
    for (const file of surfaces) {
      const src = readFileSync(path.join(ROOT, file), "utf8");
      assert.doesNotMatch(
        src,
        /issueLocalSession|verifyPassword|hashPassword|credential-repository|password-hash|setSessionCookie/,
        `${file}: no Heby, voice or command surface may authenticate a human`,
      );
      assert.doesNotMatch(
        src,
        /authCredentials|auth_credentials/,
        `${file}: the credential authority is not reachable from a conversational surface`,
      );
    }
    // The slash registry has no credential vocabulary at all.
    const registry = read("src/features/heby-commands/registry.ts");
    assert.doesNotMatch(
      registry,
      /\/login|\/signin|\/sign-in|\/password|\/authenticate/,
      "no slash command can sign anybody in",
    );
  }

  /* ── The credential authority grants nothing ──────────────────────────────── */
  {
    const schema = read(CREDENTIAL_SCHEMA);
    for (const authorityColumn of ["tenantId", "roleId", "membershipId", "permission"]) {
      assert.ok(
        !schema.includes(authorityColumn),
        `auth_credentials must not carry ${authorityColumn} — a credential is not an authorization`,
      );
    }
    assert.match(schema, /rootColumns/, "it is global, like the identity it proves");
    assert.match(
      schema,
      /onDelete: "restrict"/,
      "a credential is revoked, never silently orphaned",
    );
  }

  /* ── AAL truth: a password claims one factor and nothing more ─────────────── */
  {
    const service = read(SESSION_SERVICE);
    assert.match(service, /SESSION_ASSURANCE_LEVEL = "aal1"/, "aal1 is what is claimed");
    assert.doesNotMatch(service, /aal2|aal3/, "no stronger assurance is asserted anywhere");
    assert.match(service, /mfaVerified: false/, "MFA is honestly reported as absent");

    // The login page must not advertise protection that does not exist.
    const page = read(LOGIN_PAGE);
    assert.doesNotMatch(
      page,
      /MFA protected|two-factor|enterprise verified|phishing|single sign-on enabled/i,
      "the sign-in page claims no capability D1 does not have",
    );
    assert.match(
      page,
      /recovery is not available/i,
      "the missing recovery path is stated rather than hidden",
    );
  }

  /* ── The auth modules stay greppable ──────────────────────────────────────── */
  {
    // A NUL byte makes a file "binary" to grep -I, which silently removes it from
    // every security audit that uses grep. Elsewhere in this repository NUL is a
    // deliberate key delimiter and a deliberate rejected-input fixture, so this is
    // scoped to the modules where it can only ever be an accident.
    for (const file of [
      CREDENTIAL_SCHEMA,
      CREDENTIAL_REPOSITORY,
      PASSWORD_HASH,
      SESSION_SERVICE,
      LOGIN_ACTION,
      LOGIN_PAGE,
    ]) {
      const bytes = readFileSync(path.join(ROOT, file));
      assert.equal(
        bytes.includes(0),
        false,
        `${file}: contains a NUL byte, which would hide it from grep-based audits`,
      );
    }
  }

  console.log("D1 boundaries and firewall: passed");
}

main();
