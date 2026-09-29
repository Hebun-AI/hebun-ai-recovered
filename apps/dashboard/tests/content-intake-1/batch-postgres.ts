/*
 * CONTENT-INTAKE-1 — ONE Picker ceremony's files, admitted one by one through the released Media
 * admissions, against real (disposable) Postgres.
 *
 * Real: migrations, Integration authority, INT-2 credentials, the Google bind, the signed Picker binding
 * and its resolver, the Drive image read and video relay seams (Google answered by bearer token and
 * counted per file), the supplied image and video admissions (video through the local VPS store with
 * real ffprobe over a real H.264 MP4), the DATA-USE gate and the reference-edit path. No real network.
 *
 * THE CLAIM:
 *
 *   "One binding, one draft, one revision, many files: each file is admitted or refused on its own,
 *    every new row names the ONE bound connection, a refused file never hides an admitted one and an
 *    admitted file never hides a refused one, a repeat is not a second row, the server bound and every
 *    binding defect refuse before any Drive read, no other connection or tenant is ever used, and the
 *    batch creates nothing but media rows — no review, selection, request, permit, attempt, invocation
 *    or Knowledge — while batch-admitted media stays NOT cleared for external generative use."
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { Client } from "pg";
import sharp from "sharp";
// Loaded FIRST: the schema barrel is the only safe entry point for src/db/schema/*.
import { createControlPlaneDb, type ControlPlaneDatabase } from "../../src/db/client.server";
import { createConnection } from "../../src/features/integration-authority/integration-repository.server";
import { GOOGLE_OAUTH_ENV_KEYS } from "../../src/features/provider-google/google-environment.server";
import { commitGoogleGrant } from "../../src/features/provider-google/bind-google-grant.server";
import { GOOGLE_PROVIDER_KEY } from "../../src/features/provider-google/contracts";
import { INTEGRATION_ENCRYPTION_ENV_KEYS } from "../../src/features/secret-encryption/key-registry.server";
import { resolveBoundDriveFileConnection, sealPickerBinding } from "../../src/features/provider-google/picker-connection-binding.server";
import { readDriveImage } from "../../src/features/provider-google/read-drive-image.server";
import { relayDriveVideo } from "../../src/features/provider-google/relay-drive-video.server";
import { admitSuppliedDriveImage } from "../../src/features/media-assets/admit-supplied-drive-image.server";
import { admitSuppliedDriveVideo } from "../../src/features/media-assets/admit-supplied-drive-video.server";
import { readSuppliedSourceProvenance } from "../../src/features/media-assets/read-supplied-source-provenance.server";
import { requestMediaGeneration } from "../../src/features/media-assets/request-media-generation.server";
import { resolveExternalGenerativeEligibility } from "../../src/features/media-assets/external-generative-eligibility.server";
import { isExternalGenerativeUseCleared } from "../../src/features/media-assets/external-generative-data-use";
import { mediaAssetStorageKey } from "../../src/features/media-assets/contracts";
import { createVpsMediaStorageV2 } from "../../src/features/media-assets/vps-media-storage-v2.server";
import { OPENAI_IMAGE_PROVIDER } from "../../src/features/media-generation-live/openai-image-transport.server";
import { HIGGSFIELD_PROVIDER } from "../../src/features/media-generation-live/higgsfield-video-transport.server";
import { admitSuppliedDriveBatch } from "../../src/features/content-intake/admit-supplied-drive-batch.server";
import type { SuppliedDriveBatchKind } from "../../src/features/content-intake/contracts";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createFakeMediaGenerationTransport, createMemoryMediaObjectStore } from "../helpers/media-fakes";
import { startLocalVpsStore, type LocalVpsStore } from "../helpers/media-vps-store-process";
import { seedTenant, type Tenant } from "../mv4-async-generation/scenarios";

const localFetch = globalThis.fetch;
const localhostOnly = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const host = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") throw new Error(`REAL NETWORK REACHED: ${host}`);
  return localFetch(input, init);
}) as typeof fetch;
globalThis.fetch = (() => {
  throw new Error("REAL NETWORK REACHED");
}) as typeof fetch;

const NOW = new Date("2026-09-29T18:00:00.000Z");
const ACCOUNT_1 = { sub: "111111111111111111111", email: "owner@acme.test" };
const ACCOUNT_2 = { sub: "222222222222222222222", email: "second@acme.test" };
const ACCOUNT_3 = { sub: "333333333333333333333", email: "owner@globex.test" };
const TOKEN = { A: "ci1-access-A", B: "ci1-access-B", C: "ci1-access-C" } as const;
const REFRESH = { A: "ci1-refresh-A", B: "ci1-refresh-B", C: "ci1-refresh-C" } as const;
const FFMPEG = execFileSync("sh", ["-c", "command -v ffmpeg || true"], { encoding: "utf8" }).trim();
const FFPROBE = execFileSync("sh", ["-c", "command -v ffprobe || true"], { encoding: "utf8" }).trim();

const ENV = {
  [INTEGRATION_ENCRYPTION_ENV_KEYS.keys]: `k1:${randomBytes(32).toString("base64")}`,
  [INTEGRATION_ENCRYPTION_ENV_KEYS.activeKeyId]: "k1",
  [GOOGLE_OAUTH_ENV_KEYS.clientId]: "ci1-fixture.apps.googleusercontent.com",
  [GOOGLE_OAUTH_ENV_KEYS.clientSecret]: "ci1-fixture-client-secret",
  [GOOGLE_OAUTH_ENV_KEYS.redirectUri]: "http://localhost:3000/api/integrations/google/callback",
  [GOOGLE_OAUTH_ENV_KEYS.stateSecret]: "ci1-fixture-state-secret-0123456789abcdef",
};
const SCOPES = Object.freeze([
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/drive.file",
]);

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("content-intake-1 batch-postgres: exited before completing");
    process.exitCode = 1;
  }
});

function synthVideo(seconds: number): Uint8Array {
  const dir = mkdtempSync(path.join(tmpdir(), "ci1-"));
  const out = path.join(dir, "x.mp4");
  execFileSync(FFMPEG, ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", `testsrc2=size=320x240:rate=24:duration=${seconds}`, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", "-brand", "mp42", out]);
  const bytes = new Uint8Array(readFileSync(out));
  rmSync(dir, { recursive: true, force: true });
  return bytes;
}

const jpegOf = async (r: number) => new Uint8Array(await sharp({ create: { width: 40, height: 30, channels: 3, background: { r, g: 90, b: 160 } } }).jpeg().toBuffer());

/** Every table's row count — the side-effect ledger. */
async function tableCounts(client: Client): Promise<Record<string, number>> {
  const tables = (await client.query(`select tablename from pg_tables where schemaname='public' order by 1`)).rows.map((r) => r.tablename as string);
  const out: Record<string, number> = {};
  for (const t of tables) out[t] = Number((await client.query(`select count(*)::int n from "${t}"`)).rows[0].n);
  return out;
}

