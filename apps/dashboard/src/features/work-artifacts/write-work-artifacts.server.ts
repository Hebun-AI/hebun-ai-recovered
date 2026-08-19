/*
 * work-artifacts/write-work-artifacts.server.ts — the ONLY writers of prepared work (R3W).
 *
 * Three operations live here because they share one invariant and splitting them across files
 * would mean three places where somebody could add a fourth: CREATE appends revision 1, REVISE
 * appends revision N+1, RETIRE closes the artifact. Nothing else writes to `work_artifacts` or
 * `work_artifact_revisions`, and a structural test asserts that no other module does.
 *
 * ── WHAT IS UNREACHABLE FROM HERE ────────────────────────────────────────────
 *
 * There is NO update path for `work_artifact_revisions`. Content is inserted once and never
 * touched again — not corrected, not regenerated, not repaired. Every "edit" is an append, and
 * the previous bytes stay byte-identical forever. That is the entire reason a future approval can
 * bind to a revision at all.
 *
 * There is no way to write an approval, a ratification, a decision, a permit or an execution
 * result: those columns do not exist, and this module imports nothing that owns them.
 *
 * ── WHAT THE CALLER CANNOT SUPPLY ────────────────────────────────────────────
 *
 * The input carries CONTENT and CLASSIFICATION only. It has no tenant, no actor, no authority, no
 * lifecycle, no digest and no revision number — the types make them unrepresentable rather than
 * merely discouraged, exactly as `CreateKnowledgeInput` does for Knowledge. The tenant and actor
 * come from an already-resolved server-side `TenantContext`; the digest is computed here; the
 * revision number is allocated under a row lock.
 *
 * ── NO AUTHORITY IS CONSULTED, AND NONE IS GRANTED ───────────────────────────
 *
 * Preparing work asks nothing of Governance: anyone holding a tenant session may prepare, and
 * Heby may prepare without approval. That is deliberate and it mirrors `recordActionRequest` —
 * proposing is free, and the entire cost is paid at the approval boundary, where a human and a
 * Governance decision are both mandatory. Authorship is not authority.
 *
 * Server-only.
 */
import { and, eq, sql } from "drizzle-orm";
import { type ControlPlaneDatabase } from "@/db/client.server";
import { messages } from "@/db/schema/conversation";
import { workArtifactRevisions, workArtifacts } from "@/db/schema/work-artifact";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { resolveGovernanceDbOrNull } from "@/features/governance-decision/persistence.server";
import { formatWorkArtifactRef } from "./artifact-ref";
import { digestArtifactContent } from "./content-digest";
import {
  type CreateWorkArtifactInput,
  type CreateWorkArtifactResult,
  type ReviseWorkArtifactInput,
  type ReviseWorkArtifactResult,
  type RetireWorkArtifactResult,
  type WorkArtifactRefusal,
} from "./contracts";
import { validateRevisionContent, validateWorkArtifactInput } from "./validation";

export interface WorkArtifactWriteDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
}

/**
 * Who actually typed the bytes.
 *
 * A SERVER-SUPPLIED POSITIONAL ARGUMENT, never a field on the caller's input object. A caller that
 * could name its own actor type could also claim to be a human, and the honest author is not the
 * caller's to choose. The public entry points below fix it: the direct path is always `human`, the
 * Heby preparation path is always `agent`. The row therefore always records that a machine wrote
 * the words and a person asked for them — which is exactly why `heby_action_requests` carries a
 * `human` CHECK on its approver column.
 */
type ArtifactAuthorType = "human" | "agent";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function refused<T extends { status: "refused"; reason: WorkArtifactRefusal }>(
  reason: WorkArtifactRefusal,
): T {
  return { status: "refused", reason } as T;
}

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Work artifacts are server-only.");
  }
}

/**
 * Whether a supplied message id belongs to this tenant.
 *
 * The composite foreign key already makes a cross-tenant link structurally impossible, so this
 * read exists only so an ordinary mistake gets a named refusal instead of a constraint violation.
 * A foreign id is reported as "not found" and never as "belongs to someone else" — the refusal
 * must not confirm that another tenant's row exists.
 */
async function sourceMessageBelongsToTenant(
  db: ControlPlaneDatabase,
  tenantId: string,
  messageId: string,
): Promise<boolean> {
  if (!UUID_RE.test(messageId)) return false;
  const rows = await db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.tenantId, tenantId), eq(messages.id, messageId)))
    .limit(1);
  return rows.length > 0;
}

/**
 * Create one artifact and its first revision.
 *
 * ONE TRANSACTION, and the revision insert is inside it on purpose. Leaving it outside would
 * allow an artifact shell with no content — a titled row claiming `current_revision = 1` while no
 * revision 1 exists, which every reader would then have to defend against forever. An artifact
 * exists because content was written into it.
 */
