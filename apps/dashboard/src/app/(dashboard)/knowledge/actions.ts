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
import {
  ingestKnowledgeSource,
  type IngestKnowledgeResult,
} from "@/features/knowledge/knowledge-ingest.server";
import type { IngestKnowledgeInput } from "@/features/knowledge/ingestion-contracts";
import { readKnowledgeVersionHistory } from "@/features/knowledge/knowledge-version-history.server";
import type { KnowledgeVersionHistory } from "@/features/knowledge/supersede-contracts";
import {
  ratifyKnowledgeVersion,
  rejectKnowledgeVersion,
} from "@/features/knowledge-ratification/ratify-version.server";
import type {
  RatificationResult,
  RejectionResult,
} from "@/features/knowledge-ratification/contracts";

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
 * The INGESTION boundary: one plain-text source becomes N provisional Knowledge facts.
 *
 * It is the same authority as `createKnowledgeAction` and deliberately not a new one — the tenant,
 * actor and role band are resolved server-side from the R1 session, and the client input carries
 * content only. What it adds is quantity and atomicity: a source becomes many facts, and they commit
 * together or not at all.
 *
 * INGESTED IS NOT RATIFIED. Every row lands `draft`/`provisional`, exactly as an authored fact does,
 * and nothing here can reach K4. Nothing here reads a file, fetches a URL, calls a model, or embeds
 * anything — the source text arrives as text the human pasted.
 */
export async function ingestKnowledgeAction(input: {
  sourceTitle: string;
  sourceText: string;
  domainKey: string;
  scope: string;
}): Promise<IngestKnowledgeResult> {
  const tenant = await resolveTenantContext();
  const result = await ingestKnowledgeSource(tenant, {
    sourceTitle: input?.sourceTitle ?? "",
    sourceText: input?.sourceText ?? "",
    domainKey: input?.domainKey ?? "",
    scope: input?.scope as IngestKnowledgeInput["scope"],
  });
  if (result.status === "ingested") revalidatePath("/knowledge");
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

/*
 * ── K4: Governance review of one exact Knowledge version ────────────────────────────────────────
 *
 * These are the ONLY client-crossable ways to bind a Governance decision to Knowledge, and they
 * are deliberately thin:
 *
 *  - the tenant, the actor, the Governance authority, the decision, the session, the ratifying
 *    actor and the ratification timestamp are all resolved SERVER-SIDE. A forged `tenantId`,
 *    `actorId`, `decisionId`, `sessionId`, `ratifiedAt` or `ratifiedBy` has no parameter to
 *    arrive in;
 *  - the client names only the record and the exact VERSION it was shown. That version is a
 *    precondition, never authority: it can only cause a refusal;
 *  - authority is the G2 bootstrap-established human, NOT the owner/director band that permits
 *    authoring. A Knowledge author with no Governance authority is refused.
 *
 * They live in the Knowledge workspace because Knowledge owns the version and its ratification
 * linkage; the DECISION they create belongs to Governance, which owns it. Neither authority was
 * duplicated.
 */
export async function ratifyKnowledgeVersionAction(input: {
  factId: string;
  knowledgeNodeId: string;
  /** The version the operator was shown. A precondition that can only cause a refusal. */
  observedKnowledgeVersion: number;
  justification: string;
}): Promise<RatificationResult> {
  const tenant = await resolveTenantContext();
  const result = await ratifyKnowledgeVersion(tenant, input);
  if (result.status === "ratified") revalidatePath("/knowledge");
  return result;
}

/** Record that Governance did not approve this version. Changes NOTHING in Knowledge. */
export async function rejectKnowledgeVersionAction(input: {
  factId: string;
  knowledgeNodeId: string;
  observedKnowledgeVersion: number;
  justification: string;
}): Promise<RejectionResult> {
  const tenant = await resolveTenantContext();
  const result = await rejectKnowledgeVersion(tenant, input);
  if (result.status === "rejected") revalidatePath("/knowledge");
  return result;
}
