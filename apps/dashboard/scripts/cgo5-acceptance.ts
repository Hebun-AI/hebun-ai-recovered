/*
 * scripts/cgo5-acceptance.ts — CGO-5 production acceptance: ONE real observation of @Candamlalari
 * through the RELEASED provider-observation executor, with before/after counts. Operator only.
 */
import { loadQuietEnv } from "./lib/quiet-env";

loadQuietEnv([".env.hosted.local"], ["DATABASE_URL", "HEBUN_INTEGRATION_ENCRYPTION_KEYS", "HEBUN_INTEGRATION_ENCRYPTION_KEYS_ADDITIONAL", "HEBUN_INTEGRATION_ENCRYPTION_ACTIVE_KEY_ID"]);
process.env.HEBUN_CONTROL_PLANE_ALLOW_REMOTE = "true";

const HANDLE = process.argv[2] ?? "@Candamlalari";
const DIRECTOR_EMAIL = process.env.CGO5_DIRECTOR_EMAIL ?? "senoltr@gmail.com";
const COUNTED = ["integrations", "integration_credentials", "decision_records", "heby_action_requests", "action_execution_attempts", "agent_mandates", "work_artifacts", "work_items", "knowledge_nodes", "conversations", "messages", "audit_log"] as const;

async function main(): Promise<void> {
  /* The schema barrel has an import-order cycle; enter it through the client first. */
  await import("../src/db/client.server");
  const { Client } = await import("pg");
  const { asHumanTenantContext } = await import("../src/features/auth/tenant/tenant-context");
  const { runHebyProviderObservationCommand } = await import("../src/features/heby-commands/provider-observation-commands.server");
  const { readIntegrationGroundingSource } = await import("../src/features/integration-authority/heby-integration-source.server");

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
    const w = who.rows[0]!;
    const tenant = asHumanTenantContext({
      tenantId: w.tenant_id, userId: w.user_id, authIdentityId: w.ai, membershipId: w.membership_id, membershipVersion: 1,
      roleId: w.role_id, sessionContextId: "00000000-0000-4000-8000-000000000005", provider: w.provider as never,
      assuranceLevel: "aal1", mfaVerified: false, requestId: "cgo5-acceptance", authenticatedAt: new Date().toISOString(),
    });

    const counts = async () => {
      const out: Record<string, number> = {};
      for (const t of COUNTED) out[t] = (await client.query<{ n: number }>(`select count(*)::int as n from ${t}`).catch(() => ({ rows: [{ n: -1 }] }))).rows[0]!.n;
      return out;
    };
    const connection = async () => (await client.query(`select id, connection_state, health, external_account_id, external_account_label, scopes, version, last_verified_at, last_success_at, last_error_at from integrations where provider_key = 'youtube'`)).rows;
    const before = await counts();
    const connBefore = await connection();
    console.log("before:", JSON.stringify(before));
    console.log("youtube connection before:", JSON.stringify(connBefore));

    const started = Date.now();
    const result = await runHebyProviderObservationCommand({ commandId: "youtube-channel", args: [HANDLE] }, { resolveTenant: async () => tenant });
    console.log(`result: ${result.status} in ${Date.now() - started} ms`);
    if (result.status === "ok") {
      console.log(`tone: ${result.result.tone}`);
      console.log(`title: ${result.result.title}`);
      console.log("── LINES ──");
      for (const line of result.result.lines) console.log(line);
      console.log("── PROVENANCE ──");
      console.log(result.result.provenance);
    } else {
      console.log(JSON.stringify(result));
    }

    const grounding = await readIntegrationGroundingSource(tenant);
    const item = grounding.state === "resolved" ? grounding.items.find((i) => i.recordRef.startsWith("youtube/")) : undefined;
    console.log("heby integrations grounding:", item ? item.detail : `(none) ${grounding.unavailableReason ?? ""}`);

    const after = await counts();
    const delta: Record<string, number> = {};
    for (const t of COUNTED) delta[t] = after[t]! - before[t]!;
    console.log("after:", JSON.stringify(after));
    console.log("delta:", JSON.stringify(delta));
    console.log("youtube connection after:", JSON.stringify(await connection()));
    console.log("connection unchanged by observation:", JSON.stringify(connBefore) === JSON.stringify(await connection()));
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(String(error?.message ?? error).replace(/AIza[0-9A-Za-z_-]{20,}/g, "<redacted>"));
  process.exitCode = 1;
});
