/*
 * attest-tenant-anthropic-account.server.ts — P5 BYOK B6. THE ONLY WRITER of tenant-owned processor
 * attestations.
 *
 * A named human holding this tenant's Governance authority records the terms of the tenant's OWN
 * Anthropic account — the one its BYOK connection holds a key for. The row lives in
 * `processor_attestations` beside the platform's, under the account ref
 * `tenant-byok:<connection id>`, owned by this tenant (CHECK `processor_attestations_tenant_owner_chk`).
 *
 * It authorizes nothing. Calls under the tenant key still need the tenant's purpose authorization,
 * written by the released Governance writer (`authorizeTenantExternalAiDataUse`) against THIS
 * attestation, and the platform policy's bounds still apply to its treatment. Identity is `attested`:
 * Hebun has not verified the account's terms, the tenant's human states them.
 *
 * The tenant and the human come from the session; the connection must be this tenant's live
 * Anthropic connection. Revisions, never edits: a changed statement is a new revision.
 *
 * Server-only.
 */
import { and, desc, eq } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { processorAttestations } from "@/db/schema/external-ai-data-use";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { recordTenantProcessorAttestationWithin } from "@/features/governance-audit/tenant-processor-attestation-audit.server";
import { resolveGovernanceAuthority } from "@/features/governance-decision/authority-read.server";
import { listConnections } from "@/features/integration-authority/integration-repository.server";
import { isTerminalConnectionState } from "@/features/integration-authority/contracts";
import { ANTHROPIC_PROVIDER_KEY } from "@/features/provider-anthropic/contracts";
import { tenantAnthropicAccountRef } from "@/features/provider-anthropic/model-credential.server";
import {
  RETENTION_CLASSES,
  TRAINING_TREATMENTS,
  ZDR_STATES,
  type RetentionClass,
  type TrainingTreatment,
  type ZdrState,
} from "./contracts";

export interface TenantAnthropicAttestationInput {
  readonly training: TrainingTreatment;
  readonly retentionClass: RetentionClass;
  readonly zdr: ZdrState;
  /** The model ids this account's terms were stated for. At least one. */
  readonly modelIds: readonly string[];
}

export type TenantAnthropicAttestationResult =
  | { readonly status: "attested"; readonly attestationId: string; readonly accountRef: string; readonly attestationRevision: number }
  | {
      readonly status: "refused";
      readonly reason:
        | "unauthenticated"
        | "invalid-input"
        | "no-byok-connection"
        | "not-the-governance-authority"
        | "persistence-unavailable";
    };

export interface TenantAnthropicAttestationDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
}

const MODEL_ID_RE = /^[a-z0-9][a-z0-9.\-]{0,99}$/;
const within = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === "string" && (list as readonly string[]).includes(v);

export async function attestTenantAnthropicAccount(
  tenant: TenantContext | null,
  input: TenantAnthropicAttestationInput,
  deps: TenantAnthropicAttestationDeps = {},
): Promise<TenantAnthropicAttestationResult> {
  if (typeof window !== "undefined") throw new Error("Tenant processor attestation is server-only.");
  const refuse = (reason: Extract<TenantAnthropicAttestationResult, { status: "refused" }>["reason"]) =>
    ({ status: "refused", reason }) as const;
  if (!tenant?.tenantId || !tenant.userId) return refuse("unauthenticated");
  const modelIds = Array.isArray(input?.modelIds) ? [...new Set(input.modelIds)] : [];
  if (
    !within(TRAINING_TREATMENTS, input?.training) ||
    !within(RETENTION_CLASSES, input?.retentionClass) ||
    !within(ZDR_STATES, input?.zdr) ||
    modelIds.length === 0 ||
    modelIds.length > 20 ||
    !modelIds.every((m) => typeof m === "string" && MODEL_ID_RE.test(m))
  ) {
    return refuse("invalid-input");
  }

  let db: ControlPlaneDatabase | null;
  try {
    db = (deps.getDb ?? getControlPlaneDb)();
  } catch {
    db = null;
  }
  if (!db) return refuse("persistence-unavailable");

  try {
    const authority = await resolveGovernanceAuthority(tenant, { getDb: () => db });
    if (!authority.authorized) return refuse("not-the-governance-authority");

    const listing = await listConnections(tenant, { getDb: () => db });
    if (listing.status !== "read") return refuse("persistence-unavailable");
    const connection = listing.connections.find(
      (c) => c.providerKey === ANTHROPIC_PROVIDER_KEY && !isTerminalConnectionState(c.connectionState),
    );
    if (!connection) return refuse("no-byok-connection");
    const accountRef = tenantAnthropicAccountRef(connection.integrationId);
    const now = (deps.now ?? (() => new Date()))();

    return await db.transaction(async (rawTx) => {
      const tx = rawTx as unknown as ControlPlaneDatabase;
      const [previous] = await tx
        .select({ id: processorAttestations.id, revision: processorAttestations.attestationRevision })
        .from(processorAttestations)
        .where(and(eq(processorAttestations.serviceScope, "anthropic/messages"), eq(processorAttestations.accountRef, accountRef)))
        .orderBy(desc(processorAttestations.attestationRevision))
        .limit(1);
      const attestationRevision = (previous?.revision ?? 0) + 1;
      const [row] = await tx
        .insert(processorAttestations)
        .values({
          serviceScope: "anthropic/messages",
          accountRef,
          attestationRevision,
          state: "active",
          identityStatus: "attested",
          contractSurface: "anthropic-commercial-terms",
          training: input.training,
          retentionClass: input.retentionClass,
          zdr: input.zdr,
          modelTreatmentClass: "tenant-attested",
          modelIds,
          evidenceRefs: [`tenant-human:${tenant.userId}`],
          reviewedRecordRef: `integration:${connection.integrationId}`,
          attestedAt: now,
          controlSource: "tenant-attestation",
          supersedesAttestationId: previous?.id ?? null,
          ownerTenantId: tenant.tenantId,
          attestedByUserId: tenant.userId,
          createdAt: now,
          createdBy: tenant.userId,
          createdByType: "human",
        })
        .returning({ id: processorAttestations.id });
      if (!row?.id) throw new Error("attestation-not-written");
      await recordTenantProcessorAttestationWithin(
        tx,
        { tenantId: tenant.tenantId, userId: tenant.userId, requestId: tenant.requestId, sessionContextId: tenant.sessionContextId },
        {
          attestationId: row.id,
          next: { accountRef, attestationRevision, state: "active", training: input.training, retentionClass: input.retentionClass, zdr: input.zdr, modelIds },
        },
        now,
      );
      return { status: "attested", attestationId: row.id, accountRef, attestationRevision } as const;
    });
  } catch {
    return refuse("persistence-unavailable");
  }
}
