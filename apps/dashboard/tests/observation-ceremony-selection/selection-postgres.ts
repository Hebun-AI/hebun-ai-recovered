/*
 * OBSERVATION CEREMONIES · the two reads the selection seam performs, against real Postgres.
 *
 * The pure half is covered by `scope-and-subject.ts`. This is the half that touches tables: finding
 * a tenant's sole connection, and taking a subject from stored history. Both are READS, and both
 * must be tenant-scoped — a ceremony that could see another organization's connection would be a
 * far worse defect than the one that made it provider-blind.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import {
  readSoleConnection,
  subjectFromConnection,
  subjectFromLatestObservation,
} from "../../scripts/lib/observable-scope";
import {
  INSTAGRAM_ACCOUNT_PUBLIC_READ_CAPABILITY,
  INSTAGRAM_ACCOUNT_SUBJECT_KIND,
  INSTAGRAM_PROVIDER_KEY,
  INSTAGRAM_SUBJECT_PREFIX,
} from "../../src/features/provider-instagram/contracts";
import {
  YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY,
  YOUTUBE_PROVIDER_KEY,
} from "../../src/features/provider-youtube/contracts";

const OURS = "28290000000000000";
const THEIRS = "17840000000000000";

async function connectionFor(
  c: Client,
  tenantId: string,
  userId: string,
  provider: string,
  state: string,
  health: string,
  account: string | null,
): Promise<string> {
  const r = await c.query<{ id: string }>(
    `insert into integrations (tenant_id, provider_key, name, status, connection_state, health,
                               scopes, external_account_id, created_by, created_by_type)
     values ($1,$2,$3,'connected',$4,$5,'[]'::jsonb,$6,$7,'human') returning id`,
    [tenantId, provider, provider, state, health, account, userId],
  );
  return r.rows[0]!.id;
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_ceremony_selection");
  await harness.createDatabase();
  harness.migrateDatabase();

  const c = new Client({ connectionString: harness.dbUrl });
  await c.connect();
  try {
    const us = await seedLocalIdentity(c, {
      companyName: "Turkish Rug House", companySlug: "trh-sel", email: "director@trh.test", roleType: "owner",
    });
    const them = await seedLocalIdentity(c, {
      companyName: "Someone Else", companySlug: "else-sel", email: "other@else.test", roleType: "owner",
    });

    /* ═══ 1. NO CONNECTION → FAIL CLOSED ══════════════════════════════════ */
    const none = await readSoleConnection(c, us.tenantId, INSTAGRAM_PROVIDER_KEY);
    assert.ok(!none.ok && none.reason.includes(`no ${INSTAGRAM_PROVIDER_KEY} connection`),
      "a tenant with no Instagram connection authorizes nothing");

    /* ═══ 2. THE HAPPY SHAPE ═════════════════════════════════════════════ */
    const ours = await connectionFor(c, us.tenantId, us.userId, INSTAGRAM_PROVIDER_KEY, "connected", "healthy", OURS);
    const sole = await readSoleConnection(c, us.tenantId, INSTAGRAM_PROVIDER_KEY);
    assert.ok(sole.ok, "one connection resolves");
    assert.equal(sole.ok && sole.connection.id, ours);
    const subject = sole.ok ? subjectFromConnection(INSTAGRAM_ACCOUNT_SUBJECT_KIND, sole.connection) : null;
    assert.ok(subject?.ok, "and yields the canonical subject");
    assert.equal(subject?.ok && subject.subjectRef, `${INSTAGRAM_SUBJECT_PREFIX}${OURS}`);

    /* ═══ 3. TENANT ISOLATION ════════════════════════════════════════════ */
    await connectionFor(c, them.tenantId, them.userId, INSTAGRAM_PROVIDER_KEY, "connected", "healthy", THEIRS);
    const stillOurs = await readSoleConnection(c, us.tenantId, INSTAGRAM_PROVIDER_KEY);
    assert.ok(stillOurs.ok && stillOurs.connection.external_account_id === OURS,
      "another organization's connection is invisible — the read is tenant-scoped");
    const theirs = await readSoleConnection(c, them.tenantId, INSTAGRAM_PROVIDER_KEY);
    assert.ok(theirs.ok && theirs.connection.external_account_id === THEIRS,
      "and each tenant sees its own");

    /* ═══ 4. TWO CONNECTIONS → THE CEREMONY WILL NOT CHOOSE ══════════════ */
    await connectionFor(c, us.tenantId, us.userId, INSTAGRAM_PROVIDER_KEY, "connected", "healthy", "28291111111111111");
    const ambiguous = await readSoleConnection(c, us.tenantId, INSTAGRAM_PROVIDER_KEY);
    assert.ok(!ambiguous.ok && ambiguous.reason.includes("will not choose between them"),
      "two connections is a refusal, never a first match");

    /* A soft-deleted connection is not a second one. */
    await c.query(`update integrations set deleted_at = now() where tenant_id = $1 and external_account_id = $2`,
      [us.tenantId, "28291111111111111"]);
    const afterDelete = await readSoleConnection(c, us.tenantId, INSTAGRAM_PROVIDER_KEY);
    assert.ok(afterDelete.ok && afterDelete.connection.id === ours, "a deleted connection is not counted");

    /* ═══ 5. THE OBSERVATION-SOURCED SUBJECT (YOUTUBE'S SEMANTICS) ═══════ */
    const scope = {
      providerKey: YOUTUBE_PROVIDER_KEY,
      capabilityKey: YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY,
      subjectKind: "youtube-channel",
    } as const;
    const nothingYet = await subjectFromLatestObservation(c, us.tenantId, scope);
    assert.ok(!nothingYet.ok && nothingYet.reason.includes("no stored provider observation"),
      "with no stored observation, YouTube authorizes nothing — unchanged");

    const ytConn = await connectionFor(c, us.tenantId, us.userId, YOUTUBE_PROVIDER_KEY, "connected", "healthy", null);
    for (const [ref, at] of [["youtube/channel/UC_OLD", "2026-09-01T00:00:00Z"],
                             ["youtube/channel/UC_NEW", "2026-09-02T00:00:00Z"]] as const) {
      await c.query(
        `insert into provider_observations (tenant_id, integration_id, provider_key, capability_key,
             subject_kind, subject_ref, observed_at, observed_by_actor_type, observed_by_actor_id,
             facts, facts_digest)
         values ($1,$2,$3,$4,'youtube-channel',$5,$6,'human',$7,'{}'::jsonb,$8)`,
        [us.tenantId, ytConn, YOUTUBE_PROVIDER_KEY, YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY, ref, at, us.userId, ref],
      );
    }
    const latest = await subjectFromLatestObservation(c, us.tenantId, scope);
    assert.ok(latest.ok, "with history, a subject resolves");
    assert.equal(latest.ok && latest.subjectRef, "youtube/channel/UC_NEW", "and it is the MOST RECENT one");

    /* And it is tenant-scoped too. */
    const theirHistory = await subjectFromLatestObservation(c, them.tenantId, scope);
    assert.ok(!theirHistory.ok, "another organization's history is invisible");

    console.log(
      "observation-ceremony-selection/selection-postgres: sole connection or refusal, tenant-scoped " +
        "both ways, soft-deleted excluded, latest observation wins, YouTube semantics unchanged",
    );
  } finally {
    await c.end();
    await harness.dropDatabase();
  }
}

void main();
