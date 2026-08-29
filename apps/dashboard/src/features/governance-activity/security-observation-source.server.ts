/*
 * governance-activity/security-observation-source.server.ts — the recorded-act ledger's read
 * projection of itself, shaped for the Security Center (E2-2 / S-B).
 *
 * ── WHY IT LIVES ON THIS SIDE OF THE BOUNDARY ────────────────────────────────
 *
 * G6C settled it, INT-5A restated it and E2-1 built the fifth instance: a projection belongs to the
 * side that owns the facts, and the consumer imports the projection. So this file sits beside the
 * readers, and the Security route imports one function from it. The Security Center therefore never
 * holds `readRecordedActPage`, never holds `auditLog`, never holds a database handle, and never
 * writes a tenant predicate of its own.
 *
 * It is also what keeps TWO released guards passing without being weakened:
 *
 *   `tests/security-center/security-center.ts` forbids the substring `features/governance` in every
 *   file of `src/features/security-center`. A Security-owned projection would have had to import
 *   this module and would have tripped it — and the fix would have been to loosen the ban.
 *
 *   SEC-4's handle ban forbids the Security Center from opening a database connection. This module
 *   opens none either: `observeRecordedActHistory` resolves its own handle internally, so the
 *   consumer needs none. That is the shape L4 already follows.
 *
 * ── WHAT THIS IS ─────────────────────────────────────────────────────────────
 *
 * A READ PROJECTION. It owns no table, no row, no cache and no state. It issues no query, opens no
 * connection, performs no network or provider I/O, writes nothing, authorizes nothing, executes
 * nothing, and creates no finding, incident, policy, trust state or score. Every value it returns
 * came out of `observeRecordedActHistory`, which already owns the rules — that the tenant comes
 * from the caller's authorized context and from nowhere else, that a bad read is `unavailable` and
 * never an empty history, and that the page is bounded and its total is not. This module re-derives
 * none of that. It translates one shape into another.
 *
 * ── DERIVED, AND SAYING SO ───────────────────────────────────────────────────
 *
 * `authoritative` is the literal `false`, not a boolean somebody may flip. `audit_log` is the sole
 * authority for recorded governed acts, written by the nine `governance-audit` writers and by
 * nothing else. This view is recomputed on every read, persists nothing, owns no row, and SELECTS a
 * shape — twenty of N rows, eight of twenty-two columns. A chosen shape is an interpretation.
 *
 *     AUTHORITATIVE RECORD != AUTHORITATIVE OBSERVATION
 *     DERIVED OBSERVATION  != AUTHORITATIVE SECURITY TRUTH
 *
 * ── WHAT IT STRUCTURALLY CANNOT SAY ──────────────────────────────────────────
 *
 * No incident, no finding, no threat, no attack, no breach, no severity, no risk and no score. Not
 * because each is filtered here, but because `RecordedAct` carries none of them — `audit_log`
 * records what authorized actors did, so it can evidence no intrusion, and this projection claims
 * none. `WITHHELD_AUDIT_COLUMNS` never reaches this module either: the reader's select list already
 * excluded all ten, so there is no actor id, no entity id, no jsonb payload and no principal hash
 * here to leak.
 *
 *     ZERO RECORDED ACTS   != SECURE
 *     MORE RECORDED ACTS   != LESS SECURE
 *     RECORDED ACT         != FORENSIC COMPLETENESS
 *
 * Server-only.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
/*
 * TYPE-ONLY, AND THE DIRECTION IS DELIBERATE.
 *
 * The consumer owns the contract and the projection fills it — the same arrangement E2-1 used when
 * the Organization Authority's projection imported `SourceResolution` from Heby's runtime. It is
 * erased at compile time, so the Security Center gains no runtime edge into this feature and the
 * dependency still runs one way: route -> this projection -> the reader -> `audit_log`.
 */
import type {
  SecurityRecordedAct,
  SecurityRecordedActObservation,
} from "@/features/security-center/contracts";
import { RECORDED_ACT_HISTORY_BOUNDARY, type RecordedActHistoryResult } from "./contracts";
import { observeRecordedActHistory, type ObserveGovernanceActivityDeps } from "./observe.server";

/**
 * Why the observation could not be read.
 *
 * THREE REASONS, THREE SENTENCES, AND THEY MUST NOT MERGE. "Hebun is not configured to store this"
 * and "this request carries no authorized tenant" are different facts with different remedies, and
 * collapsing either into "no activity" would turn an infrastructure state into a claim about the
 * customer's organization. Each maps to exactly one reason the seam can return.
 *
 *     KNOWN EMPTY != UNAVAILABLE
 */
export const SECURITY_OBSERVATION_UNAVAILABLE = Object.freeze({
  "no-authorized-tenant-context":
    "This request carries no authorized tenant, so no recorded acts were read. Nothing was " +
    "substituted for them.",
  "persistence-not-configured":
    "Durable storage is not configured for this deployment, so Hebun holds no recorded-act ledger " +
    "to read here. That is a fact about the deployment, not about your organization.",
  "read-failed":
    "Hebun could not read the recorded-act ledger. That is a read failure, not an organization " +
    "with nothing recorded.",
});

