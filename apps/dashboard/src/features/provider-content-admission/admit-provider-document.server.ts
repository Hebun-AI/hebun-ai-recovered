/*
 * provider-content-admission/admit-provider-document.server.ts — THE BRIDGE (KID-2).
 *
 * ── THE ONE SENTENCE THIS FILE EXISTS TO KEEP TRUE ───────────────────────────
 *
 *   A PERMITTED HUMAN ADMITS ONE PROVIDER DOCUMENT THROUGH THE AUTHORITIES THAT ALREADY EXIST.
 *
 * It is an ORCHESTRATION, not an authority. Every decision it needs was already decided by a
 * released module, and it owns none of them:
 *
 *   who may admit          `resolveKnowledgeWriteAuthority`      (K2's band, unchanged)
 *   may this be read       `getCapabilityAvailability`           (via KID-1's own gate)
 *   is it readable at all  `GOOGLE_DRIVE_READABLE_TYPES`         (KID-1's closed map)
 *   what it becomes        `adaptProviderContent`                (KID-2's closed map, pure)
 *   is it admissible       `ingestKnowledgeFile`                 (R4C.1's bounds and decoder)
 *   what it becomes then   `ingestKnowledgeSource`               (the ONE Knowledge writer)
 *   what it is about       `attachExternalReference`             (KR-EXT1, human-declared)
 *
 * There is NO second ingestion writer here, no direct persistence call, no transaction, no schema,
 * no migration and no new authorization model. This module contains no `insert`, no `update`, no
 * `delete` and no database handle.
 *
 *     PROVIDER READ != KNOWLEDGE          READ CONTENT != ADMITTED CONTENT
 *     ADMISSION != RATIFICATION           PROVISIONAL != AUTHORITATIVE
 *     INGESTED != CORRECT                 CONTENT != INSTRUCTION
 *
 * ── WHY IT LIVES HERE AND NOT UNDER `src/features/knowledge` ────────────────
 *
 * I1's released firewall collects every file under `src/features/knowledge` and asserts none of
 * them references `integration-authority` or `provider-catalog`: "Governance and Knowledge must not
 * own, read or write tenant connections." Reading provider content requires exactly that, so a
 * Knowledge-side bridge is forbidden — the same reason `discover-drive-sources.server.ts` lives on
 * the provider side. This module is the composition point between the two, and it derives neither
 * from the other: it ASKS the provider, and it ASKS Knowledge.
 *
 * ── THE GATE ORDER, AND WHY AUTHORIZATION COMES BEFORE THE PROVIDER ─────────
 *
 *   1. AUTHENTICATED?      a server-resolved TenantContext must exist
 *   2. KNOWLEDGE-AUTHORIZED? the durable role band must permit authoring Knowledge
 *   3. PROVIDER-AUTHORIZED?  the content capability must be available to this tenant
 *   4. only then is a credential spent and a document read
 *
 * This is R4C.1's order and its reason: an unauthorized caller must not be able to use the refusals
 * as an oracle for what Hebun holds. Here it buys something further — a caller who may not author
 * Knowledge never causes a Google credential to be spent, and never learns which documents exist or
 * whether this organization granted the content scope. The delegate re-checks the band for itself;
 * that is deliberate, exactly as the file boundary re-checks it. A door is not a reason to unlock
 * the room behind it.
 *
 *     PROVIDER READ AUTHORIZED  AND  KNOWLEDGE ADMISSION AUTHORIZED
 *     Neither grants the other, and this module never derives one from the other.
 *
 * ── PARTIAL FAILURE: TWO AUTHORITIES, ONE OPERATION, NO SHARED TRANSACTION ──
 *
 * Admission and provenance CANNOT commit together, and that is a fact about the released seams
 * rather than a preference. `ingestKnowledgeSource` opens and owns its own transaction and takes no
 * outer one; `attachExternalReference` accepts no transaction parameter at all. Inventing a shared
 * one would mean giving one authority a handle into the other's write — precisely the cross-
 * authority ownership this repository refuses — and simulating a rollback by deleting admitted
 * Knowledge is worse still: nothing here holds retraction authority, and Knowledge is never deleted.
 *
 * So the truth is reported instead of being smoothed over:
 *
 *   ADMITTED, PROVENANCE COMPLETE     every fact this source produced carries the declaration.
 *   ADMITTED, PROVENANCE INCOMPLETE   the Knowledge is real, provisional and readable; some or all
 *                                     declarations are ABSENT, and the count says how many.
 *
 * IT IS RECOVERABLE BY REPEATING THE OPERATION. The whole call is idempotent: a second admission of
 * the same document under the same classification is refused by the EXISTING duplicate rule — no
 * Knowledge is written twice — and the declarations are then completed for the facts that lack
 * them, because `attachExternalReference` targets a partial unique index and does nothing when the
 * association already stands. Nothing is invented on that path: the fact keys are derived with the
 * ingestion path's OWN exported identity function, and a key that does not resolve to a row is
 * reported as unresolved rather than attached to something else.
 *
 * ── WHAT IT REFUSES TO DO ────────────────────────────────────────────────────
 *
 * It ratifies nothing — K4 is unreachable from here. It synchronizes nothing: there is no schedule,
 * no interval, no polling, no folder walk and no second document. A deletion in the provider does
 * NOT retract admitted Knowledge, and this module holds no retraction authority to make it. The
 * document's text is DATA: it is never a prompt, never an instruction, never a tool call, and
 * nothing in this file inspects it for meaning.
 *
 * Server-only.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import type {
  GoogleDriveContentKind,
  GoogleFailureClass,
} from "@/features/provider-google/contracts";
import {
  GOOGLE_DRIVE_CONTENT_CAPABILITY,
  GOOGLE_PROVIDER_KEY,
} from "@/features/provider-google/contracts";
import {
  readDriveContent,
  type DriveContentDeps,
  type DriveContentRefusal,
} from "@/features/provider-google/read-drive-content.server";
import {
  ingestKnowledgeFile,
  type KnowledgeFileIngestDeps,
} from "@/features/knowledge/knowledge-file-ingest.server";
import {
  resolveKnowledgeWriteAuthority,
  type KnowledgeWriteAuthority,
} from "@/features/knowledge/knowledge-write-authority.server";
import {
  readKnowledgeSourceByName,
  type KnowledgeReadDeps,
} from "@/features/knowledge/knowledge-read.server";
import {
  attachExternalReference,
  type ExternalReferenceDeps,
} from "@/features/knowledge/external-reference-authority.server";
import type { ExternalSystemReference } from "@/features/knowledge/external-reference-contracts";
import { chunkFactKey, type IngestionProblem } from "@/features/knowledge/ingestion-contracts";
import { sourceTitleFromFileName } from "@/features/knowledge/file-ingestion-contracts";
import type { FileIngestionProblem } from "@/features/knowledge/file-ingestion-contracts";
import type { KnowledgeScope } from "@/features/knowledge/contracts";
import { adaptProviderContent, type ProviderContentRefusal } from "./content-adapter";

/**
 * WHAT KIND OF EXTERNAL RECORD AN ADMITTED PROVIDER DOCUMENT IS.
 *
 * One value, and it names the thing itself rather than the provider's product. It is NOT added to
 * `EXTERNAL_RECORD_KINDS`, which is the closed menu a human picks from when declaring a reference by
 * hand — that is a different capability, and this reference is never typed by a person.
 */
