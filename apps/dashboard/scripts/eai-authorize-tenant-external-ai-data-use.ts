/*
 * Tenant external-AI data-use authorization ceremony — OPERATOR CLI.
 *
 *   npm run platform:tenant-external-ai-data-use -- --tenant=<slug>                        # dry run
 *   npm run platform:tenant-external-ai-data-use -- --tenant=<slug> --confirm              # authorize
 *   npm run platform:tenant-external-ai-data-use -- --tenant=<slug> --withdraw --confirm   # withdraw
 *   npm run platform:tenant-external-ai-data-use -- --tenant=<slug> --agent-origination   # dry run (APF-3)
 *   npm run platform:tenant-external-ai-data-use -- --tenant=<slug> --work-planning       # dry run (D1/D4)
 *   npm run platform:tenant-external-ai-data-use -- --tenant=<slug> --work-planning --revoke --confirm
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
 * The service scope is `anthropic/messages`, the purpose is `assistance` — or, with one closed switch,
 * `agent-origination` (`--agent-origination`, APF-3) or `work-planning` (`--work-planning`, D1/D4) —
 * and the (purpose, data class) pairs are READ OFF the recorded platform policy (B1D: conversation,
 * knowledge, work-artifact; APF-3 + WF-3B: conversation, organization, knowledge; D4:
 * operational-record). No flag carries a scope, purpose, data class or attestation as a value,
 * and an unknown flag is refused, so this file cannot ask for more than the platform already ALLOWS.
 * The attestation is the one in force, read through the released reader; the writer re-checks all of
 * it in one transaction.
 *
 * ── A NEW REVISION KEEPS WHAT IS IN FORCE (APF-3) ───────────────────────────
 *
 * A revision replaces the scope set before it, so the requested set is the UNION of the scopes in
 * force and the purpose being added (`nextRevisionScopes`). Adding origination cannot withdraw
 * assistance, and re-running assistance cannot withdraw origination.
 *
 * ── REVOKING ONE PURPOSE (D1/D4) ────────────────────────────────────────────
 *
 * `--revoke` with a purpose switch writes a revision holding what is in force MINUS that purpose's
 * pairs (`revisionScopesWithout`); every other purpose stays. `--withdraw` still removes everything.
 * Revoking the last purpose is refused: that is a withdrawal, and says so. This is also the step
 * that must precede deploying code that does not know `work-planning`: such code reads a tenant whose
 * scopes name it as `unavailable`, which refuses EVERY model call for that tenant.
 *
 * ── WHAT IT DELIBERATELY CANNOT DO ──────────────────────────────────────────
 *
 *   - write anything itself: no INSERT, UPDATE or DELETE; the only SQL is a read-only lookup
 *   - widen the platform policy or change an attestation
 *   - read a provider credential or call a provider
 *   - call the model: the runtime consults this authorization before every Anthropic call (B2), and
 *     authorizing data use is still not sending any
 *
 * AUTHORIZING DATA USE IS NOT SENDING DATA.
 */
import { createInterface } from "node:readline";
import { Client } from "pg";

