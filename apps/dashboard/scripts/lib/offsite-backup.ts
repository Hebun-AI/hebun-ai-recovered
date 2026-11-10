/*
 * offsite-backup.ts — BR-2: SEALED BACKUPS TO AN OFF-SITE DESTINATION, AND BACK.
 *
 * Provider-independent. A destination is an `OffsiteTransport`: five operations on whole objects
 * named by vault file name. The only adapter here is `LocalDirectoryTransport`, a directory standing
 * in for the remote — development and tests. A real provider is a new adapter and a Director gate
 * (cost, location, credential); nothing in this module chooses or contacts one.
 *
 * Rules, each enforced here rather than trusted to an adapter:
 *   - ONLY SEALED FILES LEAVE. A push accepts a vault file name (`<kind>-<UTC>.hbk`) whose contents
 *     authenticate with the vault key. Anything else — a plaintext dump, a snapshot, the key itself —
 *     is refused before the transport is called.
 *   - VERIFIED AFTER TRANSFER. The remote object's size and SHA-256 must equal the local file's, or
 *     the attempt failed: the object just written is removed and the push retried.
 *   - IDEMPOTENT. A remote object with the same name and digest is "already-present"; one with the same
 *     name and a DIFFERENT digest is a conflict and is never overwritten.
 *   - SAFE RETRIES. Transient transport errors are retried with backoff, a bounded number of times.
 *     A conflict or a refusal is not retried.
 *   - RESTORE TRUSTS NOTHING REMOTE. A pulled object is checked against the remote digest, then
 *     authenticated with the key, in a private directory, before it is handed back.
 *   - RETENTION KEEPS A RECOVERABLE BACKUP. Off-site pruning downloads and authenticates every object
 *     it will keep before it deletes anything; if one does not verify, nothing is deleted.
 *   - NO KEY IN TRANSIT OR IN LOGS. The key never reaches a transport or a result; results carry names,
 *     sizes, digests and the key id only.
 */
import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  openSync,
  readSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  unlinkSync,
} from "node:fs";
import path from "node:path";
import {
  DEFAULT_RETENTION,
  VAULT_FILE_RE,
  VaultError,
  decryptFile,
  encryptFile,
  ensurePrivateDirectory,
  planRetention,
  vaultFileName,
  type RetentionPolicy,
  type VaultHeader,
  type VaultKey,
  type VaultKind,
} from "./backup-vault";

export interface RemoteObject {
  readonly bytes: number;
  readonly sha256: string;
}

/** A destination. Every method works on whole objects; `put` must not expose a partial object. */
export interface OffsiteTransport {
  readonly name: string;
  head(object: string): Promise<RemoteObject | null>;
  put(localFile: string, object: string): Promise<void>;
  get(object: string, localTarget: string): Promise<void>;
  list(): Promise<string[]>;
  delete(object: string): Promise<void>;
}

export function sha256File(file: string): RemoteObject {
  const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const hash = createHash("sha256");
    const buf = Buffer.alloc(1024 * 1024);
    let bytes = 0;
    for (let n; (n = readSync(fd, buf, 0, buf.length, null)) > 0; ) {
      hash.update(buf.subarray(0, n));
      bytes += n;
    }
    return { bytes, sha256: hash.digest("hex") };
  } finally {
    closeSync(fd);
  }
}

/** A directory standing in for a remote. Objects are written as `.part` and renamed, 0600. */
export class LocalDirectoryTransport implements OffsiteTransport {
  readonly name = "local-directory";
  constructor(private readonly root: string) {
    ensurePrivateDirectory(root);
  }
  private at(object: string): string {
    if (!VAULT_FILE_RE.test(object)) throw new VaultError("not-a-vault", `refused object name ${object}`);
    return path.join(this.root, object);
  }
  async head(object: string) {
    const p = this.at(object);
    return existsSync(p) ? sha256File(p) : null;
  }
  async put(localFile: string, object: string) {
    const target = this.at(object);
    const part = `${target}.part`;
    rmSync(part, { force: true });
    try {
      copyFileSync(localFile, part, constants.COPYFILE_EXCL);
      renameSync(part, target);
    } finally {
      rmSync(part, { force: true });
    }
  }
  async get(object: string, localTarget: string) {
    copyFileSync(this.at(object), localTarget, constants.COPYFILE_EXCL);
  }
  async list() {
    return readdirSync(this.root).filter((n) => VAULT_FILE_RE.test(n)).sort();
  }
  async delete(object: string) {
    rmSync(this.at(object), { force: true });
  }
}

export interface RetryPolicy {
  readonly attempts: number;
  readonly baseDelayMs: number;
  readonly sleep?: (ms: number) => Promise<void>;
}
export const DEFAULT_RETRY: RetryPolicy = Object.freeze({ attempts: 4, baseDelayMs: 1000 });
const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

