/*
 * standing-observation-authority/observation-principal.server.ts — the EPHEMERAL bounded
 * observation principal, and the only place one can come into being (TRH-23 / TRH-22 design).
 *
 * ── WHAT THIS IS ─────────────────────────────────────────────────────────────
 *
 * A non-human principal that exists for the duration of one invocation and is thrown away. It is
 * not a user, not a membership, not a session, not a service account and not a credential holder.
 * Nothing about it is persisted; there is no principal table and no column anywhere that names one.
 *
 * Every field it carries is READ OFF AN ACTIVE STANDING AUTHORIZATION ROW. There is no parameter
 * through which a caller can supply a tenant, a provider, a capability, a subject or a connection —
 * the only argument is the id of the authorization itself, and everything else is what that row
 * says. This is the whole answer to "how does a future trigger obtain trusted tenant identity": it
 * does not supply one. It names an authorization, and the tenant is a property of that row.
 *
 * ── WHAT IT IS NOT, AND WHY THE TYPE SAYS SO ─────────────────────────────────
 *
 * It is DELIBERATELY NOT a `TenantContext` and not a subtype of one. PRINCIPAL-FW-1 made
 * `TenantContext` nominally human precisely so that a future machine principal would be a DIFFERENT
 * type and therefore structurally unable to reach the 87 call sites that stamp `actor_type = 'human'`
 * from it. This is that different type. It cannot be passed to a Governance writer, a Work writer,
 * a Knowledge admission seam, an execution runtime or a credential writer — not because each of them
 * checks, but because none of them can be called with it.
 *
 * What it CAN reach is the narrow set of reads that were measured to need a tenant and nothing else,
 * and which TRH-23 narrowed on purpose: capability availability, connection listing and credential
 * METADATA — plus, since TRH-24, the released provider-READ path described below.
 *
 * ── THE CREDENTIAL BOUNDARY, AS IT NOW STANDS (TRH-24) ───────────────────────
 *
 * `withDecryptedSecret` still takes the full branded human context and was NOT narrowed. This
 * principal therefore still cannot name a credential and open it — that remains the single most
 * important line in the released firewall, because narrowing it would let a principal decrypt any
 * live credential its tenant holds, a Google refresh token included.
 *
 * What TRH-24 added instead is a STRICTLY NARROWER sibling, `withConnectionScopedSecret`: it takes a
 * connection and a KIND, has NO credential parameter at all, refuses rather than choosing when a
 * connection holds two live credentials of that kind, and confines the plaintext to one callback
 * frame. So the accurate statement is not "this principal cannot open a secret" — it is that it can
 * never ASK FOR a secret, only spend the one the authorization's own connection holds for the
 * authorized purpose, inside a frame it cannot see out of.
 *
 * THE PRINCIPAL ITSELF CARRIES NO CREDENTIAL. Nothing on this interface is or exposes secret
 * material; decryption stays inside the credential authority and no plaintext is ever returned
 * through a principal.
 *
 * ── THE BRAND IS A RUNTIME SYMBOL ────────────────────────────────────────────
 *
 * Module-private and never exported, so no other module can write the key into an object literal,
 * and it exists at RUNTIME so a type cast cannot forge one either. This is the technique
 * `AgentProposer` and `AgentAuthorship` already use for the same reason.
 *
 * ── MINTING IS NOT AUTHORIZATION, AND HOLDING ONE IS NOT PERMISSION ──────────
 *
 * A principal is EVIDENCE THAT AN ACTIVE AUTHORIZATION WAS READ. It is not a decision that a read
 * may now happen: the authoritative check runs immediately before provider transport, in
 * `revalidate-standing-observation.server.ts`, and re-reads everything this mint saw. A principal
 * minted at 11:59:59 and revalidated at 12:00:01 against a withdrawn authorization is refused —
 * which is why nothing here caches, and why the principal carries no expiry of its own to become
 * stale in a way somebody could trust.
 *
 * ── WHAT CALLS IT, AND WHAT STILL DOES NOT (TRH-24) ──────────────────────────
 *
 * There IS now a provider transport caller. TRH-24 released one composition —
 * `provider-observation-history/observe-once-under-authorization.server.ts` — which mints a
 * principal here, revalidates it immediately before transport, performs ONE provider READ through
 * the authorized connection's key, and records ONE observation whose human actor pair is NULL. A
 * valid principal may participate in that path and in no other.
 *
 * WHAT THE PRINCIPAL STILL GRANTS IS NOTHING ELSE. It cannot be passed to a Governance writer, a
 * Work writer, a Knowledge admission seam, an execution runtime or a credential writer — not
 * because each of them checks, but because none of them can be called with it. It reaches no
 * provider WRITE either: the transport it participates in issues a single `GET`, and one condition
 * of the pre-transport check refuses a capability that is not read-only.
 *
 * AND THERE IS STILL NO TRIGGER AND NO SCHEDULER. The composition's only caller anywhere in this
 * repository is an operator terminal ceremony that requires a typed confirmation. There is no cron,
 * no worker, no queue, no webhook and no HTTP ingress that can reach it. This module makes a
 * non-human actor REPRESENTABLE and safely constructible, and TRH-24 made ONE MANUAL machine
 * observation possible. Neither makes UNATTENDED observation authorized, scheduled or possible.
 *
 * Server-only.
 */
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { standingObservationAuthorizations } from "@/db/schema/standing-observation-authorization";
import { isObservableCapability } from "./contracts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/*
 * The brand. Module-private ON PURPOSE — never exported, so no other module can write this key into
 * an object literal, and it exists at RUNTIME so a type cast cannot forge one either.
 */
