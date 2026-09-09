/*
 * TRH-25 PREREQUISITES — the structural rules the kill switch and the concurrency guarantee stand
 * on. Source is read with comments STRIPPED, so no rule here can be satisfied — or tripped — by
 * prose.
 *
 * WHAT THIS FILE REFUSES TO LET HAPPEN:
 *
 *   1. A SECOND KILL-SWITCH SYSTEM. One table, one ceremony, one key spelled once.
 *   2. A WRITER ANYWHERE UNDER `src/`. Nothing the application runs can arm its own read path.
 *   3. A GRANT WEARING A SWITCH'S CLOTHES. The control can refuse and can never authorize.
 *   4. AN ADVISORY CHECK PRETENDING TO BE AUTHORITATIVE. The stop lives in the revalidator.
 *   5. A LOCK HELD ACROSS PROVIDER I/O, or any invented scheduler state.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (f: string): string => readFileSync(path.join(ROOT, f), "utf8");
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const AUTHORITY = "src/features/standing-observation-authority";
const CONTROL = `${AUTHORITY}/observation-read-control.server.ts`;
const CONTRACTS = `${AUTHORITY}/contracts.ts`;
const REVALIDATOR = `${AUTHORITY}/revalidate-standing-observation.server.ts`;
const WRITER = "src/features/provider-observation-history/write-provider-observation.server.ts";
const COMPOSITION =
  "src/features/provider-observation-history/observe-once-under-authorization.server.ts";
const CONTROL_TABLE = "src/db/schema/provider-connectivity-control.ts";
const CEREMONY_LIB = "scripts/lib/provider-connectivity.ts";

function walk(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return walk(rel);
    return /\.tsx?$/.test(entry.name) ? [rel] : [];
  });
}

const SRC = walk("src");
const KEY_LITERAL = '"provider-observation-read"';

function main(): void {
  /* ═══════════════════════════════════════════════════════════════════════════
   * 1. A ROW, NOT A TABLE — AND THE KEY IS SPELLED EXACTLY ONCE.
   * ═══════════════════════════════════════════════════════════════════════ */
  const declaring = SRC.filter((f) => codeOf(read(f)).includes(KEY_LITERAL));
  assert.deepEqual(
    declaring,
    [CONTRACTS],
    "the control key is declared in exactly one module, so no second spelling can drift from it",
  );

  /*
   * MEASURED ON DECLARED TABLE NAMES, not on the word "switch" appearing somewhere in a file —
   * that matched a `switch` statement and would have failed on unrelated schemas, which is a guard
   * that fails for the wrong reason and teaches nothing.
   */
  const declaredTables = walk("src/db/schema").flatMap((f) =>
    [...codeOf(read(f)).matchAll(/pgTable\(\s*"([a-z_]+)"/g)].map((m) => m[1]!),
  );
  const controlTables = declaredTables.filter((name) =>
    /control|switch|kill|lock|lease|schedule/.test(name),
  );
  assert.deepEqual(
    controlTables.sort(),
    ["provider_connectivity_controls"],
    "exactly ONE control table exists — no second kill switch, no lock table, no schedule table",
  );

  const controlSchema = codeOf(read(CONTROL_TABLE));
  assert.ok(
    !/tenantColumns|tenant_id/.test(controlSchema),
    "the control table is still GLOBAL — this phase added no tenant dimension to it",
  );

  /* ═══════════════════════════════════════════════════════════════════════════
   * 2. NO WRITER UNDER `src/`, FOR ANY CONTROL KEY.
   * ═══════════════════════════════════════════════════════════════════════ */
  for (const file of SRC) {
    const code = codeOf(read(file));
    if (!code.includes("providerConnectivityControls")) continue;
    for (const mutation of [".insert(", ".update(", ".delete(", "onConflictDoUpdate"]) {
      const near = code.slice(Math.max(0, code.indexOf("providerConnectivityControls") - 400));
      assert.ok(
        !near.includes(`${mutation}providerConnectivityControls`) &&
          !new RegExp(`${mutation.replace(/[.(]/g, "\\$&")}\\s*providerConnectivityControls`).test(code),
        `${file} does not ${mutation} the control table — the application cannot arm its own path`,
      );
    }
  }
  const controlCode = codeOf(read(CONTROL));
  for (const forbidden of ["setDirectorEnabled", "setObservationRead", "enableObservation", ".insert(", ".update("]) {
    assert.ok(
      !controlCode.includes(forbidden),
      `the control module exposes no \`${forbidden}\` — it reads a switch and cannot move one`,
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 3. IT CAN REFUSE AND IT CANNOT AUTHORIZE.
   * ═══════════════════════════════════════════════════════════════════════ */
  assert.ok(
    /return\s+false;/.test(controlCode),
    "the control module fails closed in its own body, not only in its dependency",
  );
  for (const grant of [
    "authorizeStandingObservation",
    "mintObservationPrincipal",
    "standingObservationAuthorizations",
    "decisionRecords",
    "actionPermits",
  ]) {
    assert.ok(
      !controlCode.includes(grant),
      `the control module never touches ${grant} — a switch may remove permission, never create it`,
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 4. THE STOP IS AUTHORITATIVE, NOT ADVISORY.
   * ═══════════════════════════════════════════════════════════════════════ */
  const revalidatorCode = codeOf(read(REVALIDATOR));
  assert.ok(
    revalidatorCode.includes("resolveObservationReadEnabled"),
    "the last-moment revalidator consults the switch",
  );
  assert.ok(
    revalidatorCode.includes('reason: "observation-read-disabled"'),
    "and refuses with its own distinct fact, never folded into not-authorized",
  );

  /*
   * IT IS REACHED BEFORE THE TRANSPORT AND AFTER THE AUTHORIZATION'S OWN TRUTH. Proved
   * POSITIONALLY, because "the check exists somewhere in the file" is not the property.
   */
  const at = (needle: string): number => {
    const i = revalidatorCode.indexOf(needle);
    assert.ok(i >= 0, `the revalidator still contains ${needle}`);
    return i;
  };
  /* The CALL SITE, never the import — an import sits at the top of every file and orders nothing. */
  const callSite = at("await resolveObservationReadEnabled(");
  assert.ok(
    at('reason: "authorization-withdrawn"') < callSite,
    "withdrawal is decided BEFORE the switch, so a stop can never disguise a revoked grant",
  );
  assert.ok(
    callSite < at("await listConnections("),
    "and the switch is decided BEFORE any tenant data is read, so a stopped deployment reads nothing",
  );

  /* THE MANUAL CEREMONY HAS NO EXEMPTION — it holds no switch vocabulary of its own. */
  const compositionCode = codeOf(read(COMPOSITION));
  for (const bypass of ["resolveObservationReadEnabled", "OBSERVATION_READ_CONTROL_KEY", "directorEnabled"]) {
    assert.ok(
      !compositionCode.includes(bypass),
      `the composition does not consult the switch itself (${bypass}) — it inherits the refusal, ` +
        "which is what makes an exemption impossible to add by accident",
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 5. THE CONCURRENCY GUARANTEE, AND WHAT IT REFUSED TO BECOME.
   * ═══════════════════════════════════════════════════════════════════════ */
  const writerCode = codeOf(read(WRITER));
  assert.ok(
    /for update/.test(writerCode),
    "the machine writer serializes on a row lock",
  );
  assert.ok(
    writerCode.includes("standing_observation_authorizations"),
    "and the row it locks is the authorization being spent — not a lock table",
  );
  assert.ok(
    /db\.transaction\(/.test(writerCode),
    "the claim and the insert are one transaction, so the lock covers the decision it protects",
  );

  /* NO NETWORK I/O INSIDE THAT TRANSACTION, which is the reason the lock is short. */
  const txStart = writerCode.indexOf("db.transaction(");
  const txBody = writerCode.slice(txStart, writerCode.indexOf("});", txStart));
  for (const io of ["fetch(", "fetchImpl", "observeChannel", "withConnectionScopedSecret", "withDecryptedSecret"]) {
    assert.ok(
      !txBody.includes(io),
      `no \`${io}\` inside the transaction — no transaction in this repository spans network I/O`,
    );
  }

  /* AND NO SCHEDULER STATE WAS INVENTED TO ACHIEVE IT. */
  for (const invented of [
    "pg_advisory", "lease", "nextRunAt", "next_run_at", "lockedUntil", "locked_until",
    "reservation", "heartbeat", "setInterval", "cron",
  ]) {
    assert.ok(
      !writerCode.includes(invented),
      `the writer invents no \`${invented}\` — a crashed process leaves nothing to reclaim`,
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 6. STILL NO SCHEDULER, AND STILL NO INGRESS.
   * ═══════════════════════════════════════════════════════════════════════ */
  const routes = walk("src/app").filter((f) => /\/route\.tsx?$/.test(f));
  assert.deepEqual(
    routes.sort(),
    [
      "src/app/api/integrations/github/setup/route.ts",
      "src/app/api/integrations/github/start/route.ts",
      "src/app/api/integrations/google/callback/route.ts",
      "src/app/api/integrations/google/start/route.ts",
      /* The Instagram OAuth ceremony — the third provider pair, added by this phase. */
      "src/app/api/integrations/instagram/callback/route.ts",
      "src/app/api/integrations/instagram/start/route.ts",
      "src/app/api/observation/scan/route.ts",
    ],
    /*
     * THE PREREQUISITES STILL ADD NO ROUTE. The machine ingress belongs to TRH-25, which came
     * after, and is listed here only so this census keeps naming every route that exists — a list
     * that silently stopped matching reality would stop catching the next addition.
     */
    "the kill switch and the lock add no route; the trigger's one ingress is named",
  );
  /*
   * THE SCHEDULE, PINNED BY VALUE (TRH-25). Until the trigger phase this asserted that
   * `vercel.json` DID NOT EXIST — a cheap way to say "nothing runs on its own", and it worked: it
   * failed on the run that introduced the schedule. It cannot express the property now that a
   * schedule is a deliberate decision, so it is replaced by a NARROWER one: exactly ONE cron
   * exists, it points at the machine ingress, and it runs hourly. A second entry, a different
   * path, or a different cadence fails here.
   *
   * `src/app/api/cron` still must not exist: the ingress lives at its own named path, and a second
   * conventional cron directory would be a second door.
   */
  {
    let cronDir = true;
    try {
      readFileSync(path.join(ROOT, "src/app/api/cron"), "utf8");
    } catch {
      cronDir = false;
    }
    assert.equal(cronDir, false, "src/app/api/cron does not exist — there is one ingress, not two");

    const vercelConfig = JSON.parse(readFileSync(path.join(ROOT, "vercel.json"), "utf8")) as {
      readonly crons?: readonly { readonly path: string; readonly schedule: string }[];
    };
    assert.deepEqual(
      vercelConfig.crons,
      [{ path: "/api/observation/scan", schedule: "0 * * * *" }],
      "exactly one schedule exists: hourly, aimed at the machine ingress, and nothing else",
    );
    assert.deepEqual(
      Object.keys(vercelConfig).sort(),
      ["$schema", "crons"],
      "and the deployment config carries NOTHING but that schedule",
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 7. ONE CEREMONY OWNS ALL THREE SWITCHES.
   * ═══════════════════════════════════════════════════════════════════════ */
  const ceremonyCode = codeOf(read(CEREMONY_LIB));
  assert.ok(
    ceremonyCode.includes("OBSERVATION_READ_CONTROL_KEY"),
    "the released possession ceremony is the writer, and it IMPORTS the key rather than retyping it",
  );
  assert.ok(
    !ceremonyCode.includes(KEY_LITERAL),
    "and never spells the literal itself",
  );

  console.log(
    "trh25-observation-control/control-firewall: one key, one table, one ceremony, zero writers " +
      "under src, stop before transport, lock without I/O, no scheduler",
  );
}

main();
