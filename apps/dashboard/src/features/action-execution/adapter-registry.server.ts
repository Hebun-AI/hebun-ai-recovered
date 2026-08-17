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
  createResendEmailTransport,
  EXTERNAL_SEND_API_KEY_ENV,
  EXTERNAL_SEND_FROM_ENV,
  EXTERNAL_SEND_SUBJECT_ENV,
  isExternalSendCredentialPresent,
  RESEND_ADAPTER_ID,
  RESEND_SEND_ENDPOINT,
  resolveExternalSendSender,
  resolveExternalSendSubject,
  type FetchLike,
} from "@/features/action-execution-live/resend-email-transport.server";
import type {
  ExternalEndpointKind,
  ExternalSendAdapter,
  ExternalSendAdapterDescriptor,
} from "./adapter-contract";

/** EXACTLY ONE ENTRY. A second one arrives with the action that needs it, never speculatively. */
const ADAPTERS: readonly ExternalSendAdapterDescriptor[] = Object.freeze([
  Object.freeze({
    adapterId: RESEND_ADAPTER_ID,
    endpointKind: "email" as const,
    providerEndpoint: RESEND_SEND_ENDPOINT,
    credentialEnvKey: EXTERNAL_SEND_API_KEY_ENV,
    senderEnvKey: EXTERNAL_SEND_FROM_ENV,
    subjectEnvKey: EXTERNAL_SEND_SUBJECT_ENV,
    describes:
      "Posts one prepared message to Resend and reports what Resend said. Acceptance is not " +
      "delivery. The vendor is selected and the host is fixed in code; deployment still has to " +
      "supply the credential, the sender and the subject, and the Director still has to enable " +
      "the durable external-send switch, before anything can be sent.",
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
 * DEPLOYMENT HAS NOT ARMED IT. Collapsing them would tell a Director to configure a secret for a
 * channel Hebun cannot reach at all.
 *
 * Since the Resend mapping, "not armed" covers three values — credential, sender, subject — and
 * all three report as `credential-unavailable`. That reads slightly wide, and it is deliberate:
 * these are the only two values `action_execution_failure_class` has, a third would be a
 * migration, and of the two this is the one whose documented meaning is exactly "one exists but
 * deployment has not armed it". A missing sender is an un-armed deployment, not a missing channel.
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
  /* The only way the channel itself is unreachable now: no adapter is registered for it. */
  if (!descriptor) return "adapter-unavailable";
  /* ALL THREE are required. Any one missing must fail here, before any network primitive exists. */
  if (!isExternalSendCredentialPresent(env)) return "credential-unavailable";
  if (!resolveExternalSendSender(env)) return "credential-unavailable";
  if (!resolveExternalSendSubject(env)) return "credential-unavailable";
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
  try {
    return createResendEmailTransport({
      apiKey: env[EXTERNAL_SEND_API_KEY_ENV]!.trim(),
      sender: resolveExternalSendSender(env)!,
      subject: resolveExternalSendSubject(env)!,
      fetchImpl: deps.fetchImpl,
    });
  } catch {
    /* Construction re-validates all three. A throw means unavailable, not armed. */
    return null;
  }
}
