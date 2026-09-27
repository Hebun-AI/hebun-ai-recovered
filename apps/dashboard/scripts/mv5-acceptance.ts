/*
 * scripts/mv5-acceptance.ts — MV-5 production acceptance harness.
 *
 * Calls the RELEASED authority `deriveNormalizedVideo` for exactly ONE Director-approved source (the real
 * TRH MP4) as the Director in that tenant, verifies the result against the MV-5 A–P contract, then calls
 * it a SECOND time to prove reuse. It is not an execution authority: it never calls DERIVE-V1 itself,
 * never writes a row itself, and owns no infrastructure. Object/temp accounting (Q) on the VPS is a
 * separate read-only ssh step before and after, outside this script.
 *
 * WRITES (by the writer, not by this script): at most one derived object and one `media_assets` row on
 * the first call; nothing on the second.
 *
 * ENV. DATABASE_URL from MV5_DB_ENV_FILE (default ./.env.hosted.local). HEBUN_MEDIA_STORE_ORIGIN / _WRITE_SECRET /
 * _READ_SECRET from the file named by MV5_STORE_ENV_FILE. Absent → the script refuses before any call.
 * No value, signed URL or signature is ever printed.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadQuietEnv } from "./lib/quiet-env";

const SOURCE = "99a0bf52-1117-488b-923d-71085090a921";
const DIRECTOR_EMAIL = "senoltr@gmail.com";
const STORE_ENV = ["HEBUN_MEDIA_STORE_ORIGIN", "HEBUN_MEDIA_STORE_WRITE_SECRET", "HEBUN_MEDIA_STORE_READ_SECRET"] as const;

let pass = 0;
let fail = 0;
const check = (ok: boolean, label: string, detail = ""): void => {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
};
const sha = (b: Uint8Array): string => createHash("sha256").update(b).digest("hex");

/** Fail closed: every required variable must be present before anything is resolved or called. */
function loadEnvOrRefuse(): void {
  const dbFile = process.env.MV5_DB_ENV_FILE ?? path.resolve(process.cwd(), ".env.hosted.local");
  if (!existsSync(dbFile)) throw new Error("REFUSED: MV5_DB_ENV_FILE (or ./.env.hosted.local) does not exist");
  loadQuietEnv([dbFile], ["DATABASE_URL"]);
  const file = process.env.MV5_STORE_ENV_FILE ?? "";
  if (!file || !existsSync(file)) throw new Error("REFUSED: MV5_STORE_ENV_FILE is not set or does not exist");
  loadQuietEnv([file], [...STORE_ENV]);
  const missing = ["DATABASE_URL", ...STORE_ENV].filter((k) => !(process.env[k] ?? "").trim());
  if (missing.length) throw new Error(`REFUSED: missing ${missing.join(", ")}`);
  /* `vercel env pull` writes this literal for a Sensitive variable instead of its value. */
  const placeholders = STORE_ENV.filter((k) => process.env[k]!.trim() === "[SENSITIVE]");
  if (placeholders.length) throw new Error(`REFUSED: ${placeholders.join(", ")} hold Vercel's [SENSITIVE] placeholder, not a value`);
  process.env.HEBUN_CONTROL_PLANE_ALLOW_REMOTE = "true";
}

