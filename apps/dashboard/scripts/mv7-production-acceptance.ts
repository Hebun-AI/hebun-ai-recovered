/*
 * scripts/mv7-production-acceptance.ts — MV-7 PRODUCTION acceptance harness. Operator tooling only.
 *
 *   preflight --artifact <uuid> --revision <n>                         read-only; no credential
 *   backup                                                             validated pg_dump, pg18-safe
 *   run --artifact <uuid> --revision <n> --confirm-one-billable-pixverse-job
 *
 * NOT AN AUTHORITY. It resolves the transport through the RELEASED video resolver (so the Director
 * connectivity control must already be ON — it is armed and disarmed only by
 * `npm run provider:connectivity`, never here), and every write is made by a released writer: MV-4
 * registration/dispatch/poll, the MV-7 admission writer. It arms nothing, disarms nothing, installs no
 * credential and changes no deployment configuration.
 *
 * TARGET. DATABASE_URL and the G4 production posture (HEBUN_PRODUCTION_CEREMONY + the pinned system
 * identifier and database) come from MV7_DB_ENV_FILE; the live cluster must match the pin before any
 * application row is read. Store variables come from MV7_STORE_ENV_FILE; the Higgsfield key from
 * MV6_HIGGSFIELD_ENV_FILE. Nothing is read from the ambient environment and no value is printed.
 *
 * ONE GENERATION. The process live-call budget is set to 1 before any live transport exists, the
 * lifecycle dispatches once, and a fetch guard refuses a second provider write before sending.
 * No retry, no resubmit. A host other than the approved exact output host stops the run BEFORE any
 * output byte is fetched, leaving the invocation `provider-succeeded` / `not-attempted` for a later,
 * separately approved admission.
 *
 * The tenant is the draft's own tenant; the human is the Director's active membership in it; the
 * author is the tenant's one in-service durable agent, resolved by the released authorship seam.
 */
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { loadQuietEnv } from "./lib/quiet-env";
import { loadHiggsfieldCredentialOrRefuse } from "./lib/higgsfield-credential-file";
import { MV7_PRODUCTION_CONFIRMATION, MV7_PRODUCTION_PROMPT, guardProviderFetch, runProductionAcceptance } from "./lib/mv7-production-acceptance";

const DIRECTOR_EMAIL = "senoltr@gmail.com";
const EXPECTED_LEDGER = 68;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DB_ENV = ["DATABASE_URL", "HEBUN_PRODUCTION_CEREMONY", "HEBUN_PRODUCTION_TARGET_SYSTEM_IDENTIFIER", "HEBUN_PRODUCTION_TARGET_DATABASE"] as const;
const STORE_ENV = ["HEBUN_MEDIA_STORE_ORIGIN", "HEBUN_MEDIA_STORE_WRITE_SECRET", "HEBUN_MEDIA_STORE_READ_SECRET"] as const;
const USAGE =
  "usage: mv7-production-acceptance.ts preflight --artifact <uuid> --revision <n>\n" +
  "       mv7-production-acceptance.ts backup\n" +
  `       mv7-production-acceptance.ts run --artifact <uuid> --revision <n> ${MV7_PRODUCTION_CONFIRMATION}`;

