/*
 * MEDIA-SUPPLIED — a human-supplied Google Drive image through the ONE Media authority, on a
 * disposable PostgreSQL with REAL sharp and an in-memory storage port (FAKE). The Drive read is a
 * FAKE injected at the admission's own seam; every network call throws.
 *
 *   generated XOR derived XOR supplied (DB) · partial provenance unrepresentable · human-only ·
 *   closed source / capability / file id · cross-tenant revision unrepresentable · admission from
 *   verified bytes · object verified as stored · Drive provenance recorded · idempotent · declared
 *   type must agree · non-image refused · Drive refusal / failure writes nothing · storage integrity
 *   mismatch writes nothing · cross-tenant supply and read refused · gallery shows supplied as
 *   supplied (no generation fields) · derived stays invisible · review and composer do not take it ·
 *   JPEG derivative from a supplied JPEG (EXIF stripped, lineage verified) · derived-of-derived
 *   refused · `/publish` binds a supplied original to ITS draft only · nothing authorized
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
  admitSuppliedDriveImage,
  suppliedAssetId,
} from "../../src/features/media-assets/admit-supplied-drive-image.server";
import { derivePublishJpeg, publishDerivativeId } from "../../src/features/media-assets/derive-publish-jpeg.server";
import { selectPublishLineage } from "../../src/features/media-assets/read-publish-derivative.server";
import {
  listArtifactMediaAssets,
  listRevisionMediaAssets,
  readMediaAsset,
} from "../../src/features/media-assets/read-media-assets.server";
import { acceptMediaAsset } from "../../src/features/media-asset-review/review-media-asset.server";
import { selectMediaForRevision } from "../../src/features/content-composition/select-media.server";
import { runHebyProposeCommand } from "../../src/features/heby-action-inlet/propose-commands.server";
import { formatWorkArtifactRef } from "../../src/features/work-artifacts/artifact-ref";
import type { DriveImageResult } from "../../src/features/provider-google/read-drive-image.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

let networkCalls = 0;
globalThis.fetch = (() => {
  networkCalls++;
  throw new Error("REAL NETWORK REACHED");
}) as typeof fetch;

const JUSTIFICATION = "Publishing this post is a deliberate organizational act and I accept responsibility.";
const APP_ID = "28295264780115792";
const sha = (b: Uint8Array | string) => createHash("sha256").update(b).digest("hex");
const DRIVE_ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz012345";

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
    [seeded.authIdentityId, tag.padEnd(64, "e").slice(0, 64), seeded.userId, seeded.tenantId, seeded.membershipId],
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
    requestId: "media-supplied",
    authenticatedAt: new Date().toISOString(),
  });
}

/** A camera-like JPEG carrying EXIF (a GPS-ish marker) that must never reach a publish derivative. */
async function cameraJpeg(width: number, height: number, tint = 120): Promise<Uint8Array> {
  return new Uint8Array(
    await sharp({ create: { width, height, channels: 3, background: { r: 180, g: tint, b: 60 } } })
      .withExif({ IFD0: { Copyright: "TRH-CAMERA-EXIF-MARKER", Make: "HebunTestCam" } })
      .jpeg({ quality: 92 })
      .toBuffer(),
  );
}

