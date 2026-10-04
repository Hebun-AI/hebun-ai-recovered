/*
 * authorize-tenant-external-ai-data-use.server.ts — THE ONLY WRITER of tenant external-AI data-use
 * authorizations (EXTERNAL-AI-DATA-USE-1A).
 *
 * ── WHAT ONE CALL MEANS ─────────────────────────────────────────────────────
 *
 * A named human, holding this tenant's Governance authority, records that THESE (purpose, data
 * class) pairs may cross to ONE reviewed processing boundary — the exact processor attestation
 * revision they were shown. It sends nothing, authorizes no act, enables no provider and touches no
 * R2E control. Whether a disclosure may happen is decided later, by the resolver, from every
 * authority at once.
 *
 * ── WHAT IT CAN ACCEPT ──────────────────────────────────────────────────────
 *
 * Every pair must be ALLOWED by the platform policy at write time, under the treatment of the
 * attestation the human chose, and an active revision must name an existing attestation (CHECK +
 * composite FK). Release A satisfied neither. Since B1C an Anthropic attestation is admitted, and
 * since B1D the recorded policy ALLOWS exactly `anthropic/messages` × `assistance` ×
 * {`conversation`, `knowledge`, `work-artifact`} — so those pairs, and only those, can now be
 * accepted. Nothing writes one on its own: it takes a named Governance holder's session act. The
 * writer is handed no other policy at runtime; only tests inject one.
 *
 * ── WHY THE TENANT IS NEVER AN ARGUMENT ─────────────────────────────────────
 *
 * It is read off the authenticated `TenantContext` and from nowhere else, so no caller can authorize
 * an organization other than the one whose session it is acting in. The lineage's scope and account
 * are read off the ATTESTATION the human chose, never typed by the client.
 *
 * ── REVISIONS, NOT EDITS ────────────────────────────────────────────────────
 *
 * Nothing existing is ever updated. Re-scoping or re-binding writes a new active revision;
 * withdrawing writes a new `withdrawn` revision with no scope rows. Every revision carries its own
 * Governance decision, filed in the `external-ai-data-use` domain.
 *
 * Server-only.
 */
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import {
  processorAttestations,
  tenantExternalAiDataUseAuthorizationScopes,
  tenantExternalAiDataUseAuthorizations,
} from "@/db/schema/external-ai-data-use";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { recordGovernanceEventWithin } from "@/features/governance-audit/governance-decision-audit.server";
import {
  resolveGovernanceAuthority,
  type GovernanceAuthorityResolution,
} from "@/features/governance-decision/authority-read.server";
import { writeGovernanceDecisionWithin } from "@/features/governance-decision/decision-authority.server";
import { validateJustification } from "@/features/governance-decision/persistence.server";
import {
  MAX_SCOPE_PAIRS,
  TENANT_EXTERNAL_AI_DATA_USE_AUTHORIZE_DECISION_TYPE,
  TENANT_EXTERNAL_AI_DATA_USE_SUBJECT_TYPE,
  TENANT_EXTERNAL_AI_DATA_USE_WITHDRAW_DECISION_TYPE,
  isDataClass,
  isPurpose,
  isServiceScope,
  type ExternalAiRevisionState,
  type ScopePair,
  type ServiceScope,
  type TenantExternalAiDataUseWriteRefusal,
} from "./contracts";
import {
  RECORDED_PLATFORM_DISCLOSURE_POLICY,
  attestationSatisfiesBounds,
  decidePlatformDisclosure,
  type PlatformDisclosurePolicy,
} from "./platform-disclosure-policy";
import { toAttestationView } from "./read-processor-attestations.server";

export interface TenantExternalAiDataUseWriteDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
  /** TEST-ONLY seam. No runtime caller passes it; the recorded policy is the default. */
  readonly policy?: PlatformDisclosurePolicy;
}

