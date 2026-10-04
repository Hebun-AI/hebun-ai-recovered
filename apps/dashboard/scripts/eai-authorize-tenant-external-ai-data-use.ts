/*
 * Tenant external-AI data-use authorization ceremony — OPERATOR CLI.
 *
 *   npm run platform:tenant-external-ai-data-use -- --tenant=<slug>                        # dry run
 *   npm run platform:tenant-external-ai-data-use -- --tenant=<slug> --confirm              # authorize
 *   npm run platform:tenant-external-ai-data-use -- --tenant=<slug> --withdraw --confirm   # withdraw
 *
 * ── WHOSE DECISION THIS IS ──────────────────────────────────────────────────
 *
 * THE TENANT'S GOVERNANCE AUTHORITY'S. The terminal supplies an organization slug and a human's
 * email; the human's ACTIVE membership is resolved from the database, and the released writer
 * (`authorizeTenantExternalAiDataUse`) decides whether that human holds this tenant's Governance.
 * Possession of the deployment grants nothing here. Same shape as `trh23-authorize-standing-observation`
 * and `rung2-authorize-tenant-machine-execution`, for the same reason: a tenant Governance decision
 * must be reachable from a terminal until a product surface exists.
 *
 * ── WHAT IS AUTHORIZED IS NOT AN OPTION ─────────────────────────────────────
 *
 * The service scope is `anthropic/messages`, the purpose is `assistance`, and the (purpose, data
 * class) pairs are READ OFF the recorded platform policy (B1D: conversation, knowledge,
 * work-artifact). No flag names a scope, purpose, data class or attestation, and an unknown flag is
 * refused, so this file cannot ask for more than the platform already ALLOWS. The attestation is the
 * one in force, read through the released reader; the writer re-checks all of it in one transaction.
 *
 * ── WHAT IT DELIBERATELY CANNOT DO ──────────────────────────────────────────
 *
 *   - write anything itself: no INSERT, UPDATE or DELETE; the only SQL is a read-only lookup
 *   - widen the platform policy or change an attestation
 *   - read a provider credential or call a provider
 *   - enable any runtime path: nothing consults this authorization until B2
 *
 * AUTHORIZING DATA USE IS NOT SENDING DATA.
 */
import { createInterface } from "node:readline";
import { Client } from "pg";

const SERVICE_SCOPE = "anthropic/messages";
const PURPOSE = "assistance";
const EXPECTED_DATA_CLASSES = ["conversation", "knowledge", "work-artifact"];
const KNOWN_FLAGS = ["tenant", "director", "justification", "confirm", "withdraw"];
const CONFIRMATION = "AUTHORIZE EXTERNAL AI DATA USE";
const WITHDRAWAL_CONFIRMATION = "WITHDRAW EXTERNAL AI DATA USE";

function fail(message: string): never {
  console.error(`\n  ✖ ${message}\n`);
  process.exit(1);
}

