/*
 * database-backup.ts — BR-2: ONE SCHEDULED DATABASE BACKUP, SEALED; AND ITS VERIFIED RESTORE.
 *
 * `backupDatabase` is the unit a scheduler runs: free-space floor → `createValidatedBackup` (the
 * ceremony's own pg_dump: TLS verify-full for a remote host, version check, `pg_restore -l`) into a
 * private 0700 scratch directory → `encryptFile` into the vault → a full decrypt-verify of the sealed
 * file against the dump's digest → the plaintext dump is deleted. Only the sealed `.hbk` survives.
 *
 * `restoreFromVault` refuses to hand pg_restore anything unauthenticated: the vault file is decrypted
 * into a private scratch directory and accepted only when its tag and digest verify; then BR-1's
 * `restoreArchive` loads it — into a LOOPBACK database only.
 *
 * It imports from the migration module only the named backup helpers the firewall allows. It prints
 * nothing; the connection string never reaches argv or a log.
 *
 * IDENTITY BEFORE ANY DUMP. `backupDatabase` takes the expected target identity (system identifier
 * and database name, the same pins the production ceremonies use) and proves it with the released
 * read-only probe `verifyProductionIdentity` before pg_dump runs. A wrong or unprovable target is a
 * refusal and the vault is untouched. The probe needs no privilege beyond `pg_control_system()` and a
 * read of the migration ledger, so it works for a read-only backup role.
 *
 * Every refusal detail is passed through `redactConnection`: pg and pg_dump messages can name the
 * host or user, and a result is printed by the CLI and kept in a log.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "pg";
import { BACKUP_ROOT, createValidatedBackup, readServerVersion } from "./production-migration";

/** Where production backups live; a vault key is never kept under it. */
export { BACKUP_ROOT };
import { restoreArchive, type RestoreResult } from "./restore-drill";
import { verifyProductionIdentity } from "./production-possession";
import {
  BACKUP_FREE_SPACE_FLOOR,
  assertFreeSpace,
  decryptFile,
  encryptFile,
  ensurePrivateDirectory,
  pruneVault,
  vaultFileName,
  type RetentionPolicy,
  type VaultHeader,
  type VaultKey,
} from "./backup-vault";

export type DatabaseBackupResult =
  | { readonly status: "sealed"; readonly file: string; readonly header: VaultHeader; readonly pruned: readonly string[] }
  | { readonly status: "refused"; readonly reason: string; readonly detail: string };

/** Remove the URL and each of its parts (user, password, host) from a message before it is reported. */
export function redactConnection(detail: string, connectionString: string): string {
  let out = detail;
  const parts: string[] = [connectionString];
  try {
    const url = new URL(connectionString);
    for (const p of [url.password, url.username, url.hostname, url.host]) if (p) parts.push(decodeURIComponent(p), p);
  } catch {
    /* not a URL: only the whole string is removed */
  }
  for (const p of parts.filter((x) => x.length >= 3).sort((a, b) => b.length - a.length)) out = out.split(p).join("<redacted>");
  return out;
}

export interface ExpectedBackupTarget {
  /** `pg_control_system().system_identifier` of the database that must be backed up. */
  readonly systemIdentifier: string;
  /** `current_database()` of that database. */
  readonly database: string;
}

export async function backupDatabase(options: {
  readonly connectionString: string;
  /** Required: no backup runs against a target whose identity is not proven first. */
  readonly expectedTarget: ExpectedBackupTarget;
  readonly vaultDirectory: string;
  readonly key: VaultKey;
  readonly repositoryRoot: string;
  readonly workRoot?: string;
  readonly floorBytes?: number;
  readonly retention?: RetentionPolicy;
  readonly prune?: boolean;
  readonly now?: Date;
}): Promise<DatabaseBackupResult> {
  const result = await backupDatabaseUnredacted(options);
  return result.status === "refused" ? { ...result, detail: redactConnection(result.detail, options.connectionString) } : result;
}

