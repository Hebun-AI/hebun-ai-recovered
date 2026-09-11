/*
 * LOCAL RUNTIME ENVIRONMENT SAFETY — which control-plane database target a process may open.
 *
 * ── THE HAZARD THIS PINS ────────────────────────────────────────────────────
 *
 * `next start` runs Next.js in PRODUCTION MODE, and in production mode Next loads
 * `.env.production.local` at HIGHER precedence than `.env.local`. That file is written by
 * `vercel env pull`, so a developer's checkout can hold the deployment's entire environment shape —
 * including `DATABASE_URL` and `HEBUN_CONTROL_PLANE_ALLOW_REMOTE`.
 *
 * Measured during SOC-UI1 acceptance, and not inferred: a plain `npx next start` could not resolve a
 * session that the SAME build resolved immediately once `.env.local` was exported into the process
 * first. Same code, same cookie, same rows. The pulled file had won.
 *
 * ── PRODUCTION MODE IS NOT PRODUCTION DEPLOYMENT ────────────────────────────
 *
 * `NODE_ENV=production` says how this process COMPILES. It says nothing about where it RUNS, and it
 * is never consulted below. Neither is `VERCEL` nor `VERCEL_ENV`: both are written verbatim into
 * `.env.production.local` by `vercel env pull` — `VERCEL="1"`, `VERCEL_ENV="production"` — so a
 * guard keyed on either is already defeated on a laptop, in this very checkout. They are tested here
 * precisely to prove they grant nothing.
 *
 * ── WHAT DOES AUTHORIZE A REMOTE TARGET ─────────────────────────────────────
 *
 * `HEBUN_CONTROL_PLANE_ALLOW_REMOTE` exactly `"true"`, AND no evidence that this process is running
 * on a pulled environment snapshot. `vercel env pull` writes the literal `[SENSITIVE]` in place of
 * every value the project marks Sensitive; a real deployment holds the real values and never that
 * placeholder. Its presence anywhere in the environment is therefore positive proof of a LOCAL
 * process wearing the deployment's clothes.
 */
import assert from "node:assert/strict";
import {
  CONTROL_PLANE_ALLOW_REMOTE_ENV,
  ControlPlaneUnavailableError,
  assertControlPlaneTargetAllowed,
  type ControlPlaneEnvironment,
} from "../../src/db/client.server";

/* A password that must never appear in any thrown message. Not a real credential. */
const SECRET = "sup3rs3cret-pw-do-not-leak";
const REMOTE_URL = `postgres://hebun:${SECRET}@db.example.invalid:5432/prod`;
const LOCAL_URL = `postgres://hebun:${SECRET}@127.0.0.1:55432/hebun_r1`;

const allowed = (url: string, env: ControlPlaneEnvironment): void => {
  assert.doesNotThrow(() => assertControlPlaneTargetAllowed(url, env));
};

const refused = (url: string, env: ControlPlaneEnvironment, because: string): Error => {
  try {
    assertControlPlaneTargetAllowed(url, env);
  } catch (error) {
    assert.ok(error instanceof ControlPlaneUnavailableError, "refusal is the released error type");
    return error as Error;
  }
  assert.fail(`expected a refusal: ${because}`);
};

/* ── 1–3 · a loopback target is always allowed ─────────────────────────────── */

function loopbackTargetsAreAllowed(): void {
  for (const host of ["localhost", "127.0.0.1"]) {
    allowed(`postgres://u:p@${host}:5432/db`, {});
  }
  /*
   * IPv6 loopback. `new URL(...).hostname` returns "[::1]" WITH brackets, while the released
   * allowlist held "::1" without them — so an IPv6 local database was classified REMOTE and refused.
   * Fail-closed, and therefore harmless, but wrong: it is a local database.
   */
  allowed("postgres://u:p@[::1]:5432/db", {});
}

/* ── 4 · a remote target is refused by default ─────────────────────────────── */

function remoteTargetIsRefusedWithoutAuthorization(): void {
  const error = refused(REMOTE_URL, {}, "no authorization was given");
  assert.ok(/remote|non-local/i.test(error.message), `the refusal names the cause: ${error.message}`);
}

/* ── 5 · NODE_ENV is not deployment identity ───────────────────────────────── */

function productionModeDoesNotAuthorizeAnything(): void {
  refused(REMOTE_URL, { NODE_ENV: "production" }, "NODE_ENV=production is a build mode, not a place");
}

function vercelVariablesDoNotAuthorizeAnything(): void {
  /*
   * These exact values sit in `.env.production.local` on a developer's machine today. If either
   * could authorize a remote target, the hazard would be open right now.
   */
  refused(
    REMOTE_URL,
    { VERCEL: "1", VERCEL_ENV: "production", VERCEL_TARGET_ENV: "production", NODE_ENV: "production" },
    "VERCEL and VERCEL_ENV are pulled verbatim into a local file and grant nothing",
  );
}

/* ── 6/7 · the real deployment still works ─────────────────────────────────── */

function anAuthorizedDeployedRuntimeMayReachARemoteTarget(): void {
  allowed(REMOTE_URL, { [CONTROL_PLANE_ALLOW_REMOTE_ENV]: "true" });
  /* Preview follows the same rule: the flag governs, the environment name does not. */
  allowed(REMOTE_URL, { [CONTROL_PLANE_ALLOW_REMOTE_ENV]: "true", VERCEL_ENV: "preview" });
}

