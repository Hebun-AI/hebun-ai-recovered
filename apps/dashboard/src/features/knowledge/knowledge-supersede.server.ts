/*
 * knowledge/knowledge-supersede.server.ts — the ONE Knowledge correction orchestration (K3).
 *
 * Same gate order as creation, and for the same reason:
 *
 *   1. AUTHENTICATED?  an authorized TenantContext, resolved server-side.
 *   2. AUTHORIZED?     the durable role band must permit authoring Knowledge.
 *   3. CONFIGURED?     durable persistence must exist.
 *   4. VALID?          the correction must survive server-side validation.
 *   5. only then is the transactional supersession attempted, in the actor's own tenant.
 *
 * Authorization is checked BEFORE validation so an unauthorized caller cannot use responses as an
 * oracle. Authorization reuses the SAME connected role-band authority as creation, through its own
 * call site — deliberately not a new permission, because the fine-grained permission runtime still
 * does not exist (see `KNOWLEDGE_WRITE_AUTHORITY_MODEL`). When it does, this call site swaps without
 * touching the transaction.
 *
 * WHAT THIS CANNOT DO: edit a node, delete a version, reactivate a historical version, or ratify
 * anything. A restoration of older wording is a NEW version whose content restores it — never a
 * silent re-selection of an old node. That rule is architectural, and K3 ships no rollback path.
 *
 * Server-only.
 */

import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  resolveKnowledgeWriteAuthority,
  type KnowledgeWriteAuthority,
} from "./knowledge-write-authority.server";
import {
  resolveKnowledgeWriterOrNull,
  type DurableKnowledgeWriter,
  type SupersededKnowledgeIdentity,
} from "./durable-knowledge-writer.server";
import {
  validateSupersedeKnowledge,
} from "./supersede-contracts";
import type { KnowledgeValidationProblem } from "./create-contracts";
import {
  auditActorFrom,
  recordKnowledgeMutation,
  type AuditActor,
} from "@/features/governance-audit/knowledge-mutation-audit.server";
import type {
  KnowledgeMutationEvent,
  KnowledgeMutationReason,
} from "@/features/governance-audit/contracts";

export interface KnowledgeSupersedeDeps {
  readonly resolveAuthority?: (tenant: TenantContext) => Promise<KnowledgeWriteAuthority>;
  readonly getWriter?: () => DurableKnowledgeWriter | null;
  readonly now?: () => Date;
  /** Appends a non-committed outcome. A committed one is audited inside the canonical transaction. */
  readonly recordMutation?: typeof recordKnowledgeMutation;
}

export type SupersedeKnowledgeResult =
  | { readonly status: "superseded"; readonly identity: SupersededKnowledgeIdentity }
  | { readonly status: "unauthorized" }
  | { readonly status: "forbidden"; readonly roleType: string | null }
  | { readonly status: "invalid"; readonly problems: readonly KnowledgeValidationProblem[] }
  /** No such fact for this tenant — indistinguishable from another tenant's fact, by design. */
  | { readonly status: "not-found"; readonly audited?: boolean }
  /** Someone else's correction landed first. Nothing was overwritten; re-read and try again. */
  | { readonly status: "stale-version"; readonly audited?: boolean }
  | {
      readonly status: "unavailable";
      readonly reason: "persistence-not-configured" | "write-failed";
      readonly detail?: string;
      readonly audited?: boolean;
    };

function assertServerRuntime(): void {
  if (typeof window !== "undefined") {
    throw new Error("Knowledge supersession is server-only.");
  }
}

/** Correct one canonical Knowledge fact by creating the next version. */
export async function supersedeKnowledgeFact(
  tenant: TenantContext | null,
  input: unknown,
  deps: KnowledgeSupersedeDeps = {},
): Promise<SupersedeKnowledgeResult> {
  assertServerRuntime();

  if (!tenant?.tenantId || !tenant.userId) return { status: "unauthorized" };

  const authority = await (deps.resolveAuthority ?? resolveKnowledgeWriteAuthority)(tenant);
  if (!authority.authorized) return { status: "forbidden", roleType: authority.roleType };

  const writer = (deps.getWriter ?? resolveKnowledgeWriterOrNull)();
  if (!writer) {
    return {
      status: "unavailable",
      reason: "persistence-not-configured",
      detail: "Durable persistence is not configured, so canonical Knowledge cannot be corrected.",
    };
  }

  const validation = validateSupersedeKnowledge(input);
  if (!validation.ok) return { status: "invalid", problems: validation.problems };

  const actor: AuditActor = auditActorFrom(tenant);
  const now = (deps.now ?? (() => new Date()))();
  const outcome = await writer.supersedeFact(
    actor,
    validation.value.factId,
    {
      title: validation.value.title,
      statement: validation.value.statement,
      observedKnowledgeVersion: validation.value.observedKnowledgeVersion,
    },
    now,
  );

  // A committed supersession was already audited inside the canonical transaction.
  if (outcome.status === "superseded") {
    return { status: "superseded", identity: outcome.identity };
  }

  /*
   * Everything below is an AUTHORIZED attempt against a named governed identity that did not
   * commit — exactly what G1's boundary says belongs in Knowledge mutation history. The outcome
   * vocabulary is G1's own: a governed refusal is `rejected`, a failed transaction is `rolled-back`.
   */
  const reason: KnowledgeMutationReason =
    outcome.status === "stale"
      ? "stale-version"
      : outcome.status === "unresolvable"
        ? "fact-unresolvable"
        : "write-failed";
  const event: KnowledgeMutationEvent = {
    action: "knowledge.supersede",
    identity: {
      factId: validation.value.factId,
      // The fact's key/domain/scope are unknown when it could not be resolved; the identity that
      // matters — and the only one honestly available — is the row the actor targeted.
      factKey: "",
      domainKey: "",
      scope: "",
    },
    outcome: outcome.status === "failed" ? "rolled-back" : "rejected",
    reason,
    metadata: { factKey: "", domainKey: "", scope: "" },
  };
  const audited = await (deps.recordMutation ?? recordKnowledgeMutation)(actor, event, {
    now: () => now,
  });

  if (outcome.status === "stale") return { status: "stale-version", audited: audited.recorded };
  if (outcome.status === "unresolvable") return { status: "not-found", audited: audited.recorded };
  return {
    status: "unavailable",
    reason: "write-failed",
    detail: outcome.detail,
    audited: audited.recorded,
  };
}
