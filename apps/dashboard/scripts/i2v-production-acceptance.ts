/*
 * scripts/i2v-production-acceptance.ts — IMAGE → VIDEO PRODUCTION acceptance harness. Operator tooling.
 *
 *   preflight --source <asset uuid> --artifact <uuid> --revision <n>      read-only; nothing sent
 *   backup                                                                validated pg_dump, pg18-safe
 *   run --source <asset uuid> --artifact <uuid> --revision <n> --confirm-one-billable-image-to-video-generation
 *
 * NOT AN AUTHORITY. The transport comes from the RELEASED video resolver, asked for an `image`
 * transport — so the SEPARATE `higgsfield-image-to-video` Director control must already be ON. It is
 * armed and disarmed only by `npm run provider:connectivity`, never here. Every write is a released
 * writer's: the verified-source request (MV-4 registration with MEDIA-5 lineage, the documented
 * upload, ONE dispatch), MV-4 polling, MV-7 admission. It arms nothing, installs no credential and
 * changes no deployment configuration.
 *
 * TARGET. DATABASE_URL and the G4 production posture come from I2V_DB_ENV_FILE and must match the pin
 * before any application row is read; store variables from I2V_STORE_ENV_FILE; the Higgsfield key from
 * MV6_HIGGSFIELD_ENV_FILE. Nothing is read from the ambient environment and no value, key or URL
 * (upload, public, output or signed) is printed — only structural facts.
 *
 * THE SOURCE (Director G2). It must be a SYNTHETIC, non-sensitive image already admitted into Media by
 * a released writer. This harness admits nothing; it names the source by id and the preflight prints
 * its facts so a human can confirm it is the synthetic one before `run`.
 *
 * ONE GENERATION. The live-call budget is 1 before any live transport exists; the lifecycle uploads
 * once and dispatches once; and a fetch guard refuses a second upload-preparation POST, a second PUT
 * and a second generation POST before sending. No retry, no resubmit. A host other than the approved
 * exact output host stops the run BEFORE any output byte, leaving the invocation provider-succeeded /
 * not-attempted for a separately approved admission.
 */
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { loadQuietEnv } from "./lib/quiet-env";
import { loadHiggsfieldCredentialOrRefuse } from "./lib/higgsfield-credential-file";
import {
  I2V_PRODUCTION_CONFIRMATION,
  I2V_PRODUCTION_PROMPT,
  guardImageToVideoFetch,
  runImageToVideoAcceptance,
} from "./lib/i2v-production-acceptance";

const DIRECTOR_EMAIL = "senoltr@gmail.com";
const EXPECTED_LEDGER = 67;
const IMAGE_CONTROL = "higgsfield-image-to-video";
const TEXT_CONTROL = "higgsfield-video-generation";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DB_ENV = ["DATABASE_URL", "HEBUN_PRODUCTION_CEREMONY", "HEBUN_PRODUCTION_TARGET_SYSTEM_IDENTIFIER", "HEBUN_PRODUCTION_TARGET_DATABASE"] as const;
const STORE_ENV = ["HEBUN_MEDIA_STORE_ORIGIN", "HEBUN_MEDIA_STORE_WRITE_SECRET", "HEBUN_MEDIA_STORE_READ_SECRET"] as const;
const USAGE =
  "usage: i2v-production-acceptance.ts preflight --source <uuid> --artifact <uuid> --revision <n>\n" +
  "       i2v-production-acceptance.ts backup\n" +
  `       i2v-production-acceptance.ts run --source <uuid> --artifact <uuid> --revision <n> ${I2V_PRODUCTION_CONFIRMATION}`;

interface Args {
  readonly stage: "preflight" | "backup" | "run";
  readonly sourceAssetId: string;
  readonly artifactId: string;
  readonly revisionNo: number;
}

