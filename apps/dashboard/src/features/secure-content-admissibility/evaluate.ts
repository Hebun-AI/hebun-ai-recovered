/*
 * secure-content-admissibility/evaluate.ts — SCI-2B: may this content take part in this reasoning
 * path, given what Hebun can PROVE about it?
 *
 * It does not decide whether content is true, harmless, human-written, disclosable to a provider,
 * or actionable. ELIGIBLE content is still untrusted model data; SCI-1's instruction separation,
 * closed output contracts, reference membership and Governance remain the containment.
 *
 * Pure: no database, no model, no provider, no writer. The caller supplies the trusted tenant (from
 * server context, never from a client) and facts read by the authorities that own them.
 *
 * Release policy (Director, STRICT-FORWARD): only `agent-record-work-grounding`, only `knowledge`,
 * only an active, Governance-verified ratified version whose integrity has been protected since
 * creation. Text origin, ingestion path and Drive metadata are deliberately not inputs.
 */

export const ADMISSIBILITY_PURPOSES = ["agent-record-work-grounding"] as const;
export type AdmissibilityPurpose = (typeof ADMISSIBILITY_PURPOSES)[number];

export type ContentClass = "knowledge" | "provider-observation";

export interface AdmissibilityFacts {
  readonly contentClass: ContentClass;
  readonly versionId: string;
  readonly ownerTenantId: string;
  readonly activeAndInForce: boolean;
  /** Verified against Governance's own `ratify` decisions — not the Knowledge row's claim alone. */
  readonly ratified: boolean;
  /** Database-stamped at insert while SCI-2A protection was enabled. */
  readonly integrityFromCreation: boolean;
}

export type AdmissibilityFactsRead =
  | { readonly status: "read"; readonly facts: AdmissibilityFacts }
  | { readonly status: "unavailable" };

export type IneligibleReason =
  | "policy-not-permitted"
  | "unsupported-content-class"
  | "tenant-mismatch"
  | "inactive-version"
  | "ratification-required"
  | "integrity-unestablished";

export type Admissibility =
  | { readonly status: "eligible" }
  | { readonly status: "ineligible"; readonly reason: IneligibleReason }
  | { readonly status: "unavailable"; readonly reason: "authoritative-facts-unavailable" };

const ineligible = (reason: IneligibleReason): Admissibility => ({ status: "ineligible", reason });

export function evaluateAdmissibility(
  trustedTenantId: string,
  purpose: string,
  read: AdmissibilityFactsRead,
): Admissibility {
  if (!(ADMISSIBILITY_PURPOSES as readonly string[]).includes(purpose)) return ineligible("policy-not-permitted");
  if (read.status !== "read") return { status: "unavailable", reason: "authoritative-facts-unavailable" };
  const facts = read.facts;
  if (facts.contentClass !== "knowledge") return ineligible("unsupported-content-class");
  if (!trustedTenantId || facts.ownerTenantId !== trustedTenantId) return ineligible("tenant-mismatch");
  if (facts.activeAndInForce !== true) return ineligible("inactive-version");
  if (facts.ratified !== true) return ineligible("ratification-required");
  if (facts.integrityFromCreation !== true) return ineligible("integrity-unestablished");
  return { status: "eligible" };
}
