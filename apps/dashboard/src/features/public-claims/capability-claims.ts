/*
 * public-claims/capability-claims.ts — the CLOSED set of capability statements the public site is
 * permitted to make, and nothing else.
 *
 * ── WHAT THIS IS, AND WHAT IT IS EMPHATICALLY NOT ────────────────────────────
 *
 * It describes PRODUCT CAPABILITY: what Hebun, as a product, can do for an organization that has
 * one. It says nothing about any tenant, and it CANNOT: there is no database access here, no
 * session, no tenant context, no server import of any kind. A public page that derived a claim
 * from a real tenant's state would be publishing that tenant's state, which is the opposite of
 * what a marketing surface may do.
 *
 * It is also NOT a second source of truth. Every statement below rests on a contract that already
 * exists elsewhere in the repository, and each one names that contract in `provenance`. The
 * binding is enforced by `tests/pub1-public-surface/claim-truth.ts`, which reads the authoritative
 * contracts and fails when one of them moves in a way that makes a statement here stale. That is
 * the whole design: the claim lives here so a page can render it, and the PROOF lives in the test
 * so the claim cannot quietly drift away from the code.
 *
 * ── WHY A CLOSED SET ─────────────────────────────────────────────────────────
 *
 * An open list invites a copywriter to add a row. A closed union means a new public capability
 * claim is a typed change with a test that must be extended alongside it, which is exactly the
 * friction a marketing surface over an honest product needs.
 *
 * Pure. No React, no I/O, no server, no authority.
 */

/** The capability statements the public site may make. Adding one is a deliberate typed change. */
export type PublicCapabilityId =
  | "tenant-workspace"
  | "knowledge-ingestion"
  | "evidence-backed-answers"
  | "coverage-view"
  | "governed-action-authorization"
  | "google-connection"
  | "drive-metadata-read";

/**
 * The state a capability is published in.
 *
 *   available   an organization can use it today, within the stated limit.
 *   read-only   it exists and reads; it cannot write anything back.
 *
 * There is deliberately no "coming soon", "beta" or "planned" state. A capability that cannot be
 * used is not published at all — it is absent from this union, and therefore absent from the site.
 */
export type PublicCapabilityState = "available" | "read-only";

export interface PublicCapabilityClaim {
  readonly id: PublicCapabilityId;
  /** The capability, in the words a reader outside the company would use. */
  readonly capability: string;
  readonly state: PublicCapabilityState;
  /** Where the capability stops. Published with the same weight as the capability itself. */
  readonly limit: string;
  /** The repository contract this statement rests on. Bound by the claim-truth test. */
  readonly provenance: string;
}

export const PUBLIC_CAPABILITY_CLAIMS: readonly PublicCapabilityClaim[] = Object.freeze([
  Object.freeze({
    id: "tenant-workspace" as const,
    capability: "Tenant workspace",
    state: "available" as const,
    limit:
      "Membership is by invitation from the organization. There is no self-serve sign-up, and every read is scoped to the organization the request belongs to.",
    provenance:
      "src/middleware.ts (no public product route) + src/app/login/join/page.tsx (invitation/enrollment entry, no sign-up form)",
  }),
  Object.freeze({
    id: "knowledge-ingestion" as const,
    capability: "Knowledge ingestion",
    state: "available" as const,
    limit:
      "Pasted text, a UTF-8 .txt or .md file, or a text-bearing PDF. No OCR, no connector, no scheduled import, and the uploaded bytes are not retained.",
    provenance: "src/features/knowledge/capability-map.ts — capability `ingestion`, state `connected`",
  }),
  Object.freeze({
    id: "evidence-backed-answers" as const,
    capability: "Evidence-backed answers",
    state: "available" as const,
    limit:
      "Evidence is selected for a question being answered. There is no search surface, no semantic matching and no embeddings.",
    provenance:
      "src/features/knowledge/capability-map.ts — `retrieval` connected; `search`, `semantic-retrieval`, `fuzzy-matching` and `embeddings` not-connected",
  }),
  Object.freeze({
    id: "coverage-view" as const,
    capability: "Coverage view",
    state: "available" as const,
    limit:
      "Counted over the knowledge your organization has written down, by area — not over your other systems.",
    provenance: "src/features/knowledge/company-understanding-read.server.ts (per-domain aggregate over knowledge facts)",
  }),
  Object.freeze({
    id: "governed-action-authorization" as const,
    capability: "Governed action authorization",
    state: "available" as const,
    limit:
      "Request, decision, permit and consumption are four separate recorded steps. Nothing acts on its own initiative.",
    provenance:
      "src/features/action-authorization/{record-action-request,decide-action-request,consume-action-permit,revoke-action-permit}.server.ts",
  }),
  Object.freeze({
    id: "google-connection" as const,
    capability: "Google connection",
    state: "available" as const,
    limit:
      "Bound to a Google account. What Hebun may do is derived from the scope that account actually granted; Workspace-wide administrative identity is not requested.",
    provenance: "src/features/provider-catalog/catalog.ts — the catalog holds exactly one provider, `google-workspace`",
  }),
  Object.freeze({
    id: "drive-metadata-read" as const,
    capability: "Drive metadata read",
    state: "read-only" as const,
    limit:
      "File names, types and timestamps under drive.metadata.readonly. No file content is read, nothing in Drive is written, and nothing read from Drive is persisted as knowledge.",
    provenance:
      "src/features/provider-google/contracts.ts — GOOGLE_DRIVE_METADATA_SCOPE; src/features/provider-catalog/catalog.ts — empty write scope set",
  }),
]);

