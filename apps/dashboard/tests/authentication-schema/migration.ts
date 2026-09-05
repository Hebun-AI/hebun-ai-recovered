import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";

const TENANT_A = "10000000-0000-4000-8000-000000000001";
const TENANT_B = "10000000-0000-4000-8000-000000000002";
const USER_A = "20000000-0000-4000-8000-000000000001";
const USER_B = "20000000-0000-4000-8000-000000000002";
const ROLE_A = "30000000-0000-4000-8000-000000000001";
const ROLE_B = "30000000-0000-4000-8000-000000000002";
const ORG_A = "40000000-0000-4000-8000-000000000001";
const ORG_B = "40000000-0000-4000-8000-000000000002";
const MEMBERSHIP_A = "50000000-0000-4000-8000-000000000001";
const IDENTITY_A = "60000000-0000-4000-8000-000000000001";
const PERMISSION = "70000000-0000-4000-8000-000000000001";

async function expectPgError(
  client: Client,
  code: string,
  sql: string,
  values: unknown[] = [],
): Promise<void> {
  await assert.rejects(
    client.query(sql, values),
    (error: unknown) =>
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === code,
  );
}

async function main(): Promise<void> {
const harness = createDisposablePostgresHarness("hebun_auth_schema");
await harness.createDatabase();

try {
  harness.migrateDatabase();
  const client = new Client({ connectionString: harness.dbUrl });
  await client.connect();

  try {
    const migrationCount = await client.query<{ count: string }>(
      "select count(*)::text as count from drizzle.__drizzle_migrations",
    );
    // 15 baseline + R2D message-provenance + R2E provider-connectivity-control
    // + D1 auth-credentials + G2.1 genesis-nomination + G2 bootstrap-authority
    // + I1 membership-authorization + I1.1 tenant-role-baseline
    // + I1.2 identity-enrollment + Membership-Role tenant integrity
    // + KR5 heby-answer-evidence + R3A action-authorization
    // + R3W durable-work-artifacts + R3R durable-recipient-authority
    // + R3B action-execution-attempts + R4A tenant-provisioning-source
    // + production-provenance-vocabulary + G6D answer-source-evidence
    // + I1 integration-connection-authority = 33
    // + INT-2 integration-credential-authority = 34
    // + R2H provider control_source = 35
    // + KR-EXT1 knowledge-external-references = 36.
    // + AGENT-PROPOSAL-4B agent-origination invocation provenance = 37.
    // + SIA-2.6 origination agent attribution = 38.
    // + SIA-3 agent improvement hypotheses = 39.
    // + AMA-1 agent mandate authority = 40.
    //
    // (The tally had stopped at 33 while the assertion below read 34: INT-2 moved the number and
    // not the prose. Both move together from here.)
    //
    // AND IT HAPPENED AGAIN, WHICH IS WHY EACH PHASE NOW GETS ITS OWN LINE. SIA-2.6 re-pinned the
    // assertion by incrementing the number on the AGENT-PROPOSAL-4B line — relabelling 4B's
    // migration as 38 when it is 37. A tally where one line absorbs the next phase's count is a
    // tally that reads correctly and says something false; one line per phase cannot do that.
    //
    // This tally is the ONE place a running total belongs: it is this file's actual subject. Other
    // phases must state "I added none of my own" without pinning a global count, or every later
    // authorized migration falsifies a claim that was never about it.
    /*
     * Re-pinned most recently by AMA-1, which added migration 40 (`agent_mandates`) — one additive
     * table, five foreign keys (one of them the composite tenant-safe key onto `agents`), four
     * indexes, six CHECKs, one `ALTER TYPE ... ADD VALUE` on `governance_domain`, zero DROP and
     * zero backfill. No released migration was edited, and no existing table was altered, which is
     * what the ledger digest pinned elsewhere proves independently of this count.
     *
     * SIA-3 held this line before it, at 39 (`agent_improvement_hypotheses`).
     */
    assert.equal(migrationCount.rows[0]?.count, "48"); /* WEV-1 grew the ledger 44 -> 45; PBGA-1 45 -> 46; CGO-1 46 -> 47 (content-draft + destination). TRH-10 47 -> 48 (the `artifact-review` governance domain). */

    /*
     * The rerun is about IDEMPOTENCE, not about the total, so it is compared to what the first run
     * produced rather than to a second copy of the literal. Two pins of the same number look like
     * two facts and are really one; only this form keeps failing for the right reason.
     */
    harness.migrateDatabase();
    const rerunCount = await client.query<{ count: string }>(
      "select count(*)::text as count from drizzle.__drizzle_migrations",
    );
    assert.equal(rerunCount.rows[0]?.count, migrationCount.rows[0]?.count);

    const enumRows = await client.query<{ typname: string; labels: string[] }>(`
      select t.typname, json_agg(e.enumlabel order by e.enumsortorder) as labels
        from pg_type t
        join pg_enum e on e.enumtypid = t.oid
       where t.typname in (
         'auth_identity_status', 'membership_status', 'tenant_status', 'invitation_status'
       )
       group by t.typname
    `);
    assert.deepEqual(
      Object.fromEntries(enumRows.rows.map((row) => [row.typname, row.labels])),
      {
        auth_identity_status: ["pending", "active", "suspended", "revoked"],
        invitation_status: ["pending", "accepted", "expired", "revoked"],
        membership_status: ["pending", "active", "suspended", "revoked", "expired"],
        tenant_status: ["provisioning", "active", "suspended", "deleting", "deleted"],
      },
    );

    const tables = await client.query<{ table_name: string }>(`
      select table_name from information_schema.tables
       where table_schema = 'public'
         and table_name in ('auth_identities','invitations','user_session_contexts','role_permissions')
       order by table_name
    `);
    assert.deepEqual(
      tables.rows.map((row) => row.table_name),
      ["auth_identities", "invitations", "role_permissions", "user_session_contexts"],
    );

    const columnContracts = await client.query<{
      table_name: string;
      column_name: string;
      is_nullable: "YES" | "NO";
      column_default: string | null;
    }>(`
      select table_name, column_name, is_nullable, column_default
        from information_schema.columns
       where table_schema = 'public'
         and (table_name, column_name) in (
           ('companies', 'tenant_status'),
           ('memberships', 'status'),
           ('memberships', 'accepted_invitation_id'),
           ('audit_log', 'request_id'),
           ('auth_identities', 'status'),
           ('invitations', 'status'),
           ('user_session_contexts', 'session_version'),
           ('user_session_contexts', 'provider_session_reference_digest_version')
         )
    `);
    const columns = new Map(
      columnContracts.rows.map((row) => [`${row.table_name}.${row.column_name}`, row]),
    );
    for (const nullableColumn of [
      "companies.tenant_status",
      "memberships.status",
      "memberships.accepted_invitation_id",
      "audit_log.request_id",
    ]) {
      assert.equal(columns.get(nullableColumn)?.is_nullable, "YES");
      assert.equal(columns.get(nullableColumn)?.column_default, null);
    }
    assert.match(columns.get("auth_identities.status")?.column_default ?? "", /pending/);
    assert.match(columns.get("invitations.status")?.column_default ?? "", /pending/);
    assert.match(columns.get("user_session_contexts.session_version")?.column_default ?? "", /1/);
    assert.equal(
      columns.get("user_session_contexts.provider_session_reference_digest_version")?.is_nullable,
      "NO",
    );

    const forbiddenColumns = await client.query<{ column_name: string }>(`
      select column_name from information_schema.columns
       where table_schema = 'public'
         and table_name in ('auth_identities','invitations','user_session_contexts')
         and column_name in (
           'access_token','refresh_token','provider_session_id','raw_jwt','jwt','cookie',
           'plaintext_token','token'
         )
    `);
    assert.deepEqual(forbiddenColumns.rows, []);

    await client.query(
      `insert into companies (id, name, slug) values ($1, 'Tenant A', 'tenant-a'), ($2, 'Tenant B', 'tenant-b')`,
      [TENANT_A, TENANT_B],
    );
    await client.query(
      `insert into organizations (id, tenant_id, name, slug)
       values ($1, $2, 'Org A', 'org-a'), ($3, $4, 'Org B', 'org-b')`,
      [ORG_A, TENANT_A, ORG_B, TENANT_B],
    );
    await client.query(
      `insert into roles (id, tenant_id, name) values ($1, $2, 'Owner A'), ($3, $4, 'Owner B')`,
      [ROLE_A, TENANT_A, ROLE_B, TENANT_B],
    );
    await client.query(
      `insert into users (id, email) values ($1, 'a@example.test'), ($2, 'b@example.test')`,
      [USER_A, USER_B],
    );
    await client.query(
      `insert into memberships (id, tenant_id, user_id) values ($1, $2, $3)`,
      [MEMBERSHIP_A, TENANT_A, USER_A],
    );
    await client.query(
      `insert into permissions (id, key, scope) values ($1, 'dashboard.access', 'platform')`,
      [PERMISSION],
    );

    await client.query(
      `insert into auth_identities
        (id, user_id, provider, issuer, subject, status, is_primary, verified_at)
       values ($1, $2, 'supabase', 'https://issuer.example.test', 'subject-a', 'active', true, now())`,
      [IDENTITY_A, USER_A],
    );
    await expectPgError(
      client,
      "23505",
      `insert into auth_identities (user_id, provider, issuer, subject)
       values ($1, 'supabase', 'https://issuer.example.test', 'subject-a')`,
      [USER_B],
    );
    await expectPgError(
      client,
      "23505",
      `insert into auth_identities
        (user_id, provider, issuer, subject, status, is_primary, verified_at)
       values ($1, 'supabase', 'https://issuer.example.test', 'subject-b', 'active', true, now())`,
      [USER_A],
    );
    await expectPgError(
      client,
      "23514",
      `insert into auth_identities (user_id, provider, issuer, subject)
       values ($1, 'Invalid Provider', 'https://issuer.example.test', 'invalid-provider')`,
      [USER_B],
    );
    await expectPgError(
      client,
      "23514",
      `insert into auth_identities (user_id, provider, issuer, subject, status)
       values ($1, 'supabase', 'https://issuer.example.test', 'unverified-active', 'active')`,
      [USER_B],
    );
    await expectPgError(
      client,
      "23514",
      `insert into auth_identities
        (user_id, provider, issuer, subject, status, revoked_at)
       values ($1, 'supabase', 'https://issuer.example.test', 'revoked-no-reason', 'revoked', now())`,
      [USER_B],
    );
    await expectPgError(
      client,
      "23514",
      `insert into auth_identities
        (user_id, provider, issuer, subject, status, revoked_at, revocation_reason)
       values ($1, 'supabase', 'https://issuer.example.test', 'revoked-blank-reason', 'revoked', now(), '   ')`,
      [USER_B],
    );

    const invitationColumns = `tenant_id, normalized_email, intended_role_id,
      organization_id, inviter_type, inviter_id, token_hash, expires_at`;
    await client.query(
      `insert into invitations (${invitationColumns})
       values ($1, 'invitee@example.test', $2, $3, 'system', $4, $5, now() + interval '1 day')`,
      [TENANT_A, ROLE_A, ORG_A, USER_A, "a".repeat(64)],
    );
    await expectPgError(
      client,
      "23505",
      `insert into invitations (${invitationColumns})
       values ($1, 'other@example.test', $2, $3, 'system', $4, $5, now() + interval '1 day')`,
      [TENANT_A, ROLE_A, ORG_A, USER_A, "a".repeat(64)],
    );
    await expectPgError(
      client,
      "23505",
      `insert into invitations (${invitationColumns})
       values ($1, 'invitee@example.test', $2, $3, 'system', $4, $5, now() + interval '1 day')`,
      [TENANT_A, ROLE_A, ORG_A, USER_A, "b".repeat(64)],
    );
    await expectPgError(
      client,
      "23514",
      `insert into invitations (${invitationColumns}, status)
       values ($1, 'accepted@example.test', $2, $3, 'system', $4, $5, now() + interval '1 day', 'accepted')`,
      [TENANT_A, ROLE_A, ORG_A, USER_A, "c".repeat(64)],
    );
    await expectPgError(
      client,
      "23503",
      `insert into invitations (${invitationColumns})
       values ($1, 'cross-tenant@example.test', $2, null, 'system', $3, $4, now() + interval '1 day')`,
      [TENANT_A, ROLE_B, USER_A, "d".repeat(64)],
    );
    await expectPgError(
      client,
      "23514",
      `insert into invitations (${invitationColumns}, status, revoked_at)
       values ($1, 'revoked-no-reason@example.test', $2, $3, 'system', $4, $5,
               now() + interval '1 day', 'revoked', now())`,
      [TENANT_A, ROLE_A, ORG_A, USER_A, "4".repeat(64)],
    );
    await expectPgError(
      client,
      "23514",
      `insert into invitations
        (${invitationColumns}, status, revoked_at, revocation_reason)
       values ($1, 'revoked-blank-reason@example.test', $2, $3, 'system', $4, $5,
               now() + interval '1 day', 'revoked', now(), '   ')`,
      [TENANT_A, ROLE_A, ORG_A, USER_A, "5".repeat(64)],
    );
    await expectPgError(
      client,
      "23514",
      `insert into invitations (${invitationColumns})
       values ($1, 'Not-Normalized@example.test', $2, $3, 'system', $4, $5,
               now() + interval '1 day')`,
      [TENANT_A, ROLE_A, ORG_A, USER_A, "6".repeat(64)],
    );
    await expectPgError(
      client,
      "23514",
      `insert into invitations (${invitationColumns})
       values ($1, 'invalid-token@example.test', $2, $3, 'system', $4, 'not-a-hash',
               now() + interval '1 day')`,
      [TENANT_A, ROLE_A, ORG_A, USER_A],
    );
    await expectPgError(
      client,
      "23514",
      `insert into invitations (${invitationColumns})
       values ($1, 'invalid-expiry@example.test', $2, $3, 'system', $4, $5, now())`,
      [TENANT_A, ROLE_A, ORG_A, USER_A, "7".repeat(64)],
    );

    const sessionColumns = `auth_identity_id, provider_session_reference_hash,
      provider_session_reference_digest_version, user_id,
      assurance_level, mfa_verified, authenticated_at, issued_at, last_activity_at,
      absolute_expires_at, inactivity_expires_at`;
    await client.query(
      `insert into user_session_contexts (${sessionColumns})
       values ($1, $2, 2, $3, 'aal1', false, now(), now(), now(),
               now() + interval '24 hours', now() + interval '8 hours')`,
      [IDENTITY_A, "e".repeat(64), USER_A],
    );
    await client.query(
      `insert into user_session_contexts (${sessionColumns})
       values ($1, $2, 1, $3, 'aal1', false, now(), now(), now(),
               now() + interval '24 hours', now() + interval '8 hours')`,
      [IDENTITY_A, "e".repeat(64), USER_A],
    );
    await expectPgError(
      client,
      "23505",
      `insert into user_session_contexts (${sessionColumns})
       values ($1, $2, 2, $3, 'aal1', false, now(), now(), now(),
               now() + interval '24 hours', now() + interval '8 hours')`,
      [IDENTITY_A, "e".repeat(64), USER_A],
    );
    await expectPgError(
      client,
      "23514",
      `insert into user_session_contexts (${sessionColumns})
       values ($1, $2, 2, $3, 'aal1', true, now(), now(), now(),
               now() + interval '24 hours', now() + interval '8 hours')`,
      [IDENTITY_A, "f".repeat(64), USER_A],
    );
    await expectPgError(
      client,
      "23514",
      `insert into user_session_contexts (${sessionColumns})
       values ($1, $2, 2, $3, 'aal1', false, now() + interval '1 hour', now(), now(),
               now() + interval '24 hours', now() + interval '8 hours')`,
      [IDENTITY_A, "1".repeat(64), USER_A],
    );
    await expectPgError(
      client,
      "23514",
      `insert into user_session_contexts
        (${sessionColumns}, active_tenant_id)
       values ($1, $2, 2, $3, 'aal1', false, now(), now(), now(),
               now() + interval '24 hours', now() + interval '8 hours', $4)`,
      [IDENTITY_A, "2".repeat(64), USER_A, TENANT_A],
    );
    await expectPgError(
      client,
      "23503",
      `insert into user_session_contexts
        (${sessionColumns}, active_tenant_id, active_membership_id, membership_version)
       values ($1, $2, 2, $3, 'aal1', false, now(), now(), now(),
               now() + interval '24 hours', now() + interval '8 hours', $4, $5, 1)`,
      [IDENTITY_A, "3".repeat(64), USER_A, TENANT_B, MEMBERSHIP_A],
    );
    await expectPgError(
      client,
      "23514",
      `insert into user_session_contexts (${sessionColumns})
       values ($1, 'not-a-hash', 2, $2, 'aal1', false, now(), now(), now(),
               now() + interval '24 hours', now() + interval '8 hours')`,
      [IDENTITY_A, USER_A],
    );
    await expectPgError(
      client,
      "23514",
      `insert into user_session_contexts
        (${sessionColumns}, active_tenant_id, active_membership_id)
       values ($1, $2, 2, $3, 'aal1', false, now(), now(), now(),
               now() + interval '24 hours', now() + interval '8 hours', $4, $5)`,
      [IDENTITY_A, "8".repeat(64), USER_A, TENANT_A, MEMBERSHIP_A],
    );
    await expectPgError(
      client,
      "23514",
      `insert into user_session_contexts
        (${sessionColumns}, active_tenant_id, active_membership_id, membership_version)
       values ($1, $2, 2, $3, 'aal1', false, now(), now(), now(),
               now() + interval '24 hours', now() + interval '8 hours', $4, $5, 0)`,
      [IDENTITY_A, "9".repeat(64), USER_A, TENANT_A, MEMBERSHIP_A],
    );
    await expectPgError(
      client,
      "23514",
      `insert into user_session_contexts (${sessionColumns}, revoked_at)
       values ($1, $2, 2, $3, 'aal1', false, now(), now(), now(),
               now() + interval '24 hours', now() + interval '8 hours', now())`,
      [IDENTITY_A, "a".repeat(64), USER_A],
    );
    await expectPgError(
      client,
      "23514",
      `insert into user_session_contexts (${sessionColumns}, revocation_reason)
       values ($1, $2, 2, $3, 'aal1', false, now(), now(), now(),
               now() + interval '24 hours', now() + interval '8 hours', 'logout')`,
      [IDENTITY_A, "b".repeat(64), USER_A],
    );
    await expectPgError(
      client,
      "23514",
      `insert into user_session_contexts (${sessionColumns})
       values ($1, $2, 0, $3, 'aal1', false, now(), now(), now(),
               now() + interval '24 hours', now() + interval '8 hours')`,
      [IDENTITY_A, "c".repeat(64), USER_A],
    );

    await client.query(
      `insert into role_permissions (tenant_id, role_id, permission_id)
       values ($1, $2, $3)`,
      [TENANT_A, ROLE_A, PERMISSION],
    );
    await expectPgError(
      client,
      "23505",
      `insert into role_permissions (tenant_id, role_id, permission_id)
       values ($1, $2, $3)`,
      [TENANT_A, ROLE_A, PERMISSION],
    );
    await expectPgError(
      client,
      "23503",
      `insert into role_permissions (tenant_id, role_id, permission_id)
       values ($1, $2, $3)`,
      [TENANT_A, ROLE_B, PERMISSION],
    );

    await expectPgError(
      client,
      "23514",
      `insert into audit_log
        (actor_type, actor_id, action, entity_type, entity_id, occurred_at, result,
         authority_source)
       values ('system', $1, 'auth.test', 'auth-event', $2, now(), 'rejected', 'caller')`,
      [USER_A, IDENTITY_A],
    );
    await expectPgError(
      client,
      "23514",
      `insert into audit_log
        (actor_type, actor_id, action, entity_type, entity_id, occurred_at, result,
         principal_reference_hash)
       values ('system', $1, 'auth.test', 'auth-event', $2, now(), 'rejected', 'raw-subject')`,
      [USER_A, IDENTITY_A],
    );
  } finally {
    await client.end();
  }
} finally {
  await harness.dropDatabase();
  const admin = new Client({ connectionString: harness.adminUrl });
  await admin.connect();
  try {
    const exists = await admin.query<{ exists: boolean }>(
      "select exists(select 1 from pg_database where datname = $1) as exists",
      [harness.dbName],
    );
    assert.equal(exists.rows[0]?.exists, false);
  } finally {
    await admin.end();
  }
}

console.log("Authentication schema migration checks passed; disposable database removed.");
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
