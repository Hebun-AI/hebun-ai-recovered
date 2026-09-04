/*
 * Tenant lifecycle ceremony (R4B, production posture added by G4) — OPERATOR CLI.
 *
 *   npm run tenant:lifecycle -- suspend    <slug> <reason>
 *   npm run tenant:lifecycle -- reactivate <slug>
 *
 * ONE CLI WITH A CLOSED VERB, not two files. The repository's precedent is one file per ceremony
 * (`tenant-provision`, `genesis-nominate`, `auth-dev-credential`), and two files would have matched
 * it — but suspend and reactivate are one capability seen from both ends, and splitting them would
 * mean two copies of the same guards, the same prompt and the same output. A closed two-value verb
 * is the narrower shape: a third transition has no argument that could express it, so `deleting` and
 * `deleted` stay out of R4B structurally rather than by discipline.
 *
 * THE ROOT OF TRUST — READ THIS BEFORE USING IT.
 * Authority is POSSESSION OF THE DEPLOYMENT THIS CEREMONY IS POINTED AT, exactly as for R4A, G2.1
 * and D1.1, and since G4 that deployment may be the production one. Hebun cannot
 * cryptographically identify the human at this terminal and does not pretend to. It is NOT a
 * platform admin, NOT a Governance authority, NOT a tenant owner.
 *
 * WHY IT IS NOT A PRODUCT SURFACE. Suspension makes every tenant-scoped authority unreachable — the
 * per-request resolver refuses a non-active tenant, so the owner cannot sign in and Governance
 * cannot run. An in-product suspension control would destroy the authority needed to undo it. This
 * ceremony is reachable in both directions precisely because it never needed the tenant to be
 * active.
 *
 * WHAT IT DELIBERATELY CANNOT DO:
 *   - create, delete or rename a tenant
 *   - reach `provisioning` (R4A's, transient), `deleting` or `deleted` (R5's)
 *   - write authentication_disabled_at, deleting_at, lifecycle_status or provisioning_source
 *   - revoke a session, or touch users, memberships, roles, providers or permits
 *   - write an audit row — a terminal has no actor to name
 *   - run with `NODE_ENV=production` set in the OPERATOR'S OWN SHELL (refused outright)
 *   - reach production without the exact ceremony signal AND a pinned target (both refused)
 *   - be driven by an environment variable that silently names the tenant
 *
 * ── THIS CEREMONY CAN WRITE PRODUCTION, AND THAT IS WHY IT IS THE RECOVERY PATH ──
 *
 * `NODE_ENV=production` is a property of the SHELL and is refused always; it says nothing about the
 * target database. The production POSTURE is a property of the TARGET, opened only by
 * `HEBUN_PRODUCTION_CEREMONY` set to EXACTLY `production-operator-ceremony` plus a pinned
 * `HEBUN_PRODUCTION_TARGET_SYSTEM_IDENTIFIER` / `HEBUN_PRODUCTION_TARGET_DATABASE`. Anything else
 * REFUSES and is never downgraded to local. In that posture a LOCAL database is refused and
 * `preflight` verifies the connected cluster against the pinned target; it probes no provenance
 * CHECK, because this ceremony records no ceremony root.
 *
 * SUSPENSION IS THE ONLY RECOVERY THERE IS. No hard delete exists anywhere in the repository, and
 * `companies_slug_uq` is not partial — a suspended tenant keeps its slug forever. So this ceremony
 * can stop a tenant, and can never un-name one.
 */
import { createInterface } from "node:readline";
import { Client } from "pg";
import { preflight, preflightEnvironment } from "./lib/ceremony-preflight";
import { resolveCeremonyPosture } from "./lib/production-possession";
import {
  LIFECYCLE_TRANSITIONS,
  MAX_SUSPENSION_REASON_CHARACTERS,
  TENANT_STATUS_ACTIVE,
  TENANT_STATUS_SUSPENDED,
  findTenantBySlug,
  reactivateTenant,
  suspendTenant,
  validateSuspensionReason,
  type LifecycleTransition,
} from "./lib/tenant-lifecycle";

function fail(message: string): never {
  console.error(`\n  ✖ ${message}\n`);
  process.exit(1);
}

