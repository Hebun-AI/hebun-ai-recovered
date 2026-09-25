/*
 * PUBLISH-0 — the deterministic `jpeg-publish-v1` derivative on a disposable PostgreSQL, with the
 * REAL sharp transform and an in-memory storage port (labelled FAKE below). No network.
 *
 *   PNG → JPEG · deterministic digest · dimensions preserved · alpha flattened to white · metadata
 *   stripped · original unchanged · integrity mismatch refused · retired original refused · derived
 *   of derived refused · idempotent · generated XOR derived · JPEG-only derivation · one derivative
 *   per source · cross-tenant lineage impossible · derivative invisible to gallery / preview /
 *   composer / review · lineage reader refuses a wrong derivative · derivation authorizes nothing
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { Client } from "pg";
import sharp from "sharp";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
// Loaded FIRST: the schema barrel is the only safe entry point for src/db/schema/*.
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { createMemoryMediaObjectStore } from "../helpers/media-fakes";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import {
  JPEG_PUBLISH_DERIVATION,
  convertToPublishJpeg,
  derivePublishJpeg,
  publishDerivativeId,
} from "../../src/features/media-assets/derive-publish-jpeg.server";
import {
  readPublishDerivative,
  selectPublishLineage,
} from "../../src/features/media-assets/read-publish-derivative.server";
import {
  listArtifactMediaAssets,
  listRevisionMediaAssets,
  readMediaAsset,
} from "../../src/features/media-assets/read-media-assets.server";
import { retireMediaAsset } from "../../src/features/media-assets/retire-media-asset.server";
import { readImageSignature } from "../../src/features/media-assets/image-signature";
import { selectMediaForRevision } from "../../src/features/content-composition/select-media.server";
import { acceptMediaAsset } from "../../src/features/media-asset-review/review-media-asset.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

globalThis.fetch = (() => {
  throw new Error("REAL NETWORK REACHED");
}) as typeof fetch;

const JUSTIFICATION = "Publishing this post is a deliberate organizational act and I accept responsibility.";
const sha = (b: Uint8Array | string) => createHash("sha256").update(b).digest("hex");

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
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
    [seeded.authIdentityId, tag.padEnd(64, "d").slice(0, 64), seeded.userId, seeded.tenantId, seeded.membershipId],
  );
  return row.rows[0]!.id;
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
    requestId: "publish0-derived",
    authenticatedAt: new Date().toISOString(),
  });
}

/** A real, decodable PNG: left half fully transparent, right half opaque red, with EXIF attached. */
async function realPng(width: number, height: number): Promise<Uint8Array> {
  const raw = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (x >= width / 2) {
        raw[i] = 220;
        raw[i + 1] = 20;
        raw[i + 2] = 20;
        raw[i + 3] = 255;
      }
    }
  }
  return new Uint8Array(
    await sharp(raw, { raw: { width, height, channels: 4 } })
      .withExif({ IFD0: { Copyright: "PUBLISH0-EXIF-MARKER", Software: "hebun-test" } })
      .png()
      .toBuffer(),
  );
}

