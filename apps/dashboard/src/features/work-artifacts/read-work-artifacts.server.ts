/*
 * work-artifacts/read-work-artifacts.server.ts — the tenant-scoped read seam (R3W).
 *
 * Three reads, and no more: list the tenant's artifacts, read one exact revision, read the current
 * revision. Everything a caller can ask for is bounded by a server-resolved `TenantContext`; a
 * reference to another tenant's artifact resolves to NOTHING rather than to a refusal that would
 * confirm the row exists.
 *
 * ── READABLE IS NOT PROPOSABLE, AND THE DISTINCTION IS THE WHOLE POINT ───────
 *
 *   readable   — an authorized reader may see these exact historical bytes. True for any revision
 *                that exists in this tenant, whatever happened afterwards. History does not rot.
 *   proposable — a NEW action may be proposed against it. Only the CURRENT revision of a
 *                non-retired artifact qualifies.
 *
 * A superseded reference is never silently upgraded to the current one. Resolving "revision 1"
 * always returns revision 1's bytes, and says plainly that revision 1 is no longer current. The
 * alternative — quietly resolving to "whatever is newest" — is precisely how an approval granted
 * for one draft comes to authorize a different one.
 *
 * Server-only. Reads only: this module issues no INSERT, UPDATE or DELETE.
 */
import { and, desc, eq } from "drizzle-orm";
import { type ControlPlaneDatabase } from "@/db/client.server";
import { workArtifactRevisions, workArtifacts } from "@/db/schema/work-artifact";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { resolveGovernanceDbOrNull } from "@/features/governance-decision/persistence.server";
import { formatWorkArtifactRef, parseWorkArtifactRef } from "./artifact-ref";
import type {
  WorkArtifactLifecycleStatus,
  WorkArtifactReferenceResolution,
  WorkArtifactRevisionView,
  WorkArtifactType,
  WorkArtifactView,
  ContentDestination,
} from "./contracts";

export interface WorkArtifactReadDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
}

/** An honest listing outcome. `unavailable` is a read failure, never an empty result. */
export type WorkArtifactListing =
  | { readonly status: "read"; readonly artifacts: readonly WorkArtifactView[] }
  | { readonly status: "unavailable"; readonly reason: string };

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/**
 * REV-2. `currentRevisionAuthoredByActorType` is supplied by the CALLER, not read from the artifact
 * row, because no column on `work_artifacts` holds it — it lives on the revision the artifact
 * currently points at. Passing it in keeps this projection a pure mapping and makes the join the
 * one place the two tables are related.
 *
 * The empty string is the honest value when the current revision did not resolve. It is not
 * "human", not "unknown" spelled as a fact, and not an omission: `workArtifactAuthorLabel` turns it
 * into REV-1's explicit "unknown, not human" sentence.
 */
function toArtifactView(
  row: typeof workArtifacts.$inferSelect,
  currentRevisionAuthoredByActorType: string,
): WorkArtifactView {
  return {
    currentRevisionAuthoredByActorType,
    id: row.id,
    tenantId: row.tenantId,
    artifactType: row.artifactType as WorkArtifactType,
    title: row.title,
    lifecycleStatus: row.artifactLifecycleStatus as WorkArtifactLifecycleStatus,
    ownerWorkspace: row.ownerWorkspace,
    currentRevision: row.currentRevision,
    createdAt: iso(row.createdAt),
    currentRef: formatWorkArtifactRef(row.id, row.currentRevision),
    /*
     * CGO-1. NULL for everything that is not a content draft, which the paired database CHECKs
     * guarantee rather than this projection assuming it.
     */
    intendedDestination: (row.intendedDestination as ContentDestination | null) ?? null,
  };
}

