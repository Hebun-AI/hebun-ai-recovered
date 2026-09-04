/*
 * scripts/rev2-acceptance.ts — REV-2 production acceptance, DATA HALF.
 *
 * Runs the RELEASED listing seam against production as the real tenant and prints what a row now
 * carries. Proves the fact is reachable without opening any artifact's history.
 *
 * READ-ONLY BY CONSTRUCTION. No model call, no provider call, no credential opened, no write. The
 * before/after counts are printed so the absence of a write is measured rather than asserted.
 *
 * WHAT THIS CANNOT PROVE. That the label RENDERS. That needs one authenticated view of
 * /operations, which an operator shell must not perform — see the closure record.
 */
import { loadQuietEnv } from "./lib/quiet-env";

loadQuietEnv([".env.hosted.local"], ["DATABASE_URL"]);
process.env.HEBUN_CONTROL_PLANE_ALLOW_REMOTE = "true";

const DIRECTOR_EMAIL = process.env.REV2_DIRECTOR_EMAIL ?? "senoltr@gmail.com";
const COUNTED = ["work_artifacts", "work_artifact_revisions", "knowledge_nodes", "work_items",
  "integrations", "integration_credentials", "decision_records", "heby_action_requests",
  "action_execution_attempts"] as const;

async function main(): Promise<void> {
  await import("../src/db/client.server");
  const { Client } = await import("pg");
  const { asHumanTenantContext } = await import("../src/features/auth/tenant/tenant-context");
  const { listWorkArtifacts } = await import("../src/features/work-artifacts/read-work-artifacts.server");
  const { workArtifactAuthorLabel, WORK_ARTIFACT_LIST_AUTHORSHIP_NON_CLAIM } = await import(
    "../src/features/work-artifacts/contracts"
  );

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const who = await client.query<{ user_id: string; tenant_id: string; membership_id: string; role_id: string; ai: string; provider: string }>(
      `select u.id as user_id, m.tenant_id, m.id as membership_id, m.role_id, ai.id as ai, ai.provider
         from users u join memberships m on m.user_id = u.id and m.status = 'active'
         join auth_identities ai on ai.user_id = u.id and ai.revoked_at is null
        where u.email = $1 order by ai.is_primary desc limit 1`,
      [DIRECTOR_EMAIL],
    );
    const w = who.rows[0];
    if (!w) throw new Error(`no active membership for ${DIRECTOR_EMAIL}`);
    const tenant = asHumanTenantContext({
      tenantId: w.tenant_id, userId: w.user_id, authIdentityId: w.ai, membershipId: w.membership_id,
      membershipVersion: 1, roleId: w.role_id, sessionContextId: "00000000-0000-4000-8000-000000000005",
      provider: w.provider as never, assuranceLevel: "aal1", mfaVerified: false,
      requestId: "rev2-acceptance", authenticatedAt: new Date().toISOString(),
    });

    const counts = async () => {
      const out: Record<string, number> = {};
      for (const t of COUNTED) {
        out[t] = (await client.query<{ n: number }>(`select count(*)::int as n from ${t}`).catch(() => ({ rows: [{ n: -1 }] }))).rows[0]!.n;
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

    console.log(`\n── WHAT THE LIST NOW CARRIES (${listing.artifacts.length} artifacts) ──`);
    console.log(WORK_ARTIFACT_LIST_AUTHORSHIP_NON_CLAIM);
    console.log("");
    const tally: Record<string, number> = {};
    for (const a of listing.artifacts) {
      const type = a.currentRevisionAuthoredByActorType;
      tally[type || "(unresolved)"] = (tally[type || "(unresolved)"] ?? 0) + 1;
      console.log(
        `  ${a.title}\n    revision ${a.currentRevision}: ${workArtifactAuthorLabel(type)}` +
          `${a.intendedDestination ? ` · prepared for ${a.intendedDestination}` : ""}` +
          `${a.lifecycleStatus === "retired" ? " · retired" : ""}`,
      );
    }
    console.log("\ncurrent-revision authorship tally:", JSON.stringify(tally));

    /* The identifier is NOT on the view. Asserted against the released type, not hoped for. */
    const leaked = listing.artifacts.filter((a) => "authoredByActorId" in (a as object));
    console.log(`authoredByActorId present on any row: ${leaked.length > 0}`);

    const after = await counts();
    console.log("\nafter: ", JSON.stringify(after));
    const moved = Object.entries(after).filter(([k, v]) => before[k] !== v);
    console.log(moved.length === 0 ? "NOTHING MOVED — reading recorded nothing" : `MOVED: ${JSON.stringify(moved)}`);
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(String((error as Error)?.message ?? error));
  process.exitCode = 1;
});