const OBSERVATION_PRINCIPAL_BRAND: unique symbol = Symbol(
  "hebun.standing-observation-authority.observation-principal",
);

/**
 * A bounded, ephemeral, non-human principal for ONE invocation of ONE authorized observation scope.
 *
 * Obtainable ONLY from `mintObservationPrincipal`. Every field below is server-derived from the
 * active authorization row; none is caller-supplied and none may be substituted.
 */
export interface ObservationPrincipal {
  /** From the authorization ROW. This is the trusted tenant identity, and its only source. */
  readonly tenantId: string;
  /** The exact revision this principal is acting under. */
  readonly authorizationId: string;
  readonly authorizationRevision: number;
  readonly providerKey: string;
  readonly capabilityKey: string;
  readonly subjectKind: string;
  readonly subjectRef: string;
  /** The connection the authorization named. Never chosen at invocation time. */
  readonly integrationId: string;
  /** The cadence CEILING the authorization carries. Carried for auditability; enforces nothing. */
  readonly intervalMinutes: number;
  /**
   * THIS RUN. Minted here and, since TRH-24, STORED on the observation it produces — as provenance
   * beside the standing authorization, under a partial unique index so one invocation can never
   * yield two samples. It is correlation, never authority: two invocations with different ids have
   * exactly the same (zero) authority, and no principal is persisted anywhere.
   */
  readonly invocationId: string;
  readonly [OBSERVATION_PRINCIPAL_BRAND]: true;
}

/**
 * Why no principal could be minted. Closed, and each value is a fact about the authorization rather
 * than a judgement about the observation.
 */
export type ObservationPrincipalRefusal =
  | "invalid-authorization-id"
  | "persistence-unavailable"
  /** No such authorization. A wrong id and another tenant's id are indistinguishable here. */
  | "authorization-unknown"
  /**
   * The named revision is not the effective one — a later revision exists for this lineage.
   *
   * DISTINCT FROM `authorization-withdrawn` on purpose: a stale ACTIVE revision is just as unusable
   * as a withdrawn one, and collapsing them would hide the case where somebody holds an id that was
   * valid when they read it and is now superseded by a narrower grant.
   */
  | "authorization-superseded"
  /** The effective revision for this lineage says `withdrawn`. */
  | "authorization-withdrawn"
  /**
   * The stored scope is not in the released observable allow-list.
   *
   * This can only happen if the allow-list was NARROWED after the authorization was written, and it
   * fails closed on purpose: a row does not keep its permission because it was legal when written.
   */
  | "capability-not-observable";

export type MintObservationPrincipalResult =
  | { readonly status: "minted"; readonly principal: ObservationPrincipal }
  | { readonly status: "refused"; readonly reason: ObservationPrincipalRefusal };

export interface ObservationPrincipalDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  /** Injectable so a test can pin the invocation identity. Never reaches a database column. */
  readonly newInvocationId?: () => string;
}

/**
 * Whether a value really came from this module.
 *
 * The consumer's guard. A `value as ObservationPrincipal` cast satisfies the compiler and fails
 * HERE, which is the whole reason the brand exists at runtime rather than only in the type system.
 */
export function isObservationPrincipal(value: unknown): value is ObservationPrincipal {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<PropertyKey, unknown>)[OBSERVATION_PRINCIPAL_BRAND] === true &&
    typeof (value as ObservationPrincipal).tenantId === "string" &&
    typeof (value as ObservationPrincipal).authorizationId === "string" &&
    typeof (value as ObservationPrincipal).invocationId === "string"
  );
}

