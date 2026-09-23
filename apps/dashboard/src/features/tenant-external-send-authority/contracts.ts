/*
 * tenant-external-send-authority/contracts.ts — the vocabulary of TENANT EXTERNAL-SEND ARMING.
 *
 * Declared here, in the authority that owns the question, so the writer, the runtime reader, the
 * reachability composition, the executor and the operations surface all import one spelling and no
 * second can exist.
 *
 * READ THE SCHEMA HEADER FIRST. It states what this authority means and, more importantly, the
 * five things it does not mean.
 */

/** The Governance ledger subject. One revision is one subject — never the lineage. */
export const TENANT_EXTERNAL_SEND_SUBJECT_TYPE = "tenant_external_send_authorization" as const;

/** The ledger domain. See `governance_domain`'s own comment for why every neighbour was refused. */
export const TENANT_EXTERNAL_SEND_DOMAIN = "external-send" as const;

/** Arming a tenant (or re-arming one after a disarming). */
export const TENANT_EXTERNAL_SEND_ARM_DECISION_TYPE = "approve" as const;
/** Disarming it. The same `revoke` word Governance uses to end a delegation. */
export const TENANT_EXTERNAL_SEND_DISARM_DECISION_TYPE = "revoke" as const;

/**
 * The ledger outcomes.
 *
 * BOTH ARE NECESSARY AND BOTH MUST BE MATCHED ON THE SUBJECT FIRST, for the reason TRH-23 recorded
 * and the machine sibling repeated. `approve` is also the membership-authorization decision type,
 * so without a subject check arming an organization would be filed as A HUMAN BEING ADMITTED to it.
 * And `revoke` is the word Governance uses to end an authority DELEGATION — disarming outbound
 * sending takes nobody's authority away, and the ledger must never say it did.
 */
export const TENANT_EXTERNAL_SEND_ARMED_OUTCOME = "external-send-armed" as const;
export const TENANT_EXTERNAL_SEND_DISARMED_OUTCOME = "external-send-disarmed" as const;

/**
 * WHY THE STATE OF ONE LINEAGE IS THREE FACTS AND NOT A BOOLEAN.
 *
 * `absent` and `withdrawn` are both "not armed" to a caller that only wants to proceed, and they
 * are DIFFERENT FACTS to a human reading the ledger: nobody ever armed this organization, versus
 * somebody armed it and later took it back. `unavailable` is a third: we could not find out.
 * Collapsing any of them into the others is how an outage starts looking like a decision.
 */
export type TenantExternalSendState = "active" | "withdrawn";

/** Why outbound external sending is not reachable for a tenant. Each names a different thing. */
export type ExternalSendReachabilityRefusal =
  /** No lineage exists for this tenant. Nobody ever armed this organization. */
  | "tenant-not-armed"
  /** A lineage exists and its latest revision took the arming away. */
  | "tenant-arming-withdrawn"
  /** The deployment-wide operator control is off, or has never been armed. */
  | "root-control-disabled"
  /** The control plane could not be reached. NOT the same as "not armed". */
  | "persistence-unavailable";

export type ExternalSendReachability =
  | { readonly status: "reachable" }
  | { readonly status: "refused"; readonly reason: ExternalSendReachabilityRefusal };

/** Why a tenant arming write was refused. */
export type TenantExternalSendWriteRefusal =
  | "unauthenticated"
  | "no-governance-authority"
  | "not-the-governance-authority"
  | "justification-required"
  /** Arming a tenant that is already armed. A no-op decision. */
  | "already-armed"
  /** Disarming where no active arming stands. */
  | "no-active-arming"
  /** The human decided against a revision that moved underneath them. */
  | "stale-authorization-revision"
  | "persistence-unavailable";

/**
 * THE PRODUCT WORDING, as values rather than prose, so a test can pin what a surface says.
 *
 * Every string is deliberately weaker than the one a reader expects. In particular, none of them
 * says a send WILL succeed, and none of them says the deployment is configured.
 */
export const TENANT_EXTERNAL_SEND_WORDING: Readonly<
  Record<ExternalSendReachabilityRefusal | "reachable", string>
> = Object.freeze({
  reachable:
    "This organization is armed to send outside, and the deployment control is on. A permit is still required for every send.",
  "tenant-not-armed":
    "This organization has never been armed to send outside. Arming another organization does not arm this one.",
  "tenant-arming-withdrawn":
    "This organization's Governance withdrew its arming to send outside.",
  "root-control-disabled":
    "The deployment-wide external-send control is off. No organization can send while it is off.",
  "persistence-unavailable":
    "Hebun could not read the arming authority. This is not a decision — it is a failure to find out.",
});