async function insertArtifactWithFirstRevision(
  tenant: TenantContext | null,
  input: CreateWorkArtifactInput | null,
  ownerWorkspace: string,
  authoredByActorType: ArtifactAuthorType,
  deps: WorkArtifactWriteDeps,
): Promise<CreateWorkArtifactResult> {
  assertServerOnly();
  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");
  if (!input) return refused("invalid-input");
  if (typeof ownerWorkspace !== "string" || ownerWorkspace.trim().length === 0) {
    return refused("invalid-input");
  }

  const problems = validateWorkArtifactInput(input);
  if (problems.length > 0) return { status: "invalid", problems };

  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return refused("persistence-unavailable");
  const now = (deps.now ?? (() => new Date()))();

  const sourceMessageId = input.sourceMessageId?.trim() || undefined;
  if (sourceMessageId && !(await sourceMessageBelongsToTenant(db, tenant.tenantId, sourceMessageId))) {
    return refused("source-message-not-found");
  }

  const contentDigest = digestArtifactContent(input.content);

  try {
    const created = await db.transaction(async (tx) => {
      const artifactRows = await tx
        .insert(workArtifacts)
        .values({
          tenantId: tenant.tenantId,
          artifactType: input.artifactType,
          title: input.title,
          /* Always `draft`. There is no input field that could ask for anything else. */
          artifactLifecycleStatus: "draft",
          ownerWorkspace,
          currentRevision: 1,
          createdAt: now,
          updatedAt: now,
          createdBy: tenant.userId,
          createdByType: "human",
        })
        .returning({ id: workArtifacts.id });

      const artifactId = artifactRows[0]?.id;
      if (!artifactId) throw new Error("work artifact insert returned no id");

      await tx.insert(workArtifactRevisions).values({
        tenantId: tenant.tenantId,
        artifactId,
        revisionNo: 1,
        content: input.content,
        contentDigest,
        /* The canonical polymorphic actor pair (S2). Fixed by the entry point, never by input. */
        authoredByActorType,
        authoredByActorId: tenant.userId,
        sourceMessageId: sourceMessageId ?? null,
        createdAt: now,
      });

      return { artifactId };
    });

    return {
      status: "created",
      artifactId: created.artifactId,
      revisionNo: 1,
      contentDigest,
      ref: formatWorkArtifactRef(created.artifactId, 1),
    };
  } catch {
    return refused("persistence-unavailable");
  }
}

/** A human authoring prepared work directly, with no model in the loop. */
export function createWorkArtifact(
  tenant: TenantContext | null,
  input: CreateWorkArtifactInput | null,
  ownerWorkspace: string,
  deps: WorkArtifactWriteDeps = {},
): Promise<CreateWorkArtifactResult> {
  return insertArtifactWithFirstRevision(tenant, input, ownerWorkspace, "human", deps);
}

/**
 * The Heby preparation seam's writer. Identical in every respect except that the revision records
 * `agent` as the author, because a model produced the bytes.
 */
export function createWorkArtifactFromHebyPreparation(
  tenant: TenantContext | null,
  input: CreateWorkArtifactInput | null,
  ownerWorkspace: string,
  deps: WorkArtifactWriteDeps = {},
): Promise<CreateWorkArtifactResult> {
  return insertArtifactWithFirstRevision(tenant, input, ownerWorkspace, "agent", deps);
}

/**
 * Append revision N+1.
 *
 * THE LOCK IS THE POINT. `select ... for update` on the artifact row serialises concurrent
 * revisers, so two callers cannot both read `current_revision = 1` and both try to write revision
 * 2. The unique index `(tenant_id, artifact_id, revision_no)` remains the structural authority —
 * the lock exists so the ordinary case gets a clean allocation instead of a constraint violation,
 * and a caller that somehow loses anyway is told `revision-conflict` rather than being handed a
 * fake persistence failure.
 *
 * NOTHING ABOUT REVISION N IS TOUCHED. The only write against an existing row is the artifact's
 * `current_revision` pointer.
 */
