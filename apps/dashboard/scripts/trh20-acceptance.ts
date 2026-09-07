/*
 * scripts/trh20-acceptance.ts — TRH-20 production acceptance.
 *
 * ONE real live public observation of Turkish Rug House's own YouTube channel, spent on ONE agent
 * origination, through the RELEASED composition, against production data.
 *
 * Three halves, reported separately because they can succeed separately:
 *
 *   OBSERVED     the CGO-5 seam read the channel live. Real key, real quota, real numbers.
 *   ORIGINATED   the model read the fenced observation beside the server-built candidates and
 *                answered inside the closed contract. Needs the model runtime.
 *   FILED        the selection crossed the mandate ceiling and one PENDING request landed.
 *
 * ABSTENTION IS A PASS, NOT A FAILURE. A model that looks at the channel and asks for nothing has
 * answered correctly; the acceptance question is whether the PATH works, not whether the agent
 * wanted something. Both outcomes are reported as what they are.
 *
 * `--dry` performs the observation and prints exactly what the model WOULD receive, without making
 * a billable model call and without writing anything.
 *
 * Operator only. Touches no Google credential. Writes nothing but, at most, the released
 * origination path's own rows — one action request and its invocation provenance.
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
/*
 * The model runtime, loaded BY NAME from the development env file — the same six variables and the
 * same reasoning CGO-7's acceptance recorded. `loadQuietEnv` loads only what it is given, so this
 * brings the model configuration and NOT that file's `DATABASE_URL`, which points at a local
 * database; the production connection string loaded above stays in force.
 */
loadQuietEnv(
  [".env.local"],
  [
    "ANTHROPIC_API_KEY",
    "HEBUN_MODEL_ID",
    "HEBUN_MODEL_PROVIDER",
    "HEBUN_MODEL_TRANSPORT",
    "HEBUN_MODEL_CREDENTIAL",
    "HEBUN_MODEL_CONNECTIVITY_ENABLED",
    "HEBUN_MODEL_MAX_OUTPUT_TOKENS",
  ],
);
process.env.HEBUN_CONTROL_PLANE_ALLOW_REMOTE = "true";

/*
 * The Director-provided channel identity for this phase. It is an ARGUMENT, exactly as CGO-5 made
 * it: no row learns it, no connection carries it, and naming it asserts nothing about who owns it.
 */
const HANDLE = process.argv.find((a) => a.startsWith("@")) ?? "@TurkishRugHouse";
const DRY = process.argv.includes("--dry");
const DIRECTOR_EMAIL = process.env.TRH20_DIRECTOR_EMAIL ?? "senoltr@gmail.com";
const TENANT_SLUG = (() => {
  const flag = process.argv.find((a) => a.startsWith("--tenant="));
  return flag ? flag.slice("--tenant=".length).trim() : "turkish-rug-house";
})();

/**
 * The goal the Director states. Deliberately a QUESTION about the channel and not an instruction to
 * propose anything: seeding the answer would make the acceptance prove that the model can be told
 * what to say, which is not the capability under test.
 */
const GOAL =
  process.env.TRH20_GOAL ??
  "Look at our public YouTube channel and decide whether there is any organizational work worth putting on the record. If there is not, say so.";

const COUNTED = [
  "heby_action_requests",
  "heby_origination_invocations",
  "action_permits",
  "action_execution_attempts",
  "decision_records",
  "work_items",
  "work_artifacts",
  "knowledge_nodes",
  "knowledge_facts",
  "knowledge_external_references",
  "integrations",
  "integration_credentials",
  "heby_answer_source_evidence",
] as const;

