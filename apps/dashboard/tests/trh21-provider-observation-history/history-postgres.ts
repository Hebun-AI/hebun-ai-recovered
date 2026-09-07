/*
 * TRH-21 — PROVIDER OBSERVATION HISTORY against a REAL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "An authorized human-triggered observation becomes exactly one immutable row saying WHICH
 *    provider reported WHAT about WHICH subject, WHEN, through WHICH connection — a replay adds
 *    nothing, a later read adds another row even with identical values, one tenant can neither read
 *    nor file another tenant's observations, and no Knowledge, Work, Governance, permit or
 *    execution row exists afterwards."
 *
 * The PROVIDER is faked at the released observation seam: CGO-5's transport, key handling and
 * capability gate are accepted and would need a live key. Everything downstream is REAL — the real
 * mapper, the real writer, the real reader, the real constraints, and a real Postgres.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { recordYouTubeChannelObservation } from "../../src/features/provider-observation-history/record-youtube-channel-observation.server";
import { recordProviderObservation } from "../../src/features/provider-observation-history/write-provider-observation.server";
import { readProviderObservations } from "../../src/features/provider-observation-history/read-provider-observations.server";
import type { YouTubeChannelObservation } from "../../src/features/provider-youtube/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date("2026-09-07T15:00:00.000Z");

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
}

function contextFor(seeded: Seeded, requestId: string): TenantContext {
  return asHumanTenantContext({
    tenantId: seeded.tenantId,
    userId: seeded.userId,
    authIdentityId: seeded.authIdentityId,
    membershipId: seeded.membershipId,
    membershipVersion: 1,
    roleId: seeded.roleId,
    sessionContextId: "00000000-0000-4000-8000-000000000000",
    provider: "local",
    assuranceLevel: "aal1",
    mfaVerified: false,
    requestId,
    authenticatedAt: NOW.toISOString(),
  });
}

function observationAt(instant: string, viewCount: number | null): YouTubeChannelObservation {
  return Object.freeze({
    channel: Object.freeze({
      channelId: "UCfixture",
      title: "Turkish Rug House",
      handle: "@turkishrughouse",
      publishedAt: "2021-04-02T00:00:00.000Z",
      viewCount,
      subscriberCount: null,
      hiddenSubscriberCount: true,
      videoCount: 0,
    }),
    recentVideos: Object.freeze([]),
    moreVideosExist: false,
    observedAt: instant,
    quotaUnitsSpent: 2,
  }) as YouTubeChannelObservation;
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_trh21_history");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const dbDeps = { getDb: () => handle.db } as never;

  const countOf = async (table: string): Promise<number> =>
    (await setup.query<{ n: number }>(`select count(*)::int as n from ${table}`)).rows[0]!.n;

  try {
    /* ═══════════════════════════════════════════════════════════════════════
     * 0. TWO ORGANIZATIONS, EACH WITH ITS OWN CONNECTION.
     * ═════════════════════════════════════════════════════════════════════ */
    const trh = (await seedLocalIdentity(setup, {
      companyName: "Turkish Rug House",
      companySlug: "trh-trh21",
      email: "director@trh.test",
    })) as Seeded;
    const other = (await seedLocalIdentity(setup, {
      companyName: "Other Shop",
      companySlug: "other-trh21",
      email: "owner@other.test",
    })) as Seeded;
    const trhCtx = contextFor(trh, "trh21-trh");
    const otherCtx = contextFor(other, "trh21-other");

    const connectionFor = async (tenantId: string, userId: string): Promise<string> =>
      (
        await setup.query<{ id: string }>(
          `insert into integrations (tenant_id, provider_key, name, status, created_by, created_by_type)
           values ($1, 'youtube', 'YouTube', 'pending', $2, 'human') returning id`,
          [tenantId, userId],
        )
      ).rows[0]!.id;
    const trhConnection = await connectionFor(trh.tenantId, trh.userId);
    const otherConnection = await connectionFor(other.tenantId, other.userId);

    assert.equal(await countOf("provider_observations"), 0, "no history exists before anything is observed");

    /* ═══════════════════════════════════════════════════════════════════════
     * 1. ONE AUTHORIZED OBSERVATION BECOMES EXACTLY ONE ROW.
     * ═════════════════════════════════════════════════════════════════════ */
    const first = await recordYouTubeChannelObservation(trhCtx, "@TurkishRugHouse", {
      ...(dbDeps as object),
      observe: async () =>
        ({ ok: true, value: observationAt("2026-09-07T15:00:00.000Z", 0), integrationId: trhConnection }) as never,
    } as never);
    assert.equal(first.observation.ok, true);
    assert.equal(first.record?.status, "recorded", `the observation was recorded (${JSON.stringify(first.record)})`);
    assert.equal(await countOf("provider_observations"), 1);

    const row = (
      await setup.query<{
        tenantId: string;
        integrationId: string;
        providerKey: string;
        capabilityKey: string;
        subjectKind: string;
        subjectRef: string;
        observedAt: Date;
        recordedAt: Date;
        actorType: string;
        actorId: string;
        facts: Record<string, unknown>;
        digest: string;
      }>(
        `select tenant_id as "tenantId", integration_id as "integrationId", provider_key as "providerKey",
                capability_key as "capabilityKey", subject_kind as "subjectKind", subject_ref as "subjectRef",
                observed_at as "observedAt", recorded_at as "recordedAt",
                observed_by_actor_type as "actorType", observed_by_actor_id as "actorId",
                facts, facts_digest as "digest"
           from provider_observations limit 1`,
      )
    ).rows[0]!;

    assert.equal(row.tenantId, trh.tenantId, "filed under the authorized tenant");
    assert.equal(row.integrationId, trhConnection, "and against the connection the read reported");
    assert.equal(row.providerKey, "youtube");
    assert.equal(row.capabilityKey, "youtube.channel.public.read");
    assert.equal(row.subjectKind, "youtube-channel");
    assert.equal(row.subjectRef, "youtube/channel/UCfixture", "the PROVIDER's id, not the typed handle");
    assert.equal(row.observedAt.toISOString(), "2026-09-07T15:00:00.000Z", "Hebun's read instant, in UTC");
    assert.ok(row.recordedAt instanceof Date, "and a separate written-down time");
    assert.equal(row.actorType, "human", "a human caused it — the only principal that can");
    assert.equal(row.actorId, trh.userId);
    assert.equal(row.digest.length, 64);

    /* ZERO SURVIVED AS ZERO, AND NULL AS NULL, THROUGH JSONB. */
    assert.strictEqual(row.facts.viewCount, 0, "a reported zero is a zero in the column");
    assert.strictEqual(row.facts.subscriberCount, null, "a withheld count is null, never 0");
    assert.strictEqual(row.facts.hiddenSubscriberCount, true);
    assert.strictEqual(row.facts.videoCount, 0);
    assert.deepEqual(row.facts.recentVideos, []);

    /* NO PROVIDER PAYLOAD, NO SECRET, NO HANDLE A HUMAN TYPED. */
    const whole = JSON.stringify(row);
    for (const trace of ["@TurkishRugHouse", "AIza", "key=", "Authorization", "etag", "kind\":\"youtube#"]) {
      assert.equal(whole.includes(trace), false, `no row may carry "${trace}"`);
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 2. A REPLAY OF THE SAME OBSERVATION ADDS NOTHING.
     * ═════════════════════════════════════════════════════════════════════ */
    const replay = await recordYouTubeChannelObservation(trhCtx, "@TurkishRugHouse", {
      ...(dbDeps as object),
      observe: async () =>
        ({ ok: true, value: observationAt("2026-09-07T15:00:00.000Z", 0), integrationId: trhConnection }) as never,
    } as never);
    assert.equal(replay.record?.status, "already-recorded", "the idempotency contract answered");
    assert.equal(await countOf("provider_observations"), 1, "and no second sample was fabricated");

    /* ═══════════════════════════════════════════════════════════════════════
     * 3. A LATER REAL READ IS A NEW OBSERVATION — EVEN WITH IDENTICAL VALUES.
     *
     * This is the assertion that stops deduplication being about the numbers. "The count did not
     * change" is itself an observation, and collapsing it would erase the only evidence anyone
     * looked at that moment.
     * ═════════════════════════════════════════════════════════════════════ */
    const later = await recordYouTubeChannelObservation(trhCtx, "@TurkishRugHouse", {
      ...(dbDeps as object),
      observe: async () =>
        ({ ok: true, value: observationAt("2026-09-08T15:00:00.000Z", 0), integrationId: trhConnection }) as never,
    } as never);
    assert.equal(later.record?.status, "recorded", "a later instant is a new observation");
    assert.equal(await countOf("provider_observations"), 2);

    const digests = (
      await setup.query<{ digest: string }>(`select facts_digest as digest from provider_observations`)
    ).rows.map((r) => r.digest);
    assert.equal(digests[0], digests[1], "the facts really are identical — and both rows still exist");

    /* ═══════════════════════════════════════════════════════════════════════
     * 4. A DIFFERENT NUMBER IS A NEW OBSERVATION, NEVER A CORRECTION.
     * ═════════════════════════════════════════════════════════════════════ */
    await recordYouTubeChannelObservation(trhCtx, "@TurkishRugHouse", {
      ...(dbDeps as object),
      observe: async () =>
        ({ ok: true, value: observationAt("2026-09-09T15:00:00.000Z", 12), integrationId: trhConnection }) as never,
    } as never);
    assert.equal(await countOf("provider_observations"), 3, "three observations, none of them overwritten");
    const firstStill = (
      await setup.query<{ facts: Record<string, unknown> }>(
        `select facts from provider_observations where observed_at = '2026-09-07T15:00:00.000Z'`,
      )
    ).rows[0]!;
    assert.strictEqual(firstStill.facts.viewCount, 0, "the earliest row still says what it said");

    /* ═══════════════════════════════════════════════════════════════════════
     * 5. TENANT ISOLATION — AT THE SEAM AND AT REST.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      /* The other organization sees none of it. */
      const theirs = await readProviderObservations(otherCtx, {}, dbDeps);
      assert.equal(theirs.status, "read");
      assert.deepEqual(theirs.status === "read" ? theirs.observations : null, [], "a second tenant reads nothing");

      const ours = await readProviderObservations(trhCtx, {}, dbDeps);
      assert.equal(ours.status === "read" ? ours.observations.length : -1, 3);
      assert.equal(
        ours.status === "read" ? ours.observations[0]!.observedAt : "",
        "2026-09-09T15:00:00.000Z",
        "newest first",
      );

      /* No authorized context, no read and no write. */
      assert.deepEqual(await readProviderObservations(null, {}, dbDeps), {
        status: "unavailable",
        reason: "unauthenticated",
      });

      /* FILING AGAINST ANOTHER TENANT'S CONNECTION IS UNREPRESENTABLE AT REST. */
      const crossTenant = await recordProviderObservation(
        trhCtx,
        {
          providerKey: "youtube",
          capabilityKey: "youtube.channel.public.read",
          subjectKind: "youtube-channel",
          subjectRef: "youtube/channel/UCother",
          integrationId: otherConnection,
          observedAt: "2026-09-10T15:00:00.000Z",
          facts: { channelId: "UCother" },
        },
        dbDeps,
      );
      assert.deepEqual(
        crossTenant,
        { status: "refused", reason: "persistence-unavailable" },
        "the composite foreign key refuses another tenant's connection",
      );
      assert.equal(await countOf("provider_observations"), 3, "and nothing was written");

      /*
       * A CALLER-SUPPLIED TENANT IS NOT A TENANT. The record type has no such field, so reaching it
       * needs a cast — which is exactly what a future refactor would look like. The row must still
       * land under the AUTHORIZED context's tenant, because that is the only tenant the writer can
       * name.
       */
      const smuggled = await recordProviderObservation(
        trhCtx,
        {
          providerKey: "youtube",
          capabilityKey: "youtube.channel.public.read",
          subjectKind: "youtube-channel",
          subjectRef: "youtube/channel/UCsmuggled",
          integrationId: trhConnection,
          observedAt: "2026-09-11T15:00:00.000Z",
          facts: { channelId: "UCsmuggled" },
          tenantId: other.tenantId,
        } as never,
        dbDeps,
      );
      assert.equal(smuggled.status, "recorded", "the write itself is ordinary");
      const smuggledRow = (
        await setup.query<{ tenantId: string }>(
          `select tenant_id as "tenantId" from provider_observations where subject_ref = 'youtube/channel/UCsmuggled'`,
        )
      ).rows[0]!;
      assert.equal(
        smuggledRow.tenantId,
        trh.tenantId,
        "a tenant a caller put in the record is ignored — the authorized context decides",
      );
      const otherAfterSmuggle = await readProviderObservations(otherCtx, {}, dbDeps);
      assert.equal(otherAfterSmuggle.status, "read");
      assert.deepEqual(
        otherAfterSmuggle.status === "read" ? otherAfterSmuggle.observations : null,
        [],
        "and the other organization still sees nothing",
      );

      /* Even a hand-crafted INSERT cannot do it. */
      let rejected = false;
      try {
        await setup.query(
          `insert into provider_observations
             (tenant_id, integration_id, provider_key, capability_key, subject_kind, subject_ref,
              observed_at, observed_by_actor_type, observed_by_actor_id, facts, facts_digest)
           values ($1, $2, 'youtube', 'youtube.channel.public.read', 'youtube-channel',
                   'youtube/channel/UCx', now(), 'human', $3, '{}'::jsonb, repeat('0', 64))`,
          [trh.tenantId, otherConnection, trh.userId],
        );
      } catch {
        rejected = true;
      }
      assert.equal(rejected, true, "the database itself refuses a cross-tenant observation");
      assert.equal(await countOf("provider_observations"), 4, "three channel observations plus the smuggling probe");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 6. NOTHING ELSE MOVED. A MEMORY IS NOT A CLAIM.
     * ═════════════════════════════════════════════════════════════════════ */
    for (const table of [
      "knowledge_nodes",
      "knowledge_facts",
      "knowledge_external_references",
      "work_items",
      "work_artifacts",
      "work_evidence_references",
      "decision_records",
      "action_permits",
      "action_execution_attempts",
      "heby_action_requests",
      "heby_answer_source_evidence",
      "integration_credentials",
    ]) {
      assert.equal(await countOf(table), 0, `${table} is untouched by observing`);
    }

    console.log("PASS trh21-provider-observation-history history (postgres)");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase().catch(() => {});
  }
}

void main();
