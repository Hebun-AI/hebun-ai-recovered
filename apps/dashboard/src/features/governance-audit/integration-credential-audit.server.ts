/*
 * governance-audit/integration-credential-audit.server.ts — the credential lifecycle's record.
 *
 * ── ONE AUDIT AUTHORITY, NOT TWO ─────────────────────────────────────────────
 *
 * `audit_log` already is Hebun's record of authority-bearing acts, and nine writers share it. A
 * second table for credentials would split the history of one tenant across two authorities that
 * would eventually disagree about the order of events. So this is another writer, not another
 * subsystem, and it sits beside `integration-lifecycle-audit.server.ts` under the same owner.
 *
 * ── A DIFFERENT ENTITY TYPE, ON PURPOSE ──────────────────────────────────────
 *
 * `integration_credential`, not `integration`. I1's released contract states that exactly two
 * actions exist on `entity_type = 'integration'` and a test asserts it. A credential event is
 * about a different row with a different lifecycle; giving it its own entity type keeps that
 * released claim true instead of quietly widening it.
 *
 * ── WHAT MAY NEVER REACH A ROW HERE ──────────────────────────────────────────
 *
 * NO plaintext. NO ciphertext. NO IV. NO auth tag. NO key material. NO fingerprint — there is not
 * one anywhere in this phase. The metadata type has no field any of them could occupy, and a test
 * scans every written row's serialization for a known fixture secret rather than trusting this
 * paragraph.
 *
 * `algorithm` and `keyId` ARE recorded. They are operational facts — which cipher, which
 * deployment key — and neither helps anyone open anything. Rotation auditing depends on being able
 * to see them.
 *
 * ── WHY THERE IS NO KEY-ROTATION EVENT HERE ──────────────────────────────────
 *
 * `audit_log.actor_id` and `actor_type` are NOT NULL. The rotation ceremony is run from a terminal
 * by an operator Hebun cannot identify, and `scripts/provider-connectivity.ts` already refused
 * this same trade in its own words: a terminal has no actor to name. Writing `system` would
 * attribute a person's act to a principal that does not exist.
 *
 * So rotation writes NO audit row. Its evidence is the `key_id` movement on the credential rows
 * themselves — durable, countable, and verifiable long after the terminal is closed. A real
 * platform principal is a later authority phase, and this comment is the placeholder for it.
 *
 * Server-only.
 */
import { auditLog } from "@/db/schema/audit-log";
import type { ControlPlaneDatabase } from "@/db/client.server";
import type { ConnectionState } from "@/features/integration-authority/contracts";
import {
  CREDENTIAL_AUDIT_DESTROYED,
  CREDENTIAL_AUDIT_REPLACED,
  CREDENTIAL_AUDIT_REVOKED,
  CREDENTIAL_AUDIT_SOURCE,
  CREDENTIAL_AUDIT_STORED,
  INTEGRATION_CREDENTIAL_ENTITY_TYPE,
  type IntegrationCredentialKind,
} from "@/features/integration-credentials/contracts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The control-plane database OR an open transaction on it, so audit joins the write. */
export type CredentialAuditWriter = Pick<ControlPlaneDatabase, "insert">;

/** Server-resolved acting authority. No shape here for a client value to arrive in. */
export interface CredentialAuditActor {
  readonly tenantId: string;
  readonly userId: string;
  readonly requestId?: string;
  readonly sessionContextId?: string;
}

export type CredentialAuditAction =
  | typeof CREDENTIAL_AUDIT_STORED
  | typeof CREDENTIAL_AUDIT_REPLACED
  | typeof CREDENTIAL_AUDIT_REVOKED
  | typeof CREDENTIAL_AUDIT_DESTROYED;

/**
 * Identity and shape only. Every field is safe to read in a breach.
 *
 * `connectionState` is what the CONNECTION's lifecycle became as a result, or `null` when the act
 * did not touch it. It is recorded here rather than as a second event on `entity_type =
 * 'integration'` because one act should leave one record — two rows describing one transaction is
 * how a history starts contradicting itself.
 */
export interface CredentialAuditMetadata {
  readonly integrationId: string;
  readonly kind: IntegrationCredentialKind;
  readonly algorithm: string;
  readonly keyId: string;
  /** The row a replacement superseded, so the chain is walkable. `null` otherwise. */
  readonly previousCredentialId: string | null;
  readonly connectionState: ConnectionState | null;
}

export type CredentialAuditOutcome = "committed" | "rejected";

export interface CredentialAuditEvent {
  readonly action: CredentialAuditAction;
  readonly outcome: CredentialAuditOutcome;
  /** The `integration_credentials` row this event is about. */
  readonly entityId: string;
  readonly metadata: CredentialAuditMetadata;
}

/**
 * Append one credential lifecycle event.
 *
 * `writer` is the open transaction that is writing the credential, which is what makes "stored"
 * and "history says stored" one fact: committed-but-unaudited and audited-but-rolled-back are both
 * excluded by the transaction rather than by hoping. A failing audit insert aborts the write, and
 * a test proves exactly that by making this throw.
 */
export async function recordCredentialEventWithin(
  writer: CredentialAuditWriter,
  actor: CredentialAuditActor,
  event: CredentialAuditEvent,
  now: Date = new Date(),
): Promise<void> {
  await writer.insert(auditLog).values({
    tenantId: actor.tenantId,
    /* A human acting through the product. Never accepted from input, never inferred. */
    actorType: "human",
    actorId: actor.userId,
    action: event.action,
    entityType: INTEGRATION_CREDENTIAL_ENTITY_TYPE,
    entityId: event.entityId,
    occurredAt: now,
    metadata: event.metadata,
    result: event.outcome,
    /*
     * Not a simulation. Sealing a tenant's real secret into a real row is a real, durable act —
     * what has NOT happened is verification, and the absence of a `verified` field says so by
     * having nowhere to claim it.
     */
    simulation: false,
    source: CREDENTIAL_AUDIT_SOURCE,
    requestId: actor.requestId,
    sessionContextId:
      actor.sessionContextId && UUID_RE.test(actor.sessionContextId)
        ? actor.sessionContextId
        : undefined,
    authoritySource: "membership",
  });
}
