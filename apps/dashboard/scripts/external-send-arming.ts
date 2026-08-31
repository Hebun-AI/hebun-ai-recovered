/*
 * Production external-send arming ceremony — OPERATOR CLI.
 *
 *   npm run platform:external-send -- arm
 *   npm run platform:external-send -- disarm
 *
 * THE GATE `provider-connectivity.ts` NAMED AND DEFERRED. Read `lib/external-send-arming.ts` first;
 * it holds the reasoning and the whole decision. This file connects, observes, prints and prompts.
 *
 * ── IT ADDS NO AUTHORITY AND NO STATE ────────────────────────────────────────
 *
 * The write is `setProviderConnectivity` — the SAME function the generic ceremony calls, with the
 * same closed vocabulary, the same four columns and the same configuration refusal. There is one
 * control row and it stays where it was. The root of trust is unchanged: possession of the
 * deployment, proved by G4's signal and a pinned cluster.
 *
 * ── WHY IT IS A SEPARATE COMMAND ─────────────────────────────────────────────
 *
 * G4's reason for the deferral was reachability: "a production-reachable arming switch is one
 * command away from armed." Folding this into the generic CLI would restore exactly that. A
 * separate command, a production-only posture, a longer confirmation phrase and preconditions the
 * generic path does not have are what keep it hard to invoke by accident.
 *
 * THE GENERIC CEREMONY'S REFUSAL IS UNCHANGED AND MUST STAY THAT WAY. `external-send` remains
 * unreachable through `provider:connectivity` in production, and a test asserts it.
 *
 * ── PRODUCTION ONLY, IN BOTH DIRECTIONS ──────────────────────────────────────
 *
 * Local arming already works through the generic ceremony and is not duplicated here. This command
 * refuses a local posture and says where to go instead.
 *
 * Server-side operator terminal only. Never imported by the app.
 */
import { createInterface } from "node:readline";
import { Client } from "pg";
import { preflight, preflightEnvironment } from "./lib/ceremony-preflight";
import { resolveCeremonyPosture } from "./lib/production-possession";
import { EXTERNAL_SEND_PROVIDER_KEY } from "../src/features/action-execution/contracts";
import { readProviderControl, setProviderConnectivity } from "./lib/provider-connectivity";
import {
  ARMING_NON_EFFECTS,
  evaluateExternalSendArming,
  isArmingTransition,
  PRODUCTION_ARMING_CONFIRMATION,
  PRODUCTION_DISARMING_CONFIRMATION,
  readConfigurationPresence,
  type ArmingTransition,
  type RecipientReach,
} from "./lib/external-send-arming";

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

/**
 * Count active recipients across the deployment.
 *
 * A READ, and deployment-wide because the switch is. A thrown error becomes `readable: false` and
 * never zero — an unreadable table must not look like a deployment that holds nobody to send to.
 */
async function observeRecipientReach(client: Client): Promise<RecipientReach> {
  try {
    const result = await client.query<{ recipients: string; tenants: string }>(
      `select count(*)::text as recipients, count(distinct tenant_id)::text as tenants
         from external_recipients
        where status = 'active' and lifecycle_status = 'active'`,
    );
    const row = result.rows[0];
    return {
      readable: true,
      activeRecipients: Number(row?.recipients ?? "0"),
      tenantsWithRecipients: Number(row?.tenants ?? "0"),
    };
  } catch {
    return { readable: false, activeRecipients: 0, tenantsWithRecipients: 0 };
  }
}

