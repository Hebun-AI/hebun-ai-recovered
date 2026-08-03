/**
 * Enterprise Memory Admission — authority contracts.
 *
 * Authority identifies WHO is asserting that information should enter Enterprise
 * Memory. Authority never implies permission. Whether an authority is permitted
 * to admit a given candidate is modeled separately as AdmissionPermission and is
 * not decided here. These are contracts only: no evaluation, no enforcement.
 */

import type { MemoryTimestamp } from "@/features/enterprise-memory";

export type AdmissionAuthorityId = string;
export type AdmissionScopeId = string;

/** The kinds of authority recognized by the admission foundation. */
export type AdmissionAuthorityKind =
  | "director"
  | "organization"
  | "department"
  | "system"
  | "external"
  | "human";

interface AdmissionAuthorityBase<Kind extends AdmissionAuthorityKind> {
  readonly kind: Kind;
  readonly authorityId: AdmissionAuthorityId;
  readonly assertedAt: MemoryTimestamp;
}

/** Supreme enterprise authority. */
export type DirectorAuthority = AdmissionAuthorityBase<"director">;

/** Authority scoped to an organization. */
export interface OrganizationAuthority extends AdmissionAuthorityBase<"organization"> {
  readonly organizationScope: AdmissionScopeId;
}

/** Authority scoped to a department within an organization. */
export interface DepartmentAuthority extends AdmissionAuthorityBase<"department"> {
  readonly organizationScope: AdmissionScopeId;
  readonly departmentScope: AdmissionScopeId;
}

/** Non-human authority acting under an explicit mandate. */
export interface SystemAuthority extends AdmissionAuthorityBase<"system"> {
  readonly mandateReference: string;
}

/** Authority originating outside the enterprise boundary. */
export interface ExternalAuthority extends AdmissionAuthorityBase<"external"> {
  readonly externalReference: string;
}

/** An identified human acting in a personal capacity. */
export interface HumanAuthority extends AdmissionAuthorityBase<"human"> {
  readonly subjectId: string;
}

/** Discriminated union over every recognized authority kind. */
export type AdmissionAuthority =
  | DirectorAuthority
  | OrganizationAuthority
  | DepartmentAuthority
  | SystemAuthority
  | ExternalAuthority
  | HumanAuthority;

/**
 * Permission is a separate concern from authority. This contract records that a
 * permission was claimed for an authority; it does not grant, verify, or enforce
 * it. Authorization implementation is explicitly out of scope for this phase.
 */
export interface AdmissionPermission {
  readonly authorityId: AdmissionAuthorityId;
  readonly permittedAction: "propose" | "review" | "approve" | "archive";
  readonly grantReference: string;
}
