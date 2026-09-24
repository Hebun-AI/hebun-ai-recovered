/*
 * provider-instagram/resolve-publish-capability.server.ts — gather the facts, let the pure verdict
 * decide (PUBLISH-0).
 *
 * The tenant comes from the caller's authenticated context and nowhere else. Connection facts come
 * from the integration authority's own listing; declaration comes from the provider catalog; the
 * publishing identity comes from Meta at `/me`, read with the connection's own credential, and only
 * after the connection side has already said it could publish — so a connection without the
 * publishing grant never has its credential opened here.
 *
 * READ-ONLY. It performs one GET at most and writes nothing. It is not an authorization.
 *
 * Server-only.
 */
import type { ControlPlaneDatabase } from "@/db/client.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { listConnections } from "@/features/integration-authority/integration-read.server";
import type { ProviderCatalog } from "@/features/integration-authority/contracts";
import { PROVIDER_CATALOG, findProviderDefinition } from "@/features/provider-catalog/catalog";
import { INSTAGRAM_MEDIA_PUBLISH_CAPABILITY, INSTAGRAM_PROVIDER_KEY } from "./contracts";
import { withAuthorizedInstagramToken } from "./instagram-access-token-call.server";
import { readPublishingIdentity, type InstagramTransportDeps } from "./instagram-transport.server";
import {
  derivePublishCapability,
  evaluatePublishConnection,
  type InstagramPublishCapability,
  type PublishCapabilityFacts,
} from "./publish-capability";

export interface ResolvePublishCapabilityDeps extends InstagramTransportDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly catalog?: ProviderCatalog;
}

/**
 * The connection-side facts for one tenant, read without opening any credential. The proposal
 * inlet uses this to bind a decision to one connection and its verified account id; execution uses
 * the full resolver below, which also asks Meta.
 */
export async function readInstagramPublishFacts(
  tenant: Pick<TenantContext, "tenantId"> | null,
  deps: ResolvePublishCapabilityDeps = {},
): Promise<PublishCapabilityFacts | null> {
  if (!tenant?.tenantId) return null;
  const catalog = deps.catalog ?? PROVIDER_CATALOG;
  const definition = findProviderDefinition(INSTAGRAM_PROVIDER_KEY, catalog);
  const declared =
    definition?.connectivity === "connectable" &&
    definition.capabilityScopes[INSTAGRAM_MEDIA_PUBLISH_CAPABILITY] !== undefined;
  const listing = await listConnections(tenant, { getDb: deps.getDb, catalog });
  if (listing.status !== "read") return null;
  return {
    declared,
    connections: listing.connections
      .filter((c) => c.providerKey === INSTAGRAM_PROVIDER_KEY)
      .map((c) => ({
        integrationId: c.integrationId,
        connectionState: c.connectionState,
        health: c.health,
        externalAccountId: c.externalAccountId,
        scopes: c.scopes,
      })),
  };
}

export async function resolveInstagramPublishCapability(
  tenant: Pick<TenantContext, "tenantId"> | null,
  deps: ResolvePublishCapabilityDeps = {},
): Promise<InstagramPublishCapability> {
  if (typeof window !== "undefined") {
    throw new Error("Instagram publish capability is server-only.");
  }
  if (!tenant?.tenantId) return { status: "unavailable", reason: "no-connection" };

  const facts = await readInstagramPublishFacts(tenant, deps);
  if (!facts) return { status: "unavailable", reason: "no-connection" };

  const eligibility = evaluatePublishConnection(facts);
  if (eligibility.status === "unavailable") return derivePublishCapability(facts, null);

  const identity = await withAuthorizedInstagramToken(
    { tenantId: tenant.tenantId, integrationId: eligibility.connection.integrationId },
    (accessToken) =>
      readPublishingIdentity(accessToken, eligibility.connection.externalAccountId, deps),
    { getDb: deps.getDb, env: deps.env },
  );
  return derivePublishCapability(facts, identity);
}
