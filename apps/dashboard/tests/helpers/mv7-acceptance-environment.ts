/*
 * tests/helpers/mv7-acceptance-environment.ts — the DISPOSABLE environment for MV-7 admission
 * acceptance. ACCEPTANCE-ONLY TOOLING.
 *
 * A throwaway local Postgres built from the canonical migrations, the REAL VPS store process on a
 * temp directory (video on, local ffprobe), and the MV-4 synthetic prerequisites (one tenant, one
 * human with Governance authority, one durable agent, one content-draft revision). Both are destroyed
 * by `dispose()`.
 *
 * THE ONE FIXTURE, STATED: `seedPendingInvocation` registers an invocation through the REAL MV-4
 * writer (no network), then moves it to `provider-pending` with the given request id by a direct SQL
 * update. That dispatch did not happen here — it happened in MV-6's disposable environment, which no
 * longer exists. From `provider-pending` on, every transition is made by the released writers.
 *
 * BOUNDARY. Under `tests/helpers/` (skipped by the suite runner), reachable only by a dynamic import in
 * `scripts/mv7-generated-video-acceptance.ts` and by its own test. Nothing under `src/` may import it.
 */
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "./disposable-postgres";
import { startLocalVpsStore } from "./media-vps-store-process";
import { createControlPlaneDb } from "../../src/db/client.server";
import { registerAsyncMediaGeneration } from "../../src/features/media-assets/async-generation-lifecycle.server";
import type { MediaAsyncGenerationTransport } from "../../src/features/media-assets/async-generation-transport";
import { createVpsMediaObjectStore } from "../../src/features/media-assets/vps-media-object-store.server";
import { createVpsMediaStorageV2 } from "../../src/features/media-assets/vps-media-storage-v2.server";
import { seedTenant } from "../mv4-async-generation/scenarios";
import type { Mv7AdmissionEnvironment } from "../../scripts/lib/mv7-generated-video-acceptance";

const tool = (name: string): string => execFileSync("sh", ["-c", `command -v ${name} || true`], { encoding: "utf8" }).trim();

export async function createMv7AcceptanceEnvironment(
  name = "hebun_mv7_acceptance",
): Promise<Mv7AdmissionEnvironment & { readonly dispose: () => Promise<void>; readonly resources: { readonly database: string; readonly storeRoot: string } }> {
  const ffprobe = tool("ffprobe");
  const ffmpeg = tool("ffmpeg");
  if (!ffprobe || !ffmpeg) throw new Error("REFUSED: ffprobe and ffmpeg must be installed for the local store");
  const harness = createDisposablePostgresHarness(name);
  await harness.createDatabase();
  const client = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  let store: Awaited<ReturnType<typeof startLocalVpsStore>> | undefined;
  const dispose = async () => {
    await store?.dispose().catch(() => undefined);
    await client.end().catch(() => undefined);
    await handle.dispose().catch(() => undefined);
    await harness.dropDatabase();
  };
  try {
    harness.migrateDatabase();
    await client.connect();
    store = await startLocalVpsStore({ HEBUN_MEDIA_STORE_ENABLE_VIDEO: "1", HEBUN_MEDIA_STORE_FFPROBE: ffprobe, HEBUN_MEDIA_STORE_FFMPEG: ffmpeg });
    const s = store;
    const getDb = () => handle.db;
    const t = await seedTenant(client, getDb, "Acceptance");
    return {
      tenant: t.ctx,
      getDb,
      storageV1: () => ({ status: "available", store: createVpsMediaObjectStore({ origin: s.origin, writeSecret: s.writeSecret, readSecret: s.readSecret }) }),
      storageV2: () => ({ status: "available", client: createVpsMediaStorageV2({ origin: s.origin, writeSecret: s.writeSecret, readSecret: s.readSecret }) }),
      async seedPendingInvocation(identity, requestId) {
        const shell = { ...identity, outputMediaKind: "video" } as unknown as MediaAsyncGenerationTransport;
        const reg = await registerAsyncMediaGeneration(
          t.ctx,
          { artifactId: t.draft, revisionNo: 1, promptText: "MV-7 acceptance fixture: re-admission of an MV-6 output.", requestKey: randomUUID() },
          { getDb, resolveTransport: () => ({ status: "available", transport: shell }) },
        );
        if (reg.status !== "registered") throw new Error(`fixture registration refused: ${reg.reason}`);
        const moved = await client.query(
          `update media_generation_invocations
              set state='provider-pending', provider_job_id=$2, provider_accepted_at=now()
            where id=$1 and state='registered'`,
          [reg.invocationId, requestId],
        );
        if (moved.rowCount !== 1) throw new Error("fixture could not reach provider-pending");
        return reg.invocationId;
      },
      invocationRow: async (id) =>
        (await client.query<{ j: Record<string, unknown> }>(`select row_to_json(i)::jsonb j from media_generation_invocations i where id=$1`, [id])).rows[0]!.j,
      assetRows: async (id) =>
        (await client.query<{ j: Record<string, unknown> }>(`select row_to_json(m)::jsonb j from media_assets m where invocation_id=$1`, [id])).rows.map((r) => r.j),
      countMediaAssets: async () => (await client.query<{ n: number }>("select count(*)::int n from media_assets")).rows[0]!.n,
      /* Names only, so a caller can prove both are gone after `dispose()`. */
      resources: { database: harness.dbName, storeRoot: s.root },
      dispose,
    };
  } catch (error) {
    await dispose();
    throw error;
  }
}