function toRevisionView(
  row: typeof workArtifactRevisions.$inferSelect,
  currentRevision: number,
): WorkArtifactRevisionView {
  return {
    id: row.id,
    artifactId: row.artifactId,
    revisionNo: row.revisionNo,
    content: row.content,
    contentDigest: row.contentDigest,
    authoredByActorType: row.authoredByActorType,
    authoredByActorId: row.authoredByActorId,
    sourceMessageId: row.sourceMessageId,
    createdAt: iso(row.createdAt),
    /* Derived from the artifact's pointer, never stored on the revision — one source of truth. */
    current: row.revisionNo === currentRevision,
  };
}

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Work artifact reads are server-only.");
  }
}

/** Every artifact this tenant holds, newest first. Never another tenant's, never a global list. */
export async function listWorkArtifacts(
  tenant: TenantContext | null,
  deps: WorkArtifactReadDeps = {},
): Promise<WorkArtifactListing> {
  assertServerOnly();
  if (!tenant?.tenantId) return { status: "unavailable", reason: "no-authorized-tenant-context" };
  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return { status: "unavailable", reason: "persistence-unavailable" };

  try {
    /*
     * REV-2 — the artifact, plus the author of the revision it currently points at.
     *
     * A LEFT JOIN, deliberately. An INNER JOIN would DROP any artifact whose current revision did
     * not resolve, which would hide prepared work from a reviewing human in order to protect a
     * label — the wrong trade in a listing whose whole job is to show what exists. The row still
     * appears; its authorship arrives null and is rendered as explicitly unknown.
     *
     * The join carries `tenantId` as well as `artifactId`, so the predicate is scoped on BOTH
     * tables rather than trusting the foreign key to have kept them in the same tenant.
     */
    const rows = await db
      .select({ artifact: workArtifacts, authoredByActorType: workArtifactRevisions.authoredByActorType })
      .from(workArtifacts)
      .leftJoin(
        workArtifactRevisions,
        and(
          eq(workArtifactRevisions.artifactId, workArtifacts.id),
          eq(workArtifactRevisions.revisionNo, workArtifacts.currentRevision),
          eq(workArtifactRevisions.tenantId, tenant.tenantId),
        ),
      )
      .where(eq(workArtifacts.tenantId, tenant.tenantId))
      .orderBy(desc(workArtifacts.createdAt));
    return {
      status: "read",
      artifacts: rows.map((row) => toArtifactView(row.artifact, row.authoredByActorType ?? "")),
    };
  } catch {
    return { status: "unavailable", reason: "persistence-unavailable" };
  }
}

/** Every revision of one artifact, oldest first. History in full; nothing is hidden by age. */
export async function readWorkArtifactHistory(
  tenant: TenantContext | null,
  artifactId: string,
  deps: WorkArtifactReadDeps = {},
): Promise<readonly WorkArtifactRevisionView[]> {
  assertServerOnly();
  if (!tenant?.tenantId) return [];
  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return [];

  try {
    const artifactRows = await db
      .select({ currentRevision: workArtifacts.currentRevision })
      .from(workArtifacts)
      .where(and(eq(workArtifacts.tenantId, tenant.tenantId), eq(workArtifacts.id, artifactId)))
      .limit(1);
    const artifact = artifactRows[0];
    if (!artifact) return [];

    const rows = await db
      .select()
      .from(workArtifactRevisions)
      .where(
        and(
          eq(workArtifactRevisions.tenantId, tenant.tenantId),
          eq(workArtifactRevisions.artifactId, artifactId),
        ),
      )
      .orderBy(workArtifactRevisions.revisionNo);
    return rows.map((row) => toRevisionView(row, artifact.currentRevision));
  } catch {
    return [];
  }
}

