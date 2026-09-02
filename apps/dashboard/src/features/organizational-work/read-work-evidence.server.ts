/*
 * organizational-work/read-work-evidence.server.ts — what work DECLARES it concerns, and what work
 * concerns a referent (WEV-1).
 *
 * ── ONE SEAM, BOTH DIRECTIONS ────────────────────────────────────────────────
 *
 *   WORK → REFERENTS   "what is this work about?"
 *   REFERENT → WORK    "what work concerns this?"
 *
 * Both are the SAME Work-owned relationship read the same way and grouped differently by the
 * caller. A second seam for the inverse would have been a second authority for one relationship,
 * and the two would answer differently the first time either was edited.
 *
 * ── THE RELATIONSHIP IS WORK'S. THE STANDING IS NOT. ─────────────────────────
 *
 * This module reads `work_evidence_references` — the declaration — from the Work Authority's own
 * table, and then asks EACH REFERENT'S OWN RELEASED SEAM what that referent currently is. Nothing
 * about a referent's title, lifecycle, ratification or authority class is stored in Work, so there
 * is no second copy to go stale, and a superseded fact or a retired artifact is reported by the
 * authority that owns that word.
 *
 *     REFERENCE EXISTS != REFERENT IS CURRENT != REFERENT IS AUTHORITATIVE
 *
 * Three reads, never one join: Knowledge answers for facts, Work Artifacts answers for artifacts,
 * and neither is reached through the other. A referent whose authority could not answer is reported
 * as UNRESOLVED — never as absent, and never with an invented label.
 *
 * ── WITHDRAWN DECLARATIONS ARE NOT RETURNED, AND ARE NOT DELETED ─────────────
 *
 * The predicate is `withdrawn_at is null`, because the product question is what work declares NOW.
 * The withdrawn rows stay in the table and in the audit ledger; this seam simply does not answer a
 * question nobody asked. WEV-1 ships no history surface for them.
 *
 * Read-only: no insert, no update, no delete, no transaction. Server-only.
 */
import { and, desc, eq, isNull } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { workEvidenceReferences } from "@/db/schema/work-evidence-reference";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { listKnowledgeSources } from "@/features/knowledge/knowledge-read.server";
import { listWorkArtifacts } from "@/features/work-artifacts/read-work-artifacts.server";
import type { WorkReferenceKind } from "./work-contracts";

/** A bound, for the same reason the register has one: a page is a page, never the whole table. */
export const MAX_WORK_EVIDENCE_REFERENCES = 200;

export interface WorkEvidenceReadDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly listFacts?: typeof listKnowledgeSources;
  readonly listArtifacts?: typeof listWorkArtifacts;
}

/**
 * What the REFERENT'S OWN AUTHORITY says about it, right now.
 *
 * `null` when that authority could not answer or does not know this id. A surface renders that as
 * unresolved; it never renders a guess, and it never falls back to the id as a name.
 */
export interface ResolvedReferent {
  readonly label: string;
  /**
   * The referent's standing, in its OWNING authority's words. Derived on every read from that
   * authority's answer and stored nowhere.
   */
  readonly standing: string;
}

export interface WorkEvidenceReferenceView {
  readonly referenceId: string;
  readonly workItemId: string;
  /** DERIVED from which typed column is populated. There is no stored kind to disagree with it. */
  readonly kind: WorkReferenceKind;
  readonly referentId: string;
  readonly declaredAt: string;
  readonly referent: ResolvedReferent | null;
}

export type WorkEvidenceRead =
  | { readonly status: "available"; readonly references: readonly WorkEvidenceReferenceView[] }
  | { readonly status: "unavailable"; readonly detail: string };

const UNAVAILABLE_DETAIL =
  "Hebun could not read what this organization's work declares it concerns. That is a read " +
  "failure, not an organization whose work concerns nothing.";

