/*
 * ORGANIZATION-READINESS-2 — this organization's ASSISTANCE data-use decision, made in the app.
 *
 * NOT A NEW AUTHORITY. The released writer (`authorize-tenant-external-ai-data-use.server.ts`) stays
 * the only thing that writes, and it still decides everything it decided before: an authenticated
 * human, this session's tenant, a Governance holder, a justification, the attestation in force, every
 * pair ALLOWED by the recorded policy, and the revision the human was shown. This module only fixes
 * WHAT is asked for, so the app can offer one narrow decision instead of a free-form scope editor:
 *
 *   purpose      `assistance`, always — no input names a purpose
 *   pairs        read off RECORDED_PLATFORM_DISCLOSURE_POLICY for `anthropic/messages` × assistance
 *   other purposes  carried through untouched: authorizing assistance keeps them (`nextRevisionScopes`),
 *                and withdrawing assistance removes only its pairs (`revisionScopesWithout`); when
 *                nothing else is in force that is the writer's ordinary withdrawal
 *
 * The tenant is read off the `TenantContext` and nowhere else. Every unreadable authority is
 * `unavailable` and offers no control; a refusal is the writer's own word.
 *
 * AUTHORIZING DATA USE IS NOT A CONNECTED PROVIDER AND NOT A MODEL CALL. Whether the platform model
 * may be called at all is R2E's answer (shown in Organization readiness); every call is still decided
 * by the generator's gate at the moment it happens.
 *
 * Server-only.
 */
import type { ControlPlaneDatabase } from "@/db/client.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { readGovernanceAuthority } from "@/features/governance-decision/authority-read.server";
import {
  ANTHROPIC_MESSAGES_SCOPE,
  CONFIGURED_ANTHROPIC_ACCOUNT_REF,
} from "./authorize-external-ai-disclosure.server";
import {
  authorizeTenantExternalAiDataUse,
  withdrawTenantExternalAiDataUse,
  type TenantExternalAiDataUseWriteResult,
} from "./authorize-tenant-external-ai-data-use.server";
import type {
  ContractSurface,
  DataClass,
  IdentityStatus,
  Purpose,
  RetentionClass,
  ScopePair,
  TrainingTreatment,
  ZdrState,
} from "./contracts";
import { RECORDED_PLATFORM_DISCLOSURE_POLICY } from "./platform-disclosure-policy";
import { readLatestProcessorAttestation } from "./read-processor-attestations.server";
import { readEffectiveTenantExternalAiDataUse } from "./read-tenant-external-ai-data-use.server";
import { nextRevisionScopes, revisionScopesWithout } from "./revision-scopes";

/** Reads and writes go to the same store. No policy can be injected: the recorded one decides. */
export interface AssistanceDataUseDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
}

const PURPOSE = "assistance" as const satisfies Purpose;

/** The (assistance, class) pairs the platform offers — read off the recorded policy, never typed. */
export function assistanceScopePairs(): ScopePair[] {
  return RECORDED_PLATFORM_DISCLOSURE_POLICY.allowedCells
    .filter((cell) => cell.serviceScope === ANTHROPIC_MESSAGES_SCOPE && cell.purpose === PURPOSE)
    .map((cell) => ({ purpose: cell.purpose, dataClass: cell.dataClass }));
}

export interface AssistanceAttestationView {
  readonly id: string;
  readonly revision: number;
  readonly identityStatus: IdentityStatus;
  readonly contractSurface: ContractSurface;
  readonly training: TrainingTreatment;
  readonly retentionClass: RetentionClass;
  readonly zdr: ZdrState;
  readonly modelIds: readonly string[];
}

export type AssistanceDataUseView =
  | {
      readonly status: "read";
      readonly governanceEstablished: boolean;
      readonly viewerIsGovernanceAuthority: boolean;
      /** What an authorization lets cross, by the authority that owns it. */
      readonly dataClasses: readonly DataClass[];
      /** The reviewed processor boundary in force, or null when there is none usable. */
      readonly attestation: AssistanceAttestationView | null;
      /** The lineage's latest revision, or null when this organization never decided. */
      readonly revision: number | null;
      readonly assistanceAuthorized: boolean;
      /** Other purposes in force. Untouched by this decision; listed so nobody is surprised. */
      readonly otherPurposes: readonly Purpose[];
      readonly decidedAt: string | null;
    }
  | { readonly status: "unauthenticated" }
  | { readonly status: "unavailable" };

