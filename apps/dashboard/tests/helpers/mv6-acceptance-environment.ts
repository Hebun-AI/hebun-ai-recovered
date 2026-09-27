/*
 * tests/helpers/mv6-acceptance-environment.ts — the DISPOSABLE environment for MV-6 real-provider
 * acceptance. ACCEPTANCE-ONLY TOOLING.
 *
 * A throwaway local Postgres, built from the canonical migrations exactly as the test suite builds
 * its own, seeded with the same synthetic prerequisites the MV-4 lifecycle proof uses (one tenant,
 * one human with an established Governance authority, one durable agent, one content-draft revision),
 * then dropped. It creates no persistence authority of its own: every seed step is the one MV-4's
 * released lifecycle proof already runs (`tests/mv4-async-generation/scenarios.ts`).
 *
 * BOUNDARY. It lives under `tests/helpers/`, which the suite runner skips, and it is reachable only by
 * a dynamic import inside `scripts/mv6-generate-acceptance.ts`. Nothing under `src/` may import it,
 * and nothing it builds can point at a non-local database: the disposable harness refuses protected
 * and remote targets itself. Pinned by `tests/mv6-higgsfield-video/generation-acceptance.ts`.
 */
import { Client } from "pg";
import { createDisposablePostgresHarness } from "./disposable-postgres";
import { createControlPlaneDb, type ControlPlaneDatabase } from "../../src/db/client.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { seedTenant } from "../mv4-async-generation/scenarios";

export interface Mv6AcceptanceEnvironment {
  readonly tenant: TenantContext;
  readonly artifactId: string;
  readonly revisionNo: 1;
  readonly getDb: () => ControlPlaneDatabase;
  readonly countMediaAssets: () => Promise<number>;
  /** Drops the database. Always call it, in a `finally`. */
  readonly dispose: () => Promise<void>;
}

export async function createMv6AcceptanceEnvironment(name = "hebun_mv6_acceptance"): Promise<Mv6AcceptanceEnvironment> {
  const harness = createDisposablePostgresHarness(name);
  await harness.createDatabase();
  const client = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const getDb = () => handle.db;
  const dispose = async () => {
    await client.end().catch(() => undefined);
    await handle.dispose().catch(() => undefined);
    await harness.dropDatabase();
  };
  try {
    harness.migrateDatabase();
    await client.connect();
    const t = await seedTenant(client, getDb, "Acceptance");
    return {
      tenant: t.ctx,
      artifactId: t.draft,
      revisionNo: 1,
      getDb,
      countMediaAssets: async () => (await client.query<{ n: number }>("select count(*)::int n from media_assets")).rows[0]!.n,
      dispose,
    };
  } catch (error) {
    await dispose();
    throw error;
  }
}
