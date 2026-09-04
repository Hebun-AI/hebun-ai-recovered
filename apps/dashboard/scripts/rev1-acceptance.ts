/*
 * scripts/rev1-acceptance.ts — REV-1 production acceptance, seam half.
 *
 * Runs the RELEASED read seam and the RELEASED vocabulary against production data, as the real
 * Director's tenant, and prints the exact sentence `/operations` now renders beside each revision.
 *
 * Read-only in every sense: no model call, no provider call, no credential opened, no write. The
 * counts before and after are printed so "reading changes nothing" is measured, not asserted.
 *
 * Operator only.
 */
import { loadQuietEnv } from "./lib/quiet-env";

loadQuietEnv([".env.hosted.local"], ["DATABASE_URL"]);
process.env.HEBUN_CONTROL_PLANE_ALLOW_REMOTE = "true";

const DIRECTOR_EMAIL = process.env.REV1_DIRECTOR_EMAIL ?? "senoltr@gmail.com";
const COUNTED = [
  "work_artifacts",
  "work_artifact_revisions",
  "knowledge_nodes",
  "work_items",
  "integrations",
  "integration_credentials",
  "decision_records",
  "heby_action_requests",
  "action_execution_attempts",
] as const;

async function main(): Promise<void> {
  await import("../src/db/client.server");
  const { Client } = await import("pg");
  const { asHumanTenantContext } = await import("../src/features/auth/tenant/tenant-context");
  const { listWorkArtifacts, readWorkArtifactHistory } = await import(
    "../src/features/work-artifacts/read-work-artifacts.server"
  );
  const { workArtifactAuthorLabel, WORK_ARTIFACT_AUTHORSHIP_NON_CLAIMS } = await import(
    "../src/features/work-artifacts/contracts"
  );

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const who = await client.query<{
      user_id: string;
      tenant_id: string;
      membership_id: string;
      role_id: string;
      ai: string;
      provider: string;
    }>(
      `select u.id as user_id, m.tenant_id, m.id as membership_id, m.role_id, ai.id as ai, ai.provider
         from users u join memberships m on m.user_id = u.id and m.status = 'active'
         join auth_identities ai on ai.user_id = u.id and ai.revoked_at is null
        where u.email = $1 order by ai.is_primary desc limit 1`,
      [DIRECTOR_EMAIL],
    );
    const w = who.rows[0];
    if (!w) throw new Error(`no active membership for ${DIRECTOR_EMAIL}`);
    const tenant = asHumanTenantContext({
      tenantId: w.tenant_id,
      userId: w.user_id,
      authIdentityId: w.ai,
      membershipId: w.membership_id,
      membershipVersion: 1,
      roleId: w.role_id,
      sessionContextId: "00000000-0000-4000-8000-000000000005",
      provider: w.provider as never,
      assuranceLevel: "aal1",
      mfaVerified: false,
      requestId: "rev1-acceptance",
      authenticatedAt: new Date().toISOString(),
    });

    const counts = async () => {
      const out: Record<string, number> = {};
      for (const t of COUNTED) {
        out[t] = (
          await client
            .query<{ n: number }>(`select count(*)::int as n from ${t}`)
            .catch(() => ({ rows: [{ n: -1 }] }))
        ).rows[0]!.n;
      }
      return out;
    };
    const before = await counts();
    console.log("before:", JSON.stringify(before));

    const listing = await listWorkArtifacts(tenant);
    if (listing.status !== "read") {
      console.log(`LISTING UNAVAILABLE: ${listing.reason}`);
      process.exitCode = 2;
      return;
    }
    console.log(`\nartifacts readable by this tenant: ${listing.artifacts.length}`);

    let human = 0;
    let agent = 0;
    let unnamed = 0;
    console.log("\n── WHAT /operations NOW RENDERS BESIDE EACH REVISION ──");
    for (const artifact of listing.artifacts) {
      const history = await readWorkArtifactHistory(tenant, artifact.id);
      console.log(
        `\n${artifact.title} · ${artifact.artifactType}` +
          (artifact.intendedDestination ? ` · prepared for ${artifact.intendedDestination}` : ""),
      );
      for (const revision of history) {
        const label = workArtifactAuthorLabel(revision.authoredByActorType);
        if (revision.authoredByActorType === "human") human += 1;
        else if (revision.authoredByActorType === "agent") agent += 1;
        else unnamed += 1;
        console.log(`  @${revision.revisionNo}${revision.current ? " · current" : ""} — ${label}`);
      }
    }

    console.log(`\ntotals: human ${human} · agent ${agent} · unnamed ${unnamed}`);
    console.log("\n── AND WHAT IT SAYS THAT DOES NOT MEAN ──");
    for (const claim of WORK_ARTIFACT_AUTHORSHIP_NON_CLAIMS) console.log(`  ${claim}`);

    const after = await counts();
    console.log("\nafter:", JSON.stringify(after));
    const moved = COUNTED.filter((t) => before[t] !== after[t]);
    console.log(moved.length === 0 ? "\nNOTHING MOVED — reviewing wrote nothing." : `\nMOVED: ${moved.join(", ")}`);
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(String((error as Error)?.message ?? error));
  process.exitCode = 1;
});
