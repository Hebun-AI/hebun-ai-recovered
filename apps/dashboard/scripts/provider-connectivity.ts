/*
 * Global provider connectivity ceremony (R5.1, production-capable since R2H) — OPERATOR CLI.
 *
 *   npm run provider:connectivity -- <provider-key> enable
 *   npm run provider:connectivity -- <provider-key> disable
 *
 * ONE CLI WITH A CLOSED KEY AND A CLOSED VERB, matching `tenant:lifecycle`. Enable and disable are
 * one capability seen from both ends, and the provider key is chosen from the two constants the
 * repository defines — so an unknown provider has no argument that could express it.
 *
 * THE ROOT OF TRUST — READ THIS BEFORE USING IT.
 *
 * Authority is POSSESSION OF THE DEPLOYMENT — the LOCAL one by default, and the PRODUCTION one only
 * when the operator supplies G4's released possession signal and pins the target cluster. That is
 * the same root R4A, R4B, G2.1, D1.1 and R5.1 already rest on; `production-possession.ts` says so
 * itself. NO SECOND AUTHORITY IS CREATED HERE, and no new token, flag, prompt or allowlist exists:
 * this ceremony calls the same three functions `tenant-lifecycle` calls, in the same order.
 *
 * WHY PRODUCTION IS NOW REACHABLE AT ALL. R5.1 did not prohibit production writes; it removed a
 * TENANT-SCOPED ROLE from a GLOBAL switch and recorded the deferral in its own words: "a deliberate
 * forcing function. When production arrives, the platform-operator decision has to be made
 * explicitly." G4 then built the mechanism for exactly that decision. This is that decision being
 * made explicitly, through that mechanism — not a reversal of R5.1.
 *
 * Hebun
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
 *   - target production IMPLICITLY: production requires the released possession signal AND a
 *     pinned cluster, and a normal invocation still refuses a non-local database
 *   - be driven by an environment variable that silently names the provider or the direction
 */
import { createInterface } from "node:readline";
import { Client } from "pg";
import {
  preflight,
  preflightEnvironment,
} from "./lib/ceremony-preflight";
import { resolveCeremonyPosture } from "./lib/production-possession";
import { EXTERNAL_SEND_PROVIDER_KEY } from "../src/features/action-execution/contracts";
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
  /*
   * THIS GUARD IS ABOUT WHERE THE CEREMONY RUNS, NOT WHICH DATABASE IT TARGETS.
   *
   * It refuses to execute INSIDE the production web runtime, where `NODE_ENV=production` and no
   * operator is present. It does not refuse to target the production DATABASE — that is the
   * posture's job, and the posture requires possession. The wording is `platform-preflight`'s
   * rather than `tenant-lifecycle`'s "development-only", which has been inaccurate since G4 made
   * that ceremony production-capable too.
   */
  if (process.env.NODE_ENV === "production") {
    fail("this ceremony runs from an operator terminal and refuses NODE_ENV=production.");
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

  /*
   * G4 POSTURE, RESOLVED BEFORE A CONNECTION IS SPENT — the `tenant-lifecycle` shape verbatim.
   *
   * Absent `HEBUN_PRODUCTION_CEREMONY` is the released local behaviour, unchanged: local posture,
   * and `preflightEnvironment` applies the SAME `assertLocalDatabaseUrl` guard this ceremony always
   * applied. The exact production signal opens the production posture, which requires a pinned
   * cluster and refuses a loopback URL. Anything else refuses outright and is NEVER downgraded to
   * local — an operator who meant production and mistyped must not quietly get something else.
   *
   * `assertLocalDatabaseUrl` is not weakened, here or globally: it still runs, on the local branch,
   * from inside the shared preflight that chooses which guard the posture requires.
   */
  const posture = resolveCeremonyPosture(process.env);
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const environment = preflightEnvironment(posture, databaseUrl);
  if (environment.status === "refused") fail(environment.detail);

  const client = new Client({ connectionString: databaseUrl! });
  await client.connect();

  /*
   * TARGET BINDING. A banner and nothing more in local posture. In production it proves the live
   * cluster is the pinned one — by `system_identifier`, which a connection string cannot set —
   * before a single application row is read. `provenance: "none"` because this table carries no
   * CHECK the preflight could probe for a ceremony root; `control_source`'s own CHECK is enforced
   * by the database on the write itself.
   */
  const ready = await preflight(client, environment.posture, { provenance: "none" });
  if (ready.status === "refused") {
    await client.end();
    fail(ready.detail);
  }

  /*
   * ── EXTERNAL SEND STAYS OUT OF PRODUCTION, AND THAT IS G4'S REASON, NOT A NEW ONE ────────
   *
   * G4 recorded exactly why it left this whole CLI local-only: "a production-reachable arming
   * switch is one command away from armed." R2H makes the ceremony production-capable because
   * MODEL CONNECTIVITY needs it — enabling `claude` permits an inference and spends money. Arming
   * `external-send` sends real email to real people, which is a different order of consequence,
   * and nothing in this phase was authorized to make that reachable in production.
   *
   * So the posture is narrowed for that key alone, HERE, in the CLI. The writer stays completely
   * provider-agnostic: it never asks which key it is writing when deciding a root, and both keys
   * record their source identically. This is a reachability decision, not a source-semantics one.
   *
   * It is a DEFERRAL with a named owner, not a prohibition: production arming earns its own gate,
   * where the send configuration, the recipient authority and the blast radius are the subject
   * rather than a side effect of a connectivity change.
   */
  if (environment.posture.mode === "production" && providerKey === EXTERNAL_SEND_PROVIDER_KEY) {
    await client.end();
    fail(
      `"${providerKey}" cannot be armed through a PRODUCTION ceremony. Model connectivity became ` +
        "production-capable at R2H; external send did not, because arming it sends real messages " +
        "to real recipients and that reachability belongs to its own gate. The LOCAL ceremony is " +
        "unchanged and still arms it. Nothing was read from the control table and nothing was written.\n\n" +
        "  That gate now exists and is a DIFFERENT command, deliberately:\n" +
        "    npm run platform:external-send -- arm\n" +
        "  It refuses unless the send configuration is complete, the recipient table is readable " +
        "and the deployment holds an active recipient, and it states the blast radius before it " +
        "asks. This refusal is not weakened by its existence: external send stays unreachable " +
        "through THIS ceremony in production.",
    );
  }

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
    console.log(`  posture    : ${ready.banner}`);
    console.log(`  recorded as: ${environment.posture.source}`);
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

    /*
     * THE ROOT IS THE POSTURE'S, NEVER A LITERAL AT THIS CALL SITE AND NEVER INFERRED.
     *
     * It is not derived from DATABASE_URL, not from NODE_ENV, and not from the hostname: it is the
     * value `resolveCeremonyPosture` returned after the operator proved which deployment they
     * possess and the live cluster matched the pin. A local run cannot emit the production root,
     * because no code path gives local posture that value.
     */
    const outcome = await setProviderConnectivity(client, {
      providerKey,
      enabled,
      controlSource: environment.posture.source,
    });

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
    console.log(`    source     : ${control.controlSource ?? "NULL"}`);
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