const SERVICE_SCOPE = "anthropic/messages";
const EXPECTED_DATA_CLASSES = {
  assistance: ["conversation", "knowledge", "work-artifact"],
  "agent-origination": ["conversation", "organization", "knowledge"],
  "work-planning": ["operational-record"],
} as const;
const KNOWN_FLAGS = ["tenant", "director", "justification", "confirm", "withdraw", "agent-origination", "work-planning", "revoke"];
const CONFIRMATION = "AUTHORIZE EXTERNAL AI DATA USE";
const WITHDRAWAL_CONFIRMATION = "WITHDRAW EXTERNAL AI DATA USE";
const REVOCATION_CONFIRMATION = "REVOKE EXTERNAL AI DATA USE";

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
  const revoke = has("revoke");
  const confirmed = has("confirm");
  if (has("agent-origination") && has("work-planning")) fail("one purpose per ceremony: --agent-origination or --work-planning, not both");
  const PURPOSE = has("agent-origination") ? "agent-origination" : has("work-planning") ? "work-planning" : "assistance";
  if (withdraw && PURPOSE !== "assistance") fail("--withdraw withdraws every scope; it takes no purpose switch");
  if (withdraw && revoke) fail("--withdraw removes every scope; --revoke removes one purpose — not both");
  if (revoke && PURPOSE === "assistance") fail("--revoke names the purpose it removes: --agent-origination or --work-planning");
  const justification =
    arg("justification") ??
    (withdraw
      ? "We are withdrawing external AI processing of this organization's data while we review how it is supervised."
      : revoke
        ? `We are revoking ${PURPOSE} from this organization's external AI data use; every other purpose stays as it is.`
      : PURPOSE === "work-planning"
        ? "This organization agrees that a closed operational projection of its work records — invocation-local aliases, declared states and whether each has an accountable person, is stale or declares evidence; never a title, name, date or identifier — may be processed by the reviewed Anthropic processor so Heby can propose an ordering for a human to decide, and I accept responsibility for that."
      : PURPOSE === "agent-origination"
        ? "This organization agrees that the goal a person gives Heby, this organization's structure and the statements of its ratified Knowledge eligible for grounding may be processed by the reviewed Anthropic processor so Heby can propose work for a human to decide, and I accept responsibility for that."
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
  const { nextRevisionScopes, revisionScopesWithout } = await import("./lib/tenant-data-use-scopes");

  /* ── WHAT. Read off the recorded policy, never typed here. ─────────────────────────────────── */
  const cells = RECORDED_PLATFORM_DISCLOSURE_POLICY.allowedCells.filter(
    (c) => c.serviceScope === SERVICE_SCOPE && c.purpose === PURPOSE,
  );
  const adding = cells.map((c) => ({ purpose: c.purpose, dataClass: c.dataClass }));
  if (JSON.stringify(adding.map((s) => s.dataClass).sort()) !== JSON.stringify([...EXPECTED_DATA_CLASSES[PURPOSE]].sort())) {
    fail(`the recorded platform policy no longer ALLOWS exactly ${PURPOSE} × ${EXPECTED_DATA_CLASSES[PURPOSE].join(", ")} — refusing.`);
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
    /* What is in force is kept; a withdrawn revision carries nothing forward. */
    const inForceScopes = current?.state === "active" ? current.scopes : [];
    const scopes = revoke ? revisionScopesWithout(inForceScopes, PURPOSE) : nextRevisionScopes(inForceScopes, adding);
    if (revoke && scopes.length === inForceScopes.length) fail(`${PURPOSE} is not authorized in force. Nothing was changed.`);
    if (revoke && scopes.length === 0) fail(`${PURPOSE} is the only purpose in force; removing it is a withdrawal — use --withdraw. Nothing was changed.`);
    if (!withdraw && !revoke && current?.state === "active" && scopes.length === current.scopes.length) {
      fail(`${PURPOSE} is already authorized in revision ${current.authorizationRevision}. Nothing was changed.`);
    }

    console.log("");
    console.log(`  TENANT EXTERNAL-AI DATA-USE ${withdraw ? "WITHDRAWAL" : revoke ? `REVOCATION OF ${PURPOSE}` : "AUTHORIZATION"} CEREMONY`);
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
      console.log(`  requested    : revision ${(current?.authorizationRevision ?? 0) + 1} · ${scopes.map((s) => `${s.purpose} × ${s.dataClass}`).join(", ")}`);
      for (const pair of scopes) {
        const cell = RECORDED_PLATFORM_DISCLOSURE_POLICY.allowedCells.find(
          (c) => c.serviceScope === SERVICE_SCOPE && c.purpose === pair.purpose && c.dataClass === pair.dataClass,
        );
        const fits = cell ? attestationSatisfiesBounds(inForce, cell.bounds) : false;
        const kept = !revoke && adding.some((a) => a.purpose === pair.purpose && a.dataClass === pair.dataClass) ? "added" : "kept ";
        console.log(`                 ${kept} ${`${pair.purpose} × ${pair.dataClass}`.padEnd(32)} platform ${cell ? "ALLOWED" : "NOT ALLOWED"} · attestation ${fits ? "inside" : "OUTSIDE"} bounds`);
        if (!fits) fail("a requested scope is not platform-allowed inside the attestation in force — refusing.");
      }
      if (revoke) {
        for (const pair of inForceScopes.filter((s) => s.purpose === PURPOSE)) {
          console.log(`                 removed ${pair.purpose} × ${pair.dataClass}`);
        }
      }
    }
    console.log("");
    console.log("  THIS IS THE ORGANIZATION'S OWN DECISION. It is written only if this human holds THIS");
    console.log("  tenant's Governance authority. It sends nothing, calls no provider and reads no credential.");
    console.log("  The runtime consults it before every Anthropic call: authorizing data use is not sending data.");
    console.log("");

    if (!confirmed) {
      console.log("  DRY RUN — nothing was written. Re-run with --confirm to proceed.\n");
      return;
    }

    const phrase = withdraw ? WITHDRAWAL_CONFIRMATION : revoke ? REVOCATION_CONFIRMATION : CONFIRMATION;
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
    console.log("  No provider was called.");
    console.log("");
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(`\n  ✖ ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
