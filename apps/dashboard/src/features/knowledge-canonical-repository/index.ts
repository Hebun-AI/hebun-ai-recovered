/*
 * knowledge-canonical-repository — the DUAL-READ MIGRATION pair for Knowledge.
 *
 * READ THIS BEFORE READING THE `authoritative` FLAGS BELOW.
 *
 * This module is migration/diagnostics scaffolding. It pairs the legacy in-memory Knowledge store
 * (seeded from the mock registry in `knowledge-crud/node-adapter`) with the canonical Postgres read,
 * so the two can be compared while the migration is in flight. Its only consumer is
 * `canonical-read/diagnostics.ts`, surfaced on `/_internal/canonical-read` — a page gated behind
 * BOTH `NODE_ENV !== "production"` AND `HEBUN_ENABLE_CANONICAL_READ_DIAGNOSTICS=true`. It is not
 * reachable from any product surface, and it is NOT in Heby's answer path.
 *
 * `authoritative: true` on the memory repository is the READ ROUTER'S ROLE — the participant whose
 * result `routeKnowledgeRead` returns (it hardcodes `authoritativeProvider: "memory"` to match).
 * `authoritative: false` on the Postgres repository marks it the SHADOW participant, compared and
 * discarded. See the field's own documentation in `canonical-repository/types.ts`.
 *
 * NEITHER FLAG SAYS ANYTHING ABOUT ORGANIZATIONAL TRUTH. The seeded memory store owns no
 * organizational Knowledge whatsoever: it is derived from a mock registry and even synthesizes a
 * `confidence` figure from mock health. The authoritative Knowledge in Hebun is the canonical
 * persisted model — `public.knowledge_facts` → `public.knowledge_nodes` — read tenant-scoped by
 * `features/knowledge` (K1), which imports nothing from this module or from the seeded store.
 * `tests/k1-flow/authority-reconciliation.ts` pins that separation.
 */

import type { CanonicalReadServices } from "@/features/canonical-read";
import {
  createReadRepository,
  createShadowRepository,
  type CanonicalRepositoryDiagnosticsView,
  type ReadRepository,
  type ShadowRepository,
} from "@/features/canonical-repository";
import type { KnowledgeNodeRecord } from "@/features/knowledge-crud/types";
import type {
  KnowledgeReadNodeSummary,
  KnowledgeReadRequest,
  KnowledgeReadWarning,
} from "@/features/knowledge-read-facade/types";

