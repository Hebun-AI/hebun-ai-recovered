"use server";

import { revalidatePath } from "next/cache";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import {
  attachExternalReference,
  listExternalReferences,
  withdrawExternalReference,
  type AttachExternalReferenceResult,
  type WithdrawExternalReferenceResult,
} from "@/features/knowledge/external-reference-authority.server";
import type {
  ExternalSystemReference,
  RecordedExternalReference,
} from "@/features/knowledge/external-reference-contracts";
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
import {
  ingestKnowledgeFile,
  type IngestKnowledgeFileResult,
} from "@/features/knowledge/knowledge-file-ingest.server";
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
import { retractKnowledgeSource } from "@/features/knowledge/retract-source.server";
import type { RetractionResult } from "@/features/knowledge/retraction-contracts";
import {
  admitPickedProviderDocument,
  admitProviderDocument,
  type AdmitProviderDocumentResult,
} from "@/features/provider-content-admission/admit-provider-document.server";
import {
  authorizePickerSession,
  type PickerSessionResult,
} from "@/features/provider-content-admission/authorize-picker-session.server";

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

/**
 * The FILE boundary: one selected text file becomes the same provisional Knowledge facts a paste
 * would (R4C.1).
 *
 * It is the SAME authority as the two actions above and deliberately not a new one. What it adds is
 * a door: a `.txt` or `.md` file crosses as bytes, is bounded and decoded server-side, and the text
 * it becomes enters the ingestion path unchanged. There is no second Knowledge writer behind it.
 *
 * WHY IT TAKES `FormData`. A file cannot cross a server-action boundary any other way, and Hebun
 * already resolves two other forms exactly like this. It is NOT an HTTP endpoint: the repository has
 * no route handler, this adds none, and the tenant is resolved from the R1 session here — never read
 * from a header, a body field, or anything the browser chose.
 *
 * WHAT THE CLIENT CANNOT SEND. There is no tenant, actor, role, standing, digest or source-type
 * field in this payload, and the decoded text is not a field either. The browser may decode a copy
 * to show a record count before the human confirms; the text that becomes Knowledge is decoded from
 * the bytes this action received.
 *
 * THE RAW FILE IS NOT KEPT. Nothing here writes a filesystem path, an object store, or a `documents`
 * row. The bytes end with the request.
 */
export async function ingestKnowledgeFileAction(
  formData: FormData,
): Promise<IngestKnowledgeFileResult> {
  const tenant = await resolveTenantContext();
  const text = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };
  const result = await ingestKnowledgeFile(tenant, {
    file: formData.get("file"),
    sourceTitle: text("sourceTitle"),
    domainKey: text("domainKey"),
    scope: text("scope") as IngestKnowledgeInput["scope"],
  });
  if (result.status === "ingested") revalidatePath("/knowledge");
  return result;
}

/**
 * THE PROVIDER ADMISSION BOUNDARY (KID-2): one document in a connected provider becomes the same
 * provisional Knowledge facts a paste or an upload would.
 *
 * It is the SAME authority as the three actions above and deliberately not a new one. What it adds
 * is a third way for text to arrive — read from a provider Hebun is already connected to — and one
 * further act on the far side: the organization's declaration of which external record the admitted
 * facts concern, recorded through KR-EXT1's existing seam.
 *
 * TWO AUTHORIZATIONS MUST BOTH HOLD, AND NEITHER GRANTS THE OTHER. The durable Knowledge band is
 * resolved first, before any credential is spent; the provider content capability is resolved by
 * KID-1's own gate. A Knowledge author whose organization never granted the Drive content scope is
 * refused with the capability authority's own words, and a connected organization whose signed-in
 * person cannot author Knowledge never causes a provider call at all.
 *
 * WHAT THE CLIENT SUPPLIES: which document, and the Knowledge classification a human must choose
 * anyway. There is no tenant, actor, role, integration, credential, standing, digest, media type or
 * source-type field in this payload, and no provider text either — the content is read server-side
 * from the document the identifier names.
 *
 * ADMITTED IS NOT RATIFIED, and admitted is not synchronized. Every row lands `draft`/`provisional`
 * exactly as an authored fact does; nothing here reaches K4; and there is no schedule, no polling
 * and no folder walk behind it. Deleting the document at the provider does not retract what this
 * admitted — only the released Knowledge retraction authority can do that.
 */
export async function admitProviderDocumentAction(input: {
  fileId: string;
  sourceTitle: string;
  domainKey: string;
  scope: string;
}): Promise<AdmitProviderDocumentResult> {
  const tenant = await resolveTenantContext();
  const admission = await admitProviderDocument(tenant, {
    fileId: input?.fileId ?? "",
    sourceTitle: input?.sourceTitle ?? "",
    domainKey: input?.domainKey ?? "",
    scope: input?.scope as IngestKnowledgeInput["scope"],
  });
  if (admission.status === "admitted") revalidatePath("/knowledge");
  return admission;
}

