/*
 * MEDIA-5 — reference-guided generation against a REAL PostgreSQL.
 *
 * THE CLAIM UNDER TEST:
 *
 *   "An admitted image of THIS tenant can be the input to a new generation. Its bytes are read
 *    privately and proven against its own row before anything is sent. The attempt records which
 *    asset it used. The source image is not touched — not its bytes, not its row, not its lifecycle,
 *    not its review. A retired image is refused; an approved, declined or unreviewed one is not.
 *    Another tenant's image is indistinguishable from no image. One request key still buys exactly
 *    one paid dispatch."
 *
 * The migration is applied by the harness, so a failure here is also a migration failure.
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { requestMediaGeneration } from "../../src/features/media-assets/request-media-generation.server";
import { retireMediaAsset } from "../../src/features/media-assets/retire-media-asset.server";
import { declineMediaAsset, acceptMediaAsset } from "../../src/features/media-asset-review/review-media-asset.server";
import { digestMediaGenerationInput } from "../../src/features/media-assets/input-digest";
import type { MediaStorageResolution } from "../../src/features/media-assets/media-object-store";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";
import {
  createFakeMediaGenerationTransport,
  createMemoryMediaObjectStore,
  pngBytes,
} from "../helpers/media-fakes";

const NOW = new Date("2026-09-18T09:00:00.000Z");
const PROMPT = "A hand-knotted kilim on the loom, morning light, no text.";
const EDIT = "Keep the loom and the weave, change the background to plain linen.";
const REASON = "Governance has looked at these exact image bytes and records its decision here.";
const sha = (b: Uint8Array): string => createHash("sha256").update(b).digest("hex");

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
}

function contextFor(seeded: Seeded, sessionContextId: string): TenantContext {
  return asHumanTenantContext({
    tenantId: seeded.tenantId,
    userId: seeded.userId,
    authIdentityId: seeded.authIdentityId,
    membershipId: seeded.membershipId,
    membershipVersion: 1,
    roleId: seeded.roleId,
    sessionContextId,
    provider: "local",
    assuranceLevel: "aal1",
    mfaVerified: false,
    requestId: "media5-request",
    authenticatedAt: NOW.toISOString(),
  });
}

async function sessionRowFor(client: Client, seeded: Seeded, tag: string): Promise<string> {
  const row = await client.query<{ id: string }>(
    `insert into user_session_contexts
       (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
        user_id, active_tenant_id, active_membership_id, membership_version, assurance_level,
        mfa_verified, authenticated_at, issued_at, last_activity_at, absolute_expires_at,
        inactivity_expires_at)
     values ($1, $2, 1, $3, $4, $5, 1, 'aal1', false, now(), now(), now(),
             now() + interval '1 day', now() + interval '1 hour')
     returning id`,
    [seeded.authIdentityId, tag.padEnd(64, "a").slice(0, 64), seeded.userId, seeded.tenantId, seeded.membershipId],
  );
  return row.rows[0]!.id;
}

async function establishGovernance(client: Client, seeded: Seeded, ctx: TenantContext, deps: unknown): Promise<void> {
  await client.query(
    `insert into genesis_nominations
       (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
        accepted_at, accepted_session_context_id, accepted_assurance_level)
     values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
    [seeded.tenantId, seeded.authIdentityId, seeded.userId, ctx.sessionContextId],
  );
  const result = await establishGovernanceAuthority(
    ctx,
    { justification: "Establishing Governance authority so admitted images can be reviewed." },
    deps as never,
  );
  assert.equal(result.status, "established");
}

async function seedDraft(client: Client, tenantId: string, authorId: string): Promise<string> {
  const content = `Draft copy ${randomUUID()}`;
  const artifact = await client.query<{ id: string }>(
    `insert into work_artifacts
       (tenant_id, artifact_type, title, artifact_lifecycle_status, owner_workspace,
        current_revision, intended_destination, created_by, created_by_type)
     values ($1,'content-draft','Draft','draft','operations',1,'instagram',$2,'human') returning id`,
    [tenantId, authorId],
  );
  await client.query(
    `insert into work_artifact_revisions
       (tenant_id, artifact_id, revision_no, content, content_digest, authored_by_actor_type, authored_by_actor_id)
     values ($1,$2,1,$3,$4,'human',$5)`,
    [tenantId, artifact.rows[0]!.id, content, sha(new TextEncoder().encode(content)), authorId],
  );
  return artifact.rows[0]!.id;
}

async function count(client: Client, table: string, where = "true", params: unknown[] = []): Promise<number> {
  const r = await client.query<{ n: string }>(`select count(*)::text as n from ${table} where ${where}`, params);
  return Number(r.rows[0]!.n);
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_media5_reference");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const getDb = () => handle.db;

  try {
    harness.migrateDatabase();
    await setup.connect();

    const alice = (await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme-media5",
      email: "alice@acme.test",
    })) as Seeded;
    const aliceCtx = contextFor(alice, await sessionRowFor(setup, alice, "a1"));
    await establishGovernance(setup, alice, aliceCtx, { getDb, now: () => NOW });
    await createDurableAgentIdentity(aliceCtx, { name: "Heby" }, { getDb } as never);

    const erin = (await seedLocalIdentity(setup, {
      companyName: "Globex",
      companySlug: "globex-media5",
      email: "erin@globex.test",
    })) as Seeded;
    const erinCtx = contextFor(erin, await sessionRowFor(setup, erin, "e1"));
    await establishGovernance(setup, erin, erinCtx, { getDb, now: () => NOW });
    await createDurableAgentIdentity(erinCtx, { name: "Heby" }, { getDb } as never);

    const draft = await seedDraft(setup, alice.tenantId, alice.userId);
    const foreignDraft = await seedDraft(setup, erin.tenantId, erin.userId);

    const store = createMemoryMediaObjectStore();
    const connected = (): MediaStorageResolution => ({ status: "available", store });
    const outputBytes = pngBytes(1080, 1080, 64);
    const transport = createFakeMediaGenerationTransport({ kind: "bytes", bytes: outputBytes });
    const deps = (overrides: Record<string, unknown> = {}) => ({
      getDb,
      now: () => NOW,
      resolveStorage: connected,
      resolveTransport: () => ({ status: "available" as const, transport }),
      ...overrides,
    });

    /* ── 0. A TEXT-TO-IMAGE ASSET TO REFERENCE, AND ITS ROW STAYS NULL ──────── */
    const seedAsset = await requestMediaGeneration(
      aliceCtx,
      { artifactId: draft, revisionNo: 1, promptText: PROMPT, requestKey: randomUUID() },
      deps(),
    );
    assert.equal(seedAsset.status, "admitted");
    const assetA = seedAsset.status === "admitted" ? seedAsset.assetId : "";
    assert.equal(
      await count(setup, "media_generation_invocations", "source_media_asset_id is null"),
      1,
      "a released text-to-image invocation carries NULL lineage",
    );

    const assetARow = async () =>
      (
        await setup.query<{ digest: string; size: number; lifecycle: string; updated: string | null }>(
          `select byte_digest as digest, byte_size as size, asset_lifecycle_status as lifecycle, retired_at::text as updated
             from media_assets where id = $1`,
          [assetA],
        )
      ).rows[0]!;
    const before = await assetARow();

    /* ── 1. A REFERENCE EDIT: BYTES READ PRIVATELY, LINEAGE RECORDED ────────── */
    const gets = store.gets.length;
    const grants = store.readGrants.length;
    const referenced = await requestMediaGeneration(
      aliceCtx,
      { artifactId: draft, revisionNo: 1, promptText: EDIT, requestKey: randomUUID(), sourceAssetId: assetA },
      deps(),
    );
    assert.equal(referenced.status, "admitted", "a reference edit admits a new asset");
    const assetB = referenced.status === "admitted" ? referenced.assetId : "";
    assert.notEqual(assetB, assetA, "the output is a NEW asset, never the input");

    assert.equal(store.gets.length, gets + 1, "the source bytes were read once, server-side");
    assert.equal(store.readGrants.length, grants, "and no read grant was minted for anyone");

    const call = transport.calls.at(-1)!;
    assert.equal(call.request.mode, "reference-edit", "the transport was asked for a reference edit");
    assert.deepEqual(
      call.request.mode === "reference-edit" ? Array.from(call.request.referenceImage.bytes) : [],
      Array.from(store.objects.get(`tenants/${alice.tenantId}/media/${assetA}`)!.bytes),
      "and it received exactly the admitted bytes",
    );

    const lineage = await setup.query<{ src: string | null; digest: string }>(
      `select i.source_media_asset_id as src, i.input_digest as digest
         from media_generation_invocations i join media_assets a on a.invocation_id = i.id
        where a.id = $1`,
      [assetB],
    );
    assert.equal(lineage.rows[0]!.src, assetA, "the invocation records the asset it used");

    /* The recorded digest is canonical v2 over the exact pair — recomputable from the row. */
    assert.equal(
      lineage.rows[0]!.digest,
      digestMediaGenerationInput({
        promptText: EDIT,
        sourceArtifactId: draft,
        sourceRevisionNo: 1,
        sourceContentDigest: (
          await setup.query<{ d: string }>(`select content_digest as d from work_artifact_revisions where artifact_id=$1 and revision_no=1`, [draft])
        ).rows[0]!.d,
        transport: transport.transport,
        provider: transport.provider,
        model: transport.model,
        sourceAsset: { assetId: assetA, byteDigest: before.digest },
      }),
      "the stored evidence is canonical v2 over this draft revision AND this source asset",
    );

    /* ── 2. ASSET A IS UNTOUCHED, BYTE FOR BYTE AND ROW FOR ROW ─────────────── */
    assert.deepEqual(await assetARow(), before, "the source asset row did not change at all");
    assert.equal(
      sha(store.objects.get(`tenants/${alice.tenantId}/media/${assetA}`)!.bytes),
      before.digest,
      "the source bytes in storage are byte-for-byte what they were",
    );
    assert.equal(
      await count(setup, "media_assets", "id = $1 and asset_lifecycle_status = 'admitted'", [assetA]),
      1,
      "and it is still admitted",
    );

    /* The NEW asset arrives unreviewed. No approval is inherited, invented or implied. */
    assert.equal(
      await count(setup, "decision_records", "subject_type = 'media_asset' and subject_id = $1", [assetB]),
      0,
      "the generated asset carries no Governance decision",
    );

    /* ── 3. GOVERNANCE STATE NEVER GATES ELIGIBILITY ────────────────────────── */
    const declined = await declineMediaAsset(
      aliceCtx,
      { assetId: assetA, byteDigest: before.digest, justification: REASON },
      { getDb, now: () => NOW } as never,
    );
    assert.equal(declined.status, "reviewed", "Asset A is now DECLINED");
    const afterDecline = await requestMediaGeneration(
      aliceCtx,
      { artifactId: draft, revisionNo: 1, promptText: EDIT, requestKey: randomUUID(), sourceAssetId: assetA },
      deps(),
    );
    assert.equal(afterDecline.status, "admitted", "a DECLINED image may still be a creative reference");

    const accepted = await acceptMediaAsset(
      aliceCtx,
      { assetId: assetA, byteDigest: before.digest, justification: REASON },
      { getDb, now: () => NOW } as never,
    );
    assert.equal(accepted.status, "reviewed");
    const afterAccept = await requestMediaGeneration(
      aliceCtx,
      { artifactId: draft, revisionNo: 1, promptText: EDIT, requestKey: randomUUID(), sourceAssetId: assetA },
      deps(),
    );
    assert.equal(afterAccept.status, "admitted", "and an APPROVED image is not treated differently");

    /* ── 4. PREFLIGHT REFUSALS: NOTHING WRITTEN, NOTHING DISPATCHED ─────────── */
    const refusedInPreflight = async (label: string, input: Record<string, unknown>, reason: string, dep = deps()) => {
      const [calls, inv, ast, puts] = [
        transport.calls.length,
        await count(setup, "media_generation_invocations"),
        await count(setup, "media_assets"),
        store.puts.length,
      ];
      const result = (await requestMediaGeneration(aliceCtx, input as never, dep)) as { status: string; reason?: string };
      assert.deepEqual(result, { status: "refused", reason }, label);
      assert.equal(transport.calls.length, calls, `${label}: the transport was not called`);
      assert.equal(await count(setup, "media_generation_invocations"), inv, `${label}: no invocation was written`);
      assert.equal(await count(setup, "media_assets"), ast, `${label}: no asset was written`);
      assert.equal(store.puts.length, puts, `${label}: storage was not written`);
    };

    const base = { artifactId: draft, revisionNo: 1, promptText: EDIT };

    /* Another tenant's asset is indistinguishable from one that never existed. */
    const erinDraftAsset = await requestMediaGeneration(
      erinCtx,
      { artifactId: foreignDraft, revisionNo: 1, promptText: PROMPT, requestKey: randomUUID() },
      deps(),
    );
    assert.equal(erinDraftAsset.status, "admitted");
    const foreignAsset = erinDraftAsset.status === "admitted" ? erinDraftAsset.assetId : "";
    await refusedInPreflight(
      "another tenant's asset",
      { ...base, requestKey: randomUUID(), sourceAssetId: foreignAsset },
      "source-asset-unresolvable",
    );
    await refusedInPreflight(
      "an asset that never existed",
      { ...base, requestKey: randomUUID(), sourceAssetId: randomUUID() },
      "source-asset-unresolvable",
    );
    await refusedInPreflight(
      "not an asset id at all",
      { ...base, requestKey: randomUUID(), sourceAssetId: "not-a-uuid" },
      "invalid-input",
    );

    /* A transport that cannot edit refuses BEFORE a row exists. */
    const textOnly = createFakeMediaGenerationTransport({ kind: "bytes", bytes: outputBytes }, ["text-to-image"]);
    await refusedInPreflight(
      "a transport that does not edit",
      { ...base, requestKey: randomUUID(), sourceAssetId: assetA },
      "reference-edit-unsupported",
      deps({ resolveTransport: () => ({ status: "available" as const, transport: textOnly }) }),
    );
    assert.equal(textOnly.calls.length, 0, "and it was never called");

    /* Bytes that no longer match the admitted digest stop the request cold. */
    store.corruptNextGet = true;
    await refusedInPreflight(
      "stored bytes that no longer match the admitted digest",
      { ...base, requestKey: randomUUID(), sourceAssetId: assetA },
      "source-asset-unavailable",
    );

    /* ── 5. A RETIRED SOURCE IS REFUSED; A RETIRED ASSET IS NOT DELETED ─────── */
    const retired = await retireMediaAsset(aliceCtx, { assetId: assetA }, { getDb, now: () => NOW } as never);
    assert.equal(retired.status, "retired");
    await refusedInPreflight(
      "a retired source asset",
      { ...base, requestKey: randomUUID(), sourceAssetId: assetA },
      "source-asset-retired",
    );
    /* Lineage already recorded survives retirement — history is not rewritten. */
    assert.equal(
      await count(setup, "media_generation_invocations", "source_media_asset_id = $1", [assetA]),
      3,
      "the three earlier reference edits still name the now-retired asset",
    );

    /* ── 6. ONE REQUEST KEY IS ONE PAID DISPATCH ────────────────────────────── */
    const key = randomUUID();
    const first = await requestMediaGeneration(
      aliceCtx,
      { artifactId: draft, revisionNo: 1, promptText: PROMPT, requestKey: key },
      deps(),
    );
    assert.equal(first.status, "admitted");
    const callsAfterFirst = transport.calls.length;
    const second = await requestMediaGeneration(
      aliceCtx,
      { artifactId: draft, revisionNo: 1, promptText: PROMPT, requestKey: key },
      deps(),
    );
    assert.deepEqual(second, { status: "refused", reason: "duplicate-request" });
    assert.equal(transport.calls.length, callsAfterFirst, "the duplicate never reached the transport");

    /* ── 7. THE DATABASE ITSELF REFUSES CROSS-TENANT LINEAGE ────────────────── */
    {
      await setup.query("begin");
      let failed = false;
      try {
        await setup.query(
          `update media_generation_invocations set source_media_asset_id = $1
             where tenant_id = $2 and source_media_asset_id is not null`,
          [foreignAsset, alice.tenantId],
        );
      } catch {
        failed = true;
      }
      await setup.query("rollback");
      assert.ok(failed, "the composite foreign key refuses another tenant's asset as lineage");
    }

    console.log("media5-reference-edit/reference-postgres: all assertions passed.");
  } finally {
    await setup.end().catch(() => undefined);
    await handle.dispose().catch(() => undefined);
    await harness.dropDatabase();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
