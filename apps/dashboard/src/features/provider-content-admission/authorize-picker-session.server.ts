/*
 * provider-content-admission/authorize-picker-session.server.ts — THE ONE PLACE A GOOGLE ACCESS
 * TOKEN IS ALLOWED TO REACH A BROWSER.
 *
 * ── READ THIS BEFORE CHANGING ANYTHING IN THIS FILE ─────────────────────────
 *
 * INT-4 and KID-1 established, and proved with firewalls, that a tenant's Google access token never
 * leaves the server: it is handed to a callback inside the credential vault's scoped-secret
 * boundary and spent there. That property is REAL and this file is a CONSCIOUS, BOUNDED EXCEPTION
 * to it. Nothing about that is hidden, minimised, or worded around.
 *
 * It exists because the Google Picker cannot work any other way. Google's own contract: "Your app
 * must send an OAuth 2.0 access token with views that access private user data when creating a
 * Picker object", supplied through `PickerBuilder.setOAuthToken`. The Picker renders inside
 * Google's own iframe, in the user's browser. There is no server-side Picker.
 *
 * ── WHY THE TOKEN COMES FROM HEBUN'S CONNECTION AND NOT FROM THE BROWSER ────
 *
 * The alternative is Google Identity Services in the browser: the page asks Google for its own
 * token and Hebun's stored credential is never touched. It was considered and REJECTED, for this
 * repository's oldest reason. That flow would create a SECOND Google authorization path that the
 * connection authority does not own and cannot see — a browser-side grant that
 * `getCapabilityAvailability` would be blind to, while continuing to answer questions about what
 * this tenant granted. Two interpreters of one truth is the defect class this codebase refuses
 * everywhere else, and it would be worse here than a scoped token handoff.
 *
 * ── WHAT IS ACTUALLY EXPOSED, STATED PRECISELY ──────────────────────────────
 *
 * EXPOSED   one Google ACCESS token, short-lived by Google's design, carrying only the scopes this
 *           tenant's connection actually holds.
 * NOT       the refresh token, the client secret, the state secret, any credential identifier, any
 *           integration identifier, any vault material, any other tenant's anything.
 *
 * THE BLAST RADIUS IS THE POINT OF THE WHOLE ADAPTATION. Under `drive.file` the token can reach
 * only files this user has already handed to Hebun through the Picker. That is what makes this
 * exception acceptable now and would NOT have made it acceptable under `drive.readonly`, where the
 * same token would have reached the user's entire Drive. The gate below therefore refuses unless
 * the PER-FILE capability is the one available.
 *
 * ── IT IS NOT A TOKEN ENDPOINT ──────────────────────────────────────────────
 *
 * It takes no capability, no scope, no integration id and no tenant. It answers exactly one
 * question — "may this human open the Picker for this organization, and with what" — and a firewall
 * asserts it is the only module in the repository that returns a token to a caller.
 *
 * SELECTION IS NOT ADMISSION. What comes back authorizes a file CHOOSER. It writes no Knowledge,
 * grants no Knowledge standing, and admits nothing; the admission is a separate act, under a
 * separate authority, that re-resolves everything for itself.
 *
 * Server-only.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  resolveKnowledgeWriteAuthority,
  type KnowledgeWriteAuthority,
} from "@/features/knowledge/knowledge-write-authority.server";
import { getCapabilityAvailability } from "@/features/integration-authority/capability-availability.server";
import { GOOGLE_DRIVE_FILE_CAPABILITY, GOOGLE_PROVIDER_KEY } from "@/features/provider-google/contracts";
import {
  resolveGooglePickerEnvironment,
  type GooglePickerConfiguration,
} from "@/features/provider-google/picker-environment.server";
import {
  withGoogleAccessToken,
  type GoogleAuthorizedCallDeps,
} from "@/features/provider-google/google-authorized-call.server";

/** Why a Picker session was not authorized. Each is a different thing for a person to do next. */
export type PickerSessionRefusal =
  | "not-authenticated"
  /** Signed in, but this role may not author Knowledge — so there is nothing to pick a document FOR. */
  | "knowledge-not-authorized"
  /** The deployment holds no Picker API key or app id. Nothing was read and no credential spent. */
  | "picker-not-configured"
  /** This organization has not granted Hebun the per-file Drive permission. */
  | "capability-not-available"
  | "integration-not-found"
  | "wrong-provider";

export type PickerSessionResult =
  | {
      readonly status: "authorized";
      /**
       * The browser-visible values, together because neither is usable without the other.
       *
       * There is deliberately no refresh token, no expiry Hebun invented, no integration id and no
       * credential id in this shape — a field for any of them is a field somebody fills in.
       */
      readonly accessToken: string;
      readonly apiKey: string;
      readonly appId: string;
    }
  | { readonly status: "refused"; readonly reason: PickerSessionRefusal; readonly detail: string }
  | { readonly status: "provider-failed"; readonly detail: string };

