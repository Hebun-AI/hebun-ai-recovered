/*
 * governance-audit/research-report-audit.server.ts — RA-PREP-1's audit sibling: the provenance of a
 * filed research report.
 *
 * WHY A ROW. The report's revision names its agent and its source message; neither names the mandate
 * REVISION the agent prepared under, and reconstructing it later from two application clocks
 * (`agent_mandates.effective_from`, `work_artifact_revisions.created_at`) is a guess, not a record. So
 * the mandate revision that authorized the dispatch — and that the filing transaction read again as
 * still in force — is written here, in THAT transaction: no report without its row, no row without
 * its report.
 *
 * It decides nothing: the capability ceiling and the mandate comparison are the research seam's, made
 * before this is called. It appends to the SHARED sink and creates no table. No prompt, question,
 * report text or provider content exists in the shape, so none can be written.
 */
import type { ControlPlaneDatabase } from "@/db/client.server";
import { auditLog } from "@/db/schema/audit-log";
import type { AgentWorkCapability, AgentWorkCapabilityId } from "@/features/agent-work/capabilities";

export const RESEARCH_REPORT_FILED = "work-artifact.research-report.filed";
export const RESEARCH_REPORT_ENTITY_TYPE = "work-artifact";
export const RESEARCH_REPORT_AUDIT_SOURCE = "research-preparation";

export interface ResearchReportFiledEvidence {
  readonly tenantId: string;
  /** The person whose request caused the preparation. */
  readonly actorUserId: string;
  readonly artifactId: string;
  readonly revisionNo: number;
  readonly agentId: string;
  /** The immutable id and the number of the mandate revision the dispatch and the filing both rested on. */
  readonly mandateId: string;
  readonly mandateRevision: number;
  readonly capability: AgentWorkCapabilityId;
  readonly purpose: AgentWorkCapability["dataUse"]["purpose"];
  readonly sourceMessageId: string;
  /** The model invocation's correlation id: joins the disclosure decision and the message row. */
  readonly correlationId: string | null;
  readonly occurredAt: Date;
}

/** Appends one row on the transaction it is given. Throws on failure, so the report is not filed without it. */
export async function recordResearchReportFiled(db: ControlPlaneDatabase, evidence: ResearchReportFiledEvidence): Promise<void> {
  if (typeof window !== "undefined") throw new Error("Research report audit is server-only.");
  await db.insert(auditLog).values({
    tenantId: evidence.tenantId,
    actorType: "human",
    actorId: evidence.actorUserId,
    action: RESEARCH_REPORT_FILED,
    entityType: RESEARCH_REPORT_ENTITY_TYPE,
    entityId: evidence.artifactId,
    correlationId: evidence.correlationId,
    occurredAt: evidence.occurredAt,
    metadata: {
      revisionNo: evidence.revisionNo,
      agentId: evidence.agentId,
      mandateId: evidence.mandateId,
      mandateRevision: evidence.mandateRevision,
      capability: evidence.capability,
      purpose: evidence.purpose,
      sourceMessageId: evidence.sourceMessageId,
      sourcing: "unsourced",
    },
    result: "committed",
    simulation: false,
    source: RESEARCH_REPORT_AUDIT_SOURCE,
    authoritySource: "membership",
  });
}
