/*
 * backup-vault.ts — BR-2: ENCRYPTED, VERIFIABLE BACKUP FILES, AND THEIR RETENTION.
 *
 * A backup leaves this machine only as a vault file (`.hbk`). The format is authenticated
 * encryption, nothing else:
 *
 *   "HEBUNBK1" (8 bytes) | header length (uint32 BE) | header (UTF-8 JSON) | ciphertext | GCM tag (16)
 *
 * The cipher is AES-256-GCM with a fresh random 96-bit nonce per file. The header — kind, name,
 * plaintext size and SHA-256, key id, nonce — is the GCM additional data, so changing one header byte
 * fails the tag exactly like changing one ciphertext byte.
 *
 * FAIL CLOSED. GCM emits plaintext before it can say whether the plaintext is genuine. So decryption
 * writes to a `.part` file inside a 0700 directory, and only after the tag verifies AND the plaintext's
 * size and SHA-256 equal the header's is the file renamed into place. Any failure removes the part
 * file; the caller never holds unauthenticated bytes under the final name.
 *
 * The key is 32 random bytes in a file that must be a regular file, not a symlink, owned by this user
 * and mode 0600. The key is never logged, never placed in argv or the environment; a vault file names
 * only a key ID (the first 16 hex characters of SHA-256 over the key), so a wrong key is refused before
 * any ciphertext is read.
 *
 * Files this module writes are 0600; directories it creates are 0700.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readSync,
  readdirSync,
  renameSync,
  rmSync,
  statfsSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import path from "node:path";

const MAGIC = Buffer.from("HEBUNBK1", "ascii");
const TAG_BYTES = 16;
const NONCE_BYTES = 12;
const KEY_BYTES = 32;
const MAX_HEADER_BYTES = 64 * 1024;
const CHUNK = 1024 * 1024;
/** GCM with one nonce is safe up to 2^39 − 256 bits; stay far below. */
const MAX_PLAINTEXT_BYTES = 32 * 1024 ** 3;

/** BR-2 Director floor: heavy backup work refuses below 8 GiB free. */
export const BACKUP_FREE_SPACE_FLOOR = 8 * 1024 ** 3;

export const VAULT_KINDS = ["postgres-custom", "media-tar"] as const;
export type VaultKind = (typeof VAULT_KINDS)[number];

export interface VaultHeader {
  readonly format: "hebun-backup-vault";
  readonly version: 1;
  readonly cipher: "aes-256-gcm";
  readonly keyId: string;
  readonly nonce: string;
  readonly kind: VaultKind;
  readonly name: string;
  readonly createdAt: string;
  readonly plaintextBytes: number;
  readonly plaintextSha256: string;
}

export class VaultError extends Error {
  constructor(
    readonly code:
      | "key-unsafe"
      | "key-invalid"
      | "not-a-vault"
      | "header-invalid"
      | "wrong-key"
      | "authentication-failed"
      | "digest-mismatch"
      | "target-exists"
      | "disk-below-floor"
      | "too-large",
    message: string,
  ) {
    super(message);
    this.name = "VaultError";
  }
}

/* ── permissions ─────────────────────────────────────────────────────────── */

/** Create `directory` (and parents) 0700; an existing directory must not be a symlink. */
export function ensurePrivateDirectory(directory: string): void {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const st = lstatSync(directory);
  if (!st.isDirectory()) throw new Error(`${directory} is not a directory`);
}