export const PROVIDER_DOCUMENT_RECORD_TYPE = "document" as const;

/**
 * The reference an admitted provider document carries — FOUR FIELDS, DERIVED, and no fifth.
 *
 * `providerKey` and `capability` are the released constants themselves, so a rename cannot leave a
 * stale spelling here. `recordId` is the provider's own stable identifier. There is deliberately no
 * document name, no URL, no export link, no MIME type, no owner, no token and no credential: a
 * display name follows a rename and an identity must not, and everything else is provider STATE
 * that Hebun does not own and this table does not describe.
 */
export function providerDocumentReference(fileId: string): ExternalSystemReference {
  return Object.freeze({
    providerKey: GOOGLE_PROVIDER_KEY,
    capability: GOOGLE_DRIVE_CONTENT_CAPABILITY,
    recordType: PROVIDER_DOCUMENT_RECORD_TYPE,
    recordId: fileId,
  });
}

/** What the human supplies. Note what is absent BY TYPE: no tenant, integration or credential. */
export interface AdmitProviderDocumentInput {
  /** WHICH document. The provider's own identifier, chosen from what discovery listed. */
  readonly fileId: string;
  /** The human's Knowledge classification. Never inferred from a folder, name or contents. */
  readonly sourceTitle: string;
  readonly domainKey: string;
  readonly scope: KnowledgeScope;
}

