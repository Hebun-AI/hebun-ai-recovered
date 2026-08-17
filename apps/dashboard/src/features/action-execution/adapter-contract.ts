/*
 * action-execution/adapter-contract.ts — the narrow boundary between Hebun and the outside (R3B).
 *
 * ── WHAT AN ADAPTER RECEIVES, EXHAUSTIVELY ───────────────────────────────────
 *
 *   endpointKind · endpoint · content · idempotencyKey
 *
 * Four values. It does NOT receive the Governance decision, the permit row, the action request,
 * the tenant, the session, the actor, the database handle, Knowledge, model output, or anything
 * else. This is not politeness — it is the sandbox. An adapter that cannot see authority cannot
 * widen it, and an adapter that cannot see the tenant cannot cross tenants.
 *
 * ── WHY THE ADAPTER RETURNS AN OUTCOME AND DOES NOT THROW ────────────────────
 *
 * A thrown error is ambiguous about the one thing that matters: whether the request reached the
 * provider. Making every provider condition a RETURN VALUE forces each implementation to classify
 * its own transport phase, where it alone has the evidence. The runtime never has to guess, and
 * "the adapter crashed" stays distinguishable from "the provider said no".
 *
 * ── THE PHASE DISTINCTION, WHICH IS THE WHOLE POINT ──────────────────────────
 *
 *   unreachable  PROVABLY pre-write. The request body never left. No external effect is possible.
 *   ambiguous    post-write and unresolved. The provider MAY have accepted it.
 *
 * The existing live Claude transport maps every non-abort throw to one `provider-unavailable`
 * error. That is correct for a model read and dangerous for a send, because it reports a possible
 * external effect as a clean failure. Implementations here MUST bias toward `ambiguous`: claim
 * `unreachable` only with positive evidence that the connection never established.
 *
 * Pure types. No I/O, no network, no database, no authority.
 */

/** The only endpoint kind with a channel behind it. Mirrors `external_recipient_endpoint_kind`. */
export type ExternalEndpointKind = "email";

/**
 * Everything an adapter is told. Nothing here identifies a tenant, an actor or an authority.
 *
 * `content` is the exact approved revision bytes — never model output, never text assembled at
 * execution time. `idempotencyKey` is the permit's `handoff_id`; see `contracts.ts`.
 */
export interface SendExternalMessageInput {
  readonly endpointKind: ExternalEndpointKind;
  readonly endpoint: string;
  readonly content: string;
  readonly idempotencyKey: string;
}

/**
 * What the outside world said. Exactly four shapes, mirroring
 * `action_execution_provider_response_class`.
 *
 * `accepted` REQUIRES a provider message id. A success status with no id is not acceptance — it is
 * something that cannot be reconciled later, which is `ambiguous`. A database CHECK enforces the
 * same rule, so neither layer can relax it alone.
 */
export type ProviderOutcome =
  | { readonly class: "accepted"; readonly providerMessageId: string }
  | { readonly class: "rejected" }
  | { readonly class: "unreachable" }
  | { readonly class: "ambiguous" };

/**
 * One outbound operation. That is the entire interface, and the entire capability.
 *
 * NOT on this interface, deliberately: no `get`, no `list`, no `cancel`, no `verify`, no
 * `getStatus`, no `configure`. Each would be a second capability with its own blast radius, and
 * none has a consumer in this generation.
 */
export interface ExternalSendAdapter {
  readonly adapterId: string;
  readonly endpointKind: ExternalEndpointKind;
  send(input: SendExternalMessageInput): Promise<ProviderOutcome>;
}

/**
 * A registry entry describing an adapter WITHOUT constructing it.
 *
 * Separated so availability can be answered before any credential is read and before any client
 * object exists. Resolving availability must never be the thing that touches a secret.
 */
export interface ExternalSendAdapterDescriptor {
  readonly adapterId: string;
  readonly endpointKind: ExternalEndpointKind;
  /**
   * The provider host, as a FROZEN CONSTANT rather than an env key.
   *
   * It was configuration while no vendor was selected. Now that one is, a settable URL would be an
   * arbitrary-URL capability the sandbox boundary says does not exist, so the descriptor states
   * the host instead of naming a variable that could redirect it.
   */
  readonly providerEndpoint: string;
  /** Env vars whose PRESENCE (never value) decides whether this adapter can be constructed. */
  readonly credentialEnvKey: string;
  /** The system-owned sender. Generation one has one, for every tenant — see the R5 debt note. */
  readonly senderEnvKey: string;
  /** The fixed subject. Deployment configuration is the ONLY thing allowed to choose it. */
  readonly subjectEnvKey: string;
  /** Human-readable, rendered on the Director surface. States what it does and does not prove. */
  readonly describes: string;
}

/**
 * THE SANDBOX BOUNDARY, as a value a test can pin.
 *
 * "Sandboxed adapter" appears throughout the roadmap and needed a definition. For this action it
 * is NOT an OS sandbox — there is no process to isolate. It is the shape of what the seam can
 * express, and everything below is enforced by the types and the registry rather than by policy.
 */
export const ADAPTER_SANDBOX_BOUNDARY: readonly string[] = Object.freeze([
  "exactly one action kind may execute",
  "exactly one endpoint kind exists",
  "exactly one adapter is registered",
  "exactly one outbound operation is expressible",
  "the provider host is a frozen constant, not configuration, not a record, not a model",
  "the sender and the subject come from deployment configuration, never from a record or a model",
  "no arbitrary URL, no arbitrary code, no dynamic adapter loading",
  "no shell, no filesystem, no browser, no device, no agent",
  "the adapter receives no tenant, no session, no authority and no database handle",
  "the content is a referenced approved revision, never generated text",
  "one hard timeout, and zero automatic retries",
]);
