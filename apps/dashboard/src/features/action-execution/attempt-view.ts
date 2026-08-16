/*
 * action-execution/attempt-view.ts — one row-to-view mapping (R3B, pure).
 *
 * It exists so the runtime and the reader cannot drift into two shapes of the same attempt. R3R
 * established the pattern for the same reason: when two modules each build their own view, one of
 * them eventually forgets a field and a surface quietly shows less than the other.
 *
 * THE VIEW CARRIES NO ADDRESS, NO CONTENT, NO CREDENTIAL AND NO PROVIDER BODY — because the ROW
 * carries none of them. There is nothing here to redact, which is stronger than remembering to.
 *
 * Pure. No I/O, no database, no clock, no authority.
 */
import type {
  ExecutionAttemptStatus,
  ExecutionAttemptView,
  ExecutionFailureClass,
  ProviderResponseClass,
} from "./contracts";

/** The columns every read selects. Structural, so a missed column is a type error, not a bug. */
export interface ExecutionAttemptRow {
  readonly id: string;
  readonly permitId: string;
  readonly handoffId: string;
  readonly actionRequestId: string;
  readonly actionKind: string;
  readonly adapterId: string;
  readonly status: ExecutionAttemptStatus;
  readonly providerResponseClass: ProviderResponseClass | null;
  readonly providerMessageId: string | null;
  readonly failureClass: ExecutionFailureClass | null;
  readonly recipientId: string;
  readonly startedAt: Date;
  readonly completedAt: Date | null;
}

export function toExecutionAttemptView(row: ExecutionAttemptRow): ExecutionAttemptView {
  return {
    attemptId: row.id,
    permitId: row.permitId,
    handoffId: row.handoffId,
    requestId: row.actionRequestId,
    actionKind: row.actionKind,
    adapterId: row.adapterId,
    status: row.status,
    providerResponseClass: row.providerResponseClass,
    providerMessageId: row.providerMessageId,
    failureClass: row.failureClass,
    recipientId: row.recipientId,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  };
}
