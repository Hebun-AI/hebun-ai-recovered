/*
 * integration-credentials/credential-repository.server.ts — THE ONLY READER AND WRITER OF
 * `integration_credentials`, and the only module in Hebun that can turn a stored row back into a
 * tenant's secret.
 *
 * ── THE TENANT CONTRACT ──────────────────────────────────────────────────────
 *
 * NO FUNCTION HERE ACCEPTS A CREDENTIAL ID WITHOUT A TenantContext, and there is no overload that
 * omits one — the I1 repository's rule, for a stricter reason. Every query composes ONE predicate
 * helper, `ownedBy` / `ownedRow`, because a clause copied into eight call sites is a clause that
 * will eventually be seven.
 *
 * A FOREIGN ID READS AS NOTHING. `not-found`, never `forbidden`: the difference is itself the
 * disclosure that a row exists somewhere, and no branch here can make it.
 *
 * ── THE THREE LAYERS, AND WHY NONE OF THEM IS TRUSTED ALONE ──────────────────
 *
 *   1. This module's tenant predicate.
 *   2. The composite foreign key `(tenant_id, integration_id) -> integrations(tenant_id, id)`.
 *   3. The AES-GCM AAD, which binds the CIPHERTEXT to `(tenant, integration, kind)`.
 *
 * The third is the one that still holds when the other two are gone: a row lifted out of a backup
 * and dropped into another tenant does not decrypt, with the right key, on a healthy database.
 * Each layer has its own bite-proof, because a layer nobody proved is a layer nobody has.
 *
 * ── THE METADATA QUERY CANNOT RETURN A SECRET ────────────────────────────────
 *
 * `METADATA_COLUMNS` does not contain `ciphertext`, `iv` or `authTag`. Reads that answer "what
 * credentials exist" are structurally incapable of carrying secret material — not filtered
 * afterwards, ABSENT from the projection. `SEALED_COLUMNS` exists in exactly one function and in
 * the rotation ceremony, and nothing else selects it.
 *
 * ── WHAT THIS MODULE CANNOT DO ───────────────────────────────────────────────
 *
 * It cannot make a network call: it imports no transport, no fetch, no adapter and no provider.
 * It cannot verify anything, because verification means contacting a provider. It cannot mint,
 * approve or consume an authorization: it imports neither `action-authorization` nor
 * `action-execution`, and a firewall test walks the real import graph to prove it. It cannot write
 * `integrations` — it does not import that table, and asks the module that owns it instead.
 *
 * It therefore CANNOT PRODUCE `connected`. Storing a secret produces `unverified` and nothing
 * else, however valid the secret is and however successfully it decrypts.
 *
 * ── THE LIMIT THAT CANNOT BE ENGINEERED AWAY ─────────────────────────────────
 *
 * V8 does not guarantee memory zeroization. `withDecryptedSecret` narrows a plaintext's LIFETIME
 * and guarantees it is never persisted, returned or logged. It does not erase it from the heap,
 * and nothing here claims to.
 *
 * Server-only.
 */
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { integrationCredentials } from "@/db/schema/integration-credential";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { attachCredentialToConnectionWithin } from "@/features/integration-authority/integration-repository.server";
import {
  openSecret,
  sealSecret,
  type SealedSecret,
} from "@/features/secret-encryption/authenticated-encryption.server";
import {
  activeKeyOf,
  keyForRow,
  resolveIntegrationEncryptionKeys,
  type ConfiguredEncryptionKeys,
} from "@/features/secret-encryption/key-registry.server";
import { recordCredentialEventWithin } from "@/features/governance-audit/integration-credential-audit.server";
import {
  credentialAad,
  CREDENTIAL_AUDIT_DESTROYED,
  CREDENTIAL_AUDIT_REPLACED,
  CREDENTIAL_AUDIT_REVOKED,
  CREDENTIAL_AUDIT_STORED,
  CREDENTIAL_LIMITS,
  isCredentialKind,
  type CredentialListing,
  type CredentialMetadata,
  type CredentialRefusal,
  type CredentialTransitionResult,
  type IntegrationCredentialKind,
  type ReplaceCredentialResult,
  type ScopedSecretResult,
  type StoreCredentialInput,
  type StoreCredentialResult,
} from "./contracts";

