/*
 * external-ai-data-use/compose-external-ai-disclosure.ts — THE COMPOSITION, AND NOTHING ELSE
 * (EXTERNAL-AI-DATA-USE-1A).
 *
 * PURE. No I/O, no clock. It reads nothing, writes nothing and caches nothing, so it cannot become a
 * fourth source of truth. Its inputs are the answers the owning authorities already gave:
 *
 *     platform     the reviewed platform disclosure policy           (code)
 *     attestation  the processor attestation in force for the scope  (root rows)
 *     tenant       this organization's effective authorization       (Governance rows)
 *     operator     the R2E root control, read by its own reader      (operational only)
 *     provider     whether a transport could be selected             (transport only)
 *
 * ── RELEASE A: NOTHING CALLS THIS AT RUNTIME ────────────────────────────────
 *
 * No Heby, origination or media path imports this module in Release A; a firewall test proves it.
 * Wiring it into the two Claude seams is B2.
 *
 * ── THE ORDER IS PART OF THE CONTRACT ───────────────────────────────────────
 *
 *   1 unavailable            any authority could not be read — fail closed, never a decision
 *   2 tenant-withdrawn       the organization's own act, reported before any global state (TRH-25)
 *   3 platform-denied        a recorded denial, or the attestation outside an ALLOWED cell's bounds
 *   4 platform-unknown       no attestation in force, no account configured, or no recorded cell
 *   5 tenant-not-authorized  no lineage, or a required (purpose, class) the tenant never agreed to
 *   6 authorization-stale    the attestation in force widened (or became unorderable) since then
 *   7 operator-paused        the deployment-wide R2E stop
 *   8 provider-unavailable   no transport
 *   9 authorized
 *
 * Every refusal returns no authorization id and no data class. There is no input value that yields
 * `authorized` unless all five authorities agree.
 */
import {
  changePreservesAuthorization,
  classifyAttestationChange,
  type AttestationChange,
  type AttestationTreatmentView,
} from "./attestation-change";
import type { DataClass, ExternalAiDisclosureDisposition, Purpose, ScopePair, ServiceScope } from "./contracts";
import {
  attestationSatisfiesBounds,
  decidePlatformDisclosure,
  type PlatformDisclosurePolicy,
  type PlatformDisclosureVerdict,
} from "./platform-disclosure-policy";

export interface DisclosureRequest {
  readonly serviceScope: ServiceScope;
  readonly purpose: Purpose;
  /** Classes without which the request must not be sent at all (e.g. the conversation itself). */
  readonly requiredDataClasses: readonly DataClass[];
  /** Classes that are included only where every authority permits them, and silently omitted otherwise. */
  readonly optionalDataClasses?: readonly DataClass[];
  /**
   * APF-5. The model id that WILL be sent — the generator's own resolved value, never re-read. The
   * processor attestation is the only authority on which models it covers; absent from its
   * `modelIds`, the request is refused `model-not-attested`.
   */
  readonly modelId: string;
}

export type AttestationInForce = AttestationTreatmentView & { readonly state: "active" | "withdrawn" };
/** APF-5. The latest attestation as the gate reads it: what it covers, and which revision said so. */
export type LatestAttestation = AttestationInForce & { readonly modelIds: readonly string[]; readonly attestationRevision: number };

export interface TenantAuthorizationInForce {
  readonly authorizationId: string;
  readonly state: "active" | "withdrawn";
  /** The exact attestation revision the human authorized against. Null only for a withdrawal. */
  readonly boundAttestation: AttestationTreatmentView | null;
  readonly scopes: readonly ScopePair[];
  /** APF-5. Provenance only — recorded with the decision, never read to make it. */
  readonly authorizationRevision?: number;
}

export interface DisclosureComposeInput {
  readonly request: DisclosureRequest;
  readonly policy: PlatformDisclosurePolicy;
  /** The deployment's configured account for this scope. Configuration, never authority. */
  readonly accountRef: string | null;
  readonly attestation:
    | { readonly status: "unavailable" }
    | { readonly status: "absent" }
    | { readonly status: "read"; readonly latest: LatestAttestation };
  readonly tenant:
    | { readonly status: "unavailable" }
    | { readonly status: "absent" }
    | { readonly status: "read"; readonly effective: TenantAuthorizationInForce };
  /** The R2E root control. `null` means it could not be read. */
  readonly operatorEnabled: boolean | null;
  readonly providerAvailable: boolean;
}

export interface DisclosureComponents {
  readonly platform: "denied" | "unknown" | "allowed";
  readonly attestation: "unavailable" | "absent" | "withdrawn" | "active";
  readonly tenant: "unavailable" | "absent" | "withdrawn" | "active";
  readonly change: AttestationChange | null;
  readonly operator: "unavailable" | "paused" | "enabled";
  readonly provider: "unavailable" | "available";
}

