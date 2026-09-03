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
import { isAgentAuthorship, type AgentAuthorship } from "./agent-authorship.server";
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
 * Who actually typed the bytes — BOTH halves of the canonical polymorphic actor pair (S2).
 *
 * A SERVER-SUPPLIED POSITIONAL ARGUMENT, never a field on the caller's input object. A caller that
 * could name its own actor type could also claim to be a human, and the honest author is not the
 * caller's to choose. The public entry points below fix it: the direct path is always the acting
 * human, the Heby preparation path is always the tenant's durable agent identity.
 *
 * AGENT-RUNTIME-0 MADE THE ID HALF TRUE. Until this phase the agent path recorded the type `agent`
 * beside `tenant.userId` — a person's id — so one row asserted two contradictory things. The id now
 * comes from `AgentAuthorship`, which only `resolveAgentAuthorship` can mint, so an agent-authored
 * revision names the agent that authored it or the write does not happen at all.
 *
 * The row therefore records that a machine wrote the words and — through the artifact's own
 * `created_by` — that a person asked for them. Which is exactly why `heby_action_requests` carries
 * a `human` CHECK on its approver column: authorship is not authority, in either direction.
 */
type ArtifactAuthor =
  | { readonly actorType: "human"; readonly actorId: string }
  | { readonly actorType: "agent"; readonly actorId: string };

/**
 * Turn a verified authorship into the author pair, or refuse.
 *
 * The runtime check is the point. `AgentAuthorship`'s brand is a module-private symbol, so a caller
 * that manufactured one with a type cast satisfies the compiler and fails HERE — which is what
 * makes "no client-supplied agent id can become an author" a property of the code rather than a
 * convention somebody remembers.
 */
function agentAuthorOrNull(authorship: AgentAuthorship): ArtifactAuthor | null {
  if (!isAgentAuthorship(authorship)) return null;
  return { actorType: "agent", actorId: authorship.agentId };
}

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
  author: ArtifactAuthor,
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
          /*
           * CGO-1. Written ONCE, here, and never again. No writer in this module updates this
           * column, so a destination declared at preparation cannot change under an approval that
           * bound to this artifact's revision. Validation has already proved the value is present
           * for a content draft and absent for every other type, so this is a pass-through and not
           * a second place the rule is decided.
           */
          intendedDestination: input.intendedDestination ?? null,
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
        /*
         * The canonical polymorphic actor pair (S2). Fixed by the entry point, never by input, and
         * BOTH halves now describe the same actor.
         */
        authoredByActorType: author.actorType,
        authoredByActorId: author.actorId,
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
  /* Unchanged by AGENT-RUNTIME-0: the acting human authored the bytes and the row says so. */
  if (!tenant?.userId) return Promise.resolve(refused("unauthenticated"));
  return insertArtifactWithFirstRevision(
    tenant,
    input,
    ownerWorkspace,
    { actorType: "human", actorId: tenant.userId },
    deps,
  );
}

/**
 * The Heby preparation seam's writer. Identical in every respect except that the revision records
 * the tenant's durable AGENT identity as the author, because a model produced the bytes.
 *
 * The authorship is a positional argument and its only source is `resolveAgentAuthorship`. There is
 * no agent-id parameter and no default, so this function cannot be called at all without a resolved
 * durable identity — the refusal below exists for a forged value, not for an absent one.
 */
export function createWorkArtifactFromHebyPreparation(
  tenant: TenantContext | null,
  input: CreateWorkArtifactInput | null,
  ownerWorkspace: string,
  authorship: AgentAuthorship,
  deps: WorkArtifactWriteDeps = {},
): Promise<CreateWorkArtifactResult> {
  const author = agentAuthorOrNull(authorship);
  if (!author) return Promise.resolve(refused("unverified-agent-authorship"));
  return insertArtifactWithFirstRevision(tenant, input, ownerWorkspace, author, deps);
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
  author: ArtifactAuthor,
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
        authoredByActorType: author.actorType,
        authoredByActorId: author.actorId,
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
  if (!tenant?.userId) return Promise.resolve(refused("unauthenticated"));
  return appendRevision(tenant, input, { actorType: "human", actorId: tenant.userId }, deps);
}

/**
 * The Heby preparation seam's reviser. The bytes came from a model, so the row names the durable
 * agent that produced them — resolved, never supplied.
 */
export function reviseWorkArtifactFromHebyPreparation(
  tenant: TenantContext | null,
  input: ReviseWorkArtifactInput | null,
  authorship: AgentAuthorship,
  deps: WorkArtifactWriteDeps = {},
): Promise<ReviseWorkArtifactResult> {
  const author = agentAuthorOrNull(authorship);
  if (!author) return Promise.resolve(refused("unverified-agent-authorship"));
  return appendRevision(tenant, input, author, deps);
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