function arg(name: string): string | undefined {
  const flag = process.argv.find((a) => a.startsWith(`--${name}=`));
  return flag ? flag.slice(name.length + 3).trim() : undefined;
}
function has(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function promptVisible(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(new Error("this ceremony requires an interactive terminal"));
      return;
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main(): Promise<void> {
  /* Refused before anything is read: a pipe can never reach the confirmation. */
  if (!process.stdin.isTTY) fail("this ceremony requires an interactive terminal. Nothing was read or changed.");
  if (process.env.NODE_ENV === "production") {
    fail("this ceremony runs from an operator terminal and refuses NODE_ENV=production.");
  }
  for (const a of process.argv.slice(2)) {
    const name = a.replace(/^--/, "").split("=")[0]!;
    if (!a.startsWith("--") || !KNOWN_FLAGS.includes(name)) fail(`unknown argument "${a}" — scope, purpose and data classes are not options`);
  }

  const tenantSlug = arg("tenant");
  if (!tenantSlug) fail("--tenant=<slug> is required");
  const directorEmail = arg("director") ?? "senoltr@gmail.com";
  const withdraw = has("withdraw");
  const confirmed = has("confirm");
  const justification =
    arg("justification") ??
    (withdraw
      ? "We are withdrawing external AI processing of this organization's data while we review how it is supervised."
      : "This organization agrees that its conversations, Knowledge and work artifacts may be processed by the reviewed Anthropic assistance processor, and I accept responsibility for that.");

  if (!process.env.DATABASE_URL) fail("DATABASE_URL is not set");

  await import("../src/db/client.server");
  const { asHumanTenantContext } = await import("../src/features/auth/tenant/tenant-context");
  const { RECORDED_PLATFORM_DISCLOSURE_POLICY, attestationSatisfiesBounds } = await import(
    "../src/features/external-ai-data-use/platform-disclosure-policy"
  );
  const { readLatestProcessorAttestation } = await import(
    "../src/features/external-ai-data-use/read-processor-attestations.server"
  );
  const { readEffectiveTenantExternalAiDataUse } = await import(
    "../src/features/external-ai-data-use/read-tenant-external-ai-data-use.server"
  );
  const { authorizeTenantExternalAiDataUse, withdrawTenantExternalAiDataUse } = await import(
    "../src/features/external-ai-data-use/authorize-tenant-external-ai-data-use.server"
  );

  /* ── WHAT. Read off the recorded policy, never typed here. ─────────────────────────────────── */
  const cells = RECORDED_PLATFORM_DISCLOSURE_POLICY.allowedCells.filter(
    (c) => c.serviceScope === SERVICE_SCOPE && c.purpose === PURPOSE,
  );
  const scopes = cells.map((c) => ({ purpose: c.purpose, dataClass: c.dataClass }));
  if (JSON.stringify(scopes.map((s) => s.dataClass).sort()) !== JSON.stringify([...EXPECTED_DATA_CLASSES].sort())) {
    fail(`the recorded platform policy no longer ALLOWS exactly ${EXPECTED_DATA_CLASSES.join(", ")} — refusing.`);
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    /* ── WHO. A real, active membership, resolved server-side. ─────────────────────────────── */
    const who = await client.query<{
      user_id: string;
      tenant_id: string;
      membership_id: string;
      role_id: string;
      ai: string;
      provider: string;
      company: string;
    }>(
      `select u.id as user_id, m.tenant_id, m.id as membership_id, m.role_id, ai.id as ai,
              ai.provider, c.name as company
         from users u
         join memberships m on m.user_id = u.id and m.status = 'active'
         join companies c on c.id = m.tenant_id
         join auth_identities ai on ai.user_id = u.id and ai.revoked_at is null
        where u.email = $1 and c.slug = $2
        order by ai.is_primary desc
        limit 1`,
      [directorEmail, tenantSlug],
    );
    const w = who.rows[0];
    if (!w) fail(`no active membership for ${directorEmail} in organization "${tenantSlug}"`);

    /* ── UNDER WHICH BOUNDARY. Exactly one reviewed account for the scope, or a refusal. ─────── */
    const accounts = (
      await client.query<{ account_ref: string }>(
        `select distinct account_ref from processor_attestations where service_scope = $1`,
        [SERVICE_SCOPE],
      )
    ).rows;
    if (accounts.length !== 1) fail(`expected exactly one ${SERVICE_SCOPE} attestation lineage, found ${accounts.length}`);
    const accountRef = accounts[0]!.account_ref;

    const attestation = await readLatestProcessorAttestation(SERVICE_SCOPE, accountRef);
    if (attestation.status !== "read") fail(`the processor attestation is ${attestation.status}. Nothing was changed.`);
    const inForce = attestation.latest;
    if (inForce.state !== "active") fail("the processor attestation in force is withdrawn. Nothing was changed.");
    /* Display only — the writer re-reads the lineage head itself. */
    const revision = (
      await client.query<{ r: number }>(`select attestation_revision as r from processor_attestations where id = $1`, [inForce.id])
    ).rows[0]?.r;

    const effective = await readEffectiveTenantExternalAiDataUse(w.tenant_id, SERVICE_SCOPE, accountRef);
    if (effective.status === "unavailable") fail("the tenant authorization could not be read. Nothing was changed.");
    const current = effective.status === "read" ? effective.effective : null;

    console.log("");
    console.log(`  TENANT EXTERNAL-AI DATA-USE ${withdraw ? "WITHDRAWAL" : "AUTHORIZATION"} CEREMONY`);
    console.log("");
    console.log(`  organization : ${w.company} (${tenantSlug})`);
    console.log(`  tenant       : ${w.tenant_id}`);
    console.log(`  deciding as  : ${directorEmail}`);
    console.log(`  service      : ${SERVICE_SCOPE} · account ${accountRef}`);
    console.log(
      `  attestation  : ${inForce.id} · revision ${revision} · ${inForce.state} · identity ${inForce.identityStatus}`,
    );
    console.log(
      `                 ${inForce.contractSurface} · training ${inForce.training} · retention ${inForce.retentionClass} · ZDR ${inForce.zdr}`,
    );
    console.log(
      `  current      : ${current ? `revision ${current.authorizationRevision} (${current.state}) · ${current.scopes.map((s) => `${s.purpose}×${s.dataClass}`).join(", ") || "no scopes"}` : "none — this organization has never authorized external AI data use"}`,
    );
    if (withdraw) {
      console.log("  requested    : WITHDRAW (a new revision with no scopes)");
    } else {
      console.log(`  requested    : ${scopes.map((s) => `${s.purpose} × ${s.dataClass}`).join(", ")}`);
      for (const cell of cells) {
        const fits = attestationSatisfiesBounds(inForce, cell.bounds);
        console.log(`                 ${cell.dataClass.padEnd(13)} platform ALLOWED · attestation ${fits ? "inside" : "OUTSIDE"} bounds`);
        if (!fits) fail("the attestation in force is outside the platform bounds — refusing.");
      }
    }
    console.log("");
    console.log("  THIS IS THE ORGANIZATION'S OWN DECISION. It is written only if this human holds THIS");
    console.log("  tenant's Governance authority. It sends nothing, calls no provider, reads no credential,");
    console.log("  and nothing at runtime consults it yet: authorizing data use is not sending data.");
    console.log("");

    if (!confirmed) {
      console.log("  DRY RUN — nothing was written. Re-run with --confirm to proceed.\n");
      return;
    }

    const phrase = withdraw ? WITHDRAWAL_CONFIRMATION : CONFIRMATION;
    const typed = await promptVisible(`  Type ${phrase} to proceed: `);
    if (typed !== phrase) fail("not confirmed — nothing was written.");

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
      requestId: "eai-tenant-external-ai-data-use-ceremony",
      authenticatedAt: new Date().toISOString(),
    });

    const observedRevision = current?.authorizationRevision ?? null;
    const written = withdraw
      ? await withdrawTenantExternalAiDataUse(tenant, { serviceScope: SERVICE_SCOPE, accountRef, justification, observedRevision })
      : await authorizeTenantExternalAiDataUse(tenant, { attestationId: inForce.id, scopes, justification, observedRevision });

    if (written.status !== "written") fail(`refused: ${written.reason}. Nothing was changed.`);

    console.log("");
    console.log(`  ✔ revision ${written.authorizationRevision} (${written.state})`);
    console.log(`    authorization : ${written.authorizationId}`);
    console.log(`    decision      : ${written.governanceDecisionId}`);
    console.log(`    session       : ${written.governanceSessionId}`);
    const after = await readEffectiveTenantExternalAiDataUse(w.tenant_id, SERVICE_SCOPE, accountRef);
    if (after.status === "read") {
      console.log(
        `    effective     : revision ${after.effective.authorizationRevision} (${after.effective.state}) · ${after.effective.scopes.map((s) => `${s.purpose}×${s.dataClass}`).join(", ") || "no scopes"}`,
      );
    }
    console.log("");
    console.log("  Nothing at runtime consults this authorization yet (B2). No provider was called.");
    console.log("");
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(`\n  ✖ ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
