/*
 * provider-observation-history/record-instagram-account-observation.server.ts — the Instagram
 * account observation, expressed as this authority's own facts.
 *
 * ── WHY THE MAPPER LIVES HERE AND NOT IN THE PROVIDER ───────────────────────
 *
 * The same placement the released YouTube mapper argues for. A firewall asserts that every file
 * under `provider-instagram/` touches no table; a mapper that produced this authority's storage
 * shape from inside the provider would make the provider module the owner of a sentence it does not
 * own. `ObservationFacts` is Provider Observation History's vocabulary, so the translation into it
 * happens here.
 *
 * ── FIVE FACTS, AND NOT ONE MORE ────────────────────────────────────────────
 *
 * Identity and three counts. No insights, no media list, no comments — none of them was read, none
 * was authorized, and none may appear here later without a capability that asks for it.
 *
 * ── `null` SURVIVES AS `null` ───────────────────────────────────────────────
 *
 * A count Instagram declined to report stays `null` all the way into storage. It is NOT zero: a new
 * account with no followers and an account whose count was withheld are different facts, and the
 * whole reason `ObservationValue` admits `null` is so a mapper cannot quietly merge them.
 *
 * Server-only.
 */
import {
  INSTAGRAM_ACCOUNT_SUBJECT_KIND,
  type InstagramAccountObservation,
} from "@/features/provider-instagram/contracts";
import type { ObservationFacts } from "./contracts";

/** The subject kind this provider's observations carry, re-exported for the composition. */
export const INSTAGRAM_SUBJECT_KIND = INSTAGRAM_ACCOUNT_SUBJECT_KIND;

/**
 * The five authoritative facts, exactly as Instagram reported them.
 *
 * `accountId` is included even though it is also the subject reference, because a stored observation
 * must be readable without resolving the authorization that caused it.
 */
export function instagramAccountObservationFacts(
  observation: InstagramAccountObservation,
): ObservationFacts {
  const account = observation.account;
  return Object.freeze({
    accountId: account.accountId,
    username: account.username,
    accountType: account.accountType,
    followersCount: account.followersCount,
    followsCount: account.followsCount,
    mediaCount: account.mediaCount,
  });
}
