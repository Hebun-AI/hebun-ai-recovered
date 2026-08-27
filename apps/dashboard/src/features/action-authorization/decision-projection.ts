/*
 * action-authorization/decision-projection.ts — how a stored request becomes what a human reads
 * (APP-2).
 *
 * PURE, AND DELIBERATELY SEPARATE FROM THE READER. These functions decide the three questions APP-2
 * turned on — is evidence attached, absent, or unreadable; which payload keys are decision facts and
 * which are integrity values; what a lock is called — and every one of them is branching logic that
 * a type signature cannot check. The reader that calls them imports the schema barrel, so a test
 * that reached them through it would drag the whole database module graph in to exercise two pure
 * functions. Here they are reachable on their own and are executed by the firewall against
 * constructed rows.
 *
 * NO AUTHORITY, NO I/O, NO STATE. This module reads nothing, writes nothing, and resolves nothing.
 * It converts values that have already been read into values that can honestly be rendered.
 */

/*
 * One evidence entry, exactly as the proposal recorded it. Nothing is resolved, enriched or
 * followed: the reference is the source's own handle, and this surface never dereferences it.
 */
export interface EvidenceReferenceView {
  readonly sourceClass: string;
  readonly recordRef: string;
  readonly lifecycle: string;
}

/*
 * WHY EVIDENCE IS A THREE-STATE PROJECTION AND NOT AN ARRAY.
 *
 * "The proposal attached no evidence" and "the stored evidence could not be interpreted" are
 * different facts, and an empty array says the first while meaning either. APP-2 exists because this
 * surface stated an absence it had not established, so the projection that repairs it may not
 * reintroduce the same collapse one layer down.
 *
 *   attached   — the column held a well-formed, non-empty set. Every entry parsed.
 *   none       — the column was NULL or empty. The proposal recorded no evidence; a real answer.
 *   unreadable — the column held something this reader cannot interpret. UNKNOWN, never empty.
 *
 * A partially-parseable set is `unreadable`, not a truncated `attached`. Silently dropping the
 * entries that failed would present a smaller evidence set as if it were the whole one — the more
 * dangerous of the two errors in front of an irreversible decision.
 */
export type EvidenceProjection =
  | { readonly status: "attached"; readonly items: readonly EvidenceReferenceView[] }
  | { readonly status: "none" }
  | { readonly status: "unreadable" };

/*
 * An integrity value that freezes one argument of the proposal, presented as what it MEANS.
 *
 * The raw digest stays available for inspection — it is not a secret, and removing it would take
 * away the operator's ability to check a binding by hand. It simply is not a primary decision fact:
 * a human authorizes "this exact revision", not a hex string.
 */
export interface PayloadLockView {
  readonly name: string;
  /** Human phrase derived from the key. Never a hard-coded per-action label. */
  readonly label: string;
  readonly value: string;
}

/*
 * A payload key naming an integrity value. The convention is the SUFFIX, not a list of known keys:
 * a per-action allow-list would silently render the next action kind's digest as a decision fact,
 * which is the defect being repaired here, one action kind later.
 */
export const DIGEST_KEY = /Digest$/;

/** `recipientEndpointDigest` -> "Recipient endpoint locked". Derived, never hard-coded per action. */
export function lockLabel(name: string): string {
  const words = name
    .replace(DIGEST_KEY, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .trim();
  if (words.length === 0) return "Locked";
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} locked`;
}

/*
 * Split an already-validated canonical payload into what a human decides on and what merely freezes
 * it. Both halves come from the same payload and neither is dropped.
 *
 * PRESENTATION ONLY. `payloadDigest` is computed server-side over the whole payload and is what a
 * permit binds to, so nothing here can weaken the binding — a lock shown as a phrase rather than a
 * hex string is bound exactly as tightly as before.
 */
export function splitPayload(payload: Readonly<Record<string, string | number | boolean>> | null): {
  parameters: readonly { name: string; value: string }[];
  locks: readonly PayloadLockView[];
} {
  if (!payload) return { parameters: [], locks: [] };
  const parameters: { name: string; value: string }[] = [];
  const locks: PayloadLockView[] = [];
  for (const name of Object.keys(payload).sort()) {
    const value = String(payload[name]);
    if (DIGEST_KEY.test(name)) locks.push({ name, label: lockLabel(name), value });
    else parameters.push({ name, value });
  }
  return { parameters, locks };
}

/*
 * Project the stored evidence, or say honestly that it cannot be projected. Nothing is
 * dereferenced, resolved or enriched — an entry is carried exactly as the proposal recorded it.
 */
export function toEvidence(raw: unknown): EvidenceProjection {
  if (raw === null || raw === undefined) return { status: "none" };
  if (!Array.isArray(raw)) return { status: "unreadable" };
  const items: EvidenceReferenceView[] = [];
  for (const entry of raw) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      return { status: "unreadable" };
    }
    const { sourceClass, recordRef, lifecycle } = entry as Record<string, unknown>;
    if (typeof sourceClass !== "string" || typeof recordRef !== "string") {
      return { status: "unreadable" };
    }
    items.push({
      sourceClass,
      recordRef,
      lifecycle: typeof lifecycle === "string" ? lifecycle : "unknown",
    });
  }
  /*
   * An empty set is an absence, not an attachment of nothing. NULL and `[]` mean the same thing to a
   * human: this proposal carried no evidence.
   */
  return items.length === 0 ? { status: "none" } : { status: "attached", items };
}