async function backupDatabaseUnredacted(options: Parameters<typeof backupDatabase>[0]): Promise<DatabaseBackupResult> {
  const floor = options.floorBytes ?? BACKUP_FREE_SPACE_FLOOR;
  const workRoot = options.workRoot ?? tmpdir();
  try {
    ensurePrivateDirectory(options.vaultDirectory);
    assertFreeSpace(options.vaultDirectory, floor);
    assertFreeSpace(workRoot, floor);
  } catch (error) {
    return { status: "refused", reason: "disk-below-floor", detail: (error as Error).message };
  }

  const client = new Client({ connectionString: options.connectionString });
  let version;
  try {
    await client.connect();
    const identity = await verifyProductionIdentity(client, options.expectedTarget);
    if (identity.status !== "bound") return { status: "refused", reason: `identity-${identity.reason}`, detail: identity.detail };
    version = await readServerVersion(client);
  } catch (error) {
    return { status: "refused", reason: "connect-failed", detail: (error as Error).message };
  } finally {
    await client.end().catch(() => undefined);
  }
  if (version.status !== "parsed") return { status: "refused", reason: "server-version", detail: JSON.stringify(version) };

  const scratch = mkdtempSync(path.join(workRoot, "hebun-backup-"));
  try {
    const now = options.now ?? new Date();
    const dump = createValidatedBackup({
      connectionString: options.connectionString,
      serverVersion: version.version,
      directory: scratch,
      filename: "database.dump",
      repositoryRoot: options.repositoryRoot,
    });
    if (dump.status !== "created") return { status: "refused", reason: `dump-${dump.reason}`, detail: dump.detail };

    const file = path.join(options.vaultDirectory, vaultFileName("postgres-custom", now));
    let header: VaultHeader;
    try {
      header = encryptFile({ plaintext: dump.file, target: file, key: options.key, kind: "postgres-custom", name: "database.dump", now });
    } catch (error) {
      /* encryptFile removes its own part file; an existing vault file is never ours to delete. */
      return { status: "refused", reason: "seal-failed", detail: (error as Error).message };
    }
    try {
      /* The sealed file is read back in full and must authenticate before the backup counts. */
      decryptFile({ vault: file, key: options.key });
    } catch (error) {
      rmSync(file, { force: true });
      return { status: "refused", reason: "seal-failed", detail: (error as Error).message };
    }

    const pruned = options.prune
      ? pruneVault({ directory: options.vaultDirectory, kind: "postgres-custom", key: options.key, policy: options.retention, apply: true }).deleted
      : [];
    return { status: "sealed", file, header, pruned };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

export type VaultRestoreResult =
  | RestoreResult
  | { readonly status: "refused"; readonly reason: "vault-rejected" | "wrong-kind"; readonly detail: string };

/** Authenticate, then restore into an EMPTY loopback database. Nothing unverified reaches pg_restore. */
export function restoreFromVault(options: {
  readonly vault: string;
  readonly key: VaultKey;
  readonly targetUrl: string;
  readonly workRoot?: string;
  readonly floorBytes?: number;
}): VaultRestoreResult {
  const workRoot = options.workRoot ?? tmpdir();
  try {
    assertFreeSpace(workRoot, options.floorBytes ?? BACKUP_FREE_SPACE_FLOOR);
  } catch (error) {
    return { status: "refused", reason: "disk-below-floor", detail: (error as Error).message };
  }
  const scratch = mkdtempSync(path.join(workRoot, "hebun-restore-"));
  try {
    const dump = path.join(scratch, "database.dump");
    let header: VaultHeader;
    try {
      header = decryptFile({ vault: options.vault, key: options.key, target: dump });
    } catch (error) {
      return { status: "refused", reason: "vault-rejected", detail: (error as Error).message };
    }
    if (header.kind !== "postgres-custom") return { status: "refused", reason: "wrong-kind", detail: header.kind };
    return restoreArchive({ archive: dump, targetUrl: options.targetUrl, workDirectory: scratch, floorBytes: options.floorBytes ?? BACKUP_FREE_SPACE_FLOOR });
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}