export function parseI2vArgs(argv: readonly string[]): Args {
  const [stage, ...rest] = argv;
  if (stage === "backup" && rest.length === 0) return { stage, sourceAssetId: "", artifactId: "", revisionNo: 0 };
  const want = stage === "run" ? 7 : 6;
  if ((stage !== "preflight" && stage !== "run") || rest.length !== want || rest[0] !== "--source" || rest[2] !== "--artifact" || rest[4] !== "--revision") {
    throw new Error(`REFUSED: ${USAGE}`);
  }
  if (stage === "run" && rest[6] !== I2V_PRODUCTION_CONFIRMATION) throw new Error(`REFUSED: ${USAGE}`);
  const sourceAssetId = (rest[1] ?? "").toLowerCase();
  const artifactId = (rest[3] ?? "").toLowerCase();
  const revisionNo = Number(rest[5]);
  if (!UUID.test(sourceAssetId) || !UUID.test(artifactId) || !Number.isSafeInteger(revisionNo) || revisionNo < 1) {
    throw new Error(`REFUSED: ${USAGE}`);
  }
  return { stage, sourceAssetId, artifactId, revisionNo };
}

function loadFileOrRefuse(variable: string, names: readonly string[]): void {
  const file = process.env[variable] ?? "";
  if (!file || !existsSync(file)) throw new Error(`REFUSED: ${variable} is not set or does not exist`);
  for (const n of names) delete process.env[n];
  loadQuietEnv([file], [...names]);
  const missing = names.filter((n) => !(process.env[n] ?? "").trim());
  if (missing.length > 0) throw new Error(`REFUSED: ${variable} lacks ${missing.join(", ")} (values not shown)`);
}