export interface CredentialRepositoryDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
  /** Config source for the key registry. Production leaves it unset. */
  readonly env?: Readonly<Record<string, string | undefined>>;
  /**
   * TEST-ONLY FAILURE INJECTION, and named so it cannot be mistaken for anything else.
   *
   * Atomic replacement is a claim about what happens when a step in the middle FAILS, and a claim
   * about failure cannot be proved by a run in which nothing fails. This hook is the seam a test
   * throws from; a firewall test asserts no module under `src/` ever passes it, so production has
   * no path to it at all.
   */
  readonly failAfterRevokeForTest?: () => Promise<void>;
  /** TEST-ONLY. Replaces the audit writer so an audit failure can be proved to roll the write back. */
  readonly recordEventForTest?: typeof recordCredentialEventWithin;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UNIQUE_VIOLATION = "23505";

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("The credential authority is server-only.");
  }
}

function resolveCredentialDbOrNull(): ControlPlaneDatabase | null {
  if (!process.env.DATABASE_URL?.trim()) return null;
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: unknown })?.code;
  if (code === UNIQUE_VIOLATION) return true;
  const cause = (error as { cause?: { code?: unknown } })?.cause;
  return cause?.code === UNIQUE_VIOLATION;
}

function refused(reason: CredentialRefusal): { status: "refused"; reason: CredentialRefusal } {
  return { status: "refused", reason } as const;
}

/* ── THE ONE TENANT PREDICATE ───────────────────────────────────────────────── */

function ownedBy(tenant: TenantContext) {
  return eq(integrationCredentials.tenantId, tenant.tenantId);
}

function ownedRow(tenant: TenantContext, credentialId: string) {
  return and(eq(integrationCredentials.id, credentialId), ownedBy(tenant));
}

/** Neither revoked nor destroyed. The same predicate the partial unique index uses. */
function liveOnly() {
  return and(
    isNull(integrationCredentials.revokedAt),
    isNull(integrationCredentials.destroyedAt),
  );
}

/* ── Projections ────────────────────────────────────────────────────────────── */

/**
 * WHAT A METADATA READ MAY SEE. No ciphertext, no IV, no auth tag — the projection cannot carry
 * them, so no caller can be handed them by mistake and no future edit can leak them by forgetting
 * to strip a field.
 */
const METADATA_COLUMNS = {
  id: integrationCredentials.id,
  integrationId: integrationCredentials.integrationId,
  kind: integrationCredentials.kind,
  algorithm: integrationCredentials.algorithm,
  keyId: integrationCredentials.keyId,
  expiresAt: integrationCredentials.expiresAt,
  revokedAt: integrationCredentials.revokedAt,
  destroyedAt: integrationCredentials.destroyedAt,
  createdAt: integrationCredentials.createdAt,
} as const;

/** The sealed material. Selected in exactly ONE function here, and in the rotation ceremony. */
const SEALED_COLUMNS = {
  ...METADATA_COLUMNS,
  ciphertext: integrationCredentials.ciphertext,
  iv: integrationCredentials.iv,
  authTag: integrationCredentials.authTag,
} as const;

type MetadataRow = {
  id: string;
  integrationId: string;
  kind: string;
  algorithm: string;
  keyId: string;
  expiresAt: Date | null;
  revokedAt: Date | null;
  destroyedAt: Date | null;
  createdAt: Date;
};

function toMetadata(row: MetadataRow): CredentialMetadata {
  return {
    credentialId: row.id,
    integrationId: row.integrationId,
    kind: row.kind as IntegrationCredentialKind,
    algorithm: row.algorithm,
    keyId: row.keyId,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    destroyedAt: row.destroyedAt ? row.destroyedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    live: row.revokedAt === null && row.destroyedAt === null,
  };
}

/* ── Configuration ──────────────────────────────────────────────────────────── */

