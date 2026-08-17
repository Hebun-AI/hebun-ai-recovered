/*
 * knowledge/knowledge-ingest.server.ts — the ingestion orchestration.
 *
 * ── IT IS A PRODUCER, NOT AN AUTHORITY ───────────────────────────────────────
 *
 * Every gate this module passes through already existed. It resolves the SAME write authority K2
 * resolves, writes through the SAME durable writer K2 writes through, and its history lands in the
 * SAME G1 audit sink inside the SAME transaction. It adds one thing: a human's paste becomes N facts
 * instead of one, and those N commit together.
 *
 * The gate order is K2's, and for K2's reason — authorization before validation, so an unauthorized
 * caller cannot use validation responses as an oracle for what the schema accepts:
 *
 *   1. AUTHENTICATED?  a server-resolved TenantContext must exist
 *   2. AUTHORIZED?     the durable role band must permit authoring Knowledge
 *   3. CONFIGURED?     durable persistence must exist
 *   4. VALID?          the source must survive normalization and validation
 *   5. UNCLAIMED?      no chunk identity may already exist
 *   6. only then is anything written, and only inside the actor's own tenant
 *
 * ── WHAT IT DOES NOT DO ──────────────────────────────────────────────────────
 *
 * It does not ratify. The writer records `draft` / `provisional` and there is no path from here to
 * K4. It does not supersede: an ingestion never edits or replaces an earlier one, because a changed
 * source is a different source and gets its own identity. It calls no model, reads no file, opens no
 * socket, and imports no provider, execution or embedding module.
 *
 * Server-only.
 */

import { and, eq, inArray } from "drizzle-orm";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { getControlPlaneDb } from "@/db/client.server";
/* Read-only here: the preflight looks, and every WRITE goes through the one durable writer below. */
import { knowledgeFacts } from "@/db/schema/knowledge-fact";
import {
  resolveKnowledgeWriteAuthority,
  type KnowledgeWriteAuthority,
} from "./knowledge-write-authority.server";
import {
  createDurableKnowledgeWriter,
  type DurableKnowledgeWriter,
  type KnowledgeWriteTransaction,
} from "./durable-knowledge-writer.server";
import {
  chunkFactKey,
  chunkSource,
  chunkTitle,
  digestSource,
  normalizeSourceText,
  validateIngestion,
  type IngestKnowledgeInput,
  type IngestionProblem,
} from "./ingestion-contracts";

export interface KnowledgeIngestDeps {
  readonly resolveAuthority?: (tenant: TenantContext) => Promise<KnowledgeWriteAuthority>;
  /** The control-plane database. Null when persistence is not configured. */
  readonly getDb?: () => ReturnType<typeof getControlPlaneDb> | null;
  /** Injected clock, so provenance timestamps are deterministic in tests. */
  readonly now?: () => Date;
  /**
   * Test-only seam: runs after the chunk that matches this index has been written, inside the
   * parent transaction. It exists so the all-or-none guarantee can be PROVEN by failing midway
   * rather than asserted. Production never supplies it.
   */
  readonly failAfterChunk?: number;
}

/** What one ingestion produced. Ids only — never the human's text back again. */
export interface IngestedSource {
  readonly sourceDigest: string;
  readonly chunkCount: number;
  readonly factKeys: readonly string[];
}

export type IngestKnowledgeResult =
  | { readonly status: "ingested"; readonly source: IngestedSource }
  /** Not signed in. Nothing was read, validated, or written. */
  | { readonly status: "unauthorized" }
  /** Signed in, but the durable role band does not permit authoring Knowledge. */
  | { readonly status: "forbidden"; readonly roleType: string | null }
  | { readonly status: "invalid"; readonly problems: readonly IngestionProblem[] }
  /**
   * This exact source is already ingested in this tenant, under this domain and scope. Nothing was
   * written. `alreadyPresent` reports how many of its chunk identities were found — a full match is
   * an honest repeat; a partial match is the inconsistent state described below.
   */
  | {
      readonly status: "duplicate-ingestion";
      readonly sourceDigest: string;
      readonly chunkCount: number;
      readonly alreadyPresent: number;
    }
  | { readonly status: "unavailable"; readonly reason: "persistence-not-configured" }
  | { readonly status: "failed"; readonly detail: string };

/** Thrown inside the parent transaction to roll every chunk back. Never escapes this module. */
class IngestionAborted extends Error {
  constructor(readonly detail: string) {
    super(detail);
  }
}

/**
 * Ingest ONE plain-text source into canonical Knowledge as N provisional facts.
 *
 * All N chunks and all N audit rows commit together, or none of them do.
 */
