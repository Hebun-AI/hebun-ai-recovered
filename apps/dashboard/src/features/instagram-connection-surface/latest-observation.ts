/*
 * instagram-connection-surface/latest-observation.ts — what Instagram said, and when.
 *
 * ── THE ONE SENTENCE THIS MODULE IS ALLOWED TO PRODUCE ──────────────────────
 *
 *   "Instagram reported these values at instant T."
 *
 * NOT "this organization has N followers". A stored observation is a record that a provider said
 * something once; it is not a statement of what is true now, and it is not organizational
 * knowledge. The distance between those two sentences is the whole reason this projection exists
 * instead of the page reading rows itself.
 *
 * ── A PURE PROJECTION, AND NOTHING ELSE ─────────────────────────────────────
 *
 * It queries nothing, reaches no provider, decrypts nothing and writes nothing. It is handed the
 * result the released read seam already produced and narrows it to what a human may see.
 *
 * NO DELTA, NO RATE, NO DIRECTION, NO TREND, NO SCORE. The read seam refuses to derive those and
 * this consumer inherits the refusal: with one observation there is nothing to subtract, and a
 * "helpful" comparison here would be the first derived metric in the product, with no owner and no
 * rule about how many samples earn a word.
 *
 * ── WHAT IT REFUSES TO HAND A COMPONENT ─────────────────────────────────────
 *
 * The stored row carries provenance identifiers — the observation id, the connection it was read
 * through, the standing authorization, the invocation. NONE of them reaches the view. They are how
 * Hebun accounts for a read internally; they are not what Instagram reported, and a surface that
 * rendered them would be publishing internal bookkeeping as provider truth.
 *
 * ── AND EVERY FACT IS TREATED AS UNTRUSTED EXTERNAL DATA ────────────────────
 *
 * `ObservationFacts` admits scalars, arrays and nested records, because a provider can say anything.
 * The readers below accept a string only when it IS a string and a count only when it is a finite
 * number; anything else becomes `null` — "Instagram did not report this". That is not defensive
 * decoration: it is what guarantees a component is only ever handed text and numbers, so no shape a
 * provider chose can decide how this page renders.
 *
 * `null` IS NOT ZERO. A count Instagram withheld and a count of zero are different facts, and they
 * are said differently all the way to the screen.
 */
import type {
  ObservationFacts,
  StoredProviderObservation,
} from "@/features/provider-observation-history/contracts";
import type { ProviderObservationReadResult } from "@/features/provider-observation-history/read-provider-observations.server";

/** What a human may see of one stored Instagram observation. Provenance is deliberately absent. */
export interface InstagramObservationView {
  /** Hebun's read instant, UTC, exactly as it was stored. Never a verdict about it. */
  readonly observedAt: string;
  readonly username: string | null;
  readonly accountType: string | null;
  readonly followersCount: number | null;
  readonly followsCount: number | null;
  readonly mediaCount: number | null;
}

/**
 * The three answers this surface can honestly give.
 *
 * `none` and `unavailable` ARE NOT THE SAME and are never collapsed. "Hebun has stored no
 * observation" is a fact; "Hebun could not read its own history" is an admission of ignorance, and
 * rendering the second as the first would state an absence nobody established.
 */
export type InstagramLatestObservation =
  | { readonly status: "observed"; readonly observation: InstagramObservationView }
  | { readonly status: "none" }
  | {
      readonly status: "unavailable";
      readonly reason: "unauthenticated" | "persistence-unavailable";
    };

/** The exact fact keys the released Instagram mapper writes. Named, never discovered. */
const USERNAME = "username";
const ACCOUNT_TYPE = "accountType";
const FOLLOWERS_COUNT = "followersCount";
const FOLLOWS_COUNT = "followsCount";
const MEDIA_COUNT = "mediaCount";

/** A fact is text only when it IS text. Everything else is "not reported". */
function textFact(facts: ObservationFacts, key: string): string | null {
  const value = facts[key];
  return typeof value === "string" ? value : null;
}

