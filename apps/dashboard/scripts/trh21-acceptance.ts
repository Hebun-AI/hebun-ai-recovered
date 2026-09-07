/*
 * scripts/trh21-acceptance.ts — TRH-21 production acceptance.
 *
 * ONE real, human-triggered, already-authorized YouTube observation, recorded as ONE immutable
 * provider-observation row, against production data.
 *
 * WHAT THIS IS NOT. It is not a scheduler, not a collection loop and not a standing authorization.
 * It runs once, because a human ran it. TRH-21 creates MEMORY OF AUTHORIZED OBSERVATIONS and no
 * authority to make future ones — running this twice is two human acts, not a cadence.
 *
 * `--dry` performs the live observation and prints exactly what WOULD be recorded, writing nothing.
 * `--replay` performs a second recording of the SAME observation instant to demonstrate the
 * idempotency contract answering `already-recorded`; it is off by default because a ceremony should
 * not spend provider quota proving a property the suite already proves.
 *
 * Operator only. Touches no Google credential and no model.
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

const HANDLE = process.argv.find((a) => a.startsWith("@")) ?? "@TurkishRugHouse";
const DRY = process.argv.includes("--dry");
const REPLAY = process.argv.includes("--replay");
const DIRECTOR_EMAIL = process.env.TRH21_DIRECTOR_EMAIL ?? "senoltr@gmail.com";
const TENANT_SLUG = (() => {
  const flag = process.argv.find((a) => a.startsWith("--tenant="));
  return flag ? flag.slice("--tenant=".length).trim() : "turkish-rug-house";
})();

/**
 * Every table whose count is asserted afterwards. `provider_observations` is the ONLY one expected
 * to move; the rest are the non-effects this phase claims, measured rather than promised.
 */
const COUNTED = [
  "provider_observations",
  "knowledge_nodes",
  "knowledge_facts",
  "knowledge_external_references",
  "work_items",
  "work_artifacts",
  "work_evidence_references",
  "decision_records",
  "action_permits",
  "action_execution_attempts",
  "heby_action_requests",
  "heby_origination_invocations",
  "heby_answer_source_evidence",
  "integrations",
  "integration_credentials",
  "audit_log",
] as const;