async function main(): Promise<void> {
  assert.ok(FFMPEG && FFPROBE, "ffmpeg and ffprobe are required");

  /* ── Drive, as Google would answer it: each file belongs to one account; counted per file id. ── */
  type DriveFile = { owner: string; mime: string; bytes: Uint8Array; declaredSize?: number };
  const png = new Uint8Array(await sharp({ create: { width: 20, height: 20, channels: 3, background: { r: 1, g: 2, b: 3 } } }).png().toBuffer());
  const files: Record<string, DriveFile> = {
    "1ImgOne000000000000000000": { owner: TOKEN.A, mime: "image/jpeg", bytes: await jpegOf(10) },
    "1ImgTwo000000000000000000": { owner: TOKEN.A, mime: "image/jpeg", bytes: await jpegOf(60) },
    "1ImgThree0000000000000000": { owner: TOKEN.A, mime: "image/jpeg", bytes: await jpegOf(110) },
    "1ImgFour00000000000000000": { owner: TOKEN.A, mime: "image/jpeg", bytes: await jpegOf(160) },
    "1ImgFive00000000000000000": { owner: TOKEN.A, mime: "image/jpeg", bytes: await jpegOf(210) },
    "1ImgSingle000000000000000": { owner: TOKEN.A, mime: "image/jpeg", bytes: await jpegOf(250) },
    "1ImgOfAccountTwo00000000": { owner: TOKEN.B, mime: "image/jpeg", bytes: await jpegOf(30) },
    "1ImgNotAnImage0000000000": { owner: TOKEN.A, mime: "image/jpeg", bytes: new TextEncoder().encode("this is plain text, not a jpeg at all") },
    "1ImgPngClaimsJpeg0000000": { owner: TOKEN.A, mime: "image/jpeg", bytes: png },
    "1ImgTooLarge000000000000": { owner: TOKEN.A, mime: "image/jpeg", bytes: await jpegOf(5), declaredSize: 21 * 1024 * 1024 },
    "1ImgIsAPdf00000000000000": { owner: TOKEN.A, mime: "application/pdf", bytes: new TextEncoder().encode("%PDF-1.4") },
    "1VidOne000000000000000000": { owner: TOKEN.A, mime: "video/mp4", bytes: synthVideo(1) },
    "1VidTwo000000000000000000": { owner: TOKEN.A, mime: "video/mp4", bytes: synthVideo(2) },
    "1VidNotAVideo00000000000": { owner: TOKEN.A, mime: "video/mp4", bytes: await jpegOf(90) },
  };
  const perFile: Record<string, number> = {};
  const perToken: Record<string, number> = {};
  const driveFetch = (async (url: string, init?: RequestInit) => {
    const h = (init?.headers ?? {}) as Record<string, string>;
    const token = (h.Authorization ?? h.authorization ?? "").replace(/^Bearer /, "");
    const u = new URL(url);
    const id = decodeURIComponent(u.pathname.split("/").pop() ?? "");
    perToken[token] = (perToken[token] ?? 0) + 1;
    perFile[id] = (perFile[id] ?? 0) + 1;
    const f = files[id];
    if (!f || f.owner !== token) return new Response(JSON.stringify({ error: { code: 404 } }), { status: 404, headers: { "content-type": "application/json" } });
    if (u.searchParams.get("alt") === "media") return new Response(f.bytes as BodyInit, { status: 200 });
    return new Response(JSON.stringify({ id, name: `${id}.bin`, mimeType: f.mime, size: String(f.declaredSize ?? f.bytes.byteLength) }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as never;
  const driveCalls = () => Object.values(perToken).reduce((a, b) => a + b, 0);
  const reset = () => {
    for (const k of Object.keys(perFile)) delete perFile[k];
    for (const k of Object.keys(perToken)) delete perToken[k];
  };

  const harness = createDisposablePostgresHarness("hebun_ci1_batch");
  await harness.createDatabase();
  const client = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const getDb = (): ControlPlaneDatabase => handle.db;
  let vps: LocalVpsStore | undefined;
  try {
    harness.migrateDatabase();
    await client.connect();
    vps = await startLocalVpsStore({ HEBUN_MEDIA_STORE_ENABLE_VIDEO: "1", HEBUN_MEDIA_STORE_FFPROBE: FFPROBE, HEBUN_MEDIA_STORE_FFMPEG: FFMPEG });
    const store = vps;
    const acme: Tenant = await seedTenant(client, getDb, "Acme");
    const globex: Tenant = await seedTenant(client, getDb, "Globex");

    const connect = async (t: Tenant, account: { sub: string; email: string }, access: string, refresh: string, at: Date) => {
      const created = await createConnection(t.ctx, { providerKey: GOOGLE_PROVIDER_KEY, name: `Google ${account.email}` }, { getDb, now: () => at });
      assert.ok(created.status === "created");
      const id = created.connection.integrationId;
      const userinfo = (async () => new Response(JSON.stringify({ sub: account.sub, email: account.email, email_verified: true }), { status: 200, headers: { "content-type": "application/json" } })) as never;
      assert.equal(await commitGoogleGrant(t.ctx, id, { accessToken: access, refreshToken: refresh, expiresAt: null, grantedScopes: SCOPES }, at, { getDb, env: ENV, fetchImpl: userinfo }), "connected");
      return id;
    };
    /* A is created FIRST, so a "first available" lookup would pick A; B is the one bound in the no-fallback cases. */
    const A = await connect(acme, ACCOUNT_1, TOKEN.A, REFRESH.A, new Date(NOW.getTime() - 60_000));
    const B = await connect(acme, ACCOUNT_2, TOKEN.B, REFRESH.B, NOW);
    const C = await connect(globex, ACCOUNT_3, TOKEN.C, REFRESH.C, NOW);
    const bind = (t: Tenant, id: string, sub: string, nowSeconds?: () => number) =>
      sealPickerBinding(t.ctx, { integrationId: id, externalAccountId: sub }, { env: ENV, ...(nowSeconds ? { nowSeconds } : {}) })!;
    const bA = bind(acme, A, ACCOUNT_1.sub);
    const bB = bind(acme, B, ACCOUNT_2.sub);

    const readDeps = { getDb, env: ENV, fetchImpl: driveFetch };
    const memory = createMemoryMediaObjectStore();
    const deps = {
      admitImage: (t: never, i: never) =>
        admitSuppliedDriveImage(t, i, { getDb, now: () => NOW, resolveStorage: () => ({ status: "available", store: memory }), readImage: (tt, ii) => readDriveImage(tt, ii, readDeps) }),
      admitVideo: (t: never, i: never) =>
        admitSuppliedDriveVideo(t, i, {
          getDb,
          now: () => NOW,
          resolveStorageV2: () => ({ status: "available", client: createVpsMediaStorageV2({ origin: store.origin, writeSecret: store.writeSecret, readSecret: store.readSecret, fetchImpl: localhostOnly }) }),
          relayVideo: ((tt: never, ii: never, c: never) => relayDriveVideo(tt, ii, c, readDeps)) as never,
        }),
      resolveBinding: (t: never, b: string) => resolveBoundDriveFileConnection(t, b, { getDb, env: ENV }),
    };
    const batch = (kind: SuppliedDriveBatchKind, t: Tenant, ids: string[], binding: string, extra: Record<string, unknown> = {}) =>
      admitSuppliedDriveBatch(kind, t.ctx, { artifactId: t.draft, revisionNo: 1, driveFileIds: ids, pickerBinding: binding, ...extra } as never, deps as never);
    const rows = async () =>
      (await client.query(`select id, tenant_id, supplied_artifact_id a, supplied_revision_no r, supplied_source_integration_id s, supplied_by_actor_type actor, supplied_by_actor_id who, supplied_source_file_id f, media_kind k from media_assets order by admitted_at, id`)).rows as {
        id: string; tenant_id: string; a: string; r: number; s: string | null; actor: string; who: string; f: string; k: string;
      }[];
    const count = async () => (await rows()).length;

    /* A historical supplied row (before provenance was recorded) — must stay readable throughout. */
    const historical = randomUUID();
    await client.query(
      `insert into media_assets (id, tenant_id, mime_type, byte_size, byte_digest, width, height, storage_backend, storage_key, admitted_at,
         supplied_by_actor_type, supplied_by_actor_id, supplied_source, supplied_source_file_id, supplied_source_capability, supplied_artifact_id, supplied_revision_no)
       values ($1,$2,'image/jpeg',10,$3,40,30,'test-memory',$4, now(),'human',$5,'google-drive','1HistoricalFile','google.drive.file.content.read',$6,1)`,
      [historical, acme.tenantId, "b".repeat(64), mediaAssetStorageKey(acme.tenantId, historical), acme.ctx.userId, acme.draft],
    );

    const ledgerBefore = await tableCounts(client);
    const IMG = ["1ImgOne000000000000000000", "1ImgTwo000000000000000000", "1ImgThree0000000000000000"];

    /* ══ 1 + 3 + 4. SEVERAL IMAGES, ONE CEREMONY, ONE DRAFT REVISION, THE BOUND CONNECTION ══ */
    reset();
    const one = await batch("image", acme, IMG, bA);
    assert.ok(one.status === "processed", JSON.stringify(one));
    assert.deepEqual(one.summary, { requested: 3, admitted: 3, existing: 0, refused: 0, notAttempted: 0, duplicateSelections: 0 });
    assert.equal(one.stoppedBy, null);
    const imageIds = one.files.map((f) => (f.status === "admitted" ? f.assetId : ""));
    assert.equal(new Set(imageIds).size, 3, "three distinct assets");
    for (const r of (await rows()).filter((x) => imageIds.includes(x.id))) {
      assert.deepEqual(
        { tenant: r.tenant_id, a: r.a, r: r.r, s: r.s, actor: r.actor, who: r.who, k: r.k },
        { tenant: acme.tenantId, a: acme.draft, r: 1, s: A, actor: "human", who: acme.ctx.userId, k: "image" },
        "each row: this tenant, this draft revision, the bound connection, the human who supplied it",
      );
      const p = await readSuppliedSourceProvenance(acme.ctx, r.id, { getDb });
      assert.equal(p.status === "recorded" && p.externalAccountId, ACCOUNT_1.sub, "and the account read back through it is the chooser's");
    }
    assert.equal(perToken[TOKEN.B] ?? 0, 0, "B was never spent");

    /* ══ 2. SEVERAL VIDEOS, ONE CEREMONY ══ */
    reset();
    const vids = await batch("video", acme, ["1VidOne000000000000000000", "1VidTwo000000000000000000"], bA);
    assert.ok(vids.status === "processed", JSON.stringify(vids));
    assert.equal(vids.summary.admitted, 2, JSON.stringify(vids.files));
    for (const f of vids.files) {
      assert.ok(f.status === "admitted");
      const r = (await rows()).find((x) => x.id === f.assetId)!;
      assert.deepEqual([r.k, r.s, r.a, r.r], ["video", A, acme.draft, 1]);
    }

    /* ══ 11. RESUBMISSION AND DUPLICATE SELECTION ARE NOT NEW ROWS ══ */
    {
      const before = await count();
      reset();
      const again = await batch("image", acme, [IMG[0]!, IMG[0]!, IMG[1]!], bA);
      assert.ok(again.status === "processed");
      assert.deepEqual(again.files.map((f) => f.status), ["existing", "duplicate-selection", "existing"]);
      assert.equal(again.files[0]!.status === "existing" && again.files[0]!.assetId, imageIds[0], "the SAME asset, honestly called existing");
      assert.equal(await count(), before, "no duplicate media truth");
      assert.equal(perFile[IMG[0]!], 2, "the repeated id was read once (meta + content), not twice");
      const againVideo = await batch("video", acme, ["1VidOne000000000000000000"], bA);
      assert.ok(againVideo.status === "processed" && againVideo.files[0]!.status === "existing");
      assert.equal(await count(), before);
    }

    /* ══ 12–16. ONE BATCH, MIXED OUTCOMES: EVERY FILE TELLS ITS OWN TRUTH ══ */
    {
      const before = await count();
      reset();
      const mixed = await batch("image", acme, [
        "1ImgNotAnImage0000000000",
        "1ImgFour00000000000000000",
        "1ImgPngClaimsJpeg0000000",
        "1ImgTooLarge000000000000",
        "1ImgIsAPdf00000000000000",
        "1ImgOfAccountTwo00000000",
        "1ImgFive00000000000000000",
      ], bA);
      assert.ok(mixed.status === "processed");
      const got = mixed.files.map((f) => (f.status === "refused" ? `${f.status}:${f.reason}:${f.detail ?? ""}` : f.status));
      assert.deepEqual(got, [
        "refused:unsupported-image-signature:",
        "admitted",
        "refused:declared-type-mismatch:",
        "refused:drive-read-failed:google-file-too-large",
        "refused:drive-read-failed:google-file-type-unsupported",
        "refused:drive-read-failed:google-refused-404",
        "admitted",
      ]);
      assert.equal(mixed.stoppedBy, null, "file refusals do not stop the batch");
      assert.deepEqual(mixed.summary, { requested: 7, admitted: 2, existing: 0, refused: 5, notAttempted: 0, duplicateSelections: 0 });
      assert.equal(await count(), before + 2, "exactly the two valid files became rows");
      assert.equal(perToken[TOKEN.B] ?? 0, 0, "B's file was tried through A only — B never spent (no fallback)");
    }
    /* ══ 17. AN INVALID VIDEO IS REFUSED; THE VALID ONE BESIDE IT IS NOT HIDDEN ══ */
    {
      reset();
      const v = await batch("video", acme, ["1VidNotAVideo00000000000", "1VidTwo000000000000000000"], bA);
      assert.ok(v.status === "processed");
      assert.equal(v.files[0]!.status, "refused");
      assert.ok(v.files[0]!.status === "refused" && ["probe-failed", "video-not-admissible"].includes(v.files[0]!.reason), JSON.stringify(v.files[0]));
      assert.equal(v.files[1]!.status, "existing");
    }

    /* ══ 7–10, 18. BATCH REFUSALS HAPPEN BEFORE ANY DRIVE READ AND LEAVE NO ROW ══ */
    const refusedBeforeRead = async (label: string, run: () => Promise<unknown>, expected: unknown) => {
      const before = await count();
      reset();
      assert.deepEqual(await run(), expected, label);
      assert.equal(driveCalls(), 0, `${label}: no Drive call at all`);
      assert.equal(await count(), before, `${label}: no row`);
    };
    await refusedBeforeRead("server bound (images)", () => batch("image", acme, Array.from({ length: 11 }, () => IMG[0]!), bA), { status: "refused", reason: "batch-too-large", detail: "max-10" });
    await refusedBeforeRead("server bound (videos)", () => batch("video", acme, Array.from({ length: 4 }, () => "1VidOne000000000000000000"), bA), { status: "refused", reason: "batch-too-large", detail: "max-3" });
    {
      const [body, sig] = bA.split(".") as [string, string];
      const forged = `${Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString()), integrationId: B, externalAccountId: ACCOUNT_2.sub })).toString("base64url")}.${sig}`;
      await refusedBeforeRead("forged binding", () => batch("image", acme, [IMG[2]!, "1ImgOfAccountTwo00000000"], forged), { status: "refused", reason: "drive-connection-not-bound", detail: "binding-signature-invalid" });
    }
    {
      const expired = bind(acme, A, ACCOUNT_1.sub, () => Math.floor(Date.now() / 1000) - 3600);
      await refusedBeforeRead("expired binding", () => batch("image", acme, [IMG[2]!], expired), { status: "refused", reason: "drive-connection-not-bound", detail: "binding-expired" });
    }
    await refusedBeforeRead("another session's binding", () => batch("image", globex, [IMG[2]!], bA), { status: "refused", reason: "drive-connection-not-bound", detail: "binding-context-mismatch" });
    await refusedBeforeRead("a binding naming another tenant's connection", () => batch("image", acme, [IMG[2]!], bind(acme, C, ACCOUNT_3.sub)), {
      status: "refused",
      reason: "drive-capability-not-available",
      detail: "bound-connection-unavailable",
    });
    await client.query(`update integrations set external_account_id='999999999999999999999' where id=$1`, [B]);
    await refusedBeforeRead("account mismatch (B), with A healthy", () => batch("image", acme, ["1ImgOfAccountTwo00000000"], bB), { status: "refused", reason: "drive-connection-not-bound", detail: "bound-account-mismatch" });
    assert.equal(perToken[TOKEN.A] ?? 0, 0, "A was not used as a fallback for B");
    await client.query(`update integrations set external_account_id=$2 where id=$1`, [B, ACCOUNT_2.sub]);
    await client.query(`update integrations set scopes=$2::jsonb where id=$1`, [B, JSON.stringify(SCOPES.filter((s) => !s.endsWith("drive.file")))]);
    await refusedBeforeRead("capability loss (B), with A healthy", () => batch("image", acme, ["1ImgOfAccountTwo00000000"], bB), { status: "refused", reason: "drive-capability-not-available", detail: "bound-connection-unavailable" });
    await client.query(`update integrations set scopes=$2::jsonb where id=$1`, [B, JSON.stringify(SCOPES)]);

    /* ══ 19–20. NOTHING THE CLIENT SENDS CHOOSES THE TENANT OR THE CONNECTION ══ */
    {
      reset();
      const smuggled = await batch("image", acme, ["1ImgOfAccountTwo00000000"], bB, {
        tenantId: globex.tenantId,
        integrationId: A,
        suppliedSourceIntegrationId: A,
        externalAccountId: ACCOUNT_1.sub,
        kind: "video",
      });
      assert.ok(smuggled.status === "processed" && smuggled.files[0]!.status === "admitted", JSON.stringify(smuggled));
      const row = (await rows()).find((r) => smuggled.files[0]!.status === "admitted" && r.id === smuggled.files[0]!.assetId)!;
      assert.deepEqual([row.tenant_id, row.s, row.k], [acme.tenantId, B, "image"], "session tenant, bound connection, the action's kind");
      assert.equal(perToken[TOKEN.A] ?? 0, 0);
    }

    /* ══ 21. THE SINGLE-FILE DOOR IS UNCHANGED ══ */
    {
      const single = await deps.admitImage(acme.ctx as never, { artifactId: acme.draft, revisionNo: 1, driveFileId: "1ImgSingle000000000000000", pickerBinding: bA } as never);
      assert.equal(single.status, "admitted");
      assert.equal(single.status === "admitted" && single.asset.suppliedSourceIntegrationId, A);
    }

    /* ══ 23–28. THE BATCH CREATED MEDIA ROWS AND NOTHING ELSE ══ */
    {
      const after = await tableCounts(client);
      const changed = Object.keys(after).filter((t) => after[t] !== ledgerBefore[t]).sort();
      assert.deepEqual(changed, ["media_assets"], `only media_assets gained rows (changed: ${changed.join(", ")})`);
    }

    /* ══ 22. DATA-USE: batch-admitted media is NOT cleared for any external generative use ══ */
    {
      const img = imageIds[0]!;
      for (const [provider, purpose] of [[OPENAI_IMAGE_PROVIDER, "reference-edit"], [HIGGSFIELD_PROVIDER, "image-to-video"]] as const) {
        const verdict = await resolveExternalGenerativeEligibility(getDb(), acme.tenantId, img, { provider, purpose });
        assert.equal(isExternalGenerativeUseCleared(verdict), false, `${provider}/${purpose}: not cleared`);
      }
      const openai = createFakeMediaGenerationTransport({ kind: "bytes", bytes: files[IMG[0]!]!.bytes });
      (openai as { provider: string }).provider = OPENAI_IMAGE_PROVIDER;
      const edit = await requestMediaGeneration(
        acme.ctx,
        { artifactId: acme.draft, revisionNo: 1, promptText: "Plain linen background.", requestKey: randomUUID(), sourceAssetId: img },
        { getDb, now: () => NOW, resolveStorage: () => ({ status: "available", store: memory }), resolveTransport: () => ({ status: "available", transport: openai }) },
      );
      assert.deepEqual(edit, { status: "refused", reason: "source-data-use-not-cleared" }, "the reference edit refuses a batch-admitted image");
      assert.equal(openai.calls.length, 0, "and no generative call was made");
    }

    /* ══ 29. HISTORICAL ROWS ARE STILL READABLE ══ */
    assert.deepEqual(await readSuppliedSourceProvenance(acme.ctx, historical, { getDb }), { status: "unknown" });

    /* ══ 30. NO TOKEN, BINDING OR SECRET IS STORED ANYWHERE ══ */
    {
      const dump = (await client.query(`select to_jsonb(m)::text j from media_assets m`)).rows.map((r) => r.j as string).join("\n");
      for (const secret of [...Object.values(TOKEN), ...Object.values(REFRESH), bA, bB, ENV[GOOGLE_OAUTH_ENV_KEYS.stateSecret]!, ACCOUNT_1.email, ACCOUNT_1.sub]) {
        assert.ok(!dump.includes(secret), "no credential, binding, secret, e-mail or account id on media_assets");
      }
    }
  } finally {
    await vps?.dispose().catch(() => undefined);
    await client.end().catch(() => undefined);
    await handle.dispose().catch(() => undefined);
    await harness.dropDatabase();
  }
  finished = true;
  console.log("content-intake-1 batch-postgres: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