function resolveDbOrNull(deps: ObservationPrincipalDeps): ControlPlaneDatabase | null {
  if (deps.getDb) return deps.getDb();
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

/**
 * Mint the ephemeral principal for one authorization revision.
 *
 * THE ONLY ARGUMENT IS THE AUTHORIZATION'S OWN ID. There is deliberately no tenant parameter: a
 * caller that could name a tenant could choose one, and "the trigger says `tenantId = X` and thereby
 * gains X" is the exact attack the design exists to prevent. The tenant is whatever the row says.
 *
 * The named revision must BE the effective revision of its lineage, and that effective revision must
 * be `active`. Both are re-read here, from the database, every time — nothing is cached and there is
 * no in-memory state this function could be poisoned through.
 */
export async function mintObservationPrincipal(
  authorizationId: string,
  deps: ObservationPrincipalDeps = {},
): Promise<MintObservationPrincipalResult> {
  if (typeof window !== "undefined") {
    throw new Error("Observation principals are server-only.");
  }
  const id = typeof authorizationId === "string" ? authorizationId.trim() : "";
  if (!UUID_RE.test(id)) return { status: "refused", reason: "invalid-authorization-id" };

  const db = resolveDbOrNull(deps);
  if (!db) return { status: "refused", reason: "persistence-unavailable" };

  try {
    const rows = await db
      .select({
        id: standingObservationAuthorizations.id,
        tenantId: standingObservationAuthorizations.tenantId,
        revision: standingObservationAuthorizations.authorizationRevision,
        state: standingObservationAuthorizations.state,
        providerKey: standingObservationAuthorizations.providerKey,
        capabilityKey: standingObservationAuthorizations.capabilityKey,
        subjectKind: standingObservationAuthorizations.subjectKind,
        subjectRef: standingObservationAuthorizations.subjectRef,
        integrationId: standingObservationAuthorizations.integrationId,
        intervalMinutes: standingObservationAuthorizations.intervalMinutes,
      })
      .from(standingObservationAuthorizations)
      .where(eq(standingObservationAuthorizations.id, id))
      .limit(1);

    const row = rows[0];
    if (!row) return { status: "refused", reason: "authorization-unknown" };

    return finishMint(db, row, deps);
  } catch {
    return { status: "refused", reason: "persistence-unavailable" };
  }
}

interface AuthorizationRow {
  readonly id: string;
  readonly tenantId: string;
  readonly revision: number;
  readonly state: "active" | "withdrawn";
  readonly providerKey: string;
  readonly capabilityKey: string;
  readonly subjectKind: string;
  readonly subjectRef: string;
  readonly integrationId: string;
  readonly intervalMinutes: number;
}

/**
 * The lineage check and the mint, separated so the query above stays readable.
 *
 * The lineage is `(tenant, provider, capability, subject_ref)` — exactly the tuple the unique index
 * on the table uses, and exactly the one the writer and the reader use. Three places, one
 * definition, no stored `is_current` to disagree with any of them.
 */
async function finishMint(
  db: ControlPlaneDatabase,
  row: AuthorizationRow,
  deps: ObservationPrincipalDeps,
): Promise<MintObservationPrincipalResult> {
  const top = await db
    .select({
      id: standingObservationAuthorizations.id,
      revision: standingObservationAuthorizations.authorizationRevision,
      state: standingObservationAuthorizations.state,
    })
    .from(standingObservationAuthorizations)
    .where(
      and(
        eq(standingObservationAuthorizations.tenantId, row.tenantId),
        eq(standingObservationAuthorizations.providerKey, row.providerKey),
        eq(standingObservationAuthorizations.capabilityKey, row.capabilityKey),
        eq(standingObservationAuthorizations.subjectRef, row.subjectRef),
      ),
    )
    .orderBy(desc(standingObservationAuthorizations.authorizationRevision))
    .limit(1);

  const effective = top[0];
  if (!effective) return { status: "refused", reason: "authorization-unknown" };
  /*
   * WITHDRAWAL IS CHECKED BEFORE STALENESS, AND THE ORDER IS THE INFORMATIVE ONE.
   *
   * Both refuse, so no authority turns on this. What turns on it is what a human reads afterwards.
   * A caller holding revision 2's id after revision 3 withdrew the lineage is BOTH superseded and
   * withdrawn; reporting "superseded" would say a newer revision exists and leave the reader to
   * discover that the newer revision took the permission away. "Withdrawn" is the fact that matters
   * and the one that answers "why did this stop".
   *
   * `superseded` therefore means exactly one thing: a newer ACTIVE revision replaced the one you
   * named — a narrowing, not a removal.
   */
  if (effective.state !== "active") return { status: "refused", reason: "authorization-withdrawn" };
  if (effective.id !== row.id) return { status: "refused", reason: "authorization-superseded" };

  /*
   * FAIL CLOSED AGAINST A NARROWED ALLOW-LIST. A stored row does not keep its permission because it
   * was legal on the day it was written; if a later release removed this capability from the
   * observable set, no principal may be minted for it.
   */
  if (!isObservableCapability(row.providerKey, row.capabilityKey, row.subjectKind)) {
    return { status: "refused", reason: "capability-not-observable" };
  }

  return {
    status: "minted",
    principal: {
      tenantId: row.tenantId,
      authorizationId: row.id,
      authorizationRevision: row.revision,
      providerKey: row.providerKey,
      capabilityKey: row.capabilityKey,
      subjectKind: row.subjectKind,
      subjectRef: row.subjectRef,
      integrationId: row.integrationId,
      intervalMinutes: row.intervalMinutes,
      invocationId: (deps.newInvocationId ?? randomUUID)(),
      [OBSERVATION_PRINCIPAL_BRAND]: true,
    },
  };
}

/**
 * The TENANT SCOPE this principal may ask read questions under.
 *
 * A deliberately tiny projection, and the only thing that crosses from the principal into the
 * narrowed read seams. It carries the tenant and nothing else — no human, no session, no request
 * identity — which is what makes "the machine can ask what this tenant's connections are" true and
 * "the machine can write something attributed to a human" unrepresentable.
 */
export function tenantScopeOf(principal: ObservationPrincipal): { readonly tenantId: string } {
  return { tenantId: principal.tenantId };
}