class NotRetryable extends Error {}

async function withRetry<T>(policy: RetryPolicy, body: (attempt: number) => Promise<T>): Promise<{ value: T; attempts: number }> {
  const sleep = policy.sleep ?? realSleep;
  let last: unknown;
  for (let attempt = 1; attempt <= Math.max(1, policy.attempts); attempt++) {
    try {
      return { value: await body(attempt), attempts: attempt };
    } catch (error) {
      if (error instanceof NotRetryable || error instanceof VaultError) throw error;
      last = error;
      if (attempt < policy.attempts) await sleep(policy.baseDelayMs * 2 ** (attempt - 1));
    }
  }
  throw last;
}

export type PushResult =
  | { readonly status: "uploaded" | "already-present"; readonly object: string; readonly bytes: number; readonly sha256: string; readonly attempts: number; readonly keyId: string }
  | { readonly status: "refused"; readonly object: string; readonly reason: "not-sealed" | "remote-conflict" | "transfer-failed"; readonly detail: string };

/** Push one sealed vault file. Authenticated first; verified after; never overwrites a different object. */
export async function pushSealed(options: {
  readonly file: string;
  readonly key: VaultKey;
  readonly transport: OffsiteTransport;
  readonly retry?: RetryPolicy;
}): Promise<PushResult> {
  const object = path.basename(options.file);
  let header: VaultHeader;
  try {
    if (!VAULT_FILE_RE.test(object)) throw new VaultError("not-a-vault", "only vault file names may leave this host");
    if (!lstatSync(options.file).isFile()) throw new VaultError("not-a-vault", "not a regular file");
    header = decryptFile({ vault: options.file, key: options.key });
  } catch (error) {
    return { status: "refused", object, reason: "not-sealed", detail: (error as Error).message };
  }
  const local = sha256File(options.file);
  try {
    const { value, attempts } = await withRetry(options.retry ?? DEFAULT_RETRY, async () => {
      const before = await options.transport.head(object);
      if (before) {
        if (before.sha256 === local.sha256 && before.bytes === local.bytes) return "already-present" as const;
        throw new NotRetryable(`remote ${object} exists with a different digest; it is never overwritten`);
      }
      await options.transport.put(options.file, object);
      const after = await options.transport.head(object);
      if (!after || after.sha256 !== local.sha256 || after.bytes !== local.bytes) {
        /* We wrote it and it is wrong: remove what we wrote, then let the retry decide. */
        await options.transport.delete(object);
        throw new Error(`remote ${object} does not match after transfer`);
      }
      return "uploaded" as const;
    });
    return { status: value, object, bytes: local.bytes, sha256: local.sha256, attempts, keyId: header.keyId };
  } catch (error) {
    return {
      status: "refused",
      object,
      reason: error instanceof NotRetryable ? "remote-conflict" : "transfer-failed",
      detail: (error as Error).message,
    };
  }
}

/** Push every vault file of `kind` in `directory`, oldest first. Stops at the first refusal. */
export async function pushVault(options: {
  readonly directory: string;
  readonly kind: VaultKind;
  readonly key: VaultKey;
  readonly transport: OffsiteTransport;
  readonly retry?: RetryPolicy;
}): Promise<PushResult[]> {
  const names = readdirSync(options.directory).filter((n) => VAULT_FILE_RE.exec(n)?.[1] === options.kind).sort();
  const out: PushResult[] = [];
  for (const n of names) {
    const r = await pushSealed({ file: path.join(options.directory, n), key: options.key, transport: options.transport, retry: options.retry });
    out.push(r);
    if (r.status === "refused") break;
  }
  return out;
}

export type PullResult =
  | { readonly status: "pulled"; readonly file: string; readonly header: VaultHeader }
  | { readonly status: "refused"; readonly reason: "absent" | "digest-mismatch" | "vault-rejected" | "transfer-failed"; readonly detail: string };

/**
 * Fetch `object` into `outDirectory` (0700) as a vault file that has been checked against the
 * remote digest AND authenticated. On any refusal nothing is left in `outDirectory`.
 */
