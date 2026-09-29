/*
 * SUPPLIED-MEDIA-ACCOUNT-PROVENANCE-1 — an admitted supplied asset names, durably, the tenant's own Google
 * connection its bytes were read through; the account is that connection's, kept by the Integration
 * authority.
 *
 * Real (disposable) Postgres with the new migration applied, the real Integration authority, real INT-2
 * credentials, the released Google bind, the real Picker binding, the REAL Drive read seams (Google
 * answered by bearer token, counted), the real supplied image AND video admissions (video through the
 * local VPS store with real ffprobe over a real H.264 MP4), the real retire writer, and the real
 * MEDIA-1 generation path for a generated row. No real network.
 *
 * THE CLAIM:
 *
 *   "Image and video admissions record exactly the connection their read ran under — A for an A
 *    binding, B for a B binding — and the account read back through it is that connection's. An A
 *    binding cannot produce a B record; nothing a client sends can choose the value; another tenant's
 *    connection is unrepresentable; account change and capability loss refuse before any row. A
 *    generated row can carry no source connection; a historical supplied row reads UNKNOWN. Retiring
 *    the asset, rotating the connection's credential, or the connection going disconnected/revoked
 *    changes nothing recorded, and the connection row cannot be deleted while an asset names it. No
 *    token, binding or secret is stored."
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
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
import { sealPickerBinding } from "../../src/features/provider-google/picker-connection-binding.server";
import { readDriveImage } from "../../src/features/provider-google/read-drive-image.server";
import { relayDriveVideo } from "../../src/features/provider-google/relay-drive-video.server";
import { admitSuppliedDriveImage } from "../../src/features/media-assets/admit-supplied-drive-image.server";
import { admitSuppliedDriveVideo } from "../../src/features/media-assets/admit-supplied-drive-video.server";
import { readSuppliedSourceProvenance } from "../../src/features/media-assets/read-supplied-source-provenance.server";
import { retireMediaAsset } from "../../src/features/media-assets/retire-media-asset.server";
import { requestMediaGeneration } from "../../src/features/media-assets/request-media-generation.server";
import { mediaAssetStorageKey } from "../../src/features/media-assets/contracts";
import { createVpsMediaStorageV2 } from "../../src/features/media-assets/vps-media-storage-v2.server";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createFakeMediaGenerationTransport, createMemoryMediaObjectStore } from "../helpers/media-fakes";
import { startLocalVpsStore, type LocalVpsStore } from "../helpers/media-vps-store-process";
import { seedTenant, type Tenant } from "../mv4-async-generation/scenarios";

/* The local VPS store is reached with the real fetch, on localhost only; anything else is a failure. */
const localFetch = globalThis.fetch;
const localhostOnly = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const host = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") throw new Error(`REAL NETWORK REACHED: ${host}`);
  return localFetch(input, init);
}) as typeof fetch;
globalThis.fetch = (() => {
  throw new Error("REAL NETWORK REACHED");
}) as typeof fetch;

const NOW = new Date("2026-09-29T14:00:00.000Z");
const ACCOUNT_1 = { sub: "111111111111111111111", email: "owner@acme.test" };
const ACCOUNT_2 = { sub: "222222222222222222222", email: "second@acme.test" };
const ACCOUNT_3 = { sub: "333333333333333333333", email: "owner@globex.test" };
const TOKEN = { A: "smap-access-A", B: "smap-access-B", C: "smap-access-C", A2: "smap-access-A-rotated" } as const;
const REFRESH = { A: "smap-refresh-A", B: "smap-refresh-B", C: "smap-refresh-C" } as const;
const FILE = { A: "1ImageOfAccountOne000000000", B: "1ImageOfAccountTwo000000000" } as const;
const VIDEO = { A: "1VideoOfAccountOne000000000", B: "1VideoOfAccountTwo000000000" } as const;
const FFMPEG = execFileSync("sh", ["-c", "command -v ffmpeg || true"], { encoding: "utf8" }).trim();
const FFPROBE = execFileSync("sh", ["-c", "command -v ffprobe || true"], { encoding: "utf8" }).trim();

