/*
 * heby-action-inlet/prior-publication.server.ts — CONTENT-PUBLICATION-DUPLICATE-GUARD-1, the EARLY
 * refusal a publish proposal gets when the ledger already shows why it could not be executed.
 *
 * THIS IS NOT THE SAFETY BOUNDARY. It reads outside any transaction, so two proposals can pass it
 * together. The invariant is enforced where the consequential act happens — inside the executor's
 * spend transaction, under a row lock (`execute-authorized-action.server.ts`). This exists so a human
 * learns BEFORE filing that a publication is in flight, or which prior attempt an intentional
 * republish must acknowledge, instead of learning it at Execute.
 *
 * It uses the ONE history reader (`readRevisionPublicationHistory`, unbounded) and the ONE policy
 * (`evaluatePublicationGuard`). It writes nothing; a refusal here files no request.
 *
 * Server-only.
 */
import type { ControlPlaneDatabase } from "@/db/client.server";
import { readRevisionPublicationHistory } from "@/features/action-authorization/content-publication-state.server";
import {
  evaluatePublicationGuard,
  type PublicationGuardRefusal,
  type PublicationIdentity,
} from "@/features/action-authorization/content-publication-state";
import { resolveGovernanceDbOrNull } from "@/features/governance-decision/persistence.server";
import { asCanonicalPayload, digestCanonicalAction } from "@/features/action-authorization/canonical-payload";

/**
 * The digest the request writer WILL bind for this prepared action — the same pure function, the
 * same inputs. Used only so an identical re-proposal keeps its released `already-pending` answer.
 * An unnarrowable payload yields "", which matches nothing; the writer then refuses it itself.
 */
export function proposedPayloadDigestOf(prepared: {
  readonly actionKind: string;
  readonly toolId: string;
  readonly target?: { readonly kind: string; readonly ref: string } | null;
  readonly arguments: unknown;
}): string {
  const payload = asCanonicalPayload(prepared.arguments);
  if (!payload) return "";
  return digestCanonicalAction({
    actionKind: prepared.actionKind,
    toolId: prepared.toolId,
    targetKind: prepared.target?.kind ?? null,
    targetRef: prepared.target?.ref ?? null,
    payload,
  });
}

export type PriorPublicationCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: PublicationGuardRefusal | "persistence-unavailable";
      /** The attempt an intentional new publication must acknowledge, when one exists. */
      readonly detail?: string;
    };

export async function checkPriorPublicationAtProposal(
  tenantId: string,
  identity: PublicationIdentity,
  acknowledgesPriorAttemptId: string | null,
  proposedPayloadDigest: string,
  deps: { readonly getDb?: () => ControlPlaneDatabase | null; readonly now?: () => Date } = {},
): Promise<PriorPublicationCheck> {
  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return { ok: false, reason: "persistence-unavailable" };
  let entries;
  try {
    ({ entries } = await readRevisionPublicationHistory(db, tenantId, identity.artifactRef, (deps.now ?? (() => new Date()))(), {
      limit: null,
    }));
  } catch {
    return { ok: false, reason: "persistence-unavailable" };
  }
  const verdict = evaluatePublicationGuard(entries, identity, acknowledgesPriorAttemptId, { at: "proposal", proposedPayloadDigest });
  if (verdict.status === "clear") return { ok: true };
  return {
    ok: false,
    reason: verdict.reason,
    ...(verdict.latestConsequentialAttemptId ? { detail: `latest-attempt=${verdict.latestConsequentialAttemptId}` } : {}),
  };
}
