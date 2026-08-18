/*
 * Ceremony preflight (G4) — the ONE validation path.
 *
 * ── WHY ONE PATH ─────────────────────────────────────────────────────────────
 *
 * A "dry run" that takes a different route than the real thing proves only that the dry run works.
 * So there is exactly one function here, `preflight()`, and execution is defined as *preflight that
 * did not refuse, followed by the write*. A ceremony cannot reach its write without having run this
 * first, because the CLI has no other way to obtain a bound target.
 *
 * ── ZERO MUTATION, STRUCTURALLY ──────────────────────────────────────────────
 *
 * Every statement issued from this module is a `select`. It opens no transaction, sets no session
 * state, creates no temporary object, and calls nothing that writes. That is asserted by a test over
 * this file's own source, not merely intended: a preflight that mutates is worse than no preflight,
 * because it is a mutation an operator was told would not happen.
 *
 * ── WHAT IT DOES NOT CHECK ───────────────────────────────────────────────────
 *
 * It answers "may this ceremony proceed against this target", never "should this tenant exist".
 * It reads no tenant-private data: the only application reads are an existence probe by slug and an
 * identity lookup by the email the operator typed — both already performed by the released
 * ceremonies before their own confirmation prompt, and neither of which returns organizational
 * content.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { Client } from "pg";
import {
  type CeremonyPosture,
  type LocalPosture,
  type ProductionPosture,
  type TargetObservation,
  assertNonLocalDatabaseUrl,
  describePosture,
  verifyProductionTarget,
} from "./production-possession";
import { assertLocalDatabaseUrl } from "./provision-dev-credential";

/** Where the authored migrations live, relative to this file. */
const MIGRATIONS_DIR = path.join(import.meta.dirname, "..", "..", "src", "db", "migrations");

/** How many migrations this checkout authored. The ledger the target must already carry. */
export function authoredMigrationCount(dir: string = MIGRATIONS_DIR): number {
  return readdirSync(dir).filter((entry) => entry.endsWith(".sql")).length;
}

/**
 * The provenance vocabulary the target's CHECK constraints admit.
 *
 * Read from the live catalogue rather than from the schema module, because the question is what THIS
 * DATABASE will accept — a target migrated to an older ledger would reject the production root, and
 * finding that out from a constraint violation mid-ceremony is finding it out too late.
 */
async function targetAdmitsSource(
  client: Client,
  table: string,
  constraint: string,
  source: string,
): Promise<boolean> {
  const result = await client.query<{ def: string }>(
    `select pg_get_constraintdef(c.oid) as def
       from pg_constraint c
       join pg_class t on t.oid = c.conrelid
      where t.relname = $1 and c.conname = $2`,
    [table, constraint],
  );
  const def = result.rows[0]?.def;
  return typeof def === "string" && def.includes(source);
}

export type PreflightRefusal =
  /** The posture itself could not be resolved (malformed signal, unpinned target). */
  | "posture-refused"
  /** DATABASE_URL is absent or unusable. */
  | "database-url"
  /** The URL's locality contradicts the posture. */
  | "locality"
  /** The live target is not the pinned one, or its ledger is not current. */
  | "target"
  /** The target's released vocabulary cannot express this posture's provenance. */
  | "provenance-unsupported";

export interface PreflightOk {
  readonly status: "ready";
  readonly posture: LocalPosture | ProductionPosture;
  readonly banner: string;
  /** Present only in production posture — nothing is observed about a local target. */
  readonly observed?: TargetObservation;
}

export interface PreflightRefused {
  readonly status: "refused";
  readonly reason: PreflightRefusal;
  readonly detail: string;
}

export type PreflightResult = PreflightOk | PreflightRefused;

/**
 * Resolve posture and prove the target, without connecting.
 *
 * Split from the connected half so a CLI can refuse a malformed posture before it spends a
 * connection, and so a refusal costs nothing.
 */
export function preflightEnvironment(
  posture: CeremonyPosture,
  databaseUrl: string | undefined,
): PreflightRefused | { readonly status: "ok"; readonly posture: LocalPosture | ProductionPosture } {
  if (posture.mode === "refused") {
    return {
      status: "refused",
      reason: "posture-refused",
      detail:
        posture.reason === "malformed-ceremony-signal"
          ? "HEBUN_PRODUCTION_CEREMONY is set but is not the exact production signal. It was NOT " +
            "treated as a local ceremony — an operator who meant production and mistyped it must " +
            "not silently get something else. Unset it, or set it exactly."
          : posture.reason === "target-not-pinned"
            ? "a production ceremony must pin its target: set both " +
              "HEBUN_PRODUCTION_TARGET_SYSTEM_IDENTIFIER and HEBUN_PRODUCTION_TARGET_DATABASE."
            : "a pinned target value is malformed. The system identifier is a decimal integer and " +
              "the database is a PostgreSQL identifier.",
    };
  }

  const trimmed = databaseUrl?.trim();
  if (!trimmed) {
    return {
      status: "refused",
      reason: "database-url",
      detail: "DATABASE_URL is not set.",
    };
  }

  try {
    if (posture.mode === "production") assertNonLocalDatabaseUrl(trimmed);
    else assertLocalDatabaseUrl(trimmed);
  } catch (error) {
    return {
      status: "refused",
      reason: "locality",
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  return { status: "ok", posture };
}

/**
 * The connected half. Read-only.
 *
 * In LOCAL posture this is a no-op beyond the banner: the released local guard already proved the
 * target is loopback, and G4 does not add friction to a ceremony it did not change.
 */
export async function preflight(
  client: Client,
  posture: LocalPosture | ProductionPosture,
  options: {
    readonly expectedMigrations?: number;
    /** Which provenance surface this ceremony writes, so the CHECK that matters is the one probed. */
    readonly provenance: "company" | "genesis" | "none";
  },
): Promise<PreflightResult> {
  const banner = describePosture(posture);

  if (posture.mode === "local") {
    return { status: "ready", posture, banner };
  }

  const verdict = await verifyProductionTarget(
    client,
    posture.expected,
    options.expectedMigrations ?? authoredMigrationCount(),
  );
  if (verdict.status === "refused") {
    return { status: "refused", reason: "target", detail: verdict.detail };
  }

  if (options.provenance !== "none") {
    const [table, constraint] =
      options.provenance === "company"
        ? (["companies", "companies_provisioning_source_chk"] as const)
        : (["genesis_nominations", "genesis_nominations_source_chk"] as const);
    const admits = await targetAdmitsSource(client, table, constraint, posture.source);
    if (!admits) {
      return {
        status: "refused",
        reason: "provenance-unsupported",
        detail:
          `the target's ${constraint} does not admit "${posture.source}". This database predates ` +
          "the released production provenance vocabulary; a ceremony must never record a root the " +
          "target cannot express.",
      };
    }
  }

  return { status: "ready", posture, banner, observed: verdict.observed };
}

/** Read a file relative to the dashboard root. Used by the standalone preflight report only. */
export function readRepoFile(relative: string): string {
  return readFileSync(path.join(import.meta.dirname, "..", "..", relative), "utf8");
}
