/*
 * account-profile/contracts.ts — V1-STAGE-4. Pure.
 *
 * What a person may see and change about THEMSELVES, and what a Governance authority may see about
 * the team. This module creates no membership, role or permission authority: membership is I1's,
 * invitations are human-onboarding's, authority is Governance's. It only reads them, and writes one
 * field the repository had left unowned: `users.display_name`, by its owner only.
 *
 *   email   — read only: it is the login and ownership identity (AUTH-EMAIL-OWNERSHIP-1);
 *             changing it would void the ownership proof and every invitation bound to it.
 *   name    — read only: written once, by signup.
 *   display_name — editable by the person themself. It becomes their label everywhere
 *             (`display_name → name → email`), the same label every member already sees.
 */

export const DISPLAY_NAME_MAX = 80;
export const ACCOUNT_PROFILE_ENTITY_TYPE = "user" as const;
export const ACCOUNT_DISPLAY_NAME_CHANGED = "account.display_name.changed" as const;

/** Trimmed; empty means "clear it" (null). Refuses control characters and anything over the limit. */
export function normalizeDisplayName(raw: unknown): { readonly ok: true; readonly value: string | null } | { readonly ok: false } {
  if (typeof raw !== "string") return { ok: false };
  const value = raw.normalize("NFC").replace(/\s+/g, " ").trim();
  if (value === "") return { ok: true, value: null };
  if (value.length > DISPLAY_NAME_MAX) return { ok: false };
  if (/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/.test(value)) return { ok: false };
  return { ok: true, value };
}

export interface OwnProfileView {
  readonly email: string;
  readonly emailVerified: "verified" | "unverified" | "unknown";
  readonly name: string | null;
  readonly displayName: string | null;
  readonly profileVersion: number;
  readonly tenant: { readonly name: string; readonly slug: string; readonly status: string | null };
  readonly membership: { readonly roleName: string | null; readonly since: string };
  readonly viewerIsGovernanceAuthority: boolean;
}

export type OwnProfileRead =
  | { readonly status: "read"; readonly profile: OwnProfileView }
  | { readonly status: "unauthenticated" | "unavailable" };

export interface TeamMemberView {
  readonly userId: string;
  readonly label: string | null;
  readonly roleName: string | null;
  readonly since: string;
  readonly isViewer: boolean;
}

export interface PendingInvitationView {
  readonly invitationId: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly expired: boolean;
}

export type TeamRead =
  | {
      readonly status: "read";
      readonly members: readonly TeamMemberView[];
      readonly truncated: boolean;
      readonly invitations: readonly PendingInvitationView[];
    }
  /* Not a failure: the team is visible to the organization's Governance authority only, as before. */
  | { readonly status: "authority-only" }
  | { readonly status: "unauthenticated" | "unavailable" };

export type DisplayNameUpdate =
  | { readonly status: "updated"; readonly displayName: string | null; readonly profileVersion: number }
  | { readonly status: "unchanged" }
  | { readonly status: "refused"; readonly reason: "unauthenticated" | "invalid-display-name" | "stale-version" | "persistence-unavailable" };
