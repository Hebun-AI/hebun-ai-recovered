/*
 * self-service-signup/contracts.ts — the typed vocabulary of a new customer arriving.
 *
 * ── THE QUESTION THIS PHASE ANSWERS, AND THE ONES IT REFUSES ────────────────
 *
 *   ANSWERED   How does an anonymous visitor become a human with an organization of their own?
 *   REFUSED    Who may join an EXISTING organization?   (I1/I2 — invitation. Untouched.)
 *   REFUSED    Who is the Governance authority?          (G2 — genesis. Signup nominates nobody.)
 *   REFUSED    Which providers may this tenant reach?    (Integrations, later and explicitly.)
 *   REFUSED    What may this human do afterwards?        (Role bands, already decided.)
 *
 * ── IT IS AN ORCHESTRATOR, NOT AN AUTHORITY ─────────────────────────────────
 *
 * It owns NO table. Every row it causes is written by the authority that owns it — Identity writes
 * the human, Credential writes the secret, Tenant Provisioning writes the tenant, its role and its
 * membership — and this module's entire contribution is that they happen in ONE transaction and in
 * the right order. It has no repository, no schema import and no insert of its own.
 *
 * Pure types and frozen values. No React, no I/O, no database.
 */

/**
 * What the BROWSER may send. Four fields, all of them things only the human knows.
 *
 * ── WHAT IS DELIBERATELY ABSENT ─────────────────────────────────────────────
 *
 * There is no `tenantId`, no `companyId`, no `roleId`, no `membershipId`, no role band and no
 * provisioning source. Not "ignored if present" — ABSENT FROM THE TYPE, so there is no field for a
 * forged value to arrive in and no validation rule anyone has to remember to write. Every
 * authoritative identifier is minted by the database, and the provenance is a literal the server
 * supplies.
 *
 * That is the whole of "the browser cannot choose a tenant": not a check, a shape.
 */
export interface SignupInput {
  readonly fullName: string;
  readonly email: string;
  readonly password: string;
  readonly organizationName: string;
}

/**
 * Why a signup did not happen.
 *
 * ── ON TELLING A VISITOR THEIR EMAIL IS TAKEN ───────────────────────────────
 *
 * `email-already-registered` is an enumeration oracle and it is a deliberate, bounded one. A signup
 * form cannot function without it — a visitor whose address already exists must be told to sign in
 * instead of being left staring at a form that silently refuses — and the repository already made
 * this exact call: `start-enrollment` returns `already-enrolled` for the same reason.
 *
 * What it does NOT do is widen: it reveals that an address is registered, never which organization
 * it belongs to, whether it is active, or anything about the tenant. SIGN-IN keeps its own stricter
 * policy unchanged, where `no-identity`, `no-credential` and `bad-password` all collapse into one
 * client-visible answer.
 */
export type SignupRefusal =
  | "invalid-name"
  | "invalid-email"
  | "password-unacceptable"
  | "invalid-organization-name"
  /** The address already names a human. The visitor should sign in. */
  | "email-already-registered"
  /** The organization name derives to a slug another tenant already holds. */
  | "organization-name-unavailable"
  /** Identity or persistence authority could not be reached. Nothing was written. */
  | "persistence-unavailable";

/**
 * What a successful signup produced.
 *
 * The tenant id is here because the CALLER — a server action — needs it to bind the session. It
 * never crosses to the browser: the action turns it into a session cookie server-side and returns a
 * redirect, so nothing in this shape is ever serialized to a client component.
 */
export interface SignupSuccess {
  readonly userId: string;
  readonly authIdentityId: string;
  readonly tenantId: string;
  readonly membershipId: string;
  readonly roleId: string;
  readonly normalizedEmail: string;
  readonly organizationName: string;
}

export type SignupOutcome =
  | { readonly status: "created"; readonly account: SignupSuccess }
  | { readonly status: "refused"; readonly reason: SignupRefusal };

/* ── Bounds. Not policy — the widest a field may be before it is certainly wrong. ───────────── */

export const MAX_FULL_NAME_CHARACTERS = 120;
export const MAX_ORGANIZATION_NAME_CHARACTERS = 200;
/** Same bound as `invitations.normalized_email`, reused rather than restated. */
export const MAX_EMAIL_CHARACTERS = 320;

const CONTROL_CHARACTERS = /[\p{Cc}]/u;