export interface DisclosureDecision {
  readonly disposition: ExternalAiDisclosureDisposition;
  readonly authorizationId: string | null;
  readonly attestationId: string | null;
  /** APF-5. Which revisions the decision rested on — provenance, null whenever it was refused. */
  readonly authorizationRevision: number | null;
  readonly attestationRevision: number | null;
  readonly authorizedDataClasses: readonly DataClass[];
  readonly components: DisclosureComponents;
}

export function composeExternalAiDisclosure(input: DisclosureComposeInput): DisclosureDecision {
  const { request } = input;
  const required = [...new Set(request.requiredDataClasses)];
  const optional = [...new Set(request.optionalDataClasses ?? [])].filter((c) => !required.includes(c));

  const verdictFor = (dataClass: DataClass): PlatformDisclosureVerdict =>
    decidePlatformDisclosure({ serviceScope: request.serviceScope, purpose: request.purpose, dataClass }, input.policy);
  const requiredVerdicts = required.map(verdictFor);

  const attestation =
    input.attestation.status === "read" && input.accountRef !== null && input.attestation.latest.accountRef === input.accountRef
      ? input.attestation.latest
      : null;
  const tenant = input.tenant.status === "read" ? input.tenant.effective : null;

  const change: AttestationChange | null =
    attestation && tenant?.state === "active" && tenant.boundAttestation
      ? classifyAttestationChange(tenant.boundAttestation, attestation)
      : null;

  const components: DisclosureComponents = {
    platform:
      required.length === 0 || requiredVerdicts.some((v) => v.decision === "denied")
        ? "denied"
        : requiredVerdicts.some((v) => v.decision === "unknown")
          ? "unknown"
          : "allowed",
    attestation:
      input.attestation.status === "unavailable"
        ? "unavailable"
        : !attestation
          ? "absent"
          : attestation.state,
    tenant: input.tenant.status === "unavailable" ? "unavailable" : !tenant ? "absent" : tenant.state,
    change,
    operator: input.operatorEnabled === null ? "unavailable" : input.operatorEnabled ? "enabled" : "paused",
    provider: input.providerAvailable ? "available" : "unavailable",
  };

  const refuse = (disposition: ExternalAiDisclosureDisposition): DisclosureDecision => ({
    disposition,
    authorizationId: null,
    attestationId: null,
    authorizationRevision: null,
    attestationRevision: null,
    authorizedDataClasses: [],
    components,
  });

  /* 1 · Fail closed on anything unread. */
  if (input.tenant.status === "unavailable" || input.attestation.status === "unavailable" || input.operatorEnabled === null) {
    return refuse("unavailable");
  }

  /* 2 · The organization's own withdrawal, first. */
  if (tenant?.state === "withdrawn") return refuse("tenant-withdrawn");

  /* 3 · A recorded platform denial — including an attestation outside an ALLOWED cell's bounds. */
  if (required.length === 0 || requiredVerdicts.some((v) => v.decision === "denied")) return refuse("platform-denied");

  /* 4 · Nothing in force to disclose under. */
  if (!attestation || attestation.state !== "active") return refuse("platform-unknown");
  /* APF-5. Only a model the attestation in force records may be sent. Nothing else can say so. */
  if (!attestation.modelIds.includes(request.modelId)) return refuse("model-not-attested");
  if (requiredVerdicts.some((v) => v.decision === "unknown")) return refuse("platform-unknown");
  if (requiredVerdicts.some((v) => v.decision === "allowed" && !attestationSatisfiesBounds(attestation, v.bounds))) {
    return refuse("platform-denied");
  }

  /* 5 · This organization's own agreement, for every required class. */
  if (!tenant) return refuse("tenant-not-authorized");
  const tenantAllows = (dataClass: DataClass) =>
    tenant.scopes.some((s) => s.purpose === request.purpose && s.dataClass === dataClass);
  if (!required.every(tenantAllows)) return refuse("tenant-not-authorized");

  /* 6 · Agreement given against a narrower boundary than the one now in force is not agreement. */
  if (!change || change === "identity-change") return refuse("tenant-not-authorized");
  if (!changePreservesAuthorization(change)) return refuse("authorization-stale");

  /* 7 · 8 · Operational state, last — it can stop a disclosure but never explain one away. */
  if (!input.operatorEnabled) return refuse("operator-paused");
  if (!input.providerAvailable) return refuse("provider-unavailable");

  const optionalAllowed = optional.filter((dataClass) => {
    const verdict = verdictFor(dataClass);
    return verdict.decision === "allowed" && attestationSatisfiesBounds(attestation, verdict.bounds) && tenantAllows(dataClass);
  });

  return {
    disposition: "authorized",
    authorizationId: tenant.authorizationId,
    attestationId: attestation.id,
    authorizationRevision: tenant.authorizationRevision ?? null,
    attestationRevision: attestation.attestationRevision,
    authorizedDataClasses: [...required, ...optionalAllowed],
    components,
  };
}
