/*
 * Platform preflight (G4) — READ-ONLY readiness report for the production-capable ceremonies.
 *
 *   npm run platform:preflight
 *
 * WHAT THIS IS. The one command an operator may safely point at the real production database. It
 * resolves the same posture, runs the same `preflight()` the ceremonies run, and then STOPS. It
 * writes nothing, in any posture, ever — and it takes the identical code path the ceremonies take,
 * so a green report is evidence about them and not about itself.
 *
 * WHAT IT REPORTS. Whether the target is reachable, whether it is the pinned target, whether its
 * migration ledger is current, whether its released vocabulary can express this posture's
 * provenance, and — as counts only — whether the bootstrap surfaces are empty. Counts, never
 * content: this command reads no tenant name, no email, no Knowledge, no Memory and no
 * organizational data of any kind.
 *
 * WHAT IT IS NOT. Not a mutation, not a tenant, not a Genesis nomination, not an arming switch. It
 * grants nothing and changes nothing. `npm run platform:preflight` succeeding means the CEREMONIES
 * ARE READY — it does not mean any of them ran.
 */
import { Client } from "pg";
import {
  authoredMigrationCount,
  preflight,
  preflightEnvironment,
} from "./lib/ceremony-preflight";
import { resolveCeremonyPosture } from "./lib/production-possession";

function fail(message: string): never {
  console.error(`\n  ✖ ${message}\n`);
  process.exit(1);
}

/** Bootstrap surfaces, as COUNTS. No column of any of these rows is read. */
const SURFACES = [
  "companies",
  "users",
  "auth_identities",
  "auth_credentials",
  "memberships",
  "roles",
  "genesis_nominations",
  "provider_connectivity_controls",
  "audit_log",
] as const;

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    fail("this ceremony runs from an operator terminal and refuses NODE_ENV=production.");
  }

  const posture = resolveCeremonyPosture(process.env);
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const environment = preflightEnvironment(posture, databaseUrl);
  if (environment.status === "refused") fail(environment.detail);

  const client = new Client({ connectionString: databaseUrl! });
  await client.connect();

  try {
    console.log("");
    console.log("  PLATFORM PREFLIGHT — read-only. Nothing is written by this command.");
    console.log("");

    const authored = authoredMigrationCount();
    /*
     * Run the company and genesis preflights separately so the report names WHICH provenance
     * surface is ready, rather than collapsing two independent checks into one verdict.
     *
     * Sequentially: one `Client` runs one query at a time, and concurrent use of the same client is
     * deprecated in pg 8 and removed in pg 9. Two probes against an idle database cost nothing.
     */
    const results = [];
    for (const provenance of ["company", "genesis"] as const) {
      results.push(
        await preflight(client, environment.posture, { provenance, expectedMigrations: authored }),
      );
    }

    console.log(`  posture    : ${results[0]!.status === "ready" ? results[0]!.banner : "—"}`);
    console.log(`  authored   : ${authored} migrations in this checkout`);

    for (const [label, result] of [
      ["tenant provisioning", results[0]!],
      ["genesis nomination", results[1]!],
    ] as const) {
      if (result.status === "refused") {
        console.log(`  ✖ ${label}: REFUSED — ${result.detail}`);
      } else {
        console.log(`  ✔ ${label}: ready`);
        if (result.observed) {
          console.log(
            `      cluster ${result.observed.systemIdentifier}, database ${result.observed.database}, ` +
              `${result.observed.appliedMigrations} applied`,
          );
        }
      }
    }

    if (results.some((r) => r.status === "refused")) {
      console.log("");
      fail("preflight refused. No ceremony may run against this target.");
    }

    console.log("");
    console.log("  Bootstrap surfaces (counts only — no row content is read):");
    for (const table of SURFACES) {
      /*
       * The table name is a compile-time literal from the closed list above, never an argument.
       * There is no expressible way for this command to count a table an operator names.
       */
      const result = await client.query<{ n: string }>(`select count(*)::text as n from "${table}"`);
      console.log(`    ${table.padEnd(32)} ${result.rows[0]!.n}`);
    }

    console.log("");
    console.log("  READY. The ceremonies are available and executable against this target.");
    console.log("  NOTHING HAS BEEN PROVISIONED. No tenant, no role, no membership, no genesis");
    console.log("  nomination and no provider row was created by this command.");
    console.log("");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
