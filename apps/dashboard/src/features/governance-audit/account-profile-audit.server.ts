/*
 * governance-audit/account-profile-audit.server.ts — V1-STAGE-4. One audit row when a person changes
 * their own display name, written inside the caller's transaction. Records THAT it changed (or was
 * cleared) and the profile version — never the name itself: names stay in Identity.
 */
import { auditLog } from "@/db/schema/audit-log";
import { ACCOUNT_DISPLAY_NAME_CHANGED, ACCOUNT_PROFILE_ENTITY_TYPE } from "@/features/account-profile/contracts";
import type { AuditActor, AuditWriter } from "./knowledge-mutation-audit.server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function recordDisplayNameChangeWithin(
  writer: AuditWriter,
  actor: AuditActor,
  change: { readonly cleared: boolean; readonly previousVersion: number; readonly version: number },
  now: Date,
): Promise<void> {
  await writer.insert(auditLog).values({
    tenantId: actor.tenantId,
    actorType: "human",
    actorId: actor.userId,
    action: ACCOUNT_DISPLAY_NAME_CHANGED,
    entityType: ACCOUNT_PROFILE_ENTITY_TYPE,
    entityId: actor.userId,
    occurredAt: now,
    previousState: { version: change.previousVersion },
    nextState: { version: change.version },
    metadata: { field: "display_name", cleared: change.cleared },
    result: "committed",
    simulation: false,
    source: "account-profile",
    requestId: actor.requestId,
    sessionContextId: actor.sessionContextId && UUID_RE.test(actor.sessionContextId) ? actor.sessionContextId : undefined,
    authoritySource: "membership",
  });
}