async function appendRevision(
  tenant: TenantContext | null,
  input: ReviseWorkArtifactInput | null,
  authoredByActorType: ArtifactAuthorType,
  deps: WorkArtifactWriteDeps,
): Promise<ReviseWorkArtifactResult> {
  assertServerOnly();
  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");
  if (!input?.artifactId || !UUID_RE.test(input.artifactId)) return refused("invalid-input");

  const problems = validateRevisionContent(input.content);
  if (problems.length > 0) return { status: "invalid", problems };

  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return refused("persistence-unavailable");
  const now = (deps.now ?? (() => new Date()))();

  const sourceMessageId = input.sourceMessageId?.trim() || undefined;
  if (sourceMessageId && !(await sourceMessageBelongsToTenant(db, tenant.tenantId, sourceMessageId))) {
    return refused("source-message-not-found");
  }

  const contentDigest = digestArtifactContent(input.content);

  try {
    return await db.transaction(async (tx): Promise<ReviseWorkArtifactResult> => {
      const locked = await tx
        .select({
          id: workArtifacts.id,
          currentRevision: workArtifacts.currentRevision,
          lifecycle: workArtifacts.artifactLifecycleStatus,
        })
        .from(workArtifacts)
        .where(
          and(
            eq(workArtifacts.tenantId, tenant.tenantId),
            eq(workArtifacts.id, input.artifactId),
          ),
        )
        .for("update")
        .limit(1);

      const artifact = locked[0];
      /* A foreign artifact is "not found", never "not yours" — the refusal confirms nothing. */
      if (!artifact) return refused("artifact-not-found");
      if (artifact.lifecycle === "retired") return refused("artifact-retired");

      const revisionNo = artifact.currentRevision + 1;

      await tx.insert(workArtifactRevisions).values({
        tenantId: tenant.tenantId,
        artifactId: artifact.id,
        revisionNo,
        content: input.content,
        contentDigest,
        authoredByActorType,
        authoredByActorId: tenant.userId,
        sourceMessageId: sourceMessageId ?? null,
        createdAt: now,
      });

      await tx
        .update(workArtifacts)
        .set({
          currentRevision: revisionNo,
          updatedAt: now,
          updatedBy: tenant.userId,
          updatedByType: "human",
          version: sql`${workArtifacts.version} + 1`,
        })
        .where(
          and(eq(workArtifacts.tenantId, tenant.tenantId), eq(workArtifacts.id, artifact.id)),
        );

      return {
        status: "revised",
        artifactId: artifact.id,
        revisionNo,
        contentDigest,
        ref: formatWorkArtifactRef(artifact.id, revisionNo),
      };
    });
  } catch (error) {
    if (isUniqueViolation(error)) return refused("revision-conflict");
    return refused("persistence-unavailable");
  }
}

/** A human revising prepared work directly. */
export function reviseWorkArtifact(
  tenant: TenantContext | null,
  input: ReviseWorkArtifactInput | null,
  deps: WorkArtifactWriteDeps = {},
): Promise<ReviseWorkArtifactResult> {
  return appendRevision(tenant, input, "human", deps);
}

/** The Heby preparation seam's reviser. The bytes came from a model, so the row says `agent`. */
export function reviseWorkArtifactFromHebyPreparation(
  tenant: TenantContext | null,
  input: ReviseWorkArtifactInput | null,
  deps: WorkArtifactWriteDeps = {},
): Promise<ReviseWorkArtifactResult> {
  return appendRevision(tenant, input, "agent", deps);
}

/**
 * Retire an artifact: no further revisions, nothing deleted.
 *
 * RETIREMENT IS NOT A GOVERNANCE ACT and implies no approval, rejection, or judgement about the
 * work. It is the tenant saying "we are done preparing this". Any member of the tenant may do it,
 * for the same reason any of them may prepare: this domain confers no authority in either
 * direction.
 *
 * Every revision stays readable forever. R3W adds NO deletion path and NO retention policy —
 * inventing one here would be deciding something nobody has decided.
 */
export async function retireWorkArtifact(
  tenant: TenantContext | null,
  input: { readonly artifactId: string } | null,
  deps: WorkArtifactWriteDeps = {},
): Promise<RetireWorkArtifactResult> {
  assertServerOnly();
  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");
  if (!input?.artifactId || !UUID_RE.test(input.artifactId)) return refused("invalid-input");

  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return refused("persistence-unavailable");
  const now = (deps.now ?? (() => new Date()))();

  try {
    const rows = await db
      .update(workArtifacts)
      .set({
        artifactLifecycleStatus: "retired",
        updatedAt: now,
        updatedBy: tenant.userId,
        updatedByType: "human",
        version: sql`${workArtifacts.version} + 1`,
      })
      .where(
        and(
          eq(workArtifacts.tenantId, tenant.tenantId),
          eq(workArtifacts.id, input.artifactId),
          eq(workArtifacts.artifactLifecycleStatus, "draft"),
        ),
      )
      .returning({ id: workArtifacts.id });

    const artifactId = rows[0]?.id;
    if (!artifactId) return refused("artifact-not-found");
    return { status: "retired", artifactId };
  } catch {
    return refused("persistence-unavailable");
  }
}

/** PostgreSQL `unique_violation`. Read from the driver's code, never from the message text. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "23505"
  );
}