async function main(): Promise<void> {
  /* Refuses to run INSIDE the production web runtime, exactly as its sibling does. */
  if (process.env.NODE_ENV === "production") {
    fail("this ceremony runs from an operator terminal and refuses NODE_ENV=production.");
  }

  const verb = process.argv[2]?.trim().toLowerCase();
  if (!isArmingTransition(verb)) {
    fail(
      "usage:\n" +
        "    npm run platform:external-send -- arm\n" +
        "    npm run platform:external-send -- disarm\n\n" +
        "  This ceremony governs PRODUCTION external-send reachability only.\n" +
        "  Local arming stays with: npm run provider:connectivity -- external-send enable",
    );
  }
  const transition = verb as ArmingTransition;

  const posture = resolveCeremonyPosture(process.env);
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const environment = preflightEnvironment(posture, databaseUrl);
  if (environment.status === "refused") fail(environment.detail);

  if (environment.posture.mode !== "production") {
    fail(
      "this ceremony exists for PRODUCTION external-send only, and the posture resolved to local.\n" +
        "  Nothing was connected, read or written.\n" +
        "  For a local deployment use: npm run provider:connectivity -- external-send enable",
    );
  }

  const client = new Client({ connectionString: databaseUrl! });
  await client.connect();

  try {
    /* Proves the live cluster is the pinned one before a single application row is read. */
    const ready = await preflight(client, environment.posture, { provenance: "none" });
    if (ready.status === "refused") fail(ready.detail);

    const before = await readProviderControl(client, EXTERNAL_SEND_PROVIDER_KEY);
    const reach = await observeRecipientReach(client);
    const configuration = readConfigurationPresence(process.env);

    const readiness = evaluateExternalSendArming({
      transition,
      postureMode: environment.posture.mode,
      currentlyArmed: before?.directorEnabled,
      reach,
      env: process.env,
    });

    if (readiness.status === "refused") {
      const detail =
        readiness.reason === "configuration-incomplete"
          ? `the deployment is not configured to send. Absent: ${readiness.missingKeys?.join(", ")}.\n` +
            "  Set them in the production environment, redeploy, and run this ceremony again.\n" +
            "  No value was read, printed or written."
          : readiness.reason === "recipient-authority-unavailable"
            ? "the recipient table could not be read. That is a FAILED READ, not a deployment " +
              "with nobody to send to, and arming on an unknown is refused."
            : readiness.reason === "no-active-recipient"
              ? "this deployment holds no active external recipient. Arming would make sending " +
                "reachable with nobody it could legitimately reach."
              : readiness.reason === "already-armed"
                ? "external send is already armed in production. Nothing was changed."
                : readiness.reason === "not-armed"
                  ? "external send is not armed, and an absent control row already reads as " +
                    "disarmed everywhere. Nothing needs to change."
                  : "the posture is not production.";
      fail(detail);
    }

    const arming = transition === "arm";
    console.log("");
    console.log(`  PRODUCTION EXTERNAL-SEND ${arming ? "ARMING" : "DISARMING"} CEREMONY`);
    console.log("");
    console.log(`  posture     : ${ready.banner}`);
    console.log(`  recorded as : ${environment.posture.source}`);
    console.log(`  provider    : ${EXTERNAL_SEND_PROVIDER_KEY}`);
    console.log(`  current     : ${before ? (before.directorEnabled ? "armed" : "disarmed") : "no row (disarmed)"}`);
    console.log(`  requested   : ${arming ? "armed" : "disarmed"}`);
    console.log("");
    console.log("  CONFIGURATION — presence only. No value is read, shown, written or rotated.");
    console.log(`    api key  : ${configuration.apiKeyPresent ? "present" : "ABSENT"}`);
    console.log(`    sender   : ${configuration.senderPresent ? "present" : "ABSENT"}`);
    console.log(`    subject  : ${configuration.subjectPresent ? "present" : "ABSENT"}`);
    console.log("");
    console.log("  BLAST RADIUS");
    console.log(`    active recipients across this deployment : ${reach.activeRecipients}`);
    console.log(`    tenants holding at least one            : ${reach.tenantsWithRecipients}`);
    console.log("");
    console.log("  THIS ACT IS GLOBAL. The control row is root-scoped — it has no tenant_id, and");
    console.log("  exactly one row exists for the whole deployment. Arming makes outbound sending");
    console.log("  REACHABLE FOR EVERY TENANT AT ONCE, including tenants you are not a member of.");
    console.log("  Per-tenant containment does not exist and is required before a second tenant");
    console.log("  executes in production.");
    console.log("");
    if (arming) {
      console.log("  WHAT ARMING DOES NOT DO");
      for (const line of ARMING_NON_EFFECTS) console.log(`    · ${line}`);
      console.log("");
      console.log("  After arming, an execution STILL requires a Governance decision, a permit,");
      console.log("  and R3B's own transaction. Armed is not authorized.");
      console.log("");
    }
    console.log("  AUTHORITY IS POSSESSION OF THIS DEPLOYMENT. Not a platform admin, not a");
    console.log("  Governance authority, not a tenant owner or director. updated_by is written as");
    console.log("  NULL rather than naming a human who did not act, and no audit row is written");
    console.log("  because a terminal has no actor to attribute.");
    console.log("");

    const phrase = arming ? PRODUCTION_ARMING_CONFIRMATION : PRODUCTION_DISARMING_CONFIRMATION;
    const confirmation = await promptVisible(`  Retype exactly to proceed («${phrase}»): `);
    if (confirmation !== phrase) fail("the confirmation phrase did not match. Nothing was changed.");

    const outcome = await setProviderConnectivity(client, {
      providerKey: EXTERNAL_SEND_PROVIDER_KEY,
      enabled: arming,
      controlSource: environment.posture.source,
      env: process.env,
    });

    if (outcome.status === "refused") {
      fail(`the write was refused: ${outcome.reason}. Nothing was changed.`);
    }

    console.log("");
    console.log(`  ✔ external send is now ${outcome.control.directorEnabled ? "ARMED" : "DISARMED"} in production.`);
    console.log(`    version ${outcome.control.version} · source ${outcome.control.controlSource}`);
    console.log("");
    if (arming) {
      console.log("  Nothing has been approved, permitted, executed or sent. The next act is a");
      console.log("  Governance decision on a specific request, taken by a human in the product.");
      console.log("");
    }
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(`\n  ✖ ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
