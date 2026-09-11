/*
 * Control-plane database client (server-only).
 *
 * R1 — Durable Foundations. This is the FIRST live database connection in the
 * repository. It backs the identity / session / membership control plane
 * (companies, users, auth_identities, memberships, user_session_contexts) that
 * the collection-oriented `SupabasePostgresAdapter` intentionally does not cover.
 *
 * It is the SAME Drizzle schema, the SAME `pg` driver and the SAME authored
 * migrations as the persistence adapter — not a second persistence framework.
 *
 * Discipline:
 * - Server only. Never import from client code.
 * - Local-first. Refuses a non-localhost target unless the runtime is explicitly
 *   authorized (see `assertControlPlaneTargetAllowed`).
 * - Fail closed. When DATABASE_URL is unset, `getControlPlaneDb()` throws; it
 *   NEVER silently substitutes an in-memory store, and never rewrites a target.
 *
 * ── PRODUCTION MODE IS NOT PRODUCTION DEPLOYMENT ────────────────────────────
 *
 * `next start` runs Next in production mode, and production mode loads
 * `.env.production.local` ABOVE `.env.local`. `vercel env pull` writes that file,
 * so a developer's checkout can hold the deployment's entire environment shape —
 * `DATABASE_URL` and `HEBUN_CONTROL_PLANE_ALLOW_REMOTE` included. A local process
 * is still a local process no matter what its environment claims, so neither
 * `NODE_ENV` nor `VERCEL`/`VERCEL_ENV` is consulted here: `vercel env pull`
 * writes the latter two verbatim, and a guard keyed on them is defeated on a
 * laptop.
 *
 * `scripts/lib/production-possession.ts` already drew this line for ceremony
 * AUTHORIZATION, warning that "a `.env` file copied from the running deployment
 * silently carries constitutional authority". Reachability was left on a bare
 * flag because, when that was written, only the deployment could hold it.
 * `vercel env pull` ended that assumption; this module closes the other half.
 */

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export const CONTROL_PLANE_DATABASE_URL_ENV = "DATABASE_URL";
export const CONTROL_PLANE_ALLOW_REMOTE_ENV = "HEBUN_CONTROL_PLANE_ALLOW_REMOTE";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/**
 * The literal `vercel env pull` writes in place of every value the project marks Sensitive.
 *
 * A REAL deployment holds the real values and never this placeholder. Its presence anywhere in an
 * environment is therefore positive proof that the environment is a PULLED SNAPSHOT — which means
 * the process reading it is a developer's machine wearing the deployment's clothes.
 */
const VERCEL_SENSITIVE_PLACEHOLDER = "[SENSITIVE]";

/** Where a developer is sent. Named once so the guard and package.json cannot drift apart. */
const SAFE_LOCAL_COMMAND = "npm run start:local";

/**
 * WHY `.env.production.local` IS THE HAZARD, IN ONE PARAGRAPH.
 *
 * `next start` runs Next in PRODUCTION MODE, and in production mode Next loads
 * `.env.production.local` ABOVE `.env.local`. `vercel env pull` writes that file, so a checkout can
 * hold the deployment's whole environment shape. Measured during SOC-UI1 acceptance: a plain
 * `next start` could not resolve a session that the SAME build resolved immediately once
 * `.env.local` was exported into the process first.
 */
const PRECEDENCE_EXPLANATION =
  "Next.js loads `.env.production.local` ABOVE `.env.local` in production mode, and " +
  "`vercel env pull` writes that file — so `next start` can silently adopt the deployment's " +
  `environment instead of yours. Use \`${SAFE_LOCAL_COMMAND}\`, which exports \`.env.local\` into ` +
  "the process first so it wins.";

/**
 * `new URL(...).hostname` returns an IPv6 literal WITH brackets — "[::1]", not "::1".
 *
 * The allowlist above was written without them, so an IPv6 loopback database was classified as
 * REMOTE and refused. That failed closed and was therefore harmless, but it was wrong: it is a local
 * database and always was.
 */
function normalizeHost(hostname: string): string {
  return hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
}

/**
 * The environment shape this module reads.
 *
 * Deliberately the same permissive record `resolveCeremonyPosture` accepts, rather than
 * `NodeJS.ProcessEnv`: a guard must be callable with an arbitrary environment in a test without
 * having to satisfy ambient Node typings that demand `NODE_ENV` — the one variable this module
 * makes a point of never consulting.
 */
export type ControlPlaneEnvironment = Readonly<Record<string, string | undefined>>;

/** True when this environment is a `vercel env pull` snapshot, i.e. this process is LOCAL. */
function isPulledEnvSnapshot(env: ControlPlaneEnvironment): boolean {
  for (const value of Object.values(env)) {
    if (value === VERCEL_SENSITIVE_PLACEHOLDER) return true;
  }
  return false;
}

