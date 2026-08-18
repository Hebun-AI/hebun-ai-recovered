/*
 * Global provider connectivity ceremony (R5.1) — LOCAL OPERATOR CLI.
 *
 *   npm run provider:connectivity -- <provider-key> enable
 *   npm run provider:connectivity -- <provider-key> disable
 *
 * ONE CLI WITH A CLOSED KEY AND A CLOSED VERB, matching `tenant:lifecycle`. Enable and disable are
 * one capability seen from both ends, and the provider key is chosen from the two constants the
 * repository defines — so an unknown provider has no argument that could express it.
 *
 * THE ROOT OF TRUST — READ THIS BEFORE USING IT.
 * Authority is POSSESSION OF THE LOCAL DEPLOYMENT, exactly as for R4A, R4B, G2.1 and D1.1. Hebun
 * cannot cryptographically identify the human at this terminal and does not pretend to. It is NOT a
 * platform admin, NOT a platform operator, NOT a Governance authority, NOT a tenant owner or
 * director. No authenticated platform principal exists in Hebun yet.
 *
 * WHY IT IS NOT A PRODUCT SURFACE. The control row is root-scoped: no `tenant_id`, one row per
 * provider key for the entire deployment. Every in-app authority Hebun has is tenant-scoped —
 * `roles.tenant_id` is NOT NULL and the provider authority resolver joined the role to the session's
 * tenant. Gating a global write with a tenant-confined authority let one tenant's owner change what
 * every other tenant depends on. Rather than widen the authority, R5.1 moved the write out of the
 * product entirely and left the READ exactly where it was.
 *
 * WHAT IT DELIBERATELY CANNOT DO:
 *   - reach any provider key outside the two the repository defines
 *   - read, print, accept, write or rotate a credential — connectivity is a boolean
 *   - create a control row for a `disable` (an absent row already reads as disabled)
 *   - arm external send while the deployment is unconfigured
 *   - write an audit row — `audit_log.actor_id`/`actor_type` are NOT NULL and a terminal has no
 *     actor to name; blocked on a real platform principal, not on a later hardening phase
 *   - touch tenants, users, memberships, roles, sessions, permits, attempts or requests
 *   - run in production, or against a non-local database (both refused)
 *   - be driven by an environment variable that silently names the provider or the direction
 */
import { createInterface } from "node:readline";
import { Client } from "pg";
import { assertLocalDatabaseUrl } from "./lib/provision-dev-credential";
import {
  PROVIDER_KEYS,
  isProviderKey,
  isTransition,
  readProviderControl,
  setProviderConnectivity,
  type ConnectivityTransition,
} from "./lib/provider-connectivity";

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

  const providerKey = process.argv[2]?.trim();
  const verb = process.argv[3]?.trim().toLowerCase();

  if (!isProviderKey(providerKey) || !isTransition(verb)) {
    fail(
      "usage:\n" +
        "    npm run provider:connectivity -- <provider-key> enable\n" +
        "    npm run provider:connectivity -- <provider-key> disable\n\n" +
        `  provider keys: ${PROVIDER_KEYS.join(", ")}\n` +
        "  A provider outside that list has no control row and cannot be given one here.",
    );
  }

  const transition = verb as ConnectivityTransition;
  const enabled = transition === "enable";

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    fail("DATABASE_URL is not set. Point it at your local Hebun development database.");
  }
  try {
    assertLocalDatabaseUrl(databaseUrl);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const before = await readProviderControl(client, providerKey);
    /* An absent row and an explicit `false` are both disabled — say which one this is. */
    const currentState = before ? (before.directorEnabled ? "enabled" : "disabled") : "no row (disabled)";

    if (!before && !enabled) {
      fail(
        `provider "${providerKey}" has no control row, which every reader already treats as ` +
          "DISABLED. Nothing needs to change, and this ceremony will not create a row whose only " +
          "effect would be to exist.",
      );
    }
    if (before && before.directorEnabled === enabled) {
      fail(`provider "${providerKey}" is already ${transition}d. Nothing was changed.`);
    }

    console.log("");
    console.log(`  GLOBAL PROVIDER CONNECTIVITY CEREMONY — ${transition.toUpperCase()}`);
    console.log("");
    console.log(`  provider   : ${providerKey}`);
    console.log(`  current    : ${currentState}`);
    console.log(`  requested  : ${enabled ? "enabled" : "disabled"}`);
    if (before) console.log(`  version    : ${before.version} → ${before.version + 1}`);
    console.log("");
    console.log("  THIS ACT IS GLOBAL. The control row is root-scoped — it has no tenant_id, and");
    console.log("  exactly one row exists per provider key for the whole deployment. This change");
    console.log("  applies to EVERY tenant at once, including tenants you are not a member of.");
    console.log("");
    console.log("  AUTHORITY IS POSSESSION OF THIS DEPLOYMENT. It is not a platform admin, not a");
    console.log("  platform operator, not a Governance authority, and not a tenant owner or");
    console.log("  director. NO TENANT ROLE AUTHORIZES THIS ACT — that is precisely why the write");
    console.log("  is here and not in the product: a tenant-scoped role must never decide what");
    console.log("  every other tenant depends on.");
    console.log("");
    console.log("  NO CREDENTIAL IS READ, SHOWN, WRITTEN OR ROTATED. Connectivity is a boolean");
    console.log("  permission; the API key stays in deployment configuration, outside Hebun.");
    console.log("");
    console.log("  No audit event is recorded — a terminal has no actor to attribute, and");
    console.log("  updated_by is written as NULL rather than naming a human who did not act.");
    console.log("");

    const confirmation = await promptVisible(`  Retype the provider key to ${transition} (${providerKey}): `);
    if (confirmation !== providerKey) {
      fail("the provider key did not match. Nothing was changed.");
    }

    const outcome = await setProviderConnectivity(client, { providerKey, enabled });

    if (outcome.status === "refused") {
      fail(
        outcome.reason === "configuration-incomplete"
          ? `"${providerKey}" cannot be enabled until the deployment supplies its credential, ` +
              "sender and subject. Arming a deployment that cannot send would produce a switch " +
              "reading ON whose only function is to mislead the next reader. Nothing was changed."
          : outcome.reason === "already-in-that-state"
            ? `"${providerKey}" reached ${enabled ? "enabled" : "disabled"} during this ceremony — ` +
              "another operator won the race. Nothing was changed."
            : `refused: ${outcome.reason}. Nothing was changed.`,
      );
    }

    const { control } = outcome;
    console.log("");
    console.log(`  ✔ provider "${control.providerKey}" is now ${control.directorEnabled ? "ENABLED" : "DISABLED"}`);
    console.log(`    version    : ${control.version}`);
    console.log(`    updated_by : ${control.updatedBy ?? "NULL (no verified actor — deployment possession)"}`);
    console.log("");
    if (control.directorEnabled) {
      console.log("    Enabled means the Director PERMITS connectivity. It does not mean the");
      console.log("    provider is configured, reachable, or healthy, and it authorizes no");
      console.log("    execution by itself. To reverse it:");
      console.log("");
      console.log(`      npm run provider:connectivity -- ${control.providerKey} disable`);
    } else {
      console.log("    Every new request for this provider is now refused server-side, before");
      console.log("    any network dispatch, for every tenant.");
    }
    console.log("");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
