"use server";

import { revalidatePath } from "next/cache";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import {
  createKnowledgeFact,
  type CreateKnowledgeResult,
} from "@/features/knowledge/knowledge-create.server";
import {
  supersedeKnowledgeFact,
  type SupersedeKnowledgeResult,
} from "@/features/knowledge/knowledge-supersede.server";
import { readKnowledgeVersionHistory } from "@/features/knowledge/knowledge-version-history.server";
import type { KnowledgeVersionHistory } from "@/features/knowledge/supersede-contracts";

/**
 * The K2 boundary for establishing organizational Knowledge. It is the ONLY client-crossable way
 * to write into the canonical Knowledge authority, and it is deliberately thin:
 *
 *  - the tenant, actor and role are resolved SERVER-SIDE from the R1 session — never client-supplied;
 *  - the actor must hold an owner/director authority band, checked against the durable role;
 *  - the client input is CONTENT ONLY: fact key, domain, scope, title, statement. It carries no
 *    tenant, identity, role, actor, lifecycle, authority class, or ratification — the type makes
 *    those unrepresentable, and the server writes `draft`/`provisional` regardless.
 *
 * It is a SEPARATE action from anything Heby can call. Heby's own server actions
 * (`askHebyAction`, `runHebyReadCommandAction`) do not import this module, so no message, model
 * answer, slash command, or voice transcript has a representation in which it could reach it.
 */
export async function createKnowledgeAction(input: {
  factKey: string;
  domainKey: string;
  scope: string;
  title: string;
  statement: string;
}): Promise<CreateKnowledgeResult> {
  const tenant = await resolveTenantContext();
  const result = await createKnowledgeFact(tenant, input);
  if (result.status === "created") revalidatePath("/knowledge");
  return result;
}

/**
 * The K3 boundary for CORRECTING organizational Knowledge. It creates a NEW version that supersedes
 * the active one — there is no action here that edits or deletes a version, because no such
 * capability exists.
 *
 * The client supplies the record reference, the corrected content, and the version it was SHOWING.
 * That version is a precondition, never authority: it can only cause a refusal, and the transaction
 * still swaps on the version the server read for itself. A stale browser is therefore refused rather
 * than allowed to bury a correction it never saw.
 */
export async function supersedeKnowledgeAction(input: {
  factId: string;
  title: string;
  statement: string;
  /** The version the operator was shown. A precondition that can only cause a refusal. */
  observedKnowledgeVersion: number;
}): Promise<SupersedeKnowledgeResult> {
  const tenant = await resolveTenantContext();
  const result = await supersedeKnowledgeFact(tenant, input);
  if (result.status === "superseded") revalidatePath("/knowledge");
  return result;
}

/** Read one fact's version chain, tenant-scoped. Read-only; grants nothing. */
export async function readKnowledgeVersionsAction(input: {
  factId: string;
}): Promise<KnowledgeVersionHistory> {
  const tenant = await resolveTenantContext();
  return readKnowledgeVersionHistory(tenant, input.factId);
}
