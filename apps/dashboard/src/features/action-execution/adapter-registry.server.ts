/*
 * action-execution/adapter-registry.server.ts — which adapter, if any, may run (R3B).
 *
 * ── A FROZEN CODE LITERAL, NOT A TABLE ───────────────────────────────────────
 *
 * Gate A audited `providers`, `integrations` and the provider-routing modules. All are dead: zero
 * rows, zero writers, zero readers. Activating one to hold a single adapter would create a SECOND
 * AUTHORITY deciding what Hebun may run — a row somebody could add to make a new external
 * capability appear without a migration, a review or a test. The same reasoning already produced
 * `heby-actions/action-registry.ts` as a frozen literal, and this is the same shape.
 *
 * The registry answers availability. It never answers permission: the durable kill switch and the
 * permit do that, and neither is readable from here.
 *
 * ── WHY DESCRIPTOR AND INSTANCE ARE SEPARATE ─────────────────────────────────
 *
 * Asking "is an adapter available" must not be the thing that touches a credential. The descriptor
 * answers availability from the registry alone; constructing the instance is the only step that
 * reads a secret, and it happens once, immediately before the send.
 *
 * Server-only.
 */
import {
  createEmailHttpsTransport,
  EMAIL_HTTPS_ADAPTER_ID,
  EXTERNAL_SEND_API_KEY_ENV,
  EXTERNAL_SEND_ENDPOINT_ENV,
  isExternalSendCredentialPresent,
  resolveExternalSendEndpoint,
  type FetchLike,
} from "@/features/action-execution-live/email-https-transport.server";
import type {
  ExternalEndpointKind,
  ExternalSendAdapter,
  ExternalSendAdapterDescriptor,
} from "./adapter-contract";

/** EXACTLY ONE ENTRY. A second one arrives with the action that needs it, never speculatively. */
const ADAPTERS: readonly ExternalSendAdapterDescriptor[] = Object.freeze([
  Object.freeze({
    adapterId: EMAIL_HTTPS_ADAPTER_ID,
    endpointKind: "email" as const,
    credentialEnvKey: EXTERNAL_SEND_API_KEY_ENV,
    endpointEnvKey: EXTERNAL_SEND_ENDPOINT_ENV,
    describes:
      "Posts one prepared message to a configured HTTPS provider endpoint and reports what the " +
      "provider said. Acceptance is not delivery. No vendor is selected until deployment " +
      "configuration names one.",
  }),
]);

export function listExternalSendAdapters(): readonly ExternalSendAdapterDescriptor[] {
  return ADAPTERS;
}

export function findAdapterDescriptor(
  endpointKind: ExternalEndpointKind,
): ExternalSendAdapterDescriptor | undefined {
  return ADAPTERS.find((adapter) => adapter.endpointKind === endpointKind);
}

/**
 * Why an adapter could not be produced, or `null` when one could.
 *
 * Two distinct reasons, because they need different fixes: `adapter-unavailable` means no
 * implementation exists for the channel, and `credential-unavailable` means one exists but
 * deployment has not armed it. Collapsing them would tell a Director to configure a secret for a
 * channel Hebun cannot reach at all.
 */
export type AdapterAvailability = "adapter-unavailable" | "credential-unavailable" | null;

export interface AdapterResolutionDeps {
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** Injected in tests so the network seam is never real. Production leaves this unset. */
  readonly fetchImpl?: FetchLike;
}

/** Availability WITHOUT constructing anything and WITHOUT reading a secret's value. */
export function checkAdapterAvailability(
  endpointKind: ExternalEndpointKind,
  deps: AdapterResolutionDeps = {},
): AdapterAvailability {
  const env = deps.env ?? process.env;
  const descriptor = findAdapterDescriptor(endpointKind);
  if (!descriptor) return "adapter-unavailable";
  /* An endpoint that is unset — or not HTTPS — means the channel is not reachable at all. */
  if (!resolveExternalSendEndpoint(env)) return "adapter-unavailable";
  if (!isExternalSendCredentialPresent(env)) return "credential-unavailable";
  return null;
}

/**
 * Construct the adapter. The ONLY place a credential value is read, and it is handed straight to
 * the transport without being stored, returned, logged or copied anywhere else.
 */
export function resolveExternalSendAdapter(
  endpointKind: ExternalEndpointKind,
  deps: AdapterResolutionDeps = {},
): ExternalSendAdapter | null {
  if (typeof window !== "undefined") {
    throw new Error("Adapter resolution is server-only.");
  }
  const env = deps.env ?? process.env;
  if (checkAdapterAvailability(endpointKind, deps) !== null) return null;
  const endpointUrl = resolveExternalSendEndpoint(env);
  if (!endpointUrl) return null;
  try {
    return createEmailHttpsTransport({
      apiKey: env[EXTERNAL_SEND_API_KEY_ENV]!.trim(),
      endpointUrl,
      fetchImpl: deps.fetchImpl,
    });
  } catch {
    /* Construction validates HTTPS and credential presence. A throw means unavailable, not armed. */
    return null;
  }
}
