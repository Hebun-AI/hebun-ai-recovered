/**
 * Enterprise Memory Admission Engine — authority evaluation.
 *
 * Deterministically validates the claimed authority against the required-authority
 * policies in force. It only checks membership: the claimed authority kind must be
 * explicitly listed as accepted. It never grants authority, never infers
 * permission, and never elevates one authority kind to another.
 */

import type {
  AdmissionAuthority,
  AdmissionPolicy,
} from "@/features/enterprise-memory-admission";
import type { AuthorityCheck } from "@/features/enterprise-memory-admission-engine/contracts";

/** Extracts the accepted authority kinds declared by required-authority policies. */
function acceptedAuthorityKinds(policies: readonly AdmissionPolicy[]): readonly string[] {
  const accepted: string[] = [];
  for (const policy of policies) {
    if (policy.kind === "required-authority") {
      for (const kind of policy.acceptedAuthorities) accepted.push(kind);
    }
  }
  return accepted;
}

/**
 * Validates the claimed authority. When no required-authority policy exists the
 * authority is accepted by absence of constraint — this is not an elevation, only
 * the absence of a restriction to check against.
 */
export function evaluateAuthority(
  authority: AdmissionAuthority,
  policies: readonly AdmissionPolicy[],
): AuthorityCheck {
  const accepted = acceptedAuthorityKinds(policies);

  if (accepted.length === 0) {
    return Object.freeze({
      authority,
      accepted: true,
      reason: "no required-authority policy constrains this admission",
    });
  }

  const isAccepted = accepted.includes(authority.kind);
  return Object.freeze({
    authority,
    accepted: isAccepted,
    reason: isAccepted
      ? `authority kind "${authority.kind}" is explicitly accepted`
      : `authority kind "${authority.kind}" is not in the accepted set`,
  });
}
