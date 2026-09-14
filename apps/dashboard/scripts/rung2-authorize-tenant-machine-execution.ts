/*
 * Tenant machine-execution authorization ceremony (RUNG 2 prerequisite) — OPERATOR CLI.
 *
 *   npm run platform:tenant-machine-execution -- --tenant=<slug> [--capability=record-work]
 *   npm run platform:tenant-machine-execution -- --tenant=<slug> --withdraw
 *
 * ── WHOSE DECISION THIS IS ──────────────────────────────────────────────────
 *
 * THE TENANT'S GOVERNANCE AUTHORITY'S. Not the operator's, and this file cannot make it otherwise.
 *
 * The terminal supplies an organization slug and a human's email; everything that decides whether
 * the write happens is read from the database and checked by the released writer:
 *
 *   - the human's ACTIVE membership in that organization is resolved server-side by query
 *   - `resolveGovernanceAuthority` then decides whether that human holds Governance there, reading
 *     `decision_records.bootstrap` (or an unrevoked delegation) — so naming a human who does not
 *     hold it is refused exactly like naming a stranger
 *   - the database CHECK refuses any authorizer but `human`
 *
 * So this ceremony ASSERTS AN IDENTITY THAT THE DATABASE THEN CHECKS. It cannot fabricate an
 * authority, and possession of the deployment grants none here — which is the whole point of the
 * split: possession stops the world, Governance enrols an organization into it.
 *
 * It is the same shape `trh23-authorize-standing-observation` already uses for the same reason: a
 * tenant Governance decision has to be reachable from a terminal until a product surface exists,
 * and the authority it goes through is identical either way.
 *
 * ── WHAT IT DELIBERATELY CANNOT DO ──────────────────────────────────────────
 *
 *   - authorize any ACT, mint a permit, approve a request or create work
 *   - arm or disarm the deployment-wide `machine-internal-execution` control
 *   - widen the frozen machine action set — an unsupported capability is refused by the writer
 *   - reach a tenant the named human has no active membership in
 *   - execute anything, schedule anything, or cause anything to run
 *
 * ENROLLING IS NOT ARMING, AND NEITHER IS AUTHORIZING AN ACT.
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
  const withdraw = has("withdraw");

  if (!process.env.DATABASE_URL) fail("DATABASE_URL is not set");

  await import("../src/db/client.server");
  const { asHumanTenantContext } = await import("../src/features/auth/tenant/tenant-context");
  const { MACHINE_EXECUTABLE_ACTION_KINDS } = await import(
    "../src/features/governed-machine-execution/contracts"
  );
  const { authorizeTenantMachineExecution, withdrawTenantMachineExecution } = await import(
    "../src/features/tenant-machine-execution-authority/authorize-tenant-machine-execution.server"
  );
  const { readEffectiveTenantMachineExecution } = await import(
    "../src/features/tenant-machine-execution-authority/read-tenant-machine-execution.server"
  );
  const { resolveMachineExecutionReachability } = await import(
    "../src/features/tenant-machine-execution-authority/resolve-machine-execution-reachability.server"
  );

  /* The capability defaults to the sole member of the released frozen set — never a literal here. */
  const capabilityKey = arg("capability") ?? [...MACHINE_EXECUTABLE_ACTION_KINDS][0]!;

  const justification =
    arg("justification") ??
    (withdraw
      ? "We are pausing machine delivery of already-authorized work while we review how it is supervised."
      : "This organization agrees that work it has already authorized may be delivered by machine without a human Execute click, and I accept responsibility for that.");

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

    const before = await readEffectiveTenantMachineExecution(w.tenant_id, capabilityKey);
    const currentRevision =
      before.status === "read" ? before.effective.authorizationRevision : null;
    const currentState =
      before.status === "read"
        ? before.effective.state
        : before.status === "absent"
          ? "no revision (never enrolled)"
          : "UNREADABLE";
    if (before.status === "unavailable") fail("the authorization could not be read. Nothing was changed.");

    console.log("");
    console.log(`  TENANT MACHINE-EXECUTION ${withdraw ? "WITHDRAWAL" : "AUTHORIZATION"} CEREMONY`);
    console.log("");
    console.log(`  organization : ${w.company} (${tenantSlug})`);
    console.log(`  tenant       : ${w.tenant_id}`);
    console.log(`  capability   : ${capabilityKey}`);
    console.log(`  deciding as  : ${directorEmail}`);
    console.log(`  current      : ${currentState}${currentRevision ? ` (revision ${currentRevision})` : ""}`);
    console.log(`  requested    : ${withdraw ? "withdrawn" : "active"}`);
    console.log("");
    console.log("  THIS IS THE ORGANIZATION'S OWN DECISION, NOT THE OPERATOR'S. It is written only");
    console.log("  if this human holds THIS tenant's Governance authority; a tenant owner who does");
    console.log("  not hold it is refused exactly like a stranger.");
    console.log("");
    if (!withdraw) {
      console.log("  WHAT ENROLLING MEANS");
      console.log("    · work this organization has ALREADY authorized may be delivered by machine,");
      console.log("      without a human Execute click at the moment of the act");
      console.log("");
      console.log("  WHAT IT DOES NOT DO");
      console.log("    · does not authorize any action");
      console.log("    · does not create, approve or consume a permit");
      console.log("    · does not grant standing mutation authority");
      console.log("    · does not widen what a machine may do — the action set is frozen in code");
      console.log("    · does not arm the deployment: the operator's control is separate and");
      console.log("      machine execution stays unreachable while it is off");
      console.log("    · does not trigger anything — nothing schedules, times or queues an execution");
      console.log("");
    }

    const phrase = withdraw ? `withdraw ${tenantSlug}` : `enrol ${tenantSlug}`;
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
      requestId: "rung2-tenant-machine-execution-ceremony",
      authenticatedAt: new Date().toISOString(),
    });

    const input = { capabilityKey, justification, observedRevision: currentRevision };
    const written = withdraw
      ? await withdrawTenantMachineExecution(tenant, input)
      : await authorizeTenantMachineExecution(tenant, input);

    if (written.status === "refused") {
      fail(`refused: ${written.reason}. Nothing was changed.`);
    }

    console.log("");
    console.log(`  ✔ ${w.company} is now ${written.state === "active" ? "ENROLLED IN" : "WITHDRAWN FROM"} machine execution for "${capabilityKey}".`);
    console.log(`    authorization : ${written.authorizationId}`);
    console.log(`    revision      : ${written.authorizationRevision}`);
    console.log(`    decision      : ${written.governanceDecisionId}`);
    console.log(`    session       : ${written.governanceSessionId}`);
    console.log("");

    /* WHAT IS ACTUALLY REACHABLE NOW — composed from both authorities, not assumed. */
    const reachability = await resolveMachineExecutionReachability(w.tenant_id, capabilityKey);
    console.log(`  effective reachability : ${reachability.status === "reachable" ? "REACHABLE" : `refused (${reachability.reason})`}`);
    if (reachability.status === "refused" && reachability.reason === "root-control-disabled") {
      console.log("");
      console.log("  The organization is enrolled and machine execution is STILL NOT REACHABLE,");
      console.log("  because the deployment-wide control is off. That is the two authorities");
      console.log("  working as designed — enrolling is not arming.");
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
