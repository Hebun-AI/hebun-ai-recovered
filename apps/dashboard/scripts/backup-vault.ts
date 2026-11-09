/*
 * backup-vault — BR-2 operator CLI. Runbook: docs/product-vision/runtime/hebun-backup-recovery-runbook.md
 *
 *   init-key     --key FILE
 *   backup-db    --url-env NAME --vault DIR --key FILE [--prune]
 *   seal         --kind media-tar --in FILE --vault DIR --key FILE
 *   verify       --file FILE.hbk --key FILE
 *   open         --file FILE.hbk --key FILE --out FILE
 *   prune        --vault DIR --kind KIND --key FILE [--apply]
 *   restore-db   --file FILE.hbk --key FILE --target-url-env NAME     (loopback target only)
 *
 * A connection string is read from the environment variable NAMED by the flag, never from argv, and
 * is never printed. Output is one JSON line: names, sizes, digests, key id — never content or keys.
 * Exit 0 on success, 1 on a refusal, 2 on a usage error.
 */
import path from "node:path";
import {
  VAULT_KINDS,
  assertFreeSpace,
  decryptFile,
  encryptFile,
  generateKeyFile,
  loadKeyFile,
  pruneVault,
  vaultFileName,
  type VaultKind,
} from "./lib/backup-vault";
import { backupDatabase, restoreFromVault } from "./lib/database-backup";

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

function emit(result: Record<string, unknown>): void {
  console.log(JSON.stringify(result));
  if (result.status === "refused") process.exitCode = 1;
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const f = flags(rest);
  switch (command) {
    case "init-key":
      return emit({ status: "created", keyId: generateKeyFile(need(f, "key")).id });
    case "backup-db": {
      const r = await backupDatabase({
        connectionString: fromEnv(f, "url-env"),
        vaultDirectory: need(f, "vault"),
        key: loadKeyFile(need(f, "key")),
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
      const header = encryptFile({ plaintext: input, target: file, key: loadKeyFile(need(f, "key")), kind, name: path.basename(input), now });
      return emit({ status: "sealed", file, header });
    }
    case "verify":
      return emit({ status: "verified", header: decryptFile({ vault: need(f, "file"), key: loadKeyFile(need(f, "key")) }) });
    case "open": {
      const out = need(f, "out");
      assertFreeSpace(path.dirname(path.resolve(out)));
      return emit({ status: "opened", out, header: decryptFile({ vault: need(f, "file"), key: loadKeyFile(need(f, "key")), target: out }) });
    }
    case "prune": {
      const kind = need(f, "kind") as VaultKind;
      if (!VAULT_KINDS.includes(kind)) usage(`--kind must be one of ${VAULT_KINDS.join(", ")}`);
      return emit({ status: f.get("apply") === true ? "pruned" : "dry-run", ...pruneVault({ directory: need(f, "vault"), kind, key: loadKeyFile(need(f, "key")), apply: f.get("apply") === true }) });
    }
    case "restore-db": {
      const r = restoreFromVault({ vault: need(f, "file"), key: loadKeyFile(need(f, "key")), targetUrl: fromEnv(f, "target-url-env") });
      return emit(r.status === "refused" ? { status: r.status, reason: r.reason, detail: r.detail } : { status: r.status, elapsedMs: r.elapsedMs });
    }
    default:
      usage("command must be init-key, backup-db, seal, verify, open, prune or restore-db");
  }
}

main().catch((error: unknown) => {
  const code = (error as { code?: string }).code;
  console.log(JSON.stringify({ status: "refused", reason: code ?? "error", detail: (error as Error).message }));
  process.exitCode = 1;
});
