/*
 * integration-authority/integration-repository.server.ts — the ONLY reader and writer of
 * `integrations` (I1).
 *
 * ── THE TENANT CONTRACT ──────────────────────────────────────────────────────
 *
 * NO FUNCTION HERE ACCEPTS A CONNECTION ID WITHOUT A TenantContext, and there is no overload that
 * omits one. `TenantContext` is produced only by `resolveTenantContext()`, which derives the tenant
 * from the durable session row and, in its own words, "never trusts any client-supplied tenant
 * identity". So a caller cannot address a connection it did not authenticate for — not because it
 * is asked not to, but because the signature gives it nowhere to put the attempt.
 *
 * Every query goes through ONE predicate helper, `ownedBy` / `ownedRow`. It is a single expression
 * rather than a copied clause because a predicate copied into six call sites is a predicate that
 * will eventually be five.
 *
 * A FOREIGN ID READS AS NOTHING. `not-found` is returned, never `forbidden`: the difference is
 * itself a disclosure that the row exists somewhere, and this module never makes it. The refusal
 * for a foreign id and for a nonexistent id are the same value, produced by the same branch.
 *
 * ── WHAT THIS MODULE CANNOT DO ───────────────────────────────────────────────
 *
 * It cannot store, read, decrypt or emit a credential — no credential table exists, and it imports
 * nothing that could reach one. It cannot make a network call: it imports no transport, no fetch
 * and no adapter. It cannot verify a connection, because verification means contacting a provider.
 *
 * It therefore CANNOT PRODUCE `connected`, `unverified`, `expired` or `revoked`. That is not a
 * policy — `assertI1Producible` refuses any target outside `I1_PRODUCIBLE_STATES`, and a test
 * proves no argument can reach those states through any exported function. A repository able to
 * write `connected` would be manufacturing the exact truth this subsystem exists to record.
 *
 * It cannot approve, reject, revoke or mint an authorization. It imports neither
 * `action-authorization` nor `action-execution`, and a firewall test walks the real import graph
 * to prove it rather than matching paths.
 *
 * ── WHY `disconnected` IS THE ONE TRANSITION I1 PERFORMS ─────────────────────
 *
 * Ending a connection requires nothing external. It is the one act a tenant must be able to
 * complete against a provider that is unreachable, and refusing it until a provider answers would
 * make a tenant's own records hostage to a third party.
 *
 * Server-only.
 */
import { and, asc, eq, sql } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { integrations } from "@/db/schema/integration";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { findProviderDefinition, PROVIDER_CATALOG } from "@/features/provider-catalog/catalog";
import {
  recordIntegrationLifecycleEventWithin,
  type IntegrationLifecycleAuditAction,
} from "@/features/governance-audit/integration-lifecycle-audit.server";
import {
  canTransition,
  CONNECTION_LIMITS,
  INTEGRATION_AUDIT_CONNECTION_CREATED,
  INTEGRATION_AUDIT_CONNECTION_DISCONNECTED,
  I1_PRODUCIBLE_STATES,
  isTerminalConnectionState,
  type ConnectionHealth,
  type ConnectionListing,
  type ConnectionRefusal,
  type ConnectionState,
  type CreateConnectionInput,
  type CreateConnectionResult,
  type IntegrationView,
  type ProviderCatalog,
  type TransitionConnectionResult,
} from "./contracts";

export interface IntegrationRepositoryDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
  /**
   * Injected so a test can exercise this module against a catalog containing a `connectable`
   * entry, which the RELEASED catalog deliberately does not have. Production leaves it unset.
   */
  readonly catalog?: ProviderCatalog;
}

/** PostgreSQL's unique_violation. Named because a magic string in a catch block ages badly. */
const UNIQUE_VIOLATION = "23505";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Integration authority is server-only.");
  }
}

