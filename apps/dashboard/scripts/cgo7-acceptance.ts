/*
 * scripts/cgo7-acceptance.ts — CGO-7 production acceptance.
 *
 * ONE real live public observation of a real YouTube channel, spent on ONE content-draft
 * preparation, through the RELEASED composition, against production data.
 *
 * Two halves, reported separately because they can succeed separately:
 *
 *   OBSERVED    the CGO-5 seam read the channel live. Real key, real quota, real numbers.
 *   PREPARED    the model wrote a draft with that observation in its brief. Needs the model
 *               runtime, which is connected only in the deployed environment — where it is not,
 *               the seam refuses with `no-model-answer` and files nothing, which is correct and
 *               is reported as such rather than as a failure of the observation.
 *
 * `--dry` performs the observation and prints exactly what the model WOULD receive, without making
 * a billable model call and without writing anything.
 *
 * Operator only. Touches no Google credential.
 */
import { loadQuietEnv } from "./lib/quiet-env";

loadQuietEnv(
  [".env.hosted.local"],
  [
    "DATABASE_URL",
    "HEBUN_INTEGRATION_ENCRYPTION_KEYS",
    "HEBUN_INTEGRATION_ENCRYPTION_KEYS_ADDITIONAL",
    "HEBUN_INTEGRATION_ENCRYPTION_ACTIVE_KEY_ID",
  ],
);
process.env.HEBUN_CONTROL_PLANE_ALLOW_REMOTE = "true";

const HANDLE = process.argv.find((a) => a.startsWith("@")) ?? "@Candamlalari";
const DRY = process.argv.includes("--dry");
const DIRECTOR_EMAIL = process.env.CGO7_DIRECTOR_EMAIL ?? "senoltr@gmail.com";

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
  "heby_answer_source_evidence",
] as const;

async function main(): Promise<void> {
  await import("../src/db/client.server");
  const { Client } = await import("pg");
  const { asHumanTenantContext } = await import("../src/features/auth/tenant/tenant-context");
  const { readPublicChannelObservation } = await import(
    "../src/features/provider-youtube/read-channel-observation.server"
  );
  const { observationSupplementFor } = await import("../src/features/content-observation/observation-brief");
  const { prepareContentDraftWithObservation } = await import(
    "../src/features/content-observation/prepare-with-observation.server"
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
      requestId: "cgo7-acceptance",
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

    /* ── HALF ONE: the live observation, on its own, so its outcome is unambiguous ── */
    const started = Date.now();
    const outcome = await readPublicChannelObservation(tenant, HANDLE);
    console.log(`observation: ${Date.now() - started} ms`);
    if (!outcome.ok) {
      console.log(`OBSERVED: no — ${JSON.stringify(outcome)}`);
      process.exitCode = 2;
      return;
    }
    const observation = outcome.value;
    console.log(
      `OBSERVED: yes — ${observation.channel.title} (${observation.channel.handle ?? "no handle reported"}), ` +
        `${observation.recentVideos.length} recent uploads, ${observation.quotaUnitsSpent} quota units`,
    );
    console.log("── WHAT THE MODEL WOULD RECEIVE (the fenced supplement, verbatim) ──");
    console.log(observationSupplementFor(observation));

    if (DRY) {
      console.log("\n--dry: no model call, no write.");
      console.log("after:", JSON.stringify(await counts()));
      return;
    }

    /* ── HALF TWO: the preparation, with that observation in the brief ── */
    const prepStarted = Date.now();
    const result = await prepareContentDraftWithObservation(
      {
        prompt:
          "Draft an Instagram caption for a short video of a rug being hand-knotted on the loom.",
        route: "/operations",
        artifactType: "content-draft",
        intendedDestination: "instagram",
        title: "CGO-7 observed reel caption",
        observeChannelHandle: HANDLE,
      },
      { resolveTenant: async () => tenant },
    );
    console.log(`\nobservation disposition: ${result.observation.status}`);
    console.log(`PREPARED: ${result.preparation.status} in ${Date.now() - prepStarted} ms`);
    if (result.preparation.status !== "prepared") {
      console.log(JSON.stringify({ reason: result.preparation.reason }));
      console.log("after:", JSON.stringify(await counts()));
      process.exitCode = 3;
      return;
    }
    console.log(`artifact ${result.preparation.artifactId} revision ${result.preparation.revisionNo}`);
    console.log("── CONTENT (the model's whole reply, stored verbatim) ──");
    const answer = result.preparation.answer;
    console.log(
      answer.status === "answered"
        ? answer.outcome.response.body.join("\n")
        : `(answer status: ${answer.status})`,
    );

    const after = await counts();
    console.log("\nafter:", JSON.stringify(after));

    /* The observation must appear NOWHERE durable. Asserted against production, not assumed. */
    const leaked = await client.query<{ table_name: string; n: number }>(
      `select 'work_artifact_revisions' as table_name, count(*)::int as n from work_artifact_revisions
        where content ilike '%viewCount%' or content ilike '%subscriber%' or content ilike '%youtube%'
       union all
       select 'heby_answer_source_evidence', count(*)::int from heby_answer_source_evidence
        where source_class::text ilike '%youtube%' or coalesce(record_ref,'') ilike 'youtube/%'`,
    );
    console.log("\n── OBSERVATION LEAK CHECK (expect 0 everywhere) ──");
    for (const row of leaked.rows) console.log(JSON.stringify(row));
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(String((error as Error)?.message ?? error));
  process.exitCode = 1;
});