/**
 * The projection's provenance, carried as the ledger boundary's OWN sentence.
 *
 * Not summarized and not re-worded, because a second wording is a second interpretation of a
 * limitation, and the limitation is the most important thing this surface displays. When the
 * boundary is one day widened, this line inherits the change unchanged.
 */
export const SECURITY_OBSERVATION_PROVENANCE = RECORDED_ACT_HISTORY_BOUNDARY.rationale;

/**
 * What the Security Center may NOT conclude from this observation, stated on the surface itself.
 *
 * The reader is looking at a security page. Everything on such a page is read as a security claim
 * unless the page says otherwise, so the denial travels with the evidence rather than living in a
 * comment nobody renders.
 */
export const SECURITY_OBSERVATION_LIMITS =
  "These are governed acts Hebun itself recorded, observed through a bounded read. They are not " +
  "security events, findings, incidents, threats or alerts, no severity or risk is inferred, and " +
  "no count of them indicates whether this organization is secure.";

export interface SecurityObservationDeps extends ObserveGovernanceActivityDeps {
  /** Injected so the projection is testable with no database. Defaults to the released seam. */
  readonly observe?: (
    tenant: Pick<TenantContext, "tenantId"> | null,
    deps: ObserveGovernanceActivityDeps,
  ) => Promise<RecordedActHistoryResult>;
}

/** Every unavailable path builds its result here, so no branch can invent a different shape. */
function unavailable(reason: keyof typeof SECURITY_OBSERVATION_UNAVAILABLE): SecurityRecordedActObservation {
  return {
    sourceClass: "audit",
    state: "unavailable",
    authoritative: false,
    provenance: SECURITY_OBSERVATION_PROVENANCE,
    limits: SECURITY_OBSERVATION_LIMITS,
    generatedAt: null,
    acts: [],
    /*
     * NULL, NOT ZERO. A read that could not run does not know the total, and `0` here would be the
     * exact collapse this phase exists to prevent — an infrastructure failure rendered as "your
     * organization has recorded nothing".
     */
    totalRecordedActs: null,
    truncated: false,
    unavailableReason: SECURITY_OBSERVATION_UNAVAILABLE[reason],
  };
}

/**
 * Read this tenant's recorded governed acts for the Security Center.
 *
 * Tenant-scoped through the seam's own predicate — this module passes the server-resolved tenant
 * straight through and constructs no query of its own. There is no parameter by which a caller
 * could name a different tenant, no cross-tenant form and no whole-ledger form, so a cross-tenant
 * read is not refused here; it is UNREPRESENTABLE.
 *
 * THE BOUND IS THE SEAM'S. This module never pages, never widens and never re-reads: it returns the
 * one bounded page the reader produced, alongside the INDEPENDENT total that page was measured
 * against. `acts.length` is never the total and `truncated` is never guessed.
 */
export async function readSecurityRecordedActObservation(
  tenant: Pick<TenantContext, "tenantId"> | null,
  deps: SecurityObservationDeps = {},
): Promise<SecurityRecordedActObservation> {
  if (typeof window !== "undefined") {
    throw new Error("Security recorded-act observation reads are server-only.");
  }

  const observe = deps.observe ?? observeRecordedActHistory;
  const result = await observe(tenant, deps);

  if (result.status === "unavailable") {
    return unavailable(result.reason);
  }

  if (result.status === "empty") {
    /*
     * CONNECTED, AND KNOWN EMPTY. The ledger was read successfully and holds nothing for this
     * tenant — an established fact about the organization, and the one state a failed read must
     * never be allowed to imitate.
     */
    return {
      sourceClass: "audit",
      state: "known-empty",
      authoritative: false,
      provenance: SECURITY_OBSERVATION_PROVENANCE,
      limits: SECURITY_OBSERVATION_LIMITS,
      generatedAt: result.generatedAt,
      acts: [],
      totalRecordedActs: 0,
      truncated: false,
      unavailableReason: null,
    };
  }

  /*
   * Passed through field by field rather than spread, so a column added to `RecordedAct` upstream
   * cannot arrive on a security surface without an edit here. That is the point of naming them:
   * widening the observation stays a deliberate, reviewable act.
   */
  const acts: readonly SecurityRecordedAct[] = result.page.acts.map((act) => ({
    occurredAt: act.occurredAt,
    action: act.action,
    entityType: act.entityType,
    actorType: act.actorType,
    result: act.result,
    source: act.source,
    authoritySource: act.authoritySource,
    simulation: act.simulation,
  }));

  return {
    sourceClass: "audit",
    state: "recorded",
    authoritative: false,
    provenance: SECURITY_OBSERVATION_PROVENANCE,
    limits: SECURITY_OBSERVATION_LIMITS,
    generatedAt: result.generatedAt,
    acts,
    totalRecordedActs: result.page.totalRecordedActs,
    /* Derived by the reader from its INDEPENDENT total, never recomputed from `acts.length`. */
    truncated: result.page.truncated,
    unavailableReason: null,
  };
}
