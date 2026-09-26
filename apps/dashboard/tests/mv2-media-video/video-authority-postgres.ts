/*
 * MV-2 — Media can REPRESENT a video; nothing can yet ADMIT, REVIEW, SELECT, DERIVE, EDIT or
 * PUBLISH one. Real Postgres, real migrations, real authority code.
 *
 * THE CLAIM UNDER TEST:
 *
 *   "Migration 64 classifies every existing asset as `image` without rewriting it. `media_kind` is
 *    explicit and closed, agrees with the MIME type, and carries video facts exactly when it is
 *    `video` (audio may be absent). Readers take the kind from the row, and the image read model
 *    never renders a video as an image. Every image-only operation refuses a video row by name:
 *    JPEG derivation, publish lineage, content selection, image review and reference edit — and
 *    image behaviour is unchanged."
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "pg";
import sharp from "sharp";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { MIGRATIONS_DIR } from "../../scripts/lib/canonical-migrations";
import { applyPendingMigrations } from "../../scripts/lib/production-migration";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { requestMediaGeneration } from "../../src/features/media-assets/request-media-generation.server";
import { derivePublishJpeg } from "../../src/features/media-assets/derive-publish-jpeg.server";
import { selectPublishLineage } from "../../src/features/media-assets/read-publish-derivative.server";
import { listRevisionMediaAssets, readMediaAsset } from "../../src/features/media-assets/read-media-assets.server";
import { MEDIA_ASSET_MIME_TYPES, MEDIA_KINDS } from "../../src/features/media-assets/contracts";
import { selectMediaForRevision } from "../../src/features/content-composition/select-media.server";
import { acceptMediaAsset } from "../../src/features/media-asset-review/review-media-asset.server";
import type { MediaStorageResolution } from "../../src/features/media-assets/media-object-store";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";
import { createFakeMediaGenerationTransport, createMemoryMediaObjectStore } from "../helpers/media-fakes";

globalThis.fetch = (() => {
  throw new Error("REAL NETWORK REACHED");
}) as typeof fetch;

const NOW = new Date("2026-09-26T09:00:00.000Z");
const REASON = "Governance has looked at these exact image bytes and records its decision here.";
const sha = (b: Uint8Array | string): string => createHash("sha256").update(b).digest("hex");
const MV2_TAG = "20260926083521_mv2_media_video_kind";

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
    requestId: "mv2-video",
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
    [seeded.authIdentityId, tag.padEnd(64, "b").slice(0, 64), seeded.userId, seeded.tenantId, seeded.membershipId],
  );
  return row.rows[0]!.id;
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
    [tenantId, artifact.rows[0]!.id, content, sha(content), authorId],
  );
  return artifact.rows[0]!.id;
}

/** A migration folder holding only the first `count` canonical migrations. */
function truncatedMigrations(count: number): string {
  const dir = mkdtempSync(path.join(tmpdir(), "hebun-mv2-"));
  mkdirSync(path.join(dir, "meta"), { recursive: true });
  const journal = JSON.parse(readFileSync(path.join(MIGRATIONS_DIR, "meta", "_journal.json"), "utf8")) as {
    entries: { tag: string }[];
  };
  const entries = journal.entries.slice(0, count);
  for (const e of entries) cpSync(path.join(MIGRATIONS_DIR, `${e.tag}.sql`), path.join(dir, `${e.tag}.sql`));
  writeFileSync(path.join(dir, "meta", "_journal.json"), JSON.stringify({ ...journal, entries }));
  return dir;
}

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("mv2-media-video/video-authority-postgres: exited before completing");
    process.exitCode = 1;
  }
});

