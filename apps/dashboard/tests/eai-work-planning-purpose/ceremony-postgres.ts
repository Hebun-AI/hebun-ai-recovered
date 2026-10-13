/*
 * CONTROLLED AGENT REASONING · PHASE 6 / GATE A — the tenant ceremony's `--work-planning` and
 * `--revoke`, run END TO END as an operator would: the real CLI, on a pseudo-terminal, against a REAL
 * but DISPOSABLE PostgreSQL 18 database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *   "Through the released writer only, `--work-planning` adds exactly work-planning ×
 *    operational-record to what a tenant already authorized and to no other tenant; a person without
 *    a membership in the named organization, a second purpose switch, a revoke without a purpose, a
 *    withdrawn attestation and a typed phrase that does not match are refused and write nothing;
 *    each write files one Governance decision; `--revoke` removes work-planning and keeps every other
 *    purpose; `--withdraw` still removes everything; the composer follows each step."
 *
 * The pseudo-terminal is `script(1)`: the ceremony refuses a pipe by design, so this is the only
 * honest way to drive its confirmation. No production, no provider, no network, no credential.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";
import { readEffectiveTenantExternalAiDataUse } from "../../src/features/external-ai-data-use/read-tenant-external-ai-data-use.server";
import { readLatestProcessorAttestation } from "../../src/features/external-ai-data-use/read-processor-attestations.server";
import { composeExternalAiDisclosure } from "../../src/features/external-ai-data-use/compose-external-ai-disclosure";
import { RECORDED_PLATFORM_DISCLOSURE_POLICY } from "../../src/features/external-ai-data-use/platform-disclosure-policy";
import type { DataClass, Purpose } from "../../src/features/external-ai-data-use/contracts";
import { appendProcessorAttestation, parseAttestationRecord, readLineageHead } from "../../scripts/lib/processor-attestation";

const ROOT = path.resolve(__dirname, "../..");
const CEREMONY = "scripts/eai-authorize-tenant-external-ai-data-use.ts";
const REVIEWED_RECORD = "docs/product-vision/runtime/hebun-external-ai-data-use-b1b-anthropic-processor-attestation-record.md";
const REVIEWED_RECORD_REF = `${REVIEWED_RECORD}@dbbe8a30bbaa2d6d396cb914a21e28735537fe33`;
const MODEL = "claude-haiku-4-5-20251001";

/** Run the real ceremony on a pseudo-terminal; type `phrase` when it asks. */
function ceremony(dbUrl: string, args: readonly string[], phrase?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    /* Node's stdio is a socket on macOS and script(1) needs a pipe it can read: `cat |` provides one. */
    const child = spawn("/bin/sh", ["-c", 'cat | script -q /dev/null "$@"', "sh", process.execPath, "--import", "tsx", CEREMONY, ...args], {
      cwd: ROOT,
      env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", NODE_ENV: "test", DATABASE_URL: dbUrl },
    });
    let out = "";
    let typed = false;
    const timer = setTimeout(() => (child.kill("SIGKILL"), reject(new Error(`ceremony timed out:\n${out}`))), 120_000);
    if (phrase === undefined) child.stdin.end();
    child.stdout.on("data", (chunk: Buffer) => {
      out += chunk.toString();
      if (!typed && /to proceed: /.test(out)) {
        typed = true;
        child.stdin.end(`${phrase ?? "NOT THE PHRASE"}\r`);
      }
      /* Refused before the prompt: nothing will be typed, so let the pipe close. */
      if (!typed && /✖/.test(out)) child.stdin.end();
    });
    child.on("close", () => (clearTimeout(timer), resolve(out.replace(/\r/g, "").replace(/\x1b\[[0-9;]*[A-Za-z]/g, ""))));
  });
}