/** The control-plane database, or an honest `null` when it is not configured. */
function resolveIntegrationDbOrNull(): ControlPlaneDatabase | null {
  if (!process.env.DATABASE_URL?.trim()) return null;
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

/**
 * PostgreSQL `unique_violation`, read from the driver's CODE and never from the message text.
 *
 * The `cause` branch is not padding: drizzle wraps driver errors, so the code sits one level down,
 * and a check that only looked at the top would let a duplicate escape as an unhandled throw.
 */
function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: unknown })?.code;
  if (code === UNIQUE_VIOLATION) return true;
  const cause = (error as { cause?: { code?: unknown } })?.cause;
  return cause?.code === UNIQUE_VIOLATION;
}

/* ── THE ONE TENANT PREDICATE ───────────────────────────────────────────────── */

/**
 * Every row this tenant owns. The single expression every read and write in this module composes
 * with — copying the clause into each call site is how one of them eventually loses it.
 */
function ownedBy(tenant: TenantContext) {
  return eq(integrations.tenantId, tenant.tenantId);
}

/**
 * ONE row this tenant owns. The id and the tenant are in the SAME `and(...)`, so a foreign id
 * matches nothing at all rather than matching a row this module then has to decide about.
 */
function ownedRow(tenant: TenantContext, integrationId: string) {
  return and(eq(integrations.id, integrationId), ownedBy(tenant));
}

/* ── Row → view ─────────────────────────────────────────────────────────────── */

const COLUMNS = {
  id: integrations.id,
  name: integrations.name,
  providerKey: integrations.providerKey,
  connectionState: integrations.connectionState,
  health: integrations.health,
  scopes: integrations.scopes,
  externalAccountId: integrations.externalAccountId,
  externalAccountLabel: integrations.externalAccountLabel,
  lastVerifiedAt: integrations.lastVerifiedAt,
  lastSuccessAt: integrations.lastSuccessAt,
  lastErrorAt: integrations.lastErrorAt,
  failureReason: integrations.failureReason,
  revokedAt: integrations.revokedAt,
  createdAt: integrations.createdAt,
} as const;

type IntegrationRow = {
  readonly id: string;
  readonly name: string;
  readonly providerKey: string | null;
  readonly connectionState: ConnectionState;
  readonly health: ConnectionHealth;
  readonly scopes: string[] | null;
  readonly externalAccountId: string | null;
  readonly externalAccountLabel: string | null;
  readonly lastVerifiedAt: Date | null;
  readonly lastSuccessAt: Date | null;
  readonly lastErrorAt: Date | null;
  readonly failureReason: string | null;
  readonly revokedAt: Date | null;
  readonly createdAt: Date;
};

const iso = (value: Date | null): string | null => (value === null ? null : value.toISOString());

/**
 * The projection every caller receives.
 *
 * It is built from a NAMED COLUMN LIST, never from `select()` — a `SELECT *` would put whatever
 * columns the table grows next into a caller's hands automatically, which is precisely how a
 * credential column would leak the day I2 adds one to a joined table.
 */
export function toIntegrationView(row: IntegrationRow): IntegrationView {
  return {
    integrationId: row.id,
    name: row.name,
    providerKey: row.providerKey,
    connectionState: row.connectionState,
    health: row.health,
    scopes: Object.freeze([...(row.scopes ?? [])]),
    externalAccountId: row.externalAccountId,
    externalAccountLabel: row.externalAccountLabel,
    lastVerifiedAt: iso(row.lastVerifiedAt),
    lastSuccessAt: iso(row.lastSuccessAt),
    lastErrorAt: iso(row.lastErrorAt),
    failureReason: row.failureReason,
    revokedAt: iso(row.revokedAt),
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * The one refusal constructor.
 *
 * It returns the refusal ARM itself, not a cast to some result union, so every refusal in this
 * module is the same shape and no call site can assert its way into a `created` or `transitioned`
 * result it did not build.
 */
function refused(reason: ConnectionRefusal): {
  readonly status: "refused";
  readonly reason: ConnectionRefusal;
} {
  return { status: "refused", reason } as const;
}

/* ── Validation ─────────────────────────────────────────────────────────────── */

function isUsableName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > CONNECTION_LIMITS.nameMaxLength) return false;
  // Control characters would render as invisible content on any surface that shows the name.
  return !/[\u0000-\u001f\u007f]/.test(trimmed);
}

