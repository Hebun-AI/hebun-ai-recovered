/*
 * agent-mandate/responsibility-contracts.ts — the RESPONSIBILITY dimension of an Agent Mandate (AP-4A).
 *
 * Responsibility is not a second authority. It is part of a mandate revision: granted by the same
 * Governance decision, written in the same transaction by the Agent Mandate Authority's one core, and
 * as immutable as the revision itself.
 *
 *   { kind: "domain", workDomainId }  this agent is responsible for that kind of work
 *   { kind: "organization" }          organization-level work ONLY — it covers NO work domain
 *
 * AP-4 scopes responsibility to `record-work`: a revision whose scope names `record-work` must state a
 * non-empty responsibility, and a revision whose scope does not must state none. `send` is untouched.
 *
 * The released 5-value contract (`establishAgentMandate`) is unchanged and writes no responsibility.
 * Its refusal union (`AgentMandateRefusal`) is unchanged too — the responsibility refusals below live
 * in their own type so that no released consumer of that union has to learn them before Release B.
 */
import type { AgentMandateRefusal, EstablishedAgentMandate, MandateScopeKind } from "./contracts";

/** The one action kind responsibility applies to in AP-4. */
export const RESPONSIBILITY_SCOPED_ACTION_KIND = "record-work" as const satisfies MandateScopeKind;

export const RESPONSIBILITY_KINDS = Object.freeze(["organization", "domain"] as const);
export type ResponsibilityKind = (typeof RESPONSIBILITY_KINDS)[number];

export type MandateResponsibilityGrant =
  | { readonly kind: "organization" }
  | { readonly kind: "domain"; readonly workDomainId: string };

export type MandateResponsibilityRefusal =
  | AgentMandateRefusal
  /** The scope names `record-work` and no responsibility was stated. */
  | "responsibility-required"
  /** Responsibility was stated for a revision whose scope does not name `record-work`. */
  | "responsibility-not-admitted"
  /** Not an array of well-formed grants, a repeated grant, or a second organization-level grant. */
  | "responsibility-invalid"
  /** A named domain does not exist IN THIS TENANT. Another tenant's domain lands here. */
  | "work-domain-unresolvable"
  /** A named domain exists and is retired; a retired domain is never granted. */
  | "work-domain-retired";

export type EstablishResponsibleAgentMandateResult =
  | {
      readonly status: "established";
      readonly mandate: EstablishedAgentMandate;
      readonly responsibility: readonly MandateResponsibilityGrant[];
    }
  | { readonly status: "refused"; readonly reason: MandateResponsibilityRefusal };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Parse a stated responsibility into its canonical form: organization first, then domains by id.
 * Refused WHOLE (null) when anything is malformed or repeated — never narrowed into shape.
 */
export function canonicaliseResponsibility(value: unknown): readonly MandateResponsibilityGrant[] | null {
  if (!Array.isArray(value)) return null;
  let organization = false;
  const domains = new Set<string>();
  for (const raw of value) {
    if (typeof raw !== "object" || raw === null) return null;
    const grant = raw as { kind?: unknown; workDomainId?: unknown };
    if (grant.kind === "organization" && Object.keys(grant).length === 1) {
      if (organization) return null;
      organization = true;
    } else if (grant.kind === "domain" && Object.keys(grant).length === 2 && typeof grant.workDomainId === "string") {
      const id = grant.workDomainId.toLowerCase();
      if (!UUID_RE.test(id) || domains.has(id)) return null;
      domains.add(id);
    } else {
      return null;
    }
  }
  return Object.freeze([
    ...(organization ? [{ kind: "organization" as const }] : []),
    ...[...domains].sort().map((workDomainId) => ({ kind: "domain" as const, workDomainId })),
  ]);
}
