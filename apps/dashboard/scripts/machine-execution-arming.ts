/*
 * Production machine-internal-execution arming ceremony — OPERATOR CLI.
 *
 *   npm run platform:machine-execution -- arm
 *   npm run platform:machine-execution -- disarm
 *
 * THE GATE `provider-connectivity.ts` NAMES AND DEFERS TO. Read `lib/machine-execution-arming.ts`
 * first; it holds the reasoning and the whole decision. This file connects, observes, prints and
 * prompts.
 *
 * ── IT ADDS NO AUTHORITY AND NO STATE ────────────────────────────────────────
 *
 * The write is `setProviderConnectivity` — the SAME function the generic ceremony calls, with the
 * same closed vocabulary, the same four columns and the same optimistic predicate. There is one
 * control row and it stays where it was. The root of trust is unchanged: possession of the
 * deployment, proved by G4's signal and a pinned cluster.
 *
 * ── WHY IT IS A SEPARATE COMMAND ─────────────────────────────────────────────
 *
 * G4's reason for the external-send deferral applies here with more force: "a production-reachable
 * arming switch is one command away from armed." Folding this into the generic CLI would restore
 * exactly that for the one capability in the repository that mutates the organization with no human
 * present at the moment of the act. A separate command, a production-only posture, a longer
 * confirmation phrase and a blast-radius statement the generic path does not print are what keep it
 * hard to invoke by accident.
 *
 * THE GENERIC CEREMONY'S REFUSAL IS THE OTHER HALF OF THIS, AND MUST STAY THAT WAY.
 * `machine-internal-execution` is unreachable through `provider:connectivity` in production, by a
 * fail-closed rule rather than by an equality somebody has to remember to extend. A test asserts it.
 *
 * ── PRODUCTION ONLY, IN BOTH DIRECTIONS ──────────────────────────────────────
 *
 * Local arming already works through the generic ceremony and is not duplicated here. This command
 * refuses a local posture and says where to go instead.
 *
 * ── IT NEVER EXECUTES ANYTHING ───────────────────────────────────────────────
 *
 * It imports the released SCOPE constant so the operator is shown what the build actually admits,
 * and it never calls the execution entry point, never touches a permit, request, attempt, decision
 * or work row, and never mints a principal. Arming is a boolean.
 *
 * Server-side operator terminal only. Never imported by the app.
 */
