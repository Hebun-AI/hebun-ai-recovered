/*
 * restore-drill.ts — BR-1: PROVE A BACKUP RESTORES, ON A DISPOSABLE LOCAL TARGET.
 *
 * A backup is validated today by `pg_restore -l`, which reads the archive's table of contents and
 * restores nothing. This module performs the restore: it loads an archive into an EMPTY database on
 * a LOOPBACK instance, then compares what came back with what went in.
 *
 * It takes no part in producing the archive (that stays `createValidatedBackup`) and it imports
 * nothing from the migration mechanics. It never connects to a remote host: every URL it is given
 * must be loopback, checked before any tool runs. The password, if any, reaches `pg_restore` through
 * its environment, never its argv.
 *
 * What the comparison proves, stated exactly: the migration ledger, the schema's shape (columns,
 * constraints, indexes; a CHECK by name and columns only, because pg_dump/restore re-deparses a CHECK
 * expression into equivalent but different text, e.g. `(ARRAY[...])::text[]` becomes
 * `ARRAY[(...)::text]`), the exact row count of every table in `public` and `drizzle`, the tenant
 * count, and that every foreign key exists and is validated in the target. Row CONTENT is not
 * compared — a count would not notice an edited row — and nothing here prints a row.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { statfsSync } from "node:fs";
import { Client } from "pg";

const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1"]);

/** A restore drill never leaves this machine. */
export function assertLoopbackUrl(connectionString: string): URL {
  const url = new URL(connectionString);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!LOOPBACK.has(host)) throw new Error("restore drill refuses a non-loopback target");
  return url;
}

/** libpq environment for a loopback target; the URL never reaches argv. */
function libpqEnv(connectionString: string): NodeJS.ProcessEnv {
  const url = assertLoopbackUrl(connectionString);
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith("PG")) delete env[key];
  env.PGHOST = url.hostname.replace(/^\[|\]$/g, "");
  env.PGDATABASE = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (url.port) env.PGPORT = url.port;
  if (url.username) env.PGUSER = decodeURIComponent(url.username);
  if (url.password) env.PGPASSWORD = decodeURIComponent(url.password);
  return env;
}

/** Free bytes on the filesystem holding `directory`. */
export function freeBytes(directory: string): number {
  const s = statfsSync(directory);
  return Number(s.bavail) * Number(s.bsize);
}

/** The restore drill's default floor: it refuses below 3 GiB free (Package 4 discovery). */
export const DEFAULT_FREE_SPACE_FLOOR = 3 * 1024 ** 3;

export interface DatabaseSnapshot {
  /** `drizzle.__drizzle_migrations` as (hash, created_at) in id order; null when the table is absent. */
  readonly ledger: readonly string[] | null;
  /** sha256 over columns, constraints and indexes of the `public` and `drizzle` schemas. */
  readonly schemaDigest: string;
  /** Exact `count(*)` per table, keyed `schema.table`. */
  readonly rowCounts: Readonly<Record<string, number>>;
  /** Rows in `companies` (the tenant table); null when it is absent. */
  readonly tenants: number | null;
  /** Foreign keys present, and how many of them are NOT validated. */
  readonly foreignKeys: number;
  readonly unvalidatedForeignKeys: number;
}

const SCHEMAS = ["public", "drizzle"];

/** READ ONLY. Every identifier queried comes from the catalog, quoted with `format('%I')`. */
export async function snapshotDatabase(connectionString: string): Promise<DatabaseSnapshot> {
  assertLoopbackUrl(connectionString);
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const ledgerPresent = await client.query<{ n: number }>(
      `select count(*)::int as n from information_schema.tables
        where table_schema = 'drizzle' and table_name = '__drizzle_migrations'`,
    );
    const ledger =
      ledgerPresent.rows[0]!.n === 0
        ? null
        : (
            await client.query<{ row: string }>(
              `select hash || ':' || created_at::text as row from drizzle.__drizzle_migrations order by id`,
            )
          ).rows.map((r) => r.row);

    const shape = await client.query<{ line: string }>(
      `select line from (
         select format('col %s.%s.%s %s %s %s', table_schema, table_name, column_name, data_type,
                       is_nullable, coalesce(column_default, '')) as line
           from information_schema.columns where table_schema = any($1)
         union all
         select format('con %s.%s %s %s', n.nspname, c.conname, c.contype,
                       case when c.contype = 'c' then c.conkey::text else pg_get_constraintdef(c.oid) end)
           from pg_constraint c join pg_namespace n on n.oid = c.connamespace where n.nspname = any($1)
         union all
         select format('idx %s.%s %s', schemaname, indexname, indexdef)
           from pg_indexes where schemaname = any($1)
       ) s order by line`,
      [SCHEMAS],
    );
    const schemaDigest = createHash("sha256")
      .update(shape.rows.map((r) => r.line).join("\n"))
      .digest("hex");

    const tables = await client.query<{ schema: string; name: string }>(
      `select table_schema as schema, table_name as name from information_schema.tables
        where table_schema = any($1) and table_type = 'BASE TABLE' order by 1, 2`,
      [SCHEMAS],
    );
    const rowCounts: Record<string, number> = {};
    for (const t of tables.rows) {
      const ident = await client.query<{ q: string }>(`select format('%I.%I', $1::text, $2::text) as q`, [t.schema, t.name]);
      const counted = await client.query<{ n: string }>(`select count(*)::text as n from ${ident.rows[0]!.q}`);
      rowCounts[`${t.schema}.${t.name}`] = Number(counted.rows[0]!.n);
    }

    const fk = await client.query<{ total: number; unvalidated: number }>(
      `select count(*)::int as total, count(*) filter (where not c.convalidated)::int as unvalidated
         from pg_constraint c join pg_namespace n on n.oid = c.connamespace
        where c.contype = 'f' and n.nspname = any($1)`,
      [SCHEMAS],
    );

    return Object.freeze({
      ledger,
      schemaDigest,
      rowCounts: Object.freeze(rowCounts),
      tenants: rowCounts["public.companies"] ?? null,
      foreignKeys: fk.rows[0]!.total,
      unvalidatedForeignKeys: fk.rows[0]!.unvalidated,
    });
  } finally {
    await client.end();
  }
}