export async function readAssistanceDataUse(
  tenant: TenantContext | null,
  deps: AssistanceDataUseDeps = {},
): Promise<AssistanceDataUseView> {
  if (typeof window !== "undefined") throw new Error("Assistance data-use reads are server-only.");
  if (!tenant?.tenantId || !tenant.userId) return { status: "unauthenticated" };
  try {
    const [governance, current, latest] = await Promise.all([
      readGovernanceAuthority(tenant, deps),
      readEffectiveTenantExternalAiDataUse(tenant.tenantId, ANTHROPIC_MESSAGES_SCOPE, CONFIGURED_ANTHROPIC_ACCOUNT_REF, deps),
      readLatestProcessorAttestation(ANTHROPIC_MESSAGES_SCOPE, CONFIGURED_ANTHROPIC_ACCOUNT_REF, deps),
    ]);
    /* Fail closed: an unread authority is not a "no", and it is not a place to offer a decision. */
    if (governance.status !== "read" || current.status === "unavailable") return { status: "unavailable" };
    const effective = current.status === "read" ? current.effective : null;
    const inForce = effective?.state === "active" ? effective.scopes : [];
    return {
      status: "read",
      governanceEstablished: governance.authority.bootstrap !== null,
      viewerIsGovernanceAuthority: governance.authority.viewerIsGovernanceAuthority,
      dataClasses: assistanceScopePairs().map((p) => p.dataClass),
      attestation:
        latest.status === "read" && latest.latest.state === "active"
          ? {
              id: latest.latest.id,
              revision: latest.latest.attestationRevision,
              identityStatus: latest.latest.identityStatus,
              contractSurface: latest.latest.contractSurface,
              training: latest.latest.training,
              retentionClass: latest.latest.retentionClass,
              zdr: latest.latest.zdr,
              modelIds: [...latest.latest.modelIds],
            }
          : null,
      revision: effective?.authorizationRevision ?? null,
      assistanceAuthorized: inForce.some((p) => p.purpose === PURPOSE),
      otherPurposes: [...new Set(inForce.filter((p) => p.purpose !== PURPOSE).map((p) => p.purpose))].sort(),
      decidedAt: effective?.authorizedAt ?? null,
    };
  } catch {
    return { status: "unavailable" };
  }
}

export interface AuthorizeAssistanceInput {
  /** The attestation revision the human was shown. The writer refuses it unless it is still in force. */
  readonly attestationId: string;
  readonly justification: string;
  /** The tenant revision the human was shown; `null` means "I believe there is none". */
  readonly observedRevision: number | null;
}

export interface WithdrawAssistanceInput {
  readonly justification: string;
  readonly observedRevision: number | null;
}

const refused = (reason: Extract<TenantExternalAiDataUseWriteResult, { status: "refused" }>["reason"]) =>
  ({ status: "refused", reason }) as const;

/** What this lineage holds right now, or the refusal that reading it produced. */
async function inForce(tenant: TenantContext, observedRevision: number | null, deps: AssistanceDataUseDeps) {
  const current = await readEffectiveTenantExternalAiDataUse(
    tenant.tenantId,
    ANTHROPIC_MESSAGES_SCOPE,
    CONFIGURED_ANTHROPIC_ACCOUNT_REF,
    deps,
  );
  if (current.status === "unavailable") return { ok: false, result: refused("persistence-unavailable") } as const;
  const effective = current.status === "read" ? current.effective : null;
  /* The scopes are composed from what the human saw; the writer re-checks the revision in its transaction. */
  if ((effective?.authorizationRevision ?? null) !== observedRevision) {
    return { ok: false, result: refused("stale-authorization-revision") } as const;
  }
  return { ok: true, effective, scopes: effective?.state === "active" ? effective.scopes : [] } as const;
}

/** Authorize assistance for THIS tenant, keeping every other purpose already in force. */
export async function authorizeAssistanceDataUse(
  tenant: TenantContext | null,
  input: AuthorizeAssistanceInput,
  deps: AssistanceDataUseDeps = {},
): Promise<TenantExternalAiDataUseWriteResult> {
  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");
  const observedRevision = typeof input?.observedRevision === "number" ? input.observedRevision : null;
  const held = await inForce(tenant, observedRevision, deps);
  if (!held.ok) return held.result;
  return authorizeTenantExternalAiDataUse(
    tenant,
    {
      attestationId: String(input?.attestationId ?? ""),
      scopes: nextRevisionScopes(held.scopes, assistanceScopePairs()),
      justification: String(input?.justification ?? ""),
      observedRevision,
    },
    { getDb: deps.getDb, now: deps.now },
  );
}

/** Withdraw assistance for THIS tenant. Other purposes stay; with none left it is a withdrawal. */
export async function withdrawAssistanceDataUse(
  tenant: TenantContext | null,
  input: WithdrawAssistanceInput,
  deps: AssistanceDataUseDeps = {},
): Promise<TenantExternalAiDataUseWriteResult> {
  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");
  const observedRevision = typeof input?.observedRevision === "number" ? input.observedRevision : null;
  const held = await inForce(tenant, observedRevision, deps);
  if (!held.ok) return held.result;
  if (!held.scopes.some((p) => p.purpose === PURPOSE)) return refused("no-active-authorization");
  const remaining = revisionScopesWithout(held.scopes, PURPOSE);
  const justification = String(input?.justification ?? "");
  const writerDeps = { getDb: deps.getDb, now: deps.now };
  if (remaining.length === 0) {
    return withdrawTenantExternalAiDataUse(
      tenant,
      { serviceScope: ANTHROPIC_MESSAGES_SCOPE, accountRef: CONFIGURED_ANTHROPIC_ACCOUNT_REF, justification, observedRevision },
      writerDeps,
    );
  }
  /*
   * The other purposes stay bound to the attestation they were authorized against. If a newer one is
   * in force the writer refuses `attestation-not-current` — this path never re-binds a purpose to a
   * boundary nobody reviewed for it.
   */
  return authorizeTenantExternalAiDataUse(
    tenant,
    { attestationId: held.effective?.boundAttestation?.id ?? "", scopes: remaining, justification, observedRevision },
    writerDeps,
  );
}