/** What was admitted, as a reader sees it. Identity and measurements only — never the text back. */
export interface AdmittedProviderDocument {
  readonly fileId: string;
  /** The provider's name for it, reported as an observation. Never used as an identity. */
  readonly providerName: string;
  readonly contentKind: GoogleDriveContentKind;
  readonly byteLength: number;
  /** The ingestion path's own content identity, and the handle its withdrawal takes. */
  readonly sourceDigest: string;
  readonly chunkCount: number;
}

/**
 * WHETHER THE ORGANIZATION'S DECLARATION ACTUALLY STANDS, PER FACT, WITH COUNTS.
 *
 * `complete` is a computed property of the two numbers, not a separate claim: it is true only when
 * every fact the source produced carries the declaration. A surface that renders "imported" without
 * reading it would be saying something this module did not measure.
 */
export interface ProviderProvenanceReport {
  readonly reference: ExternalSystemReference;
  /** How many Knowledge facts this source stands as. */
  readonly factCount: number;
  /** How many of them now carry the declaration — including ones that already carried it. */
  readonly declared: number;
  /** Fact identities that could not be resolved to a row in this tenant. */
  readonly unresolved: number;
  /** Distinct refusal reasons from the reference authority, in its own vocabulary. */
  readonly refusals: readonly string[];
  readonly complete: boolean;
}

/**
 * Every way this operation can end. They are kept apart because a person acts differently on each,
 * and collapsing them into "import failed" would hide which authority said no.
 */
export type AdmitProviderDocumentResult =
  /** Nothing was read, nothing was consulted, no credential was spent. */
  | { readonly status: "not-authenticated" }
  /** Signed in; the durable role band does not permit authoring Knowledge. No provider was called. */
  | { readonly status: "knowledge-not-authorized"; readonly roleType: string | null }
  /** The organization has not granted Hebun the content scope, or the connection cannot answer. */
  | { readonly status: "provider-capability-unavailable"; readonly detail: string }
  /** The provider seam refused for a reason of its own. */
  | {
      readonly status: "provider-refused";
      readonly reason: DriveContentRefusal;
      readonly detail: string;
    }
  /** Google was asked and did not answer usefully. Nothing is known about the document. */
  | {
      readonly status: "provider-read-failed";
      readonly failure: GoogleFailureClass;
      readonly detail: string;
    }
  /** Read successfully; Hebun does not admit this kind of content, or could not name it. */
  | {
      readonly status: "document-not-admissible";
      readonly reason: ProviderContentRefusal;
      readonly detail: string;
    }
  /** The Knowledge file boundary refused the document itself — size, encoding, name. */
  | { readonly status: "content-refused"; readonly problems: readonly FileIngestionProblem[] }
  /** The Knowledge validator refused the human's classification or the text's shape. */
  | { readonly status: "classification-refused"; readonly problems: readonly IngestionProblem[] }
  | { readonly status: "admission-unavailable"; readonly detail: string }
  | { readonly status: "admission-failed"; readonly detail: string }
  /** Admitted now. Standing is `draft`/`provisional`, decided by the writer and not by this module. */
  | {
      readonly status: "admitted";
      readonly document: AdmittedProviderDocument;
      readonly provenance: ProviderProvenanceReport;
    }
  /**
   * This exact content is ALREADY admitted under this classification, so nothing was written. The
   * provenance report is still measured, and completing a declaration that was missing is the
   * recovery path — see the module header.
   */
  | {
      readonly status: "already-admitted";
      readonly document: AdmittedProviderDocument;
      readonly provenance: ProviderProvenanceReport;
    };

export interface AdmitProviderDocumentDeps {
  /** Passed to KID-1's content seam unchanged. */
  readonly provider?: DriveContentDeps;
  /** Passed to the released Knowledge file boundary unchanged. */
  readonly knowledge?: KnowledgeFileIngestDeps;
  /** Passed to the released reference authority unchanged. */
  readonly reference?: ExternalReferenceDeps;
  /** Passed to the released Knowledge read unchanged. */
  readonly read?: KnowledgeReadDeps;
  /** The band resolver, so the gate order is provable without a role row. */
  readonly resolveAuthority?: (tenant: TenantContext) => Promise<KnowledgeWriteAuthority>;
  /* ── Seams for the three released authorities, so the bridge is provable with no database. ── */
  readonly readContent?: typeof readDriveContent;
  readonly ingest?: typeof ingestKnowledgeFile;
  readonly resolveFact?: typeof readKnowledgeSourceByName;
  readonly attach?: typeof attachExternalReference;
}

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Provider content admission is server-only.");
  }
}

