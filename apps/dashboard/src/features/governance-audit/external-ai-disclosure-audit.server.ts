/*
 * governance-audit/external-ai-disclosure-audit.server.ts — the append-only EVIDENCE of an external
 * AI disclosure decision (APF-5).
 *
 * It records a decision the External AI Data-Use authority already made, exactly as handed over. It
 * decides nothing, widens nothing and infers nothing: no purpose, class, model or disposition is
 * computed here, and nothing reads this row to authorize anything. A firewall test asserts that this
 * file imports no part of the deciding authority.
 *
 * `…authorized` means the decision allowed the call. It never means the call was sent or accepted —
 * those facts belong to the message / invocation rows, joined by `correlation_id`.
 *
 * No prompt, goal, evidence text, provider content or credential exists in the evidence shape, so
 * none can be written.
 */
import { randomUUID } from "node:crypto";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { auditLog } from "@/db/schema/audit-log";
import type { ExternalAiDisclosureEvidence } from "@/features/external-ai-data-use/authorize-external-ai-disclosure.server";

export const EXTERNAL_AI_DISCLOSURE_AUTHORIZED = "external-ai.disclosure.authorized";
export const EXTERNAL_AI_DISCLOSURE_REFUSED = "external-ai.disclosure.refused";
export const EXTERNAL_AI_DISCLOSURE_ENTITY_TYPE = "external-ai-disclosure-decision";
export const EXTERNAL_AI_DISCLOSURE_AUDIT_SOURCE = "external-ai-data-use";

export type RecordExternalAiDisclosureDecision = (evidence: ExternalAiDisclosureEvidence) => Promise<boolean>;

function resolveDbOrNull(): ControlPlaneDatabase | null {
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

/** One row per decision. Returns whether it is durable; never throws. */
export async function recordExternalAiDisclosureDecision(
  evidence: ExternalAiDisclosureEvidence,
  deps: { readonly getDb?: () => ControlPlaneDatabase | null; readonly now?: () => Date } = {},
): Promise<boolean> {
  if (typeof window !== "undefined") throw new Error("External AI disclosure audit is server-only.");
  const db = (deps.getDb ?? resolveDbOrNull)();
  if (!db) return false;
  const authorized = evidence.disposition === "authorized";
  try {
    await db.insert(auditLog).values({
      tenantId: evidence.tenantId,
      actorType: "human",
      actorId: evidence.actorUserId,
      action: authorized ? EXTERNAL_AI_DISCLOSURE_AUTHORIZED : EXTERNAL_AI_DISCLOSURE_REFUSED,
      entityType: EXTERNAL_AI_DISCLOSURE_ENTITY_TYPE,
      entityId: randomUUID(),
      correlationId: evidence.correlationId,
      occurredAt: (deps.now ?? (() => new Date()))(),
      metadata: {
        serviceScope: evidence.serviceScope,
        accountRef: evidence.accountRef,
        purpose: evidence.purpose,
        declaredDataClasses: evidence.declaredDataClasses,
        authorizedDataClasses: evidence.authorizedDataClasses,
        modelId: evidence.modelId,
        disposition: evidence.disposition,
        processorAttestationId: evidence.processorAttestationId,
        processorAttestationRevision: evidence.processorAttestationRevision,
        tenantAuthorizationId: evidence.tenantAuthorizationId,
        tenantAuthorizationRevision: evidence.tenantAuthorizationRevision,
        components: evidence.components,
      },
      result: authorized ? "committed" : "rejected",
      simulation: false,
      source: EXTERNAL_AI_DISCLOSURE_AUDIT_SOURCE,
      authoritySource: "membership",
    });
    return true;
  } catch {
    return false;
  }
}
