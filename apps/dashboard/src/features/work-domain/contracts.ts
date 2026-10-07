/*
 * work-domain/contracts.ts — the vocabulary of THE WORK DOMAIN AUTHORITY (AP-4A).
 *
 * A work domain is a typed kind of work in one organization. This authority records that a domain
 * exists, what it is called, and whether it is in service. It owns ONE table, `work_domains`, and
 * three transitions:
 *
 *     NONEXISTENT DOMAIN  ->  RECORDED DOMAIN            create
 *     RECORDED DOMAIN     ->  RECORDED UNDER A NEW NAME  rename (name only; the slug never changes)
 *     IN SERVICE          ->  RETIRED                    retire (once; no un-retire)
 *
 * There is no delete, no restore, no merge and no slug change: those verbs are ABSENT, not guarded.
 *
 * It is NOT the Organization Structure Authority and NOT a department: it reads no department and
 * no placement, and nothing derives a domain from where somebody sits. It is NOT the Agent Mandate
 * Authority: a domain grants nothing — responsibility for a domain exists only on a mandate revision
 * Governance decided. And it writes NO Governance decision: like OSA-1 and WORK-1, recording
 * vocabulary is an administrative act gated by the tenant's Governance authority and audited, and a
 * decision row here would decide nothing.
 */

export const WORK_DOMAIN_ENTITY_TYPE = "work-domain" as const;

export const WORK_DOMAIN_AUDIT_CREATED = "work-domain.created" as const;
export const WORK_DOMAIN_AUDIT_RENAMED = "work-domain.renamed" as const;
export const WORK_DOMAIN_AUDIT_RETIRED = "work-domain.retired" as const;

export type WorkDomainAuditAction =
  | typeof WORK_DOMAIN_AUDIT_CREATED
  | typeof WORK_DOMAIN_AUDIT_RENAMED
  | typeof WORK_DOMAIN_AUDIT_RETIRED;

export const ACTIVE_WORK_DOMAIN_STATUS = "active" as const;
export const RETIRED_WORK_DOMAIN_STATUS = "archived" as const;

export type WorkDomainRefusal =
  | "no-authorized-tenant-context"
  | "not-authorized"
  | "authority-unavailable"
  | "malformed-work-domain-name"
  | "malformed-work-domain-slug"
  /** The slug was EVER used in this tenant — retired domains keep theirs forever. */
  | "work-domain-slug-taken"
  | "work-domain-unresolved"
  | "work-domain-retired"
  | "work-domain-name-unchanged";

export const MAX_WORK_DOMAIN_NAME_LENGTH = 80;
export const MAX_WORK_DOMAIN_SLUG_LENGTH = 48;
/** Stated again in `work_domains_slug_chk`; a test pins the two equal. */
export const WORK_DOMAIN_SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** One line, no surrounding whitespace, no control characters. Never trimmed into shape. */
export function isWellFormedWorkDomainName(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.length === 0 || value.length > MAX_WORK_DOMAIN_NAME_LENGTH) return false;
  return value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value);
}

export function isWellFormedWorkDomainSlug(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.length === 0 || value.length > MAX_WORK_DOMAIN_SLUG_LENGTH) return false;
  return WORK_DOMAIN_SLUG_RE.test(value);
}

export interface WorkDomain {
  readonly workDomainId: string;
  readonly slug: string;
  readonly name: string;
  readonly inService: boolean;
}

export type WorkDomainWriteResult =
  | { readonly status: "recorded"; readonly workDomain: WorkDomain }
  | { readonly status: "refused"; readonly reason: WorkDomainRefusal };

export const WORK_DOMAIN_AUTHORITY_MODEL = Object.freeze({
  writesTables: Object.freeze(["work_domains"]),
  writesGovernanceDecision: false as const,
  readsDepartments: false as const,
  grantsResponsibility: false as const,
  limitation:
    "This authority records that a kind of work exists in an organization, what it is called, and " +
    "whether it is in service. It grants no responsibility, confers no permission, and is not a " +
    "department.",
});
