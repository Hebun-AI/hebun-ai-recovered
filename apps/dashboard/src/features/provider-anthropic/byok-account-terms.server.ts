/*
 * P5 BYOK — the two tenant acts the `/integrations/anthropic` page offers beyond the key itself.
 * No new authority: each act composes released writers.
 *
 *   recordByokDataUse  — a Governance holder states the terms of the organization's own Anthropic
 *                        account (`attestTenantAnthropicAccount`, audited) and authorizes assistance
 *                        under it (`authorizeTenantExternalAiDataUse`, a Governance decision).
 *   recordOwnAccountResearch / withdrawOwnAccountResearch — P6 production acceptance (Director,
 *                        2026-11-16): a Governance holder authorizes, or withdraws, research under
 *                        the organization's own account (`authorizeTenantExternalAiDataUse`). The
 *                        research pairs are read off the recorded platform policy; web search is a
 *                        separate choice. Assistance must already be authorized, and stays.
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
import { RECORDED_PLATFORM_DISCLOSURE_POLICY } from "@/features/external-ai-data-use/platform-disclosure-policy";
import { nextRevisionScopes, revisionScopesWithout } from "@/features/external-ai-data-use/revision-scopes";
import { readLatestProcessorAttestation } from "@/features/external-ai-data-use/read-processor-attestations.server";
import { readEffectiveTenantExternalAiDataUse } from "@/features/external-ai-data-use/read-tenant-external-ai-data-use.server";
import {
  RETENTION_CLASSES,
  TRAINING_TREATMENTS,
  ZDR_STATES,
  type RetentionClass,
  type ScopePair,
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
      /** Research under the organization's own account: not authorized, the question only, or with web search. */
      readonly research: "none" | "unsourced" | "web-search";
    };

export type ByokDataUseOutcome =
  | "data-use-recorded"
  | "data-use-invalid"
  | "not-the-governance-authority"
  | "no-byok-connection"
  | "data-use-unchanged"
  | "stopped"
  | "platform-not-authorized"
  | "research-authorized"
  | "research-withdrawn"
  | "research-not-authorized"
  | "assistance-not-authorized"
  | "unavailable";

const RESEARCH = "research" as const;
const WEB_SEARCH = "web-search" as const;