function createWarning(
  code: KnowledgeReadWarning["code"],
  message: string,
): KnowledgeReadWarning {
  return { code, message };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuidLike(value: string): boolean {
  return UUID_RE.test(value);
}

function cloneTags(tags: readonly string[]): string[] {
  return [...tags];
}

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

function isTenantTag(tag: string): boolean {
  return normalizeTag(tag).startsWith("tenant:");
}

function memoryNodeTenantId(node: KnowledgeNodeRecord): string | undefined {
  const tag = node.tags.find((entry) => isTenantTag(entry));
  if (!tag) return undefined;
  const candidate = normalizeTag(tag).slice("tenant:".length).trim();
  return candidate || undefined;
}

function memoryNodeDomainKey(node: KnowledgeNodeRecord): string | undefined {
  const domainTag = node.tags.find((tag) => !isTenantTag(tag));
  return domainTag ? normalizeTag(domainTag) : undefined;
}

function memoryNodeScope(
  node: KnowledgeNodeRecord,
): "company-wide" | "department" | "domain" | undefined {
  if (node.ownerType === "organization") return "company-wide";
  if (node.ownerType === "department") return "department";
  return undefined;
}

function findMemoryNode(
  request: KnowledgeReadRequest,
  nodes: readonly KnowledgeNodeRecord[],
): {
  readonly node?: KnowledgeNodeRecord;
  readonly lookupKeyType?: "id" | "slug";
  readonly warnings: readonly KnowledgeReadWarning[];
} {
  const byId = nodes.find((node) => node.id === request.factKey);
  if (byId) {
    return { node: byId, lookupKeyType: "id", warnings: [] };
  }

  const bySlug = nodes.find((node) => node.slug === request.factKey);
  if (bySlug) {
    return {
      node: bySlug,
      lookupKeyType: "slug",
      warnings: [
        createWarning(
          "slug-match",
          "Memory knowledge facade matched the requested factKey against KnowledgeNodeRecord.slug.",
        ),
      ],
    };
  }

  return { warnings: [] };
}

function summarizeMemoryNode(params: {
  readonly request: KnowledgeReadRequest;
  readonly node: KnowledgeNodeRecord;
  readonly lookupKeyType: "id" | "slug";
}): {
  readonly node: KnowledgeReadNodeSummary;
  readonly warnings: readonly KnowledgeReadWarning[];
  readonly nonComparableFields: readonly string[];
} {
  const domainKey = memoryNodeDomainKey(params.node);
  const knowledgeScope = memoryNodeScope(params.node);
  const memoryTenantId = memoryNodeTenantId(params.node);
  const warnings: KnowledgeReadWarning[] = [];
  const nonComparableFields: string[] = [];

  if (!memoryTenantId) {
    warnings.push(
      createWarning(
        "memory-tenant-unavailable",
        "The current memory Knowledge shape does not consistently encode tenant identity, so tenant verification is partial.",
      ),
    );
    nonComparableFields.push("tenantId");
  }

  if (!domainKey) {
    warnings.push(
      createWarning(
        "memory-domain-unavailable",
        "The current memory Knowledge shape does not expose a stable domainKey for this node.",
      ),
    );
    nonComparableFields.push("domainKey");
  }

  if (!knowledgeScope) {
    warnings.push(
      createWarning(
        "memory-scope-unavailable",
        "The current memory Knowledge shape does not expose a stable knowledgeScope for this node.",
      ),
    );
    nonComparableFields.push("knowledgeScope");
  }

  return {
    node: {
      source: "memory",
      logicalIdentity: {
        tenantId: params.request.tenantId,
        factKey: params.request.factKey,
        domainKey,
        knowledgeScope,
        lookupKeyType: params.lookupKeyType,
        nodeId: params.node.id,
      },
      title: params.node.title,
      statementSummary: params.node.description,
      lifecycleStatus: params.node.lifecycleStatus,
      version: params.node.version,
      sourceMetadata: {
        source: params.node.source,
        tags: cloneTags(params.node.tags),
        createdAt: params.node.createdAt,
        updatedAt: params.node.updatedAt,
        createdBy: params.node.createdBy,
        updatedBy: params.node.updatedBy,
      },
      tenantBoundary: {
        requestedTenantId: params.request.tenantId,
        verification: memoryTenantId ? "verified" : "partial",
        memoryTenantId,
      },
    },
    warnings,
    nonComparableFields,
  };
}

export type KnowledgeRepositoryReadStatus =
  | "found"
  | "not-found"
  | "tenant-mismatch"
  | "invalid-input"
  | "unavailable";

export interface KnowledgeRepositoryReadResult {
  readonly status: KnowledgeRepositoryReadStatus;
  readonly node?: KnowledgeReadNodeSummary;
  readonly warnings: readonly KnowledgeReadWarning[];
  readonly nonComparableFields: readonly string[];
}

export interface CreateKnowledgeCanonicalRepositoryOptions {
  readonly memoryNodes: readonly KnowledgeNodeRecord[];
  readonly canonicalReadServices?: CanonicalReadServices;
}

function createMemoryKnowledgeRepository(
  memoryNodes: readonly KnowledgeNodeRecord[],
): ReadRepository<KnowledgeReadRequest, KnowledgeRepositoryReadResult> {
  return createReadRepository({
    descriptor: {
      repository: "knowledge",
      provider: "memory",
      capabilities: {
        read: true,
        write: false,
        shadow: false,
      },
      // Read-router role only: the participant whose result is returned during the dual read.
      // This store is SEEDED from a mock registry and owns no organizational Knowledge.
      authoritative: true,
    },
    findOne: async (request) => {
      if (!isUuidLike(request.tenantId) || !request.factKey.trim()) {
        return {
          status: "invalid-input",
          warnings: [
            createWarning(
              "memory-read-failed",
              "Knowledge read facade input is invalid.",
            ),
          ],
          nonComparableFields: [],
        };
      }

      const matched = findMemoryNode(request, memoryNodes);
      if (!matched.node || !matched.lookupKeyType) {
        return {
          status: "not-found",
          warnings: [],
          nonComparableFields: [],
        };
      }

      const memoryTenantId = memoryNodeTenantId(matched.node);
      if (
        memoryTenantId &&
        normalizeTag(memoryTenantId) !== normalizeTag(request.tenantId)
      ) {
        return {
          status: "tenant-mismatch",
          warnings: [],
          nonComparableFields: [],
        };
      }

      const domainKey = memoryNodeDomainKey(matched.node);
      if (
        request.domainKey &&
        domainKey &&
        normalizeTag(request.domainKey) !== domainKey
      ) {
        return {
          status: "not-found",
          warnings: [],
          nonComparableFields: [],
        };
      }

      const knowledgeScope = memoryNodeScope(matched.node);
      if (
        request.knowledgeScope &&
        knowledgeScope &&
        request.knowledgeScope !== knowledgeScope
      ) {
        return {
          status: "not-found",
          warnings: [],
          nonComparableFields: [],
        };
      }

      const summary = summarizeMemoryNode({
        request,
        node: matched.node,
        lookupKeyType: matched.lookupKeyType,
      });

      return {
        status: "found",
        node: summary.node,
        warnings: [...matched.warnings, ...summary.warnings],
        nonComparableFields: [...summary.nonComparableFields],
      };
    },
  });
}

function createPostgresKnowledgeShadowRepository(
  canonicalReadServices?: CanonicalReadServices,
): ShadowRepository<KnowledgeReadRequest, KnowledgeRepositoryReadResult> {
  return createShadowRepository({
    descriptor: {
      repository: "knowledge",
      provider: "postgres",
      capabilities: {
        read: true,
        write: false,
        shadow: true,
      },
      // Read-router role only: the SHADOW participant, compared and discarded. Postgres remains
      // the persistent system of record for Knowledge regardless of this flag.
      authoritative: false,
    },
    isAvailable: async () => {
      if (!canonicalReadServices) return false;
      const availability = await canonicalReadServices.availability();
      return availability.available;
    },
    findShadow: async (request) => {
      if (!canonicalReadServices) {
        return {
          status: "unavailable",
          warnings: [],
          nonComparableFields: [],
        };
      }

      const result = await canonicalReadServices.selectCanonicalKnowledgeFact({
        tenantId: request.tenantId,
        factKey: request.factKey,
        domainKey: request.domainKey ?? "",
        knowledgeScope: request.knowledgeScope ?? "company-wide",
      });

      if (result.status === "tenant-mismatch") {
        return {
          status: "tenant-mismatch",
          warnings: [],
          nonComparableFields: [],
        };
      }

      if (result.status === "not-found") {
        return {
          status: "not-found",
          warnings: [],
          nonComparableFields: [],
        };
      }

      if (result.status === "unavailable") {
        return {
          status: "unavailable",
          warnings: [],
          nonComparableFields: [],
        };
      }

      if (!result.activeNode) {
        return {
          status: "not-found",
          warnings: [],
          nonComparableFields: [],
        };
      }

      return {
        status: "found",
        node: {
          source: "memory",
          logicalIdentity: {
            tenantId: result.identity.tenantId,
            factKey: result.identity.factKey,
            domainKey: result.identity.domainKey,
            knowledgeScope: result.identity.knowledgeScope,
            lookupKeyType: "id",
            nodeId: result.activeNode.refId ?? result.activeNode.id,
          },
          title: result.activeNode.label,
          statementSummary: result.activeNode.statement ?? "",
          lifecycleStatus: result.activeNode.lifecycleStatus ?? "active",
          version: String(result.activeNode.knowledgeVersion),
          sourceMetadata: {
            source: "canonical-postgres",
            tags: [],
            createdAt: "",
            updatedAt: "",
            createdBy: "",
            updatedBy: "",
          },
          tenantBoundary: {
            requestedTenantId: request.tenantId,
            verification: "verified",
            memoryTenantId: result.identity.tenantId,
          },
        },
        warnings: [],
        nonComparableFields: [],
      };
    },
  });
}

export function createKnowledgeCanonicalRepository(
  options: CreateKnowledgeCanonicalRepositoryOptions,
): {
  readonly authoritative: ReadRepository<
    KnowledgeReadRequest,
    KnowledgeRepositoryReadResult
  >;
  readonly shadow: ShadowRepository<
    KnowledgeReadRequest,
    KnowledgeRepositoryReadResult
  >;
} {
  return {
    authoritative: createMemoryKnowledgeRepository(options.memoryNodes),
    shadow: createPostgresKnowledgeShadowRepository(
      options.canonicalReadServices,
    ),
  };
}

export async function describeKnowledgeCanonicalRepository(
  options: CreateKnowledgeCanonicalRepositoryOptions,
): Promise<CanonicalRepositoryDiagnosticsView> {
  const repositories = createKnowledgeCanonicalRepository(options);

  return {
    repository: repositories.authoritative.descriptor.repository,
    authoritativeProvider: repositories.authoritative.descriptor.provider,
    authoritativeCapabilities:
      repositories.authoritative.descriptor.capabilities,
    shadowProvider: repositories.shadow.descriptor.provider,
    shadowCapabilities: repositories.shadow.descriptor.capabilities,
    readSource: repositories.authoritative.descriptor.provider,
    shadowAvailable: await repositories.shadow.isAvailable(),
  };
}