/**
 * The deployment's keys, or `null`.
 *
 * FAIL CLOSED: a missing or malformed registry is `null` and every operation refuses with
 * `encryption-not-configured`. There is no development key, no generated key and no fallback — a
 * machine that invented its own key would encrypt secrets nobody could ever decrypt again.
 */
function resolveKeysOrNull(deps: CredentialRepositoryDeps): ConfiguredEncryptionKeys | null {
  const resolution = resolveIntegrationEncryptionKeys(deps.env ?? process.env);
  return resolution.status === "configured" ? resolution : null;
}

function auditActor(tenant: TenantContext) {
  return {
    tenantId: tenant.tenantId,
    userId: tenant.userId,
    requestId: tenant.requestId,
    sessionContextId: tenant.sessionContextId,
  };
}

function isUsablePlaintext(plaintext: unknown): plaintext is string {
  return (
    typeof plaintext === "string" &&
    plaintext.length > 0 &&
    plaintext.length <= CREDENTIAL_LIMITS.plaintextMaxLength
  );
}

/* ── Store ──────────────────────────────────────────────────────────────────── */

/**
 * Record a tenant's secret for a connection that has none of this kind.
 *
 * ── ENCRYPT BEFORE ANY DATABASE STATE CHANGES ────────────────────────────────
 *
 * The seal happens OUTSIDE the transaction, on purpose. Encryption can fail — a malformed key, a
 * cipher that refuses — and a failure discovered mid-transaction would be a failure discovered
 * after a lifecycle row had already been touched. Doing the fallible, side-effect-free work first
 * means the transaction only ever contains writes.
 */
export async function storeCredential(
  tenant: TenantContext | null,
  input: StoreCredentialInput,
  deps: CredentialRepositoryDeps = {},
): Promise<StoreCredentialResult> {
  assertServerOnly();
  if (!tenant?.tenantId) return refused("no-authorized-tenant-context");

  const db = (deps.getDb ?? resolveCredentialDbOrNull)();
  if (!db) return refused("persistence-not-configured");

  if (!UUID_RE.test(input.integrationId ?? "")) return refused("invalid-input");
  if (!isCredentialKind(input.kind ?? "")) return refused("invalid-input");
  if (!isUsablePlaintext(input.plaintext)) return refused("invalid-input");

  const keys = resolveKeysOrNull(deps);
  if (!keys) return refused("encryption-not-configured");

  const now = (deps.now ?? (() => new Date()))();
  const sealed = sealSecret(
    input.plaintext,
    activeKeyOf(keys),
    credentialAad(tenant.tenantId, input.integrationId, input.kind),
  );
  const record = deps.recordEventForTest ?? recordCredentialEventWithin;

  try {
    return await db.transaction(async (tx) => {
      /*
       * The lifecycle first, and through its OWNER. It locks the connection row, refuses a
       * terminal one, and moves a non-terminal one to `unverified` — so a credential can never be
       * attached to a connection that would not accept it.
       */
      const attached = await attachCredentialToConnectionWithin(
        tx,
        tenant,
        input.integrationId,
        now,
      );
      if (attached.status === "refused") {
        return refused(
          attached.reason === "illegal-transition" ? "connection-terminal" : "not-found",
        );
      }

      const [row] = await tx
        .insert(integrationCredentials)
        .values({
          tenantId: tenant.tenantId,
          integrationId: input.integrationId,
          kind: input.kind,
          algorithm: sealed.algorithm,
          keyId: sealed.keyId,
          ciphertext: sealed.ciphertext,
          iv: sealed.iv,
          authTag: sealed.authTag,
          expiresAt: input.expiresAt ?? null,
          createdAt: now,
          createdBy: tenant.userId,
          createdByType: "human",
          updatedAt: now,
          updatedBy: tenant.userId,
          updatedByType: "human",
        })
        .returning(METADATA_COLUMNS);

      await record(
        tx,
        auditActor(tenant),
        {
          action: CREDENTIAL_AUDIT_STORED,
          outcome: "committed",
          entityId: row!.id,
          metadata: {
            integrationId: input.integrationId,
            kind: input.kind,
            algorithm: sealed.algorithm,
            keyId: sealed.keyId,
            previousCredentialId: null,
            connectionState: attached.connection.connectionState,
          },
        },
        now,
      );

      return {
        status: "stored",
        credential: toMetadata(row as MetadataRow),
        connectionState: attached.connection.connectionState,
      } as const;
    });
  } catch (error) {
    /* The partial unique index fired: a live credential of this kind already exists. */
    if (isUniqueViolation(error)) return refused("duplicate-live-credential");
    throw error;
  }
}

