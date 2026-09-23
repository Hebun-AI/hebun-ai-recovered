/*
 * Tenant external-send arming ceremony (TENANT-ARM-1) — OPERATOR CLI.
 *
 *   npm run platform:tenant-external-send -- --tenant=<slug>
 *   npm run platform:tenant-external-send -- --tenant=<slug> --disarm
 *
 * ── WHOSE DECISION THIS IS ──────────────────────────────────────────────────
 *
 * THE TENANT'S GOVERNANCE AUTHORITY'S. Not the operator's, and this file cannot make it otherwise.
 *
 * The terminal supplies an organization slug and a human's email; everything that decides whether
 * the write happens is read from the database and checked by the released writer:
 *
 *   - the human's ACTIVE membership in that organization is resolved server-side by query
 *   - `resolveGovernanceAuthority` then decides whether that human holds Governance there
 *   - the database CHECK refuses any authorizer but `human`
 *   - the writer takes the tenant from the context it is handed and has NO tenant input field
 *
 * So this ceremony ASSERTS AN IDENTITY THAT THE DATABASE THEN CHECKS. Possession of the deployment
 * grants no arming here — which is the whole point of the split: possession stops the world,
 * Governance arms one organization inside it.
 *
 * The shape is `rung2-authorize-tenant-machine-execution`'s, deliberately and without variation:
 * a tenant Governance decision has to be reachable from a terminal until a product surface exists.
 *
 * ── WHAT IT DELIBERATELY CANNOT DO ──────────────────────────────────────────
 *
 *   - arm a tenant the named human has no active membership in
 *   - arm every tenant, or any tenant other than the one named
 *   - arm or disarm the deployment-wide `external-send` control (that is `platform:external-send`)
 *   - authorize any ACT, mint a permit, approve a request, or send anything
 *   - configure the deployment's sender, subject or credential
 *
 * ARMING IS NOT CONFIGURING, AND NEITHER IS AUTHORIZING A SEND.
 */
import { createInterface } from "node:readline";
import { Client } from "pg";

function fail(message: string): never {
  console.error(`\n  ✖ ${message}\n`);
  process.exit(1);
}

function arg(name: string): string | undefined {
  const flag = process.argv.find((a) => a.startsWith(`--${name}=`));
  return flag ? flag.slice(name.length + 3) : undefined;
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
  if (process.env.NODE_ENV === "production") {
    fail("this ceremony runs from an operator terminal and refuses NODE_ENV=production.");
  }

  const tenantSlug = arg("tenant");
  if (!tenantSlug) fail("--tenant=<slug> is required");
  const directorEmail = arg("director") ?? "senoltr@gmail.com";
  const disarm = has("disarm");

  if (!process.env.DATABASE_URL) fail("DATABASE_URL is not set");

  await import("../src/db/client.server");
  const { asHumanTenantContext } = await import("../src/features/auth/tenant/tenant-context");
  const { armTenantExternalSend, disarmTenantExternalSend } = await import(
    "../src/features/tenant-external-send-authority/authorize-tenant-external-send.server"
  );
  const { readEffectiveTenantExternalSend } = await import(
    "../src/features/tenant-external-send-authority/read-tenant-external-send.server"
  );
  const { resolveExternalSendReachability } = await import(
    "../src/features/tenant-external-send-authority/resolve-external-send-reachability.server"
  );

  const justification =
    arg("justification") ??
    (disarm
      ? "We are withdrawing this organization's ability to send outside while we review how outbound sending is supervised."
      : "This organization accepts that sends it has already authorized may leave the building, and I accept responsibility for that.");

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

    const before = await readEffectiveTenantExternalSend(w.tenant_id);
    if (before.status === "unavailable") {
      fail("the arming could not be read. Nothing was changed.");
    }
    const currentRevision = before.status === "read" ? before.effective.authorizationRevision : null;
    const currentState =
      before.status === "read" ? before.effective.state : "no revision (never armed)";

    console.log("");
    console.log(`  TENANT EXTERNAL-SEND ${disarm ? "DISARMING" : "ARMING"} CEREMONY`);
    console.log("");
    console.log(`  organization : ${w.company} (${tenantSlug})`);
    console.log(`  tenant       : ${w.tenant_id}`);
    console.log(`  deciding as  : ${directorEmail}`);
    console.log(`  current      : ${currentState}${currentRevision ? ` (revision ${currentRevision})` : ""}`);
    console.log(`  requested    : ${disarm ? "withdrawn" : "active"}`);
    console.log("");
    console.log("  THIS IS THE ORGANIZATION'S OWN DECISION, NOT THE OPERATOR'S. It is written only");
    console.log("  if this human holds THIS tenant's Governance authority; a tenant owner who does");
    console.log("  not hold it is refused exactly like a stranger.");
    console.log("");
    console.log(`  BLAST RADIUS: exactly one organization — ${w.company}. Arming it arms NO other`);
    console.log("  tenant, and no other tenant's arming can make this one reachable.");
    console.log("");
    if (!disarm) {
      console.log("  WHAT ARMING MEANS");
      console.log("    · sends this organization has ALREADY authorized may leave the building,");
      console.log("      reaching real people outside it");
      console.log("");
      console.log("  WHAT IT DOES NOT DO");
      console.log("    · does not authorize any send — every send still needs its own permit");
      console.log("    · does not create, approve or consume a permit");
      console.log("    · does not configure the deployment's credential, sender or subject");
      console.log("    · does not arm the deployment: the operator's control is separate and");
      console.log("      outbound sending stays unreachable while it is off");
      console.log("    · does not arm any other organization");
      console.log("    · does not send anything — nothing schedules, times or queues a send");
      console.log("");
    }

    const phrase = disarm ? `disarm ${tenantSlug}` : `arm ${tenantSlug}`;
    const confirmation = await promptVisible(`  Retype exactly to proceed («${phrase}»): `);
    if (confirmation !== phrase) fail("the confirmation phrase did not match. Nothing was changed.");

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
      requestId: "tenant-arm-1-external-send-ceremony",
      authenticatedAt: new Date().toISOString(),
    });

    const input = { justification, observedRevision: currentRevision };
    const written = disarm
      ? await disarmTenantExternalSend(tenant, input)
      : await armTenantExternalSend(tenant, input);

    if (written.status === "refused") {
      fail(`refused: ${written.reason}. Nothing was changed.`);
    }

    console.log("");
    console.log(`  ✔ ${w.company} is now ${written.state === "active" ? "ARMED FOR" : "DISARMED FROM"} outbound external sending.`);
    console.log(`    authorization : ${written.authorizationId}`);
    console.log(`    revision      : ${written.authorizationRevision}`);
    console.log(`    decision      : ${written.governanceDecisionId}`);
    console.log(`    session       : ${written.governanceSessionId}`);
    console.log("");

    /* WHAT IS ACTUALLY REACHABLE NOW — composed from both authorities, not assumed. */
    const reachability = await resolveExternalSendReachability(w.tenant_id);
    console.log(
      `  effective reachability : ${reachability.status === "reachable" ? "REACHABLE" : `refused (${reachability.reason})`}`,
    );
    if (reachability.status === "refused" && reachability.reason === "root-control-disabled") {
      console.log("");
      console.log("  The organization is armed and outbound sending is STILL NOT REACHABLE,");
      console.log("  because the deployment-wide control is off. That is the two authorities");
      console.log("  working as designed — arming a tenant is not arming the deployment.");
    }
    console.log("");
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(`\n  ✖ ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
