/**
 * The one audit writer for P4 operator authority (MFA design gate O3).
 *
 * Every grant, revoke and MFA management act — at the ceremony terminal or in the app — writes one
 * `audit_log` row through this function. Reused table, no new audit system.
 *
 * CALLED INSIDE THE ACT'S TRANSACTION for every state change, so a failed insert rolls the change
 * back: no grant, revoke, enrollment or elevation exists without its row.
 *
 * WHAT CAN NEVER BE IN A ROW. The input type has no field for a secret, a code, an `otpauth://` URI
 * or a password, and `metadata` is built here from named fields only — a caller cannot pass an
 * arbitrary object through.
 */
import type { ControlPlaneDatabase } from "@/db/client.server";
import { auditLog } from "@/db/schema/audit-log";

export type OperatorAuditAction =
  | "platform.operator.grant"
  | "platform.operator.revoke"
  | "auth.mfa.enroll"
  | "auth.mfa.revoke"
  | "auth.mfa.verify";

export type OperatorAuditEntity = "platform_operator_grant" | "auth_mfa_credential" | "auth_identity";

export interface OperatorAuditRecord {
  /** The verified human who acted (users.id). Never taken from input. */
  readonly actorUserId: string;
  readonly action: OperatorAuditAction;
  readonly entityType: OperatorAuditEntity;
  readonly entityId: string;
  /** The identity the act was about. */
  readonly targetAuthIdentityId: string;
  readonly result: "committed" | "rejected";
  /** The ceremony's mandatory reason, or the in-app event's fixed description. */
  readonly reason: string;
  /** Recorded when no operator existed yet and the act ran under the bootstrap rule. */
  readonly bootstrap?: boolean;
  /** Why a rejected attempt was refused — a fixed vocabulary, never free text from input. */
  readonly refusal?: "invalid-code" | "locked" | "replayed" | "unavailable" | "not-operator" | "no-credential";
  /** Status/timestamps only — never secret material. */
  readonly previousState?: Readonly<Record<string, string | null>>;
  readonly nextState?: Readonly<Record<string, string | null>>;
  readonly source: "operator-ceremony" | "admin-mfa-challenge";
  readonly sessionContextId?: string;
  readonly requestId?: string;
  readonly occurredAt: Date;
}

export async function writeOperatorAudit(
  writer: Pick<ControlPlaneDatabase, "insert">,
  record: OperatorAuditRecord,
): Promise<void> {
  await writer.insert(auditLog).values({
    tenantId: null,
    actorType: "human",
    actorId: record.actorUserId,
    action: record.action,
    entityType: record.entityType,
    entityId: record.entityId,
    occurredAt: record.occurredAt,
    previousState: record.previousState ?? null,
    nextState: record.nextState ?? null,
    metadata: {
      reason: record.reason,
      targetAuthIdentityId: record.targetAuthIdentityId,
      bootstrap: record.bootstrap === true,
      ...(record.refusal ? { refusal: record.refusal } : {}),
    },
    result: record.result,
    simulation: false,
    source: record.source,
    requestId: record.requestId,
    sessionContextId: record.sessionContextId,
    authoritySource: record.bootstrap ? "system" : "platform-admin",
  });
}

/** Platform Admin read-only views (operator principal D4/D5). */
export type AdminViewName = "overview" | "organizations" | "organization" | "usage" | "status";

export interface AdminViewAuditRecord {
  readonly actorUserId: string;
  readonly view: AdminViewName;
  /** The tenant viewed, or null for a platform-wide view (D5). */
  readonly tenantId: string | null;
  /** The viewed tenant, or the operator's own identity for a platform-wide view. */
  readonly entityType: "company" | "auth_identity";
  readonly entityId: string;
  /** `committed` — the read succeeded; `rejected` — it failed and nothing was shown. */
  readonly result: "committed" | "rejected";
  readonly sessionContextId: string;
  readonly requestId: string;
  readonly occurredAt: Date;
}

/**
 * One row per admin view (D5): `platform.admin.view.<view>`. Carries identifiers only — no tenant
 * content, no counts, no secret. A failure throws, and the caller then returns no data.
 */
export async function writeAdminViewAudit(
  writer: Pick<ControlPlaneDatabase, "insert">,
  record: AdminViewAuditRecord,
): Promise<void> {
  await writer.insert(auditLog).values({
    tenantId: record.tenantId,
    actorType: "human",
    actorId: record.actorUserId,
    action: `platform.admin.view.${record.view}`,
    entityType: record.entityType,
    entityId: record.entityId,
    occurredAt: record.occurredAt,
    previousState: null,
    nextState: null,
    metadata: null,
    result: record.result,
    simulation: false,
    source: "platform-admin-view",
    requestId: record.requestId,
    sessionContextId: record.sessionContextId,
    authoritySource: "platform-admin",
  });
}