/* ── Replace ────────────────────────────────────────────────────────────────── */

/**
 * Swap a live credential for a new one, atomically.
 *
 * ── THE ORDER IS DECIDED BY THE CONSTRAINT, NOT BY PREFERENCE ────────────────
 *
 * `integration_credentials_live_kind_uq` permits ONE live credential per (tenant, integration,
 * kind), and PostgreSQL checks a unique index PER STATEMENT. So inserting the new row before
 * revoking the old one violates the index inside the transaction, every time. The order is
 * therefore: lock, revoke, insert, audit, commit.
 *
 * ── AND THERE IS STILL NO CREDENTIAL-LESS WINDOW ─────────────────────────────
 *
 * Revoking first sounds like it opens one. It does not, because all of it is one transaction: no
 * other session can observe the revoked-but-not-yet-replaced state, and if the insert or the audit
 * throws, the ROLLBACK returns the old credential to live exactly as it was — same id, same
 * ciphertext, still decryptable. A failure-injection test proves both halves rather than reasoning
 * about them.
 *
 * The new secret is encrypted BEFORE the transaction opens, so the one fallible non-write step
 * cannot fail while a row is already revoked.
 */
export async function replaceCredential(
  tenant: TenantContext | null,
  input: StoreCredentialInput,
  deps: CredentialRepositoryDeps = {},
): Promise<ReplaceCredentialResult> {
  assertServerOnly();
  if (!tenant?.tenantId) return refused("no-authorized-tenant-context");

  const db = (deps.getDb ?? resolveCredentialDbOrNull)();
  if (!db) return refused("persistence-not-configured");

  if (!UUID_RE.test(input.integrationId ?? "")) return refused("invalid-input");
  if (!isCredentialKind(input.kind ?? "")) return refused("invalid-input");
  if (!isUsablePlaintext(input.plaintext)) return refused("invalid-input");

  const keys = resolveKeysOrNull(deps);
  if (!keys) return refused("encryption-not-configured");

  const now = (deps.now ?? (() => new Date()))();
  /* A. Encrypt before any database state changes. */
  const sealed = sealSecret(
    input.plaintext,
    activeKeyOf(keys),
    credentialAad(tenant.tenantId, input.integrationId, input.kind),
  );
  const record = deps.recordEventForTest ?? recordCredentialEventWithin;

  return db.transaction(async (tx) => {
    /* B/C. The live row, locked under the tenant predicate. */
    const [current] = await tx
      .select(METADATA_COLUMNS)
      .from(integrationCredentials)
      .where(
        and(
          ownedBy(tenant),
          eq(integrationCredentials.integrationId, input.integrationId),
          eq(integrationCredentials.kind, input.kind),
          liveOnly(),
        ),
      )
      .limit(1)
      .for("update");

    if (!current) return refused("no-live-credential");

    const attached = await attachCredentialToConnectionWithin(
      tx,
      tenant,
      input.integrationId,
      now,
    );
    if (attached.status === "refused") {
      return refused(
        attached.reason === "illegal-transition" ? "connection-terminal" : "not-found",
      );
    }

    /* D. The old credential stops being live. */
    await tx
      .update(integrationCredentials)
      .set({
        revokedAt: now,
        revokedBy: tenant.userId,
        revokedByType: "human",
        updatedAt: now,
        updatedBy: tenant.userId,
        updatedByType: "human",
        version: sql`${integrationCredentials.version} + 1`,
      })
      .where(ownedRow(tenant, current.id));

    /* TEST-ONLY: the window this ordering is accused of opening, forced open on demand. */
    if (deps.failAfterRevokeForTest) await deps.failAfterRevokeForTest();

    /* E. The new credential becomes the live one. */
    const [row] = await tx
      .insert(integrationCredentials)
      .values({
        tenantId: tenant.tenantId,
        integrationId: input.integrationId,
        kind: input.kind,
        algorithm: sealed.algorithm,
        keyId: sealed.keyId,
        ciphertext: sealed.ciphertext,
        iv: sealed.iv,
        authTag: sealed.authTag,
        expiresAt: input.expiresAt ?? null,
        createdAt: now,
        createdBy: tenant.userId,
        createdByType: "human",
        updatedAt: now,
        updatedBy: tenant.userId,
        updatedByType: "human",
      })
      .returning(METADATA_COLUMNS);

    /* F. The record, inside the same transaction: no committed-but-unaudited replacement. */
    await record(
      tx,
      auditActor(tenant),
      {
        action: CREDENTIAL_AUDIT_REPLACED,
        outcome: "committed",
        entityId: row!.id,
        metadata: {
          integrationId: input.integrationId,
          kind: input.kind,
          algorithm: sealed.algorithm,
          keyId: sealed.keyId,
          previousCredentialId: current.id,
          connectionState: attached.connection.connectionState,
        },
      },
      now,
    );

    /* G. Commit. */
    return {
      status: "replaced",
      credential: toMetadata(row as MetadataRow),
      revokedCredentialId: current.id,
      connectionState: attached.connection.connectionState,
    } as const;
  });
}