/** How a state is written on the page. Kept next to the union so the two cannot diverge. */
export const PUBLIC_CAPABILITY_STATE_LABEL: Readonly<Record<PublicCapabilityState, string>> =
  Object.freeze({
    available: "Available",
    "read-only": "Read-only",
  });

/**
 * The governed path, published as an ORDERED chain with an explicit maturity note per stage.
 *
 * ── WHY `note` EXISTS ────────────────────────────────────────────────────────
 *
 * Six equal boxes imply six equally mature stages, and that would be the one dishonest thing on
 * the page: the first four are what an organization uses today, and the last two are bounded in
 * ways a diagram hides. The note carries that difference, so the rendering cannot flatten it.
 */
export interface GovernedPathStage {
  readonly step: number;
  readonly name: string;
  readonly summary: string;
  /** The boundary that keeps this stage from being read as broader than it is. */
  readonly note: string;
}

export const GOVERNED_PATH: readonly GovernedPathStage[] = Object.freeze([
  Object.freeze({
    step: 1,
    name: "Knowledge",
    summary: "Text a permitted person brought in becomes a record, attributed and versioned.",
    note: "Held as a provisional draft until a governing act says otherwise.",
  }),
  Object.freeze({
    step: 2,
    name: "Evidence",
    summary: "The records that bear on one question are selected and shown with the answer.",
    note: "Selection is lexical. There is no semantic matching and no browse surface.",
  }),
  Object.freeze({
    step: 3,
    name: "Decision",
    summary: "A named authority decides, and the decision is written down.",
    note: "Governed decisions today cover one subject: an organization's knowledge records.",
  }),
  Object.freeze({
    step: 4,
    name: "Permit",
    summary: "Authorization is issued as its own record before anything runs.",
    note: "A permit is spent by a specific act; it is not a standing permission.",
  }),
  Object.freeze({
    step: 5,
    name: "Action",
    summary: "An act is attempted only against a permit that already exists.",
    note: "Acts inside Hebun. No external system is written to from here.",
  }),
  Object.freeze({
    step: 6,
    name: "Audit record",
    summary: "The act is recorded durably, with its actor and its authority.",
    note: "Governed acts write durable audit records. Not every surface in the product is one.",
  }),
]);

/** The security mechanisms the public site may name. Mechanisms only — never adjectives. */
export interface SecurityMechanism {
  /** A technical identifier, rendered in the mono register. */
  readonly field: string;
  readonly statement: string;
  readonly provenance: string;
}

export const SECURITY_MECHANISMS: readonly SecurityMechanism[] = Object.freeze([
  Object.freeze({
    field: "passwords",
    statement: "Stored only as scrypt hashes. There is no recoverable copy anywhere in the system.",
    provenance: "src/features/auth-runtime/password-hash.server.ts",
  }),
  Object.freeze({
    field: "sessions",
    statement: "Session references are stored as HMAC digests, never as the value a browser carries.",
    provenance: "src/features/auth-runtime/session-digest.server.ts",
  }),
  Object.freeze({
    field: "credentials",
    statement:
      "Provider credentials are encrypted with AES-256-GCM and bound to the row they belong to, so a credential moved between organizations fails to decrypt rather than quietly working.",
    provenance: "src/features/secret-encryption/authenticated-encryption.server.ts — SECRET_ALGORITHM_AES_256_GCM",
  }),
  Object.freeze({
    field: "tenant boundary",
    statement:
      "Every read is scoped to the organization the request belongs to, resolved per request rather than trusted from sign-in.",
    provenance: "src/features/auth-runtime/request-session.server.ts — resolveTenantContext",
  }),
  Object.freeze({
    field: "secret handling",
    statement:
      "A stored credential is never rendered to any screen and never leaves the server seam that spends it.",
    provenance: "src/features/provider-google/google-authorized-call.server.ts — withGoogleAccessToken",
  }),
  Object.freeze({
    field: "authorization",
    statement:
      "An action is requested, decided and permitted before it runs. Authority is read from a recorded act, never inferred from a role name.",
    provenance: "src/features/governance-decision/decision-authority.server.ts",
  }),
  Object.freeze({
    field: "audit",
    statement: "Governed acts write durable audit records, carrying the actor and the authority behind them.",
    provenance: "src/features/governance-audit/*",
  }),
]);

/** What a governed record carries. FIELD NAMES ONLY — the site shows no record it does not hold. */
export interface RecordField {
  readonly field: string;
  readonly meaning: string;
}

export const GOVERNED_RECORD_ANATOMY: readonly RecordField[] = Object.freeze([
  Object.freeze({ field: "subject", meaning: "The thing decided about." }),
  Object.freeze({ field: "authority", meaning: "The recorded act that made this decider able to decide." }),
  Object.freeze({ field: "actor", meaning: "Who performed it — a person, never a system role name." }),
  Object.freeze({ field: "tenant", meaning: "The organization it belongs to, checked on every read." }),
  Object.freeze({ field: "recorded_at", meaning: "When it happened, written once." }),
  Object.freeze({
    field: "lifecycle",
    meaning: "Whether the record stands, was superseded, or was withdrawn — never inferred.",
  }),
]);