export async function pullSealed(options: {
  readonly object: string;
  readonly key: VaultKey;
  readonly transport: OffsiteTransport;
  readonly outDirectory: string;
  readonly retry?: RetryPolicy;
}): Promise<PullResult> {
  ensurePrivateDirectory(options.outDirectory);
  const final = path.join(options.outDirectory, options.object);
  if (existsSync(final)) return { status: "refused", reason: "transfer-failed", detail: `${final} already exists` };
  const staging = mkdtempSync(path.join(options.outDirectory, ".pull-"));
  try {
    const tmp = path.join(staging, options.object);
    let remote: RemoteObject | null = null;
    try {
      await withRetry(options.retry ?? DEFAULT_RETRY, async () => {
        rmSync(tmp, { force: true });
        remote = await options.transport.head(options.object);
        if (!remote) throw new NotRetryable("absent");
        await options.transport.get(options.object, tmp);
      });
    } catch (error) {
      const absent = error instanceof NotRetryable;
      return { status: "refused", reason: absent ? "absent" : "transfer-failed", detail: (error as Error).message };
    }
    const local = sha256File(tmp);
    const r = remote as RemoteObject | null;
    if (!r || local.sha256 !== r.sha256 || local.bytes !== r.bytes) {
      return { status: "refused", reason: "digest-mismatch", detail: "downloaded bytes differ from the remote digest" };
    }
    let header: VaultHeader;
    try {
      header = decryptFile({ vault: tmp, key: options.key });
    } catch (error) {
      return { status: "refused", reason: "vault-rejected", detail: (error as Error).message };
    }
    renameSync(tmp, final);
    return { status: "pulled", file: final, header };
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

/**
 * Off-site retention for one kind. Every object to be KEPT is pulled and authenticated first; if any
 * fails, nothing is deleted. The newest object is always kept (planRetention), so the destination can
 * never be pruned down to no recoverable backup.
 */
export async function pruneOffsite(options: {
  readonly transport: OffsiteTransport;
  readonly kind: VaultKind;
  readonly key: VaultKey;
  readonly workDirectory: string;
  readonly policy?: RetentionPolicy;
  readonly apply: boolean;
}): Promise<{ keep: string[]; prune: string[]; deleted: string[] } | { status: "refused"; reason: string; detail: string }> {
  const names = (await options.transport.list()).filter((n) => VAULT_FILE_RE.exec(n)?.[1] === options.kind);
  const plan = planRetention(names, options.policy ?? DEFAULT_RETENTION);
  const scratch = mkdtempSync(path.join(options.workDirectory, "hebun-offsite-verify-"));
  try {
    for (const name of plan.keep) {
      const pulled = await pullSealed({ object: name, key: options.key, transport: options.transport, outDirectory: scratch, retry: { attempts: 2, baseDelayMs: 0 } });
      if (pulled.status !== "pulled") {
        return { status: "refused", reason: `kept-object-unverified:${pulled.reason}`, detail: `${name}: ${pulled.detail}; nothing deleted` };
      }
      unlinkSync(pulled.file);
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  const deleted: string[] = [];
  if (options.apply) {
    for (const name of plan.prune) {
      await options.transport.delete(name);
      deleted.push(name);
    }
  }
  return { ...plan, deleted };
}

/**
 * Seal a plaintext media snapshot and REMOVE THE PLAINTEXT, on success and on failure alike. The
 * snapshot must be owner-only before it is read; the key file may never be sealed as a snapshot.
 */
export function sealMediaSnapshot(options: {
  readonly snapshot: string;
  readonly vaultDirectory: string;
  readonly key: VaultKey;
  readonly keyFile: string;
  readonly now?: Date;
}): { status: "sealed"; file: string; header: VaultHeader } | { status: "refused"; reason: string; detail: string } {
  /* Decided BEFORE the try: a refusal here must NOT delete the file, because it is the key. */
  const sameFile = (a: string, b: string) => {
    try {
      const x = lstatSync(a), y = lstatSync(b);
      return x.dev === y.dev && x.ino === y.ino;
    } catch {
      return false;
    }
  };
  if (sameFile(options.snapshot, options.keyFile) || (existsSync(options.snapshot) && existsSync(options.keyFile) && realpathSync(options.snapshot) === realpathSync(options.keyFile))) {
    return { status: "refused", reason: "key-not-sealable", detail: "the vault key is never sealed into a backup" };
  }
  try {
    const st = lstatSync(options.snapshot);
    if (!st.isFile()) return { status: "refused", reason: "snapshot-invalid", detail: "not a regular file" };
    if ((st.mode & 0o077) !== 0) return { status: "refused", reason: "snapshot-unsafe", detail: `mode ${(st.mode & 0o777).toString(8)}, must be owner-only` };
    const now = options.now ?? new Date();
    const file = path.join(options.vaultDirectory, vaultFileName("media-tar", now));
    let header: VaultHeader;
    try {
      header = encryptFile({ plaintext: options.snapshot, target: file, key: options.key, kind: "media-tar", name: "media-snapshot.tar", now });
    } catch (error) {
      /* Nothing of ours was written (an existing file is never ours to remove). */
      return { status: "refused", reason: "seal-failed", detail: (error as Error).message };
    }
    try {
      decryptFile({ vault: file, key: options.key });
    } catch (error) {
      rmSync(file, { force: true });
      return { status: "refused", reason: "seal-failed", detail: (error as Error).message };
    }
    return { status: "sealed", file, header };
  } finally {
    rmSync(options.snapshot, { force: true });
  }
}
