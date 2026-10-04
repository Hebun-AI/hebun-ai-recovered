/*
 * read-tenant-external-ai-data-use.server.ts — THE ONLY READ of a tenant's external-AI data-use
 * authorization (EXTERNAL-AI-DATA-USE-1A).
 *
 * The tenant id must be one the caller READ off an authenticated `TenantContext`, never one accepted
 * from a request. Every query is predicated on it, so no code path here returns another tenant's row.
 * The effective revision is the highest one in the lineage `(tenant, service scope, account)` —
 * derived on read, never stored. No INSERT, UPDATE or DELETE.
 *
 * Fail closed: an unreadable control plane is `unavailable`, never `absent`.
 *
 * Server-only.
 */
import { and, desc, eq } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import {
  processorAttestations,
  tenantExternalAiDataUseAuthorizationScopes,
  tenantExternalAiDataUseAuthorizations,
} from "@/db/schema/external-ai-data-use";
import { resolveGovernanceDbOrNull } from "@/features/governance-decision/persistence.server";
import type { TenantAuthorizationInForce } from "./compose-external-ai-disclosure";
import { isDataClass, isPurpose, isServiceScope, type ScopePair } from "./contracts";
import { toAttestationView } from "./read-processor-attestations.server";

export interface TenantExternalAiDataUseReadDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
}

export type TenantExternalAiDataUseReadResult =
  | {
      readonly status: "read";
      readonly effective: TenantAuthorizationInForce & {
        readonly authorizationRevision: number;
        readonly authorizedByActorId: string;
        readonly governanceDecisionId: string;
        readonly authorizedAt: string;
      };
    }
  | { readonly status: "absent" }
  | { readonly status: "unavailable" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function readEffectiveTenantExternalAiDataUse(
  tenantId: string,
  serviceScope: string,
  accountRef: string,
  deps: TenantExternalAiDataUseReadDeps = {},
): Promise<TenantExternalAiDataUseReadResult> {
  if (typeof window !== "undefined") {
    throw new Error("Tenant external-AI data-use reads are server-only.");
  }
  const tenant = (tenantId ?? "").trim();
  if (!UUID_RE.test(tenant) || !isServiceScope(serviceScope) || !(accountRef ?? "").trim()) return { status: "absent" };
  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return { status: "unavailable" };

  try {
    const rows = await db
      .select({
        id: tenantExternalAiDataUseAuthorizations.id,
        authorizationRevision: tenantExternalAiDataUseAuthorizations.authorizationRevision,
        state: tenantExternalAiDataUseAuthorizations.state,
        boundProcessorAttestationId: tenantExternalAiDataUseAuthorizations.boundProcessorAttestationId,
        authorizedByActorId: tenantExternalAiDataUseAuthorizations.authorizedByActorId,
        governanceDecisionId: tenantExternalAiDataUseAuthorizations.governanceDecisionId,
        authorizedAt: tenantExternalAiDataUseAuthorizations.authorizedAt,
      })
      .from(tenantExternalAiDataUseAuthorizations)
      .where(
        and(
          eq(tenantExternalAiDataUseAuthorizations.tenantId, tenant),
          eq(tenantExternalAiDataUseAuthorizations.serviceScope, serviceScope),
          eq(tenantExternalAiDataUseAuthorizations.accountRef, accountRef),
        ),
      )
      .orderBy(desc(tenantExternalAiDataUseAuthorizations.authorizationRevision))
      .limit(1);
    const row = rows[0];
    if (!row) return { status: "absent" };

    let boundAttestation: TenantAuthorizationInForce["boundAttestation"] = null;
    if (row.boundProcessorAttestationId) {
      const bound = await db
        .select({
          id: processorAttestations.id,
          serviceScope: processorAttestations.serviceScope,
          accountRef: processorAttestations.accountRef,
          state: processorAttestations.state,
          identityStatus: processorAttestations.identityStatus,
          contractSurface: processorAttestations.contractSurface,
          training: processorAttestations.training,
          retentionClass: processorAttestations.retentionClass,
          zdr: processorAttestations.zdr,
          modelTreatmentClass: processorAttestations.modelTreatmentClass,
          attestationRevision: processorAttestations.attestationRevision,
        })
        .from(processorAttestations)
        .where(eq(processorAttestations.id, row.boundProcessorAttestationId))
        .limit(1);
      const view = bound[0] ? toAttestationView(bound[0]) : null;
      if (!view) return { status: "unavailable" };
      const { state: _state, ...treatment } = view;
      void _state;
      boundAttestation = treatment;
    }

    const scopeRows = await db
      .select({
        purpose: tenantExternalAiDataUseAuthorizationScopes.purpose,
        dataClass: tenantExternalAiDataUseAuthorizationScopes.dataClass,
      })
      .from(tenantExternalAiDataUseAuthorizationScopes)
      .where(
        and(
          eq(tenantExternalAiDataUseAuthorizationScopes.authorizationId, row.id),
          eq(tenantExternalAiDataUseAuthorizationScopes.tenantId, tenant),
        ),
      );
    const scopes: ScopePair[] = [];
    for (const s of scopeRows) {
      if (!isPurpose(s.purpose) || !isDataClass(s.dataClass)) return { status: "unavailable" };
      scopes.push({ purpose: s.purpose, dataClass: s.dataClass });
    }

    return {
      status: "read",
      effective: {
        authorizationId: row.id,
        authorizationRevision: row.authorizationRevision,
        state: row.state,
        boundAttestation,
        scopes,
        authorizedByActorId: row.authorizedByActorId,
        governanceDecisionId: row.governanceDecisionId,
        authorizedAt: row.authorizedAt instanceof Date ? row.authorizedAt.toISOString() : String(row.authorizedAt),
      },
    };
  } catch {
    return { status: "unavailable" };
  }
}