async function main(): Promise<void> {
  const parsed = parseAttestationRecord(readFileSync(path.resolve(ROOT, "../..", REVIEWED_RECORD), "utf8"));
  if (parsed.status !== "parsed") throw new Error(`the reviewed record did not parse: ${parsed.reason}`);
  const RECORD = parsed.record;

  const harness = createDisposablePostgresHarness("eai_wp_ceremony");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db };
  const n = async (sql: string, params: unknown[] = []) => (await setup.query(sql, params)).rows[0].n as number;
  const writes = () => n(`select (select count(*) from tenant_ai_data_use_authorizations) + (select count(*) from tenant_ai_data_use_scopes) + (select count(*) from governance_sessions where governance_domain = 'external-ai-data-use') as n`);

  try {
    /* ── Fixture: the reviewed attestation, and two Governance organizations. ── */
    assert.equal((await appendProcessorAttestation(setup, { verb: "admit", record: RECORD, reviewedRecordRef: REVIEWED_RECORD_REF, controlSource: "local-operator-ceremony", expectedHead: null })).status, "appended");
    const a = await seedLocalIdentity(setup, { companyName: "Tenant A", companySlug: "tenant-a-wp", email: "a@wp.test", roleType: "owner" });
    const b = await seedLocalIdentity(setup, { companyName: "Tenant B", companySlug: "tenant-b-wp", email: "b@wp.test", roleType: "owner" });
    for (const [seeded, tag] of [[a, "aaaa1"], [b, "bbbb2"]] as const) {
      const session = await setup.query<{ id: string }>(
        `insert into user_session_contexts (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version, user_id, active_tenant_id, active_membership_id, membership_version, assurance_level, mfa_verified, authenticated_at, issued_at, last_activity_at, absolute_expires_at, inactivity_expires_at)
         values ($1, $2, 1, $3, $4, $5, 1, 'aal1', false, now(), now(), now(), now() + interval '1 day', now() + interval '1 hour') returning id`,
        [seeded.authIdentityId, tag.padEnd(64, "a"), seeded.userId, seeded.tenantId, seeded.membershipId],
      );
      await setup.query(
        `insert into genesis_nominations (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source, accepted_at, accepted_session_context_id, accepted_assurance_level)
         values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
        [seeded.tenantId, seeded.authIdentityId, seeded.userId, session.rows[0]!.id],
      );
      const tenant = asHumanTenantContext({ tenantId: seeded.tenantId, userId: seeded.userId, authIdentityId: seeded.authIdentityId, membershipId: seeded.membershipId, membershipVersion: 1, roleId: seeded.roleId, sessionContextId: session.rows[0]!.id, provider: "local", assuranceLevel: "aal1", mfaVerified: false, requestId: `wp-${tag}`, authenticatedAt: new Date().toISOString() });
      assert.equal((await establishGovernanceAuthority(tenant, { justification: `Establishing ${tag}'s Governance authority for this test fixture.` }, deps)).status, "established");
    }
    const A = ["--tenant=tenant-a-wp", "--director=a@wp.test"];
    const scopesOf = async (tenantId: string) => {
      const e = await readEffectiveTenantExternalAiDataUse(tenantId, "anthropic/messages", RECORD.accountRef, deps);
      return e.status === "read" ? e.effective.scopes.map((s) => `${s.purpose}×${s.dataClass}`) : e.status;
    };
    const decide = async (tenantId: string, purpose: Purpose, dataClass: DataClass) =>
      composeExternalAiDisclosure({
        request: { serviceScope: "anthropic/messages", purpose, requiredDataClasses: [dataClass], modelId: MODEL },
        policy: RECORDED_PLATFORM_DISCLOSURE_POLICY,
        accountRef: RECORD.accountRef,
        attestation: await readLatestProcessorAttestation("anthropic/messages", RECORD.accountRef, deps),
        tenant: await readEffectiveTenantExternalAiDataUse(tenantId, "anthropic/messages", RECORD.accountRef, deps),
        operatorEnabled: true,
        providerAvailable: true,
      }).disposition;

    /* ── 1. Tenant A authorizes what Hebun holds today: assistance, then origination. ── */
    assert.match(await ceremony(harness.dbUrl, [...A, "--confirm"], "AUTHORIZE EXTERNAL AI DATA USE"), /✔ revision 1 \(active\)/);
    assert.match(await ceremony(harness.dbUrl, [...A, "--agent-origination", "--confirm"], "AUTHORIZE EXTERNAL AI DATA USE"), /✔ revision 2 \(active\)/);
    const before = await scopesOf(a.tenantId);
    assert.equal(before.length, 6);
    assert.equal(await decide(a.tenantId, "work-planning", "operational-record"), "tenant-not-authorized", "no work-planning before the ceremony");

    /* ── 2. Refusals that write nothing. ── */
    const w0 = await writes();
    for (const [label, args, phrase, expected] of [
      ["wrong organization", ["--tenant=tenant-b-wp", "--director=a@wp.test", "--work-planning", "--confirm"], "AUTHORIZE EXTERNAL AI DATA USE", /no active membership for a@wp\.test in organization "tenant-b-wp"/],
      ["unknown person", ["--tenant=tenant-a-wp", "--director=nobody@wp.test", "--work-planning", "--confirm"], "AUTHORIZE EXTERNAL AI DATA USE", /no active membership/],
      ["two purpose switches", [...A, "--work-planning", "--agent-origination", "--confirm"], "AUTHORIZE EXTERNAL AI DATA USE", /one purpose per ceremony/],
      ["withdraw with a purpose", [...A, "--work-planning", "--withdraw", "--confirm"], "WITHDRAW EXTERNAL AI DATA USE", /--withdraw withdraws every scope/],
      ["revoke without a purpose", [...A, "--revoke", "--confirm"], "REVOKE EXTERNAL AI DATA USE", /--revoke names the purpose it removes/],
      ["revoke what is not in force", [...A, "--work-planning", "--revoke", "--confirm"], "REVOKE EXTERNAL AI DATA USE", /work-planning is not authorized in force/],
      ["a value smuggled as a flag", [...A, "--purpose=work-planning"], undefined, /unknown argument "--purpose=work-planning"/],
      ["the wrong phrase", [...A, "--work-planning", "--confirm"], "AUTHORIZE", /not confirmed — nothing was written/],
    ] as const) {
      assert.match(await ceremony(harness.dbUrl, args, phrase), expected, label);
    }
    assert.equal(await writes(), w0, "every refusal wrote nothing");

    /* ── 3. Dry run shows exactly the pair it would add and keeps the rest. ── */
    const dry = await ceremony(harness.dbUrl, [...A, "--work-planning"]);
    assert.match(dry, /added work-planning × operational-record\s+platform ALLOWED · attestation inside bounds/);
    assert.equal((dry.match(/ kept  /g) ?? []).length, 6, "the six pairs in force are kept");
    assert.match(dry, /DRY RUN — nothing was written/);
    assert.equal(await writes(), w0);

    /* ── 4. The grant: one revision, one Governance decision, exactly one new pair, A only. ── */
    const sessions0 = await n(`select count(*)::int n from governance_sessions where governance_domain = 'external-ai-data-use'`);
    assert.match(await ceremony(harness.dbUrl, [...A, "--work-planning", "--confirm"], "AUTHORIZE EXTERNAL AI DATA USE"), /✔ revision 3 \(active\)[\s\S]*No provider was called\./);
    assert.deepEqual((await scopesOf(a.tenantId) as string[]).sort(), [...before, "work-planning×operational-record"].sort());
    assert.equal(await n(`select count(*)::int n from governance_sessions where governance_domain = 'external-ai-data-use'`), sessions0 + 1, "one Governance decision");
    assert.equal(await n(`select count(*)::int n from tenant_ai_data_use_authorizations where governance_decision_id is null`), 0, "every revision names its decision");
    assert.equal(await n(`select count(*)::int n from tenant_ai_data_use_scopes where purpose = 'work-planning' and tenant_id <> $1`, [a.tenantId]), 0, "no other tenant holds it");
    assert.equal(await scopesOf(b.tenantId), "absent", "B is untouched");
    assert.equal(await decide(a.tenantId, "work-planning", "operational-record"), "authorized");
    assert.equal(await decide(b.tenantId, "work-planning", "operational-record"), "tenant-not-authorized");
    assert.equal(await decide(a.tenantId, "assistance", "conversation"), "authorized", "assistance unchanged");
    assert.equal(await decide(a.tenantId, "assistance", "operational-record"), "platform-unknown", "assistance × operational-record still refused");
    assert.match(await ceremony(harness.dbUrl, [...A, "--work-planning", "--confirm"], "AUTHORIZE EXTERNAL AI DATA USE"), /work-planning is already authorized in revision 3/);

    /* ── 5. Revocation of work-planning keeps every other purpose. ── */
    assert.match(await ceremony(harness.dbUrl, [...A, "--work-planning", "--revoke", "--confirm"], "REVOKE EXTERNAL AI DATA USE"), /removed work-planning × operational-record[\s\S]*✔ revision 4 \(active\)/);
    assert.deepEqual(await scopesOf(a.tenantId), before, "exactly the scopes in force before the grant, in order");
    assert.equal(await decide(a.tenantId, "work-planning", "operational-record"), "tenant-not-authorized");
    assert.equal(await decide(a.tenantId, "agent-origination", "organization"), "authorized");

    /* ── 6. --withdraw still removes everything, work-planning included. ── */
    assert.match(await ceremony(harness.dbUrl, [...A, "--work-planning", "--confirm"], "AUTHORIZE EXTERNAL AI DATA USE"), /✔ revision 5 \(active\)/);
    assert.match(await ceremony(harness.dbUrl, [...A, "--withdraw", "--confirm"], "WITHDRAW EXTERNAL AI DATA USE"), /✔ revision 6 \(withdrawn\)/);
    assert.equal(await decide(a.tenantId, "work-planning", "operational-record"), "tenant-withdrawn");
    assert.equal(await decide(a.tenantId, "assistance", "conversation"), "tenant-withdrawn");

    /* ── 7. A withdrawn attestation refuses the grant before anything is written. ── */
    assert.match(await ceremony(harness.dbUrl, [...A, "--work-planning", "--confirm"], "AUTHORIZE EXTERNAL AI DATA USE"), /✔ revision 7 \(active\)/);
    assert.deepEqual(await scopesOf(a.tenantId), ["work-planning×operational-record"], "after a withdrawal nothing is carried forward");
    const head = await readLineageHead(setup, "anthropic/messages", RECORD.accountRef);
    assert.equal((await appendProcessorAttestation(setup, { verb: "withdraw", record: RECORD, reviewedRecordRef: REVIEWED_RECORD_REF, controlSource: "local-operator-ceremony", expectedHead: head })).status, "appended");
    assert.equal(await decide(a.tenantId, "work-planning", "operational-record"), "platform-unknown", "a withdrawn attestation stops the disclosure");
    const w1 = await writes();
    assert.match(await ceremony(harness.dbUrl, [...A, "--work-planning", "--revoke", "--confirm"], "REVOKE EXTERNAL AI DATA USE"), /attestation in force is withdrawn\. Nothing was changed\./);
    assert.equal(await writes(), w1);

    console.log("PASS eai-work-planning-purpose ceremony-postgres");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose?.().catch?.(() => {});
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