/**
 * THE PHASE BOUNDARY, AS A MECHANISM.
 *
 * Any target state outside `I1_PRODUCIBLE_STATES` is unreachable through this module. It is
 * checked here rather than promised in a comment so that adding a code path to `connected` fails
 * at this line instead of shipping.
 */
function isI1Producible(state: ConnectionState): boolean {
  return I1_PRODUCIBLE_STATES.includes(state);
}

/* ── Create ─────────────────────────────────────────────────────────────────── */

/**
 * Record a connection. It creates METADATA and nothing else.
 *
 * The row lands in `draft`, with `health = 'unknown'`, no scopes, no external account and no
 * verification timestamp — because none of those has happened. There is no argument, no dependency
 * and no code path by which this function could produce any other state.
 *
 * `provider_key` must name a `connectable` catalog entry. A `fixture` entry is refused with its own
 * reason: the definition is real and Hebun genuinely cannot connect to it, which is a different
 * fact from an unknown key and a tenant deserves to be told which.
 */
export async function createConnection(
  tenant: TenantContext | null,
  input: CreateConnectionInput,
  deps: IntegrationRepositoryDeps = {},
): Promise<CreateConnectionResult> {
  assertServerOnly();
  if (!tenant?.tenantId) return refused("no-authorized-tenant-context");

  const db = (deps.getDb ?? resolveIntegrationDbOrNull)();
  if (!db) return refused("persistence-not-configured");

  const name = input.name?.trim() ?? "";
  const providerKey = input.providerKey?.trim() ?? "";
  if (!isUsableName(name) || providerKey.length === 0) return refused("invalid-input");

  const catalog = deps.catalog ?? PROVIDER_CATALOG;
  const definition = findProviderDefinition(providerKey, catalog);
  if (!definition) return refused("unknown-provider");
  if (definition.connectivity !== "connectable") return refused("provider-not-connectable");

  const now = (deps.now ?? (() => new Date()))();

  /* `draft` and nothing else — asserted, not assumed. */
  const nextState: ConnectionState = "draft";
  if (!isI1Producible(nextState)) return refused("illegal-transition");

  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(integrations)
        .values({
          tenantId: tenant.tenantId,
          name,
          providerKey: definition.providerKey,
          connectionState: nextState,
          health: "unknown",
          createdAt: now,
          createdBy: tenant.userId,
          createdByType: "human",
          updatedAt: now,
          updatedBy: tenant.userId,
          updatedByType: "human",
        })
        .returning(COLUMNS);

      /*
       * The audit joins THIS transaction, so "recorded" and "history says recorded" are one fact.
       * A failing audit insert aborts the connection rather than leaving an unaudited row.
       */
      await recordIntegrationLifecycleEventWithin(
        tx,
        auditActor(tenant),
        {
          action: INTEGRATION_AUDIT_CONNECTION_CREATED,
          outcome: "committed",
          entityId: row!.id,
          metadata: {
            providerKey: definition.providerKey,
            previousState: null,
            nextState,
            credentialStored: false,
            verified: false,
          },
        },
        now,
      );

      return { status: "created", connection: toIntegrationView(row as IntegrationRow) } as const;
    });
  } catch (error) {
    /*
     * The partial unique index fired: this tenant already holds a non-terminal connection for that
     * provider and external account. A well-formed request that lost to an existing fact, which is
     * a different thing from malformed input and gets its own reason.
     */
    if (isUniqueViolation(error)) return refused("duplicate-live-connection");
    throw error;
  }
}

function auditActor(tenant: TenantContext) {
  return {
    tenantId: tenant.tenantId,
    userId: tenant.userId,
    requestId: tenant.requestId,
    sessionContextId: tenant.sessionContextId,
  };
}