/**
 * Deliberately minimal, and the same shape `validateProvisionInput` already settled on: an address
 * must be present, single-line and contain an `@` with something either side.
 *
 * Hebun does not decide whether an address is DELIVERABLE — nothing here sends mail, and a stricter
 * pattern would reject real addresses while still not proving anything. There is no email
 * verification in this build and this module does not pretend otherwise.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return (email ?? "").trim().toLowerCase();
}

export function normalizeName(value: string): string {
  return (value ?? "").trim();
}

/**
 * Derive a tenant slug from the organization name the human typed.
 *
 * ── WHY DERIVING IS SAFE HERE AND REFUSED IN THE CEREMONY ───────────────────
 *
 * The operator ceremony REFUSES a malformed slug rather than rewriting one, because an operator
 * types the identifier itself and confirms it by retyping — silently changing it would mean they
 * confirmed one thing and the database received another.
 *
 * A signing-up human types a COMPANY NAME and never sees a slug, so there is nothing for them to
 * have confirmed and nothing to contradict. Deriving is therefore the honest act, and it is a
 * separate, named function rather than a loosening of the ceremony's rule.
 *
 * Returns `null` when nothing usable survives — a name of only punctuation or non-Latin script
 * derives to an empty slug, and inventing one (`tenant-7f3a`) would hand the customer an identifier
 * with no relationship to anything they typed.
 */
export function deriveTenantSlugCandidate(organizationName: string): string | null {
  const slug = normalizeName(organizationName)
    .toLowerCase()
    /* Anything that is not a lowercase letter or digit becomes a separator. */
    .replace(/[^a-z0-9]+/g, "-")
    /* Collapse and trim the separators so the result matches the authority's slug rule exactly. */
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (slug.length === 0) return null;
  /*
   * Bounded to the authority's own maximum, then re-trimmed: truncation can leave a trailing
   * separator, and a slug ending in `-` is not one the authority admits.
   */
  const bounded = slug.slice(0, 64).replace(/-$/, "");
  return bounded.length === 0 ? null : bounded;
}

/** Pure field validation. No database, no clock. Returns the first refusal, or `null` when valid. */
export function validateSignupInput(input: SignupInput, minPasswordLength: number): SignupRefusal | null {
  const fullName = normalizeName(input?.fullName ?? "");
  if (fullName.length === 0 || fullName.length > MAX_FULL_NAME_CHARACTERS) return "invalid-name";
  if (CONTROL_CHARACTERS.test(fullName)) return "invalid-name";

  const email = normalizeEmail(input?.email ?? "");
  if (email.length === 0 || email.length > MAX_EMAIL_CHARACTERS) return "invalid-email";
  if (!EMAIL_PATTERN.test(email)) return "invalid-email";

  /*
   * LENGTH ONLY, and the SAME length enrollment already requires. A composition rule this module
   * invented would be a second password policy, and two policies drift.
   */
  const password = input?.password ?? "";
  if (typeof password !== "string" || password.length < minPasswordLength) {
    return "password-unacceptable";
  }

  const organizationName = normalizeName(input?.organizationName ?? "");
  if (organizationName.length === 0 || organizationName.length > MAX_ORGANIZATION_NAME_CHARACTERS) {
    return "invalid-organization-name";
  }
  if (CONTROL_CHARACTERS.test(organizationName)) return "invalid-organization-name";
  if (deriveTenantSlugCandidate(organizationName) === null) return "invalid-organization-name";

  return null;
}

/**
 * What a human is told, per refusal.
 *
 * None of these names an internal authority, a table or a constraint. `organization-name-unavailable`
 * deliberately says the NAME is taken rather than explaining slugs — a customer should not have to
 * learn Hebun's identifier scheme to pick a second name.
 */
export const SIGNUP_REFUSAL_SENTENCES: Readonly<Record<SignupRefusal, string>> = Object.freeze({
  "invalid-name": "Enter your name.",
  "invalid-email": "Enter a valid work email address.",
  "password-unacceptable": "Choose a password of at least 12 characters.",
  "invalid-organization-name":
    "Enter your organization's name using letters or numbers.",
  "email-already-registered":
    "An account already exists for this email address. Sign in instead.",
  "organization-name-unavailable":
    "That organization name is already in use. Choose a different one.",
  "persistence-unavailable":
    "Hebun could not complete the setup just now, so no account was created. Try again in a moment.",
});