async function main(): Promise<void> {
  const args = parseI2vArgs(process.argv.slice(2));
  if (process.env.NODE_ENV === "production") throw new Error("REFUSED: operator tooling refuses NODE_ENV=production");

  /* ── Target: the pinned production cluster, verified before any application row is read. ── */
  loadFileOrRefuse("I2V_DB_ENV_FILE", DB_ENV);
  const { resolveCeremonyPosture, verifyProductionIdentity } = await import("./lib/production-possession");
  const posture = resolveCeremonyPosture(process.env);
  if (posture.mode !== "production") throw new Error(`REFUSED: the DB env file does not open a production posture (${posture.mode})`);
  const { Client } = await import("pg");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const bound = await verifyProductionIdentity(client, posture.expected);
    if (bound.status !== "bound") throw new Error(`REFUSED: target not bound (${bound.reason})`);
    console.log(`target: bound to the pinned cluster; ledger ${bound.observed.appliedMigrations}`);
    if (bound.observed.appliedMigrations !== EXPECTED_LEDGER) throw new Error(`REFUSED: ledger is ${bound.observed.appliedMigrations}, expected ${EXPECTED_LEDGER}`);

    if (args.stage === "backup") {
      const { BACKUP_ROOT, createValidatedBackup, readServerVersion } = await import("./lib/production-migration");
      const version = await readServerVersion(client);
      if (version.status !== "parsed") throw new Error("REFUSED: server version unreadable");
      const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..*$/, "").replace("T", "-");
      const backup = createValidatedBackup({
        connectionString: process.env.DATABASE_URL!,
        serverVersion: version.version,
        directory: BACKUP_ROOT,
        filename: `hebun_production_pre_i2v_acceptance_${stamp}.dump`,
        repositoryRoot: path.join(import.meta.dirname, ".."),
      });
      if (backup.status !== "created") throw new Error(`REFUSED: backup ${backup.reason}: ${backup.detail}`);
      console.log(`backup: created ${path.basename(backup.file)}; ${backup.bytes} bytes; ${backup.entries} TOC entries (validated)`);
      return;
    }

    /* ── Read-only facts, in one read-only transaction. ── */
    await client.query("begin read only");
    const one = async <T,>(sql: string, p: unknown[] = []): Promise<T | undefined> => (await client.query(sql, p)).rows[0] as T | undefined;
    const draft = await one<{ tenant_id: string; tenant: string; type: string; status: string }>(
      `select wa.tenant_id, c.name tenant, wa.artifact_type type, wa.artifact_lifecycle_status status
         from work_artifacts wa join companies c on c.id = wa.tenant_id
         join work_artifact_revisions r on r.artifact_id = wa.id and r.tenant_id = wa.tenant_id and r.revision_no = $2
        where wa.id = $1`,
      [args.artifactId, args.revisionNo],
    );
    if (!draft) throw new Error("REFUSED: the draft revision does not exist");
    if (draft.tenant !== "Turkish Rug House" || draft.type !== "content-draft" || draft.status !== "draft") {
      throw new Error(`REFUSED: not an open TRH content-draft (${draft.tenant}, ${draft.type}, ${draft.status})`);
    }
    /* The source, read tenant-blind first so a wrong-tenant id is REPORTED as such, then refused. */
    const source = await one<{
      tenant_id: string; media_kind: string; mime_type: string; width: number; height: number; byte_size: number;
      byte_digest: string; lifecycle: string; storage_key: string; supplied: boolean; generated: boolean; derived: boolean;
    }>(
      `select tenant_id, media_kind, mime_type, width, height, byte_size, byte_digest, asset_lifecycle_status lifecycle,
              storage_key, supplied_source is not null supplied, invocation_id is not null generated, derived_from_asset_id is not null derived
         from media_assets where id = $1`,
      [args.sourceAssetId],
    );
    if (!source) throw new Error("REFUSED: the source asset does not exist");
    if (source.tenant_id !== draft.tenant_id) throw new Error("REFUSED: the source asset belongs to another tenant");
    if (source.media_kind !== "image") throw new Error(`REFUSED: the source asset is not an image (${source.media_kind})`);
    if (source.lifecycle !== "admitted") throw new Error(`REFUSED: the source asset is not admitted (${source.lifecycle})`);
    const who = await one<{ user_id: string; membership_id: string; role_id: string; ai: string; provider: string }>(
      `select u.id user_id, m.id membership_id, m.role_id, ai.id ai, ai.provider from users u
         join memberships m on m.user_id = u.id and m.status = 'active' and m.tenant_id = $2
         join auth_identities ai on ai.user_id = u.id and ai.revoked_at is null
        where u.email = $1 order by ai.is_primary desc limit 1`,
      [DIRECTOR_EMAIL, draft.tenant_id],
    );
    if (!who) throw new Error("REFUSED: no active Director membership in the draft's tenant");
    const controls = await client.query<{ provider_key: string; director_enabled: boolean }>(
      `select provider_key, director_enabled from provider_connectivity_controls where provider_key = any($1)`,
      [[IMAGE_CONTROL, TEXT_CONTROL]],
    );
    const controlState = (key: string) => {
      const row = controls.rows.find((r) => r.provider_key === key);
      return row ? (row.director_enabled ? "ON" : "OFF") : "OFF (no row)";
    };
    const counts = await one<{ invocations: number; higgsfield: number; i2v: number; assets: number; tenant_assets: number }>(
      `select (select count(*)::int from media_generation_invocations) invocations,
              (select count(*)::int from media_generation_invocations where provider = 'higgsfield') higgsfield,
              (select count(*)::int from media_generation_invocations where provider = 'higgsfield' and source_media_asset_id is not null) i2v,
              (select count(*)::int from media_assets) assets,
              (select count(*)::int from media_assets where tenant_id = $1) tenant_assets`,
      [draft.tenant_id],
    );
    await client.query("rollback");

    console.log(`draft: ${args.artifactId} rev ${args.revisionNo} — ${draft.tenant}, content-draft, draft`);
    console.log(
      `source: ${args.sourceAssetId}; tenant ${draft.tenant}; image; ${source.mime_type}; ${source.width}x${source.height}; ` +
        `${source.byte_size} bytes; sha256 ${source.byte_digest}; admitted; origin ${source.derived ? "derived" : source.supplied ? "supplied" : source.generated ? "generated" : "unknown"}`,
    );
    console.log("source policy: must be SYNTHETIC and non-sensitive (Director G2) — confirm the facts above before run");
    console.log(`controls: ${IMAGE_CONTROL} ${controlState(IMAGE_CONTROL)}; ${TEXT_CONTROL} ${controlState(TEXT_CONTROL)}`);
    console.log(`counts: invocations ${counts!.invocations} (higgsfield ${counts!.higgsfield}, image-to-video ${counts!.i2v}); media_assets ${counts!.assets} (tenant ${counts!.tenant_assets})`);

    process.env.HEBUN_CONTROL_PLANE_ALLOW_REMOTE = "true";
    const { asHumanTenantContext } = await import("../src/features/auth/tenant/tenant-context");
    const { createControlPlaneDb } = await import("../src/db/client.server");
    const { resolveAgentAuthorship } = await import("../src/features/work-artifacts/agent-authorship.server");
    const handle = createControlPlaneDb(process.env.DATABASE_URL!);
    const getDb = () => handle.db;
    const tenant = asHumanTenantContext({
      tenantId: draft.tenant_id, userId: who.user_id, authIdentityId: who.ai, membershipId: who.membership_id, membershipVersion: 1,
      roleId: who.role_id, sessionContextId: "00000000-0000-4000-8000-000000000008", provider: who.provider as never,
      assuranceLevel: "aal1", mfaVerified: false, requestId: "i2v-production-acceptance", authenticatedAt: new Date().toISOString(),
    });
    try {
      const authorship = await resolveAgentAuthorship(tenant, { getDb });
      if (authorship.status !== "resolved") throw new Error(`REFUSED: no durable agent (${authorship.reason})`);
      console.log(`human: Director active membership ${who.membership_id}; durable agent ${authorship.authorship.agentId}`);

      /* Store: the SOURCE's own stored object, verified by size and SHA against its row. */
      loadFileOrRefuse("I2V_STORE_ENV_FILE", STORE_ENV);
      const { resolveMediaObjectStore, resolveMediaStorageV2 } = await import("../src/features/media-assets/media-storage.server");
      const v1 = resolveMediaObjectStore();
      if (v1.status !== "available") throw new Error("REFUSED: production store not resolvable");
      const probe = await v1.store.verify(source.storage_key).catch(() => null);
      const sourceOk = probe?.status === "present" && probe.byteSize === source.byte_size && probe.sha256Hex === source.byte_digest;
      console.log(`store: signed verify of the source image ${sourceOk ? "PASS" : "FAIL"}`);
      if (!sourceOk) throw new Error("REFUSED: the source image's stored bytes do not verify");

      /* Credential: present and credential-shaped. Never printed. */
      const credential = loadHiggsfieldCredentialOrRefuse();
      console.log("credential: HEBUN_HIGGSFIELD_API_KEY present and credential-shaped (value not shown)");

      if (args.stage === "preflight") {
        if (counts!.i2v !== 0) throw new Error("REFUSED: a Higgsfield image-to-video invocation already exists in production");
        console.log("provider calls: upload preparation 0, upload PUT 0, generation POST 0");
        console.log("preflight: PASS (read-only; nothing called, nothing written)");
        return;
      }

      /* ── run ── */
      if (controlState(IMAGE_CONTROL) !== "ON") throw new Error(`REFUSED: ${IMAGE_CONTROL} is not ON — arm it with the connectivity ceremony first`);
      if (counts!.i2v !== 0) throw new Error("REFUSED: a Higgsfield image-to-video invocation already exists in production");
      process.env.HEBUN_MODEL_LIVE_CALL_BUDGET = "1";
      const guard = guardImageToVideoFetch(globalThis.fetch, "https://api.higgsfield.ai", process.env.HEBUN_MEDIA_STORE_ORIGIN ?? "");
      globalThis.fetch = guard.fetchImpl;
      const { resolveMediaAsyncGenerationTransport } = await import("../src/features/media-assets/async-generation-transport.server");
      const { lookup } = await import("node:dns");
      const hops: string[] = [];
      const resolve = (hostname: string) =>
        new Promise<readonly { address: string; family: number }[]>((ok, fail) => {
          hops.push(hostname);
          lookup(hostname, { all: true, verbatim: true }, (error, addresses) => (error ? fail(error) : ok(addresses)));
        });
      const r = await runImageToVideoAcceptance({
        tenant,
        artifactId: args.artifactId,
        revisionNo: args.revisionNo,
        sourceAssetId: args.sourceAssetId,
        promptText: I2V_PRODUCTION_PROMPT,
        requestKey: randomUUID(),
        getDb,
        resolveTransport: () =>
          resolveMediaAsyncGenerationTransport(
            { env: { HEBUN_VIDEO_GENERATION_TRANSPORT: "live", HEBUN_HIGGSFIELD_API_KEY: credential.apiKey } },
            { inputMode: "image" },
          ),
        resolveStorageV1: () => resolveMediaObjectStore(),
        resolveStorageV2: () => resolveMediaStorageV2(),
        countMediaAssets: async () => (await client.query<{ n: number }>("select count(*)::int n from media_assets")).rows[0]!.n,
        invocationRow: async (id) => (await client.query<{ j: Record<string, unknown> }>("select to_jsonb(i) j from media_generation_invocations i where id = $1", [id])).rows[0]?.j ?? null,
        assetRows: async (id) => (await client.query<{ j: Record<string, unknown> }>("select to_jsonb(m) j from media_assets m where invocation_id = $1", [id])).rows.map((row) => row.j),
        download: { resolve },
      });
      console.log(`stop: ${r.stop}${r.detail ? ` (${r.detail})` : ""}; model ${r.model ?? "n/a"}`);
      console.log(`invocation: ${r.invocationId ?? "none"}; lifecycle ${r.finalState ?? "none"}; provider failure ${r.providerFailure ?? "none"}; polls ${r.polls} (unreadable ${r.unreadableObservations}); ${Math.round(r.elapsedMs / 1000)} s`);
      console.log(`lineage: source_media_asset_id ${r.lineageSourceAssetId ?? "none"} ${r.lineageSourceAssetId === args.sourceAssetId ? "(= source)" : "(MISMATCH or none)"}`);
      if (r.outputShape) {
        const s = r.outputShape;
        console.log(`output: ${s.scheme}://${s.hostname}; port ${s.hasPort ? "YES" : "NO"}; credentials ${s.hasCredentials ? "YES" : "NO"}; query names ${s.queryParameterNames.join(", ") || "(none)"}; ${s.pathSegmentCount} path segment(s), ext ${s.pathExtension ?? "(none)"}`);
      }
      if (r.admission && (r.admission.status === "admitted" || r.admission.status === "existing")) {
        const x = r.admission.asset;
        console.log(`admission: ${r.admission.status}; asset ${x.assetId}; ${x.byteSize} bytes; sha256 ${x.byteDigest}`);
        console.log(`video: ${x.container} ${x.videoCodec}/${x.audioCodec ?? "no-audio"} ${x.width}x${x.height} ${x.durationMs} ms @ ${x.frameRate}`);
      } else if (r.admission) console.log(`admission: ${r.admission.status}${"reason" in r.admission ? ` (${r.admission.reason})` : ""}`);
      console.log(`admission_outcome ${r.admissionOutcome ?? "n/a"}; assets for invocation ${r.assetsForInvocation}; media_assets ${r.mediaAssetsBefore} → ${r.mediaAssetsAfter}`);
      console.log(`stored = row ${r.storedVerified ? "YES" : "NO"}; brand ${r.storedMajorBrand ?? "n/a"}; read model origin ${r.readModelOrigin ?? "n/a"}; invocation linked ${r.readModelInvocationLinked ? "YES" : "NO"}; Range 0-1023 ${r.rangeStatus ?? "n/a"} (${r.rangeBytes ?? 0} bytes)`);
      const c = guard.counts;
      console.log(`provider calls: upload preparation ${c.uploadPreparations}, upload PUT ${c.uploadPuts}, generation POST ${c.generationPosts}, status GET ${c.providerGets}, refused ${c.refused}; output hops ${hops.length} (${[...new Set(hops)].join(", ") || "none"})`);
    } finally {
      await handle.dispose().catch(() => undefined);
    }
  } finally {
    await client.end().catch(() => undefined);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "i2v-production-acceptance failed");
    process.exit(1);
  });
}
