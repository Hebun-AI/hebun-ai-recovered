/*
 * scripts/lib/ap4-release-b-blockers.ts — which unscoped `record-work` items Release B would take away.
 *
 * A blocker is an item that, after Release B, a human could still DECIDE or the system could still
 * SPEND. An item no released path can ever move again is history, not a blocker. That is read from
 * the lifecycle the authorities already enforce, not assumed:
 *
 *   pending   → decidable. approveActionRequest / rejectActionRequest and the standing issuer act
 *               only on `status = 'pending'`.                                         BLOCKER
 *   approved  → both approval paths (decide-action-request, issue-permit-under-standing-authorization)
 *               flip pending→approved AND insert the permit in ONE transaction, and
 *               `action_permits_request_uq` allows ONE permit per request, ever. So an approved
 *               request's only future is its own permit:
 *                 permit active and `expires_at > now()`  → spendable (consumeActionPermit). BLOCKER
 *                 permit consumed                         → spent; for record-work the work row was
 *                                                           written in that same transaction.  history
 *                 permit revoked, or expired              → consumeActionPermit refuses (status =
 *                                                           'active' AND expires_at > now(), database
 *                                                           clock); no second permit can exist. history
 *               An approved request with NO permit cannot be produced by a released writer; if one
 *               exists, it is reported, because nothing here can say what it is.        BLOCKER
 *   rejected / withdrawn → terminal.                                                        history
 *
 * Read-only: plain SELECTs on the caller's (read-only) session. Expiry uses the database clock, the
 * same clock consumeActionPermit uses.
 */
import type { Client } from "pg";

export interface UnscopedRequestBlocker {
  readonly slug: string;
  readonly id: string;
  readonly status: "pending" | "approved";
}
export interface UnscopedPermitBlocker {
  readonly slug: string;
  readonly id: string;
  readonly request: string;
}

/** Requests a human can still decide, and approved requests with no permit at all (an anomaly). */
export async function readUnscopedRecordWorkRequestBlockers(client: Client): Promise<readonly UnscopedRequestBlocker[]> {
  return (
    await client.query<UnscopedRequestBlocker>(
      `select c.slug, q.id, q.status from heby_action_requests q join companies c on c.id = q.tenant_id
        where q.action_kind = 'record-work' and not (q.canonical_payload ? 'workScope')
          and (q.status = 'pending'
               or (q.status = 'approved'
                   and not exists (select 1 from action_permits p
                                    where p.action_request_id = q.id and p.tenant_id = q.tenant_id)))
        order by c.slug, q.created_at`,
    )
  ).rows;
}

/** Permits the system can still spend: active and not yet expired by the database clock. */
export async function readUnscopedRecordWorkPermitBlockers(client: Client): Promise<readonly UnscopedPermitBlocker[]> {
  return (
    await client.query<UnscopedPermitBlocker>(
      `select c.slug, p.id, p.action_request_id request from action_permits p
         join heby_action_requests q on q.id = p.action_request_id and q.tenant_id = p.tenant_id
         join companies c on c.id = p.tenant_id
        where q.action_kind = 'record-work' and p.status = 'active' and p.expires_at > now()
          and not (q.canonical_payload ? 'workScope') order by c.slug`,
    )
  ).rows;
}
