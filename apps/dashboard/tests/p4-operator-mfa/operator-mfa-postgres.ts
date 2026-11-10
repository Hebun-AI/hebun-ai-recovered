/*
 * P4 — operator MFA + operator grant, proven end to end against a disposable PostgreSQL database.
 *
 * Covers the acceptance criteria of both design gates through the real code paths: the ceremony core
 * (`scripts/lib/operator-authority.ts`), the admin MFA challenge (`elevateSessionWithMfa`) and the
 * admin decision (`evaluateAdminAccess`), on real sessions issued by the released sign-in service.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import {
  issueLocalSession,
  resolveSessionFromReference,
  revokeSessionByReference,
  switchTenantForSession,
} from "../../src/features/auth-runtime/session-service.server";
import type {
  AuthenticationDigestKey,
  ConfiguredAuthenticationEnvironment,
} from "../../src/features/auth/environment/auth-environment.server";
import {
  elevateSessionWithMfa,
  evaluateAdminAccess,
} from "../../src/features/operator-authority/admin-access.server";
import { resolveMfaEncryptionKeys } from "../../src/features/operator-mfa/mfa-verification.server";
import { base32Decode, hotp, totpStep } from "../../src/features/operator-mfa/totp";
import { openSecret } from "../../src/features/secret-encryption/authenticated-encryption.server";
import { resolveIntegrationEncryptionKeys } from "../../src/features/secret-encryption/key-registry.server";
import {
  beginMfaEnrollment,
  completeMfaEnrollment,
  findIdentityByEmail,
  grantOperator,
  revokeMfa,
  revokeOperator,
  verifyCeremonyActor,
  type OperatorIdentity,
} from "../../scripts/lib/operator-authority";

const T0 = new Date("2026-11-10T10:00:00.000Z");
const at = (minutes: number, seconds = 0) => new Date(T0.getTime() + minutes * 60_000 + seconds * 1000);
const KEY: AuthenticationDigestKey = Object.freeze({ version: 1, secret: "p4-operator-mfa-digest" });
const PASSWORD = "a-correct-horse-battery-7Qx";

const MFA_ENV = {
  HEBUN_MFA_ENCRYPTION_KEYS: `mfa1:${randomBytes(32).toString("base64")}`,
  HEBUN_MFA_ENCRYPTION_ACTIVE_KEY_ID: "mfa1",
  HEBUN_INTEGRATION_ENCRYPTION_KEYS: `int1:${randomBytes(32).toString("base64")}`,
  HEBUN_INTEGRATION_ENCRYPTION_ACTIVE_KEY_ID: "int1",
};
const KEYS = resolveMfaEncryptionKeys(MFA_ENV);

function envFor(dbUrl: string): ConfiguredAuthenticationEnvironment {
  return {
    status: "configured",
    enabled: true,
    provider: "local",
    controlPlaneDatabaseUrl: dbUrl,
    sessionDigestCurrentKey: KEY,
  } as ConfiguredAuthenticationEnvironment;
}

const codeAt = (secret: string, when: Date, offsetSteps = 0) =>
  hotp(base32Decode(secret)!, totpStep(when) + offsetSteps);

/* Every secret, code and enrollment URI this run produces — none may appear in the audit table or logs. */
const SENSITIVE: string[] = [];
const captured: string[] = [];

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_p4_operator_mfa");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const db = handle.db;
  const env = envFor(harness.dbUrl);
  const original = { log: console.log, error: console.error, warn: console.warn, info: console.info };
  for (const level of ["log", "error", "warn", "info"] as const) {
    console[level] = (...args: unknown[]) => {
      captured.push(args.map(String).join(" "));
      original[level](...args);
    };
  }
  try {
    harness.migrateDatabase();
    await setup.connect();
    const opSeed = await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme", email: "op@acme.test", password: PASSWORD });
    const dirSeed = await seedLocalIdentity(setup, { companyName: "Globex", companySlug: "globex", email: "dir@globex.test", password: PASSWORD });
    const op = (await findIdentityByEmail(db, "op@acme.test"))!;
    const dir = (await findIdentityByEmail(db, "dir@globex.test"))!;
    assert.ok(op && dir);

    const signIn = async (email: string, when: Date, id: string): Promise<string> => {
      const issued = await issueLocalSession(db, env, { email, password: PASSWORD, requestId: id }, when);
      assert.equal(issued.result.status, "authorized", `${email} signs in`);
      return issued.reference;
    };
    const access = async (reference: string, when: Date) =>
      evaluateAdminAccess(db, await resolveSessionFromReference(db, env, reference, { requestId: "acc" }, when), when);

    /* ── 17 · Customer/Director sign-in unchanged: aal1, no MFA ───────────────────────────── */
    const dirRef = await signIn("dir@globex.test", at(0), "d1");
    const dirSession = await resolveSessionFromReference(db, env, dirRef, { requestId: "d1r" }, at(0));
    assert.equal(dirSession.status, "authorized");
    if (dirSession.status !== "authorized") throw new Error("unreachable");
    assert.equal(dirSession.applicationSession.assuranceLevel, "aal1");
    assert.equal(dirSession.applicationSession.mfaVerified, false);

    /* ── 3 · A Director (tenant owner) is not an admin ─────────────────────────────────────── */
    assert.equal((await access(dirRef, at(0))).status, "forbidden", "3: a Director (tenant owner) is not an admin");

    /* ── 15 · No verified actor, no act ─────────────────────────────────────────────────────── */
    assert.deepEqual(
      await verifyCeremonyActor(db, { email: "op@acme.test", password: "wrong-password-1234" }, KEYS, at(1)),
      { status: "refused", reason: "actor-unverified" },
    );
    assert.equal((await verifyCeremonyActor(db, { email: "nobody@x.test", password: PASSWORD }, KEYS, at(1))).status, "refused");

    /* ── Bootstrap: no operator exists → password-verified actor, recorded as bootstrap ─────── */
    const boot = await verifyCeremonyActor(db, { email: "op@acme.test", password: PASSWORD }, KEYS, at(1));
    assert.equal(boot.status, "verified");
    if (boot.status !== "verified") throw new Error("unreachable");
    assert.equal(boot.bootstrap, true);
    const act = (actor: OperatorIdentity, bootstrap: boolean, target: OperatorIdentity, when: Date, reason = "P4 test act") =>
      ({ actor, bootstrap, target, reason, now: when });

    /* Reason is mandatory. */
    assert.deepEqual(await grantOperator(db, act(op, true, op, at(1), "  ")), { status: "refused", reason: "reason-required" });

    /* ── MFA enrollment: pending until the first code; secret sealed with the MFA key set ───── */
    const started = await beginMfaEnrollment(db, { target: op, actor: op, now: at(2) }, KEYS);
    assert.equal(started.status, "started");
    if (started.status !== "started") throw new Error("unreachable");
    const secret = started.secret;
    SENSITIVE.push(secret);
    const pending = await setup.query(`select status, seal_ciphertext, seal_key_id from auth_mfa_credentials where id=$1`, [started.credentialId]);
    assert.equal(pending.rows[0].status, "pending");
    assert.equal(pending.rows[0].seal_key_id, "mfa1", "sealed with the MFA key set (O2)");
    assert.ok(!JSON.stringify(pending.rows[0]).includes(secret), "no clear secret in the row");
    const integrationKeys = resolveIntegrationEncryptionKeys(MFA_ENV);
    assert.equal(integrationKeys.status, "configured");
    if (integrationKeys.status === "configured") {
      const row = (await setup.query<Record<string, string>>(`select * from auth_mfa_credentials where id=$1`, [started.credentialId])).rows[0]!;
      const viaIntegration = openSecret(
        { algorithm: "aes-256-gcm", keyId: row.seal_key_id, ciphertext: row.seal_ciphertext, iv: row.seal_iv, authTag: row.seal_auth_tag },
        integrationKeys.keys.get("int1")!,
        Buffer.from(`hebun-mfa-totp:v1:${started.credentialId}`),
      );
      assert.equal(viaIntegration.ok, false, "an integration key cannot open an MFA secret (O2)");
    }
    const wrongFirst = await completeMfaEnrollment(db, { ...act(op, true, op, at(2)), credentialId: started.credentialId, code: "000000" }, KEYS);
    assert.equal(wrongFirst.status, "refused", "a wrong first code activates nothing");
    const firstCode = codeAt(secret, at(2, 5));
    SENSITIVE.push(firstCode);
    const enrolled = await completeMfaEnrollment(db, { ...act(op, true, op, at(2, 5)), credentialId: started.credentialId, code: firstCode }, KEYS);
    assert.equal(enrolled.status, "done");

    /* ── 2 · MFA without a grant opens nothing ──────────────────────────────────────────────── */
    const opRef = await signIn("op@acme.test", at(3), "o1");
    const noGrant = await elevateSessionWithMfa(db, env, opRef, codeAt(secret, at(3)), { requestId: "o1e" }, KEYS, at(3));
    assert.deepEqual(noGrant, { status: "refused", reason: "forbidden" });
    assert.equal((await access(opRef, at(3))).status, "forbidden");

    /* Bootstrap grant (still no operator). */
    const granted = await grantOperator(db, act(op, true, op, at(4)));
    assert.equal(granted.status, "done");

    /* Once an operator exists, the actor must be an operator WITH a valid code of their own. */
    assert.deepEqual(
      await verifyCeremonyActor(db, { email: "dir@globex.test", password: PASSWORD }, KEYS, at(5)),
      { status: "refused", reason: "actor-not-operator", actor: dir },
      "15: once an operator exists, a non-operator actor is refused",
    );
    assert.equal((await verifyCeremonyActor(db, { email: "op@acme.test", password: PASSWORD }, KEYS, at(5))).status, "refused");
    const badActorCode = await verifyCeremonyActor(db, { email: "op@acme.test", password: PASSWORD, code: "123456" }, KEYS, at(5));
    assert.deepEqual(badActorCode.status === "refused" && badActorCode.reason, "actor-mfa-failed");

    /* ── 1 · Grant without MFA on the session → challenge required ──────────────────────────── */
    assert.deepEqual(await access(opRef, at(6)), { status: "mfa-required", mfa: "missing" }, "1: an operator without session MFA is sent to the challenge");

    /* ── 4 · Wrong code refused   5 · Expired (out-of-window) code refused ──────────────────── */
    assert.deepEqual(await elevateSessionWithMfa(db, env, opRef, "111111", { requestId: "w" }, KEYS, at(6)), { status: "refused", reason: "invalid" });
    const stale = codeAt(secret, at(6), -2);
    assert.deepEqual(await elevateSessionWithMfa(db, env, opRef, stale, { requestId: "s" }, KEYS, at(6)), { status: "refused", reason: "invalid" });

    /* Correct code → rotated aal2 session; the old reference is dead. */
    const goodCode = codeAt(secret, at(7));
    SENSITIVE.push(goodCode);
    const elevated = await elevateSessionWithMfa(db, env, opRef, goodCode, { requestId: "g" }, KEYS, at(7));
    assert.equal(elevated.status, "elevated");
    if (elevated.status !== "elevated") throw new Error("unreachable");
    assert.equal((await resolveSessionFromReference(db, env, opRef, { requestId: "old" }, at(7))).status, "unauthenticated", "old reference revoked");
    const adminRef = elevated.reference;
    assert.equal((await access(adminRef, at(7))).status, "granted");
    const row = (await setup.query(
      `select assurance_level, mfa_verified, mfa_verified_at, mfa_credential_id from user_session_contexts where revoked_at is null and user_id=$1 and mfa_verified`,
      [op.userId],
    )).rows[0];
    assert.equal(row.assurance_level, "aal2");
    assert.equal(row.mfa_credential_id, started.credentialId);

    /* ── 6 · Replay: the same code (same step) is never accepted twice ─────────────────────── */
    const otherRef = await signIn("op@acme.test", at(7, 10), "o2");
    assert.deepEqual(await elevateSessionWithMfa(db, env, otherRef, goodCode, { requestId: "r" }, KEYS, at(7, 10)), { status: "refused", reason: "invalid" }, "6: a used code is never accepted twice");

    /* ── 8 · MFA is not portable: another session of the same human is still aal1 ──────────── */
    assert.deepEqual(await access(otherRef, at(7, 20)), { status: "mfa-required", mfa: "missing" });

    /* ── 13 · A forged client claim changes nothing — the decision re-reads the session row ── */
    const plain = await resolveSessionFromReference(db, env, otherRef, { requestId: "f" }, at(7, 30));
    assert.equal(plain.status, "authorized");
    if (plain.status === "authorized") {
      const forged = {
        ...plain,
        applicationSession: { ...plain.applicationSession, assuranceLevel: "aal2" as const, mfaVerified: true },
        tenantContext: { ...plain.tenantContext, assuranceLevel: "aal2" as const, mfaVerified: true },
      };
      assert.deepEqual(await evaluateAdminAccess(db, forged, at(7, 30)), { status: "mfa-required", mfa: "missing" });
    }

    /* ── O1 · 60-minute window, checked on every request (activity keeps the session alive) ─── */
    for (const minute of [20, 40, 60]) assert.equal((await access(adminRef, at(minute))).status, "granted", `granted at +${minute}m`);
    assert.deepEqual(await access(adminRef, at(7 + 61)), { status: "mfa-required", mfa: "expired" }, "O1: admin MFA expires after 60 minutes");

    /* ── 9 · Tenant switch drops MFA ─────────────────────────────────────────────────────────── */
    const role = await setup.query<{ id: string }>(`insert into roles (tenant_id, name, type) values ($1,'Member','member') returning id`, [dirSeed.tenantId]);
    const second = await setup.query<{ id: string }>(
      `insert into memberships (tenant_id, user_id, role_id, status) values ($1,$2,$3,'active') returning id`,
      [dirSeed.tenantId, op.userId, role.rows[0]!.id],
    );
    /* Two memberships now: sign-in asks for a tenant, so the session is selected first. */
    const freshRef = await selectFresh(at(80));
    const code80 = codeAt(secret, at(80, 30));
    const elevated80 = await elevateSessionWithMfa(db, env, freshRef, code80, { requestId: "e80" }, KEYS, at(80, 30));
    assert.equal(elevated80.status, "elevated");
    if (elevated80.status !== "elevated") throw new Error("unreachable");
    assert.equal((await access(elevated80.reference, at(81))).status, "granted");
    const switched = await switchTenantForSession(db, env, elevated80.reference, { membershipId: second.rows[0]!.id, requestId: "sw" }, at(81));
    assert.equal(switched.status, "switched");
    if (switched.status !== "switched") throw new Error("unreachable");
    assert.deepEqual(await access(switched.reference, at(81)), { status: "mfa-required", mfa: "missing" });
    const afterSwitch = (await setup.query(
      `select assurance_level, mfa_verified, mfa_verified_at, mfa_credential_id from user_session_contexts where revoked_at is null and user_id=$1 and active_membership_id=$2`,
      [op.userId, second.rows[0]!.id],
    )).rows[0];
    assert.deepEqual(
      [afterSwitch.assurance_level, afterSwitch.mfa_verified, afterSwitch.mfa_verified_at, afterSwitch.mfa_credential_id],
      ["aal1", false, null, null],
    );

    /* ── 10 · Logout ends the MFA with the session ─────────────────────────────────────────── */
    const fresh2 = await selectAndElevate(at(90), at(90, 30));
    assert.equal((await access(fresh2, at(91))).status, "granted");
    assert.equal(await revokeSessionByReference(db, env, fresh2, "logout", at(91)), true);
    assert.equal((await access(fresh2, at(91))).status, "unauthenticated");

    /* ── 11 · MFA credential revoke cuts admin on the next request ─────────────────────────── */
    const live = await selectAndElevate(at(100), at(100, 30));
    assert.equal((await access(live, at(101))).status, "granted");
    const actorCode101 = codeAt(secret, at(101, 30));
    const actor101 = await verifyCeremonyActor(db, { email: "op@acme.test", password: PASSWORD, code: actorCode101 }, KEYS, at(101, 30));
    assert.equal(actor101.status, "verified");
    if (actor101.status !== "verified") throw new Error("unreachable");
    assert.equal(actor101.bootstrap, false);
    assert.equal((await revokeMfa(db, act(op, false, op, at(102)))).status, "done");
    assert.deepEqual(await access(live, at(102)), { status: "mfa-required", mfa: "credential-changed" }, "11: revoking MFA cuts admin on the next request");

    /* Recovery (O4): audited re-enrollment, then the new credential works. */
    const reStart = await beginMfaEnrollment(db, { target: op, actor: op, now: at(103) }, KEYS);
    assert.equal(reStart.status, "started");
    if (reStart.status !== "started") throw new Error("unreachable");
    SENSITIVE.push(reStart.secret);
    assert.equal(
      (await completeMfaEnrollment(db, { ...act(op, false, op, at(103, 5)), credentialId: reStart.credentialId, code: codeAt(reStart.secret, at(103, 5)) }, KEYS)).status,
      "done",
    );

    /* ── 7 · Five failures lock for 15 minutes; a locked credential refuses the right code ──── */
    const lockRef = await selectFresh(at(110));
    for (let i = 0; i < 5; i++) {
      await elevateSessionWithMfa(db, env, lockRef, "222222", { requestId: `l${i}` }, KEYS, at(110, i));
    }
    assert.deepEqual(
      await elevateSessionWithMfa(db, env, lockRef, codeAt(reStart.secret, at(110, 30)), { requestId: "l5" }, KEYS, at(110, 30)),
      { status: "refused", reason: "locked" },
      "7: five failures lock the credential",
    );
    const unlocked = await elevateSessionWithMfa(db, env, lockRef, codeAt(reStart.secret, at(126)), { requestId: "l6" }, KEYS, at(126));
    assert.equal(unlocked.status, "elevated", "the lock expires after 15 minutes");
    if (unlocked.status !== "elevated") throw new Error("unreachable");

    /* ── 12 · Operator revoke cuts admin on the next request, MFA still valid ──────────────── */
    assert.equal((await access(unlocked.reference, at(127))).status, "granted");
    assert.equal((await revokeOperator(db, act(op, false, op, at(128)))).status, "done");
    assert.equal((await access(unlocked.reference, at(128))).status, "forbidden", "12: operator revoke cuts admin on the next request");

    /* ── 14 · Audit failure ⇒ no grant ─────────────────────────────────────────────────────── */
    await setup.query(`create function p4_fail_audit() returns trigger language plpgsql as $$ begin raise exception 'audit down'; end $$`);
    await setup.query(`create trigger p4_fail_audit before insert on audit_log for each row execute function p4_fail_audit()`);
    await assert.rejects(grantOperator(db, act(op, true, dir, at(130))), (error: unknown) =>
      /audit down/.test(String((error as { cause?: unknown }).cause ?? error)));
    assert.equal((await setup.query(`select count(*)::int as n from platform_operator_grants where auth_identity_id=$1`, [dir.authIdentityId])).rows[0].n, 0);
    await setup.query(`drop trigger p4_fail_audit on audit_log; drop function p4_fail_audit()`);

    /* ── O3 · Audit rows: verified actor, target, action, time, reason, result ─────────────── */
    const audit = (await setup.query<{
      actor_type: string; actor_id: string; action: string; entity_id: string; occurred_at: Date; result: string;
      metadata: Record<string, unknown>; authority_source: string | null;
    }>(
      `select actor_type, actor_id, action, entity_id, occurred_at, result, metadata, authority_source, previous_state, next_state
         from audit_log where action like 'platform.operator.%' or action like 'auth.mfa.%' order by recorded_at`,
    )).rows;
    const committed = (action: string) => audit.filter((r) => r.action === action && r.result === "committed");
    assert.equal(committed("platform.operator.grant").length, 1);
    assert.equal(committed("platform.operator.revoke").length, 1);
    assert.equal(committed("auth.mfa.enroll").length, 2);
    assert.equal(committed("auth.mfa.revoke").length, 1);
    assert.ok(committed("auth.mfa.verify").length >= 4);
    assert.ok(audit.some((r) => r.action === "auth.mfa.verify" && r.result === "rejected"), "refused challenges are recorded");
    for (const r of audit.filter((x) => x.result === "committed")) {
      assert.equal(r.actor_type, "human");
      assert.equal(r.actor_id, op.userId, "the verified actor");
      assert.equal(r.metadata.targetAuthIdentityId, op.authIdentityId);
      assert.ok(typeof r.metadata.reason === "string" && r.metadata.reason.length > 0);
      assert.ok(r.occurred_at instanceof Date);
    }
    const bootRows = audit.filter((r) => r.metadata.bootstrap === true);
    assert.deepEqual(bootRows.map((r) => [r.action, r.authority_source]), [["auth.mfa.enroll", "system"], ["platform.operator.grant", "system"]]);

    /* ── 16 · No secret, code or enrollment URI in any audit row or log line ───────────────── */
    const auditText = JSON.stringify((await setup.query(`select * from audit_log`)).rows);
    const sessionText = JSON.stringify((await setup.query(`select * from user_session_contexts`)).rows);
    for (const value of SENSITIVE) {
      assert.ok(!auditText.includes(value), "no secret/code in audit_log");
      assert.ok(!sessionText.includes(value), "no secret/code in sessions");
      assert.ok(!captured.some((line) => line.includes(value)), "no secret/code in logs");
    }
    assert.ok(!auditText.includes("otpauth://") && !captured.some((l) => l.includes("otpauth://")));

    console.log("P4 operator MFA (postgres): all acceptance checks passed");

    async function selectFresh(when: Date): Promise<string> {
      const issued = await issueLocalSession(db, env, { email: "op@acme.test", password: PASSWORD, requestId: `sf${when.getTime()}` }, when);
      const { selectTenantForSession } = await import("../../src/features/auth-runtime/session-service.server");
      const selected = await selectTenantForSession(db, env, issued.reference, { membershipId: opSeed.membershipId, requestId: `sfs${when.getTime()}` }, when);
      assert.equal(selected.status, "selected");
      return selected.status === "selected" ? selected.reference : "";
    }
    async function selectAndElevate(signInAt: Date, elevateAt: Date): Promise<string> {
      const ref = await selectFresh(signInAt);
      const out = await elevateSessionWithMfa(db, env, ref, codeAt(secret, elevateAt), { requestId: `se${elevateAt.getTime()}` }, KEYS, elevateAt);
      assert.equal(out.status, "elevated");
      return out.status === "elevated" ? out.reference : "";
    }
  } finally {
    Object.assign(console, original);
    await setup.end().catch(() => undefined);
    await handle.dispose();
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