export interface AuthorizeTenantExternalAiDataUseInput {
  /** The exact attestation revision the human was shown. Its scope and account form the lineage. */
  readonly attestationId: string;
  readonly scopes: readonly ScopePair[];
  readonly justification: string;
  /** The tenant revision the human was shown; `null` means "I believe there is none". */
  readonly observedRevision: number | null;
}

export interface WithdrawTenantExternalAiDataUseInput {
  readonly serviceScope: ServiceScope;
  readonly accountRef: string;
  readonly justification: string;
  readonly observedRevision: number | null;
}

export type TenantExternalAiDataUseWriteResult =
  | {
      readonly status: "written";
      readonly authorizationId: string;
      readonly authorizationRevision: number;
      readonly state: ExternalAiRevisionState;
      readonly governanceDecisionId: string;
      readonly governanceSessionId: string;
    }
  | { readonly status: "refused"; readonly reason: TenantExternalAiDataUseWriteRefusal };

class Abort extends Error {
  constructor(readonly reason: TenantExternalAiDataUseWriteRefusal) {
    super(reason);
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function refused(reason: TenantExternalAiDataUseWriteRefusal): TenantExternalAiDataUseWriteResult {
  return { status: "refused", reason };
}

function resolveDbOrNull(deps: TenantExternalAiDataUseWriteDeps): ControlPlaneDatabase | null {
  if (deps.getDb) return deps.getDb();
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

/** A closed, duplicate-free, non-empty set of pairs — or nothing. */
function validScopes(input: unknown): readonly ScopePair[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_SCOPE_PAIRS) return null;
  const seen = new Set<string>();
  const pairs: ScopePair[] = [];
  for (const candidate of input as unknown[]) {
    const pair = candidate as { purpose?: unknown; dataClass?: unknown } | null;
    if (!pair || !isPurpose(pair.purpose) || !isDataClass(pair.dataClass)) return null;
    const key = `${pair.purpose}\u0000${pair.dataClass}`;
    if (seen.has(key)) return null;
    seen.add(key);
    pairs.push({ purpose: pair.purpose, dataClass: pair.dataClass });
  }
  return pairs;
}

const pairKey = (p: { purpose: string; dataClass: string }) => `${p.purpose}\u0000${p.dataClass}`;

async function preflight(
  tenant: TenantContext | null,
  justificationInput: unknown,
  deps: TenantExternalAiDataUseWriteDeps,
): Promise<
  | { readonly ok: false; readonly result: TenantExternalAiDataUseWriteResult }
  | {
      readonly ok: true;
      readonly tenant: TenantContext;
      readonly justification: string;
      readonly db: ControlPlaneDatabase;
      readonly authority: GovernanceAuthorityResolution;
      readonly now: Date;
    }
> {
  if (typeof window !== "undefined") {
    throw new Error("Tenant external-AI data-use authorization is server-only.");
  }
  /* AN AUTHENTICATED HUMAN, OR NOTHING. */
  if (!tenant?.tenantId || !tenant.userId) return { ok: false, result: refused("unauthenticated") };
  const justification = validateJustification(justificationInput as string);
  if (!justification) return { ok: false, result: refused("justification-required") };
  const db = resolveDbOrNull(deps);
  if (!db) return { ok: false, result: refused("persistence-unavailable") };
  let authority: GovernanceAuthorityResolution;
  try {
    authority = await resolveGovernanceAuthority(tenant, deps);
  } catch {
    return { ok: false, result: refused("persistence-unavailable") };
  }
  if (!authority.bootstrapDecisionId) return { ok: false, result: refused("no-governance-authority") };
  if (!authority.authorized) return { ok: false, result: refused("not-the-governance-authority") };
  return { ok: true, tenant, justification, db, authority, now: (deps.now ?? (() => new Date()))() };
}

/** Authorize THIS tenant — the session's — for the given pairs against one reviewed attestation. */
export async function authorizeTenantExternalAiDataUse(
  tenantInput: TenantContext | null,
  input: AuthorizeTenantExternalAiDataUseInput,
  deps: TenantExternalAiDataUseWriteDeps = {},
): Promise<TenantExternalAiDataUseWriteResult> {
  const ready = await preflight(tenantInput, input?.justification, deps);
  if (!ready.ok) return ready.result;
  const { tenant, justification, db, authority, now } = ready;

  const scopes = validScopes(input?.scopes);
  if (!scopes) return refused("invalid-scope");
  const attestationId = typeof input?.attestationId === "string" ? input.attestationId.trim() : "";
  if (!UUID_RE.test(attestationId)) return refused("attestation-unknown");
  const policy = deps.policy ?? RECORDED_PLATFORM_DISCLOSURE_POLICY;
  const observedRevision = input?.observedRevision ?? null;

  try {
    let outcome: TenantExternalAiDataUseWriteResult | null = null;
    await db.transaction(async (rawTx) => {
      const tx = rawTx as unknown as ControlPlaneDatabase;

      /* 1 · THE BOUNDARY THE HUMAN WAS SHOWN — it must be the one now in force. */
      const chosenRows = await tx.select().from(processorAttestations).where(eq(processorAttestations.id, attestationId)).limit(1);
      const chosenRow = chosenRows[0];
      if (!chosenRow) throw new Abort("attestation-unknown");
      const chosen = toAttestationView(chosenRow);
      if (!chosen) throw new Abort("persistence-unavailable");
      const latestRows = await tx
        .select({ id: processorAttestations.id })
        .from(processorAttestations)
        .where(
          and(eq(processorAttestations.serviceScope, chosen.serviceScope), eq(processorAttestations.accountRef, chosen.accountRef)),
        )
        .orderBy(desc(processorAttestations.attestationRevision))
        .limit(1);
      if (latestRows[0]?.id !== chosen.id || chosen.state !== "active") throw new Abort("attestation-not-current");

      /* 2 · EVERY PAIR MUST BE OFFERABLE BY THE PLATFORM, UNDER THIS ATTESTATION'S TREATMENT. */
      for (const pair of scopes) {
        const verdict = decidePlatformDisclosure({ serviceScope: chosen.serviceScope, purpose: pair.purpose, dataClass: pair.dataClass }, policy);
        if (verdict.decision !== "allowed" || !attestationSatisfiesBounds(chosen, verdict.bounds)) {
          throw new Abort("platform-not-allowed");
        }
      }

      /* 3 · WHERE THIS TENANT'S LINEAGE STANDS — and what the human believed it was. */
      const existingRows = await tx
        .select({
          id: tenantExternalAiDataUseAuthorizations.id,
          authorizationRevision: tenantExternalAiDataUseAuthorizations.authorizationRevision,
          state: tenantExternalAiDataUseAuthorizations.state,
          boundProcessorAttestationId: tenantExternalAiDataUseAuthorizations.boundProcessorAttestationId,
        })
        .from(tenantExternalAiDataUseAuthorizations)
        .where(
          and(
            eq(tenantExternalAiDataUseAuthorizations.tenantId, tenant.tenantId),
            eq(tenantExternalAiDataUseAuthorizations.serviceScope, chosen.serviceScope),
            eq(tenantExternalAiDataUseAuthorizations.accountRef, chosen.accountRef),
          ),
        )
        .orderBy(desc(tenantExternalAiDataUseAuthorizations.authorizationRevision))
        .limit(1);
      const effective = existingRows[0] ?? null;
      const currentRevision = effective?.authorizationRevision ?? null;
      if (observedRevision !== currentRevision) throw new Abort("stale-authorization-revision");

      /* 4 · A decision that changes nothing is not recorded. */
      if (effective?.state === "active" && effective.boundProcessorAttestationId === chosen.id) {
        const held = await tx
          .select({
            purpose: tenantExternalAiDataUseAuthorizationScopes.purpose,
            dataClass: tenantExternalAiDataUseAuthorizationScopes.dataClass,
          })
          .from(tenantExternalAiDataUseAuthorizationScopes)
          .where(
            and(
              eq(tenantExternalAiDataUseAuthorizationScopes.authorizationId, effective.id),
              eq(tenantExternalAiDataUseAuthorizationScopes.tenantId, tenant.tenantId),
            ),
          );
        const heldKeys = new Set(held.map(pairKey));
        if (heldKeys.size === scopes.length && scopes.every((p) => heldKeys.has(pairKey(p)))) {
          throw new Abort("unchanged");
        }
      }

      outcome = await writeRevision(tx, {
        tenant,
        authority,
        justification,
        now,
        state: "active",
        serviceScope: chosen.serviceScope,
        accountRef: chosen.accountRef,
        boundAttestationId: chosen.id,
        scopes,
        previous: effective,
      });
    });
    return outcome ?? refused("persistence-unavailable");
  } catch (error) {
    if (error instanceof Abort) return refused(error.reason);
    return refused("persistence-unavailable");
  }
}

/** Withdraw it. A new revision, under its own decision; the one it replaces stays byte-identical. */
export async function withdrawTenantExternalAiDataUse(
  tenantInput: TenantContext | null,
  input: WithdrawTenantExternalAiDataUseInput,
  deps: TenantExternalAiDataUseWriteDeps = {},
): Promise<TenantExternalAiDataUseWriteResult> {
  const ready = await preflight(tenantInput, input?.justification, deps);
  if (!ready.ok) return ready.result;
  const { tenant, justification, db, authority, now } = ready;
  const accountRef = typeof input?.accountRef === "string" ? input.accountRef : "";
  if (!isServiceScope(input?.serviceScope) || !accountRef.trim()) return refused("no-active-authorization");
  const observedRevision = input?.observedRevision ?? null;

  try {
    let outcome: TenantExternalAiDataUseWriteResult | null = null;
    await db.transaction(async (rawTx) => {
      const tx = rawTx as unknown as ControlPlaneDatabase;
      const existingRows = await tx
        .select({
          id: tenantExternalAiDataUseAuthorizations.id,
          authorizationRevision: tenantExternalAiDataUseAuthorizations.authorizationRevision,
          state: tenantExternalAiDataUseAuthorizations.state,
          boundProcessorAttestationId: tenantExternalAiDataUseAuthorizations.boundProcessorAttestationId,
        })
        .from(tenantExternalAiDataUseAuthorizations)
        .where(
          and(
            eq(tenantExternalAiDataUseAuthorizations.tenantId, tenant.tenantId),
            eq(tenantExternalAiDataUseAuthorizations.serviceScope, input.serviceScope),
            eq(tenantExternalAiDataUseAuthorizations.accountRef, accountRef),
          ),
        )
        .orderBy(desc(tenantExternalAiDataUseAuthorizations.authorizationRevision))
        .limit(1);
      const effective = existingRows[0] ?? null;
      /* Taking away what nobody granted is not a fact; neither is withdrawing twice. */
      if (!effective || effective.state !== "active") throw new Abort("no-active-authorization");
      if (observedRevision !== effective.authorizationRevision) throw new Abort("stale-authorization-revision");

      outcome = await writeRevision(tx, {
        tenant,
        authority,
        justification,
        now,
        state: "withdrawn",
        serviceScope: input.serviceScope,
        accountRef,
        boundAttestationId: null,
        scopes: [],
        previous: effective,
      });
    });
    return outcome ?? refused("persistence-unavailable");
  } catch (error) {
    if (error instanceof Abort) return refused(error.reason);
    return refused("persistence-unavailable");
  }
}

async function writeRevision(
  tx: ControlPlaneDatabase,
  args: {
    readonly tenant: TenantContext;
    readonly authority: GovernanceAuthorityResolution;
    readonly justification: string;
    readonly now: Date;
    readonly state: ExternalAiRevisionState;
    readonly serviceScope: ServiceScope;
    readonly accountRef: string;
    readonly boundAttestationId: string | null;
    readonly scopes: readonly ScopePair[];
    readonly previous: { readonly id: string; readonly authorizationRevision: number } | null;
  },
): Promise<TenantExternalAiDataUseWriteResult> {
  const { tenant, authority, now } = args;
  const authorizationRevision = (args.previous?.authorizationRevision ?? 0) + 1;
  const supersedesAuthorizationId = args.previous?.id ?? null;
  const decisionType =
    args.state === "withdrawn"
      ? TENANT_EXTERNAL_AI_DATA_USE_WITHDRAW_DECISION_TYPE
      : TENANT_EXTERNAL_AI_DATA_USE_AUTHORIZE_DECISION_TYPE;

  /*
   * THE CIRCULAR REFERENCE, AND THE AUTHORIZED SOLUTION (I1, reused by every sibling): the decision
   * names the revision and the revision names the decision, so the revision's id is minted here and
   * the row it names is written in the same transaction or not at all.
   */
  const authorizationId = randomUUID();

  const decision = await writeGovernanceDecisionWithin(
    tx,
    tenant,
    authority,
    {
      decisionType,
      subjectType: TENANT_EXTERNAL_AI_DATA_USE_SUBJECT_TYPE,
      subjectId: authorizationId,
      /* The SHAPE of what was decided: no content, no credential, no prompt. */
      evidence: {
        authorityVia: authority.via,
        authorityDelegationDecisionId: authority.delegationDecisionId,
        tenantExternalAiDataUseAuthorizationId: authorizationId,
        authorizationRevision,
        state: args.state,
        serviceScope: args.serviceScope,
        accountRef: args.accountRef,
        boundProcessorAttestationId: args.boundAttestationId,
        scopes: args.scopes.map((p) => `${p.purpose}:${p.dataClass}`),
        supersedesAuthorizationId,
      },
      justification: args.justification,
    },
    now,
  );

  const inserted = await tx
    .insert(tenantExternalAiDataUseAuthorizations)
    .values({
      id: authorizationId,
      tenantId: tenant.tenantId,
      authorizationRevision,
      state: args.state,
      serviceScope: args.serviceScope,
      accountRef: args.accountRef,
      boundProcessorAttestationId: args.boundAttestationId,
      governanceDecisionId: decision.decisionId,
      governanceSessionId: decision.sessionId,
      /* The CHECK refuses anything but `human` independently of this line. */
      authorizedByActorType: "human",
      authorizedByActorId: tenant.userId,
      authorizedAt: now,
      supersedesAuthorizationId,
      createdAt: now,
      createdBy: tenant.userId,
      createdByType: "human",
      updatedAt: now,
      updatedBy: tenant.userId,
      updatedByType: "human",
    })
    .returning({ id: tenantExternalAiDataUseAuthorizations.id });
  if (!inserted[0]?.id) throw new Abort("persistence-unavailable");

  if (args.scopes.length > 0) {
    await tx.insert(tenantExternalAiDataUseAuthorizationScopes).values(
      args.scopes.map((p) => ({
        tenantId: tenant.tenantId,
        authorizationId,
        purpose: p.purpose,
        dataClass: p.dataClass,
        createdAt: now,
      })),
    );
  }

  await recordGovernanceEventWithin(
    tx,
    {
      tenantId: tenant.tenantId,
      userId: tenant.userId,
      requestId: tenant.requestId,
      sessionContextId: tenant.sessionContextId,
    },
    {
      action: "governance.decision.recorded",
      outcome: "committed",
      entityId: decision.decisionId,
      metadata: {
        governanceSessionId: decision.sessionId,
        decisionType,
        subjectType: TENANT_EXTERNAL_AI_DATA_USE_SUBJECT_TYPE,
        subjectId: authorizationId,
        bootstrap: false,
      },
    },
    now,
  );

  return {
    status: "written",
    authorizationId,
    authorizationRevision,
    state: args.state,
    governanceDecisionId: decision.decisionId,
    governanceSessionId: decision.sessionId,
  };
}