/** The (research, class) pairs the platform offers — read off the recorded policy, never typed. */
function researchScopePairs(webSearch: boolean): ScopePair[] {
  return RECORDED_PLATFORM_DISCLOSURE_POLICY.allowedCells
    .filter((c) => c.serviceScope === ANTHROPIC_MESSAGES_SCOPE && c.purpose === RESEARCH && (webSearch || c.dataClass !== WEB_SEARCH))
    .map((c) => ({ purpose: c.purpose, dataClass: c.dataClass }));
}

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
    const inForce = a && effective.status === "read" && effective.effective.state === "active" && effective.effective.boundAttestation?.id === a.id ? effective.effective.scopes : [];
    const research = inForce.some((p) => p.purpose === RESEARCH && p.dataClass === WEB_SEARCH)
      ? "web-search"
      : inForce.some((p) => p.purpose === RESEARCH)
        ? "unsourced"
        : "none";
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
      research,
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
  /* Restating the terms keeps a research decision in force; it does not silently withdraw it. */
  const researchInForce =
    current.status === "read" && current.effective.state === "active" ? current.effective.scopes.filter((p) => p.purpose === RESEARCH) : [];
  const written = await authorizeTenantExternalAiDataUse(
    tenant,
    {
      attestationId: attested.attestationId,
      scopes: nextRevisionScopes(assistanceScopePairs(), researchInForce),
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

/** Where the own account stands, read once for both research acts. */
async function ownAccountInForce(tenant: TenantContext, deps: ByokDataUseDeps) {
  const integrationId = await liveConnectionId(tenant, deps);
  if (integrationId === "unavailable") return "unavailable" as const;
  if (!integrationId) return "no-byok-connection" as const;
  const ref = tenantAnthropicAccountRef(integrationId);
  const [latest, current] = await Promise.all([
    readLatestProcessorAttestation(ANTHROPIC_MESSAGES_SCOPE, ref, { getDb: deps.getDb }),
    readEffectiveTenantExternalAiDataUse(tenant.tenantId, ANTHROPIC_MESSAGES_SCOPE, ref, { getDb: deps.getDb }),
  ]);
  if (latest.status === "unavailable" || current.status === "unavailable") return "unavailable" as const;
  const attestation = latest.status === "read" && latest.latest.state === "active" ? latest.latest : null;
  const effective = current.status === "read" && current.effective.state === "active" ? current.effective : null;
  /* Research rides on assistance under the SAME terms: no terms, or assistance not in force under them, refuses. */
  if (!attestation || !effective || effective.boundAttestation?.id !== attestation.id || !effective.scopes.some((p) => p.purpose === "assistance")) {
    return "assistance-not-authorized" as const;
  }
  return { attestationId: attestation.id, scopes: effective.scopes, revision: effective.authorizationRevision };
}

function researchOutcome(
  written: Awaited<ReturnType<typeof authorizeTenantExternalAiDataUse>>,
  success: ByokDataUseOutcome,
): ByokDataUseOutcome {
  if (written.status === "written") return success;
  if (written.reason === "unchanged") return "data-use-unchanged";
  if (written.reason === "justification-required" || written.reason === "platform-not-allowed") return "data-use-invalid";
  if (written.reason === "not-the-governance-authority" || written.reason === "no-governance-authority") return "not-the-governance-authority";
  return "unavailable";
}

/**
 * P6 production acceptance — authorize research under the organization's own account: the research
 * question (research × conversation) and, only when chosen, Anthropic web search (research ×
 * web-search). Everything else in force stays; a research choice already in force is replaced.
 */
export async function recordOwnAccountResearch(
  tenant: TenantContext | null,
  input: { readonly webSearch: unknown; readonly justification: unknown },
  deps: ByokDataUseDeps = {},
): Promise<ByokDataUseOutcome> {
  if (!tenant?.tenantId) return "unavailable";
  const justification = typeof input.justification === "string" ? input.justification : "";
  if (!validateJustification(justification)) return "data-use-invalid";
  try {
    const own = await ownAccountInForce(tenant, deps);
    if (typeof own === "string") return own;
    const scopes = nextRevisionScopes(revisionScopesWithout(own.scopes, RESEARCH), researchScopePairs(input.webSearch === true));
    const written = await authorizeTenantExternalAiDataUse(
      tenant,
      { attestationId: own.attestationId, scopes, justification, observedRevision: own.revision },
      { getDb: deps.getDb },
    );
    return researchOutcome(written, "research-authorized");
  } catch {
    return "unavailable";
  }
}

/** P6 production acceptance — withdraw research under the own account; assistance stays. */
export async function withdrawOwnAccountResearch(
  tenant: TenantContext | null,
  input: { readonly justification: unknown },
  deps: ByokDataUseDeps = {},
): Promise<ByokDataUseOutcome> {
  if (!tenant?.tenantId) return "unavailable";
  const justification = typeof input.justification === "string" ? input.justification : "";
  if (!validateJustification(justification)) return "data-use-invalid";
  try {
    const own = await ownAccountInForce(tenant, deps);
    if (typeof own === "string") return own;
    if (!own.scopes.some((p) => p.purpose === RESEARCH)) return "research-not-authorized";
    const written = await authorizeTenantExternalAiDataUse(
      tenant,
      { attestationId: own.attestationId, scopes: revisionScopesWithout(own.scopes, RESEARCH), justification, observedRevision: own.revision },
      { getDb: deps.getDb },
    );
    return researchOutcome(written, "research-withdrawn");
  } catch {
    return "unavailable";
  }
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