/**
 * AUTHORIZE ONE GOOGLE PICKER SESSION — the least-privilege admission path's first step.
 *
 * It takes NO input at all. There is no capability, no scope, no integration id and no tenant to
 * supply: the tenant comes from the R1 session and the capability is a constant inside the seam. A
 * client cannot widen what comes back, and cannot ask for another organization's connection.
 *
 * WHAT IT RETURNS TO THE BROWSER, and why that is acceptable here: one short-lived Google ACCESS
 * token plus the Picker's two browser-safe configuration values. Never a refresh token, never the
 * client secret, never a credential or integration identifier. The token is released ONLY when the
 * per-file Drive permission is the one available, so it can reach only documents this human has
 * already handed to Hebun — which is precisely what the least-privilege adaptation bought.
 *
 * SELECTION IS NOT ADMISSION. This authorizes a chooser. It writes nothing, admits nothing, and
 * grants no Knowledge standing; admitting the chosen document is the separate act below, which
 * re-resolves every authority for itself.
 */
export async function authorizeGooglePickerSessionAction(): Promise<PickerSessionResult> {
  return authorizePickerSession(await resolveTenantContext());
}

/**
 * ADMIT ONE DOCUMENT THE HUMAN CHOSE IN THE GOOGLE PICKER.
 *
 * The same authority, the same file boundary, the same single Knowledge writer and the same
 * provisional standing as every other way text arrives. What differs is the Google permission the
 * read is performed under — the per-file grant rather than the Drive-wide one — and that difference
 * is fixed by WHICH FUNCTION THIS CALLS. It is not a field, so a client cannot ask for the document
 * to be read under the wider grant, and the provenance records the permission actually used.
 */
export async function admitPickedGoogleDocumentAction(input: {
  fileId: string;
  sourceTitle: string;
  domainKey: string;
  scope: string;
}): Promise<AdmitProviderDocumentResult> {
  const tenant = await resolveTenantContext();
  const admission = await admitPickedProviderDocument(tenant, {
    fileId: input?.fileId ?? "",
    sourceTitle: input?.sourceTitle ?? "",
    domainKey: input?.domainKey ?? "",
    scope: input?.scope as IngestKnowledgeInput["scope"],
  });
  if (admission.status === "admitted") revalidatePath("/knowledge");
  return admission;
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

/**
 * Withdraw every fact one ingestion source produced (R6D).
 *
 * The SAME authority that adds a source withdraws one — `retractKnowledgeSource` resolves the K2
 * write band server-side, so this action holds no gate of its own and cannot drift from the one
 * authoring and ingestion already use. The only client-shaped value is a content digest; the tenant,
 * actor and band are all resolved from the R1 session.
 *
 * Like every action in this file, it is unreachable from Heby: `askHebyAction` and
 * `runHebyReadCommandAction` do not import this module, so no message, model answer, slash command
 * or transcript has a representation in which it could arrive here.
 */
export async function retractKnowledgeSourceAction(input: {
  sourceDigest: string;
}): Promise<RetractionResult> {
  const tenant = await resolveTenantContext();
  const result = await retractKnowledgeSource(tenant, input);
  if (result.status === "retracted") revalidatePath("/knowledge");
  return result;
}

/*
 * ── KR-EXT1: THE EXTERNAL-SYSTEM REFERENCE BOUNDARY ─────────────────────────
 *
 * Three actions, all of them Knowledge acts. They record, read and withdraw the sentence "this
 * Knowledge fact concerns this external-system record" and do nothing else.
 *
 * NO PROVIDER IS CONTACTED by any of them — not to validate, not to check health, not to refresh a
 * credential. Recording a reference is an organizational declaration; the Director's decision on
 * that is explicit, and a firewall proves the authority behind these actions reaches no transport.
 *
 * The client supplies a Knowledge fact id and a CLOSED reference shape. It cannot supply a tenant,
 * an actor, a provider account, a credential, or a display name — no field exists for any of them,
 * and the tenant is resolved SERVER-SIDE from the R1 session exactly as every other Knowledge action
 * resolves it.
 */

export async function listKnowledgeExternalReferencesAction(input: {
  knowledgeFactId: string;
}): Promise<readonly RecordedExternalReference[]> {
  return listExternalReferences(await resolveTenantContext(), input.knowledgeFactId);
}

export async function attachKnowledgeExternalReferenceAction(input: {
  knowledgeFactId: string;
  reference: ExternalSystemReference;
}): Promise<AttachExternalReferenceResult> {
  return attachExternalReference(await resolveTenantContext(), {
    knowledgeFactId: input.knowledgeFactId,
    reference: input.reference,
  });
}

/**
 * Withdraw a declaration.
 *
 * It removes the ORGANIZATION'S STATEMENT and nothing in the world: no GitHub data is deleted, no
 * integration is disconnected, no provider lifecycle moves, no Knowledge is retracted and no
 * Governance decision changes. The record of the declaration and of its end both survive.
 */
export async function withdrawKnowledgeExternalReferenceAction(input: {
  referenceId: string;
}): Promise<WithdrawExternalReferenceResult> {
  return withdrawExternalReference(await resolveTenantContext(), { referenceId: input.referenceId });
}