export interface PickerSessionDeps extends GoogleAuthorizedCallDeps {
  readonly resolveAuthority?: (tenant: TenantContext) => Promise<KnowledgeWriteAuthority>;
  readonly picker?: () => GooglePickerConfiguration;
}

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Picker session authorization is server-only.");
  }
}

/**
 * Authorize ONE Google Picker session for the signed-in human's own organization.
 *
 * The tenant comes from an already-resolved server-side context. There is no parameter at all
 * besides the context and injectable dependencies — no capability, no scope, no integration id, no
 * tenant id — so a caller cannot widen what this returns or point it at another organization.
 */
export async function authorizePickerSession(
  tenant: TenantContext | null,
  deps: PickerSessionDeps = {},
): Promise<PickerSessionResult> {
  assertServerOnly();

  /* 1 · AUTHENTICATED. */
  if (!tenant?.tenantId || !tenant.userId) {
    return {
      status: "refused",
      reason: "not-authenticated",
      detail: "No organization is resolved for this request, so no connection could be consulted.",
    };
  }

  /*
   * 2 · AUTHORIZED TO AUTHOR KNOWLEDGE — before a credential is spent.
   *
   * The Picker exists in Hebun for exactly one purpose: choosing a document to ADMIT. Someone who
   * could not admit one has no reason to hold a Google token, so the narrower gate is the correct
   * one even though picking writes nothing. It is the admission bridge's own gate order, applied to
   * the step before it.
   */
  const authority = await (deps.resolveAuthority ?? resolveKnowledgeWriteAuthority)(tenant);
  if (!authority.authorized) {
    return {
      status: "refused",
      reason: "knowledge-not-authorized",
      detail:
        "Your role may not establish organizational Knowledge, so Hebun did not open a document " +
        "chooser or read anything from Google.",
    };
  }

  /* 3 · CONFIGURED. Checked before the capability, because it costs nothing and needs no database. */
  const picker = (deps.picker ?? (() => resolveGooglePickerEnvironment(deps.env ?? process.env)))();
  if (picker.status !== "configured") {
    return {
      status: "refused",
      reason: "picker-not-configured",
      detail:
        "This deployment has no Google Picker configuration, so the document chooser cannot be " +
        "opened. No credential was spent.",
    };
  }

  /*
   * 4 · THE PER-FILE CAPABILITY, AND ONLY IT.
   *
   * Named as a constant rather than taken as a parameter. This is the assertion that keeps the
   * exception at the top of this file acceptable: a token released to a browser is a token that can
   * reach only files this user already handed to Hebun. A tenant holding the older Drive-wide grant
   * and not this one is refused here — deliberately, because that grant is exactly the one this
   * boundary must never hand to a browser.
   */
  const availability = await getCapabilityAvailability(tenant, { getDb: deps.getDb });
  const entry = availability.capabilities.find((c) => c.capability === GOOGLE_DRIVE_FILE_CAPABILITY);
  if (!entry || entry.state !== "available") {
    return {
      status: "refused",
      reason: "capability-not-available",
      detail:
        entry?.reason ??
        "This organization has not granted Hebun permission to open documents you choose in Google Drive.",
    };
  }

  const source = entry.sources.find((s) => s.readAvailable);
  if (!source) {
    return {
      status: "refused",
      reason: "integration-not-found",
      detail: "No connection in this organization can currently answer this capability.",
    };
  }
  if (source.providerKey !== GOOGLE_PROVIDER_KEY) {
    return {
      status: "refused",
      reason: "wrong-provider",
      detail: "The Picker session refuses any connection that is not a Google connection.",
    };
  }

  /*
   * 5 · THE EXCEPTION, PERFORMED ONCE AND IN THE OPEN.
   *
   * `withGoogleAccessToken` hands the plaintext to this callback inside the vault's scoped-secret
   * boundary and refreshes it if Google refuses it. Every released caller spends the token inside
   * that callback and returns a RESULT. This one returns the token itself, which is the whole
   * exception this file exists to make and to bound — see the header. The runner is unchanged and
   * still returns no token of its own; it is this caller that asks for one.
   */
  const minted = await withGoogleAccessToken(
    tenant,
    source.integrationId,
    async (accessToken) => ({ ok: true as const, value: accessToken }),
    deps,
  );

  if (!minted.ok) {
    /*
     * GOOGLE-PICKER-1 — THE SENTENCE MUST BE TRUE IN BOTH FAILURE MODES.
     *
     * It used to say Google did not authorize a chooser. That was accurate only when Google had
     * actually been asked, and this seam's callback never asks: the runner can also refuse because
     * the connection's token is spent and could not be replaced, with no Google involvement at all.
     * A refusal that names the wrong party sends a person to look in the wrong place.
     */
    return {
      status: "provider-failed",
      detail: "Hebun could not obtain a usable Google session for a document chooser right now.",
    };
  }

  return {
    status: "authorized",
    accessToken: minted.value,
    apiKey: picker.apiKey,
    appId: picker.appId,
  };
}
