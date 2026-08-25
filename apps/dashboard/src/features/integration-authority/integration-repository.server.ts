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
import { sql } from "drizzle-orm";
import { type ControlPlaneDatabase } from "@/db/client.server";
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
  type ConnectionRefusal,
  type ConnectionState,
  type CreateConnectionInput,
  type CreateConnectionResult,
  type IntegrationView,
  type TransitionConnectionResult,
} from "./contracts";
/*
 * INT-5A — the reads now live in a writer-free module so a read-only consumer (Heby, via the
 * capability-availability seam) never holds a reference into this one. They are RE-EXPORTED below
 * so every existing caller imports exactly what it imported before.
 */
import {
  assertServerOnly,
  COLUMNS,
  ownedRow,
  resolveIntegrationDbOrNull,
  toIntegrationView,
  UUID_RE,
  type IntegrationRepositoryDeps,
  type IntegrationRow,
} from "./integration-read.server";

export {
  listConnections,
  readConnection,
  toIntegrationView,
} from "./integration-read.server";
export type { IntegrationRepositoryDeps } from "./integration-read.server";


/** PostgreSQL's unique_violation. Named because a magic string in a catch block ages badly. */
const UNIQUE_VIOLATION = "23505";

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

/**
 * THE PROVIDER-REFRESH HOLD (INT-4). IT VALIDATES AND LOCKS; IT WRITES NOTHING.
 *
 * ── THE DEFECT THIS EXISTS TO CORRECT ───────────────────────────────────────
 *
 * `attachCredentialToConnectionWithin` demotes a non-terminal connection to `unverified` on every
 * credential write, resets health and clears `last_verified_at`. That is exactly right for a
 * SUPPLIED secret: a human or a re-consent handed Hebun something new, and nothing has proved it.
 *
 * It is WRONG for a refresh-derived token. The provider has just answered — honouring the refresh
 * IS the provider saying the grant is intact — and the new access token is derived from a grant
 * that was already verified. Demoting there made the first token expiry silently disable every
 * capability the connection carried, until a human re-consented. A capability that works for an
 * hour and then stops without saying why.
 *
 * ── WHY IT IS A SEPARATE FUNCTION AND NOT A FLAG ────────────────────────────
 *
 * A `preserveConnectionState` boolean would be reachable from every existing caller, and the rule
 * it suspends is the one that stops an unproven secret looking proven. A distinct function is a
 * distinct INTENT: a firewall test can enumerate who may call it, which is impossible for an
 * argument.
 *
 * ── WHAT IT CANNOT DO, MECHANICALLY ─────────────────────────────────────────
 *
 * It contains NO `update`. Not "it updates carefully" — there is no write statement in its body, so
 * it cannot move a lifecycle, cannot mint `connected`, cannot alter health and cannot invent
 * verification evidence. The strongest version of "preserves the connection state" is a function
 * with no way to change it.
 *
 * It still LOCKS, under the tenant predicate, so the concurrency guarantee that made the demoting
 * path safe is unchanged: a refresh and a re-consent cannot interleave and disagree.
 *
 * ── WHY `draft` IS REFUSED ──────────────────────────────────────────────────
 *
 * A refresh is derived from an existing grant. A `draft` connection has never held a credential —
 * storing one is what moves it to `unverified` — so a refresh against a draft row describes a
 * sequence that cannot have happened. Refusing it costs nothing and closes the only shape in which
 * this function could be used to carry a connection forward from nothing.
 */
export async function holdConnectionForProviderRefreshWithin(
  tx: IntegrationTransaction,
  tenant: TenantContext,
  integrationId: string,
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
  /* A terminal record takes no new secrets, refreshed or otherwise. Terminal stays terminal. */
  if (isTerminalConnectionState(from)) return refused("illegal-transition");
  /* See the header: a refresh cannot precede the credential it is derived from. */
  if (from === "draft") return refused("illegal-transition");

  /*
   * NO UPDATE. The row is returned exactly as it was read — same state, same health, same
   * `last_verified_at`, same version. `transitioned: false` is therefore not a decision this
   * function made; it is the only answer it is capable of giving.
   */
  return {
    status: "attached",
    connection: toIntegrationView(current as IntegrationRow),
    transitioned: false,
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
 * A CONNECTION NOW HAS A PROVIDER-SIDE GRANT THAT NOTHING HAS CONFIRMED — and no secret was
 * supplied to say so.
 *
 * ── WHY THIS EXISTS ALONGSIDE `attachCredentialToConnectionWithin` ───────────
 *
 * Both land on `unverified`, and that is the whole point: `unverified` already means "something
 * was supplied and nothing has confirmed it". What differs is WHAT was supplied.
 *
 * Google supplies a SECRET, and its transition is written by the credential authority — which is
 * why that function's every line is about a secret: health reset because "a new secret says
 * nothing about whether the provider is answering", verification undone because "the thing that
 * was verified has been replaced".
 *
 * GitHub supplies NO SECRET AT ALL. An App installation is a fact held on GitHub's side; the
 * tenant hands Hebun an installation id, which is an identifier and not a credential. Calling
 * `attachCredentialToConnectionWithin` from that flow would be a false statement at the call site
 * — a credential write with no credential — and `draft → connected` is not an arc in
 * `CONNECTION_TRANSITIONS`, so the hop cannot simply be skipped either.
 *
 * So: a sibling, in THIS module, so the lifecycle keeps exactly one owner. The released
 * single-writer property is the thing worth protecting, not the number of functions.
 *
 * ── IT WRITES NO IDENTITY, DELIBERATELY ──────────────────────────────────────
 *
 * `external_account_id` stays untouched. The installation id that arrived in the callback is
 * UNTRUSTED at this point, and writing it here would put an attacker-supplied value in the column
 * that identifies the connection — and would then make `recordVerifiedConnectionWithin`'s
 * account-change refusal compare the provider's answer against the attacker's claim instead of
 * against nothing. Identity is written once, by verification, from the provider's own response.
 *
 * ── WHY IT LOCKS ─────────────────────────────────────────────────────────────
 *
 * `FOR UPDATE` under the tenant predicate, exactly as its sibling does. Two concurrent setup
 * callbacks against one connection would otherwise both read `draft` and both write.
 */
export async function recordUnverifiedProviderGrantWithin(
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
  /* A terminal record takes no new grants. Reconnecting creates a NEW connection row. */
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
       * Health is RESET, never asserted. A new grant says nothing about whether the provider is
       * answering, and carrying an old observation forward would attach a stale `healthy` to a
       * connection nobody has confirmed since.
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