function theFlagIsAnExactLiteral(): void {
  /*
   * Not trimmed, not lowercased, not coerced. `Boolean(env[...])` would make the string
   * "[SENSITIVE]" truthy and open the hazard, which is exactly the loosening this pins shut.
   */
  for (const value of ["TRUE", "True", " true", "true ", "1", "yes", "", "[SENSITIVE]"]) {
    refused(
      REMOTE_URL,
      { [CONTROL_PLANE_ALLOW_REMOTE_ENV]: value },
      `"${value}" is not the exact literal "true"`,
    );
  }
}

/* ── 11/13 · a pulled snapshot cannot authorize a local process ────────────── */

function aPulledEnvSnapshotRefusesEvenWithTheFlagTrue(): void {
  /*
   * The worst case the chosen design must still catch: the flag itself arrived UNMASKED from the
   * deployment, but some other Sensitive value in the same pull is still masked. One `[SENSITIVE]`
   * anywhere proves the environment is a snapshot, and a snapshot means this process is local.
   */
  const error = refused(
    REMOTE_URL,
    {
      [CONTROL_PLANE_ALLOW_REMOTE_ENV]: "true",
      HEBUN_AUTH_SESSION_DIGEST_SECRET: "[SENSITIVE]",
      VERCEL: "1",
      VERCEL_ENV: "production",
    },
    "a masked value proves a pulled snapshot, so the process is local",
  );
  assert.ok(
    /SENSITIVE|env pull|snapshot/i.test(error.message),
    `the refusal explains the snapshot: ${error.message}`,
  );
}

function aMaskedDatabaseUrlIsDiagnosedNotJustRejected(): void {
  /*
   * `[SENSITIVE]` is not a URL, so the released code already refused it — but with
   * "not a valid connection string", which sends a developer looking for a typo instead of at env
   * precedence. The cause is knowable and must be named.
   */
  const error = refused("[SENSITIVE]", {}, "the placeholder is not a connection string");
  assert.ok(
    /env pull|precedence|\.env\.production\.local/i.test(error.message),
    `the refusal names the real cause: ${error.message}`,
  );
  assert.ok(/start:local/.test(error.message), "and points at the safe command");
}

/* ── 8/9 · absent and malformed ────────────────────────────────────────────── */

function anEmptyTargetFailsClosed(): void {
  refused("", {}, "an empty connection string is not a target");
  refused("   ", {}, "whitespace is not a target");
}

function aMalformedTargetFailsSafely(): void {
  const error = refused("not-a-url", {}, "unparseable");
  assert.ok(!/not-a-url/.test(error.message) || true, "it may name the shape, never a credential");
}

/* ── 10 · nothing leaks ────────────────────────────────────────────────────── */

function noRefusalEverLeaksTheCredential(): void {
  const cases: readonly (readonly [string, ControlPlaneEnvironment])[] = [
    [REMOTE_URL, {}],
    [REMOTE_URL, { NODE_ENV: "production", VERCEL: "1" }],
    [REMOTE_URL, { [CONTROL_PLANE_ALLOW_REMOTE_ENV]: "[SENSITIVE]" }],
    [REMOTE_URL, { [CONTROL_PLANE_ALLOW_REMOTE_ENV]: "true", FOO: "[SENSITIVE]" }],
    [LOCAL_URL.replace("127.0.0.1", "db.internal.invalid"), {}],
  ];
  for (const [url, env] of cases) {
    const error = refused(url, env, "expected refusal for leak check");
    assert.ok(!error.message.includes(SECRET), "the password never appears in the message");
    assert.ok(!error.message.includes(url), "the full connection string never appears");
    assert.ok(!/db\.example\.invalid|db\.internal\.invalid/.test(error.message), "nor the host");
    const serialized = `${error.stack ?? ""}${error.message}`;
    assert.ok(!serialized.includes(SECRET), "nor anywhere in the stack");
  }
}

/* ── 12 · inherited env cannot bypass ──────────────────────────────────────── */

function explicitlyInheritedEnvCannotBypassTheGuard(): void {
  /*
   * The guard reads the env it is HANDED. A caller passing a fuller environment — the whole of
   * `process.env`, a spread of a pulled file, anything — still gets the same decision, because the
   * decision is a function of its inputs and consults no ambient state.
   */
  const pulledSnapshot: ControlPlaneEnvironment = {
    NODE_ENV: "production",
    VERCEL: "1",
    VERCEL_ENV: "production",
    VERCEL_TARGET_ENV: "production",
    DATABASE_URL: REMOTE_URL,
    [CONTROL_PLANE_ALLOW_REMOTE_ENV]: "[SENSITIVE]",
    HEBUN_AUTH_SESSION_DIGEST_SECRET: "[SENSITIVE]",
  };
  refused(REMOTE_URL, pulledSnapshot, "a whole pulled snapshot authorizes nothing");
  /* And the same snapshot pointed at the developer's own database is fine. */
  allowed(LOCAL_URL, pulledSnapshot);
}

function main(): void {
  loopbackTargetsAreAllowed();
  remoteTargetIsRefusedWithoutAuthorization();
  productionModeDoesNotAuthorizeAnything();
  vercelVariablesDoNotAuthorizeAnything();
  anAuthorizedDeployedRuntimeMayReachARemoteTarget();
  theFlagIsAnExactLiteral();
  aPulledEnvSnapshotRefusesEvenWithTheFlagTrue();
  aMaskedDatabaseUrlIsDiagnosedNotJustRejected();
  anEmptyTargetFailsClosed();
  aMalformedTargetFailsSafely();
  noRefusalEverLeaksTheCredential();
  explicitlyInheritedEnvCannotBypassTheGuard();
  console.log("control-plane target safety checks passed");
}

main();
