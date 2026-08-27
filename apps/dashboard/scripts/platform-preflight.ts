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
  /*
   * AGENT-ID-0.1 added `agents`, and it is the same KIND of fact as the nine above: a count of a
   * bootstrap surface, taken by the same loop, through the same connection, with no column read.
   *
   * WHY IT HAD TO BE HERE AND NOT SOMEWHERE NEW. The durable agent genesis ceremony is a ONE-SHOT
   * and its predicate is bare existence. Running it without an authoritative baseline would mean
   * firing a one-way door blind, and reading that baseline had no seam: no script in this
   * repository read `agents` at all. The choice was to extend this authority by one closed-list
   * entry or to build a second production-read path — and a second path is the thing this file
   * exists to make unnecessary.
   */
  "agents",
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
    const counts = new Map<(typeof SURFACES)[number], number>();
    for (const table of SURFACES) {
      /*
       * The table name is a compile-time literal from the closed list above, never an argument.
       * There is no expressible way for this command to count a table an operator names.
       */
      const result = await client.query<{ n: string }>(`select count(*)::text as n from "${table}"`);
      counts.set(table, Number(result.rows[0]!.n));
      console.log(`    ${table.padEnd(32)} ${result.rows[0]!.n}`);
    }

    /*
     * ── FIRST-AGENT CEREMONY BASELINE ────────────────────────────────────────
     *
     * DERIVED, NOT READ. Every number below is one of the counts already printed above; this block
     * issues no query of its own and reaches no table that is not already in the closed list. It
     * exists because an operator about to spend a one-shot needs the three facts together, and
     * assembling them by eye from nine lines is how the wrong one gets used.
     *
     * IT AUTHORIZES NOTHING. A green baseline means the ceremony COULD be run truthfully; it is not
     * permission to run it, and this command still creates nothing.
     */
    /*
     * ADDRESSED BY POSITION, NOT BY NAME, AND THAT IS THE POINT.
     *
     * G4 pins every governed table string to the SURFACES literal and nowhere else in this file —
     * which is what makes "counts only" a STRUCTURAL property rather than a promise this file
     * makes about itself. Spelling a governed table name in a `counts.get(...)` down here would
     * have put that name in the report body and quietly weakened the guarantee for a nicer line —
     * and this comment does not spell one either, because the next version of that firewall may
     * read raw text rather than stripped code.
     *
     * So the baseline addresses the closed list by index. The positions are pinned by name in
     * `tests/agent-id-0-1-acceptance`, which asserts the exact contents AND order of SURFACES, so a
     * reordering fails loudly there instead of silently relabelling a number here.
     */
    const at = (index: number): number => counts.get(SURFACES[index]!)!;
    const TENANTS = 0;
    const HUMANS = 1;
    const CREDENTIALS = 3;
    const MEMBERSHIP_ROWS = 4;
    const AGENTS = 9;

    const agents = at(AGENTS);
    const humans = at(HUMANS);
    const tenants = at(TENANTS);
    const credentials = at(CREDENTIALS);
    const membershipRows = at(MEMBERSHIP_ROWS);

    console.log("");
    console.log("  First-agent ceremony baseline (derived from the counts above — no extra read):");
    console.log(`    durable agent identities        ${agents}`);
    console.log(`    humans / tenants                ${humans} / ${tenants}`);
    console.log(`    credentials / membership rows   ${credentials} / ${membershipRows}`);
    console.log("");
    console.log(
      `    genesis unspent platform-wide   ${agents === 0 ? "YES — no tenant holds a durable agent identity" : "NO — see the note below"}`,
    );
    console.log(
      `    an authenticatable human exists ${humans > 0 && credentials > 0 ? "YES" : "NO"}`,
    );
    console.log(
      `    a tenant context exists         ${tenants > 0 && membershipRows > 0 ? "YES" : "NO"}`,
    );

    if (agents > 0) {
      /*
       * HONEST BOUND. The genesis one-shot is PER TENANT, and this is a platform-wide count. Zero
       * settles the question for every tenant at once; anything above zero does not say WHICH
       * tenant holds what, and this command may not find out — that would mean reading a
       * `tenant_id` off a row, which is row content and is exactly what it does not do.
       */
      console.log("");
      console.log("    NOTE: the genesis one-shot is per tenant. A platform-wide count of 0 settles");
      console.log("          it for every tenant; a non-zero count does NOT identify which tenant");
      console.log("          holds an identity, and this command does not read row content to find");
      console.log("          out. Resolve that through the authenticated product surface.");
    }

    console.log("");
    console.log("  READY. The ceremonies are available and executable against this target.");
    console.log("  NOTHING HAS BEEN PROVISIONED. No tenant, no role, no membership, no genesis");
    console.log("  nomination, no provider row and NO AGENT IDENTITY was created by this command.");
    console.log("");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