import { createInterface } from "node:readline";
import { Client } from "pg";
import { preflight, preflightEnvironment } from "./lib/ceremony-preflight";
import { resolveCeremonyPosture } from "./lib/production-possession";
import { MACHINE_INTERNAL_EXECUTION_CONTROL_KEY } from "../src/features/governed-machine-execution/machine-execution-control.server";
import { readProviderControl, setProviderConnectivity } from "./lib/provider-connectivity";
import {
  evaluateMachineExecutionArming,
  isMachineArmingTransition,
  MACHINE_ARMING_EFFECT,
  MACHINE_ARMING_NON_EFFECTS,
  MACHINE_EXECUTABLE_SCOPE,
  MACHINE_PRODUCTION_ARMING_CONFIRMATION,
  MACHINE_PRODUCTION_DISARMING_CONFIRMATION,
  type MachineArmingTransition,
} from "./lib/machine-execution-arming";

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
  /* Refuses to run INSIDE the production web runtime, exactly as its siblings do. */
  if (process.env.NODE_ENV === "production") {
    fail("this ceremony runs from an operator terminal and refuses NODE_ENV=production.");
  }

  const verb = process.argv[2]?.trim().toLowerCase();
  if (!isMachineArmingTransition(verb)) {
    fail(
      "usage:\n" +
        "    npm run platform:machine-execution -- arm\n" +
        "    npm run platform:machine-execution -- disarm\n\n" +
        "  This ceremony governs PRODUCTION machine-internal-execution reachability only.\n" +
        "  Local arming stays with:\n" +
        `    npm run provider:connectivity -- ${MACHINE_INTERNAL_EXECUTION_CONTROL_KEY} enable`,
    );
  }
  const transition = verb as MachineArmingTransition;

  const posture = resolveCeremonyPosture(process.env);
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const environment = preflightEnvironment(posture, databaseUrl);
  if (environment.status === "refused") fail(environment.detail);

  if (environment.posture.mode !== "production") {
    fail(
      "this ceremony exists for PRODUCTION machine-internal-execution only, and the posture " +
        "resolved to local.\n  Nothing was connected, read or written.\n" +
        "  For a local deployment use:\n" +
        `    npm run provider:connectivity -- ${MACHINE_INTERNAL_EXECUTION_CONTROL_KEY} enable`,
    );
  }

  const client = new Client({ connectionString: databaseUrl! });
  await client.connect();

  try {
    /* Proves the live cluster is the pinned one before a single application row is read. */
    const ready = await preflight(client, environment.posture, { provenance: "none" });
    if (ready.status === "refused") fail(ready.detail);

    const before = await readProviderControl(client, MACHINE_INTERNAL_EXECUTION_CONTROL_KEY);

    const readiness = evaluateMachineExecutionArming({
      transition,
      postureMode: environment.posture.mode,
      currentlyArmed: before?.directorEnabled,
    });

    if (readiness.status === "refused") {
      const detail =
        readiness.reason === "no-machine-executable-scope"
          ? "the released build admits NO machine-executable act. Arming would enable a capability " +
            "with nothing it could legitimately do, which is a switch reading ON whose only " +
            "function is to mislead the next reader."
          : readiness.reason === "already-armed"
            ? "machine-internal-execution is already armed in production. Nothing was changed."
            : readiness.reason === "not-armed"
              ? "machine-internal-execution is not armed, and an absent control row already reads " +
                "as disarmed everywhere. Nothing needs to change."
              : "the posture is not production.";
      fail(detail);
    }

    const arming = transition === "arm";
    console.log("");
    console.log(`  PRODUCTION MACHINE-INTERNAL-EXECUTION ${arming ? "ARMING" : "DISARMING"} CEREMONY`);
    console.log("");
    console.log(`  posture     : ${ready.banner}`);
    console.log(`  recorded as : ${environment.posture.source}`);
    console.log(`  control key : ${MACHINE_INTERNAL_EXECUTION_CONTROL_KEY}`);
    console.log(`  current     : ${before ? (before.directorEnabled ? "armed" : "disarmed") : "no row (disarmed)"}`);
    console.log(`  requested   : ${arming ? "armed" : "disarmed"}`);
    console.log("");
    console.log("  BLAST RADIUS");
    console.log(`    arming ${MACHINE_ARMING_EFFECT}.`);
    console.log("");
    console.log("    what a machine may trigger, read from the released frozen set:");
    for (const kind of MACHINE_EXECUTABLE_SCOPE) console.log(`      · ${kind}`);
    console.log("");
    console.log("  THIS ACT IS GLOBAL. The control row is root-scoped — it has no tenant_id, and");
    console.log("  exactly one row exists for the whole deployment. Arming makes machine");
    console.log("  triggering REACHABLE FOR EVERY TENANT AT ONCE, including tenants you are not a");
    console.log("  member of. Per-tenant containment does not exist.");
    console.log("");
    if (arming) {
      console.log("  WHAT ARMING DOES NOT DO");
      for (const line of MACHINE_ARMING_NON_EFFECTS) console.log(`    · ${line}`);
      console.log("");
      console.log("  Human/Governance authorization remains MANDATORY and is enforced in the");
      console.log("  DATABASE, not by convention: action_permits_human_authorizer_chk and");
      console.log("  heby_action_requests_human_approver_chk. Armed is not authorized.");
      console.log("");
    }
    console.log("  AUTHORITY IS POSSESSION OF THIS DEPLOYMENT. Not a platform admin, not a");
    console.log("  Governance authority, not a tenant owner or director. updated_by is written as");
    console.log("  NULL rather than naming a human who did not act, and no audit row is written");
    console.log("  because a terminal has no actor to attribute.");
    console.log("");

    const phrase = arming
      ? MACHINE_PRODUCTION_ARMING_CONFIRMATION
      : MACHINE_PRODUCTION_DISARMING_CONFIRMATION;
    const confirmation = await promptVisible(`  Retype exactly to proceed («${phrase}»): `);
    if (confirmation !== phrase) fail("the confirmation phrase did not match. Nothing was changed.");

    const outcome = await setProviderConnectivity(client, {
      providerKey: MACHINE_INTERNAL_EXECUTION_CONTROL_KEY,
      enabled: arming,
      controlSource: environment.posture.source,
      env: process.env,
    });

    if (outcome.status === "refused") {
      fail(`the write was refused: ${outcome.reason}. Nothing was changed.`);
    }

    console.log("");
    console.log(
      `  ✔ machine-internal-execution is now ${outcome.control.directorEnabled ? "ARMED" : "DISARMED"} in production.`,
    );
    console.log(`    version ${outcome.control.version} · source ${outcome.control.controlSource}`);
    console.log("");
    if (arming) {
      console.log("  Nothing has been authorized, permitted, triggered or executed, and nothing");
      console.log("  schedules an execution. The next act still requires a Governance decision on a");
      console.log("  specific request, taken by a human in the product.");
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
