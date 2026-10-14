/*
 * governance-audit/external-ai-disclosure-read.server.ts — WHAT THE EAI GATE DECIDED FOR A REQUEST,
 * read back from the record it wrote (HEBY-GROUNDED-CONVERSATION-1, model-facing legibility).
 *
 * The sibling of `external-ai-disclosure-audit.server.ts`, and the only reader of its rows. APF-5
 * records one row per disclosure decision, keyed by the request's `correlationId` — the same value
 * the generator sends and the conversation stores on the assistant message. So "which classes did
 * the model receive for this answer" is not recomputed anywhere: it is the decision, as recorded.
 *
 * It returns the closed shape only — disposition, declared and authorized class NAMES. No
 * authorization, attestation or actor id, no account, no model id: the reader needs none of them
 * and a surface must not learn them. Classes are passed through as recorded strings; this module
 * does not import the EAI authority (its importer set is pinned) and decides nothing.
 *
 *     NO RECORD  !=  READ FAILED
 *
 * A correlation with no row (a fake transport, an answer older than APF-5) or more than one row is
 * reported as absent; the caller says "unavailable", never a guess. READ ONLY. Server-only.
 */
import { and, eq, inArray } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { auditLog } from "@/db/schema/audit-log";
import {
  EXTERNAL_AI_DISCLOSURE_AUTHORIZED,
  EXTERNAL_AI_DISCLOSURE_ENTITY_TYPE,
  EXTERNAL_AI_DISCLOSURE_REFUSED,
} from "./external-ai-disclosure-audit.server";

export interface RecordedDisclosureDecision {
  readonly disposition: "authorized" | "refused";
  readonly declaredDataClasses: readonly string[];
  readonly authorizedDataClasses: readonly string[];
}

export type ExternalAiDisclosureDecisionsRead =
  | { readonly status: "read"; readonly byCorrelation: ReadonlyMap<string, RecordedDisclosureDecision> }
  | { readonly status: "unavailable" };

export interface ExternalAiDisclosureReadDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
}

function resolveDbOrNull(): ControlPlaneDatabase | null {
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

function classes(value: unknown): readonly string[] | null {
  return Array.isArray(value) && value.every((v) => typeof v === "string") ? value : null;
}

export async function readExternalAiDisclosureDecisions(
  tenantId: string,
  correlationIds: readonly string[],
  deps: ExternalAiDisclosureReadDeps = {},
): Promise<ExternalAiDisclosureDecisionsRead> {
  if (typeof window !== "undefined") throw new Error("External AI disclosure reads are server-only.");
  if (!tenantId) return { status: "unavailable" };
  const ids = [...new Set(correlationIds.filter((id) => typeof id === "string" && id.length > 0))];
  if (ids.length === 0) return { status: "read", byCorrelation: new Map() };
  const db = (deps.getDb ?? resolveDbOrNull)();
  if (!db) return { status: "unavailable" };

  try {
    const rows = await db
      .select({ correlationId: auditLog.correlationId, action: auditLog.action, metadata: auditLog.metadata })
      .from(auditLog)
      .where(
        and(
          eq(auditLog.tenantId, tenantId),
          eq(auditLog.entityType, EXTERNAL_AI_DISCLOSURE_ENTITY_TYPE),
          inArray(auditLog.correlationId, ids),
        ),
      );

    const seen = new Map<string, number>();
    const decisions = new Map<string, RecordedDisclosureDecision>();
    for (const row of rows) {
      if (!row.correlationId) continue;
      seen.set(row.correlationId, (seen.get(row.correlationId) ?? 0) + 1);
      const metadata = (row.metadata ?? {}) as Record<string, unknown>;
      const declared = classes(metadata.declaredDataClasses);
      const authorized = classes(metadata.authorizedDataClasses);
      const disposition =
        row.action === EXTERNAL_AI_DISCLOSURE_AUTHORIZED ? "authorized" : row.action === EXTERNAL_AI_DISCLOSURE_REFUSED ? "refused" : null;
      if (!declared || !authorized || !disposition) continue;
      decisions.set(row.correlationId, { disposition, declaredDataClasses: declared, authorizedDataClasses: authorized });
    }
    // One decision per request. Two rows for one correlation is not a record anyone can trust.
    for (const [id, count] of seen) if (count !== 1) decisions.delete(id);
    return { status: "read", byCorrelation: decisions };
  } catch {
    return { status: "unavailable" };
  }
}
