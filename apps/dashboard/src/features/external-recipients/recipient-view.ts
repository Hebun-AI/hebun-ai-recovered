/*
 * external-recipients/recipient-view.ts — one row-to-view mapping (R3R, pure).
 *
 * It exists so the writer and the reader cannot drift into two different shapes of the same
 * recipient. R3W learned this the expensive way in other domains: when two modules each build
 * their own view, one of them eventually forgets a field and a surface quietly shows less than the
 * other. One mapping, imported by both.
 *
 * `recordRef` is DERIVED here rather than stored. A stored copy would be a second authority on the
 * same fact, and the two could disagree after any migration that touched ids.
 *
 * Pure. No I/O, no database, no clock, no authority.
 */
import type { RecipientEndpointKind, RecipientStatus, RecipientView } from "./contracts";
import { formatRecipientRef } from "./recipient-ref";

/** The columns every read selects. Structural, so a missed column is a type error, not a bug. */
export interface RecipientRow {
  readonly id: string;
  readonly displayName: string;
  readonly endpointKind: RecipientEndpointKind;
  readonly endpointValue: string;
  readonly endpointDigest: string;
  readonly status: RecipientStatus;
  readonly createdAt: Date;
  readonly createdBy: string | null;
  readonly createdByType: string | null;
}

export function toRecipientView(row: RecipientRow): RecipientView {
  return {
    id: row.id,
    recordRef: formatRecipientRef(row.id),
    displayName: row.displayName,
    endpointKind: row.endpointKind,
    endpointValue: row.endpointValue,
    endpointDigest: row.endpointDigest,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    createdByActorType: row.createdByType,
    createdByActorId: row.createdBy,
  };
}