/* ── Read ───────────────────────────────────────────────────────────────────── */

/**
 * Every credential this tenant holds for one connection, oldest first — METADATA ONLY.
 *
 * A revoked or destroyed row is still listed. A tenant who replaced a secret three times is
 * entitled to see that history; hiding it would make the audit trail the only place the fact
 * exists, which is a strange place to put a tenant's own record of their own connection.
 */
export async function listCredentialMetadata(
  tenant: TenantContext | null,
  integrationId: string,
  deps: CredentialRepositoryDeps = {},
): Promise<CredentialListing> {
  assertServerOnly();
  if (!tenant?.tenantId) return { status: "unavailable", reason: "no-authorized-tenant-context" };
  if (!UUID_RE.test(integrationId)) return { status: "unavailable", reason: "invalid-input" };

  const db = (deps.getDb ?? resolveCredentialDbOrNull)();
  if (!db) return { status: "unavailable", reason: "persistence-not-configured" };

  const rows = await db
    .select(METADATA_COLUMNS)
    .from(integrationCredentials)
    .where(and(ownedBy(tenant), eq(integrationCredentials.integrationId, integrationId)))
    .orderBy(asc(integrationCredentials.createdAt), asc(integrationCredentials.id))
    .limit(CREDENTIAL_LIMITS.listLimit);

  return { status: "read", credentials: rows.map((row) => toMetadata(row as MetadataRow)) };
}

/**
 * Whether this connection currently holds ANY live credential.
 *
 * Exists so `verifyConnection` can tell its two refusals apart — "there is no credential" and
 * "there is one, and nothing knows how to ask this provider about it" are different facts a tenant
 * deserves to have distinguished. It returns a BOOLEAN and can carry nothing else.
 */
export async function hasLiveCredential(
  tenant: TenantContext | null,
  integrationId: string,
  deps: CredentialRepositoryDeps = {},
): Promise<boolean> {
  assertServerOnly();
  if (!tenant?.tenantId || !UUID_RE.test(integrationId)) return false;

  const db = (deps.getDb ?? resolveCredentialDbOrNull)();
  if (!db) return false;

  const [row] = await db
    .select({ id: integrationCredentials.id })
    .from(integrationCredentials)
    .where(
      and(
        ownedBy(tenant),
        eq(integrationCredentials.integrationId, integrationId),
        liveOnly(),
      ),
    )
    .limit(1);

  return row !== undefined;
}

/* ── Scoped decryption ──────────────────────────────────────────────────────── */

