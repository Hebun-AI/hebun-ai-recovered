/*
 * backup-vault — BR-2 operator CLI. Runbook: docs/product-vision/runtime/hebun-backup-recovery-runbook.md
 *
 *   init-key     --key FILE
 *   backup-db    --url-env NAME --vault DIR --key FILE [--prune]
 *                (requires HEBUN_BACKUP_TARGET_SYSTEM_IDENTIFIER and HEBUN_BACKUP_TARGET_DATABASE)
 *   seal         --kind media-tar --in FILE --vault DIR --key FILE
 *   verify       --file FILE.hbk --key FILE
 *   open         --file FILE.hbk --key FILE --out FILE
 *   prune        --vault DIR --kind KIND --key FILE [--apply]
 *   restore-db   --file FILE.hbk --key FILE --target-url-env NAME     (loopback target only)
 *   seal-media   --in SNAPSHOT.tar --vault DIR --key FILE    (plaintext removed on success and failure)
 *   offsite-push  --vault DIR --kind KIND --key FILE --remote-dir DIR
 *   offsite-pull  --object NAME.hbk --key FILE --remote-dir DIR --out DIR
 *   offsite-prune --kind KIND --key FILE --remote-dir DIR [--apply]
 *
 * Off-site commands use the local-directory adapter only (`--remote-dir`); a real provider is a new
 * adapter and a Director gate.
 *
 * A connection string is read from the environment variable NAMED by the flag, never from argv, and
 * is never printed. `backup-db` proves the target's identity against the two pins above before any
 * dump. Every `--key` must live apart from the repository, the backup root, the vault and the off-site
 * directory, and outside synchronized locations (`assertKeyLocationSafe`).
 *
 * `offsite-push` verifies the LOCAL directory copy only. For a synchronized folder that is not proof
 * the cloud holds the file: each result carries `md5` so the copy can be checked independently in the
 * provider (for Google Drive, the file's `md5Checksum`) — the output says so in `cloudConfirmed: false`. Output is one JSON line: names, sizes, digests, key id — never content or keys.
 * Exit 0 on success, 1 on a refusal, 2 on a usage error.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  VAULT_KINDS,
  assertFreeSpace,
  assertKeyLocationSafe,
  decryptFile,
  encryptFile,
  generateKeyFile,
  loadKeyFile,
  pruneVault,
  vaultFileName,
  type VaultKind,
} from "./lib/backup-vault";
import { BACKUP_ROOT, backupDatabase, restoreFromVault } from "./lib/database-backup";
import { LocalDirectoryTransport, pruneOffsite, pullSealed, pushVault, sealMediaSnapshot } from "./lib/offsite-backup";

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");


function flags(argv: readonly string[]): Map<string, string | true> {
  const out = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith("--")) usage(`unexpected argument ${a}`);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) out.set(a.slice(2), true);
    else out.set(a.slice(2), argv[++i]!);
  }
  return out;
}

function usage(why: string): never {
  console.error(`backup-vault: ${why}`);
  process.exit(2);
}

function need(f: Map<string, string | true>, name: string): string {
  const v = f.get(name);
  if (typeof v !== "string") usage(`--${name} is required`);
  return v;
}

function fromEnv(f: Map<string, string | true>, flag: string): string {
  const name = need(f, flag);
  const value = process.env[name];
  if (!value) usage(`environment variable named by --${flag} is not set`);
  return value;
}

/** The `--key` path, refused unless it lives apart from everything it protects. */
function keyPath(f: Map<string, string | true>, ...alsoAvoid: (string | undefined)[]): string {
  const file = need(f, "key");
  assertKeyLocationSafe(file, [REPO_ROOT, BACKUP_ROOT, ...alsoAvoid.filter((x): x is string => !!x)]);
  return file;
}

function dirFlag(f: Map<string, string | true>, name: string): string | undefined {
  const v = f.get(name);
  return typeof v === "string" ? v : undefined;
}

function expectedTargetFromEnv(): { systemIdentifier: string; database: string } {
  const systemIdentifier = process.env.HEBUN_BACKUP_TARGET_SYSTEM_IDENTIFIER?.trim() ?? "";
  const database = process.env.HEBUN_BACKUP_TARGET_DATABASE?.trim() ?? "";
  if (!/^\d+$/.test(systemIdentifier) || database === "") {
    usage("backup-db requires HEBUN_BACKUP_TARGET_SYSTEM_IDENTIFIER (digits) and HEBUN_BACKUP_TARGET_DATABASE");
  }
  return { systemIdentifier, database };
}

function md5Of(file: string): string {
  return createHash("md5").update(readFileSync(file)).digest("hex");
}

