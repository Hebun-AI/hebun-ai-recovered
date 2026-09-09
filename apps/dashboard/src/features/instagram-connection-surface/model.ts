/*
 * instagram-connection-surface/model.ts — one honest sentence about Instagram.
 *
 * A PURE FOLD over what the connection authority already read. It queries nothing, imports no
 * credential authority, and cannot see a secret: `configured` arrives as a BOOLEAN the caller
 * resolved from the environment, so the App id and secret never travel into this module and cannot
 * reach a component.
 *
 * ── WHY IT MIRRORS GOOGLE'S RATHER THAN GENERALIZING IT ─────────────────────
 *
 * Google's model encodes Google's own vocabulary — identity scopes, a Drive upgrade, a refresh
 * token that may be absent. None of that is true here, and a shared model would have to carry both
 * providers' exceptions to say either one's truth. The lifecycle vocabulary being identical is not
 * an accident: it belongs to the connection authority, which both providers share and neither owns.
 */
import type { IntegrationView } from "@/features/integration-authority/contracts";
import { INSTAGRAM_PROVIDER_KEY } from "@/features/provider-instagram/contracts";

export type InstagramSurfaceState =
  | "not-configured"
  | "not-connected"
  | "unverified"
  | "connected"
  | "degraded"
  | "expired"
  | "ended";

export interface InstagramConnectionModel {
  readonly state: InstagramSurfaceState;
  /** The verified account, or null. A LABEL — the binding id is the numeric one, unshown. */
  readonly accountLabel: string | null;
  /** Exactly what Instagram said it granted. Never what Hebun requested. */
  readonly grantedScopes: readonly string[];
  readonly lastVerifiedAt: string | null;
  /** A classified reason from the verifier. Never a provider payload. */
  readonly failureReason: string | null;
  /** True only when a human may start an authorization right now. */
  readonly connectable: boolean;
}

const NOT_CONFIGURED: InstagramConnectionModel = Object.freeze({
  state: "not-configured" as const,
  accountLabel: null,
  grantedScopes: Object.freeze([]),
  lastVerifiedAt: null,
  failureReason: null,
  connectable: false,
});

/** Fold the tenant's connections into one statement about Instagram. */
export function buildInstagramConnectionModel(
  connections: readonly IntegrationView[],
  configured: boolean,
): InstagramConnectionModel {
  if (!configured) return NOT_CONFIGURED;

  const instagram = connections
    .filter((c) => c.providerKey === INSTAGRAM_PROVIDER_KEY)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  if (!instagram) return { ...NOT_CONFIGURED, state: "not-connected", connectable: true };

  const base = {
    accountLabel: instagram.externalAccountLabel,
    grantedScopes: instagram.scopes,
    lastVerifiedAt: instagram.lastVerifiedAt,
    failureReason: instagram.failureReason,
  };

  switch (instagram.connectionState) {
    case "connected":
      /*
       * LIFECYCLE AND HEALTH ARE SEPARATE, and the surface says both. A connected provider that is
       * not answering is `degraded` while the grant remains intact — the tenant is told what is
       * wrong without being told to reconnect something nobody took away.
       */
      return {
        ...base,
        state: instagram.health === "healthy" ? "connected" : "degraded",
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

/**
 * What each state means, in the words a human should read.
 *
 * NONE of these sentences promises an observation. A connected Instagram account is an account
 * Hebun CAN read, not one it is authorized to read on a schedule — that is a Governance decision
 * this surface does not make and must not imply.
 */
export const INSTAGRAM_STATE_SENTENCES: Readonly<Record<InstagramSurfaceState, string>> =
  Object.freeze({
    "not-configured":
      "This deployment has no Instagram application configured, so no authorization can be started.",
    "not-connected": "No Instagram account is connected to this organization.",
    unverified:
      "An authorization was started but Instagram has not yet confirmed an account. Nothing is connected.",
    connected:
      "Instagram confirmed the account and the connection is live. Hebun can read it; whether it does is a separate authorization.",
    degraded:
      "The grant is intact but Instagram is not answering right now. Nothing was revoked and no reconnection is needed.",
    expired:
      "The grant is no longer usable. Instagram access tokens last about sixty days and this one must be re-authorized.",
    ended: "The connection was ended. Nothing is stored and no account is bound.",
  });
