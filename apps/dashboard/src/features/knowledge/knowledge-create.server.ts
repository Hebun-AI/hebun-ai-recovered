/*
 * knowledge/knowledge-create.server.ts — the ONE Knowledge creation orchestration (K2).
 *
 * THE GATE ORDER IS THE DESIGN, and it is not negotiable:
 *
 *   1. AUTHENTICATED?   an authorized TenantContext must exist, resolved server-side.
 *   2. AUTHORIZED?      the actor's durable role band must permit authoring Knowledge.
 *   3. CONFIGURED?      durable persistence must exist.
 *   4. VALID?           the content must survive server-side validation.
 *   5. only then is anything written, and only inside the actor's own tenant.
 *
 * Authorization is checked BEFORE validation on purpose: an unauthorized caller must not be able to
 * use validation responses as an oracle for what the schema accepts.
 *
 * WHAT CANNOT REACH THIS FUNCTION. There is no path from a Heby message, a model response, a
 * conversation turn, a voice transcript, an agent, or a workflow into this module. It is called from
 * exactly one place — the Knowledge workspace's server action, behind an explicit human
 * confirmation — and it imports no model client, no transport, and no conversation repository.
 * Heby remains a Knowledge READER.
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
  type CreatedKnowledgeIdentity,
} from "./durable-knowledge-writer.server";
import {
  auditActorFrom,
  recordKnowledgeMutation,
  type AuditActor,
} from "@/features/governance-audit/knowledge-mutation-audit.server";
import type {
  KnowledgeMutationEvent,
  KnowledgeMutationReason,
} from "@/features/governance-audit/contracts";
import {
  validateCreateKnowledge,
  type KnowledgeValidationProblem,
} from "./create-contracts";

export interface KnowledgeCreateDeps {
  /** Resolve the actor's Knowledge write authority. Defaults to the durable role-band resolver. */
  readonly resolveAuthority?: (tenant: TenantContext) => Promise<KnowledgeWriteAuthority>;
  /** Returns the durable writer, or null when persistence is not configured. */
  readonly getWriter?: () => DurableKnowledgeWriter | null;
  /** Injected clock, so provenance timestamps are deterministic in tests. */
  readonly now?: () => Date;
  /**
   * G1 — appends a non-committed outcome to the shared audit sink. A committed mutation does NOT
   * come through here: its history is written inside the canonical transaction by the writer.
   */
  readonly recordMutation?: typeof recordKnowledgeMutation;
}

export type CreateKnowledgeResult =
  | { readonly status: "created"; readonly identity: CreatedKnowledgeIdentity }
  /** Not signed in. Nothing was read, validated, or written. */
  | { readonly status: "unauthorized" }
  /** Signed in, but the durable role band does not permit authoring Knowledge. */
  | { readonly status: "forbidden"; readonly roleType: string | null }
  | { readonly status: "invalid"; readonly problems: readonly KnowledgeValidationProblem[] }
  /**
   * The identity already exists for this tenant. Nothing was overwritten. `audited` reports
   * truthfully whether the refusal reached the governance ledger — a gap is stated, never hidden.
   */
  | {
      readonly status: "duplicate";
      readonly identity: CreatedKnowledgeIdentity;
      readonly audited?: boolean;
    }
  | {
      readonly status: "unavailable";
      readonly reason: "persistence-not-configured" | "write-failed";
      readonly detail?: string;
      readonly audited?: boolean;
    };

function assertServerRuntime(): void {
  if (typeof window !== "undefined") {
    throw new Error("Knowledge creation is server-only.");
  }
}

/**
 * Create one canonical Knowledge fact for the authenticated actor's tenant.
 *
 * The `input` is UNTRUSTED client content and is typed `unknown` on purpose — it is parsed and
 * validated here rather than being believed. Tenant and actor come only from `tenant`.
 */
export async function createKnowledgeFact(
  tenant: TenantContext | null,
  input: unknown,
  deps: KnowledgeCreateDeps = {},
): Promise<CreateKnowledgeResult> {
  assertServerRuntime();

  // 1. Authentication + tenant. The client supplies neither.
  if (!tenant?.tenantId || !tenant.userId) return { status: "unauthorized" };

  // 2. Authority. Checked before validation so an unauthorized caller learns nothing about the
  //    accepted shape of organizational Knowledge.
  const authority = await (deps.resolveAuthority ?? resolveKnowledgeWriteAuthority)(tenant);
  if (!authority.authorized) return { status: "forbidden", roleType: authority.roleType };

  // 3. Persistence. No in-memory fallback: an unconfigured database refuses, it does not pretend.
  const writer = (deps.getWriter ?? resolveKnowledgeWriterOrNull)();
  if (!writer) {
    return {
      status: "unavailable",
      reason: "persistence-not-configured",
      detail: "Durable persistence is not configured, so canonical Knowledge cannot be written.",
    };
  }

  // 4. Validation, server-side. Content is normalized, never rewritten in meaning.
  const validation = validateCreateKnowledge(input);
  if (!validation.ok) return { status: "invalid", problems: validation.problems };

  // 5. The transactional write, under the server-resolved authority only.
  //    From this point the attempt is AUTHORIZED and names a well-formed governed identity, which is
  //    exactly the boundary at which it becomes Knowledge governance history (KNOWLEDGE_AUDIT_BOUNDARY).
  const actor: AuditActor = auditActorFrom(tenant);
  const now = (deps.now ?? (() => new Date()))();
  const result = await writer.createFact(actor, validation.value, now);

  // A committed mutation was already audited INSIDE the canonical transaction — appending again
  // here would double-count history, and appending outside the transaction would break atomicity.
  if (result.status === "created") return { status: "created", identity: result.identity };

  // A refused or failed mutation has no transaction to join, so its history is appended on its own.
  const reason: KnowledgeMutationReason =
    result.status === "duplicate" ? "duplicate-identity" : "write-failed";
  const event: KnowledgeMutationEvent = {
    action: "knowledge.create",
    identity: {
      factId: result.identity.factId,
      factKey: result.identity.factKey,
      domainKey: result.identity.domainKey,
      scope: result.identity.scope,
    },
    outcome: result.status === "duplicate" ? "rejected" : "rolled-back",
    reason,
    metadata: {
      factKey: result.identity.factKey,
      domainKey: result.identity.domainKey,
      scope: result.identity.scope,
    },
  };
  const audited = await (deps.recordMutation ?? recordKnowledgeMutation)(actor, event, {
    now: () => now,
  });

  if (result.status === "duplicate") {
    return { status: "duplicate", identity: result.identity, audited: audited.recorded };
  }
  return {
    status: "unavailable",
    reason: "write-failed",
    detail: result.detail,
    audited: audited.recorded,
  };
}