/* ── Read ───────────────────────────────────────────────────────────────────── */

/**
 * One connection this tenant owns, or `null`.
 *
 * A foreign id and a nonexistent id both return `null`, from the same branch. There is no code
 * path that could tell them apart, so there is none that could disclose the difference.
 */
export async function readConnection(
  tenant: TenantContext | null,
  integrationId: string,
  deps: IntegrationRepositoryDeps = {},
): Promise<IntegrationView | null> {
  assertServerOnly();
  if (!tenant?.tenantId) return null;
  if (!UUID_RE.test(integrationId)) return null;

  const db = (deps.getDb ?? resolveIntegrationDbOrNull)();
  if (!db) return null;

  const [row] = await db
    .select(COLUMNS)
    .from(integrations)
    .where(ownedRow(tenant, integrationId))
    .limit(1);

  return row ? toIntegrationView(row as IntegrationRow) : null;
}

/** Every connection this tenant owns, oldest first. Bounded so a listing is never a data export. */
export async function listConnections(
  tenant: TenantContext | null,
  deps: IntegrationRepositoryDeps = {},
): Promise<ConnectionListing> {
  assertServerOnly();
  if (!tenant?.tenantId) return { status: "unavailable", reason: "no-authorized-tenant-context" };

  const db = (deps.getDb ?? resolveIntegrationDbOrNull)();
  if (!db) return { status: "unavailable", reason: "persistence-not-configured" };

  const rows = await db
    .select(COLUMNS)
    .from(integrations)
    .where(ownedBy(tenant))
    .orderBy(asc(integrations.createdAt), asc(integrations.id))
    .limit(CONNECTION_LIMITS.listLimit);

  return {
    status: "read",
    connections: rows.map((row) => toIntegrationView(row as IntegrationRow)),
  };
}

/* ── Disconnect ─────────────────────────────────────────────────────────────── */

/**
 * The tenant ends a connection in Hebun. THE ONLY LIFECYCLE TRANSITION I1 PERFORMS.
 *
 * It requires nothing external, which is the point: a tenant must be able to end their own record
 * even when the provider is unreachable. It makes no claim about the provider's side — a grant may
 * well still exist there, and `revoked` (which would say the provider ended it) is a different
 * state this function cannot reach.
 *
 * Terminal is terminal. A row already `revoked` or `disconnected` refuses, so one row can never
 * hold two grants, and the audit trail can always say when a grant actually existed.
 *
 * The UPDATE carries the tenant predicate too. Reading the row first and then updating by id alone
 * would leave a window in which the check and the write disagree; here the write itself can only
 * ever touch a row this tenant owns.
 */
export async function disconnectConnection(
  tenant: TenantContext | null,
  integrationId: string,
  deps: IntegrationRepositoryDeps = {},
): Promise<TransitionConnectionResult> {
  assertServerOnly();
  if (!tenant?.tenantId) return refused("no-authorized-tenant-context");
  if (!UUID_RE.test(integrationId)) return refused("not-found");

  const db = (deps.getDb ?? resolveIntegrationDbOrNull)();
  if (!db) return refused("persistence-not-configured");

  const now = (deps.now ?? (() => new Date()))();
  const nextState: ConnectionState = "disconnected";
  if (!isI1Producible(nextState)) return refused("illegal-transition");

  return db.transaction(async (tx) => {
    const [current] = await tx
      .select(COLUMNS)
      .from(integrations)
      .where(ownedRow(tenant, integrationId))
      .limit(1);

    if (!current) return refused("not-found");

    const from = current.connectionState as ConnectionState;
    if (isTerminalConnectionState(from) || !canTransition(from, nextState)) {
      return refused("illegal-transition");
    }

    const [row] = await tx
      .update(integrations)
      .set({
        connectionState: nextState,
        /*
         * Health is reset, never overwritten with a claim. Ending a record says nothing about
         * whether the provider was healthy, so the honest value is "we no longer know".
         */
        health: "unknown",
        revokedAt: now,
        updatedAt: now,
        updatedBy: tenant.userId,
        updatedByType: "human",
        version: sql`${integrations.version} + 1`,
      })
      .where(ownedRow(tenant, integrationId))
      .returning(COLUMNS);

    if (!row) return refused("not-found");

    await recordIntegrationLifecycleEventWithin(
      tx,
      auditActor(tenant),
      {
        action: INTEGRATION_AUDIT_CONNECTION_DISCONNECTED satisfies IntegrationLifecycleAuditAction,
        outcome: "committed",
        entityId: row.id,
        metadata: {
          providerKey: row.providerKey ?? "",
          previousState: from,
          nextState,
          credentialStored: false,
          verified: false,
        },
      },
      now,
    );

    return {
      status: "transitioned",
      connection: toIntegrationView(row as IntegrationRow),
    } as const;
  });
}