async function main(): Promise<void> {
  await import("../src/db/client.server");
  const { Client } = await import("pg");
  const { asHumanTenantContext } = await import("../src/features/auth/tenant/tenant-context");
  const { getCapabilityAvailability } = await import(
    "../src/features/integration-authority/capability-availability.server"
  );
  const { YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY } = await import("../src/features/provider-youtube/contracts");
  const { readPublicChannelObservation } = await import(
    "../src/features/provider-youtube/read-channel-observation.server"
  );
  const {
    recordYouTubeChannelObservation,
    youtubeChannelObservationFacts,
    youtubeChannelSubjectRef,
  } = await import("../src/features/provider-observation-history/record-youtube-channel-observation.server");
  const { readProviderObservations } = await import(
    "../src/features/provider-observation-history/read-provider-observations.server"
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
      company: string;
    }>(
      `select u.id as user_id, m.tenant_id, m.id as membership_id, m.role_id, ai.id as ai, ai.provider,
              c.name as company
         from users u join memberships m on m.user_id = u.id and m.status = 'active'
         join companies c on c.id = m.tenant_id
         join auth_identities ai on ai.user_id = u.id and ai.revoked_at is null
        where u.email = $1 and c.slug = $2
        order by ai.is_primary desc limit 1`,
      [DIRECTOR_EMAIL, TENANT_SLUG],
    );
    const w = who.rows[0];
    if (!w) throw new Error(`no active membership for ${DIRECTOR_EMAIL} in organization "${TENANT_SLUG}"`);
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
      requestId: "trh21-acceptance",
      authenticatedAt: new Date().toISOString(),
    });
    console.log(`organization: "${w.company}" (${TENANT_SLUG}) · channel argument ${HANDLE}`);

    const availability = await getCapabilityAvailability(tenant);
    const entry = availability.capabilities.find((c) => c.capability === YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY);
    console.log(
      `capability ${YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY}: ${entry?.state ?? "absent"} · writeCapable ${entry?.sources[0]?.writeCapable ?? "n/a"}`,
    );

    const counts = async (): Promise<Record<string, number>> => {
      const out: Record<string, number> = {};
      for (const t of COUNTED) {
        out[t] = (
          await client.query<{ n: number }>(`select count(*)::int as n from ${t} where tenant_id = $1`, [w.tenant_id])
        ).rows[0]!.n;
      }
      return out;
    };
    const before = await counts();
    console.log("before:", JSON.stringify(before));

    if (DRY) {
      /* The live read, with NOTHING recorded — so the operator sees exactly what would be. */
      const outcome = await readPublicChannelObservation(tenant, HANDLE);
      if (!outcome.ok) {
        console.log(`OBSERVED: no — ${JSON.stringify(outcome)}`);
        process.exitCode = 2;
        return;
      }
      console.log(
        `OBSERVED: yes — ${outcome.value.channel.title} (${outcome.value.channel.handle ?? "no handle reported"}), ` +
          `${outcome.value.recentVideos.length} recent uploads, ${outcome.value.quotaUnitsSpent} quota units`,
      );
      console.log("── WHAT WOULD BE RECORDED ──");
      console.log(
        JSON.stringify(
          {
            subjectRef: youtubeChannelSubjectRef(outcome.value.channel.channelId),
            integrationId: "(the connection the capability authority chose)",
            observedAt: outcome.value.observedAt,
            facts: youtubeChannelObservationFacts(outcome.value),
          },
          null,
          2,
        ),
      );
      console.log("\n--dry: nothing was written.");
      console.log("after:", JSON.stringify(await counts()));
      return;
    }

    /* ── THE ONE ACT: observe, and remember what was observed ── */
    const started = Date.now();
    const result = await recordYouTubeChannelObservation(tenant, HANDLE);
    console.log(`observation + record: ${Date.now() - started} ms`);

    if (!result.observation.ok) {
      console.log(`OBSERVED: no — ${JSON.stringify(result.observation)}`);
      console.log("RECORDED: no — nothing is recorded for an observation that did not happen");
      process.exitCode = 2;
      return;
    }
    const observation = result.observation.value;
    console.log(
      `OBSERVED: yes — ${observation.channel.title} (${observation.channel.handle ?? "no handle reported"}), ` +
        `${observation.recentVideos.length} recent uploads, ${observation.quotaUnitsSpent} quota units`,
    );
    console.log(`RECORDED: ${result.record?.status ?? "not-attempted"}`);

    if (REPLAY) {
      /*
       * The idempotency contract, demonstrated rather than asserted. A SECOND provider read at a
       * later instant would be a NEW observation, so this deliberately re-records the SAME
       * observation object instead of reading again.
       */
      const { recordProviderObservation } = await import(
        "../src/features/provider-observation-history/write-provider-observation.server"
      );
      const { YOUTUBE_PROVIDER_KEY } = await import("../src/features/provider-youtube/contracts");
      const replay = await recordProviderObservation(tenant, {
        providerKey: YOUTUBE_PROVIDER_KEY,
        capabilityKey: YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY,
        subjectKind: "youtube-channel",
        subjectRef: youtubeChannelSubjectRef(observation.channel.channelId),
        integrationId: result.observation.integrationId,
        observedAt: observation.observedAt,
        facts: youtubeChannelObservationFacts(observation),
      });
      console.log(`REPLAY of the same observation: ${replay.status} (expected already-recorded)`);
    }

    /* ── INDEPENDENT MEASUREMENT ── */
    const stored = await readProviderObservations(tenant, {}, {});
    console.log(
      `history now holds: ${stored.status === "read" ? stored.observations.length : `unreadable (${stored.reason})`}`,
    );
    if (stored.status === "read") {
      for (const item of stored.observations) {
        console.log(
          `  ${item.observedAt} · ${item.providerKey} · ${item.subjectRef} · by ${item.observedByActorType} · ` +
            `facts ${JSON.stringify(item.facts)}`,
        );
      }
    }

    const after = await counts();
    console.log("after:", JSON.stringify(after));
    const moved = Object.keys(after).filter((k) => after[k] !== before[k]);
    console.log(`moved: ${moved.length === 0 ? "NOTHING" : moved.map((k) => `${k} ${before[k]}→${after[k]}`).join(", ")}`);

    /*
     * THE VERDICT, STATED RATHER THAN LEFT TO BE READ OFF. Exactly one table may move, and every
     * other one is a non-effect this phase claims.
     */
    let clean = true;
    for (const table of COUNTED) {
      if (table === "provider_observations") continue;
      const ok = after[table] === before[table];
      console.log(`${ok ? "UNCHANGED" : "CHANGED  "} ${table}: ${before[table]} → ${after[table]}`);
      if (!ok) clean = false;
    }
    if (!clean) process.exitCode = 3;
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(String(error?.message ?? error).replace(/AIza[0-9A-Za-z_-]{20,}/g, "<redacted>"));
  process.exitCode = 1;
});
