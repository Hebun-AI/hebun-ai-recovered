/*
 * external-ai-data-use/attestation-change.ts — HOW DOES THE ATTESTATION IN FORCE DIFFER FROM THE ONE
 * A TENANT AUTHORIZED? (EXTERNAL-AI-DATA-USE-1A)
 *
 * PURE. No I/O, no clock.
 *
 * ── THE RULE ────────────────────────────────────────────────────────────────
 *
 * A tenant authorizes against ONE attestation revision. When a later revision of the same lineage is
 * in force, the change is classified here, and only from closed ORDERED vocabularies:
 *
 *     equivalent       every ordered field equal, contract and model class unchanged → preserve
 *     narrowing        every ordered field equal or narrower, at least one narrower  → preserve
 *     widening         any ordered field wider                                       → STALE
 *     unknown          contract surface or model treatment class changed             → STALE
 *     identity-change  another service scope or account: another lineage altogether  → no authority
 *
 * Nothing here compares free text for "equivalence". A string that differs is never equivalent; it is
 * `unknown`, which refuses. No human can declare a change equivalent — the order of the vocabularies,
 * reviewed in `contracts.ts`, is the only thing that can.
 *
 * Model ids within one treatment class, evidence references and review dates are deliberately not
 * inputs: a model patch or an evidence refresh does not change what happens to the data.
 */
import {
  IDENTITY_STATUSES,
  RETENTION_CLASSES,
  TRAINING_TREATMENTS,
  ZDR_STATES,
  rankOf,
  type ContractSurface,
  type IdentityStatus,
  type RetentionClass,
  type ServiceScope,
  type TrainingTreatment,
  type ZdrState,
} from "./contracts";

export interface AttestationTreatmentView {
  readonly id: string;
  readonly serviceScope: ServiceScope;
  readonly accountRef: string;
  readonly identityStatus: IdentityStatus;
  readonly contractSurface: ContractSurface;
  readonly training: TrainingTreatment;
  readonly retentionClass: RetentionClass;
  readonly zdr: ZdrState;
  readonly modelTreatmentClass: string;
}

export type AttestationChange = "equivalent" | "narrowing" | "widening" | "unknown" | "identity-change";

export function classifyAttestationChange(
  bound: AttestationTreatmentView,
  current: AttestationTreatmentView,
): AttestationChange {
  if (bound.serviceScope !== current.serviceScope || bound.accountRef !== current.accountRef) {
    return "identity-change";
  }
  if (bound.id === current.id) return "equivalent";
  if (bound.contractSurface !== current.contractSurface) return "unknown";
  if (bound.modelTreatmentClass !== current.modelTreatmentClass) return "unknown";

  const deltas = [
    rankOf(TRAINING_TREATMENTS, current.training) - rankOf(TRAINING_TREATMENTS, bound.training),
    rankOf(RETENTION_CLASSES, current.retentionClass) - rankOf(RETENTION_CLASSES, bound.retentionClass),
    rankOf(ZDR_STATES, current.zdr) - rankOf(ZDR_STATES, bound.zdr),
    rankOf(IDENTITY_STATUSES, current.identityStatus) - rankOf(IDENTITY_STATUSES, bound.identityStatus),
  ];
  if (deltas.some((d) => d > 0)) return "widening";
  if (deltas.some((d) => d < 0)) return "narrowing";
  return "equivalent";
}

/** Only these two preserve an authorization. */
export function changePreservesAuthorization(change: AttestationChange): boolean {
  return change === "equivalent" || change === "narrowing";
}