/* ── The credential seam (INT-2) ─────────────────────────────────────────────── */

/**
 * A transaction handle this module can compose its own predicate onto — the same technique the
 * audit writer uses to join a caller's transaction.
 */
type IntegrationTransaction = Parameters<Parameters<ControlPlaneDatabase["transaction"]>[0]>[0];

export type AttachCredentialResult =
  | {
      readonly status: "attached";
      readonly connection: IntegrationView;
      /** `true` when this call moved the lifecycle, `false` when it was already `unverified`. */
      readonly transitioned: boolean;
    }
  | { readonly status: "refused"; readonly reason: ConnectionRefusal };

/**
 * WHAT A CREDENTIAL WRITE DOES TO A CONNECTION — and the reason it lives HERE.
 *
 * `integration-credentials` must never import the `integrations` table. A released firewall test
 * asserts that exactly ONE module in this repository names it, and that single-writer property is
 * worth more than the convenience of a second writer: two modules updating one lifecycle is how a
 * state machine stops being one.
 *
 * So the credential authority calls this, inside its own transaction, and the lifecycle stays the
 * property of the module that owns it.
 *
 * ── WHY IT LOCKS ─────────────────────────────────────────────────────────────
 *
 * `FOR UPDATE` under the tenant predicate. Two concurrent credential writes against one connection
 * would otherwise read the same state, both decide to transition, and both write — harmless today
 * and exactly the shape that stops being harmless when a state machine grows a third writer.
 *
 * ── WHY `unverified` AND NEVER `connected` ───────────────────────────────────
 *
 * A supplied secret is an UNPROVEN secret. Reaching `connected` requires a provider to answer, and
 * this function neither makes nor imports a network call. `assertI1Producible` refuses anything
 * outside the producible set, so the claim is mechanical rather than editorial.
 */
export async function attachCredentialToConnectionWithin(
  tx: IntegrationTransaction,
  tenant: TenantContext,
  integrationId: string,
  now: Date,
): Promise<AttachCredentialResult> {
  assertServerOnly();
  if (!tenant?.tenantId) return refused("no-authorized-tenant-context");
  if (!UUID_RE.test(integrationId)) return refused("not-found");

  const [current] = await tx
    .select(COLUMNS)
    .from(integrations)
    .where(ownedRow(tenant, integrationId))
    .limit(1)
    .for("update");

  /* A foreign id and an absent id are one branch, exactly as everywhere else in this module. */
  if (!current) return refused("not-found");

  const from = current.connectionState as ConnectionState;
  /* A terminal record takes no new secrets. Reconnecting creates a NEW connection row. */
  if (isTerminalConnectionState(from)) return refused("illegal-transition");

  const nextState: ConnectionState = "unverified";
  if (from === nextState) {
    return {
      status: "attached",
      connection: toIntegrationView(current as IntegrationRow),
      transitioned: false,
    } as const;
  }
  if (!canTransition(from, nextState) || !isI1Producible(nextState)) {
    return refused("illegal-transition");
  }

  const [row] = await tx
    .update(integrations)
    .set({
      connectionState: nextState,
      /*
       * Health is RESET, never asserted. A new secret says nothing about whether the provider is
       * answering, and carrying the old observation forward would attach a stale `healthy` to a
       * connection nobody has tried since.
       */
      health: "unknown",
      /* Verification is undone by definition: the thing that was verified has been replaced. */
      lastVerifiedAt: null,
      updatedAt: now,
      updatedBy: tenant.userId,
      updatedByType: "human",
      version: sql`${integrations.version} + 1`,
    })
    .where(ownedRow(tenant, integrationId))
    .returning(COLUMNS);

  if (!row) return refused("not-found");
  return {
    status: "attached",
    connection: toIntegrationView(row as IntegrationRow),
    transitioned: true,
  } as const;
}

