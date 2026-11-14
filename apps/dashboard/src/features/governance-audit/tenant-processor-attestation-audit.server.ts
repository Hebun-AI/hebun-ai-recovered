/*
 * governance-audit/tenant-processor-attestation-audit.server.ts — P5 BYOK B6. One audit row per
 * tenant-attested processor attestation revision, written inside the writer's transaction so the
 * attestation and its record commit together. Carries the treatment and revision only — never a key,
 * never a statement's free text.
 */
import { auditLog } from "@/db/schema/audit-log";
import type { AuditActor, AuditWriter } from "./knowledge-mutation-audit.server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const TENANT_PROCESSOR_ATTESTATION_ENTITY_TYPE = "processor_attestation" as const;
export const TENANT_PROCESSOR_ATTESTATION_ACTION = "external-ai.tenant-attestation.recorded" as const;

export async function recordTenantProcessorAttestationWithin(
  writer: AuditWriter,
  actor: AuditActor,
  event: {
    readonly attestationId: string;
    readonly next: {
      readonly accountRef: string;
      readonly attestationRevision: number;
      readonly state: "active" | "withdrawn";
      readonly training: string;
      readonly retentionClass: string;
      readonly zdr: string;
      readonly modelIds: readonly string[];
    };
  },
  now: Date,
): Promise<void> {
  await writer.insert(auditLog).values({
    tenantId: actor.tenantId,
    actorType: "human",
    actorId: actor.userId,
    action: TENANT_PROCESSOR_ATTESTATION_ACTION,
    entityType: TENANT_PROCESSOR_ATTESTATION_ENTITY_TYPE,
    entityId: event.attestationId,
    occurredAt: now,
    nextState: { ...event.next, modelIds: [...event.next.modelIds] },
    metadata: {},
    result: "committed",
    simulation: false,
    source: "external-ai-data-use",
    requestId: actor.requestId,
    sessionContextId: actor.sessionContextId && UUID_RE.test(actor.sessionContextId) ? actor.sessionContextId : undefined,
    authoritySource: "membership",
  });
}
