/*
 * canonical-migrations.ts — THE CANONICAL LEDGER, AND WHAT A TARGET'S LEDGER MUST BE.
 *
 * ── WHY A COUNT IS NOT ENOUGH ────────────────────────────────────────────────
 *
 * The released possession module proves a target is current by comparing the APPLIED COUNT against
 * the AUTHORED COUNT. That is the right check for a ceremony that writes a row, and it is far too
 * weak to authorize a migration, because a count cannot distinguish:
 *
 *   - a target missing migration 12 from a target missing migration 34;
 *   - a target whose migration 20 was applied from a FILE THAT WAS LATER EDITED;
 *   - a target carrying somebody else's migration 30 in place of ours.
 *
 * All three read as "n applied". Only the per-migration hash separates them, so this module
 * compares hashes, in order, and the count falls out as a consequence rather than standing in as
 * evidence.
 *
 * ── THE ENGINE CANNOT DO THIS FOR US, AND THAT IS THE POINT ──────────────────
 *
 * Drizzle's migrator decides what is pending from ONE row:
 *
 *     select id, hash, created_at from drizzle.__drizzle_migrations order by created_at desc limit 1
 *     ... if (!last || Number(last.created_at) < migration.folderMillis) apply it
 *
 * It reads the NEWEST applied timestamp and nothing else. It never verifies that the applied
 * history is the authored history. So a target missing a migration in the MIDDLE is silently left
 * broken — the gap is never filled, because every authored migration older than the newest applied
 * one is skipped. And a target carrying a divergent migration with a newer timestamp causes the
 * engine to apply NOTHING and report success.
 *
 * That is not a defect to route around; it is a division of labour. The engine applies authored
 * migrations. Deciding whether this target is one the engine may safely be pointed at is THIS
 * module's job, and it must be done BEFORE the engine is invoked, because afterwards is too late.
 *
 * ── WHY AN EXACT PREFIX MAKES DELEGATION SOUND ───────────────────────────────
 *
 * Once the applied ledger is proven to be an exact prefix of the canonical one, and the canonical
 * `when` values are proven strictly increasing, the engine's timestamp rule and this module's
 * index rule select THE SAME SET: everything after the last applied entry. The pending set this
 * module reports is therefore not a parallel calculation that could drift from what actually runs —
 * it is the same set, derived two ways, and both preconditions are asserted rather than assumed.
 *
 * ── ZERO MUTATION ────────────────────────────────────────────────────────────
 *
 * Every statement issued here is a `select`. This module opens no transaction, applies nothing, and
 * reads no application table — only `drizzle.__drizzle_migrations`.
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { Client } from "pg";

/** Where the authored migrations live, relative to this file. */
export const MIGRATIONS_DIR = path.join(import.meta.dirname, "..", "..", "src", "db", "migrations");

/** One authored migration, in canonical order. */
export interface CanonicalMigration {
  /** Position in the journal, zero-based — the ledger index this migration occupies. */
  readonly index: number;
  /** The journal tag, which is also the `.sql` basename. */
  readonly tag: string;
  /** `_journal.json`'s `when`, which the engine stores as `created_at`. */
  readonly when: number;
  /** sha256 of the file's bytes — exactly what the engine stores as `hash`. */
  readonly hash: string;
}

/** Why the authored ledger could not be read as canonical. Each one is a repository defect. */
export type CanonicalRefusal =
  | "journal-unreadable"
  | "journal-file-mismatch"
  | "journal-not-monotonic"
  | "journal-index-broken";

export class CanonicalLedgerError extends Error {
  constructor(
    readonly reason: CanonicalRefusal,
    message: string,
  ) {
    super(message);
    this.name = "CanonicalLedgerError";
  }
}

/**
 * Read the authored ledger, in the order the ENGINE reads it.
 *
 * The journal is the ordering authority, not the directory listing: `readMigrationFiles` iterates
 * `_journal.json` entries, so a `.sql` with no journal entry is invisible to the engine while still
 * being counted by a `readdir`. The two are cross-checked here rather than trusted, because a
 * ceremony that reports "36 authored" while the engine can see 35 is lying in the direction that
 * matters.
 */