/**
 * THE ONLY PATH TO A PLAINTEXT SECRET IN HEBUN.
 *
 * The secret exists as an argument to a function the caller passed in, and this function returns
 * WHAT THAT CALLBACK RETURNED. There is no `getCredential`, no `decryptCredential`, and no arm of
 * `ScopedSecretResult` capable of carrying a secret back out — so a caller cannot accidentally
 * hold one past the operation that needed it, and cannot store one at all without deliberately
 * writing it somewhere itself.
 *
 * A REVOKED OR DESTROYED CREDENTIAL DOES NOT OPEN. The revoked check is this module's; the
 * destroyed one is also the DATABASE'S, because a destroyed row's ciphertext is the empty string
 * and there is nothing left to decrypt even for someone holding every key.
 *
 * THE ROW'S OWN `key_id` IS USED, never the active one. If that key is not registered the call
 * refuses — trying the others in turn would be an oracle and a way to open a row with the wrong
 * key by accident.
 *
 * WHAT THIS CANNOT PROMISE: erasure. `buf.fill(0)` would narrow the window for a Buffer and does
 * nothing for the string the cipher produces, so the guarantee is a narrow lifetime and no
 * persistence — not zeroization. Nothing here pretends otherwise.
 */
export async function withDecryptedSecret<T>(
  tenant: TenantContext | null,
  credentialId: string,
  scopedOperation: (secret: string) => Promise<T> | T,
  deps: CredentialRepositoryDeps = {},
): Promise<ScopedSecretResult<T>> {
  assertServerOnly();
  if (!tenant?.tenantId) return refused("no-authorized-tenant-context");
  if (!UUID_RE.test(credentialId)) return refused("not-found");

  const db = (deps.getDb ?? resolveCredentialDbOrNull)();
  if (!db) return refused("persistence-not-configured");

  const keys = resolveKeysOrNull(deps);
  if (!keys) return refused("encryption-not-configured");

  const [row] = await db
    .select(SEALED_COLUMNS)
    .from(integrationCredentials)
    .where(ownedRow(tenant, credentialId))
    .limit(1);

  if (!row) return refused("not-found");
  if (row.revokedAt !== null || row.destroyedAt !== null) return refused("credential-not-live");

  const key = keyForRow(keys, row.keyId);
  if (!key) return refused("decryption-failed");

  const sealed: SealedSecret = {
    algorithm: row.algorithm as SealedSecret["algorithm"],
    keyId: row.keyId,
    ciphertext: row.ciphertext,
    iv: row.iv,
    authTag: row.authTag,
  };
  const opened = openSecret(
    sealed,
    key,
    /*
     * The AAD is rebuilt from THIS ROW's identity. A ciphertext moved to another tenant, another
     * connection or another kind fails here even with the right key — the third isolation layer,
     * and the only one that survives a compromised database.
     */
    credentialAad(tenant.tenantId, row.integrationId, row.kind as IntegrationCredentialKind),
  );
  if (!opened.ok) return refused("decryption-failed");

  const value = await scopedOperation(opened.plaintext);
  return { status: "used", value } as const;
}

/* ── End of life ────────────────────────────────────────────────────────────── */

/**
 * The tenant ends a credential. It stays readable as history and can never be opened again.
 *
 * NOT the same act as destruction: a revoked row still holds its ciphertext, which is what makes
 * `destroy` a second, deliberate step rather than a side effect of ending a grant.
 */
