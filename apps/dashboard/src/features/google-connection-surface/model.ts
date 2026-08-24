/*
 * google-connection-surface/model.ts — WHAT A HUMAN IS TOLD ABOUT THEIR GOOGLE CONNECTION.
 *
 * ── IT READS THE CONNECTION AUTHORITY, AND NOTHING ELSE ──────────────────────
 *
 * Not the credential authority, not the vault, not Google. A surface that could see a credential
 * would eventually render one, and a surface that could ask Google would become a second verifier
 * with its own opinion about what `connected` means.
 *
 * ── A CREDENTIAL IS NOT A CONNECTION, AND THIS MODEL CANNOT CONFUSE THEM ─────
 *
 * There is no field here for "a credential exists". The only thing that produces `connected` is
 * `connection_state`, written by the one writer that requires a real Google response. So the UI
 * literally has no way to infer a connection from a stored secret — it never learns one exists.
 *
 * Pure data. No React, no I/O of its own, no secrets.
 */
import type { IntegrationView } from "@/features/integration-authority/contracts";
import {
  GOOGLE_DRIVE_METADATA_SCOPE,
  GOOGLE_PROVIDER_KEY,
  GOOGLE_REQUIRED_GRANTED_SCOPES,
} from "@/features/provider-google/contracts";

export type GoogleSurfaceState =
  | "not-configured"
  | "not-connected"
  | "unverified"
  | "connected"
  | "degraded"
  | "expired"
  | "ended";

export interface GoogleConnectionModel {
  readonly state: GoogleSurfaceState;
  /** The verified Google account, or null. A LABEL — the identity is the subject id, unshown. */
  readonly accountLabel: string | null;
  /** Exactly what Google said it granted. Never what Hebun requested. */
  readonly grantedScopes: readonly string[];
  readonly lastVerifiedAt: string | null;
  /** A classified reason from the verifier. Never a provider payload. */
  readonly failureReason: string | null;
  /** True only when a human may start an authorization right now. */
  readonly connectable: boolean;
}

const NOT_CONFIGURED: GoogleConnectionModel = Object.freeze({
  state: "not-configured" as const,
  accountLabel: null,
  grantedScopes: Object.freeze([]),
  lastVerifiedAt: null,
  failureReason: null,
  connectable: false,
});

/**
 * Fold the tenant's connections into one honest statement about Google.
 *
 * `configured` is a BOOLEAN the caller resolved from the environment — the client id and secret
 * never travel into this module, let alone into a component.
 */
export function buildGoogleConnectionModel(
  connections: readonly IntegrationView[],
  configured: boolean,
): GoogleConnectionModel {
  if (!configured) return NOT_CONFIGURED;

  const google = connections
    .filter((c) => c.providerKey === GOOGLE_PROVIDER_KEY)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  if (!google) {
    return { ...NOT_CONFIGURED, state: "not-connected", connectable: true };
  }

  const base = {
    accountLabel: google.externalAccountLabel,
    grantedScopes: google.scopes,
    lastVerifiedAt: google.lastVerifiedAt,
    failureReason: google.failureReason,
  };

  switch (google.connectionState) {
    case "connected":
      /*
       * LIFECYCLE AND HEALTH ARE SEPARATE, and the surface says both. A connected provider that is
       * not answering is `degraded` here while the grant remains entirely intact — the tenant is
       * told what is wrong without being told to reconnect something nobody took away.
       */
      return {
        ...base,
        state: google.health === "healthy" ? "connected" : "degraded",
        connectable: false,
      };
    case "expired":
      return { ...base, state: "expired", connectable: true };
    case "draft":
    case "unverified":
      return { ...base, state: "unverified", connectable: true };
    case "revoked":
    case "disconnected":
      return { ...base, state: "ended", connectable: true };
    default:
      return { ...base, state: "not-connected", connectable: true };
  }
}

/** What each state means, in the words a human should read. No jargon, no false progress. */
export const GOOGLE_STATE_SENTENCES: Readonly<Record<GoogleSurfaceState, string>> = Object.freeze({
  "not-configured":
    "Google is not configured for this deployment, so no connection can be started here.",
  "not-connected": "No Google account is connected for this organization.",
  unverified:
    "An authorization was recorded but Google has not confirmed it, so nothing is connected yet.",
  connected: "Google confirmed this account.",
  degraded:
    "Google is not answering right now. The authorization is unaffected and no reconnection is needed.",
  expired:
    "The authorization Hebun holds can no longer be used and cannot be renewed. Reconnecting requires consent again.",
  ended: "This connection was ended. Connecting again creates a new one.",
});

/*
 * ── WHAT THE GRANT ACTUALLY PERMITS, DERIVED FROM THE GRANT ──────────────────
 *
 * `GOOGLE_STATE_SENTENCES` is keyed by LIFECYCLE state, and lifecycle knows nothing about scopes.
 * Its `connected` entry therefore used to carry "Identity only — no Drive, Calendar or directory
 * access", which was true while identity was the only grant Hebun could obtain and became false
 * the moment a tenant upgraded to Drive metadata. A sentence that cannot see the grant must not
 * describe the grant, so the access description lives here and reads `grantedScopes` — Google's own
 * statement, persisted by the callback — and nothing else.
 *
 * NOT the provider catalog, NOT the requested scopes, NOT the OAuth configuration, NOT whether a
 * credential exists. Each of those is something Hebun wanted or holds; only this list is something
 * Google agreed to.
 *
 * ── AND IT NEVER OVERSTATES ──────────────────────────────────────────────────
 *
 * `drive.metadata.readonly` cannot download a file — `alt=media` requires a wider scope — and it
 * grants no write of any kind. Both denials are stated because a tenant reading "Drive access"
 * would otherwise reasonably assume the larger thing.
 *
 * A scope this function does not recognize is reported as exactly that. Claiming "identity only"
 * beside a grant carrying something unrecognized is the same class of untruth this function exists
 * to remove, and the raw scope list is rendered alongside so nothing is hidden.
 */
export function describeGoogleGrantedAccess(
  grantedScopes: readonly string[],
): readonly string[] {
  const identity = new Set<string>(GOOGLE_REQUIRED_GRANTED_SCOPES);
  const beyondIdentity = grantedScopes.filter((scope) => !identity.has(scope));

  if (beyondIdentity.length === 0) {
    return Object.freeze([
      "Identity only. Google granted no Drive, Calendar or directory access.",
    ]);
  }

  const lines: string[] = [];
  if (beyondIdentity.includes(GOOGLE_DRIVE_METADATA_SCOPE)) {
    lines.push(
      "Google Drive: file names, types and timestamps only. No file contents can be read, " +
        "and nothing in Drive can be created, changed or deleted.",
    );
  }

  const undescribed = beyondIdentity.filter((scope) => scope !== GOOGLE_DRIVE_METADATA_SCOPE);
  if (undescribed.length > 0) {
    lines.push(
      "Google granted further access this page cannot describe. The complete list is below.",
    );
  }

  return Object.freeze(lines);
}