const ENV = {
  [INTEGRATION_ENCRYPTION_ENV_KEYS.keys]: `k1:${randomBytes(32).toString("base64")}`,
  [INTEGRATION_ENCRYPTION_ENV_KEYS.activeKeyId]: "k1",
  [GOOGLE_OAUTH_ENV_KEYS.clientId]: "smap-fixture.apps.googleusercontent.com",
  [GOOGLE_OAUTH_ENV_KEYS.clientSecret]: "smap-fixture-client-secret",
  [GOOGLE_OAUTH_ENV_KEYS.redirectUri]: "http://localhost:3000/api/integrations/google/callback",
  [GOOGLE_OAUTH_ENV_KEYS.stateSecret]: "smap-fixture-state-secret-0123456789abcdef",
};
const SCOPES = Object.freeze([
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/drive.file",
]);
const strip = (c: string): string => c.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("supplied-media-account-provenance-1: exited before completing");
    process.exitCode = 1;
  }
});

function synthVideo(): Uint8Array {
  const dir = mkdtempSync(path.join(tmpdir(), "smap-"));
  const out = path.join(dir, "x.mp4");
  execFileSync(FFMPEG, ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=320x240:rate=24:duration=1", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", "-brand", "mp42", out]);
  const bytes = new Uint8Array(readFileSync(out));
  rmSync(dir, { recursive: true, force: true });
  return bytes;
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

