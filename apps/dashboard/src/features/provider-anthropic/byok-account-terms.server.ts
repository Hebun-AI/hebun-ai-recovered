/*
 * P5 BYOK — the two tenant acts the `/integrations/anthropic` page offers beyond the key itself.
 * No new authority: each act composes released writers.
 *
 *   recordByokDataUse  — a Governance holder states the terms of the organization's own Anthropic
 *                        account (`attestTenantAnthropicAccount`, audited) and authorizes assistance
 *                        under it (`authorizeTenantExternalAiDataUse`, a Governance decision).
 *   stopUsingOwnKey    — revokes the live key and disconnects the connection (released
 *                        `revokeByokKey` + `disconnectConnection`, both audited). Refused unless the
 *                        organization already holds an active assistance authorization for Hebun's
 *                        platform account, so leaving BYOK never lands on a key the organization has
 *                        not agreed to.
 */
import type { ControlPlaneDatabase } from "@/db/client.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { disconnectConnection, listConnections } from "@/features/integration-authority/integration-repository.server";
import { isTerminalConnectionState } from "@/features/integration-authority/contracts";
import { attestTenantAnthropicAccount } from "@/features/external-ai-data-use/attest-tenant-anthropic-account.server";
import { authorizeTenantExternalAiDataUse } from "@/features/external-ai-data-use/authorize-tenant-external-ai-data-use.server";
import { ANTHROPIC_MESSAGES_SCOPE } from "@/features/external-ai-data-use/authorize-external-ai-disclosure.server";
import { assistanceScopePairs, readAssistanceDataUse } from "@/features/external-ai-data-use/assistance-data-use.server";
import { readLatestProcessorAttestation } from "@/features/external-ai-data-use/read-processor-attestations.server";
import { readEffectiveTenantExternalAiDataUse } from "@/features/external-ai-data-use/read-tenant-external-ai-data-use.server";
import {
  RETENTION_CLASSES,
  TRAINING_TREATMENTS,
  ZDR_STATES,
  type RetentionClass,
  type TrainingTreatment,
  type ZdrState,
} from "@/features/external-ai-data-use/contracts";
import { MODEL_CONNECTIVITY_ENV_KEYS } from "@/features/heby-model/model-connectivity-environment.server";
import { validateJustification } from "@/features/governance-decision/persistence.server";
import { revokeByokKey } from "./byok-key.server";
import { tenantAnthropicAccountRef } from "./model-credential.server";
import { ANTHROPIC_PROVIDER_KEY } from "./contracts";

export interface ByokDataUseDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly env?: Readonly<Record<string, string | undefined>>;
}

export type ByokDataUseView =
  | { readonly status: "unavailable" }
  | { readonly status: "no-connection"; readonly platformAuthorized: boolean }
  | {
      readonly status: "read";
      readonly viewerIsGovernanceAuthority: boolean;
      readonly platformAuthorized: boolean;
      /** The terms last stated for the organization's own account, or null. */
      readonly attestation: { readonly training: string; readonly retentionClass: string; readonly zdr: string; readonly revision: number } | null;
      /** Whether assistance is authorized under the organization's own account. */
      readonly authorized: boolean;
    };

export type ByokDataUseOutcome =
  | "data-use-recorded"
  | "data-use-invalid"
  | "not-the-governance-authority"
  | "no-byok-connection"
  | "data-use-unchanged"
  | "stopped"
  | "platform-not-authorized"
  | "unavailable";

const within = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === "string" && (list as readonly string[]).includes(v);

async function liveConnectionId(tenant: TenantContext, deps: ByokDataUseDeps): Promise<string | null | "unavailable"> {
  const listing = await listConnections(tenant, { getDb: deps.getDb });
  if (listing.status !== "read") return "unavailable";
  return (
    listing.connections.find((c) => c.providerKey === ANTHROPIC_PROVIDER_KEY && !isTerminalConnectionState(c.connectionState))
      ?.integrationId ?? null
  );
}

