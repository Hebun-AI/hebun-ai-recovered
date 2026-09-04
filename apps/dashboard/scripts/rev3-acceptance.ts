/*
 * scripts/rev3-acceptance.ts — REV-3 production acceptance, DATA HALF.
 *
 * Runs the RELEASED Work seams against production as the real tenant and prints what each prepared
 * artifact row will now say about the recorded work that declares it.
 *
 * READ-ONLY BY CONSTRUCTION. No model call, no provider call, no credential opened, no write. The
 * before/after counters are printed so the absence of a write is measured rather than asserted.
 *
 * WHAT THIS CANNOT PROVE: that the line RENDERS. That needs one authenticated view of /operations.
 */
import { loadQuietEnv } from "./lib/quiet-env";

loadQuietEnv([".env.hosted.local"], ["DATABASE_URL"]);
process.env.HEBUN_CONTROL_PLANE_ALLOW_REMOTE = "true";

const DIRECTOR_EMAIL = process.env.REV3_DIRECTOR_EMAIL ?? "senoltr@gmail.com";
const COUNTED = ["work_artifacts", "work_artifact_revisions", "work_items", "work_evidence_references",
  "knowledge_nodes", "decision_records", "heby_action_requests", "action_execution_attempts",
  "integrations", "integration_credentials", "audit_log"] as const;

async function main(): Promise<void> {
  await import("../src/db/client.server");
  const { Client } = await import("pg");
  const { asHumanTenantContext } = await import("../src/features/auth/tenant/tenant-context");
  const { listWorkArtifacts } = await import("../src/features/work-artifacts/read-work-artifacts.server");
  const { readWorkEvidenceReferences } = await import("../src/features/organizational-work/read-work-evidence.server");
  const { readWorkRegister } = await import("../src/features/organizational-work/read-work.server");
  const { indexArtifactWorkPurpose, NO_DECLARED_WORK_PURPOSE } = await import(
    "../src/features/organizational-work/artifact-work-purpose"
  );

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const who = await client.query<{ user_id: string; tenant_id: string; membership_id: string; role_id: string; ai: string; provider: string }>(
      `select u.id as user_id, m.tenant_id, m.id as membership_id, m.role_id, ai.id as ai, ai.provider
         from users u join memberships m on m.user_id = u.id and m.status='active'
         join auth_identities ai on ai.user_id = u.id and ai.revoked_at is null
        where u.email = $1 order by ai.is_primary desc limit 1`, [DIRECTOR_EMAIL]);
    const w = who.rows[0];
    if (!w) throw new Error(`no active membership for ${DIRECTOR_EMAIL}`);
    const tenant = asHumanTenantContext({
      tenantId: w.tenant_id, userId: w.user_id, authIdentityId: w.ai, membershipId: w.membership_id,
      membershipVersion: 1, roleId: w.role_id, sessionContextId: "00000000-0000-4000-8000-000000000005",
      provider: w.provider as never, assuranceLevel: "aal1", mfaVerified: false,
      requestId: "rev3-acceptance", authenticatedAt: new Date().toISOString(),
    });

    const counts = async () => {
      const out: Record<string, number> = {};
      for (const t of COUNTED) out[t] = (await client.query<{ n: number }>(`select count(*)::int as n from ${t}`).catch(() => ({ rows: [{ n: -1 }] }))).rows[0]!.n;
      return out;
    };
    const before = await counts();
    console.log("before:", JSON.stringify(before));

    const listing = await listWorkArtifacts(tenant);
    if (listing.status !== "read") { console.log(`LISTING UNAVAILABLE: ${listing.reason}`); process.exitCode = 2; return; }
    const [evidence, register] = await Promise.all([
      readWorkEvidenceReferences(tenant, { listArtifacts: async () => listing }),
      readWorkRegister(tenant),
    ]);
    const index = indexArtifactWorkPurpose(evidence, register);
    if (index.status !== "available") { console.log(`INDEX UNAVAILABLE: ${index.detail}`); process.exitCode = 3; return; }

    console.log(`\n── WHAT EACH ROW NOW SAYS (${listing.artifacts.length} artifacts) ──`);
    let linked = 0, unlinked = 0;
    for (const a of listing.artifacts) {
      const items = index.byArtifactId[a.id] ?? [];
      if (items.length > 0) linked += 1; else unlinked += 1;
      const purpose = items.length === 0
        ? NO_DECLARED_WORK_PURPOSE
        : items.map((i) => i.title === null
            ? "Declared evidence for recorded work Hebun could not name here."
            : `Declared evidence for: ${i.title} · declared ${i.declaredState}`).join(" | ");
      console.log(`  ${a.title}\n    revision ${a.currentRevision} · ${purpose}`);
    }
    console.log(`\nLINKED: ${linked} · UNLINKED: ${unlinked} · total ${listing.artifacts.length}`);

    /* Cardinality actually present in production, read from the authority's own table. */
    const card = await client.query<{ artifact_id: string; n: number }>(
      `select work_artifact_id as artifact_id, count(*)::int as n from work_evidence_references
        where work_artifact_id is not null and withdrawn_at is null group by 1 order by 2 desc`);
    console.log("declarations per artifact:", JSON.stringify(card.rows));

    /* No internal identifier is carried on the artifact view. */
    console.log(`authoredByActorId present on any row: ${listing.artifacts.some((a) => "authoredByActorId" in (a as object))}`);

    const after = await counts();
    console.log("\nafter: ", JSON.stringify(after));
    const moved = Object.entries(after).filter(([k, v]) => before[k] !== v);
    console.log(moved.length === 0 ? "NOTHING MOVED — reading recorded nothing" : `MOVED: ${JSON.stringify(moved)}`);
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => { console.error(String((error as Error)?.message ?? error)); process.exitCode = 1; });