async function main(): Promise<void> {
  loadEnvOrRefuse();
  const ffprobe = process.env.MV5_FFPROBE ?? execFileSync("sh", ["-c", "command -v ffprobe || true"], { encoding: "utf8" }).trim();
  if (!ffprobe) throw new Error("REFUSED: no local ffprobe for the independent probe (set MV5_FFPROBE)");

  await import("../src/db/client.server");
  const { Client } = await import("pg");
  const { asHumanTenantContext } = await import("../src/features/auth/tenant/tenant-context");
  const { deriveNormalizedVideo, NORMALIZE_LIMITS } = await import("../src/features/media-assets/derive-normalized-video.server");
  const { resolveMediaObjectStore } = await import("../src/features/media-assets/media-storage.server");
  const { resolveMediaDbOrNull } = await import("../src/features/media-assets/media-db.server");
  const { derivePublishJpeg } = await import("../src/features/media-assets/derive-publish-jpeg.server");
  const { selectPublishLineage } = await import("../src/features/media-assets/read-publish-derivative.server");
  const { selectMediaAssetRecord } = await import("../src/features/media-assets/read-media-assets.server");

  const storage = resolveMediaObjectStore();
  if (storage.status !== "available") throw new Error(`REFUSED: store not resolvable (${storage.reason})`);
  const db = resolveMediaDbOrNull();
  if (!db) throw new Error("REFUSED: database not resolvable");

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const q = async <T,>(sql: string, p: unknown[] = []): Promise<T[]> => (await client.query(sql, p)).rows as T[];
  const rowOf = async (id: string) => (await q<{ j: Record<string, unknown> }>(`select to_jsonb(m) j from media_assets m where id=$1`, [id]))[0]?.j;
  const counts = async () =>
    (await q<{ total: number; normalized: number; from_source: number }>(
      `select count(*)::int total, count(*) filter (where derivation='mp4-normalize-v1')::int normalized,
              count(*) filter (where derived_from_asset_id=$1)::int from_source from media_assets`, [SOURCE]))[0]!;
  try {
    /* ── Pre-state: refuse unless the approved preconditions still hold. ── */
    const src0 = await rowOf(SOURCE);
    if (!src0) throw new Error("REFUSED: source row not found");
    const c0 = await counts();
    console.log("pre:", JSON.stringify(c0));
    const pre = src0.asset_lifecycle_status === "admitted" && src0.media_kind === "video" && src0.mime_type === "video/mp4"
      && src0.derived_from_asset_id === null && src0.derivation === null && (src0.supplied_source !== null || src0.invocation_id !== null);
    check(pre, "pre: source is an admitted original MP4");
    check(c0.from_source === 0, "pre: no derivative exists for the source");
    if (!pre || c0.from_source !== 0) throw new Error("REFUSED: preconditions do not hold; nothing was called");
    const tenantId = src0.tenant_id as string;
    const who = (await q<{ user_id: string; membership_id: string; role_id: string; ai: string; provider: string }>(
      `select u.id user_id, m.id membership_id, m.role_id, ai.id ai, ai.provider from users u
         join memberships m on m.user_id = u.id and m.status = 'active' and m.tenant_id = $2
         join auth_identities ai on ai.user_id = u.id and ai.revoked_at is null
        where u.email = $1 order by ai.is_primary desc limit 1`, [DIRECTOR_EMAIL, tenantId]))[0];
    if (!who) throw new Error("REFUSED: no active Director membership in the source tenant");
    const ctx = asHumanTenantContext({
      tenantId, userId: who.user_id, authIdentityId: who.ai, membershipId: who.membership_id, membershipVersion: 1,
      roleId: who.role_id, sessionContextId: "00000000-0000-4000-8000-000000000005", provider: who.provider as never,
      assuranceLevel: "aal1", mfaVerified: false, requestId: "mv5-acceptance", authenticatedAt: new Date().toISOString(),
    });
    const sv0 = await storage.store.verify(src0.storage_key as string);
    check(sv0.status === "present" && sv0.byteSize === src0.byte_size && sv0.sha256Hex === src0.byte_digest, "pre: source stored bytes = row");

    /* ── Derivation #1, through the released writer. ── */
    const t0 = Date.now();
    const first = await deriveNormalizedVideo(ctx, { sourceAssetId: SOURCE });
    console.log(`derive #1 (${Date.now() - t0} ms): ${JSON.stringify(first)}`);
    check(first.status === "derived", "A. the writer admitted a derivative");
    if (first.status !== "derived") return;
    const id = first.derivative.assetId;
    const c1 = await counts();
    check(c1.total === c0.total + 1 && c1.from_source === 1 && c1.normalized === c0.normalized + 1, "A. exactly one new Media row", JSON.stringify(c1));
    const d = (await rowOf(id))!;
    check(d.invocation_id === null && d.supplied_source === null && d.supplied_by_actor_id === null && d.derived_from_asset_id !== null, "B. origin = derived");
    check(d.derived_from_asset_id === SOURCE, "C. derived_from_asset_id = source");
    check(d.derivation === "mp4-normalize-v1", "D. derivation = mp4-normalize-v1");
    check(d.media_kind === "video", "E. media_kind = video");
    check(d.mime_type === "video/mp4", "F. mime_type = video/mp4");
    check(d.video_codec === "h264", "G. video_codec = h264");
    check(src0.audio_codec === null ? d.audio_codec === null : d.audio_codec === "aac", "H. audio aac iff the source had audio", `${src0.audio_codec} -> ${d.audio_codec}`);
    const [w, h, sw, sh] = [d.width, d.height, src0.width, src0.height] as number[];
    check(Math.max(w, h) <= 1920 && w <= sw && h <= sh && w % 2 === 0 && h % 2 === 0
      && Math.abs(w / h - sw / sh) <= NORMALIZE_LIMITS.aspectTolerance, "I. <=1920, no upscale, even, aspect kept", `${sw}x${sh} -> ${w}x${h}`);
    check(Math.abs((d.video_duration_ms as number) - (src0.video_duration_ms as number)) <= NORMALIZE_LIMITS.durationToleranceMs,
      "J. duration within 250 ms", `${src0.video_duration_ms} -> ${d.video_duration_ms}`);
    check(d.tenant_id === tenantId && d.asset_lifecycle_status === "admitted", "same tenant, admitted");

    /* K–N: stored bytes, signed reads, independent probe. The grant URL is never printed. */
    const v = await storage.store.verify(d.storage_key as string);
    check(v.status === "present" && v.byteSize === d.byte_size && v.sha256Hex === d.byte_digest, "K. store verify = row size + SHA-256");
    const grant = await storage.store.createReadAccess({ key: d.storage_key as string, contentType: "video/mp4", ttlSeconds: 60 });
    const full = await fetch(grant.url);
    const bytes = new Uint8Array(await full.arrayBuffer());
    check(full.status === 200 && bytes.byteLength === d.byte_size && sha(bytes) === d.byte_digest, "K+M. signed full read = row bytes", `${full.status} ${bytes.byteLength}`);
    const head = await fetch(grant.url, { method: "HEAD" });
    check(head.status === 200 && Number(head.headers.get("content-length")) === d.byte_size && head.headers.get("content-type") === "video/mp4", "M. HEAD");
    const range = await fetch(grant.url, { headers: { Range: "bytes=0-1023" } });
    const rb = new Uint8Array(await range.arrayBuffer());
    check(range.status === 206 && rb.byteLength === 1024 && rb.every((b, i) => b === bytes[i])
      && range.headers.get("content-range") === `bytes 0-1023/${d.byte_size}`, "N. single Range 206 = prefix");
    const unsat = await fetch(grant.url, { headers: { Range: `bytes=${(d.byte_size as number) + 10}-` } });
    await unsat.arrayBuffer();
    check(unsat.status === 416, "N. unsatisfiable Range 416");
    const dir = mkdtempSync(path.join(tmpdir(), "mv5-acc-"));
    try {
      const f = path.join(dir, "derived.mp4");
      writeFileSync(f, bytes);
      const p = JSON.parse(execFileSync(ffprobe, ["-v", "error", "-show_entries",
        "format=format_name,duration:stream=codec_type,codec_name,width,height,pix_fmt,avg_frame_rate", "-of", "json", f], { encoding: "utf8" }));
      const vs = p.streams.find((s: { codec_type: string }) => s.codec_type === "video");
      const as = p.streams.find((s: { codec_type: string }) => s.codec_type === "audio") ?? null;
      check(vs?.codec_name === d.video_codec && vs?.width === d.width && vs?.height === d.height && vs?.pix_fmt === "yuv420p",
        "L. independent ffprobe: codec + dimensions = row, yuv420p", `${vs?.codec_name} ${vs?.width}x${vs?.height} ${vs?.pix_fmt}`);
      check((as?.codec_name ?? null) === d.audio_codec, "L. independent ffprobe: audio = row", `${as?.codec_name ?? null}`);
      check(Math.abs(Math.round(Number(p.format.duration) * 1000) - (d.video_duration_ms as number)) <= 1 && vs?.avg_frame_rate === d.video_frame_rate,
        "L. independent ffprobe: duration + frame rate = row", `${p.format.duration}s ${vs?.avg_frame_rate}`);
      check(String(p.format.format_name).split(",").includes("mp4"), "L. container includes mp4");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }

    /* O: the source is untouched. */
    check(JSON.stringify(await rowOf(SOURCE)) === JSON.stringify(src0), "O. source row unchanged");
    const sv1 = await storage.store.verify(src0.storage_key as string);
    check(sv1.status === "present" && sv1.byteSize === src0.byte_size && sv1.sha256Hex === src0.byte_digest, "O. source stored bytes unchanged");

    /* P: no image-only path takes the derivative. All three refuse before any write. */
    const jpeg = await derivePublishJpeg(ctx, { originalAssetId: id });
    check(jpeg.status === "refused", "P. JPEG derivation refuses the derivative", JSON.stringify(jpeg));
    const lineage = (await selectPublishLineage(db as never, tenantId, { originalAssetId: SOURCE, derivedAssetId: id } as never)) as { status: string };
    check(lineage.status === "refused", "P. Instagram publish lineage refuses", JSON.stringify(lineage));
    check((await selectMediaAssetRecord(db as never, tenantId, id)) === null, "P. not an image record (review / selection / reference edit)");

    /* ── Derivation #2: reuse only. ── */
    const second = await deriveNormalizedVideo(ctx, { sourceAssetId: SOURCE });
    console.log(`derive #2: ${JSON.stringify(second)}`);
    check(second.status === "existing" && second.derivative.assetId === id, "idempotency: the same derivative is reused");
    check(JSON.stringify(await counts()) === JSON.stringify(c1), "idempotency: no new Media row");
    check(JSON.stringify(await rowOf(id)) === JSON.stringify(d), "idempotency: derived row unchanged");
    const v2 = await storage.store.verify(d.storage_key as string);
    check(v2.status === "present" && v2.sha256Hex === d.byte_digest, "idempotency: derived bytes unchanged");

    console.log(`SUMMARY derived=${id} key=${d.storage_key} size=${d.byte_size} sha256=${d.byte_digest} ${d.width}x${d.height} `
      + `${d.video_duration_ms}ms ${d.video_codec}/${d.audio_codec} ${d.video_frame_rate} container=${d.video_container}`);
  } finally {
    await client.end();
  }
}

main()
  .catch((e) => {
    fail++;
    console.error((e as Error).message.startsWith("REFUSED") ? (e as Error).message : `ABORTED: ${(e as Error).name}`);
  })
  .finally(() => {
    console.log(`\n${pass} pass, ${fail} fail`);
    process.exitCode = fail ? 1 : 0;
  });