export async function ingestKnowledgeSource(
  tenant: TenantContext | null,
  input: IngestKnowledgeInput,
  deps: KnowledgeIngestDeps = {},
): Promise<IngestKnowledgeResult> {
  if (typeof window !== "undefined") {
    throw new Error("Knowledge ingestion is server-only.");
  }

  /* 1. AUTHENTICATED */
  if (!tenant?.tenantId || !tenant.userId) return { status: "unauthorized" };

  /* 2. AUTHORIZED — the same durable role band K2 requires, resolved the same way. */
  const authority = await (deps.resolveAuthority ?? resolveKnowledgeWriteAuthority)(tenant);
  if (!authority.authorized) {
    return { status: "forbidden", roleType: authority.roleType };
  }

  /* 3. CONFIGURED */
  let db: ReturnType<typeof getControlPlaneDb> | null = null;
  try {
    db = (deps.getDb ?? (() => getControlPlaneDb()))();
  } catch {
    db = null;
  }
  if (!db) return { status: "unavailable", reason: "persistence-not-configured" };

  /* 4. VALID — normalization first, so emptiness is judged on what would actually be stored. */
  const normalized = normalizeSourceText(input.sourceText ?? "");
  const chunks = chunkSource(normalized);
  const problems = validateIngestion(input, normalized, chunks.length);
  if (problems.length > 0) return { status: "invalid", problems };

  const now = (deps.now ?? (() => new Date()))();
  const sourceTitle = input.sourceTitle.trim();
  const sourceDigest = digestSource(normalized);
  const factKeys = chunks.map((chunk) => chunkFactKey(sourceTitle, sourceDigest, chunk.index));

  const writer: DurableKnowledgeWriter = createDurableKnowledgeWriter(db);

  /*
   * 5. UNCLAIMED — the duplicate preflight.
   *
   * The identity carries the content digest, so a match here means THIS EXACT SOURCE is already
   * ingested under this domain and scope. A PARTIAL match is not repaired: an ingestion that
   * previously committed some chunks and not others is an inconsistent state this module did not
   * create and will not paper over by filling the gaps. Both cases refuse, and the count says which
   * one it was.
   */
  try {
    const claimed = await db
      .select({ id: knowledgeFacts.id })
      .from(knowledgeFacts)
      .where(
        and(
          eq(knowledgeFacts.tenantId, tenant.tenantId),
          eq(knowledgeFacts.domainKey, input.domainKey),
          eq(knowledgeFacts.knowledgeScope, input.scope),
          inArray(knowledgeFacts.factKey, factKeys),
        ),
      );
    const present = claimed.length;
    if (present > 0) {
      return {
        status: "duplicate-ingestion",
        sourceDigest,
        chunkCount: chunks.length,
        alreadyPresent: present,
      };
    }
  } catch (error) {
    return {
      status: "failed",
      detail: error instanceof Error ? error.message : "Ingestion preflight failed.",
    };
  }

  /* 6. WRITE — one transaction for every chunk and every audit row. */
  try {
    await db.transaction(async (tx) => {
      for (const chunk of chunks) {
        const result = await writer.createFact(
          {
            tenantId: tenant.tenantId,
            userId: tenant.userId,
            sessionContextId: tenant.sessionContextId,
          },
          {
            factKey: factKeys[chunk.index]!,
            domainKey: input.domainKey,
            scope: input.scope,
            title: chunkTitle(sourceTitle, chunk.index, chunks.length),
            statement: chunk.text,
            /*
             * Ingestion provenance, carried in the column that already means "how did this text get
             * here". Nothing is claimed that Hebun cannot know: it records that an authenticated
             * human pasted this text, and — exactly as K2 does — does not assert the words are
             * theirs rather than something a model produced.
             */
            ingestion: {
              sourceTitle,
              /*
               * What the source WAS, from the closed vocabulary. It arrives already derived — the
               * caller that sets it derived it from an extension IT validated — and defaults to
               * `plain-text`, which is what pasted text has always been. Nothing here infers a type
               * from the text itself, and no client input reaches this field.
               */
              sourceType: input.sourceType ?? "plain-text",
              sourceDigest,
              chunkIndex: chunk.index,
              chunkCount: chunks.length,
            },
          },
          now,
          tx as KnowledgeWriteTransaction,
        );

        if (result.status !== "created") {
          throw new IngestionAborted(
            `Chunk ${chunk.index + 1} of ${chunks.length} could not be written (${result.status}).`,
          );
        }

        /* Test-only: prove the rollback rather than assert it. */
        if (deps.failAfterChunk === chunk.index) {
          throw new IngestionAborted(`Injected failure after chunk ${chunk.index}.`);
        }
      }
    });
  } catch (error) {
    return {
      status: "failed",
      detail:
        error instanceof IngestionAborted
          ? error.detail
          : error instanceof Error
            ? error.message
            : "Ingestion failed.",
    };
  }

  return {
    status: "ingested",
    source: { sourceDigest, chunkCount: chunks.length, factKeys },
  };
}