function driveReturns(bytes: Uint8Array, providerMimeType = "image/jpeg", fileId = DRIVE_ID) {
  const calls: { fileId: string; capability: string }[] = [];
  const readImage = async (_t: TenantContext, input: { fileId: string; capability: string }): Promise<DriveImageResult> => {
    calls.push(input);
    return {
      status: "read",
      capability: input.capability,
      image: { fileId, name: "kilim.jpg", providerMimeType, bytes, byteLength: bytes.byteLength },
    };
  };
  return { readImage, calls };
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_media_supplied");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const store = createMemoryMediaObjectStore();
  const resolveStorage = () => ({ status: "available" as const, store });
  const deps = { getDb: () => handle.db, resolveStorage };

  try {
    const acme = (await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme-ms", email: "d@acme.test" })) as Seeded;
    const globex = (await seedLocalIdentity(setup, { companyName: "Globex", companySlug: "globex-ms", email: "d@globex.test" })) as Seeded;
    const acmeCtx = contextFor(acme, await sessionRowFor(setup, acme, "a"));
    const globexCtx = contextFor(globex, await sessionRowFor(setup, globex, "b"));
    for (const [s, ctx] of [[acme, acmeCtx], [globex, globexCtx]] as const) {
      await setup.query(
        `insert into genesis_nominations
           (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
            accepted_at, accepted_session_context_id, accepted_assurance_level)
         values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
        [s.tenantId, s.authIdentityId, s.userId, ctx.sessionContextId],
      );
      assert.equal((await establishGovernanceAuthority(ctx, { justification: JUSTIFICATION }, deps)).status, "established");
    }

    const draft = async (tenant: Seeded, caption = `Kilim ${randomUUID()}`) => {
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
         values ($1,$2,1,$3,$4,'human',$5)`,
        [tenant.tenantId, artifact, caption, sha(caption), tenant.userId],
      );
      return artifact;
    };
    const count = async (q: string, p: unknown[] = []) => (await setup.query<{ n: number }>(q, p)).rows[0]!.n;
    const assetRows = () => count("select count(*)::int n from media_assets");

    /* ══ 0. SCHEMA: THE THIRD ORIGIN, AND ONLY WHOLE ══ */
    const acmeDraft = await draft(acme);
    const rawInsert = (over: Record<string, unknown>) => {
      const id = randomUUID();
      const row: Record<string, unknown> = {
        id,
        tenant_id: acme.tenantId,
        mime_type: "image/jpeg",
        byte_size: 10,
        byte_digest: sha(id),
        width: 1,
        height: 1,
        storage_backend: "test-memory",
        storage_key: `tenants/${acme.tenantId}/media/${id}`,
        admitted_at: new Date(),
        supplied_by_actor_type: "human",
        supplied_by_actor_id: acme.userId,
        supplied_source: "google-drive",
        supplied_source_file_id: DRIVE_ID,
        supplied_source_capability: "google.drive.content.read",
        supplied_artifact_id: acmeDraft,
        supplied_revision_no: 1,
        ...over,
      };
      const cols = Object.keys(row);
      return setup.query(
        `insert into media_assets (${cols.join(",")}) values (${cols.map((_, i) => `$${i + 1}`).join(",")})`,
        cols.map((c) => row[c]),
      );
    };
    /* The complete supplied shape IS representable (proved inside a rolled-back transaction). */
    await setup.query("begin");
    await rawInsert({});
    await setup.query("rollback");
    const rejects = async (over: Record<string, unknown>, constraint: RegExp, label: string) => {
      await assert.rejects(rawInsert(over), constraint, label);
    };
    await rejects({ supplied_source_file_id: null }, /media_assets_origin_chk/, "partial supplied provenance is unrepresentable");
    await rejects({ supplied_artifact_id: null, supplied_revision_no: null }, /media_assets_origin_chk/, "a supplied asset for no draft is unrepresentable");
    await rejects({ supplied_by_actor_type: "agent" }, /media_assets_supplied_human_chk/, "only a human supplies");
    await rejects({ supplied_source: "upload" }, /media_assets_supplied_source_chk/, "the source set is closed");
    await rejects({ supplied_source_file_id: "../etc/passwd" }, /media_assets_supplied_file_id_chk/, "a Drive id, never a path");
    await rejects({ supplied_source_capability: "google.drive.metadata.read" }, /media_assets_supplied_capability_chk/, "content capabilities only");
    await rejects({ derivation: "jpeg-publish-v1" }, /media_assets_origin_chk/, "supplied XOR derived");
    const globexDraft = await draft(globex);
    await rejects({ supplied_artifact_id: globexDraft }, /media_assets_supplied_revision_fk/, "another tenant's revision is unrepresentable");
    await rejects({ supplied_revision_no: 2 }, /media_assets_supplied_revision_fk/, "a revision that does not exist is unrepresentable");
    assert.equal(await assetRows(), 0);

    /* ══ 1. ADMISSION ══ */
    const photo = await cameraJpeg(120, 90);
    const drive = driveReturns(photo);
    const admitted = await admitSuppliedDriveImage(
      acmeCtx,
      { artifactId: acmeDraft, revisionNo: 1, driveFileId: DRIVE_ID },
      { ...deps, readImage: drive.readImage },
    );
    assert.equal(admitted.status, "admitted", JSON.stringify(admitted));
    assert.equal(drive.calls.length, 1, "one Drive read");
    assert.deepEqual(drive.calls[0], { fileId: DRIVE_ID, capability: "google.drive.content.read" });
    const asset = admitted.status === "admitted" ? admitted.asset : null!;
    assert.equal(asset.assetId, suppliedAssetId(acme.tenantId, acmeDraft, 1, DRIVE_ID, sha(photo)));
    assert.equal(asset.byteDigest, sha(photo), "digest computed from the bytes");
    assert.deepEqual([asset.mimeType, asset.width, asset.height], ["image/jpeg", 120, 90], "facts from the bytes");
    const key = `tenants/${acme.tenantId}/media/${asset.assetId}`;
    assert.equal(sha(store.objects.get(key)!.bytes), sha(photo), "the stored object is exactly the verified bytes");
    const row = (await setup.query("select * from media_assets where id=$1", [asset.assetId])).rows[0];
    assert.equal(row.invocation_id, null);
    assert.equal(row.derived_from_asset_id, null);
    assert.equal(row.supplied_by_actor_type, "human");
    assert.equal(row.supplied_by_actor_id, acme.userId, "the supplier is the session's human");
    assert.equal(row.supplied_source, "google-drive");
    assert.equal(row.supplied_source_file_id, DRIVE_ID);
    assert.equal(row.supplied_source_capability, "google.drive.content.read");
    assert.equal(row.supplied_artifact_id, acmeDraft);
    assert.equal(row.supplied_revision_no, 1);
    assert.equal(row.asset_lifecycle_status, "admitted");
    assert.ok(row.admitted_at instanceof Date);

    /* Idempotent: the same supply is the same asset; nothing new is written. */
    const again = await admitSuppliedDriveImage(
      acmeCtx,
      { artifactId: acmeDraft, revisionNo: 1, driveFileId: DRIVE_ID },
      { ...deps, readImage: driveReturns(photo).readImage },
    );
    assert.equal(again.status, "existing");
    assert.equal(again.status === "existing" && again.asset.assetId, asset.assetId);
    assert.equal(await assetRows(), 1);

    /* ══ 2. FAILURES WRITE NOTHING ══ */
    const before = { rows: await assetRows(), objects: store.objects.size };
    const unchanged = async (label: string) => {
      assert.equal(await assetRows(), before.rows, `${label}: no row`);
      assert.equal(store.objects.size, before.objects, `${label}: no object`);
    };
    const png = new Uint8Array(await sharp({ create: { width: 8, height: 8, channels: 3, background: "#123456" } }).png().toBuffer());
    const cases: [string, Parameters<typeof admitSuppliedDriveImage>[1], ReturnType<typeof driveReturns>["readImage"] | undefined, string][] = [
      ["declared type disagrees with bytes", { artifactId: acmeDraft, revisionNo: 1, driveFileId: "pngClaimedJpeg01" }, driveReturns(png, "image/jpeg", "pngClaimedJpeg01").readImage, "declared-type-mismatch"],
      ["not an image", { artifactId: acmeDraft, revisionNo: 1, driveFileId: "notAnImage00001" }, driveReturns(new TextEncoder().encode("hello, not a photo"), "image/jpeg", "notAnImage00001").readImage, "unsupported-image-signature"],
      ["empty bytes", { artifactId: acmeDraft, revisionNo: 1, driveFileId: "emptyFile000001" }, driveReturns(new Uint8Array(), "image/jpeg", "emptyFile000001").readImage, "empty-bytes"],
      ["Drive answered a different file", { artifactId: acmeDraft, revisionNo: 1, driveFileId: "askedForThis001" }, driveReturns(photo, "image/jpeg", "gotSomethingElse").readImage, "drive-read-failed"],
      ["malformed Drive id", { artifactId: acmeDraft, revisionNo: 1, driveFileId: "a/b?c" }, undefined, "invalid-input"],
      ["capability outside the closed set", { artifactId: acmeDraft, revisionNo: 1, driveFileId: DRIVE_ID, capability: "google.drive.metadata.read" }, undefined, "invalid-input"],
      ["revision that does not exist", { artifactId: acmeDraft, revisionNo: 7, driveFileId: DRIVE_ID }, undefined, "source-revision-unresolvable"],
    ];
    for (const [label, input, readImage, reason] of cases) {
      const r = await admitSuppliedDriveImage(acmeCtx, input, { ...deps, readImage: readImage ?? (async () => { throw new Error("Drive must not be read"); }) });
      assert.equal(r.status === "refused" && r.reason, reason, `${label}: ${JSON.stringify(r)}`);
      await unchanged(label);
    }
    const capRefused = await admitSuppliedDriveImage(
      acmeCtx,
      { artifactId: acmeDraft, revisionNo: 1, driveFileId: "otherFile000001" },
      { ...deps, readImage: async () => ({ status: "refused", reason: "capability-not-available" }) },
    );
    assert.equal(capRefused.status === "refused" && capRefused.reason, "drive-capability-not-available");
    const providerFailed = await admitSuppliedDriveImage(
      acmeCtx,
      { artifactId: acmeDraft, revisionNo: 1, driveFileId: "otherFile000001" },
      { ...deps, readImage: async () => ({ status: "provider-failed", failure: "malformed", reason: "google-file-type-unsupported" }) },
    );
    assert.equal(providerFailed.status === "refused" && providerFailed.reason, "drive-read-failed");
    assert.equal(providerFailed.status === "refused" && providerFailed.detail, "google-file-type-unsupported");
    await unchanged("Drive refusal / failure");
    assert.equal(
      (await admitSuppliedDriveImage(acmeCtx, { artifactId: acmeDraft, revisionNo: 1, driveFileId: DRIVE_ID }, {
        getDb: deps.getDb,
        resolveStorage: () => ({ status: "unavailable" as const, reason: "storage-not-connected" as const }),
        readImage: async () => { throw new Error("Drive must not be read without storage"); },
      })).status,
      "refused",
    );
    assert.deepEqual(await admitSuppliedDriveImage(null, { artifactId: acmeDraft, revisionNo: 1, driveFileId: DRIVE_ID }, deps), { status: "refused", reason: "unauthenticated" });

    /* A store that keeps different bytes than were written: refused, no row. */
    const lying = createMemoryMediaObjectStore();
    const lyingStore = { ...lying, verify: async () => ({ status: "present" as const, byteSize: 1, sha256Hex: sha("other") }) };
    const photo2 = await cameraJpeg(40, 30, 10);
    const mismatch = await admitSuppliedDriveImage(
      acmeCtx,
      { artifactId: acmeDraft, revisionNo: 1, driveFileId: "integrityFile01" },
      { getDb: deps.getDb, resolveStorage: () => ({ status: "available" as const, store: lyingStore }), readImage: driveReturns(photo2, "image/jpeg", "integrityFile01").readImage },
    );
    assert.equal(mismatch.status === "refused" && mismatch.reason, "integrity-mismatch");
    assert.equal(await assetRows(), before.rows, "integrity mismatch: no row");

    /* ══ 3. CROSS-TENANT ══ */
    const crossSupply = await admitSuppliedDriveImage(
      globexCtx,
      { artifactId: acmeDraft, revisionNo: 1, driveFileId: DRIVE_ID },
      { ...deps, readImage: async () => { throw new Error("Drive must not be read for another tenant's draft"); } },
    );
    assert.equal(crossSupply.status === "refused" && crossSupply.reason, "source-revision-unresolvable");
    assert.deepEqual(await readMediaAsset(globexCtx, asset.assetId, deps), { status: "not-found" }, "another tenant cannot read it");
    const globexListing = await listArtifactMediaAssets(globexCtx, { artifactIds: [acmeDraft] }, deps);
    assert.deepEqual(globexListing, { status: "read", assets: [] });

    /* ══ 4. GALLERY TRUTH ══ */
    const opened = await readMediaAsset(acmeCtx, asset.assetId, deps);
    assert.equal(opened.status, "read");
    if (opened.status === "read") {
      assert.equal(opened.asset.origin, "supplied");
      assert.equal(opened.asset.sourceArtifactId, acmeDraft);
      for (const field of ["provider", "model", "transport", "agentId", "invocationId", "inputDigest"]) {
        assert.ok(!(field in opened.asset), `a supplied record carries no ${field}`);
      }
    }
    const revList = await listRevisionMediaAssets(acmeCtx, { artifactId: acmeDraft, revisionNo: 1 }, deps);
    assert.equal(revList.status === "read" && revList.assets.length, 1);
    assert.equal(revList.status === "read" && revList.assets[0]!.origin, "supplied");

    /* ══ 5. REVIEW AND COMPOSER DO NOT TAKE IT ══ */
    const review = await acceptMediaAsset(
      acmeCtx,
      { assetId: asset.assetId, byteDigest: asset.byteDigest, justification: "This photo is right for the post." },
      deps,
    );
    assert.equal(review.status, "refused", JSON.stringify(review));
    assert.equal(await count("select count(*)::int n from decision_records where subject_type='media_asset'"), 0, "no review decision");
    const selection = await selectMediaForRevision(acmeCtx, { artifactId: acmeDraft, revisionNo: 1, mediaAssetId: asset.assetId }, deps);
    assert.equal(selection.status, "refused", JSON.stringify(selection));

    /* ══ 6. THE PUBLISH DERIVATIVE — still derived, even though the source is already JPEG ══ */
    const derived = await derivePublishJpeg(acmeCtx, { originalAssetId: asset.assetId }, deps);
    assert.equal(derived.status, "derived", JSON.stringify(derived));
    const derivative = derived.status === "derived" ? derived.derivative : null!;
    assert.equal(derivative.assetId, publishDerivativeId(acme.tenantId, asset.assetId));
    assert.equal(derivative.derivedFromAssetId, asset.assetId);
    const derivedBytes = store.objects.get(`tenants/${acme.tenantId}/media/${derivative.assetId}`)!.bytes;
    assert.equal((await sharp(derivedBytes).metadata()).exif, undefined, "camera EXIF stripped");
    assert.equal(Buffer.from(derivedBytes).includes("TRH-CAMERA-EXIF-MARKER"), false);
    assert.equal(sha(store.objects.get(key)!.bytes), sha(photo), "the supplied original is unchanged");
    const lineage = await selectPublishLineage(handle.db, acme.tenantId, {
      originalAssetId: asset.assetId,
      originalDigest: asset.byteDigest,
      derivedAssetId: derivative.assetId,
      derivedDigest: derivative.byteDigest,
    });
    assert.equal(lineage.status, "verified", "lineage from a supplied original verifies");
    assert.equal(
      (await selectPublishLineage(handle.db, acme.tenantId, {
        originalAssetId: asset.assetId, originalDigest: sha("wrong"), derivedAssetId: derivative.assetId, derivedDigest: derivative.byteDigest,
      })).status,
      "refused",
      "a wrong original digest does not verify",
    );
    assert.deepEqual(
      await derivePublishJpeg(acmeCtx, { originalAssetId: derivative.assetId }, deps),
      { status: "refused", reason: "source-not-original" },
      "derived of derived refused",
    );
    const galleryAfter = await listArtifactMediaAssets(acmeCtx, { artifactIds: [acmeDraft] }, deps);
    assert.deepEqual(galleryAfter.status === "read" && galleryAfter.assets.map((a) => a.assetId), [asset.assetId], "the derivative stays out of the gallery");
    assert.deepEqual(await readMediaAsset(acmeCtx, derivative.assetId, deps), { status: "not-found" });

    /* ══ 7. `/publish` — a supplied original binds to ITS draft, and nothing is authorized ══ */
    await setup.query(
      `insert into integrations (tenant_id, provider_key, name, status, connection_state, health,
                                 scopes, external_account_id, created_by, created_by_type)
       values ($1,'instagram','instagram','connected','connected','healthy',$2::jsonb,$3,$4,'human')`,
      [acme.tenantId, JSON.stringify(["instagram_business_basic", "instagram_business_content_publish"]), APP_ID, acme.userId],
    );
    const run = (args: string[]) =>
      runHebyProposeCommand({ commandId: "publish", args }, { ...deps, resolveTenant: async () => acmeCtx });
    const otherDraft = await draft(acme);
    const wrongDraft = await run([formatWorkArtifactRef(otherDraft, 1), asset.assetId]);
    assert.equal(
      wrongDraft.status === "ok" && wrongDraft.result.status === "refused" && wrongDraft.result.reason,
      "media-not-of-this-draft",
      JSON.stringify(wrongDraft),
    );
    const ok = await run([formatWorkArtifactRef(acmeDraft, 1), asset.assetId]);
    assert.equal(ok.status === "ok" && ok.result.status, "proposed", JSON.stringify(ok));
    const req = (await setup.query<{ status: string; canonical_payload: Record<string, string> }>(
      "select status, canonical_payload from heby_action_requests",
    )).rows;
    assert.equal(req.length, 1);
    assert.equal(req[0]!.status, "pending");
    assert.equal(req[0]!.canonical_payload.mediaAssetRef, asset.assetId);
    assert.equal(req[0]!.canonical_payload.mediaAssetDigest, asset.byteDigest);
    assert.equal(req[0]!.canonical_payload.publishAssetRef, derivative.assetId);
    assert.equal(req[0]!.canonical_payload.publishAssetDigest, derivative.byteDigest);
    assert.equal(await count("select count(*)::int n from action_permits"), 0, "no permit");
    assert.equal(await count("select count(*)::int n from action_execution_attempts"), 0, "no execution attempt");
    assert.equal(store.readGrants.length, 1, "only the one verified preview grant above was ever minted");
    assert.equal(networkCalls, 0, "no Drive, Meta or any network call");

    console.log("PASS media-supplied (postgres, real sharp, in-memory store, faked Drive)");
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
