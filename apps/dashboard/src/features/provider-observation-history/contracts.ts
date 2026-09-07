/*
 * provider-observation-history/contracts.ts — the vocabulary of a stored provider utterance
 * (TRH-21). Pure.
 *
 * ── THE ONE SENTENCE THIS AUTHORITY OWNS ─────────────────────────────────────
 *
 *   "Provider P reported these typed facts about subject S at instant T, read through connection C."
 *
 * Nothing wider. This module holds no trend, no delta, no rate, no score, no projection, no
 * recommendation, no interpretation and no summary — none of them is representable in these types,
 * on purpose. A shape that cannot express a judgement cannot leak one.
 *
 * ── PROVIDER-NEUTRAL BY CONSTRUCTION ─────────────────────────────────────────
 *
 * Nothing here names YouTube. "GitHub reported X at T", "a workspace provider reported Y at T" and
 * "a social provider reported Z at T" are the same sentence with a different subject, and a design
 * that needed a special case for one provider would be evidence the authority had been drawn around
 * a feature instead of around a truth.
 *
 * The provider-specific part is the FACTS MAPPER, which lives beside the composition that owns one
 * provider — not here.
 *
 * ── WHAT MAY NEVER BE REPRESENTED ────────────────────────────────────────────
 *
 * No credential, no token, no request URL, no header, no raw provider response, no model output and
 * no prompt. `ObservationFacts` is a closed record of JSON scalars and arrays of them; there is no
 * field a payload could arrive through.
 */

/** How a subject is identified. One value per provider concept, added by migration, never by data. */
export const OBSERVATION_SUBJECT_KINDS = ["youtube-channel"] as const;
export type ObservationSubjectKind = (typeof OBSERVATION_SUBJECT_KINDS)[number];

/**
 * A value a provider can report.
 *
 * `null` is a FIRST-CLASS VALUE and means the provider withheld or did not report it. It is NOT
 * zero, and no mapper may coalesce one into the other — "absent is not zero" is the rule this union
 * exists to keep representable all the way into storage.
 */
export type ObservationValue = string | number | boolean | null;

/** The typed projection of what a provider reported. Closed to scalars and arrays of records. */
export interface ObservationFacts {
  readonly [key: string]: ObservationValue | readonly ObservationValue[] | readonly ObservationFacts[];
}

/**
 * WHAT THE WRITER IS HANDED. Every field is server-derived: the tenant from the authorized context,
 * the connection from the capability authority, the provider and capability from released
 * constants, the subject from the PROVIDER'S OWN response, and the instant from the read seam.
 *
 * There is deliberately no field for a caller-supplied tenant, actor, connection or subject, and no
 * field for anything the provider did not say.
 */
export interface ProviderObservationRecord {
  readonly providerKey: string;
  readonly capabilityKey: string;
  readonly subjectKind: ObservationSubjectKind;
  /** The provider's own stable identifier for the subject, never a name a human typed. */
  readonly subjectRef: string;
  /** The connection the capability authority chose, as the read seam reported it. */
  readonly integrationId: string;
  /** Hebun's read instant, UTC, as the released observation seam recorded it. */
  readonly observedAt: string;
  readonly facts: ObservationFacts;
}

/**
 * What became of a write.
 *
 * `already-recorded` is a SUCCESS, not an error: it is the idempotency contract answering. It means
 * this exact subject at this exact instant is already on record, so a replay wrote nothing — which
 * is the whole point of writing the instant into the key rather than comparing values.
 */
export type ProviderObservationWriteResult =
  | { readonly status: "recorded"; readonly observationId: string }
  | { readonly status: "already-recorded" }
  | { readonly status: "refused"; readonly reason: ProviderObservationRefusal };

export type ProviderObservationRefusal =
  /** No authorized tenant context. Nothing is written without one, ever. */
  | "unauthenticated"
  /** The persistence seam could not be reached. Nothing was written and nothing is claimed. */
  | "persistence-unavailable"
  /** The record did not satisfy the contract above — a blank reference, an unusable instant. */
  | "invalid-observation";

/** One stored observation, as a reader sees it. */
export interface StoredProviderObservation {
  readonly observationId: string;
  readonly providerKey: string;
  readonly capabilityKey: string;
  readonly subjectKind: string;
  readonly subjectRef: string;
  readonly integrationId: string;
  readonly observedAt: string;
  readonly recordedAt: string;
  readonly observedByActorType: string;
  readonly facts: ObservationFacts;
}

/**
 * A canonical serialization of facts, used ONLY to compute a content digest.
 *
 * Keys are sorted so two structurally equal fact sets serialize identically. The digest is a
 * DIAGNOSTIC: nothing branches on it, no uniqueness rests on it, and it never participates in the
 * idempotency decision — which is about the INSTANT, never about the values.
 */
export function canonicalizeFacts(facts: ObservationFacts): string {
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk);
    if (value !== null && typeof value === "object") {
      const source = value as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(source).sort()) out[key] = walk(source[key]);
      return out;
    }
    return value;
  };
  return JSON.stringify(walk(facts));
}

/** Every key a caller may name in a write. Asserted by test; a payload has no way in. */
export const PROVIDER_OBSERVATION_RECORD_KEYS: readonly string[] = Object.freeze([
  "providerKey",
  "capabilityKey",
  "subjectKind",
  "subjectRef",
  "integrationId",
  "observedAt",
  "facts",
]);
