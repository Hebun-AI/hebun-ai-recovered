/*
 * secret-encryption/key-registry.server.ts — WHICH KEYS THIS DEPLOYMENT HOLDS.
 *
 * ── WHY PLURAL, WHEN THE AUTH PRECEDENT IS A PAIR ────────────────────────────
 *
 * `auth-environment.server.ts` resolves a CURRENT and a PREVIOUS session-digest key, which is
 * enough there: a digest rotation completes as fast as sessions turn over, without touching a row.
 *
 * Credential rotation is not that. Every credential row must be READ, DECRYPTED and RE-ENCRYPTED,
 * one at a time, by a ceremony an operator runs and can stop halfway. A two-slot registry would
 * force that ceremony to finish inside one window or strand rows it can no longer read. So the
 * registry is a MAP from `key_id` to key, every registered key stays usable for decryption, and
 * exactly one is active for writing.
 *
 * ── FAIL CLOSED, ALWAYS ──────────────────────────────────────────────────────
 *
 * There is no `disabled` arm and no development default. Absent configuration, a malformed entry,
 * a key that is not exactly 32 bytes, a duplicate id, or an active id naming no registered key all
 * produce `invalid`, and every credential operation refuses. A generated development key would
 * make a machine able to encrypt secrets nobody can ever decrypt again; a plaintext fallback would
 * make the whole subsystem decorative.
 *
 * NO SILENT FALLBACK TO ANOTHER KEY. A row records the key that sealed it, and if that key is not
 * registered the row refuses. Trying the remaining keys in turn would be an oracle and a way to
 * quietly decrypt rows with the wrong one.
 *
 * ── ONE REGISTRY, TWO VARIABLES ──────────────────────────────────────────────
 *
 * `HEBUN_INTEGRATION_ENCRYPTION_KEYS` is authoritative and REQUIRED. The optional
 * `HEBUN_INTEGRATION_ENCRYPTION_KEYS_ADDITIONAL` carries more `keyId:base64Key` entries in the
 * same shape and contributes them to the SAME map. It exists because a hosting provider's
 * sensitive variables cannot be read back: a key that has to be held both by the deployment and
 * by an operator ceremony is added there, without the authoritative variable ever being rewritten.
 *
 * It is NOT a second authority. It cannot stand alone (the primary variable is still required), an
 * id appearing in both is a duplicate and refuses, a malformed entry refuses, and a variable that is
 * set but contributes no key refuses. The active key is still chosen ONLY by
 * `HEBUN_INTEGRATION_ENCRYPTION_ACTIVE_KEY_ID`, whichever variable registered it.
 *
 * ── KEY MATERIAL IS NEVER RENDERED ───────────────────────────────────────────
 *
 * Errors, missing/invalid lists and every value this module returns name KEY IDS ONLY. The
 * `EncryptionKey` values carry `toString`/`toJSON` overrides so that even a careless log of the
 * whole registry prints identifiers.
 *
 * Server-only.
 */
import {
  createEncryptionKey,
  SECRET_KEY_BYTES,
  type EncryptionKey,
} from "./authenticated-encryption.server";

export const INTEGRATION_ENCRYPTION_ENV_KEYS = {
  /** `keyId:base64Key,keyId:base64Key` — one entry per registered key. REQUIRED. */
  keys: "HEBUN_INTEGRATION_ENCRYPTION_KEYS",
  /**
   * OPTIONAL. Same shape; its entries join the same registry. Never a substitute for `keys`, and
   * an id present in both is a duplicate. See "ONE REGISTRY, TWO VARIABLES" above.
   */
  additionalKeys: "HEBUN_INTEGRATION_ENCRYPTION_KEYS_ADDITIONAL",
  /** The `key_id` new encryptions use. Must name an entry in the map above. */
  activeKeyId: "HEBUN_INTEGRATION_ENCRYPTION_ACTIVE_KEY_ID",
} as const;

/**
 * The shape a key id may take — the same constraint `auth_credentials_algorithm_chk` already puts
 * on an algorithm name, so an id is always safe to put in a column, a log line and a filename.
 */
export const KEY_ID_RE = /^[a-z0-9][a-z0-9._-]{0,31}$/;

export interface ConfiguredEncryptionKeys {
  readonly status: "configured";
  readonly activeKeyId: string;
  /** Every registered key, by id. Old ids stay here so rotation can still read old rows. */
  readonly keys: ReadonlyMap<string, EncryptionKey>;
}

export type EncryptionKeyResolution =
  | ConfiguredEncryptionKeys
  | {
      readonly status: "invalid";
      readonly missingKeys: readonly string[];
      /** Env var names, and key IDS. Never key material. */
      readonly invalidKeys: readonly string[];
    };

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("The encryption key registry is server-only.");
  }
}

/**
 * Decode one registry entry.
 *
 * Base64 is validated by RE-ENCODING and comparing: `Buffer.from` is lenient and will happily
 * accept a string with stray characters, silently producing the wrong number of bytes. A key that
 * decodes to the wrong thing without complaining is the worst possible configuration error,
 * because it fails at DECRYPT time, on rows already written.
 */