async function main(): Promise<void> {
  assert.ok(FFMPEG && FFPROBE, "ffmpeg and ffprobe are required");
  const jpeg = new Uint8Array(await sharp({ create: { width: 40, height: 30, channels: 3, background: { r: 20, g: 90, b: 160 } } }).jpeg().toBuffer());
  const mp4 = synthVideo();

  const calls: Record<string, number> = {};
  const owner: Record<string, string> = { [FILE.A]: TOKEN.A, [FILE.B]: TOKEN.B, [VIDEO.A]: TOKEN.A, [VIDEO.B]: TOKEN.B };
  const driveFetch = (async (url: string, init?: RequestInit) => {
    const h = (init?.headers ?? {}) as Record<string, string>;
    const token = (h.Authorization ?? h.authorization ?? "").replace(/^Bearer /, "");
    calls[token] = (calls[token] ?? 0) + 1;
    const u = new URL(url);
    const id = decodeURIComponent(u.pathname.split("/").pop() ?? "");
    const mine = owner[id] === token || (token === TOKEN.A2 && owner[id] === TOKEN.A);
    if (!mine) return new Response(JSON.stringify({ error: { code: 404 } }), { status: 404, headers: { "content-type": "application/json" } });
    const isVideo = id.startsWith("1Video");
    if (u.searchParams.get("alt") === "media") return new Response((isVideo ? mp4 : jpeg) as BodyInit, { status: 200 });
    return new Response(JSON.stringify({ id, name: isVideo ? "clip.mp4" : "photo.jpg", mimeType: isVideo ? "video/mp4" : "image/jpeg", size: String(isVideo ? mp4.byteLength : jpeg.byteLength) }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as never;
  const resetCalls = () => {
    for (const k of Object.keys(calls)) delete calls[k];
  };

  const harness = createDisposablePostgresHarness("hebun_smap1");
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
      return { id, userinfo };
    };
    const A = await connect(acme, ACCOUNT_1, TOKEN.A, REFRESH.A, new Date(NOW.getTime() - 60_000));
    const B = await connect(acme, ACCOUNT_2, TOKEN.B, REFRESH.B, NOW);
    const C = await connect(globex, ACCOUNT_3, TOKEN.C, REFRESH.C, NOW);
    const bind = (t: Tenant, id: string, sub: string) => sealPickerBinding(t.ctx, { integrationId: id, externalAccountId: sub }, { env: ENV })!;
    const bA = bind(acme, A.id, ACCOUNT_1.sub);
    const bB = bind(acme, B.id, ACCOUNT_2.sub);

    const readDeps = { getDb, env: ENV, fetchImpl: driveFetch };
    const memory = createMemoryMediaObjectStore();
    const admitImage = (t: Tenant, fileId: string, pickerBinding: string, extra: Record<string, unknown> = {}) =>
      admitSuppliedDriveImage(t.ctx, { artifactId: t.draft, revisionNo: 1, driveFileId: fileId, pickerBinding, ...extra } as never, {
        getDb,
        now: () => NOW,
        resolveStorage: () => ({ status: "available", store: memory }),
        readImage: (tt, i) => readDriveImage(tt, i, readDeps),
      });
    const admitVideo = (t: Tenant, fileId: string, pickerBinding: string) =>
      admitSuppliedDriveVideo(t.ctx, { artifactId: t.draft, revisionNo: 1, driveFileId: fileId, pickerBinding }, {
        getDb,
        now: () => NOW,
        resolveStorageV2: () => ({ status: "available", client: createVpsMediaStorageV2({ origin: store.origin, writeSecret: store.writeSecret, readSecret: store.readSecret, fetchImpl: localhostOnly }) }),
        relayVideo: ((tt: never, i: never, c: never) => relayDriveVideo(tt, i, c, readDeps)) as never,
      });
    const rowOf = async (id: string) =>
      (await client.query(`select supplied_source_integration_id s, asset_lifecycle_status l from media_assets where id=$1`, [id])).rows[0] as { s: string | null; l: string };
    const count = async () => Number((await client.query(`select count(*)::int n from media_assets`)).rows[0].n);
    const provenance = (t: Tenant, id: string) => readSuppliedSourceProvenance(t.ctx, id, { getDb });

    /* ══ 1. IMAGE: A binding → A recorded, account 1 read back through it ══ */
    const imgA = await admitImage(acme, FILE.A, bA);
    assert.equal(imgA.status, "admitted", JSON.stringify(imgA));
    const imgAId = imgA.status === "admitted" ? imgA.asset.assetId : "";
    assert.equal(imgA.status === "admitted" && imgA.asset.suppliedSourceIntegrationId, A.id, "the result names A");
    assert.equal((await rowOf(imgAId)).s, A.id, "the row names A");
    assert.deepEqual(await provenance(acme, imgAId), { status: "recorded", integrationId: A.id, providerKey: GOOGLE_PROVIDER_KEY, externalAccountId: ACCOUNT_1.sub, currentConnectionState: "connected" });

    /* ══ 2. VIDEO: B binding → B recorded (B is second in creation order), account 2 ══ */
    resetCalls();
    const vidB = await admitVideo(acme, VIDEO.B, bB);
    assert.equal(vidB.status, "admitted", JSON.stringify(vidB));
    const vidBId = vidB.status === "admitted" ? vidB.asset.assetId : "";
    assert.equal((await rowOf(vidBId)).s, B.id);
    assert.equal(calls[TOKEN.A] ?? 0, 0, "A was never spent for B's video");
    const pv = await provenance(acme, vidBId);
    assert.equal(pv.status === "recorded" && pv.externalAccountId, ACCOUNT_2.sub);

    /* ══ 3. AN A BINDING CANNOT PRODUCE A B RECORD; NO FALLBACK ══ */
    {
      const before = await count();
      resetCalls();
      const crossed = await admitImage(acme, FILE.B, bA);
      assert.equal(crossed.status === "refused" && crossed.reason, "drive-read-failed", "B's file through A is a failure");
      assert.equal(calls[TOKEN.B] ?? 0, 0, "B is never tried");
      const crossedVideo = await admitVideo(acme, VIDEO.B, bA);
      assert.equal(crossedVideo.status, "refused");
      assert.equal(await count(), before, "no row");
    }

    /* ══ 4. THE CLIENT CANNOT CHOOSE THE VALUE ══ */
    {
      const forged = await admitImage(acme, FILE.A, bA, { suppliedSourceIntegrationId: B.id, integrationId: B.id, externalAccountId: ACCOUNT_2.sub });
      assert.equal(forged.status, "existing", "same file, same bytes, same revision: the existing asset");
      assert.equal((await rowOf(imgAId)).s, A.id, "the injected fields chose nothing");
      const [body, sig] = bA.split(".") as [string, string];
      const swapped = `${Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString()), integrationId: B.id, externalAccountId: ACCOUNT_2.sub })).toString("base64url")}.${sig}`;
      assert.deepEqual(await admitImage(acme, FILE.B, swapped), { status: "refused", reason: "drive-connection-not-bound", detail: "binding-signature-invalid" });
    }

    /* ══ 5. ANOTHER TENANT'S CONNECTION IS UNREPRESENTABLE ══ */
    {
      const pointsAtC = bind(acme, C.id, ACCOUNT_3.sub);
      assert.deepEqual(await admitImage(acme, FILE.A, pointsAtC), { status: "refused", reason: "drive-capability-not-available", detail: "bound-connection-unavailable" });
      await assert.rejects(
        client.query(`update media_assets set supplied_source_integration_id=$2 where id=$1`, [imgAId, C.id]),
        /media_assets_supplied_source_integration_fk/,
        "even a raw write cannot point an Acme asset at a Globex connection",
      );
    }

    /* ══ 6–7. ACCOUNT CHANGE AND CAPABILITY LOSS REFUSE BEFORE ANY ROW ══ */
    {
      const before = await count();
      await client.query(`update integrations set external_account_id='999999999999999999999' where id=$1`, [B.id]);
      assert.deepEqual(await admitImage(acme, FILE.B, bB), { status: "refused", reason: "drive-connection-not-bound", detail: "bound-account-mismatch" });
      await client.query(`update integrations set external_account_id=$2 where id=$1`, [B.id, ACCOUNT_2.sub]);
      await client.query(`update integrations set scopes=$2::jsonb where id=$1`, [B.id, JSON.stringify(SCOPES.filter((s) => !s.endsWith("drive.file")))]);
      assert.deepEqual(await admitImage(acme, FILE.B, bB), { status: "refused", reason: "drive-capability-not-available", detail: "bound-connection-unavailable" });
      await client.query(`update integrations set scopes=$2::jsonb where id=$1`, [B.id, JSON.stringify(SCOPES)]);
      assert.equal(await count(), before, "no row for either");
    }

    /* ══ 9. A GENERATED ROW HAS NO SOURCE CONNECTION, AND CANNOT BE GIVEN ONE ══ */
    {
      const gen = await requestMediaGeneration(
        acme.ctx,
        { artifactId: acme.draft, revisionNo: 1, promptText: "A synthetic tile.", requestKey: randomUUID() },
        { getDb, now: () => NOW, resolveStorage: () => ({ status: "available", store: memory }), resolveTransport: () => ({ status: "available", transport: createFakeMediaGenerationTransport({ kind: "bytes", bytes: jpeg }) }) },
      );
      assert.equal(gen.status, "admitted");
      const genId = gen.status === "admitted" ? gen.assetId : "";
      assert.equal((await rowOf(genId)).s, null);
      assert.deepEqual(await provenance(acme, genId), { status: "not-supplied" });
      await assert.rejects(client.query(`update media_assets set supplied_source_integration_id=$2 where id=$1`, [genId, A.id]), /media_assets_supplied_source_integration_chk/);
    }

    /* ══ 10. A HISTORICAL SUPPLIED ROW IS VALID AND READS UNKNOWN — NOT "NO ACCOUNT" ══ */
    {
      const old = randomUUID();
      await client.query(
        `insert into media_assets (id, tenant_id, mime_type, byte_size, byte_digest, width, height, storage_backend, storage_key, admitted_at,
           supplied_by_actor_type, supplied_by_actor_id, supplied_source, supplied_source_file_id, supplied_source_capability, supplied_artifact_id, supplied_revision_no)
         values ($1,$2,'image/jpeg',10,$3,40,30,'test-memory',$4, now(),'human',$5,'google-drive','1HistoricalFile','google.drive.file.content.read',$6,1)`,
        [old, acme.tenantId, "a".repeat(64), mediaAssetStorageKey(acme.tenantId, old), acme.ctx.userId, acme.draft],
      );
      assert.deepEqual(await provenance(acme, old), { status: "unknown" });
      /* The legacy Drive-wide capability can never name a connection (the Picker-bound path is per-file). */
      await assert.rejects(
        client.query(`update media_assets set supplied_source_capability='google.drive.content.read', supplied_source_integration_id=$2 where id=$1`, [old, A.id]),
        /media_assets_supplied_source_integration_chk/,
      );
    }

    /* ══ 12–14. RETIRE, CREDENTIAL ROTATION, CONNECTION LIFECYCLE: NOTHING RECORDED MOVES ══ */
    {
      assert.equal((await retireMediaAsset(acme.ctx, { assetId: imgAId }, { getDb, now: () => NOW })).status, "retired");
      assert.deepEqual(await rowOf(imgAId), { s: A.id, l: "retired" }, "retiring keeps the provenance");
      assert.equal(await commitGoogleGrant(acme.ctx, A.id, { accessToken: TOKEN.A2, refreshToken: REFRESH.A, expiresAt: null, grantedScopes: SCOPES }, NOW, { getDb, env: ENV, fetchImpl: A.userinfo }), "connected");
      assert.equal((await rowOf(imgAId)).s, A.id, "a rotated credential changes nothing recorded");
      await client.query(`update integrations set connection_state='revoked', revoked_at=now() where id=$1`, [A.id]);
      const afterRevoke = await provenance(acme, imgAId);
      assert.deepEqual(
        afterRevoke,
        { status: "recorded", integrationId: A.id, providerKey: GOOGLE_PROVIDER_KEY, externalAccountId: ACCOUNT_1.sub, currentConnectionState: "revoked" },
        "a revoked connection still answers which account supplied the asset",
      );
      await assert.rejects(client.query(`delete from integrations where id=$1`, [A.id]), /media_assets_supplied_source_integration_fk|violates foreign key/, "the connection row cannot be deleted while an asset names it");
    }

    /* ══ 8b. TENANT ISOLATION ON THE READ ══ */
    assert.deepEqual(await provenance(globex, imgAId), { status: "not-found" }, "another tenant's asset is indistinguishable from none");

    /* ══ 11. NO TOKEN, BINDING OR SECRET IS STORED ══ */
    {
      const all = (await client.query(`select to_jsonb(m)::text j from media_assets m`)).rows.map((r) => r.j as string).join("\n");
      for (const secret of [...Object.values(TOKEN), ...Object.values(REFRESH), bA, bB, ENV[GOOGLE_OAUTH_ENV_KEYS.stateSecret]!, ACCOUNT_1.email]) {
        assert.ok(!all.includes(secret), "no credential, binding, secret or account e-mail in media_assets");
      }
      assert.ok(!all.includes(ACCOUNT_1.sub) && !all.includes(ACCOUNT_2.sub), "the account is referenced through the connection, not copied onto the asset");
    }
  } finally {
    await vps?.dispose().catch(() => undefined);
    await client.end().catch(() => undefined);
    await handle.dispose().catch(() => undefined);
    await harness.dropDatabase();
  }

  /* ══ 15–16. STRUCTURE ══ */
  {
    const read = (f: string) => strip(readFileSync(path.join(process.cwd(), f), "utf8"));
    const sql = readdirSync("src/db/migrations").filter((f) => f.endsWith(".sql")).sort();
    const mine = read(`src/db/migrations/${sql.at(-1)}`);
    assert.match(sql.at(-1)!, /_supplied_media_account_provenance\.sql$/);
    /* Statements only — the FK's own "ON UPDATE no action" is not a data rewrite. */
    const statements = mine.split("--> statement-breakpoint").map((x) => x.trim());
    assert.ok(statements.every((x) => /^ALTER TABLE "media_assets" ADD (COLUMN|CONSTRAINT) /.test(x)), "additive only: every statement adds to media_assets");
    assert.ok(!/\bDROP\b|ALTER COLUMN|DELETE FROM|^\s*UPDATE\s/im.test(mine), "no drop, rewrite, backfill or relaxation");
    assert.equal((mine.match(/ADD COLUMN/g) ?? []).length, 1, "exactly one column");
    /* Only the supplied admissions write it; UI, Heby, Content Composition and publishing never read it. */
    const src = walk("src");
    const writers = src.filter((f) => /suppliedSourceIntegrationId:\s*sourceIntegrationId/.test(read(f))).sort();
    assert.deepEqual(writers, ["src/features/media-assets/admit-supplied-drive-image.server.ts", "src/features/media-assets/admit-supplied-drive-video.server.ts"]);
    const readers = src.filter((f) => /read-supplied-source-provenance/.test(read(f)));
    assert.deepEqual(readers, [], "the internal read seam is not wired into any surface");
    for (const f of src.filter((p) => /(components|heby|content-composition|instagram|youtube|action-execution)/.test(p))) {
      assert.ok(!/suppliedSourceIntegrationId|supplied_source_integration_id/.test(read(f)), `${f}: no surface or publishing path carries the source connection`);
    }
    for (const f of ["src/features/media-assets/admit-supplied-drive-image.server.ts", "src/features/media-assets/admit-supplied-drive-video.server.ts"]) {
      assert.ok(!/integration-authority|integration-credentials|withGoogleAccessToken/.test(read(f)), `${f}: Media never becomes connection or credential authority`);
    }
    /* DATA-USE-MEDIA-GUARD-1 is untouched: the gate does not read the new column. */
    assert.ok(!/suppliedSourceIntegrationId/.test(read("src/features/media-assets/external-generative-eligibility.server.ts")));
  }

  finished = true;
  console.log("supplied-media-account-provenance-1: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