/**
 * Resolve one `work-artifact/<uuid>@<n>` reference to its exact bytes and its standing.
 *
 * THIS IS THE STALE-REFERENCE RULE, in one function. Five outcomes, and none of them is "close
 * enough":
 *
 *   malformed-ref     the string is not a canonical reference — parsed, refused, nothing read
 *   unknown-artifact  no such artifact in THIS tenant (a foreign one is indistinguishable, on
 *                     purpose: the answer must not confirm another tenant's row exists)
 *   unknown-revision  the artifact exists but never had that revision — a fabricated number
 *   current           the referenced revision is the artifact's current one, artifact not retired
 *   superseded        the revision exists and is real, but a newer one has been appended
 *   retired           the artifact was retired; every one of its revisions reads as retired
 *
 * `readable` stays true for everything that genuinely exists. `proposable` is true ONLY for
 * `current`. Nothing here upgrades, redirects, or "helpfully" substitutes a newer revision.
 */
export async function resolveWorkArtifactReference(
  tenant: TenantContext | null,
  ref: unknown,
  deps: WorkArtifactReadDeps = {},
): Promise<WorkArtifactReferenceResolution> {
  assertServerOnly();
  const refText = typeof ref === "string" ? ref : "";
  const parsed = parseWorkArtifactRef(ref);
  if (!parsed) {
    return { ref: refText, standing: "malformed-ref", readable: false, proposable: false };
  }
  const miss = (standing: "unknown-artifact" | "unknown-revision"): WorkArtifactReferenceResolution => ({
    ref: refText,
    standing,
    readable: false,
    proposable: false,
  });

  if (!tenant?.tenantId) return miss("unknown-artifact");
  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return miss("unknown-artifact");

  try {
    const artifactRows = await db
      .select()
      .from(workArtifacts)
      .where(
        and(eq(workArtifacts.tenantId, tenant.tenantId), eq(workArtifacts.id, parsed.artifactId)),
      )
      .limit(1);
    const artifactRow = artifactRows[0];
    if (!artifactRow) return miss("unknown-artifact");

    const revisionRows = await db
      .select()
      .from(workArtifactRevisions)
      .where(
        and(
          eq(workArtifactRevisions.tenantId, tenant.tenantId),
          eq(workArtifactRevisions.artifactId, parsed.artifactId),
          eq(workArtifactRevisions.revisionNo, parsed.revisionNo),
        ),
      )
      .limit(1);
    const revisionRow = revisionRows[0];
    if (!revisionRow) return miss("unknown-revision");

    /*
     * REV-2 — the CURRENT revision's author, which is not necessarily this revision's author.
     *
     * This seam resolves an EXACT revision, and that revision may be superseded. Handing its author
     * to `toArtifactView` would put a superseded revision's author in a field whose whole contract
     * is "the current one" — the same silent upgrade this module refuses everywhere else, only
     * running the other way. So it is used ONLY when the resolved revision IS the current one, and
     * looked up otherwise.
     *
     * A lookup that returns nothing yields the empty string, which renders as explicitly unknown.
     */
    let currentAuthorType = revisionRow.authoredByActorType;
    if (revisionRow.revisionNo !== artifactRow.currentRevision) {
      const currentRows = await db
        .select({ authoredByActorType: workArtifactRevisions.authoredByActorType })
        .from(workArtifactRevisions)
        .where(
          and(
            eq(workArtifactRevisions.tenantId, tenant.tenantId),
            eq(workArtifactRevisions.artifactId, parsed.artifactId),
            eq(workArtifactRevisions.revisionNo, artifactRow.currentRevision),
          ),
        )
        .limit(1);
      currentAuthorType = currentRows[0]?.authoredByActorType ?? "";
    }

    const artifact = toArtifactView(artifactRow, currentAuthorType);
    const revision = toRevisionView(revisionRow, artifactRow.currentRevision);

    const standing =
      artifact.lifecycleStatus === "retired"
        ? "retired"
        : revision.current
          ? "current"
          : "superseded";

    return {
      ref: refText,
      standing,
      /* History is readable forever. Retirement and supersession end proposals, not memory. */
      readable: true,
      proposable: standing === "current",
      revision,
      artifact,
    };
  } catch {
    return miss("unknown-artifact");
  }
}
