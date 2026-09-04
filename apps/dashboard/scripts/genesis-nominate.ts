/*
 * Genesis nomination ceremony (G2.1, production posture added by G4) — OPERATOR CLI, KEY 1 of 2.
 *
 *   npm run governance:nominate-genesis -- <tenant-slug> <identity-email>
 *
 * WHAT THIS IS. The deliberate, out-of-band act that names the human eligible to accept a tenant's
 * pre-Governance genesis entitlement. It is a CLI and not a product route on purpose: no
 * authenticated user may nominate anybody, including themselves, so self-nomination has no
 * representation in the product at all.
 *
 * THE ROOT OF TRUST — READ THIS BEFORE USING IT.
 * Authority to run this command is POSSESSION OF THE DEPLOYMENT IT IS POINTED AT, which since G4
 * may be the production one. Hebun cannot cryptographically
 * identify which human is operating this terminal, and this command does not pretend otherwise. It
 * is NOT a verified platform admin, NOT a certified operator, and NOT a Governance authority. The
 * row it writes records which ROOT produced the nomination, never who ran it. Introducing a real
 * operator identity is a later, deliberate decision.
 *
 * WHAT IT DELIBERATELY CANNOT DO:
 *   - accept the nomination (only the nominated human can, in-product, under a verified D1 session)
 *   - create a Governance decision or governance session, or set `bootstrap` anywhere
 *   - mint a session, cookie, or credential
 *   - create or change a tenant, membership, role, or permission
 *   - touch Knowledge, providers, or execution
 *   - run with `NODE_ENV=production` set in the OPERATOR'S OWN SHELL (refused outright)
 *   - reach production without the exact ceremony signal AND a pinned target (both refused)
 *   - be driven by an environment variable that silently names the genesis human
 *
 * There is deliberately no HEBUN_GENESIS_HUMAN variable and no automatic nomination: a genesis
 * human that config can name is a genesis human that a deployment mistake can name.
 *
 * The nomination target is confirmed interactively by retyping the tenant slug. A constitutional act
 * should be impossible to perform by autocomplete.
 *
 * ── THIS CEREMONY CAN WRITE PRODUCTION. THE TWO GUARDS ARE DIFFERENT QUESTIONS ──
 *
 * `NODE_ENV=production` is a property of the SHELL and is refused always; it says nothing about the
 * target database. The production POSTURE is a property of the TARGET, opened only by
 * `HEBUN_PRODUCTION_CEREMONY` set to EXACTLY `production-operator-ceremony` plus a pinned
 * `HEBUN_PRODUCTION_TARGET_SYSTEM_IDENTIFIER` / `HEBUN_PRODUCTION_TARGET_DATABASE`. Anything else
 * REFUSES and is never downgraded to local. In that posture a LOCAL database is refused, `preflight`
 * verifies the connected cluster against the pinned target, and it probes that
 * `genesis_nominations_source_chk` admits the root before any write.
 *
 * The nomination it writes is still only KEY 1 of 2: acceptance remains an in-product act by the
 * nominated human under a verified session, and possession can never perform it.
 */
import { createInterface } from "node:readline";
import { Client } from "pg";
import { preflight, preflightEnvironment } from "./lib/ceremony-preflight";
import { resolveCeremonyPosture } from "./lib/production-possession";
import {
  findExistingNomination,
  nominateGenesisHuman,
  resolveNominationTarget,
} from "./lib/nominate-genesis-human";

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

  const tenantSlug = process.argv[2]?.trim().toLowerCase();
  const email = process.argv[3]?.trim().toLowerCase();
  if (!tenantSlug || !email) {
    fail("usage: npm run governance:nominate-genesis -- <tenant-slug> <identity-email>");
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
  const ready = await preflight(client, environment.posture, { provenance: "genesis" });
  if (ready.status === "refused") {
    await client.end();
    fail(ready.detail);
  }
  const ceremonySource = environment.posture.source;

  try {
    const target = await resolveNominationTarget(client, tenantSlug, email);
    if (!target) {
      fail(
        `no active human "${email}" with an active membership in tenant "${tenantSlug}". ` +
          "This ceremony nominates someone who already belongs to the tenant; it does not " +
          "create people, memberships, or tenants.",
      );
    }

    const existing = await findExistingNomination(client, target.tenantId);
    if (existing) {
      fail(
        `tenant "${target.tenantSlug}" already has a ${existing.status} genesis nomination. ` +
          "A tenant has exactly one pre-Governance root, and replacing it is not a capability " +
          "this phase implements.",
      );
    }

    console.log("");
    console.log("  GENESIS NOMINATION — KEY 1 OF 2");
    console.log("");
    console.log(`  tenant    : ${target.tenantName} (${target.tenantSlug})`);
    console.log(`  human     : ${target.email}`);
    console.log(`  identity  : ${target.authIdentityId}`);
    console.log("");
    console.log("  This nominates the human eligible to accept this tenant's genesis entitlement.");
    console.log("  It does NOT establish Governance authority. It does NOT create a Governance");
    console.log("  decision. It does NOT grant a role, a permission, or any execution authority.");
    console.log("");
    console.log("  The nomination takes effect only when THAT human accepts it while signed in.");
    console.log("");

    const confirmation = await promptVisible(
      `  Retype the tenant slug to nominate (${target.tenantSlug}): `,
    );
    if (confirmation !== target.tenantSlug) {
      fail("the tenant slug did not match. Nothing was changed.");
    }

    const outcome = await nominateGenesisHuman(client, target, ceremonySource);
    if (outcome.status === "already-nominated") {
      fail(
        `tenant "${target.tenantSlug}" already has a ${outcome.existing.status} genesis ` +
          "nomination — another ceremony won this race. Nothing was changed.",
      );
    }

    console.log("");
    console.log(`  ✔ pending genesis nomination created for ${target.email}`);
    console.log(`    nomination : ${outcome.nominationId}`);
    console.log("    status     : pending");
    console.log("");
    console.log("    No Governance decision was created. No authority was granted.");
    console.log(`    ${target.email} must now sign in and accept it at /governance/genesis.`);
    console.log("");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
