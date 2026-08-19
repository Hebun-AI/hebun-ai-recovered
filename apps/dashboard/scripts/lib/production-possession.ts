/*
 * Production deployment possession (G4) — the posture every production-capable ceremony resolves
 * before it opens a connection, and the target binding it must satisfy before it writes.
 *
 * ── WHAT THIS IS, AND WHAT IT IS NOT ─────────────────────────────────────────
 *
 * It is the SAME root of trust R4A, R4B, G2.1, D1.1 and R5.1 already rest on — possession of the
 * deployment — extended to name WHICH deployment is possessed. It introduces no second authority,
 * no platform principal, no operator identity, no role and no tenant. Possession remains a SOURCE
 * and never an ACTOR: nothing here produces an actor id, and nothing here writes `audit_log`.
 *
 * It does NOT grant tenant Governance, Knowledge authority, membership authority, or any
 * organizational capability. The Platform Operator owns the deployment; it does not own the
 * organization.
 *
 * ── WHY A SECOND SIGNAL, AND NOT `HEBUN_CONTROL_PLANE_ALLOW_REMOTE` ──────────
 *
 * G3 set `HEBUN_CONTROL_PLANE_ALLOW_REMOTE=true` in the Vercel production runtime so the Next.js
 * server may open a connection to a non-localhost control plane. That variable answers exactly one
 * question — MAY THIS PROCESS REACH A REMOTE DATABASE — and it is set on a long-lived web runtime
 * where it stays true for every request forever.
 *
 * A ceremony asks a different question: MAY THIS OPERATOR MUTATE PRODUCTION RIGHT NOW. Reusing the
 * reachability flag as the mutation authorization would mean that any environment already permitted
 * to *read* production is also permitted to *provision a tenant* in it, and that a `.env` file
 * copied from the running deployment silently carries constitutional authority. Reachability is not
 * authorization. They are kept apart on purpose.
 *
 * ── FAIL CLOSED, AND ONLY ON AN EXACT LITERAL ────────────────────────────────
 *
 * `HEBUN_PRODUCTION_CEREMONY` opens the production posture only when it is EXACTLY
 * `production-operator-ceremony` — the same wording the released G1 provenance vocabulary uses, so
 * the signal the operator types is the value the row will carry. Absent means local. Anything else
 * — `true`, `1`, `yes`, a case variant, a whitespace variant, an empty string — is a REFUSAL and
 * never a silent downgrade to local: an operator who tried to open production and mistyped it must
 * not quietly get a local ceremony instead.
 *
 * ── TARGET BINDING, AND WHY THE LEDGER IS NOT ENOUGH ─────────────────────────
 *
 * A valid credential pointed at the wrong PostgreSQL database is the failure this module exists to
 * prevent, and it is not hypothetical: the local canonical database and the hosted production
 * database carry the BYTE-IDENTICAL migration ledger — 32 rows, digest
 * `ca91a1fbc555e92c94e38e105b34a2a8` on both — because they are the same released schema. Measured,
 * not assumed. (It was 31 rows and `212559d1…` at G4; the digest tracks the RELEASE, which is the
 * whole point — it moved when G6D added a migration, and it moved on BOTH deployments.) So the ledger proves "this is a Hebun control plane at the released schema" and
 * proves NOTHING about which deployment it is. It is necessary and insufficient, and is checked as
 * a co-factor rather than as the binding.
 *
 * A hostname substring check is rejected for the same reason it is always rejected: it is a guess
 * about a string the operator already controls, and it would accept any database reachable at a
 * host that happens to match.
 *
 * The binding is `pg_control_system().system_identifier` — a 64-bit value written at `initdb` that
 * identifies the CLUSTER, cannot be set by a connection string, and is not derivable from a
 * credential. It was measured on both targets and they differ. Because a cluster may hold several
 * databases, `current_database()` is pinned beside it; the pair names the database, not the host
 * that happens to serve it.
 *
 * Both expected values are supplied OUT OF BAND by the operator and compared against what the live
 * server reports. That is a binding, not a heuristic: the ceremony cannot infer what the operator
 * meant, so it requires them to say it, and refuses on any disagreement.
 *
 * **A MISMATCH ALWAYS REFUSES.** If a provider ever regenerates a cluster identifier, this module
 * fails closed — a refusal an operator resolves by re-reading and re-pinning the value. The
 * asymmetry is deliberate: an unavailable ceremony is an inconvenience, an unbound one is a
 * production mutation against an unknown database.
 *
 * ── NO SCHEMA ────────────────────────────────────────────────────────────────
 *
 * G4 adds no table, no column, no constraint and no migration. Every value read here is either an
 * environment variable or a fact PostgreSQL already reports about itself.
 */