async function main(): Promise<void> {
  /* ══ 0. THE PURE TRANSFORM ══ */
  const png = await realPng(96, 64);
  assert.equal(readImageSignature(png).status, "recognized");
  const pngMeta = await sharp(png).metadata();
  assert.equal(pngMeta.hasAlpha, true, "fixture carries alpha");
  assert.ok(pngMeta.exif, "fixture carries EXIF");

  const j1 = await convertToPublishJpeg(png);
  const j2 = await convertToPublishJpeg(png);
  assert.equal(sha(j1), sha(j2), "deterministic digest");
  const sig = readImageSignature(j1);
  assert.equal(sig.status === "recognized" && sig.mimeType, "image/jpeg", "JPEG magic");
  assert.deepEqual(sig.status === "recognized" && [sig.width, sig.height], [96, 64], "dimensions preserved");
  const jMeta = await sharp(j1).metadata();
  assert.equal(jMeta.format, "jpeg");
  assert.equal(jMeta.hasAlpha, false);
  assert.equal(jMeta.exif, undefined, "EXIF stripped");
  assert.equal(jMeta.icc, undefined, "ICC stripped");
  assert.equal(jMeta.xmp, undefined, "XMP stripped");
  assert.equal(Buffer.from(j1).includes("PUBLISH0-EXIF-MARKER"), false, "no metadata bytes survive");
  const { data } = await sharp(j1).raw().toBuffer({ resolveWithObject: true });
  const px = (x: number, y: number) => [...data.subarray((y * 96 + x) * 3, (y * 96 + x) * 3 + 3)];
  for (const c of px(5, 5)) assert.ok(c >= 250, `transparent flattened to white, got ${px(5, 5)}`);
  const red = px(90, 60);
  assert.ok(red[0]! > 180 && red[1]! < 70 && red[2]! < 70, `opaque preserved, got ${red}`);
  await assert.rejects(convertToPublishJpeg(new Uint8Array([1, 2, 3, 4])), "undecodable refused");

  /* ══ DATABASE ══ */
  const harness = createDisposablePostgresHarness("hebun_publish0_derived");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  /* FAKE: the storage port, in memory. The authority under test is real. */
  const store = createMemoryMediaObjectStore();
  const deps = { getDb: () => handle.db, resolveStorage: () => ({ status: "available" as const, store }) };

  try {
    const acme = (await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme-dm", email: "d@acme.test" })) as Seeded;
    const globex = (await seedLocalIdentity(setup, { companyName: "Globex", companySlug: "globex-dm", email: "d@globex.test" })) as Seeded;
    const acmeCtx = contextFor(acme, await sessionRowFor(setup, acme, "a"));
    const globexCtx = contextFor(globex, await sessionRowFor(setup, globex, "b"));
    await setup.query(
      `insert into genesis_nominations
         (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
          accepted_at, accepted_session_context_id, accepted_assurance_level)
       values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
      [acme.tenantId, acme.authIdentityId, acme.userId, acmeCtx.sessionContextId],
    );
    assert.equal((await establishGovernanceAuthority(acmeCtx, { justification: JUSTIFICATION }, deps)).status, "established");

    /* FIXTURE: a draft revision + a generated, admitted asset whose bytes are really in the store. */
    const seedGenerated = async (tenant: Seeded, bytes: Uint8Array, mime = "image/png") => {
      const agent = (await setup.query<{ id: string }>(
        `insert into agents (tenant_id, name, agent_lifecycle_status, created_by, created_by_type)
         values ($1,'Heby','active',$2,'human') returning id`,
        [tenant.tenantId, tenant.userId],
      )).rows[0]!.id;
      const artifact = (await setup.query<{ id: string }>(
        `insert into work_artifacts
           (tenant_id, artifact_type, title, artifact_lifecycle_status, owner_workspace,
            current_revision, intended_destination, created_by, created_by_type)
         values ($1,'content-draft','Post','draft','operations',1,'instagram',$2,'human') returning id`,
        [tenant.tenantId, tenant.userId],
      )).rows[0]!.id;
      await setup.query(
        `insert into work_artifact_revisions
           (tenant_id, artifact_id, revision_no, content, content_digest, authored_by_actor_type, authored_by_actor_id)
         values ($1,$2,1,'caption',$3,'human',$4)`,
        [tenant.tenantId, artifact, sha("caption"), tenant.userId],
      );
      const inv = (await setup.query<{ id: string }>(
        `insert into media_generation_invocations
           (tenant_id, request_key, requested_by_actor_type, requested_by_actor_id, agent_id,
            source_artifact_id, source_revision_no, prompt_text, input_digest, transport, provider,
            model, state, admission_outcome, requested_at, finalized_at)
         values ($1,$2,'human',$3,$4,$5,1,'prompt',$6,'fake','fake','fake','provider-succeeded','admitted', now(), now())
         returning id`,
        [tenant.tenantId, randomUUID(), tenant.userId, agent, artifact, sha(randomUUID())],
      )).rows[0]!.id;
      const assetId = randomUUID();
      const key = `tenants/${tenant.tenantId}/media/${assetId}`;
      const s = readImageSignature(bytes);
      const [w, h] = s.status === "recognized" ? [s.width, s.height] : [1, 1];
      await store.put({ key, bytes, contentType: mime, sha256Hex: sha(bytes) });
      await setup.query(
        `insert into media_assets
           (id, tenant_id, invocation_id, mime_type, byte_size, byte_digest, width, height,
            storage_backend, storage_key, admitted_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,'test-memory',$9, now())`,
        [assetId, tenant.tenantId, inv, mime, bytes.length, sha(bytes), w, h, key],
      );
      return { assetId, artifact, key, digest: sha(bytes), invocationId: inv };
    };
    const count = async (sql: string, p: unknown[] = []) =>
      (await setup.query<{ n: number }>(sql, p)).rows[0]!.n;

    /* ══ 1. PNG → JPEG, through the authority ══ */
    const a = await seedGenerated(acme, png);
    const originalBefore = (await setup.query("select * from media_assets where id=$1", [a.assetId])).rows[0];
    const d1 = await derivePublishJpeg(acmeCtx, { originalAssetId: a.assetId }, deps);
    assert.equal(d1.status, "derived", JSON.stringify(d1));
    if (d1.status !== "derived") throw new Error("unreachable");
    assert.equal(d1.derivative.byteDigest, sha(j1), "the stored derivative is the deterministic transform");
    assert.equal(d1.derivative.assetId, publishDerivativeId(acme.tenantId, a.assetId));
    assert.deepEqual([d1.derivative.width, d1.derivative.height], [96, 64]);
    const row = (await setup.query("select * from media_assets where id=$1", [d1.derivative.assetId])).rows[0];
    assert.equal(row.invocation_id, null, "a derivative names no invocation");
    assert.equal(row.derived_from_asset_id, a.assetId);
    assert.equal(row.derivation, JPEG_PUBLISH_DERIVATION);
    assert.equal(row.mime_type, "image/jpeg");
    assert.equal(row.storage_key, `tenants/${acme.tenantId}/media/${d1.derivative.assetId}`);
    assert.equal(sha(store.objects.get(row.storage_key)!.bytes), row.byte_digest, "stored bytes verified");

    /* Original unchanged — row and bytes. */
    assert.deepEqual((await setup.query("select * from media_assets where id=$1", [a.assetId])).rows[0], originalBefore);
    assert.equal(sha(store.objects.get(a.key)!.bytes), a.digest, "original bytes untouched");

    /* ══ 2. IDEMPOTENT ══ */
    const putsBefore = store.puts.length;
    const d2 = await derivePublishJpeg(acmeCtx, { originalAssetId: a.assetId }, deps);
    assert.equal(d2.status, "existing");
    assert.equal(d2.status === "existing" && d2.derivative.assetId, d1.derivative.assetId);
    assert.equal(store.puts.length, putsBefore, "an existing derivative is not rewritten");
    assert.equal(await count("select count(*)::int n from media_assets where derived_from_asset_id=$1", [a.assetId]), 1);

    /* A crash between put and row: the object exists, the row does not — the retry completes it. */
    const crash = await seedGenerated(acme, await realPng(40, 40));
    const crashKey = `tenants/${acme.tenantId}/media/${publishDerivativeId(acme.tenantId, crash.assetId)}`;
    const crashJpeg = await convertToPublishJpeg(store.objects.get(crash.key)!.bytes);
    await store.put({ key: crashKey, bytes: crashJpeg, contentType: "image/jpeg", sha256Hex: sha(crashJpeg) });
    const recovered = await derivePublishJpeg(acmeCtx, { originalAssetId: crash.assetId }, deps);
    assert.equal(recovered.status, "derived", "orphaned exact object adopted after verification");
    /* …but a foreign object under that key is refused, never adopted. */
    const squat = await seedGenerated(acme, await realPng(30, 30));
    const squatKey = `tenants/${acme.tenantId}/media/${publishDerivativeId(acme.tenantId, squat.assetId)}`;
    const junk = new Uint8Array([9, 9, 9]);
    await store.put({ key: squatKey, bytes: junk, contentType: "image/jpeg", sha256Hex: sha(junk) });
    const squatted = await derivePublishJpeg(acmeCtx, { originalAssetId: squat.assetId }, deps);
    assert.deepEqual(squatted, { status: "refused", reason: "derivative-integrity-mismatch" });
    assert.equal(await count("select count(*)::int n from media_assets where derived_from_asset_id=$1", [squat.assetId]), 0);

    /* ══ 3. REFUSALS ══ */
    const tampered = await seedGenerated(acme, await realPng(20, 20));
    const obj = store.objects.get(tampered.key)!;
    obj.bytes = new Uint8Array(obj.bytes);
    obj.bytes[obj.bytes.length - 5] ^= 0xff;
    assert.deepEqual(
      await derivePublishJpeg(acmeCtx, { originalAssetId: tampered.assetId }, deps),
      { status: "refused", reason: "source-integrity-mismatch" },
      "bytes that are not the admitted ones are never converted",
    );
    const retiredOne = await seedGenerated(acme, await realPng(20, 20));
    assert.equal((await retireMediaAsset(acmeCtx, { assetId: retiredOne.assetId }, deps)).status, "retired");
    assert.deepEqual(
      await derivePublishJpeg(acmeCtx, { originalAssetId: retiredOne.assetId }, deps),
      { status: "refused", reason: "source-retired" },
    );
    assert.deepEqual(
      await derivePublishJpeg(acmeCtx, { originalAssetId: d1.derivative.assetId }, deps),
      { status: "refused", reason: "source-not-original" },
      "no derivative of a derivative",
    );
    assert.deepEqual(
      await derivePublishJpeg(globexCtx, { originalAssetId: a.assetId }, deps),
      { status: "refused", reason: "source-not-found" },
      "another tenant's asset does not exist here",
    );
    assert.deepEqual(
      await derivePublishJpeg(acmeCtx, { originalAssetId: a.assetId }, { ...deps, resolveStorage: () => ({ status: "unavailable", reason: "storage-not-connected" }) }),
      { status: "refused", reason: "storage-unavailable" },
    );

    /* ══ 4. DB CONSTRAINTS, directly ══ */
    const violates = async (sql: string, params: unknown[], constraint: string) => {
      await assert.rejects(setup.query(sql, params), (e: { constraint?: string }) => e.constraint === constraint, constraint);
    };
    const insertDerived = (id: string, tenantId: string, invocation: string | null, from: string | null, derivation: string | null, mime = "image/jpeg") =>
      setup.query(
        `insert into media_assets (id, tenant_id, invocation_id, derived_from_asset_id, derivation, mime_type,
           byte_size, byte_digest, width, height, storage_backend, storage_key, admitted_at)
         values ($1,$2,$3,$4,$5,$6,10,$7,1,1,'test-memory',$8, now())`,
        [id, tenantId, invocation, from, derivation, mime, sha(id), `tenants/${tenantId}/media/${id}`],
      );
    const b = await seedGenerated(acme, await realPng(10, 10));
    const bInv = (await setup.query<{ id: string }>(
      `insert into media_generation_invocations
         (tenant_id, request_key, requested_by_actor_type, requested_by_actor_id, agent_id,
          source_artifact_id, source_revision_no, prompt_text, input_digest, transport, provider,
          model, state, requested_at)
       select tenant_id, gen_random_uuid(), 'human', requested_by_actor_id, agent_id, source_artifact_id, 1,
              'p', $2, 'fake','fake','fake','registered', now() from media_generation_invocations where id=$1
       returning id`,
      [b.invocationId, sha("x")],
    )).rows[0]!.id;
    await assert.rejects(
      insertDerived(randomUUID(), acme.tenantId, bInv, b.assetId, JPEG_PUBLISH_DERIVATION),
      (e: { constraint?: string }) => e.constraint === "media_assets_origin_chk",
      "generated AND derived is unrepresentable",
    );
    await assert.rejects(
      insertDerived(randomUUID(), acme.tenantId, null, null, null),
      (e: { constraint?: string }) => e.constraint === "media_assets_origin_chk",
      "neither generated nor derived is unrepresentable",
    );
    await assert.rejects(
      insertDerived(randomUUID(), acme.tenantId, null, b.assetId, null),
      (e: { constraint?: string }) => e.constraint === "media_assets_origin_chk",
    );
    await assert.rejects(
      insertDerived(randomUUID(), acme.tenantId, null, b.assetId, "resize-v1"),
      (e: { constraint?: string }) => e.constraint === "media_assets_derivation_chk",
    );
    await assert.rejects(
      insertDerived(randomUUID(), acme.tenantId, null, b.assetId, JPEG_PUBLISH_DERIVATION, "image/png"),
      (e: { constraint?: string }) => e.constraint === "media_assets_derivation_jpeg_chk",
      "a jpeg-publish derivative is JPEG",
    );
    const selfId = randomUUID();
    await assert.rejects(
      insertDerived(selfId, acme.tenantId, null, selfId, JPEG_PUBLISH_DERIVATION),
      (e: { constraint?: string }) => ["media_assets_derivation_not_self_chk", "media_assets_tenant_derived_from_fk"].includes(e.constraint ?? ""),
    );
    await assert.rejects(
      insertDerived(randomUUID(), globex.tenantId, null, b.assetId, JPEG_PUBLISH_DERIVATION),
      (e: { constraint?: string }) => e.constraint === "media_assets_tenant_derived_from_fk",
      "cross-tenant lineage is unrepresentable",
    );
    await insertDerived(randomUUID(), acme.tenantId, null, b.assetId, JPEG_PUBLISH_DERIVATION);
    await assert.rejects(
      insertDerived(randomUUID(), acme.tenantId, null, b.assetId, JPEG_PUBLISH_DERIVATION),
      (e: { constraint?: string }) => e.constraint === "media_assets_derivation_uq",
      "one derivative per source + derivation",
    );
    await violates("update media_assets set invocation_id=null where id=$1", [b.assetId], "media_assets_origin_chk");
    await violates("delete from media_assets where id=$1", [b.assetId], "media_assets_tenant_derived_from_fk");

    /* ══ 5. NOT CREATIVE WORK: invisible to gallery, preview, composer, review ══ */
    const listed = await listRevisionMediaAssets(acmeCtx, { artifactId: a.artifact, revisionNo: 1 }, deps);
    assert.deepEqual(listed.status === "read" && listed.assets.map((x) => x.assetId), [a.assetId]);
    const listedAll = await listArtifactMediaAssets(acmeCtx, { artifactIds: [a.artifact] }, deps);
    assert.deepEqual(listedAll.status === "read" && listedAll.assets.map((x) => x.assetId), [a.assetId]);
    assert.equal((await readMediaAsset(acmeCtx, d1.derivative.assetId, deps)).status, "not-found");
    const selected = await selectMediaForRevision(acmeCtx, { artifactId: a.artifact, revisionNo: 1, mediaAssetId: d1.derivative.assetId }, deps);
    assert.deepEqual(selected, { status: "refused", reason: "asset-unresolvable" });
    const reviewed = await acceptMediaAsset(acmeCtx, { assetId: d1.derivative.assetId, byteDigest: d1.derivative.byteDigest, justification: JUSTIFICATION } as never, deps);
    assert.equal(reviewed.status === "refused" && reviewed.reason, "asset-unresolvable", JSON.stringify(reviewed));

    /* ══ 6. LINEAGE READER ══ */
    const binding = { originalAssetId: a.assetId, originalDigest: a.digest, derivedAssetId: d1.derivative.assetId, derivedDigest: d1.derivative.byteDigest };
    assert.equal((await selectPublishLineage(handle.db, acme.tenantId, binding)).status, "verified");
    const other = await seedGenerated(acme, await realPng(12, 12));
    const otherD = await derivePublishJpeg(acmeCtx, { originalAssetId: other.assetId }, deps);
    if (otherD.status === "refused") throw new Error("unreachable");
    assert.deepEqual(
      await selectPublishLineage(handle.db, acme.tenantId, { ...binding, derivedAssetId: otherD.derivative.assetId, derivedDigest: otherD.derivative.byteDigest }),
      { status: "refused", reason: "derivative-lineage-mismatch" },
      "another original's derivative is refused",
    );
    assert.deepEqual(
      await selectPublishLineage(handle.db, acme.tenantId, { ...binding, derivedDigest: sha("nope") }),
      { status: "refused", reason: "derivative-digest-mismatch" },
    );
    assert.deepEqual(
      await selectPublishLineage(handle.db, acme.tenantId, { ...binding, derivedAssetId: a.assetId }),
      { status: "refused", reason: "derivative-unresolvable" },
      "a generated asset is never a derivative",
    );
    assert.deepEqual(
      await selectPublishLineage(handle.db, globex.tenantId, binding),
      { status: "refused", reason: "original-unresolvable" },
    );
    const grants = store.readGrants.length;
    const granted = await readPublishDerivative(acmeCtx, binding, deps);
    assert.equal(granted.status, "read");
    assert.deepEqual(store.readGrants.slice(grants), [row.storage_key], "ONE grant, for the derivative only");
    store.objects.get(row.storage_key)!.bytes[10] ^= 0xff;
    assert.deepEqual(await readPublishDerivative(acmeCtx, binding, deps), { status: "unavailable", reason: "integrity-mismatch" });
    store.objects.get(row.storage_key)!.bytes[10] ^= 0xff;
    assert.equal((await retireMediaAsset(acmeCtx, { assetId: a.assetId }, deps)).status, "retired");
    assert.deepEqual(await selectPublishLineage(handle.db, acme.tenantId, binding), { status: "refused", reason: "original-retired" });

    /* ══ 7. DERIVATION AUTHORIZES NOTHING ══ */
    assert.equal(await count("select count(*)::int n from heby_action_requests"), 0, "no action request");
    assert.equal(await count("select count(*)::int n from action_permits"), 0, "no permit");
    assert.equal(await count("select count(*)::int n from action_execution_attempts"), 0, "no attempt");

    console.log("PASS publish-0 derived media (postgres, real sharp, in-memory store)");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