function resolveDbOrNull(deps: WorkEvidenceReadDeps): ControlPlaneDatabase | null {
  if (deps.getDb) return deps.getDb();
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

/**
 * KNOWLEDGE'S OWN WORDS, not Work's. `ratified` and `authoritative` are DIFFERENT facts and stay
 * different here: a fact a human ratified through Governance is still `provisional` unless its
 * authority class says otherwise, and this sentence never conflates the two.
 */
function knowledgeStanding(record: {
  readonly authorityClass: string | null;
  readonly lifecycleStatus: string | null;
  readonly ratified: boolean;
}): string {
  const authority =
    record.authorityClass === "authoritative"
      ? "authoritative"
      : record.authorityClass === null
        ? "authority not stated"
        : "provisional (NOT settled truth)";
  return `${authority} · ${record.lifecycleStatus ?? "lifecycle not stated"} · ${
    record.ratified ? "ratified" : "no ratification recorded"
  }`;
}

/** The artifact authority's own words. The CURRENT revision is its answer, not a frozen one. */
function artifactStanding(record: {
  readonly lifecycleStatus: string;
  readonly currentRevision: number;
  readonly artifactType: string;
}): string {
  return `${record.artifactType} · ${record.lifecycleStatus} · current revision ${record.currentRevision}`;
}

/**
 * Read every CURRENT declaration this organization's work has made.
 *
 * Tenant-scoped by this authority's own predicate. There is no work item, referent or tenant
 * parameter, so a caller cannot point this at another organization or at one work item — a
 * cross-organization read is not refused here; it is UNREPRESENTABLE. Callers group the result:
 * by `workItemId` for "what is this work about", by `referentId` for "what work concerns this".
 */
export async function readWorkEvidenceReferences(
  tenant: TenantContext | null,
  deps: WorkEvidenceReadDeps = {},
): Promise<WorkEvidenceRead> {
  if (typeof window !== "undefined") {
    throw new Error("Work evidence reads are server-only.");
  }
  if (!tenant?.tenantId) return { status: "unavailable", detail: UNAVAILABLE_DETAIL };

  const db = resolveDbOrNull(deps);
  if (!db) return { status: "unavailable", detail: UNAVAILABLE_DETAIL };

  try {
    const rows = await db
      .select({
        id: workEvidenceReferences.id,
        workItemId: workEvidenceReferences.workItemId,
        knowledgeFactId: workEvidenceReferences.knowledgeFactId,
        workArtifactId: workEvidenceReferences.workArtifactId,
        declaredAt: workEvidenceReferences.declaredAt,
      })
      .from(workEvidenceReferences)
      .where(
        and(
          eq(workEvidenceReferences.tenantId, tenant.tenantId),
          isNull(workEvidenceReferences.withdrawnAt),
        ),
      )
      .orderBy(desc(workEvidenceReferences.declaredAt))
      .limit(MAX_WORK_EVIDENCE_REFERENCES);

    if (rows.length === 0) return { status: "available", references: [] };

    /*
     * EACH AUTHORITY IS ASKED ONCE, and only when this organization's work actually names one of
     * its records. An authority that cannot answer leaves its referents UNRESOLVED rather than
     * making the whole read fail: a knowledge outage must not hide an artifact a work item names.
     */
    const wantsFacts = rows.some((row) => row.knowledgeFactId !== null);
    const wantsArtifacts = rows.some((row) => row.workArtifactId !== null);

    const facts = new Map<string, ResolvedReferent>();
    if (wantsFacts) {
      const listing = await (deps.listFacts ?? listKnowledgeSources)(tenant);
      if (listing.status === "read") {
        for (const record of listing.records) {
          facts.set(record.factId, {
            label: `${record.factKey} — ${record.title}`,
            standing: knowledgeStanding(record),
          });
        }
      }
    }

    const artifacts = new Map<string, ResolvedReferent>();
    if (wantsArtifacts) {
      const listing = await (deps.listArtifacts ?? listWorkArtifacts)(tenant);
      if (listing.status === "read") {
        for (const record of listing.artifacts) {
          artifacts.set(record.id, {
            label: record.title,
            standing: artifactStanding(record),
          });
        }
      }
    }

    return {
      status: "available",
      references: rows.map((row) => {
        const isFact = row.knowledgeFactId !== null;
        const referentId = (isFact ? row.knowledgeFactId : row.workArtifactId) as string;
        return {
          referenceId: row.id,
          workItemId: row.workItemId,
          kind: (isFact ? "knowledge-fact" : "work-artifact") as WorkReferenceKind,
          referentId,
          declaredAt: row.declaredAt.toISOString(),
          referent: (isFact ? facts : artifacts).get(referentId) ?? null,
        };
      }),
    };
  } catch {
    return { status: "unavailable", detail: UNAVAILABLE_DETAIL };
  }
}