function decodeKeyMaterial(encoded: string): Buffer | null {
  const material = Buffer.from(encoded, "base64");
  if (material.length !== SECRET_KEY_BYTES) return null;
  if (material.toString("base64") !== encoded) return null;
  return material;
}

/**
 * Register every `keyId:base64Key` entry of one variable into the shared map.
 *
 * Returns how many keys THIS variable registered. Complaints go to `invalidKeys` as the variable's
 * NAME (for an entry that cannot even be split) or the KEY ID (for a bad id, a duplicate or bad
 * material) — never the material. Both variables go through this one function so the duplicate
 * check is the same check whichever list an id appears in.
 */
function registerKeyEntries(
  raw: string,
  envName: string,
  keys: Map<string, EncryptionKey>,
  invalidKeys: string[],
): number {
  let registered = 0;
  for (const entry of raw.split(",")) {
    const trimmed = entry.trim();
    if (trimmed.length === 0) continue;

    /* Split on the FIRST colon only: base64 has no colon, but a future encoding might. */
    const separator = trimmed.indexOf(":");
    if (separator <= 0) {
      invalidKeys.push(envName);
      continue;
    }
    const keyId = trimmed.slice(0, separator).trim();
    const encoded = trimmed.slice(separator + 1).trim();

    if (!KEY_ID_RE.test(keyId)) {
      invalidKeys.push(envName);
      continue;
    }
    /* A duplicate id makes "which key sealed this row" unanswerable. Never last-one-wins. */
    if (keys.has(keyId)) {
      invalidKeys.push(keyId);
      continue;
    }
    const material = decodeKeyMaterial(encoded);
    if (!material) {
      /* The ID, never the material — this string reaches logs and error pages. */
      invalidKeys.push(keyId);
      continue;
    }
    keys.set(keyId, createEncryptionKey(keyId, material));
    registered += 1;
  }
  return registered;
}

/**
 * Read the deployment's keys, or say exactly what is wrong.
 *
 * `env` is a parameter so a test can exercise every invalid shape without mutating the process,
 * which is the same seam `resolveAuthenticationEnvironment` uses.
 */
export function resolveIntegrationEncryptionKeys(
  env: Readonly<Record<string, string | undefined>> = process.env,
): EncryptionKeyResolution {
  assertServerOnly();

  const rawKeys = env[INTEGRATION_ENCRYPTION_ENV_KEYS.keys]?.trim();
  const rawActive = env[INTEGRATION_ENCRYPTION_ENV_KEYS.activeKeyId]?.trim();

  const missingKeys: string[] = [];
  if (!rawKeys) missingKeys.push(INTEGRATION_ENCRYPTION_ENV_KEYS.keys);
  if (!rawActive) missingKeys.push(INTEGRATION_ENCRYPTION_ENV_KEYS.activeKeyId);
  if (missingKeys.length > 0) {
    return Object.freeze({ status: "invalid" as const, missingKeys, invalidKeys: [] });
  }

  const invalidKeys: string[] = [];
  const keys = new Map<string, EncryptionKey>();

  /* The authoritative list must register at least one key on its own. */
  if (registerKeyEntries(rawKeys!, INTEGRATION_ENCRYPTION_ENV_KEYS.keys, keys, invalidKeys) === 0) {
    invalidKeys.push(INTEGRATION_ENCRYPTION_ENV_KEYS.keys);
  }

  /*
   * The additional list is optional: absent or blank means "no more keys". Set but contributing
   * nothing is a configuration MISTAKE, not an absence, and refuses like any other malformed value.
   * Duplicates against the primary list are caught by the shared parser (same map, same check).
   */
  const rawAdditional = env[INTEGRATION_ENCRYPTION_ENV_KEYS.additionalKeys]?.trim();
  if (rawAdditional) {
    if (registerKeyEntries(rawAdditional, INTEGRATION_ENCRYPTION_ENV_KEYS.additionalKeys, keys, invalidKeys) === 0) {
      invalidKeys.push(INTEGRATION_ENCRYPTION_ENV_KEYS.additionalKeys);
    }
  }
  if (!KEY_ID_RE.test(rawActive!) || !keys.has(rawActive!)) {
    invalidKeys.push(INTEGRATION_ENCRYPTION_ENV_KEYS.activeKeyId);
  }

  if (invalidKeys.length > 0) {
    return Object.freeze({
      status: "invalid" as const,
      missingKeys: [],
      invalidKeys: [...new Set(invalidKeys)],
    });
  }

  return Object.freeze({
    status: "configured" as const,
    activeKeyId: rawActive!,
    keys,
  });
}

/** The key new encryptions use. Present exactly when the resolution is `configured`. */
export function activeKeyOf(resolution: ConfiguredEncryptionKeys): EncryptionKey {
  const key = resolution.keys.get(resolution.activeKeyId);
  /* Unreachable: `resolveIntegrationEncryptionKeys` refuses an active id with no entry. */
  if (!key) throw new Error("The active key id names no registered key.");
  return key;
}

/** The key a ROW says sealed it, or `null`. Never a different key, and never the active one. */
export function keyForRow(
  resolution: ConfiguredEncryptionKeys,
  keyId: string,
): EncryptionKey | null {
  return resolution.keys.get(keyId) ?? null;
}