function parseArgs(argv: readonly string[]): { stage: "preflight" | "backup" | "run"; artifactId: string; revisionNo: number } {
  const [stage, ...rest] = argv;
  if (stage === "backup" && rest.length === 0) return { stage, artifactId: "", revisionNo: 0 };
  const want = stage === "run" ? 5 : 4;
  if ((stage !== "preflight" && stage !== "run") || rest.length !== want || rest[0] !== "--artifact" || rest[2] !== "--revision") {
    throw new Error(`REFUSED: ${USAGE}`);
  }
  if (stage === "run" && rest[4] !== MV7_PRODUCTION_CONFIRMATION) throw new Error(`REFUSED: ${USAGE}`);
  const artifactId = (rest[1] ?? "").toLowerCase();
  const revisionNo = Number(rest[3]);
  if (!UUID.test(artifactId) || !Number.isSafeInteger(revisionNo) || revisionNo < 1) throw new Error(`REFUSED: ${USAGE}`);
  return { stage, artifactId, revisionNo };
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
  const args = parseArgs(process.argv.slice(2));
  if (process.env.NODE_ENV === "production") throw new Error("REFUSED: operator tooling refuses NODE_ENV=production");

  /* ── Target: the pinned production cluster, verified before any application row is read. ── */
  loadFileOrRefuse("MV7_DB_ENV_FILE", DB_ENV);
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
        filename: `hebun_production_pre_mv7_acceptance_${stamp}.dump`,
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
    const who = await one<{ user_id: string; membership_id: string; role_id: string; ai: string; provider: string }>(
      `select u.id user_id, m.id membership_id, m.role_id, ai.id ai, ai.provider from users u
         join memberships m on m.user_id = u.id and m.status = 'active' and m.tenant_id = $2
         join auth_identities ai on ai.user_id = u.id and ai.revoked_at is null
        where u.email = $1 order by ai.is_primary desc limit 1`,
      [DIRECTOR_EMAIL, draft.tenant_id],
    );
    if (!who) throw new Error("REFUSED: no active Director membership in the draft's tenant");
    const control = await one<{ director_enabled: boolean }>(`select director_enabled from provider_connectivity_controls where provider_key = 'higgsfield-video-generation'`);
    const counts = await one<{ invocations: number; higgsfield: number; assets: number; tenant_assets: number }>(
      `select (select count(*)::int from media_generation_invocations) invocations,
              (select count(*)::int from media_generation_invocations where provider = 'higgsfield') higgsfield,
              (select count(*)::int from media_assets) assets,
              (select count(*)::int from media_assets where tenant_id = $1) tenant_assets`,
      [draft.tenant_id],
    );
    const existingVideo = await one<{ storage_key: string; byte_size: number; byte_digest: string }>(
      `select storage_key, byte_size, byte_digest from media_assets where media_kind = 'video' and supplied_source is not null order by admitted_at limit 1`,
    );
    await client.query("rollback");

    process.env.HEBUN_CONTROL_PLANE_ALLOW_REMOTE = "true";
    const { asHumanTenantContext } = await import("../src/features/auth/tenant/tenant-context");
    const { createControlPlaneDb } = await import("../src/db/client.server");
    const { resolveAgentAuthorship } = await import("../src/features/work-artifacts/agent-authorship.server");
    const handle = createControlPlaneDb(process.env.DATABASE_URL!);
    const getDb = () => handle.db;
    const tenant = asHumanTenantContext({
      tenantId: draft.tenant_id, userId: who.user_id, authIdentityId: who.ai, membershipId: who.membership_id, membershipVersion: 1,
      roleId: who.role_id, sessionContextId: "00000000-0000-4000-8000-000000000007", provider: who.provider as never,
      assuranceLevel: "aal1", mfaVerified: false, requestId: "mv7-production-acceptance", authenticatedAt: new Date().toISOString(),
    });
    try {
      const authorship = await resolveAgentAuthorship(tenant, { getDb });
      if (authorship.status !== "resolved") throw new Error(`REFUSED: no durable agent (${authorship.reason})`);
      console.log(`draft: ${args.artifactId} rev ${args.revisionNo} — ${draft.tenant}, content-draft, draft`);
      console.log(`human: Director active membership ${who.membership_id}; durable agent ${authorship.authorship.agentId}`);
      console.log(`control higgsfield-video-generation: ${control?.director_enabled === true ? "ON" : control ? "OFF" : "OFF (no row)"}`);
      console.log(`counts: invocations ${counts!.invocations} (higgsfield ${counts!.higgsfield}); media_assets ${counts!.assets} (tenant ${counts!.tenant_assets})`);

      loadFileOrRefuse("MV7_STORE_ENV_FILE", STORE_ENV);
      const { resolveMediaObjectStore, resolveMediaStorageV2 } = await import("../src/features/media-assets/media-storage.server");
      const v1 = resolveMediaObjectStore();
      if (v1.status !== "available") throw new Error("REFUSED: production store not resolvable");
      if (existingVideo) {
        const probe = await v1.store.verify(existingVideo.storage_key).catch(() => null);
        const ok = probe?.status === "present" && probe.byteSize === existingVideo.byte_size && probe.sha256Hex === existingVideo.byte_digest;
        console.log(`store: signed verify of the existing supplied video ${ok ? "PASS" : "FAIL"}`);
        if (!ok) throw new Error("REFUSED: production store verify failed");
      }

      if (args.stage === "preflight") {
        if (counts!.higgsfield !== 0) throw new Error("REFUSED: a Higgsfield invocation already exists in production");
        console.log("preflight: PASS (read-only; nothing called, nothing written)");
        return;
      }

      /* ── run ── */
      if (control?.director_enabled !== true) throw new Error("REFUSED: higgsfield-video-generation is not ON — arm it with the connectivity ceremony first");
      if (counts!.higgsfield !== 0) throw new Error("REFUSED: a Higgsfield invocation already exists in production");
      process.env.HEBUN_MODEL_LIVE_CALL_BUDGET = "1";
      const credential = loadHiggsfieldCredentialOrRefuse();
      const guard = guardProviderFetch(globalThis.fetch, "https://api.higgsfield.ai");
      globalThis.fetch = guard.fetchImpl;
      const { resolveMediaAsyncGenerationTransport } = await import("../src/features/media-assets/async-generation-transport.server");
      const { lookup } = await import("node:dns");
      const hops: string[] = [];
      const resolve = (hostname: string) =>
        new Promise<readonly { address: string; family: number }[]>((ok, fail) => {
          hops.push(hostname);
          lookup(hostname, { all: true, verbatim: true }, (error, addresses) => (error ? fail(error) : ok(addresses)));
        });
      const pg = client;
      await pg.query("rollback").catch(() => undefined);
      const report = await runProductionAcceptance({
        tenant,
        artifactId: args.artifactId,
        revisionNo: args.revisionNo,
        promptText: MV7_PRODUCTION_PROMPT,
        requestKey: randomUUID(),
        getDb,
        resolveTransport: () => resolveMediaAsyncGenerationTransport({ env: { HEBUN_VIDEO_GENERATION_TRANSPORT: "live", HEBUN_HIGGSFIELD_API_KEY: credential.apiKey } }),
        resolveStorageV1: () => resolveMediaObjectStore(),
        resolveStorageV2: () => resolveMediaStorageV2(),
        countMediaAssets: async () => (await pg.query<{ n: number }>("select count(*)::int n from media_assets")).rows[0]!.n,
        invocationRow: async (id) => (await pg.query<{ j: Record<string, unknown> }>("select to_jsonb(i) j from media_generation_invocations i where id = $1", [id])).rows[0]?.j ?? null,
        assetRows: async (id) => (await pg.query<{ j: Record<string, unknown> }>("select to_jsonb(m) j from media_assets m where invocation_id = $1", [id])).rows.map((r) => r.j),
        download: { resolve },
      });
      const g = report.generation;
      console.log(`stop: ${report.stop}${report.detail ? ` (${report.detail})` : ""}; model ${report.model ?? "n/a"}`);
      if (g) {
        console.log(`invocation: ${g.invocationId ?? "none"}; dispatch calls ${g.dispatchCalls}; provider request id ${g.providerJobId ?? "none"}`);
        console.log(`lifecycle: ${g.finalState ?? "none"}; provider failure ${g.providerFailure ?? "none"}; polls ${g.polls} (unreadable ${g.unreadableObservations}); ${Math.round(g.elapsedMs / 1000)} s`);
      }
      if (report.outputShape) {
        const s = report.outputShape;
        console.log(`output: ${s.scheme}://${s.hostname}; port ${s.hasPort ? "YES" : "NO"}; credentials ${s.hasCredentials ? "YES" : "NO"}; query names ${s.queryParameterNames.join(", ") || "(none)"}; ${s.pathSegmentCount} path segment(s), ext ${s.pathExtension ?? "(none)"}`);
      }
      if (report.admission) {
        const a = report.admission;
        if (a.status === "admitted" || a.status === "existing") {
          const x = a.asset;
          console.log(`admission: ${a.status}; asset ${x.assetId}; ${x.byteSize} bytes; sha256 ${x.byteDigest}`);
          console.log(`video: ${x.container} ${x.videoCodec}/${x.audioCodec ?? "no-audio"} ${x.width}x${x.height} ${x.durationMs} ms @ ${x.frameRate}`);
        } else console.log(`admission: ${JSON.stringify(a)}`);
      }
      if (report.invocation) {
        const i = report.invocation;
        console.log(`invocation row: state ${i.state}; admission_outcome ${i.admissionOutcome}; admission_failure ${i.admissionFailure ?? "null"}; output ref = request id ${i.outputRefIsJobId ?? "n/a"}`);
      }
      console.log(`assets for invocation: ${report.assetsForInvocation}; stored = row ${report.storedVerified ? "YES" : "NO"}; stored brand ${report.storedMajorBrand ?? "n/a"}`);
      console.log(`read model: origin ${report.readModelOrigin ?? "n/a"}; invocation linked ${report.readModelInvocationLinked ? "YES" : "NO"}; grant ${report.grantIssued ? "YES" : "NO"}; Range 0-1023 ${report.rangeStatus ?? "n/a"} (${report.rangeBytes ?? 0} bytes)`);
      console.log(`provider requests: ${guard.counts.posts} POST, ${guard.counts.gets} GET, ${guard.counts.refused} refused; output hops: ${hops.length} (${[...new Set(hops)].join(", ") || "none"})`);
    } finally {
      await handle.dispose().catch(() => undefined);
    }
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "mv7-production-acceptance failed");
  process.exit(1);
});