async function main(): Promise<void> {
  await import("../src/db/client.server");
  const { Client } = await import("pg");
  const { asHumanTenantContext } = await import("../src/features/auth/tenant/tenant-context");
  const { readPublicChannelObservation } = await import(
    "../src/features/provider-youtube/read-channel-observation.server"
  );
  const { getCapabilityAvailability } = await import(
    "../src/features/integration-authority/capability-availability.server"
  );
  const { YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY } = await import("../src/features/provider-youtube/contracts");
  const { growthObservationSupplementFor } = await import(
    "../src/features/content-observation/growth-origination-brief"
  );
  const { originateAgentActionWithObservation } = await import(
    "../src/features/content-observation/originate-with-observation.server"
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
      requestId: "trh20-acceptance",
      authenticatedAt: new Date().toISOString(),
    });
    console.log(`organization: "${w.company}" (${TENANT_SLUG}) · channel argument ${HANDLE}`);

    /* WHAT THE MANDATE ADMITS, read before anything is asked of the agent. */
    const mandate = await client.query<{ revision: number; scope: string[] }>(
      `select mandate_revision as revision, proposal_scope as scope
         from agent_mandates
        where tenant_id = $1 and lifecycle_status = 'active'
        order by mandate_revision desc limit 1`,
      [w.tenant_id],
    );
    console.log(
      `mandate: ${mandate.rows[0] ? `revision ${mandate.rows[0].revision} scope {${mandate.rows[0].scope.join(", ")}}` : "NONE"}`,
    );

    const availability = await getCapabilityAvailability(tenant);
    const entry = availability.capabilities.find((c) => c.capability === YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY);
    console.log(
      `capability ${YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY}: ${entry?.state ?? "absent"} · writeCapable ${entry?.sources[0]?.writeCapable ?? "n/a"}`,
    );

    const counts = async (): Promise<Record<string, number>> => {
      const out: Record<string, number> = {};
      for (const t of COUNTED) {
        /*
         * NO `.catch()` FALLBACK. Every table below is tenant-scoped, measured against production
         * before this script was written. Swallowing a query error into a sentinel would make an
         * unreadable table look like an unchanged one — and "unchanged" is the entire claim this
         * section exists to make.
         */
        out[t] = (
          await client.query<{ n: number }>(`select count(*)::int as n from ${t} where tenant_id = $1`, [w.tenant_id])
        ).rows[0]!.n;
      }
      return out;
    };
    const before = await counts();
    console.log("before:", JSON.stringify(before));

    /* ── HALF ONE: the live observation, alone, so its outcome is unambiguous ── */
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
    console.log("── WHAT THE MODEL RECEIVES (the fenced growth block, verbatim) ──");
    console.log(growthObservationSupplementFor(observation));

    if (DRY) {
      console.log("\n--dry: no model call, no write.");
      console.log("after:", JSON.stringify(await counts()));
      return;
    }

    /* ── HALVES TWO AND THREE: the origination, with that observation in the grounding ── */
    const originationStarted = Date.now();
    const result = await originateAgentActionWithObservation(
      { goal: GOAL, observeChannelHandle: HANDLE },
      { resolveTenant: async () => tenant },
    );
    console.log(`\nobservation disposition: ${result.observation.status}`);
    console.log(`origination: ${result.origination.status} in ${Date.now() - originationStarted} ms`);
    if (result.origination.status === "refused") {
      console.log(
        `ORIGINATED: ${result.origination.reason === "no-action-proposed" ? "yes — THE AGENT ABSTAINED" : "no"} · ` +
          JSON.stringify({ reason: result.origination.reason, detail: result.origination.detail }),
      );
      console.log("FILED: no");
    } else {
      console.log(`ORIGINATED: yes — kind ${result.origination.kind}`);
      console.log(`FILED: yes`);
      console.log(`reason (the agent's own words): ${result.origination.reason}`);
    }

    /*
     * THE INVOCATION ROW, read independently of what the seam returned. Provider, model, state,
     * failure code and filing outcome are facts production recorded, not facts this script asserts.
     */
    const invocation = await client.query<Record<string, unknown>>(
      `select transport, provider, model, state, failure_code as "failureCode",
              filing_outcome as "filingOutcome", filing_refusal as "filingRefusal",
              input_tokens as "inputTokens", output_tokens as "outputTokens"
         from heby_origination_invocations
        where tenant_id = $1 order by created_at desc limit 1`,
      [w.tenant_id],
    );
    console.log("invocation:", JSON.stringify(invocation.rows[0] ?? null));

    const request = await client.query<Record<string, unknown>>(
      `select action_kind as "actionKind", status, target_kind as "targetKind",
              proposed_by_actor_type as "proposedByActorType",
              proposal_rationale as "proposalRationale",
              canonical_payload as "canonicalPayload"
         from heby_action_requests
        where tenant_id = $1 order by created_at desc limit 1`,
      [w.tenant_id],
    );
    console.log("latest action request:", JSON.stringify(request.rows[0] ?? null));

    const after = await counts();
    console.log("after:", JSON.stringify(after));
    const moved = Object.keys(after).filter((k) => after[k] !== before[k]);
    console.log(`moved: ${moved.length === 0 ? "NOTHING" : moved.map((k) => `${k} ${before[k]}→${after[k]}`).join(", ")}`);

    /* The non-effects this phase claims, stated as a verdict rather than left to be read off. */
    for (const table of [
      "action_permits",
      "action_execution_attempts",
      "decision_records",
      "work_items",
      "knowledge_nodes",
      "knowledge_facts",
      "knowledge_external_references",
      "integrations",
      "integration_credentials",
      "heby_answer_source_evidence",
    ] as const) {
      const ok = after[table] === before[table];
      console.log(`${ok ? "UNCHANGED" : "CHANGED  "} ${table}: ${before[table]} → ${after[table]}`);
      if (!ok) process.exitCode = 3;
    }
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(String(error?.message ?? error).replace(/AIza[0-9A-Za-z_-]{20,}/g, "<redacted>"));
  process.exitCode = 1;
});