export async function revokeCredential(
  tenant: TenantContext | null,
  credentialId: string,
  deps: CredentialRepositoryDeps = {},
): Promise<CredentialTransitionResult> {
  assertServerOnly();
  if (!tenant?.tenantId) return refused("no-authorized-tenant-context");
  if (!UUID_RE.test(credentialId)) return refused("not-found");

  const db = (deps.getDb ?? resolveCredentialDbOrNull)();
  if (!db) return refused("persistence-not-configured");

  const now = (deps.now ?? (() => new Date()))();
  const record = deps.recordEventForTest ?? recordCredentialEventWithin;

  return db.transaction(async (tx) => {
    const [current] = await tx
      .select(METADATA_COLUMNS)
      .from(integrationCredentials)
      .where(ownedRow(tenant, credentialId))
      .limit(1)
      .for("update");

    if (!current) return refused("not-found");
    if (current.revokedAt !== null) return refused("credential-not-live");

    const [row] = await tx
      .update(integrationCredentials)
      .set({
        revokedAt: now,
        revokedBy: tenant.userId,
        revokedByType: "human",
        updatedAt: now,
        updatedBy: tenant.userId,
        updatedByType: "human",
        version: sql`${integrationCredentials.version} + 1`,
      })
      .where(ownedRow(tenant, credentialId))
      .returning(METADATA_COLUMNS);

    if (!row) return refused("not-found");

    await record(
      tx,
      auditActor(tenant),
      {
        action: CREDENTIAL_AUDIT_REVOKED,
        outcome: "committed",
        entityId: row.id,
        metadata: {
          integrationId: row.integrationId,
          kind: row.kind as IntegrationCredentialKind,
          algorithm: row.algorithm,
          keyId: row.keyId,
          previousCredentialId: null,
          connectionState: null,
        },
      },
      now,
    );

    return { status: "revoked" as const, credential: toMetadata(row as MetadataRow) };
  });
}

/**
 * Irreversibly remove the sealed material.
 *
 * DESTRUCTION IS A FACT HERE, NOT A FLAG: the ciphertext, IV and tag are set to the empty string,
 * and `integration_credentials_destroyed_empty_chk` makes a row claiming destruction while still
 * holding material impossible to write. A destroyed credential does not decrypt for anyone,
 * including someone holding every key this deployment has ever had.
 *
 * Revocation first, always — enforced by the database as well as by this branch.
 */
export async function destroyCredential(
  tenant: TenantContext | null,
  credentialId: string,
  deps: CredentialRepositoryDeps = {},
): Promise<CredentialTransitionResult> {
  assertServerOnly();
  if (!tenant?.tenantId) return refused("no-authorized-tenant-context");
  if (!UUID_RE.test(credentialId)) return refused("not-found");

  const db = (deps.getDb ?? resolveCredentialDbOrNull)();
  if (!db) return refused("persistence-not-configured");

  const now = (deps.now ?? (() => new Date()))();
  const record = deps.recordEventForTest ?? recordCredentialEventWithin;

  return db.transaction(async (tx) => {
    const [current] = await tx
      .select(METADATA_COLUMNS)
      .from(integrationCredentials)
      .where(ownedRow(tenant, credentialId))
      .limit(1)
      .for("update");

    if (!current) return refused("not-found");
    if (current.destroyedAt !== null) return refused("credential-not-live");

    const [row] = await tx
      .update(integrationCredentials)
      .set({
        /*
         * A destroyed credential is revoked by definition, and the CHECK agrees. An ALREADY
         * revoked row keeps its original revocation actor and timestamp: overwriting them would
         * rewrite when the grant actually ended, which is the one thing a permanent record must
         * not do.
         */
        ...(current.revokedAt === null
          ? { revokedAt: now, revokedBy: tenant.userId, revokedByType: "human" as const }
          : {}),
        destroyedAt: now,
        ciphertext: "",
        iv: "",
        authTag: "",
        updatedAt: now,
        updatedBy: tenant.userId,
        updatedByType: "human",
        version: sql`${integrationCredentials.version} + 1`,
      })
      .where(ownedRow(tenant, credentialId))
      .returning(METADATA_COLUMNS);

    if (!row) return refused("not-found");

    await record(
      tx,
      auditActor(tenant),
      {
        action: CREDENTIAL_AUDIT_DESTROYED,
        outcome: "committed",
        entityId: row.id,
        metadata: {
          integrationId: row.integrationId,
          kind: row.kind as IntegrationCredentialKind,
          algorithm: row.algorithm,
          keyId: row.keyId,
          previousCredentialId: null,
          connectionState: null,
        },
      },
      now,
    );

    return { status: "destroyed" as const, credential: toMetadata(row as MetadataRow) };
  });
}