/** Open a NEW file 0600 for writing; refuses an existing path and never follows a symlink. */
function openNewPrivate(file: string): number {
  return openSync(file, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
}

export function freeBytes(directory: string): number {
  const s = statfsSync(directory);
  return Number(s.bavail) * Number(s.bsize);
}

export function assertFreeSpace(directory: string, floorBytes = BACKUP_FREE_SPACE_FLOOR): void {
  const free = freeBytes(directory);
  if (free < floorBytes) {
    throw new VaultError("disk-below-floor", `${free} bytes free under ${directory}, floor is ${floorBytes}; nothing was written`);
  }
}

/* ── key ─────────────────────────────────────────────────────────────────── */

export interface VaultKey {
  readonly id: string;
  /** @internal the raw key; never log it. */
  readonly bytes: Buffer;
}

function keyId(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex").slice(0, 16);
}

/** Write a new random key, 0600. Refuses to overwrite: a lost key makes every vault file unreadable. */
export function generateKeyFile(file: string): { readonly id: string } {
  ensurePrivateDirectory(path.dirname(file));
  const bytes = randomBytes(KEY_BYTES);
  let fd: number;
  try {
    fd = openNewPrivate(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new VaultError("target-exists", `${file} already exists; a key is never overwritten`);
    }
    throw error;
  }
  try {
    writeSync(fd, bytes);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  return { id: keyId(bytes) };
}

/** Read the key, refusing anything but a regular, owner-only, 32-byte file. */
export function loadKeyFile(file: string): VaultKey {
  let fd: number;
  try {
    fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (error) {
    throw new VaultError("key-unsafe", `key file cannot be opened safely (${(error as NodeJS.ErrnoException).code})`);
  }
  try {
    const st = fstatSync(fd);
    if (!st.isFile()) throw new VaultError("key-unsafe", "key file is not a regular file");
    if ((st.mode & 0o077) !== 0) throw new VaultError("key-unsafe", `key file mode is ${(st.mode & 0o777).toString(8)}, must be 600`);
    if (typeof process.getuid === "function" && st.uid !== process.getuid()) {
      throw new VaultError("key-unsafe", "key file is not owned by this user");
    }
    if (st.size !== KEY_BYTES) throw new VaultError("key-invalid", `key file must hold exactly ${KEY_BYTES} bytes`);
    const bytes = Buffer.alloc(KEY_BYTES);
    if (readSync(fd, bytes, 0, KEY_BYTES, 0) !== KEY_BYTES) throw new VaultError("key-invalid", "key file is short");
    return Object.freeze({ id: keyId(bytes), bytes });
  } finally {
    closeSync(fd);
  }
}

/* ── encrypt ─────────────────────────────────────────────────────────────── */

function digestFile(file: string): { bytes: number; sha256: string } {
  const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const hash = createHash("sha256");
    const buf = Buffer.alloc(CHUNK);
    let total = 0;
    for (let n; (n = readSync(fd, buf, 0, CHUNK, null)) > 0; ) {
      hash.update(buf.subarray(0, n));
      total += n;
    }
    return { bytes: total, sha256: hash.digest("hex") };
  } finally {
    closeSync(fd);
  }
}

/**
 * Encrypt `plaintext` into the NEW vault file `target` (0600). Written as `target.part`, fsynced,
 * then renamed; the part file is removed on any failure. The plaintext is read twice (digest, then
 * cipher), so it must not change meanwhile — and if it does, the stored digest no longer matches and
 * every later decrypt refuses.
 */
export function encryptFile(options: {
  readonly plaintext: string;
  readonly target: string;
  readonly key: VaultKey;
  readonly kind: VaultKind;
  readonly name: string;
  readonly now?: Date;
}): VaultHeader {
  const { bytes, sha256 } = digestFile(options.plaintext);
  if (bytes > MAX_PLAINTEXT_BYTES) throw new VaultError("too-large", `${bytes} bytes exceeds the vault limit`);
  const nonce = randomBytes(NONCE_BYTES);
  const header: VaultHeader = {
    format: "hebun-backup-vault",
    version: 1,
    cipher: "aes-256-gcm",
    keyId: options.key.id,
    nonce: nonce.toString("base64"),
    kind: options.kind,
    name: options.name,
    createdAt: (options.now ?? new Date()).toISOString(),
    plaintextBytes: bytes,
    plaintextSha256: sha256,
  };
  const headerBytes = Buffer.from(JSON.stringify(header), "utf8");
  const lengthPrefix = Buffer.alloc(4);
  lengthPrefix.writeUInt32BE(headerBytes.length);

  ensurePrivateDirectory(path.dirname(options.target));
  try {
    lstatSync(options.target);
    throw new VaultError("target-exists", `${options.target} already exists`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const part = `${options.target}.part`;
  const out = openNewPrivate(part);
  let done = false;
  try {
    const cipher = createCipheriv("aes-256-gcm", options.key.bytes, nonce);
    cipher.setAAD(Buffer.concat([MAGIC, lengthPrefix, headerBytes]));
    writeSync(out, MAGIC);
    writeSync(out, lengthPrefix);
    writeSync(out, headerBytes);
    const input = openSync(options.plaintext, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const buf = Buffer.alloc(CHUNK);
      for (let n; (n = readSync(input, buf, 0, CHUNK, null)) > 0; ) writeSync(out, cipher.update(buf.subarray(0, n)));
    } finally {
      closeSync(input);
    }
    writeSync(out, cipher.final());
    writeSync(out, cipher.getAuthTag());
    fsyncSync(out);
    done = true;
  } finally {
    closeSync(out);
    if (!done) rmSync(part, { force: true });
  }
  renameSync(part, options.target);
  return Object.freeze(header);
}

/* ── decrypt / verify ────────────────────────────────────────────────────── */

const SHA256_HEX = /^[0-9a-f]{64}$/;
const NAME_RE = /^[A-Za-z0-9._-]{1,128}$/;

function parseHeader(raw: Buffer): VaultHeader {
  let h: Record<string, unknown>;
  try {
    h = JSON.parse(raw.toString("utf8")) as Record<string, unknown>;
  } catch {
    throw new VaultError("header-invalid", "vault header is not JSON");
  }
  const ok =
    h.format === "hebun-backup-vault" &&
    h.version === 1 &&
    h.cipher === "aes-256-gcm" &&
    typeof h.keyId === "string" && /^[0-9a-f]{16}$/.test(h.keyId) &&
    typeof h.nonce === "string" && Buffer.from(h.nonce, "base64").length === NONCE_BYTES &&
    (VAULT_KINDS as readonly unknown[]).includes(h.kind) &&
    typeof h.name === "string" && NAME_RE.test(h.name) &&
    typeof h.createdAt === "string" && !Number.isNaN(Date.parse(h.createdAt)) &&
    Number.isSafeInteger(h.plaintextBytes) && (h.plaintextBytes as number) >= 0 &&
    typeof h.plaintextSha256 === "string" && SHA256_HEX.test(h.plaintextSha256);
  if (!ok) throw new VaultError("header-invalid", "vault header fields are not the v1 shape");
  return Object.freeze(h as unknown as VaultHeader);
}

/** Read and validate the header only. Authenticity is NOT established until a full decrypt. */
export function readVaultHeader(vault: string): VaultHeader {
  const fd = openSync(vault, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    return readFraming(fd, fstatSync(fd).size).header;
  } finally {
    closeSync(fd);
  }
}

function readFraming(fd: number, size: number): { header: VaultHeader; aad: Buffer; bodyStart: number } {
  const fixed = Buffer.alloc(MAGIC.length + 4);
  if (size < fixed.length + TAG_BYTES || readSync(fd, fixed, 0, fixed.length, 0) !== fixed.length) {
    throw new VaultError("not-a-vault", "file is too short to be a vault file");
  }
  if (!fixed.subarray(0, MAGIC.length).equals(MAGIC)) throw new VaultError("not-a-vault", "magic bytes do not match");
  const headerLength = fixed.readUInt32BE(MAGIC.length);
  if (headerLength < 2 || headerLength > MAX_HEADER_BYTES || fixed.length + headerLength + TAG_BYTES > size) {
    throw new VaultError("header-invalid", "header length is out of range");
  }
  const raw = Buffer.alloc(headerLength);
  if (readSync(fd, raw, 0, headerLength, fixed.length) !== headerLength) throw new VaultError("header-invalid", "header is short");
  return { header: parseHeader(raw), aad: Buffer.concat([fixed, raw]), bodyStart: fixed.length + headerLength };
}

/**
 * Decrypt and authenticate `vault`. With `target`, the plaintext lands there (0600) ONLY after the
 * tag and the digest both verify; without it nothing is written (verification only). Throws a
 * VaultError on any failure, having removed every byte it wrote.
 */
export function decryptFile(options: { readonly vault: string; readonly key: VaultKey; readonly target?: string }): VaultHeader {
  const fd = openSync(options.vault, constants.O_RDONLY | constants.O_NOFOLLOW);
  let out: number | undefined;
  let part: string | undefined;
  let accepted = false;
  try {
    const size = fstatSync(fd).size;
    const { header, aad, bodyStart } = readFraming(fd, size);
    if (header.keyId !== options.key.id) {
      throw new VaultError("wrong-key", `vault was sealed with key ${header.keyId}, this key is ${options.key.id}`);
    }
    const bodyEnd = size - TAG_BYTES;
    if (bodyEnd - bodyStart !== header.plaintextBytes) {
      throw new VaultError("authentication-failed", "ciphertext length does not match the header");
    }
    const tag = Buffer.alloc(TAG_BYTES);
    readSync(fd, tag, 0, TAG_BYTES, bodyEnd);

    if (options.target) {
      ensurePrivateDirectory(path.dirname(options.target));
      try {
        lstatSync(options.target);
        throw new VaultError("target-exists", `${options.target} already exists`);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      part = `${options.target}.part`;
      out = openNewPrivate(part);
    }

    const decipher = createDecipheriv("aes-256-gcm", options.key.bytes, Buffer.from(header.nonce, "base64"));
    decipher.setAAD(aad);
    decipher.setAuthTag(tag);
    const hash = createHash("sha256");
    const buf = Buffer.alloc(CHUNK);
    for (let pos = bodyStart; pos < bodyEnd; ) {
      const n = readSync(fd, buf, 0, Math.min(CHUNK, bodyEnd - pos), pos);
      if (n <= 0) throw new VaultError("authentication-failed", "vault file is truncated");
      pos += n;
      const plain = decipher.update(buf.subarray(0, n));
      hash.update(plain);
      if (out !== undefined) writeSync(out, plain);
    }
    try {
      const tail = decipher.final();
      hash.update(tail);
      if (out !== undefined) writeSync(out, tail);
    } catch {
      throw new VaultError("authentication-failed", "authentication tag does not verify: the file, its header or the key is not the one sealed");
    }
    if (hash.digest("hex") !== header.plaintextSha256) {
      throw new VaultError("digest-mismatch", "plaintext SHA-256 differs from the sealed header");
    }
    if (out !== undefined) fsyncSync(out);
    accepted = true;
    return header;
  } finally {
    closeSync(fd);
    if (out !== undefined) closeSync(out);
    if (part) {
      if (accepted) renameSync(part, options.target!);
      else rmSync(part, { force: true });
    }
  }
}

/* ── retention ───────────────────────────────────────────────────────────── */

/** Vault files this module names and may prune: `<kind>-YYYYMMDDTHHMMSSZ.hbk`. Nothing else is touched. */
export const VAULT_FILE_RE = /^(postgres-custom|media-tar)-(\d{8}T\d{6}Z)\.hbk$/;

export function vaultFileName(kind: VaultKind, at: Date): string {
  return `${kind}-${at.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}.hbk`;
}

export interface RetentionPolicy {
  /** Newest backups kept regardless of age. */
  readonly keepLast: number;
  /** One per UTC day, for this many most recent days that have a backup. */
  readonly keepDaily: number;
  /** One per ISO week. */
  readonly keepWeekly: number;
  /** One per calendar month. */
  readonly keepMonthly: number;
}

export const DEFAULT_RETENTION: RetentionPolicy = Object.freeze({ keepLast: 3, keepDaily: 7, keepWeekly: 4, keepMonthly: 6 });

function stampDate(stamp: string): Date {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(stamp)!;
  return new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +m[6]!));
}

function isoWeek(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  return `${t.getUTCFullYear()}-W${Math.ceil(((t.getTime() - yearStart) / 86400000 + 1) / 7)}`;
}

/**
 * Grandfather-father-son over ONE kind's file names. Pure. Within each bucket the NEWEST file is kept.
 * Names that are not vault file names are neither kept nor pruned: they are not this module's.
 * The newest file is always kept, so a policy can never prune everything.
 */
export function planRetention(names: readonly string[], policy: RetentionPolicy): { keep: string[]; prune: string[] } {
  for (const n of [policy.keepLast, policy.keepDaily, policy.keepWeekly, policy.keepMonthly]) {
    if (!Number.isInteger(n) || n < 0) throw new Error("retention counts must be non-negative integers");
  }
  const files = names
    .map((name) => ({ name, m: VAULT_FILE_RE.exec(name) }))
    .filter((f): f is { name: string; m: RegExpExecArray } => f.m !== null)
    .map((f) => ({ name: f.name, kind: f.m[1]!, at: stampDate(f.m[2]!) }))
    .sort((a, b) => b.at.getTime() - a.at.getTime());
  if (new Set(files.map((f) => f.kind)).size > 1) throw new Error("planRetention takes one kind at a time");

  const keep = new Set<string>(files.slice(0, Math.max(1, policy.keepLast)).map((f) => f.name));
  const bucket = (limit: number, key: (d: Date) => string) => {
    const seen = new Set<string>();
    for (const f of files) {
      const k = key(f.at);
      if (seen.has(k)) continue;
      if (seen.size >= limit) break;
      seen.add(k);
      keep.add(f.name);
    }
  };
  bucket(policy.keepDaily, (d) => d.toISOString().slice(0, 10));
  bucket(policy.keepWeekly, isoWeek);
  bucket(policy.keepMonthly, (d) => d.toISOString().slice(0, 7));
  return {
    keep: files.filter((f) => keep.has(f.name)).map((f) => f.name),
    prune: files.filter((f) => !keep.has(f.name)).map((f) => f.name),
  };
}

/**
 * Apply `planRetention` to one kind in `directory`. Dry run unless `apply`. Before anything is
 * deleted, every file that will be KEPT is decrypt-verified: pruning never runs while a kept backup
 * is unreadable, so retention cannot shrink the set down to only broken files.
 */
export function pruneVault(options: {
  readonly directory: string;
  readonly kind: VaultKind;
  readonly key: VaultKey;
  readonly policy?: RetentionPolicy;
  readonly apply: boolean;
}): { keep: string[]; prune: string[]; deleted: string[] } {
  const names = readdirSync(options.directory).filter((n) => VAULT_FILE_RE.exec(n)?.[1] === options.kind);
  const plan = planRetention(names, options.policy ?? DEFAULT_RETENTION);
  for (const name of plan.keep) decryptFile({ vault: path.join(options.directory, name), key: options.key });
  const deleted: string[] = [];
  if (options.apply) {
    for (const name of plan.prune) {
      unlinkSync(path.join(options.directory, name));
      deleted.push(name);
    }
  }
  return { ...plan, deleted };
}
