/*
 * Tenant bootstrap ceremony (R4A, production posture added by G4) — OPERATOR CLI.
 *
 *   npm run tenant:provision -- <slug> <display-name> <identity-email>
 *
 * WHAT THIS IS. The deliberate, out-of-band act that brings a tenant into existence so the normal
 * authorities can take over. Until now the only thing that could create a tenant was
 * `scripts/r1-seed.mjs`, a two-fixture seed that raw-inserts five tables and bypasses every
 * authority the program built. This is a CLI and not a product route because a tenant cannot be
 * created from inside a tenant: `resolveTenantContext()` needs a membership that needs an invitation
 * that needs a Governance decision that needs a tenant. See `scripts/lib/provision-tenant.ts` for
 * the full cycle and why the cut point is exactly three tables.
 *
 * THE ROOT OF TRUST — READ THIS BEFORE USING IT.
 * Authority to run this command is POSSESSION OF THE DEPLOYMENT IT IS POINTED AT — the same
 * assumption D1.1 and G2.1 already rest on, and since G4 that deployment may be the production one.
 * Hebun cannot cryptographically identify the human operating this terminal,
 * and this command does not pretend otherwise. It is NOT a verified platform admin, NOT a certified
 * operator, and NOT a Governance authority. The row it writes records which ROOT produced the
 * tenant (`provisioning_source`), never who ran it, and `created_by` stays NULL for the same reason
 * no audit event is written: there is no honest actor to name.
 *
 * WHAT IT DELIBERATELY CANNOT DO:
 *   - create a user, an auth identity, or a credential — the human must ALREADY exist
 *   - nominate or accept genesis, establish Governance authority, or create a governance session
 *   - provision the member baseline role, authorize a membership, or issue an invitation
 *   - write audit_log, provider controls, Knowledge, actions, recipients, or artifacts
 *   - modify an existing tenant — a taken slug is refused, never updated
 *   - run with `NODE_ENV=production` set in the OPERATOR'S OWN SHELL (refused outright)
 *   - reach production without the exact ceremony signal AND a pinned target (both refused)
 *   - be driven by an environment variable that silently names the tenant or the human
 *
 * There is deliberately no HEBUN_BOOTSTRAP_TENANT variable and no unattended mode: a tenant that
 * config can name is a tenant a deployment mistake can create. The target is confirmed
 * interactively by retyping the slug — a constitutional act should be impossible by autocomplete.
 *
 * ── THIS CEREMONY CAN WRITE PRODUCTION. READ THE POSTURE RULES BEFORE RUNNING IT ──
 *
 * G4 gave this CLI a production posture and it is the ONLY production caller of `provisionTenant`.
 * The two guards above are DIFFERENT questions and were once conflated in this header:
 *
 *   `NODE_ENV=production`   a property of the SHELL this command runs in. Refused, always. It is
 *                           not a statement about the target database, and unsetting it does not
 *                           open production.
 *   production posture      a property of the TARGET. Opened only by `HEBUN_PRODUCTION_CEREMONY`
 *                           set to EXACTLY `production-operator-ceremony`, plus
 *                           `HEBUN_PRODUCTION_TARGET_SYSTEM_IDENTIFIER` and
 *                           `HEBUN_PRODUCTION_TARGET_DATABASE`. Anything else REFUSES and is never
 *                           downgraded to local.
 *
 * In production posture a LOCAL database is refused — the exact complement of the local posture's
 * guard, not the same one. `preflight` then verifies the connected cluster against the pinned
 * target and probes that `companies_provisioning_source_chk` admits the root before any write.
 *
 * What this still does NOT deliver: self-service signup, a platform-admin authority, a verified
 * operator identity, or any product route to tenant creation. It closes exactly one gap.
 */