export async function readByokDataUse(tenant: TenantContext | null, deps: ByokDataUseDeps = {}): Promise<ByokDataUseView> {
  if (!tenant?.tenantId) return { status: "unavailable" };
  try {
    const platform = await readAssistanceDataUse(tenant, { getDb: deps.getDb });
    if (platform.status !== "read") return { status: "unavailable" };
    const integrationId = await liveConnectionId(tenant, deps);
    if (integrationId === "unavailable") return { status: "unavailable" };
    if (!integrationId) return { status: "no-connection", platformAuthorized: platform.assistanceAuthorized };
    const ref = tenantAnthropicAccountRef(integrationId);
    const [latest, effective] = await Promise.all([
      readLatestProcessorAttestation(ANTHROPIC_MESSAGES_SCOPE, ref, { getDb: deps.getDb }),
      readEffectiveTenantExternalAiDataUse(tenant.tenantId, ANTHROPIC_MESSAGES_SCOPE, ref, { getDb: deps.getDb }),
    ]);
    if (latest.status === "unavailable" || effective.status === "unavailable") return { status: "unavailable" };
    const a = latest.status === "read" && latest.latest.state === "active" ? latest.latest : null;
    return {
      status: "read",
      viewerIsGovernanceAuthority: platform.viewerIsGovernanceAuthority,
      platformAuthorized: platform.assistanceAuthorized,
      attestation: a ? { training: a.training, retentionClass: a.retentionClass, zdr: a.zdr, revision: a.attestationRevision } : null,
      authorized:
        effective.status === "read" &&
        effective.effective.state === "active" &&
        effective.effective.boundAttestation?.id === a?.id &&
        effective.effective.scopes.some((p) => p.purpose === "assistance"),
    };
  } catch {
    return { status: "unavailable" };
  }
}

export async function recordByokDataUse(
  tenant: TenantContext | null,
  input: { readonly training: unknown; readonly retentionClass: unknown; readonly zdr: unknown; readonly justification: unknown },
  deps: ByokDataUseDeps = {},
): Promise<ByokDataUseOutcome> {
  if (!tenant?.tenantId) return "unavailable";
  if (!within(TRAINING_TREATMENTS, input.training) || !within(RETENTION_CLASSES, input.retentionClass) || !within(ZDR_STATES, input.zdr)) {
    return "data-use-invalid";
  }
  /* Checked before anything is written, so a refused decision leaves no stated terms behind. */
  if (!validateJustification(typeof input.justification === "string" ? input.justification : "")) return "data-use-invalid";
  /* The model the deployment sends is the model the account terms are stated for. */
  const modelId = (deps.env ?? process.env)[MODEL_CONNECTIVITY_ENV_KEYS.modelId]?.trim();
  if (!modelId) return "unavailable";
  const attested = await attestTenantAnthropicAccount(
    tenant,
    { training: input.training as TrainingTreatment, retentionClass: input.retentionClass as RetentionClass, zdr: input.zdr as ZdrState, modelIds: [modelId] },
    { getDb: deps.getDb },
  );
  if (attested.status !== "attested") {
    if (attested.reason === "not-the-governance-authority") return "not-the-governance-authority";
    if (attested.reason === "no-byok-connection") return "no-byok-connection";
    if (attested.reason === "invalid-input") return "data-use-invalid";
    return "unavailable";
  }
  const current = await readEffectiveTenantExternalAiDataUse(tenant.tenantId, ANTHROPIC_MESSAGES_SCOPE, attested.accountRef, { getDb: deps.getDb });
  if (current.status === "unavailable") return "unavailable";
  const written = await authorizeTenantExternalAiDataUse(
    tenant,
    {
      attestationId: attested.attestationId,
      scopes: assistanceScopePairs(),
      justification: typeof input.justification === "string" ? input.justification : "",
      observedRevision: current.status === "read" ? (current.effective.authorizationRevision ?? null) : null,
    },
    { getDb: deps.getDb },
  );
  if (written.status === "written") return "data-use-recorded";
  if (written.reason === "unchanged") return "data-use-unchanged";
  if (written.reason === "justification-required" || written.reason === "platform-not-allowed") return "data-use-invalid";
  if (written.reason === "not-the-governance-authority" || written.reason === "no-governance-authority") return "not-the-governance-authority";
  return "unavailable";
}

export async function stopUsingOwnKey(tenant: TenantContext | null, deps: ByokDataUseDeps = {}): Promise<ByokDataUseOutcome> {
  if (!tenant?.tenantId) return "unavailable";
  try {
    const platform = await readAssistanceDataUse(tenant, { getDb: deps.getDb });
    if (platform.status !== "read") return "unavailable";
    if (!platform.assistanceAuthorized) return "platform-not-authorized";
    const integrationId = await liveConnectionId(tenant, deps);
    if (integrationId === "unavailable") return "unavailable";
    if (!integrationId) return "no-byok-connection";
    const revoked = await revokeByokKey(tenant, { getDb: deps.getDb });
    if (revoked !== "revoked" && revoked !== "no-key") return "unavailable";
    const disconnected = await disconnectConnection(tenant, integrationId, { getDb: deps.getDb });
    return disconnected.status === "transitioned" ? "stopped" : "unavailable";
  } catch {
    return "unavailable";
  }
}