import type { Client } from "pg";

/** Opens the production posture. Exact literal only. */
export const PRODUCTION_CEREMONY_ENV = "HEBUN_PRODUCTION_CEREMONY";
/** The expected `pg_control_system().system_identifier` of the intended cluster. */
export const PRODUCTION_TARGET_SYSTEM_IDENTIFIER_ENV =
  "HEBUN_PRODUCTION_TARGET_SYSTEM_IDENTIFIER";
/** The expected `current_database()` of the intended database. */
export const PRODUCTION_TARGET_DATABASE_ENV = "HEBUN_PRODUCTION_TARGET_DATABASE";

/**
 * The only value that opens production, and deliberately the same string the released G1 vocabulary
 * writes into `companies.provisioning_source` / `genesis_nominations.nomination_source`. The
 * operator types the name of the root they are claiming.
 */
export const PRODUCTION_CEREMONY_SIGNAL = "production-operator-ceremony";

/** Roots, mirrored from the released schema vocabulary. Never widened here. */
export const CEREMONY_SOURCE_LOCAL = "local-operator-ceremony";
export const CEREMONY_SOURCE_PRODUCTION = "production-operator-ceremony";

export type CeremonySource = typeof CEREMONY_SOURCE_LOCAL | typeof CEREMONY_SOURCE_PRODUCTION;

/** Why a posture could not be resolved. Every one of these refuses; none downgrades to local. */
export type PostureRefusal =
  /** The signal is present but is not the exact literal. */
  | "malformed-ceremony-signal"
  /** Production was opened without both expected target values. */
  | "target-not-pinned"
  /** A pinned expected value is structurally invalid. */
  | "malformed-target";

export interface LocalPosture {
  readonly mode: "local";
  readonly source: typeof CEREMONY_SOURCE_LOCAL;
}

export interface ProductionPosture {
  readonly mode: "production";
  readonly source: typeof CEREMONY_SOURCE_PRODUCTION;
  readonly expected: {
    readonly systemIdentifier: string;
    readonly database: string;
  };
}

export type CeremonyPosture =
  | LocalPosture
  | ProductionPosture
  | { readonly mode: "refused"; readonly reason: PostureRefusal };

/** A cluster identifier is an unsigned 64-bit decimal. Bounds, not policy. */
const SYSTEM_IDENTIFIER_PATTERN = /^[0-9]{1,20}$/;
/** A PostgreSQL database name as `current_database()` reports it. */
const DATABASE_NAME_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_$-]{0,62}$/;

/**
 * Resolve the posture from the environment alone. No connection, no argument, no prompt.
 *
 * Absent signal → local, exactly as every ceremony behaved before G4.
 * Exact signal + both pins → production.
 * Anything else → refused.
 */
export function resolveCeremonyPosture(
  env: Readonly<Record<string, string | undefined>> = process.env,
): CeremonyPosture {
  const raw = env[PRODUCTION_CEREMONY_ENV];
  if (raw === undefined) {
    return Object.freeze({ mode: "local", source: CEREMONY_SOURCE_LOCAL } as const);
  }
  /*
   * Compared WITHOUT trimming and WITHOUT lowercasing. `" production-operator-ceremony"` is not the
   * signal; it is a mistake, and a mistake that opens production is not a mistake this module is
   * willing to forgive on the operator's behalf.
   */
  if (raw !== PRODUCTION_CEREMONY_SIGNAL) {
    return Object.freeze({ mode: "refused", reason: "malformed-ceremony-signal" } as const);
  }

  const systemIdentifier = env[PRODUCTION_TARGET_SYSTEM_IDENTIFIER_ENV];
  const database = env[PRODUCTION_TARGET_DATABASE_ENV];
  if (systemIdentifier === undefined || database === undefined) {
    return Object.freeze({ mode: "refused", reason: "target-not-pinned" } as const);
  }
  if (
    !SYSTEM_IDENTIFIER_PATTERN.test(systemIdentifier) ||
    !DATABASE_NAME_PATTERN.test(database)
  ) {
    return Object.freeze({ mode: "refused", reason: "malformed-target" } as const);
  }

  return Object.freeze({
    mode: "production",
    source: CEREMONY_SOURCE_PRODUCTION,
    expected: Object.freeze({ systemIdentifier, database }),
  } as const);
}