/** A count is a count only when it is a finite number. `null`, a string, a shape — all withheld. */
function countFact(facts: ObservationFacts, key: string): number | null {
  const value = facts[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function viewOf(observation: StoredProviderObservation): InstagramObservationView {
  const facts = observation.facts;
  return Object.freeze({
    observedAt: observation.observedAt,
    username: textFact(facts, USERNAME),
    accountType: textFact(facts, ACCOUNT_TYPE),
    followersCount: countFact(facts, FOLLOWERS_COUNT),
    followsCount: countFact(facts, FOLLOWS_COUNT),
    mediaCount: countFact(facts, MEDIA_COUNT),
  });
}

/**
 * Narrow the read seam's answer to the one observation this surface shows.
 *
 * THE SEAM WAS ASKED FOR ONE ROW, so taking the first is taking the newest — the seam orders by
 * observed instant, descending, and this consumer does no ordering of its own.
 */
export function projectLatestInstagramObservation(
  result: ProviderObservationReadResult,
): InstagramLatestObservation {
  if (result.status === "unavailable") {
    return Object.freeze({ status: "unavailable" as const, reason: result.reason });
  }
  const latest = result.observations[0];
  if (!latest) return Object.freeze({ status: "none" as const });
  return Object.freeze({ status: "observed" as const, observation: viewOf(latest) });
}

/** Said instead of a number Instagram withheld. Never `0`, never a dash a reader could misread. */
export const INSTAGRAM_OBSERVATION_UNREPORTED = "Instagram did not report this." as const;

export const INSTAGRAM_OBSERVATION_HEADING = "Latest provider observation" as const;

/**
 * What the section means, said before any number is read.
 *
 * Every clause is load-bearing: Instagram is the speaker, the values belong to an instant, and the
 * denial that this is current organizational truth sits NEXT TO the values rather than somewhere
 * else on the page.
 */
export const INSTAGRAM_OBSERVATION_MEANING: string =
  "This is what Instagram reported at the instant below, kept exactly as it was said. It is a " +
  "record of one provider answer, not a statement of what this organization holds now, and Hebun " +
  "derives nothing from it.";

/** Said when the section can show no observation. One sentence per DIFFERENT fact. */
export const INSTAGRAM_OBSERVATION_ABSENCE: Readonly<
  Record<"none" | "unauthenticated" | "persistence-unavailable", string>
> = Object.freeze({
  /* A FACT. Hebun looked and holds nothing. Not a provider failure and not a refusal. */
  none:
    "Hebun has stored no Instagram observation for this organization. Nothing was asked of " +
    "Instagram and nothing failed.",
  /* AN ADMISSION. Not an absence — no read was authorized to happen at all. */
  unauthenticated:
    "This session could not be resolved, so no stored observation was read. Whether one exists is " +
    "unknown.",
  /* AN ADMISSION. Hebun could not read its OWN history, which says nothing about Instagram. */
  "persistence-unavailable":
    "Hebun could not read its own observation history just now, so whether an observation exists " +
    "is unknown. This is not a statement that there is none.",
});

/** One row of the observation, as label and already-rendered text. */
export interface InstagramObservationRow {
  readonly label: string;
  readonly value: string;
}

/**
 * The observation as rows, in a fixed order.
 *
 * THE LABELS SAY WHAT THE PROVIDER COUNTED, not what the organization has. "Followers Instagram
 * reported" is a longer label than "Followers" for exactly one reason: the short one becomes a
 * claim the moment it is read next to a number.
 */
export function describeInstagramObservation(
  view: InstagramObservationView,
): readonly InstagramObservationRow[] {
  const count = (value: number | null): string =>
    value === null ? INSTAGRAM_OBSERVATION_UNREPORTED : String(value);
  const text = (value: string | null): string => value ?? INSTAGRAM_OBSERVATION_UNREPORTED;

  return Object.freeze([
    Object.freeze({ label: "Account Instagram named", value: text(view.username) }),
    Object.freeze({ label: "Account type Instagram reported", value: text(view.accountType) }),
    Object.freeze({ label: "Followers Instagram reported", value: count(view.followersCount) }),
    Object.freeze({ label: "Following Instagram reported", value: count(view.followsCount) }),
    Object.freeze({ label: "Media Instagram reported", value: count(view.mediaCount) }),
  ]);
}