/**
 * What the connection is given before it is opened.
 *
 * ── WHY `connectionTimeoutMillis` IS 5000 AND NOT 2000 ──────────────────────
 *
 * On 2026-09-11 the hourly observation cron fired at 09:00:18Z and returned 503. `ScanResult` has
 * exactly two variants, and the route returns 503 only for the non-`scanned` one, so the meaning is
 * not a guess: the authorization register could not be read, and NOTHING was attempted. The scan
 * aborted on its FIRST database operation, against a pool that had just been constructed — before
 * the cadence gate, before any authorization was resolved, before any provider was contacted. One
 * observation cycle was lost to a connection that never opened.
 *
 * Measured the same morning against the production database, six consecutive connect-plus-`select 1`
 * round trips: 1086, 461, 436, 419, 407, 354 ms. The FIRST cost 1086ms against a database that was
 * already awake — 54% of the entire 2000ms budget. Production is a serverless Postgres that suspends
 * when idle, and a genuinely cold wake is the tail beyond that first sample. The 2000ms figure was
 * chosen when every target was a local Postgres.
 *
 * 5000 is BORROWED, not invented: `canonical-read/config.ts` already sets `statementTimeoutMs: 5000`
 * as this repository's budget for "a database operation may take this long", and a connection is a
 * database operation. It is ~4.6x the measured warm first connect, and it stays below the 10_000ms
 * each released provider transport allows for a single network call — so a failing connect cannot
 * dominate an invocation that still has three authorizations to scan. It elapses only on failure.
 *
 * ── WHY `idleTimeoutMillis` IS UNCHANGED ────────────────────────────────────
 *
 * Evaluated, and deliberately left alone. The observed failure was on a FRESH pool's first connect;
 * no connection had yet been idle, so the idle window cannot have contributed to it. Raising it
 * would address a different and so far unobserved problem, and this change fixes the failure that
 * actually happened.
 */
export const CONTROL_PLANE_POOL_SETTINGS = Object.freeze({
  max: 4,
  idleTimeoutMillis: 1000,
  connectionTimeoutMillis: 5000,
});

export type ControlPlaneDatabase = NodePgDatabase<typeof schema>;

export interface ControlPlaneHandle {
  readonly db: ControlPlaneDatabase;
  dispose(): Promise<void>;
}

export class ControlPlaneUnavailableError extends Error {
  readonly code = "AUTH_DATABASE_UNAVAILABLE";
  constructor(detail: string) {
    super(detail);
    this.name = "ControlPlaneUnavailableError";
  }
}

function assertServerRuntime(): void {
  if (typeof window !== "undefined") {
    throw new ControlPlaneUnavailableError(
      "The control-plane database client is server-only.",
    );
  }
}

/**
 * May THIS process open a connection to THIS control-plane target?
 *
 * ── PRODUCTION MODE IS NOT PRODUCTION DEPLOYMENT ────────────────────────────
 *
 * `NODE_ENV` is never consulted here: it says how a process COMPILES, not where it RUNS. Neither is
 * `VERCEL` nor `VERCEL_ENV` — `vercel env pull` writes both verbatim into `.env.production.local`
 * (`VERCEL="1"`, `VERCEL_ENV="production"`), so a guard keyed on either is already defeated on a
 * laptop. The tests assert that they grant nothing, precisely because they look like they should.
 *
 * ── NOTHING IN A MESSAGE BELOW COMES FROM THE URL ───────────────────────────
 *
 * No password, no host, no database name, no connection string — a refusal a developer pastes into
 * a chat must not carry a credential with it. What the messages carry instead is the REMEDIATION,
 * which is the part that was actually missing.
 *
 * Exported so the invariant can be tested without constructing a pool, and so no caller needs to
 * reimplement it. This is the ONE classification path; there is no second environment authority.
 */
