/*
 * Tenant-registry application service (server-only). The seam between the
 * request boundary and durable persistence: it takes an already-resolved,
 * server-side TenantContext (never a client-supplied tenant id), validates
 * input, and delegates to the durable repository.
 *
 * Provenance persisted for the slice: tenant (registries.tenant_id) + entity +
 * created/updated timestamps. Actor attribution and the operation log are NOT
 * durably persisted by the registries adapter today (in-memory history only) —
 * reported honestly as an R1 limitation rather than fabricated.
 */

import type { RegistryCrudRecord } from "@/features/registry-crud/types";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  getDurableRegistryRepository,
  type CreateRegistryInput,
  type DurableRegistryRepository,
} from "./durable-registry-repository.server";

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;

export interface TenantRegistryInput {
  readonly slug: string;
  readonly title: string;
  readonly description?: string;
  readonly owner?: string;
}

export class TenantRegistryValidationError extends Error {
  readonly code = "TENANT_REGISTRY_INVALID_INPUT";
  constructor(detail: string) {
    super(detail);
    this.name = "TenantRegistryValidationError";
  }
}

function scopeFrom(context: TenantContext): { tenantId: string; actorId: string } {
  return { tenantId: context.tenantId, actorId: context.userId };
}

function normalize(input: TenantRegistryInput): CreateRegistryInput {
  const slug = input.slug?.trim().toLowerCase();
  const title = input.title?.trim();
  if (!slug || !SLUG_PATTERN.test(slug)) {
    throw new TenantRegistryValidationError(
      "Registry slug must be lowercase alphanumeric with hyphens (1-63 chars).",
    );
  }
  if (!title) {
    throw new TenantRegistryValidationError("Registry title is required.");
  }
  return {
    slug,
    title,
    description: input.description?.trim() || title,
    owner: input.owner?.trim() || "Director",
  };
}

/** Create a tenant-owned registry record durably. */
export async function createTenantRegistry(
  context: TenantContext,
  input: TenantRegistryInput,
  repository: DurableRegistryRepository = getDurableRegistryRepository(),
): Promise<RegistryCrudRecord> {
  const normalized = normalize(input);
  return repository.create(scopeFrom(context), normalized);
}

/** List the tenant's registries durably. */
export async function listTenantRegistries(
  context: TenantContext,
  repository: DurableRegistryRepository = getDurableRegistryRepository(),
): Promise<RegistryCrudRecord[]> {
  return repository.list(scopeFrom(context));
}