export function readCanonicalMigrations(dir: string = MIGRATIONS_DIR): readonly CanonicalMigration[] {
  let entries: readonly { idx: number; when: number; tag: string }[];
  try {
    const journal = JSON.parse(readFileSync(path.join(dir, "meta", "_journal.json"), "utf8")) as {
      entries: { idx: number; when: number; tag: string }[];
    };
    entries = journal.entries;
    if (!Array.isArray(entries)) throw new Error("entries is not an array");
  } catch (error) {
    throw new CanonicalLedgerError(
      "journal-unreadable",
      `the migration journal could not be read: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  /* The journal and the directory must describe the same set — in both directions. */
  const onDisk = new Set(
    readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => f.replace(/\.sql$/, "")),
  );
  const tagged = new Set(entries.map((e) => e.tag));
  const missingFile = entries.filter((e) => !onDisk.has(e.tag)).map((e) => e.tag);
  const missingEntry = [...onDisk].filter((t) => !tagged.has(t));
  if (missingFile.length > 0 || missingEntry.length > 0) {
    throw new CanonicalLedgerError(
      "journal-file-mismatch",
      "the journal and the migration directory disagree." +
        (missingFile.length > 0 ? ` Journal entries with no .sql: ${missingFile.join(", ")}.` : "") +
        (missingEntry.length > 0
          ? ` .sql files with no journal entry (INVISIBLE to the migration engine): ${missingEntry.join(", ")}.`
          : ""),
    );
  }

  /* `idx` must be contiguous from zero, or "the ledger index" is not a position. */
  const brokenIdx = entries.findIndex((e, i) => e.idx !== i);
  if (brokenIdx !== -1) {
    throw new CanonicalLedgerError(
      "journal-index-broken",
      `journal entry ${brokenIdx} ("${entries[brokenIdx]!.tag}") declares idx ${entries[brokenIdx]!.idx}.`,
    );
  }

  /*
   * STRICTLY INCREASING `when` — the precondition that makes delegating to the engine sound. If two
   * migrations shared a timestamp, or one went backwards, the engine's `created_at <` rule would
   * select a different set than the index rule below, and this module's report would stop
   * describing what actually runs.
   */
  const backwards = entries.findIndex((e, i) => i > 0 && !(e.when > entries[i - 1]!.when));
  if (backwards !== -1) {
    throw new CanonicalLedgerError(
      "journal-not-monotonic",
      `journal timestamps are not strictly increasing at "${entries[backwards]!.tag}" ` +
        `(${entries[backwards]!.when} does not follow ${entries[backwards - 1]!.when}). ` +
        "The migration engine selects pending work by timestamp, so this would make the pending " +
        "set ambiguous.",
    );
  }

  return Object.freeze(
    entries.map((entry, index) =>
      Object.freeze({
        index,
        tag: entry.tag,
        when: entry.when,
        /* `utf8`, matching the engine's `readFileSync(...).toString()` byte-for-byte. */
        hash: createHash("sha256").update(readFileSync(path.join(dir, `${entry.tag}.sql`), "utf8")).digest("hex"),
      }),
    ),
  );
}

/**
 * The ledger digest, by the method the repository already documents:
 *
 *     md5(string_agg(hash, ',' order by created_at, id))
 *
 * It identifies a RELEASE and never a deployment — two deployments at the same release share it.
 * It is reported so an operator can check it by hand; it is never the binding.
 */
export function canonicalDigest(migrations: readonly { readonly hash: string }[]): string {
  return createHash("md5").update(migrations.map((m) => m.hash).join(",")).digest("hex");
}

/** One row of the target's applied ledger. */
export interface AppliedMigration {
  readonly hash: string;
  readonly createdAt: number;
}

export type PrefixRefusal =
  /** The target's ledger could not be read at all. */
  | "ledger-unreadable"
  /** The target has MORE applied migrations than this checkout authored. */
  | "ledger-ahead"
  /** The target's history is not an exact prefix of the canonical one. */
  | "ledger-diverged";

export type PrefixVerdict =
  | {
      /** Applied history is an exact prefix, and there is work to do. */
      readonly status: "pending";
      readonly applied: number;
      readonly pending: readonly CanonicalMigration[];
      readonly finalDigest: string;
    }
  | {
      /** Applied history is exactly the canonical ledger. Nothing to apply. */
      readonly status: "converged";
      readonly applied: number;
      readonly digest: string;
    }
  | {
      readonly status: "refused";
      readonly reason: PrefixRefusal;
      readonly detail: string;
      readonly applied?: number;
    };

/** Read the target's applied ledger, in engine order. READ ONLY. */
export async function readAppliedLedger(client: Client): Promise<readonly AppliedMigration[]> {
  const result = await client.query<{ hash: string; created_at: string | null }>(
    `select hash, created_at::text as created_at
       from drizzle.__drizzle_migrations
      order by created_at asc, id asc`,
  );
  return result.rows.map((row) => ({ hash: row.hash, createdAt: Number(row.created_at) }));
}

/**
 * IS THIS TARGET'S SCHEMA HISTORY A PREFIX OF MINE? The question a migration ceremony must answer
 * before it may point the engine at a database.
 *
 * A prefix — not a count, and not a subset. Every applied migration must be the canonical migration
 * at that same position, by hash AND by timestamp. Hash catches an edited or substituted file;
 * timestamp catches a target whose ordering would make the engine select a different pending set
 * than the one this ceremony is about to show a human.
 */
export async function verifyCanonicalMigrationPrefix(
  client: Client,
  canonical: readonly CanonicalMigration[],
): Promise<PrefixVerdict> {
  let applied: readonly AppliedMigration[];
  try {
    applied = await readAppliedLedger(client);
  } catch (error) {
    return {
      status: "refused",
      reason: "ledger-unreadable",
      detail:
        "the target's migration ledger could not be read: " +
        (error instanceof Error ? error.message : String(error)),
    };
  }

  /*
   * AHEAD IS ALWAYS A REFUSAL, never a no-op. A target holding migrations this checkout does not
   * have is running a LATER release; migrating it would mean an older repository asserting
   * authority over a newer database, and the honest response is to stop and go look at why.
   */
  if (applied.length > canonical.length) {
    return {
      status: "refused",
      reason: "ledger-ahead",
      applied: applied.length,
      detail:
        `the target has ${applied.length} applied migrations and this checkout authored ` +
        `${canonical.length}. The target is AHEAD of this repository — it is running a later ` +
        "release. Nothing was applied. Update this checkout before migrating anything.",
    };
  }

  for (let i = 0; i < applied.length; i += 1) {
    const there = applied[i]!;
    /*
     * `here` MAY BE ABSENT, and the loop must survive it rather than dereference `undefined`.
     * The ahead-check above already returns for that case, so this is unreachable today — which is
     * exactly why it is written defensively: a guard whose only protection is another guard above
     * it turns a future edit into a crash instead of a refusal, and a crash mid-ceremony is the
     * least informative way this code could fail.
     */
    const here = canonical[i];
    if (!here || there.hash !== here.hash || there.createdAt !== here.when) {
      return {
        status: "refused",
        reason: "ledger-diverged",
        applied: applied.length,
        detail:
          `the target's migration history diverges from this repository at ledger position ${i} ` +
          `(canonical "${here?.tag ?? "— this repository has no migration at that position"}"). ` +
          (!here
            ? "This repository authors nothing at that position. "
            : there.hash !== here.hash
              ? `The applied migration's hash is ${there.hash.slice(0, 16)}… and this checkout's is ` +
                `${here.hash.slice(0, 16)}… — the same position holds different SQL, which means an ` +
                "already-applied migration file was edited, or this is a different lineage. "
              : `The applied migration's timestamp is ${there.createdAt} and this checkout's is ` +
                `${here.when}. `) +
          "Nothing was applied. This is not something a migration can repair.",
      };
    }
  }

  if (applied.length === canonical.length) {
    return { status: "converged", applied: applied.length, digest: canonicalDigest(canonical) };
  }

  return {
    status: "pending",
    applied: applied.length,
    pending: canonical.slice(applied.length),
    finalDigest: canonicalDigest(canonical),
  };
}
