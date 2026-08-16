/*
 * external-recipients/contracts.ts — the R3R vocabulary (pure).
 *
 * WHAT A CALLER MAY SAY, AND WHAT IT STRUCTURALLY CANNOT. The input types below carry a display
 * name, a channel and an address. They carry NO tenant, NO actor, NO authority, NO lifecycle, NO
 * digest and NO verification claim — the types make those unrepresentable rather than merely
 * discouraged, exactly as `CreateWorkArtifactInput` and `CreateKnowledgeInput` do. Tenant and actor
 * come from an already-resolved server-side `TenantContext`; the digest is computed by the writer;
 * status is not the caller's to set.
 *
 * Pure. No I/O, no database, no clock, no authority.
 */

/** The only channel R3R records. See `_enums.ts` for why the vocabulary is exactly this long. */
export type RecipientEndpointKind = "email";

export const RECIPIENT_ENDPOINT_KINDS: readonly RecipientEndpointKind[] = ["email"];

export function isRecipientEndpointKind(value: unknown): value is RecipientEndpointKind {
  return typeof value === "string" && (RECIPIENT_ENDPOINT_KINDS as readonly string[]).includes(value);
}

/** Retirement is the only transition, and it never rewrites the address. */
export type RecipientStatus = "active" | "retired";

export const RECIPIENT_LIMITS = {
  /** A display name is one line a human reads on an approval surface, not a biography. */
  displayNameMaxLength: 200,
} as const;

export type RecipientValidationProblem =
  | { readonly field: "displayName"; readonly problem: "empty" | "too-long" | "control-characters" }
  | { readonly field: "endpointKind"; readonly problem: "unknown" }
  | { readonly field: "endpointValue"; readonly problem: "invalid" };

/**
 * Every way a recipient write or read can honestly say no.
 *
 * `duplicate-active-endpoint` is deliberately distinct from `invalid-input`: the address was
 * perfectly well formed and the tenant already has a live record for it, which is a different fact
 * a surface should be able to explain. `recipient-not-found` covers "no such row", "another
 * tenant's row" and "a malformed id" with ONE answer, so a probe cannot use the difference between
 * refusals to discover that a recipient exists in a tenant the caller cannot see.
 */
export type RecipientRefusal =
  | "unauthenticated"
  | "invalid-input"
  | "persistence-unavailable"
  | "duplicate-active-endpoint"
  | "recipient-not-found"
  | "recipient-already-retired";

export interface CreateRecipientInput {
  readonly displayName: string;
  readonly endpointKind: RecipientEndpointKind;
  /** Raw as typed. The writer normalizes; the caller does not get to pre-normalize. */
  readonly endpointValue: string;
}

/**
 * What a reader sees.
 *
 * `endpointValue` is the NORMALIZED stored address, returned because a human approving a send must
 * be able to read where it goes. There is deliberately no `verified` field to return: no
 * verification system exists, so a surface can only ever say "recorded address".
 */
export interface RecipientView {
  readonly id: string;
  readonly recordRef: string;
  readonly displayName: string;
  readonly endpointKind: RecipientEndpointKind;
  readonly endpointValue: string;
  readonly endpointDigest: string;
  readonly status: RecipientStatus;
  readonly createdAt: string;
  readonly createdByActorType: string | null;
  readonly createdByActorId: string | null;
}

export type CreateRecipientResult =
  | { readonly status: "created"; readonly recipient: RecipientView }
  | { readonly status: "refused"; readonly reason: RecipientRefusal;
      readonly problems?: readonly RecipientValidationProblem[] };

export type RetireRecipientResult =
  | { readonly status: "retired"; readonly recipient: RecipientView }
  | { readonly status: "refused"; readonly reason: RecipientRefusal };

export type ResolveRecipientResult =
  | { readonly status: "resolved"; readonly recipient: RecipientView }
  | { readonly status: "refused"; readonly reason: RecipientRefusal };

export interface RecipientListing {
  readonly recipients: readonly RecipientView[];
  /** Honest emptiness: a surface must be able to say WHY there is nothing, not just show zero. */
  readonly unavailableReason?: string;
}