export function assertControlPlaneTargetAllowed(
  connectionString: string,
  env: ControlPlaneEnvironment = process.env,
): void {
  const trimmed = connectionString.trim();
  if (!trimmed) {
    throw new ControlPlaneUnavailableError(
      "A control-plane connection string is required.",
    );
  }

  /*
   * THE PLACEHOLDER IS A DIAGNOSIS, NOT A TYPO. The released code already refused this string —
   * it is not a URL — but as "not a valid connection string", which sends a developer hunting for a
   * mistake they did not make. `[SENSITIVE]` has exactly one cause, and naming it turns a confusing
   * failure into an instruction.
   */
  if (trimmed === VERCEL_SENSITIVE_PLACEHOLDER) {
    throw new ControlPlaneUnavailableError(
      `DATABASE_URL is the literal \`${VERCEL_SENSITIVE_PLACEHOLDER}\` placeholder that ` +
        "`vercel env pull` writes for a value marked Sensitive, so a generated " +
        `\`.env.production.local\` is in effect. ${PRECEDENCE_EXPLANATION}`,
    );
  }

  let target: URL;
  try {
    target = new URL(trimmed);
  } catch {
    throw new ControlPlaneUnavailableError(
      "DATABASE_URL is not a valid connection string.",
    );
  }

  /* A loopback target is always allowed, whatever else the environment looks like. */
  if (LOCAL_HOSTS.has(normalizeHost(target.hostname))) return;

  /*
   * ── A SNAPSHOT CANNOT AUTHORIZE ITSELF ────────────────────────────────────
   *
   * Checked BEFORE the flag, and that order is the whole protection. The hazard is not a developer
   * who sets the flag on purpose; it is a developer who runs `next start` and inherits the flag,
   * the URL and the deployment's entire env from a file they never opened. One masked value proves
   * the environment came out of `vercel env pull`, and a pulled environment is by definition being
   * read somewhere other than the deployment that produced it.
   */
  if (isPulledEnvSnapshot(env)) {
    throw new ControlPlaneUnavailableError(
      "Refusing a non-local control-plane target: this environment contains " +
        `\`${VERCEL_SENSITIVE_PLACEHOLDER}\` values, which only a \`vercel env pull\` snapshot has ` +
        "— so this process is local, whatever the environment claims. " +
        `${CONTROL_PLANE_ALLOW_REMOTE_ENV} cannot authorize a remote database from a pulled ` +
        `snapshot. ${PRECEDENCE_EXPLANATION}`,
    );
  }

  /*
   * THE EXACT LITERAL, AND NOTHING ELSE. Not trimmed, not lowercased, not coerced — the same
   * discipline `resolveCeremonyPosture` applies to its own signal, and for the same reason.
   * `Boolean(env[...])` here would make the string "[SENSITIVE]" truthy and open the hazard.
   */
  if (env[CONTROL_PLANE_ALLOW_REMOTE_ENV] === "true") return;

  throw new ControlPlaneUnavailableError(
    "Refusing a non-local control-plane target: this process is not authorized to reach a remote " +
      `database. ${CONTROL_PLANE_ALLOW_REMOTE_ENV} must be exactly "true", which the deployed ` +
      `runtime sets. If you are running locally, ${PRECEDENCE_EXPLANATION}`,
  );
}

function assertAllowedTarget(
  connectionString: string,
  env: ControlPlaneEnvironment,
): void {
  assertControlPlaneTargetAllowed(connectionString, env);
}

/** True only when a control-plane connection string is present. */
export function isControlPlaneConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(env[CONTROL_PLANE_DATABASE_URL_ENV]?.trim());
}

/**
 * Build an isolated control-plane handle for an explicit connection string.
 * Used by tests (disposable database) and by the process singleton below.
 */
export interface ControlPlaneDbDeps {
  /**
   * Pool constructor seam. Present so a test can observe WHAT THE CONNECTION WAS GIVEN, and so the
   * "a refused target never reaches a pool" invariant is provable by the pool never being built —
   * something no source-scanning test could establish. Production passes nothing and gets `pg`.
   */
  readonly createPool?: (config: Record<string, unknown>) => Pool;
}

export function createControlPlaneDb(
  connectionString: string,
  env: ControlPlaneEnvironment = process.env,
  deps: ControlPlaneDbDeps = {},
): ControlPlaneHandle {
  assertServerRuntime();
  const trimmed = connectionString.trim();
  if (!trimmed) {
    throw new ControlPlaneUnavailableError(
      "A control-plane connection string is required.",
    );
  }
  /* THE GUARD RUNS FIRST, so a refused target never reaches the pool below. */
  assertAllowedTarget(trimmed, env);
  const config = {
    connectionString: trimmed,
    ...CONTROL_PLANE_POOL_SETTINGS,
    application_name: "hebun-control-plane",
  };
  const pool = deps.createPool ? deps.createPool(config) : new Pool(config);
  const db = drizzle(pool, { schema });
  return {
    db,
    async dispose(): Promise<void> {
      await pool.end();
    },
  };
}

let singleton: ControlPlaneHandle | undefined;

/**
 * Process-level control-plane database. Fail-closed: throws when DATABASE_URL is
 * unset rather than degrading to memory. The connection is created lazily on
 * first use.
 */
export function getControlPlaneDb(
  env: NodeJS.ProcessEnv = process.env,
): ControlPlaneDatabase {
  assertServerRuntime();
  const connectionString = env[CONTROL_PLANE_DATABASE_URL_ENV]?.trim();
  if (!connectionString) {
    throw new ControlPlaneUnavailableError(
      `${CONTROL_PLANE_DATABASE_URL_ENV} is not configured; durable identity ` +
        "persistence is unavailable and must not fall back to memory.",
    );
  }
  if (!singleton) {
    singleton = createControlPlaneDb(connectionString, env);
  }
  return singleton.db;
}

/** Dispose the process singleton (test teardown / graceful shutdown). */
export async function disposeControlPlaneDb(): Promise<void> {
  if (singleton) {
    const handle = singleton;
    singleton = undefined;
    await handle.dispose();
  }
}