export type SnapshotDifference =
  | { readonly kind: "ledger-absent" }
  | { readonly kind: "ledger"; readonly source: number; readonly target: number }
  | { readonly kind: "schema" }
  | { readonly kind: "row-count"; readonly table: string; readonly source: number | null; readonly target: number | null }
  | { readonly kind: "tenants"; readonly source: number | null; readonly target: number | null }
  | { readonly kind: "foreign-keys"; readonly source: number; readonly target: number; readonly unvalidated: number };

/** Every way `target` differs from `source`. Empty means the restore reproduced the source. */
export function compareSnapshots(source: DatabaseSnapshot, target: DatabaseSnapshot): SnapshotDifference[] {
  const out: SnapshotDifference[] = [];
  if (source.ledger !== null && target.ledger === null) out.push({ kind: "ledger-absent" });
  else if (JSON.stringify(source.ledger) !== JSON.stringify(target.ledger)) {
    out.push({ kind: "ledger", source: source.ledger?.length ?? 0, target: target.ledger?.length ?? 0 });
  }
  if (source.schemaDigest !== target.schemaDigest) out.push({ kind: "schema" });
  for (const table of new Set([...Object.keys(source.rowCounts), ...Object.keys(target.rowCounts)])) {
    const a = source.rowCounts[table] ?? null;
    const b = target.rowCounts[table] ?? null;
    if (a !== b) out.push({ kind: "row-count", table, source: a, target: b });
  }
  if (source.tenants !== target.tenants) out.push({ kind: "tenants", source: source.tenants, target: target.tenants });
  if (source.foreignKeys !== target.foreignKeys || target.unvalidatedForeignKeys !== 0) {
    out.push({
      kind: "foreign-keys",
      source: source.foreignKeys,
      target: target.foreignKeys,
      unvalidated: target.unvalidatedForeignKeys,
    });
  }
  return out;
}

export type RestoreResult =
  | { readonly status: "restored"; readonly elapsedMs: number }
  | { readonly status: "refused"; readonly reason: "disk-below-floor" | "restore-failed"; readonly detail: string };

/**
 * Restore `archive` into the EMPTY loopback database `targetUrl`, in one transaction, stopping on the
 * first error. Refuses before running anything when `workDirectory`'s filesystem is below `floorBytes`.
 */
export function restoreArchive(options: {
  readonly archive: string;
  readonly targetUrl: string;
  readonly workDirectory: string;
  readonly floorBytes?: number;
}): RestoreResult {
  const env = libpqEnv(options.targetUrl);
  const floor = options.floorBytes ?? DEFAULT_FREE_SPACE_FLOOR;
  const free = freeBytes(options.workDirectory);
  if (free < floor) {
    return {
      status: "refused",
      reason: "disk-below-floor",
      detail: `${free} bytes free, floor is ${floor}; nothing was restored`,
    };
  }
  const started = process.hrtime.bigint();
  try {
    execFileSync(
      "pg_restore",
      ["--no-owner", "--no-privileges", "--exit-on-error", "--single-transaction", "--no-password", "--dbname", env.PGDATABASE!, options.archive],
      { env, stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 },
    );
  } catch (error) {
    const stderr = (error as { stderr?: Buffer | string }).stderr;
    return { status: "refused", reason: "restore-failed", detail: String(stderr ?? (error as Error).message).trim() };
  }
  return { status: "restored", elapsedMs: Number(process.hrtime.bigint() - started) / 1e6 };
}