function emit(result: Record<string, unknown>): void {
  console.log(JSON.stringify(result));
  if (result.status === "refused") process.exitCode = 1;
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const f = flags(rest);
  switch (command) {
    case "init-key":
      return emit({ status: "created", keyId: generateKeyFile(keyPath(f)).id });
    case "backup-db": {
      const r = await backupDatabase({
        connectionString: fromEnv(f, "url-env"),
        expectedTarget: expectedTargetFromEnv(),
        vaultDirectory: need(f, "vault"),
        key: loadKeyFile(keyPath(f, dirFlag(f, "vault"))),
        repositoryRoot: REPO_ROOT,
        prune: f.get("prune") === true,
      });
      return emit(r.status === "sealed" ? { status: r.status, file: r.file, header: r.header, pruned: r.pruned } : r);
    }
    case "seal": {
      const kind = need(f, "kind") as VaultKind;
      if (!VAULT_KINDS.includes(kind)) usage(`--kind must be one of ${VAULT_KINDS.join(", ")}`);
      const vault = need(f, "vault");
      assertFreeSpace(vault);
      const now = new Date();
      const input = need(f, "in");
      const file = path.join(vault, vaultFileName(kind, now));
      const header = encryptFile({ plaintext: input, target: file, key: loadKeyFile(keyPath(f, dirFlag(f, "vault"), dirFlag(f, "remote-dir"), dirFlag(f, "out"))), kind, name: path.basename(input), now });
      return emit({ status: "sealed", file, header });
    }
    case "verify":
      return emit({ status: "verified", header: decryptFile({ vault: need(f, "file"), key: loadKeyFile(keyPath(f, dirFlag(f, "vault"), dirFlag(f, "remote-dir"), dirFlag(f, "out"))) }) });
    case "open": {
      const out = need(f, "out");
      assertFreeSpace(path.dirname(path.resolve(out)));
      return emit({ status: "opened", out, header: decryptFile({ vault: need(f, "file"), key: loadKeyFile(keyPath(f, dirFlag(f, "vault"), dirFlag(f, "remote-dir"), dirFlag(f, "out"))), target: out }) });
    }
    case "prune": {
      const kind = need(f, "kind") as VaultKind;
      if (!VAULT_KINDS.includes(kind)) usage(`--kind must be one of ${VAULT_KINDS.join(", ")}`);
      return emit({ status: f.get("apply") === true ? "pruned" : "dry-run", ...pruneVault({ directory: need(f, "vault"), kind, key: loadKeyFile(keyPath(f, dirFlag(f, "vault"), dirFlag(f, "remote-dir"), dirFlag(f, "out"))), apply: f.get("apply") === true }) });
    }
    case "restore-db": {
      const r = restoreFromVault({ vault: need(f, "file"), key: loadKeyFile(keyPath(f, dirFlag(f, "vault"), dirFlag(f, "remote-dir"), dirFlag(f, "out"))), targetUrl: fromEnv(f, "target-url-env") });
      return emit(r.status === "refused" ? { status: r.status, reason: r.reason, detail: r.detail } : { status: r.status, elapsedMs: r.elapsedMs });
    }
    case "seal-media": {
      const vault = need(f, "vault");
      assertFreeSpace(vault);
      const keyFile = keyPath(f, vault);
      return emit(sealMediaSnapshot({ snapshot: need(f, "in"), vaultDirectory: vault, key: loadKeyFile(keyFile), keyFile }));
    }
    case "offsite-push": {
      const kind = need(f, "kind") as VaultKind;
      if (!VAULT_KINDS.includes(kind)) usage(`--kind must be one of ${VAULT_KINDS.join(", ")}`);
      const vaultDir = need(f, "vault");
      const results = await pushVault({ directory: vaultDir, kind, key: loadKeyFile(keyPath(f, vaultDir, dirFlag(f, "remote-dir"))), transport: new LocalDirectoryTransport(need(f, "remote-dir")) });
      return emit({
        status: results.some((r) => r.status === "refused") ? "refused" : "pushed",
        /* The local directory copy is verified; whether a sync client delivered it is not. */
        cloudConfirmed: false,
        results: results.map((r) => (r.status === "refused" ? r : { ...r, md5: md5Of(path.join(vaultDir, r.object)) })),
      });
    }
    case "offsite-pull": {
      const r = await pullSealed({ object: need(f, "object"), key: loadKeyFile(keyPath(f, dirFlag(f, "vault"), dirFlag(f, "remote-dir"), dirFlag(f, "out"))), transport: new LocalDirectoryTransport(need(f, "remote-dir")), outDirectory: need(f, "out") });
      return emit(r.status === "pulled" ? { status: r.status, file: r.file, header: r.header } : r);
    }
    case "offsite-prune": {
      const kind = need(f, "kind") as VaultKind;
      if (!VAULT_KINDS.includes(kind)) usage(`--kind must be one of ${VAULT_KINDS.join(", ")}`);
      const r = await pruneOffsite({ transport: new LocalDirectoryTransport(need(f, "remote-dir")), kind, key: loadKeyFile(keyPath(f, dirFlag(f, "vault"), dirFlag(f, "remote-dir"), dirFlag(f, "out"))), workDirectory: tmpdir(), apply: f.get("apply") === true });
      return emit("status" in r ? r : { status: f.get("apply") === true ? "pruned" : "dry-run", ...r });
    }
    default:
      usage("command must be init-key, backup-db, seal, seal-media, verify, open, prune, restore-db, offsite-push, offsite-pull or offsite-prune");
  }
}

main().catch((error: unknown) => {
  const code = (error as { code?: string }).code;
  console.log(JSON.stringify({ status: "refused", reason: code ?? "error", detail: (error as Error).message }));
  process.exitCode = 1;
});