/* ── The verification writer (INT-3) ────────────────────────────────────────── */

/**
 * WHAT A REAL PROVIDER RESPONSE IS ALLOWED TO WRITE.
 *
 * `scopes`, `external_account_id`, `external_account_label` and `last_verified_at` had NO WRITER
 * through INT-1 and INT-2 — they were readable columns waiting for the phase that could fill them
 * honestly. This is that writer, and it is the only one.
 *
 * It lives here because this module is the single owner of the `integrations` table, and a released
 * firewall test asserts exactly one module imports it. The Google verifier therefore calls this
 * rather than reaching the table itself.
 */
export interface VerifiedConnectionFacts {
  /** The provider's immutable account identifier. NEVER an email — those get reassigned. */
  readonly externalAccountId: string;
  /** Human-readable. A label, never an identity. */
  readonly externalAccountLabel: string;
  /** What the PROVIDER said it granted. Never what Hebun requested. */
  readonly grantedScopes: readonly string[];
}

export type RecordVerifiedResult =
  | { readonly status: "verified"; readonly connection: IntegrationView }
  | { readonly status: "refused"; readonly reason: ConnectionRefusal | "account-changed" };

/**
 * Record that a provider accepted this tenant's credential.
 *
 * THE ONLY PATH TO `connected` IN HEBUN. Every precondition is checked here rather than trusted
 * from the caller: the row is this tenant's, it is not terminal, and the transition is legal.
 *
 * ── THE ACCOUNT MAY NOT CHANGE UNDERNEATH A CONNECTION ───────────────────────
 *
 * If the row already names an external account and the provider now reports a DIFFERENT one, this
 * refuses with `account-changed`. Silently rebinding would mean a tenant who authorized account A
 * ends up with a connection to account B — the exact substitution an OAuth flow must never allow
 * to pass unnoticed. Connecting a different account is a NEW connection, not an update.
 *
 * ── HEALTH MOVES WITH IT, BECAUSE THIS IS THE ONE MOMENT BOTH ARE KNOWN ──────
 *
 * A successful verification is the only event that establishes lifecycle AND health together:
 * Hebun holds a grant, and the provider just answered. `healthy` is written here and nowhere else
 * in this module.
 */
