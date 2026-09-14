/*
 * tenant-machine-execution-authority/contracts.ts — the vocabulary of TENANT PARTICIPATION.
 *
 * Declared here, in the authority that owns the question, so the writer, the runtime reader, the
 * reachability composition and any future ceremony all import one spelling and no second can exist.
 *
 * READ THE SCHEMA HEADER FIRST. It states what this authority means and, more importantly, the
 * four things it does not mean.
 */

/** The Governance ledger subject. One revision is one subject — never the lineage. */
export const TENANT_MACHINE_EXECUTION_SUBJECT_TYPE = "tenant_machine_execution_authorization" as const;

/** The ledger domain. See `governance_domain`'s own comment for why every neighbour was refused. */
export const TENANT_MACHINE_EXECUTION_DOMAIN = "machine-execution" as const;

/** Enrolling a tenant (or re-enrolling one after a withdrawal). */
export const TENANT_MACHINE_EXECUTION_AUTHORIZE_DECISION_TYPE = "approve" as const;
/** Withdrawing that participation. The same `revoke` word Governance uses to end a delegation. */
export const TENANT_MACHINE_EXECUTION_WITHDRAW_DECISION_TYPE = "revoke" as const;

/**
 * The ledger outcomes.
 *
 * BOTH ARE NECESSARY AND BOTH MUST BE MATCHED ON THE SUBJECT FIRST, for exactly the reason TRH-23
 * recorded. `approve` is also the membership-authorization decision type, so without a subject
 * check enrolling an organization into machine delivery would be filed as a HUMAN BEING ADMITTED
 * to it. And `revoke` is the word Governance uses to end an authority DELEGATION — withdrawing
 * machine participation takes nobody's authority away, and the ledger must never say it did.
 */
export const TENANT_MACHINE_EXECUTION_AUTHORIZED_OUTCOME = "machine-execution-authorized" as const;
export const TENANT_MACHINE_EXECUTION_WITHDRAWN_OUTCOME = "machine-execution-withdrawn" as const;

/**
 * WHY THE STATE OF ONE LINEAGE IS FOUR WORDS AND NOT A BOOLEAN.
 *
 * `absent` and `withdrawn` are both "not authorized" to a caller that only wants to proceed, and
 * they are DIFFERENT FACTS to a human reading the ledger: nobody ever agreed, versus somebody
 * agreed and later took it back. `unavailable` is a third: we could not find out. Collapsing any of
 * them into the others is how an outage starts looking like a decision.
 *
 * `superseded` never appears as an effective state — it is what a revision BECOMES when a later
 * one exists, and the effective read only ever returns the latest. It is named in the refusal
 * vocabulary of the composition because a caller holding a stale revision id deserves that word.
 */
export type TenantMachineExecutionState = "active" | "withdrawn";

/** Why machine execution is not reachable for a tenant. Each names a different thing. */
export type MachineExecutionReachabilityRefusal =
  /** No lineage exists for this tenant and capability. Nobody ever enrolled this organization. */
  | "tenant-not-authorized"
  /** A lineage exists and its latest revision took the permission away. */
  | "tenant-authorization-withdrawn"
  /** The caller named a revision that a later one has replaced. */
  | "tenant-authorization-superseded"
  /** The deployment-wide operator control is off, or has never been armed. */
  | "root-control-disabled"
  /** Not a capability any machine may execute. Refused before anything else is considered. */
  | "unsupported-machine-capability"
  /** The control plane could not be reached. NOT the same as "not authorized". */
  | "persistence-unavailable";

export type MachineExecutionReachability =
  | { readonly status: "reachable" }
  | { readonly status: "refused"; readonly reason: MachineExecutionReachabilityRefusal };

/** Why a tenant authorization write was refused. */
export type TenantMachineExecutionWriteRefusal =
  | "unauthenticated"
  | "no-governance-authority"
  | "not-the-governance-authority"
  | "justification-required"
  | "unsupported-machine-capability"
  /** Enrolling a tenant that is already enrolled for this capability. A no-op decision. */
  | "already-authorized"
  /** Withdrawing where no active authorization stands. */
  | "no-active-authorization"
  /** The human decided against a revision that moved underneath them. */
  | "stale-authorization-revision"
  | "persistence-unavailable";