import { createInterface } from "node:readline";
import { Client } from "pg";
import { preflight, preflightEnvironment } from "./lib/ceremony-preflight";
import { resolveCeremonyPosture } from "./lib/production-possession";
import {
  BOOTSTRAP_ROLE_NAME,
  BOOTSTRAP_ROLE_TYPE,
  findTenantBySlug,
  normalizeSlug,
  provisionTenant,
  resolveExistingHuman,
  validateProvisionInput,
} from "./lib/provision-tenant";

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

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    fail("this ceremony is development-only and refuses to run with NODE_ENV=production.");
  }

  const slug = process.argv[2]?.trim().toLowerCase();
  const displayName = process.argv[3]?.trim();
  const email = process.argv[4]?.trim().toLowerCase();
  if (!slug || !displayName || !email) {
    fail("usage: npm run tenant:provision -- <slug> <display-name> <identity-email>");
  }

  if (!validateProvisionInput({ slug, displayName, identityEmail: email })) {
    fail(
      "invalid input. The slug must be lowercase alphanumeric with single hyphens " +
        "(e.g. acme-holdings); the display name and email must be single-line and non-empty. " +
        "Nothing is rewritten for you — a slug you did not type is a slug you did not confirm.",
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
  const ready = await preflight(client, environment.posture, { provenance: "company" });
  if (ready.status === "refused") {
    await client.end();
    fail(ready.detail);
  }
  const ceremonySource = environment.posture.source;

  try {
    /*
     * Both reads happen BEFORE the confirmation prompt so the operator is never asked to confirm an
     * act that is already going to be refused, and so a refusal costs no write.
     */
    const human = await resolveExistingHuman(client, email);
    if (!human) {
      fail(
        `no active human "${email}" holds an active identity. This ceremony requires a human who ` +
          "ALREADY exists — it does not create people, identities, or credentials. Enrol them " +
          "first, or provision a local credential with: npm run auth:dev-credential.",
      );
    }

    const claimed = await findTenantBySlug(client, slug);
    if (claimed) {
      fail(
        `the slug "${slug}" already belongs to tenant "${claimed.name}". This ceremony creates a ` +
          "tenant; it never renames, re-points, or otherwise modifies an existing one.",
      );
    }

    console.log("");
    console.log("  TENANT BOOTSTRAP CEREMONY");
    console.log("");
    console.log(`  tenant     : ${displayName}`);
    console.log(`  slug       : ${normalizeSlug(slug)}`);
    console.log(`  human      : ${human.email}`);
    console.log(`  role band  : ${BOOTSTRAP_ROLE_NAME} (${BOOTSTRAP_ROLE_TYPE})`);
    console.log("");
    console.log("  This creates the tenant, ONE owner role, and ONE membership for that human.");
    console.log("  It creates no user, no identity and no credential — the human already exists.");
    console.log("");
    console.log("  GENESIS IS NOT INCLUDED. No genesis nomination is created, no Governance");
    console.log("  authority is established, no governance session and no decision are written,");
    console.log("  and no audit event is recorded — a terminal has no actor to attribute.");
    console.log("");
    console.log("  The owner band DOES carry real product authority once that human signs in:");
    console.log("  Knowledge authoring and the provider connectivity control, which is global");
    console.log("  across tenants today.");
    console.log("");

    const confirmation = await promptVisible(`  Retype the slug to provision (${slug}): `);
    if (confirmation !== slug) {
      fail("the slug did not match. Nothing was changed.");
    }

    const outcome = await provisionTenant(client, {
      slug,
      displayName,
      identityEmail: email,
      provisioningSource: ceremonySource,
    });

    if (outcome.status === "refused") {
      fail(
        outcome.reason === "slug-already-taken"
          ? `the slug "${slug}" was claimed by another ceremony during this one. Nothing was ` +
              "changed, and no partial tenant survives."
          : `refused: ${outcome.reason}. Nothing was changed.`,
      );
    }

    const { tenant } = outcome;
    console.log("");
    console.log(`  ✔ tenant "${tenant.displayName}" provisioned`);
    console.log(`    tenant     : ${tenant.tenantId}`);
    console.log(`    slug       : ${tenant.slug}`);
    console.log(`    role       : ${tenant.roleId} (${BOOTSTRAP_ROLE_TYPE})`);
    console.log(`    membership : ${tenant.membershipId} — ${tenant.human.email}`);
    console.log("");
    console.log("    No Governance authority exists for this tenant yet.");
    console.log("    The next ceremony is separate and explicit:");
    console.log("");
    console.log(`      npm run governance:nominate-genesis -- ${tenant.slug} ${tenant.human.email}`);
    console.log("");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