export async function recordVerifiedConnectionWithin(
  tx: IntegrationTransaction,
  tenant: TenantContext,
  integrationId: string,
  facts: VerifiedConnectionFacts,
  now: Date,
): Promise<RecordVerifiedResult> {
  assertServerOnly();
  if (!tenant?.tenantId) return refused("no-authorized-tenant-context");
  if (!UUID_RE.test(integrationId)) return refused("not-found");

  const [current] = await tx
    .select(COLUMNS)
    .from(integrations)
    .where(ownedRow(tenant, integrationId))
    .limit(1)
    .for("update");

  if (!current) return refused("not-found");

  const from = current.connectionState as ConnectionState;
  if (isTerminalConnectionState(from)) return refused("illegal-transition");

  /* The account this connection was verified against before, if any. */
  if (
    current.externalAccountId !== null &&
    current.externalAccountId !== facts.externalAccountId
  ) {
    return { status: "refused", reason: "account-changed" } as const;
  }

  const nextState: ConnectionState = "connected";
  if (!isI1Producible(nextState)) return refused("illegal-transition");
  /* `connected → connected` is a re-verification, not a transition, and the table has no such arc. */
  if (from !== nextState && !canTransition(from, nextState)) return refused("illegal-transition");

  const [row] = await tx
    .update(integrations)
    .set({
      connectionState: nextState,
      health: "healthy",
      scopes: [...facts.grantedScopes],
      externalAccountId: facts.externalAccountId,
      externalAccountLabel: facts.externalAccountLabel,
      /* Set ONLY here. A successful data read must never write it, or "verified" degrades into
       * "we talked to them recently". */
      lastVerifiedAt: now,
      lastSuccessAt: now,
      lastErrorAt: null,
      failureReason: null,
      updatedAt: now,
      updatedBy: tenant.userId,
      updatedByType: "human",
      version: sql`${integrations.version} + 1`,
    })
    .where(ownedRow(tenant, integrationId))
    .returning(COLUMNS);

  if (!row) return refused("not-found");
  return { status: "verified", connection: toIntegrationView(row as IntegrationRow) } as const;
}

/**
 * WHAT A FAILED VERIFICATION IS ALLOWED TO WRITE — and the two classes are not interchangeable.
 *
 *   `auth`       the provider definitively refused the credential Hebun holds. The GRANT is the
 *                thing that failed, so the lifecycle moves to `expired`: unusable, unrestorable
 *                from what Hebun has, and needing re-consent. NOT `revoked` — see `contracts.ts`.
 *   everything   a 429, a 5xx, a timeout, a DNS or TLS failure, an unparseable body. NOTHING is
 *   else        known about the grant, so ONLY health moves and the lifecycle is untouched.
 *
 * That second line is the whole reason health exists as a separate dimension. A provider having a
 * bad minute must never end a tenant's connection.
 */
export type VerificationFailureClass = "auth" | "degraded" | "unreachable";

export async function recordVerificationFailureWithin(
  tx: IntegrationTransaction,
  tenant: TenantContext,
  integrationId: string,
  failure: { readonly kind: VerificationFailureClass; readonly reason: string },
  now: Date,
): Promise<TransitionConnectionResult> {
  assertServerOnly();
  if (!tenant?.tenantId) return refused("no-authorized-tenant-context");
  if (!UUID_RE.test(integrationId)) return refused("not-found");

  const [current] = await tx
    .select(COLUMNS)
    .from(integrations)
    .where(ownedRow(tenant, integrationId))
    .limit(1)
    .for("update");

  if (!current) return refused("not-found");
  const from = current.connectionState as ConnectionState;
  if (isTerminalConnectionState(from)) return refused("illegal-transition");

  const authClass = failure.kind === "auth";
  const nextState: ConnectionState = authClass ? "expired" : from;
  if (authClass && from !== nextState && !canTransition(from, nextState)) {
    return refused("illegal-transition");
  }
  if (authClass && !isI1Producible(nextState)) return refused("illegal-transition");

  const [row] = await tx
    .update(integrations)
    .set({
      connectionState: nextState,
      /*
       * `unreachable` and `degraded` are OBSERVATIONS about the provider. On an auth failure the
       * provider answered perfectly well — what failed was the credential — so health becomes
       * `unknown` rather than claiming an outage that did not happen.
       */
      health: authClass ? "unknown" : failure.kind === "unreachable" ? "unreachable" : "degraded",
      lastErrorAt: now,
      /* A CLASSIFIED reason from the transport. Never a provider body, never a token. */
      failureReason: failure.reason,
      updatedAt: now,
      updatedBy: tenant.userId,
      updatedByType: "human",
      version: sql`${integrations.version} + 1`,
    })
    .where(ownedRow(tenant, integrationId))
    .returning(COLUMNS);

  if (!row) return refused("not-found");
  return {
    status: "transitioned",
    connection: toIntegrationView(row as IntegrationRow),
  } as const;
}
