/*
 * scripts/cgo6-acceptance.ts — CGO-6 production acceptance: ONE real content-draft preparation
 * through the RELEASED seam, corroborated from the durable answer-source evidence G6D writes.
 *
 * Touches NO provider: no Google, no Drive, no YouTube, no credential of any kind. It makes one
 * billable model call and writes exactly one work artifact. Operator only.
 */
import { loadQuietEnv } from "./lib/quiet-env";

loadQuietEnv([".env.hosted.local"], ["DATABASE_URL"]);
process.env.HEBUN_CONTROL_PLANE_ALLOW_REMOTE = "true";

const DIRECTOR_EMAIL = process.env.CGO6_DIRECTOR_EMAIL ?? "senoltr@gmail.com";
const COUNTED = ["work_artifacts", "knowledge_nodes", "work_items", "integration_credentials", "integrations", "decision_records", "heby_action_requests", "action_execution_attempts"] as const;

async function main(): Promise<void> {
  await import("../src/db/client.server");
  const { Client } = await import("pg");
  const { asHumanTenantContext } = await import("../src/features/auth/tenant/tenant-context");
  const { prepareWorkArtifact } = await import("../src/features/work-artifacts/prepare-work-artifact.server");

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
      tenantId: w.tenant_id, userId: w.user_id, authIdentityId: w.ai, membershipId: w.membership_id, membershipVersion: 1,
      roleId: w.role_id, sessionContextId: "00000000-0000-4000-8000-000000000005", provider: w.provider as never,
      assuranceLevel: "aal1", mfaVerified: false, requestId: "cgo6-acceptance", authenticatedAt: new Date().toISOString(),
    });

    const counts = async () => {
      const out: Record<string, number> = {};
      for (const t of COUNTED) out[t] = (await client.query<{ n: number }>(`select count(*)::int as n from ${t}`).catch(() => ({ rows: [{ n: -1 }] }))).rows[0]!.n;
      return out;
    };
    const before = await counts();
    console.log("before:", JSON.stringify(before));

    const started = Date.now();
    const prepared = await prepareWorkArtifact({
      prompt: "Draft an Instagram caption for a short video of a rug being hand-knotted on the loom.",
      route: "/operations",
      artifactType: "content-draft",
      intendedDestination: "instagram",
      title: "CGO-6 grounded reel caption",
    }, { resolveTenant: async () => tenant });
    console.log(`result: ${prepared.status} in ${Date.now() - started} ms`);
    if (prepared.status !== "prepared") {
      console.log(JSON.stringify(prepared));
      process.exitCode = 2;
      return;
    }
    console.log(`artifact ${prepared.artifactId} revision ${prepared.revisionNo}`);
    console.log("── CONTENT ──");
    /* The seam returns no `content` field; the stored bytes ARE the model's whole reply. */
    const answer = prepared.answer;
    console.log(answer.status === "answered" ? answer.outcome.response.body.join("\n") : `(answer status: ${answer.status})`);

    const after = await counts();
    console.log("\nafter:", JSON.stringify(after));

    const evidence = await client.query(
      `select source_class, record_ref, label, left(detail, 70) as detail_head, authoritative, ordinal, recorded_at
         from heby_answer_source_evidence
        where tenant_id = $1
          and message_id = (select message_id from heby_answer_source_evidence
                             where tenant_id = $1 order by recorded_at desc limit 1)
        order by ordinal`,
      [w.tenant_id],
    );
    console.log("\n── DURABLE ANSWER-SOURCE EVIDENCE (most recent) ──");
    for (const row of evidence.rows) console.log(JSON.stringify(row));
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(String((error as Error)?.message ?? error));
  process.exitCode = 1;
});