/**
 * Refuse anything that IS local while the operator claims to be in production.
 *
 * `new URL()` reports a bracketed IPv6 host WITH its brackets — `[::1]`, not `::1` — so a naive
 * membership test against the released list would have let `postgresql://…@[::1]:5432/…` through as
 * "not local". The brackets are stripped before the comparison. Found by a test, not by reading:
 * the released `assertLocalDatabaseUrl` has the same blind spot in the opposite direction, where it
 * errs SAFE (it refuses a bracketed loopback rather than accepting a remote one), so a bracketed
 * IPv6 URL is now refused in BOTH postures. That is coherent and fail-closed; correcting D1.1's
 * guard is a separate decision this gate did not take.
 */
export function assertNonLocalDatabaseUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("DATABASE_URL is not a valid connection string.");
  }
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  if (["127.0.0.1", "localhost", "::1"].includes(hostname)) {
    throw new Error(
      `refusing a production ceremony against a local database (${parsed.hostname}). ` +
        `Unset ${PRODUCTION_CEREMONY_ENV} to run the local ceremony instead.`,
    );
  }
}

/** Why a live target was not accepted. */
export type TargetRefusal =
  | "system-identifier-mismatch"
  | "database-mismatch"
  | "ledger-incomplete"
  | "ledger-unreadable";

export interface TargetObservation {
  readonly systemIdentifier: string;
  readonly database: string;
  readonly appliedMigrations: number;
}

export type TargetVerdict =
  | { readonly status: "bound"; readonly observed: TargetObservation }
  | {
      readonly status: "refused";
      readonly reason: TargetRefusal;
      readonly observed?: TargetObservation;
      readonly detail: string;
    };

/**
 * Compare the live server against what the operator pinned. READ ONLY — three selects, no
 * transaction, no write, and no dependence on any application table.
 *
 * `expectedMigrations` is the authored ledger length, supplied by the caller so this module never
 * reads the filesystem. A target whose applied count differs is refused: a ceremony must not write
 * a row shaped by a schema the target does not have.
 */
export async function verifyProductionTarget(
  client: Client,
  expected: ProductionPosture["expected"],
  expectedMigrations: number,
): Promise<TargetVerdict> {
  let observed: TargetObservation;
  try {
    const identity = await client.query<{ sid: string; db: string }>(
      `select system_identifier::text as sid, current_database() as db from pg_control_system()`,
    );
    const applied = await client.query<{ n: string }>(
      `select count(*)::text as n from drizzle.__drizzle_migrations`,
    );
    observed = {
      systemIdentifier: identity.rows[0]!.sid,
      database: identity.rows[0]!.db,
      appliedMigrations: Number(applied.rows[0]!.n),
    };
  } catch (error) {
    return {
      status: "refused",
      reason: "ledger-unreadable",
      detail:
        "the target did not answer the identity/ledger probe: " +
        (error instanceof Error ? error.message : String(error)),
    };
  }

  /*
   * IDENTIFIER FIRST. It is the only one of the three that a wrong-database mistake cannot
   * accidentally satisfy — two Hebun deployments share a database name and share a ledger, and
   * differ here.
   */
  if (observed.systemIdentifier !== expected.systemIdentifier) {
    return {
      status: "refused",
      reason: "system-identifier-mismatch",
      observed,
      detail:
        `this cluster reports system identifier ${observed.systemIdentifier}, but ` +
        `${PRODUCTION_TARGET_SYSTEM_IDENTIFIER_ENV} pins ${expected.systemIdentifier}. ` +
        "Nothing was read from any application table and nothing was written.",
    };
  }
  if (observed.database !== expected.database) {
    return {
      status: "refused",
      reason: "database-mismatch",
      observed,
      detail:
        `this connection is on database "${observed.database}", but ` +
        `${PRODUCTION_TARGET_DATABASE_ENV} pins "${expected.database}".`,
    };
  }
  if (observed.appliedMigrations !== expectedMigrations) {
    return {
      status: "refused",
      reason: "ledger-incomplete",
      observed,
      detail:
        `the target has ${observed.appliedMigrations} applied migrations and this checkout ` +
        `authored ${expectedMigrations}. Apply the outstanding migrations before any ceremony.`,
    };
  }

  return { status: "bound", observed };
}

/**
 * Human-readable posture line for the ceremony banner.
 *
 * It names the ROOT and never a person, because there is no person to name.
 */
export function describePosture(posture: LocalPosture | ProductionPosture): string {
  return posture.mode === "production"
    ? `PRODUCTION deployment possession — cluster ${posture.expected.systemIdentifier}, database ${posture.expected.database}`
    : "LOCAL deployment possession";
}