/**
 * Resolve one fact identity to the row it names IN THIS DOMAIN AND SCOPE, or null.
 *
 * The released read answers by fact key across the whole tenant and reports an ambiguity rather
 * than picking one. The classification is part of what makes this source THIS source, so the match
 * is narrowed here by both — a same-named fact filed elsewhere is not this one, and attaching to it
 * would be a false declaration made silently.
 */
async function resolveFactId(
  tenant: TenantContext,
  factKey: string,
  input: AdmitProviderDocumentInput,
  deps: AdmitProviderDocumentDeps,
): Promise<string | null> {
  const found = await (deps.resolveFact ?? readKnowledgeSourceByName)(
    tenant,
    factKey,
    deps.read ?? {},
  );
  const candidates =
    found.status === "found"
      ? [found.record]
      : found.status === "ambiguous"
        ? found.candidates
        : [];
  const match = candidates.find(
    (record) => record.domainKey === input.domainKey && record.scope === input.scope,
  );
  return match?.factId ?? null;
}

/**
 * DECLARE, for every fact this source stands as, that it concerns the provider document.
 *
 * Every fact, not one of them: a chunk of the document is still the document, and a reference on
 * only the first would leave a provenance trace that dead-ends on every other record the same
 * import produced. The loop is bounded by `MAX_CHUNKS_PER_SOURCE`, which the ingestion validator
 * already enforces, so no bound is invented here.
 *
 * `already-declared` COUNTS AS DECLARED. It is the authority's answer that this exact association
 * is already live, which is the state being asked for — treating it as a failure would make a
 * retry report worse the more of it had succeeded.
 */
async function declareProvenance(
  tenant: TenantContext,
  factKeys: readonly string[],
  input: AdmitProviderDocumentInput,
  reference: ExternalSystemReference,
  deps: AdmitProviderDocumentDeps,
): Promise<ProviderProvenanceReport> {
  let declared = 0;
  let unresolved = 0;
  const refusals = new Set<string>();

  for (const factKey of factKeys) {
    const factId = await resolveFactId(tenant, factKey, input, deps);
    if (!factId) {
      unresolved += 1;
      continue;
    }
    const attached = await (deps.attach ?? attachExternalReference)(
      tenant,
      { knowledgeFactId: factId, reference },
      deps.reference ?? {},
    );
    if (attached.status === "declared" || attached.reason === "already-declared") {
      declared += 1;
      continue;
    }
    refusals.add(attached.reason);
  }

  return {
    reference,
    factCount: factKeys.length,
    declared,
    unresolved,
    refusals: Object.freeze([...refusals].sort()),
    complete: declared === factKeys.length,
  };
}

/**
 * Admit ONE selected provider document into the organization's existing Knowledge authority.
 *
 * The tenant comes from an already-resolved server-side context. There is no parameter for a tenant
 * id, an integration id or a credential id: the connection is DISCOVERED from the tenant's own
 * availability view inside KID-1's seam, so naming another organization's connection is not refused
 * here — it is unrepresentable.
 *
 * One document. There is no array, no folder, no recursion and no second call.
 */
