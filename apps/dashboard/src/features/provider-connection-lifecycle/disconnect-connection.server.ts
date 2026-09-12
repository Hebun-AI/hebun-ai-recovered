/*
 * provider-connection-lifecycle/disconnect-connection.server.ts — ending one tenant's provider
 * connection, through the two authorities that already own the halves.
 *
 * ── WHY THIS IS A FEATURE MODULE AND NOT A SERVER ACTION ────────────────────
 *
 * The first version of this lived in `src/app/(dashboard)/integrations/instagram/actions.ts` and
 * imported the credential authority directly. A released INT-2 firewall refused it, and the refusal
 * was right: only the two OAuth CALLBACK routes may reach `integration-credentials` from `src/app`,
 * because they hold tokens a provider has just issued, and the exemption is a NAMED list precisely
 * so a pattern cannot admit the next file without a reviewer. Its stated reason — "a surface that
 * could reach the vault would eventually render it" — is about the module boundary, not about
 * whether a given caller happens to touch plaintext.
 *
 * Widening that list to fit a button would have been the wrong repair. The composition moved here
 * instead, and the server action became a thin caller of it. `src/app` no longer names the vault.
 *
 * ── IT IS AN ORCHESTRATOR. IT OWNS NO TABLE ─────────────────────────────────
 *
 * No schema import, no insert, no update, no transaction of its own. `revokeCredential` and
 * `disconnectConnection` were both already released, both tenant-predicated, both audited, and both
 * had ZERO callers. This is the caller — the same shape `self-service-signup` uses to compose the
 * identity, credential and tenant authorities without becoming one.
 *
 * ── ORDER IS CHOSEN, AND THE HALVES DO NOT SHARE A TRANSACTION ──────────────
 *
 * Two authorities, two transactions, so a failure between them is possible and the order decides
 * which partial state survives:
 *
 *   credential first, then connection  → worst case: the row still says connected while its secret
 *                                        is revoked. The next verification fails and says so.
 *   connection first, then credential  → worst case: the row says `disconnected` while a LIVE,
 *                                        decryptable token remains. A human told one thing while
 *                                        the secret is still spendable.
 *
 * The second is a lie the product would be telling, so the secret goes first. Both halves refuse
 * terminal states rather than throwing, which is what makes re-running this finish the job instead
 * of needing a recovery path.
 *
 * ── WHAT IT CANNOT CLAIM ────────────────────────────────────────────────────
 *
 * It revokes NOTHING at the provider. No deauthorization endpoint is implemented for any provider
 * here, so the outcome deliberately says `hebun-access-ended` rather than anything resembling
 * "revoked at the provider", and the connection reaches `disconnected` and never `revoked` — the
 * integration authority reserves that for "the provider ended it", a claim this cannot support.
 *
 * Stored provider observations are untouched. The provider did say those things, at those instants.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import type { ControlPlaneDatabase } from "@/db/client.server";
import {
  disconnectConnection,
  listConnections,
} from "@/features/integration-authority/integration-repository.server";
import {
  listCredentialMetadata,
  revokeCredential,
} from "@/features/integration-credentials/credential-repository.server";

export type DisconnectProviderOutcome =
  /** Every live credential was revoked and the connection is terminal. */
  | { readonly status: "hebun-access-ended" }
  /** Nothing non-terminal existed for this tenant. Idempotent, not an error. */
  | { readonly status: "nothing-to-do" }
  | {
      readonly status: "refused";
      /** Prefixed so a surface can tell which half declined without inventing a vocabulary. */
      readonly reason: string;
    };

export interface DisconnectProviderDeps {
  readonly getDb?: () => ControlPlaneDatabase;
}

/**
 * End this tenant's connection to one provider.
 *
 * THE TENANT IS THE CALLER'S RESOLVED CONTEXT and the connection is re-derived from that tenant's
 * own listing — there is no integration id parameter, so no caller can name a row it does not own.
 * A cross-tenant id would not merely be refused; it cannot be expressed.
 */
export async function disconnectProviderConnection(
  tenant: TenantContext | null,
  providerKey: string,
  deps: DisconnectProviderDeps = {},
): Promise<DisconnectProviderOutcome> {
  if (!tenant?.tenantId) return { status: "refused", reason: "no-authorized-tenant-context" };

  const listing = await listConnections(tenant, deps);
  if (listing.status !== "read") return { status: "refused", reason: "connections-unavailable" };

  const connection = listing.connections.find(
    (c) =>
      c.providerKey === providerKey &&
      c.connectionState !== "disconnected" &&
      c.connectionState !== "revoked",
  );
  if (!connection) return { status: "nothing-to-do" };

  /* ── 1 · THE SECRET FIRST ────────────────────────────────────────────────── */
  const credentials = await listCredentialMetadata(tenant, connection.integrationId, deps);
  if (credentials.status === "read") {
    for (const credential of credentials.credentials.filter((c) => c.live)) {
      const revoked = await revokeCredential(tenant, credential.credentialId, deps);
      /*
       * A refusal STOPS the sequence. Continuing to the lifecycle transition would produce exactly
       * the state the ordering above exists to prevent. `credential-not-live` is the one benign
       * answer — another caller got there first, which is the outcome we wanted anyway.
       */
      if (revoked.status === "refused" && revoked.reason !== "credential-not-live") {
        return { status: "refused", reason: `credential-${revoked.reason}` };
      }
    }
  }

  /* ── 2 · THEN THE LIFECYCLE ──────────────────────────────────────────────── */
  const ended = await disconnectConnection(tenant, connection.integrationId, deps);
  if (ended.status === "refused") return { status: "refused", reason: `connection-${ended.reason}` };

  return { status: "hebun-access-ended" };
}