/** Read one visible line from the TTY. Not a secret — the operator must SEE what they confirm. */
function promptVisible(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    if (!input.isTTY) {
      reject(
        new Error(
          "this ceremony can only be confirmed interactively — run it in a terminal, never piped",
        ),
      );
      return;
    }
    const rl = createInterface({ input, output: process.stdout, terminal: true });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function isTransition(value: string | undefined): value is LifecycleTransition {
  return LIFECYCLE_TRANSITIONS.includes(value as LifecycleTransition);
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    fail("this ceremony is development-only and refuses to run with NODE_ENV=production.");
  }

  const verb = process.argv[2]?.trim().toLowerCase();
  const slug = process.argv[3]?.trim().toLowerCase();
  /* The reason is the REST of the line, so an operator does not have to remember to quote it. */
  const reason = process.argv.slice(4).join(" ").trim();

  if (!isTransition(verb) || !slug) {
    fail(
      "usage:\n" +
        "    npm run tenant:lifecycle -- suspend    <slug> <reason>\n" +
        "    npm run tenant:lifecycle -- reactivate <slug>",
    );
  }

  if (verb === "suspend" && !validateSuspensionReason(reason)) {
    fail(
      "a suspension requires a reason: one line, non-empty, at most " +
        `${MAX_SUSPENSION_REASON_CHARACTERS} characters. It is recorded on the tenant row and is ` +
        "the only account of why access stopped — do not put a credential or a secret in it.",
    );
  }

  /*
   * G4. POSTURE FIRST, before a connection is spent.
   *
   * Absent `HEBUN_PRODUCTION_CEREMONY` is the released behaviour verbatim — local posture, local
   * database, local root. The exact production signal opens the production posture, which requires
   * a pinned target and refuses a loopback URL. Anything else refuses outright and is never
   * downgraded to local.
   */
  const posture = resolveCeremonyPosture(process.env);
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const environment = preflightEnvironment(posture, databaseUrl);
  if (environment.status === "refused") fail(environment.detail);

  const client = new Client({ connectionString: databaseUrl! });
  await client.connect();

  /*
   * TARGET BINDING. In local posture this is a banner and nothing else. In production posture it
   * proves the live cluster is the pinned one before a single application row is read.
   */
  const ready = await preflight(client, environment.posture, { provenance: "none" });
  if (ready.status === "refused") {
    await client.end();
    fail(ready.detail);
  }

  try {
    const tenant = await findTenantBySlug(client, slug);
    if (!tenant) {
      fail(`no tenant holds the slug "${slug}". This ceremony changes tenants; it never creates one.`);
    }

    const expected = verb === "suspend" ? TENANT_STATUS_ACTIVE : TENANT_STATUS_SUSPENDED;
    if (tenant.tenantStatus !== expected) {
      fail(
        `tenant "${tenant.slug}" is ${tenant.tenantStatus ?? "unset"}, and ${verb} starts from ` +
          `${expected}. R4B manages exactly two states — a tenant in any other state is not ` +
          "something this ceremony can move.",
      );
    }

    console.log("");
    console.log(`  TENANT LIFECYCLE CEREMONY — ${verb.toUpperCase()}`);
    console.log("");
    console.log(`  tenant     : ${tenant.name}`);
    console.log(`  slug       : ${tenant.slug}`);
    console.log(`  status     : ${tenant.tenantStatus} → ${verb === "suspend" ? TENANT_STATUS_SUSPENDED : TENANT_STATUS_ACTIVE}`);
    if (verb === "suspend") {
      console.log(`  reason     : ${reason}`);
      console.log("");
      console.log("  SUSPENDING STOPS ALL ACCESS FOR THIS TENANT ON THE NEXT REQUEST.");
      console.log("  Every signed-in human is refused, sign-in is refused, and invitation");
      console.log("  acceptance and enrollment are refused. Nothing is deleted and no session");
      console.log("  row is revoked — the state is re-read on every request, so reactivating");
      console.log("  restores access without anyone signing in again.");
      console.log("");
      console.log("  NOBODY INSIDE THE TENANT CAN UNDO THIS. Governance cannot run while the");
      console.log("  tenant is suspended; only this ceremony can reactivate it.");
    } else {
      console.log(`  clearing   : suspended_at, suspension_reason`);
      console.log("");
      console.log("  Reactivation restores ELIGIBILITY only. It creates no membership, no role,");
      console.log("  no session and no permission. Sessions resume only if they are still valid");
      console.log("  under their own expiry and version rules.");
    }
    console.log("");
    console.log("  No tenant is created or deleted. No audit event is recorded — a terminal has");
    console.log("  no actor to attribute. The tenant row itself carries the resulting state.");
    console.log("");

    const confirmation = await promptVisible(`  Retype the slug to ${verb} (${tenant.slug}): `);
    if (confirmation !== tenant.slug) {
      fail("the slug did not match. Nothing was changed.");
    }

    const outcome =
      verb === "suspend"
        ? await suspendTenant(client, { slug, reason })
        : await reactivateTenant(client, { slug });

    if (outcome.status === "refused") {
      fail(
        outcome.reason === "not-in-expected-state"
          ? `tenant "${slug}" left ${expected} during this ceremony — another operator won the ` +
              "race. Nothing was changed."
          : `refused: ${outcome.reason}. Nothing was changed.`,
      );
    }

    const { tenant: after } = outcome;
    console.log("");
    console.log(`  ✔ tenant "${after.name}" is now ${after.tenantStatus}`);
    console.log(`    tenant     : ${after.tenantId}`);
    console.log(`    version    : ${after.version}`);
    if (after.suspensionReason) console.log(`    reason     : ${after.suspensionReason}`);
    console.log("");
    if (verb === "suspend") {
      console.log("    Access stops on the next request. To restore it:");
      console.log("");
      console.log(`      npm run tenant:lifecycle -- reactivate ${after.slug}`);
    } else {
      console.log("    Access is restored. Sessions that are otherwise still valid resume.");
    }
    console.log("");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