async function backfillProof(): Promise<void> {
  /* ══ A. MIGRATION 64 CLASSIFIES AN EXISTING ASSET AS IMAGE, AND REWRITES NOTHING ELSE ══ */
  const journal = JSON.parse(readFileSync(path.join(MIGRATIONS_DIR, "meta", "_journal.json"), "utf8")) as { entries: { tag: string }[] };
  assert.equal(journal.entries.length, 64, "MV-2 authors exactly one migration: 63 -> 64");
  assert.equal(journal.entries[63]!.tag, MV2_TAG, "and it is the newest");
  const sql = readFileSync(path.join(MIGRATIONS_DIR, `${MV2_TAG}.sql`), "utf8");
  assert.ok(!/\b(update|delete|drop\s+table|drop\s+column|truncate|create\s+table)\b/i.test(sql), "no data rewrite, no dropped column, no new table");
  assert.deepEqual(
    [...sql.matchAll(/DROP CONSTRAINT "([^"]+)"/g)].map((m) => m[1]),
    ["media_assets_mime_type_chk"],
    "the only dropped constraint is the MIME CHECK, re-added wider in the same migration",
  );

  const harness = createDisposablePostgresHarness("hebun_mv2_backfill");
  await harness.createDatabase();
  const client = new Client({ connectionString: harness.dbUrl });
  await client.connect();
  const folder = truncatedMigrations(63);
  try {
    await applyPendingMigrations(client, folder);
    const cols = await client.query(`select 1 from information_schema.columns where table_name='media_assets' and column_name='media_kind'`);
    assert.equal(cols.rowCount, 0, "at 63 there is no media_kind yet");
    const acme = (await seedLocalIdentity(client, { companyName: "Acme", companySlug: "acme-mv2b", email: "b@acme.test" })) as Seeded;
    const draft = await seedDraft(client, acme.tenantId, acme.userId);
    const id = randomUUID();
    await client.query(
      `insert into media_assets (id, tenant_id, mime_type, byte_size, byte_digest, width, height, storage_backend,
         storage_key, admitted_at, supplied_by_actor_type, supplied_by_actor_id, supplied_source,
         supplied_source_file_id, supplied_source_capability, supplied_artifact_id, supplied_revision_no)
       values ($1,$2,'image/jpeg',10,$3,4,3,'test-memory',$4, now(),'human',$5,'google-drive','abc',
         'google.drive.file.content.read',$6,1)`,
      [id, acme.tenantId, sha(id), `tenants/${acme.tenantId}/media/${id}`, acme.userId, draft],
    );
    const before = (await client.query(`select row_to_json(m)::jsonb j from media_assets m where id=$1`, [id])).rows[0]!.j;

    await applyPendingMigrations(client);
    const after = (await client.query(`select row_to_json(m)::jsonb j from media_assets m where id=$1`, [id])).rows[0]!.j as Record<string, unknown>;
    assert.equal(after.media_kind, "image", "an existing asset is classified image");
    for (const c of ["video_container", "video_duration_ms", "video_codec", "audio_codec", "video_frame_rate"]) {
      assert.equal(after[c], null, `${c} is NULL on an existing image`);
    }
    for (const [k, v] of Object.entries(before as Record<string, unknown>)) {
      assert.deepEqual(after[k], v, `existing column ${k} is unchanged by the migration`);
    }
  } finally {
    await client.end();
    await harness.dropDatabase();
    rmSync(folder, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  assert.deepEqual([...MEDIA_KINDS], ["image", "video"]);
  assert.deepEqual([...MEDIA_ASSET_MIME_TYPES].sort(), ["image/jpeg", "image/png", "image/webp"], "the ADMISSION allowlist is still images: representable is not admitted");

  await backfillProof();

  const harness = createDisposablePostgresHarness("hebun_mv2_video");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const getDb = () => handle.db;
  try {
    harness.migrateDatabase();
    await setup.connect();
    const alice = (await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme-mv2", email: "alice@acme.test" })) as Seeded;
    const ctx = contextFor(alice, await sessionRowFor(setup, alice, "a1"));
    await setup.query(
      `insert into genesis_nominations
         (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
          accepted_at, accepted_session_context_id, accepted_assurance_level)
       values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
      [alice.tenantId, alice.authIdentityId, alice.userId, ctx.sessionContextId],
    );
    assert.equal(
      (await establishGovernanceAuthority(ctx, { justification: "Establishing Governance authority so admitted images can be reviewed." }, { getDb, now: () => NOW } as never)).status,
      "established",
    );
    await createDurableAgentIdentity(ctx, { name: "Heby" }, { getDb } as never);
    const draft = await seedDraft(setup, alice.tenantId, alice.userId);

    const store = createMemoryMediaObjectStore();
    const resolveStorage = (): MediaStorageResolution => ({ status: "available", store });
    const transport = createFakeMediaGenerationTransport({
      kind: "bytes",
      bytes: new Uint8Array(await sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 180, g: 90, b: 40 } } }).png().toBuffer()),
    });
    const deps = { getDb, now: () => NOW, resolveStorage, resolveTransport: () => ({ status: "available" as const, transport }) };

    /* ══ B. GENERATED IMAGE BEHAVIOUR IS UNCHANGED, AND ITS KIND COMES FROM THE ROW ══ */
    const gen = await requestMediaGeneration(ctx, { artifactId: draft, revisionNo: 1, promptText: "A kilim on the loom.", requestKey: randomUUID() }, deps);
    assert.equal(gen.status, "admitted", "generated image admission unchanged");
    const imageId = gen.status === "admitted" ? gen.assetId : "";
    assert.equal((await setup.query(`select media_kind from media_assets where id=$1`, [imageId])).rows[0]!.media_kind, "image", "a new generated asset is image by the row");
    const imageRead = await readMediaAsset(ctx, imageId, { getDb, resolveStorage });
    assert.equal(imageRead.status, "read");
    if (imageRead.status === "read") assert.equal(imageRead.asset.mediaKind, "image", "the reader reports the row's kind");

    /* ══ C. SCHEMA: VIDEO IS REPRESENTABLE — WHOLE, OR NOT AT ALL ══ */
    const inv = (await setup.query<{ id: string }>(`select invocation_id id from media_assets where id=$1`, [imageId])).rows[0]!.id;
    const cloneInvocation = async (): Promise<string> =>
      (await setup.query<{ id: string }>(
        `insert into media_generation_invocations
           (tenant_id, request_key, requested_by_actor_type, requested_by_actor_id, agent_id,
            source_artifact_id, source_revision_no, prompt_text, input_digest, transport, provider,
            model, state, admission_outcome, requested_at, finalized_at)
         select tenant_id, gen_random_uuid(), 'human', requested_by_actor_id, agent_id, source_artifact_id, 1,
                'p', $2, 'fake','fake','fake','provider-succeeded','admitted', now(), now()
           from media_generation_invocations where id=$1 returning id`,
        [inv, sha(randomUUID())],
      )).rows[0]!.id;
    const VIDEO = { media_kind: "video", mime_type: "video/mp4", video_container: "mov,mp4,m4a,3gp,3g2,mj2", video_duration_ms: 2000, video_codec: "h264", audio_codec: "aac", video_frame_rate: "30000/1001", width: 1080, height: 1920 };
    const insertAsset = async (over: Record<string, unknown>, invocationId?: string) => {
      const id = randomUUID();
      const row: Record<string, unknown> = {
        id,
        tenant_id: alice.tenantId,
        invocation_id: invocationId ?? (await cloneInvocation()),
        mime_type: "image/png",
        byte_size: 10,
        byte_digest: sha(id),
        width: 1,
        height: 1,
        storage_backend: "test-memory",
        storage_key: `tenants/${alice.tenantId}/media/${id}`,
        admitted_at: NOW,
        ...over,
      };
      const cols = Object.keys(row);
      await setup.query(
        `insert into media_assets (${cols.join(",")}) values (${cols.map((_, i) => `$${i + 1}`).join(",")})`,
        cols.map((c) => row[c]),
      );
      return id;
    };
    /* Postgres evaluates CHECKs in no promised order, so a row two CHECKs refuse may name either. */
    const rejects = async (over: Record<string, unknown>, constraint: string | readonly string[], label: string) => {
      const invocationId = await cloneInvocation();
      const allowed = typeof constraint === "string" ? [constraint] : constraint;
      await assert.rejects(insertAsset(over, invocationId), (e: { constraint?: string }) => allowed.includes(e.constraint ?? ""), label);
    };

    const videoId = await insertAsset(VIDEO);
    const silentId = await insertAsset({ ...VIDEO, audio_codec: null });
    assert.equal((await setup.query(`select count(*)::int n from media_assets where media_kind='video'`)).rows[0]!.n, 2, "full video and silent video are both representable");
    assert.equal(
      (await setup.query(`select media_kind from media_assets where id=$1`, [await insertAsset({})])).rows[0]!.media_kind,
      "image",
      "an insert naming no kind is an image",
    );

    await rejects({ media_kind: "audio" }, "media_assets_media_kind_chk", "an unknown kind is refused");
    await rejects({ ...VIDEO, mime_type: "image/png" }, "media_assets_media_kind_mime_chk", "a video with an image MIME is refused");
    await rejects({ mime_type: "video/mp4" }, "media_assets_media_kind_mime_chk", "an image with a video MIME is refused");
    await rejects({ ...VIDEO, mime_type: "video/quicktime" }, ["media_assets_mime_type_chk", "media_assets_media_kind_mime_chk"], "an unsupported video MIME is refused");
    await rejects({ video_codec: "h264" }, "media_assets_video_facts_chk", "an image carrying a video fact is refused");
    await rejects({ audio_codec: "aac" }, "media_assets_video_facts_chk", "an image carrying an audio codec is refused");
    for (const missing of ["video_container", "video_duration_ms", "video_codec", "video_frame_rate"]) {
      await rejects({ ...VIDEO, [missing]: null }, "media_assets_video_facts_chk", `a video without ${missing} is refused`);
    }
    await rejects({ ...VIDEO, video_duration_ms: 0 }, "media_assets_video_duration_chk", "zero duration is refused");
    await rejects({ ...VIDEO, video_codec: "H.264" }, "media_assets_video_codec_chk", "a malformed codec is refused");
    await rejects({ ...VIDEO, audio_codec: "a a c" }, "media_assets_audio_codec_chk", "a malformed audio codec is refused");
    await rejects({ ...VIDEO, video_container: "mp4;rm" }, "media_assets_video_container_chk", "a malformed container is refused");
    for (const rate of ["0/1", "25/0", "29.97", "25", "-25/1"]) {
      await rejects({ ...VIDEO, video_frame_rate: rate }, "media_assets_video_frame_rate_chk", `frame rate ${rate} is refused`);
    }
    await rejects({ ...VIDEO, width: 0 }, "media_assets_width_chk", "a video without a frame width is refused");

    /* ══ D. THE IMAGE READ MODEL NEVER RENDERS A VIDEO AS AN IMAGE ══ */
    assert.equal((await readMediaAsset(ctx, videoId, { getDb, resolveStorage })).status, "not-found", "a single image read does not return a video");
    const listing = (await listRevisionMediaAssets(ctx, { artifactId: draft, revisionNo: 1 }, { getDb, resolveStorage })) as unknown as {
      assets?: { assetId: string; mediaKind: string }[];
    };
    const listed = listing.assets ?? [];
    assert.ok(listed.some((a) => a.assetId === imageId), "the image is listed");
    assert.ok(!listed.some((a) => a.assetId === videoId || a.assetId === silentId), "no video is listed as an image");
    assert.ok(listed.every((a) => a.mediaKind === "image"));

    /* ══ E. EVERY IMAGE-ONLY OPERATION REFUSES A VIDEO, BY NAME ══ */
    const deriveDeps = { getDb, resolveStorage };
    assert.deepEqual(await derivePublishJpeg(ctx, { originalAssetId: videoId }, deriveDeps), { status: "refused", reason: "source-not-image" }, "JPEG derivation");
    assert.equal((await setup.query(`select count(*)::int n from media_assets where derived_from_asset_id=$1`, [videoId])).rows[0]!.n, 0, "no derivative of a video exists");

    const vDigest = (await setup.query(`select byte_digest d from media_assets where id=$1`, [videoId])).rows[0]!.d as string;
    const lineage = await selectPublishLineage(handle.db, alice.tenantId, {
      originalAssetId: videoId,
      originalDigest: vDigest,
      derivedAssetId: randomUUID(),
      derivedDigest: sha("x"),
    });
    assert.deepEqual(lineage, { status: "refused", reason: "original-not-image" }, "publish lineage");

    assert.deepEqual(
      await selectMediaForRevision(ctx, { artifactId: draft, revisionNo: 1, mediaAssetId: videoId }, { getDb }),
      { status: "refused", reason: "asset-not-image" },
      "content selection",
    );
    assert.equal((await setup.query(`select count(*)::int n from content_selected_media where media_asset_id=$1`, [videoId])).rows[0]!.n, 0);

    const decisionsBefore = (await setup.query(`select count(*)::int n from decision_records`)).rows[0]!.n;
    const reviewed = await acceptMediaAsset(ctx, { assetId: videoId, byteDigest: vDigest, justification: REASON } as never, { getDb, now: () => NOW } as never);
    assert.deepEqual(reviewed, { status: "refused", reason: "asset-not-image" }, "image review");
    assert.equal((await setup.query(`select count(*)::int n from decision_records`)).rows[0]!.n, decisionsBefore, "no decision recorded");

    const invBefore = (await setup.query(`select count(*)::int n from media_generation_invocations`)).rows[0]!.n;
    const callsBefore = transport.calls.length;
    assert.deepEqual(
      await requestMediaGeneration(ctx, { artifactId: draft, revisionNo: 1, promptText: "Edit it.", requestKey: randomUUID(), sourceAssetId: videoId }, deps),
      { status: "refused", reason: "source-asset-not-image" },
      "reference edit",
    );
    assert.equal((await setup.query(`select count(*)::int n from media_generation_invocations`)).rows[0]!.n, invBefore, "no invocation registered");
    assert.equal(transport.calls.length, callsBefore, "no provider call");

    /* ══ F. THE SAME OPERATIONS STILL ACCEPT THE IMAGE ══ */
    assert.deepEqual(await selectMediaForRevision(ctx, { artifactId: draft, revisionNo: 1, mediaAssetId: imageId }, { getDb }), { status: "selected" });
    const derived = await derivePublishJpeg(ctx, { originalAssetId: imageId }, deriveDeps);
    assert.equal(derived.status, "derived", `an image still derives (${JSON.stringify(derived).slice(0, 80)})`);
    const iDigest = (await setup.query(`select byte_digest d from media_assets where id=$1`, [imageId])).rows[0]!.d as string;
    const accepted = await acceptMediaAsset(ctx, { assetId: imageId, byteDigest: iDigest, justification: REASON } as never, { getDb, now: () => NOW } as never);
    assert.equal(accepted.status, "reviewed", "an image is still reviewed");
    const edit = await requestMediaGeneration(ctx, { artifactId: draft, revisionNo: 1, promptText: "Edit it.", requestKey: randomUUID(), sourceAssetId: imageId }, deps);
    assert.equal(edit.status, "admitted", "an image still takes a reference edit");
  } finally {
    await setup.end().catch(() => undefined);
    await handle.dispose().catch(() => undefined);
    await harness.dropDatabase();
  }

  finished = true;
  console.log("mv2-media-video/video-authority-postgres: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