export async function admitProviderDocument(
  tenant: TenantContext | null,
  input: AdmitProviderDocumentInput,
  deps: AdmitProviderDocumentDeps = {},
): Promise<AdmitProviderDocumentResult> {
  assertServerOnly();

  /* 1 · AUTHENTICATED — before any authority is consulted. */
  if (!tenant?.tenantId || !tenant.userId) return { status: "not-authenticated" };

  /*
   * 2 · KNOWLEDGE-AUTHORIZED — before a credential is spent, and before the provider is asked
   * anything at all. See the header: this is R4C.1's order, and here it also means an unauthorized
   * caller cannot learn what this organization connected or what is inside it.
   */
  const authority = await (deps.resolveAuthority ?? resolveKnowledgeWriteAuthority)(tenant);
  if (!authority.authorized) {
    return { status: "knowledge-not-authorized", roleType: authority.roleType };
  }

  /* 3 · PROVIDER-AUTHORIZED, AND READ — KID-1's seam owns both, and this module adds neither. */
  const content = await (deps.readContent ?? readDriveContent)(
    tenant,
    { fileId: input?.fileId ?? "" },
    deps.provider ?? {},
  );
  if (content.status === "refused") {
    return content.reason === "capability-not-available"
      ? { status: "provider-capability-unavailable", detail: content.detail }
      : { status: "provider-refused", reason: content.reason, detail: content.detail };
  }
  if (content.status === "provider-failed") {
    return { status: "provider-read-failed", failure: content.failure, detail: content.reason };
  }

  /* 4 · REPRESENT IT — the closed allowlist, and nothing the provider said about itself. */
  const adapted = adaptProviderContent(content.content);
  if (!adapted.ok) {
    return { status: "document-not-admissible", reason: adapted.reason, detail: adapted.detail };
  }

  /*
   * 5 · THE EXISTING KNOWLEDGE DOOR. From here nothing is KID-2's: the bounds, the strict decoder,
   * the derived source type, the validator, the chunker, the digest, the duplicate rule, the
   * transaction, the audit row and the `draft`/`provisional` standing are all the released path's.
   * The human's classification travels as the human supplied it — no folder, file name or sentence
   * of the document's text influences it.
   */
  const admitted = await (deps.ingest ?? ingestKnowledgeFile)(
    tenant,
    {
      file: adapted.file,
      sourceTitle: input?.sourceTitle ?? "",
      domainKey: input?.domainKey ?? "",
      scope: input.scope,
    },
    deps.knowledge ?? {},
  );

  if (admitted.status === "file-rejected") {
    return { status: "content-refused", problems: admitted.problems };
  }
  if (admitted.status === "unauthorized") {
    /* Unreachable through gate 1, and reported honestly rather than assumed away. */
    return { status: "not-authenticated" };
  }
  if (admitted.status === "forbidden") {
    return { status: "knowledge-not-authorized", roleType: admitted.roleType };
  }
  if (admitted.status === "invalid") {
    return { status: "classification-refused", problems: admitted.problems };
  }
  if (admitted.status === "unavailable") {
    return {
      status: "admission-unavailable",
      detail: "Durable Knowledge persistence is not configured, so nothing was admitted.",
    };
  }
  if (admitted.status === "failed") {
    return { status: "admission-failed", detail: admitted.detail };
  }

  /*
   * 6 · PROVENANCE, THROUGH THE EXISTING AUTHORITY. It cannot join the admission's transaction —
   * see the header — so the report below is measured rather than assumed, and both statuses carry
   * it so no surface can say "imported" without reading whether the declaration stands.
   */
  const reference = providerDocumentReference(content.content.fileId);

  if (admitted.status === "duplicate-ingestion") {
    /*
     * NOTHING WAS WRITTEN, by the existing duplicate rule. The fact identities are DERIVED with the
     * ingestion path's own exported function from the digest it just reported and the title it
     * would have used — the same two inputs it derives them from itself. A derivation that is ever
     * wrong resolves to no row and is counted as unresolved; it can never attach to another fact.
     */
    const chosenTitle = input?.sourceTitle?.trim() ?? "";
    const resolvedTitle =
      chosenTitle.length > 0 ? chosenTitle : sourceTitleFromFileName(adapted.file.name);
    const factKeys = Array.from({ length: admitted.chunkCount }, (_unused, index) =>
      chunkFactKey(resolvedTitle, admitted.sourceDigest, index),
    );
    return {
      status: "already-admitted",
      document: {
        fileId: content.content.fileId,
        providerName: content.content.name,
        contentKind: content.content.contentKind,
        byteLength: content.content.byteLength,
        sourceDigest: admitted.sourceDigest,
        chunkCount: admitted.chunkCount,
      },
      provenance: await declareProvenance(tenant, factKeys, input, reference, deps),
    };
  }

  return {
    status: "admitted",
    document: {
      fileId: content.content.fileId,
      providerName: content.content.name,
      contentKind: content.content.contentKind,
      byteLength: content.content.byteLength,
      sourceDigest: admitted.source.sourceDigest,
      chunkCount: admitted.source.chunkCount,
    },
    provenance: await declareProvenance(
      tenant,
      admitted.source.factKeys,
      input,
      reference,
      deps,
    ),
  };
}
