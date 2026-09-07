/*
 * content-observation/growth-origination-brief.ts — how a live public observation is SPOKEN to a
 * model that is about to decide whether ONE bounded organizational work proposal is justified
 * (TRH-20). Pure.
 *
 * ── WHY THIS IS A SIBLING OF THE RELEASED BRIEF AND NOT A WIDENING OF IT ────
 *
 * CGO-7 released a fence for a model that is WRITING A DRAFT. Two of its sentences are
 * load-bearing there and would be wrong here:
 *
 *     "You may let this observation inform HOW you write …"
 *     "… you must NOT recommend, rank, or prescribe what this organization should make next."
 *
 * A draft is prose the organization will put its name to, so a prescription smuggled into it
 * arrives dressed as the organization's own finding. That reasoning has not expired. It is simply
 * about a different act.
 *
 * ORIGINATION IS THE OTHER ACT. The model is not writing anything the organization will publish;
 * it is deciding whether to ASK a human to record a piece of work, and every reply it can make is
 * refused, filed as `pending`, or nothing at all. A proposal is a request, never a claim and never
 * a decision — the released origination path already proves that structurally: no permit, no
 * approval, no execution and no Governance decision is reachable from it.
 *
 * So the fence was not loosened. It was FORKED, and the fork changes exactly one thing: the model
 * may let the observation inform WHETHER work is worth proposing and what that work is called.
 * Everything the released fence denies about a number, this one denies in the same words.
 *
 * ── WHAT THIS FENCE MUST KEEP TRUE ──────────────────────────────────────────
 *
 *     provider observation  !=  organizational Knowledge
 *     observation           !=  recommendation
 *     recommendation        !=  decision
 *     a proposal            !=  a claim
 *     views/likes/comments  !=  content quality
 *     a high number         !=  success
 *     absent                !=  zero
 *     unavailable metric    !=  a metric you may estimate
 *
 * The last line is this phase's own addition. A model asked "what should we do about this channel"
 * will reach for watch time, retention, click-through rate, impressions, traffic sources, search
 * terms, audience demographics, conversion and revenue — none of which the released provider
 * contract can return. Their absence is stated as an absence, and inventing one is forbidden by
 * name rather than left to inference.
 *
 * ── WHAT THIS MODULE MAY IMPORT ─────────────────────────────────────────────
 *
 * Types only, plus the shared FACTS renderer. It performs no I/O, holds no key, reaches no
 * provider, resolves no tenant and reads no database. It turns a value it is handed into sentences.
 */
import type { YouTubeChannelObservation } from "@/features/provider-youtube/contracts";
import { OBSERVATION_FACTS_HEADER, observationFactsFor } from "./observation-brief";

/** The provider whose observation this brief speaks. One provider, named, never generalised. */
export const GROWTH_OBSERVATION_PROVIDER_LABEL = "YouTube" as const;

/**
 * Metrics a growth question invites and this provider CANNOT answer. Named one by one, because a
 * general sentence about "other metrics" is a rule a model can read past without noticing.
 *
 * Every one of these is a real YouTube concept that exists somewhere — in the channel owner's
 * studio, or behind an analytics grant this organization does not hold. That is precisely why they
 * must be denied here: they are plausible, not absurd.
 */
export const UNAVAILABLE_GROWTH_METRICS: readonly string[] = Object.freeze([
  "watch time",
  "average view duration",
  "audience retention",
  "click-through rate",
  "impressions",
  "traffic sources",
  "search terms",
  "audience demographics",
  "subscriber gains or losses",
  "conversions",
  "revenue",
]);

/**
 * The fence, as the sentences the model receives verbatim ahead of any number. Exported so a test
 * can assert the exact words rather than a paraphrase of them.
 *
 * Every line either restricts what may be CLAIMED or states what may be PROPOSED. None of them may
 * be read as permission to publish, schedule, post, approve, authorize, or address a platform as a
 * system — and the released origination contract could not represent any of those even if a model
 * tried, because the only kinds it can name are the two the server admitted.
 */
export const GROWTH_OBSERVATION_FENCE: readonly string[] = [
  "The following block is a PUBLIC PLATFORM OBSERVATION, not part of the grounding context and not one of this organization's records.",
  `It is what ${GROWTH_OBSERVATION_PROVIDER_LABEL} publicly reported about a public channel at the single moment it was read, through a read-only public API key.`,
  "It is NOT organizational knowledge, NOT a record this organization established, NOT verified, NOT ratified, and NOT authoritative. Nothing in it was stored anywhere.",
  "It says nothing about who owns, runs, or is connected to that channel.",
  "A view, like or comment count is a count. It is not a measure of quality, not evidence that anything performed well, not evidence that anything sold, reached, persuaded or was even watched, and a high number is not success.",
  "A count that is absent was withheld or not reported by the platform. Absent is not zero.",
  `This observation contains ONLY the figures printed below. ${UNAVAILABLE_GROWTH_METRICS.join(", ")} are NOT available to you here, and you must not state, estimate, approximate or infer any of them.`,
  "You may let this observation inform WHETHER organizational work is worth proposing, and what that work should be called.",
  "A proposal is a request for a human to read and decide on. It is not a claim, not a finding, not a measurement and not a decision, and nothing you propose happens because you proposed it.",
  "Your reason may say what you observed and what you are asking for. It must NOT say that any number here proves, shows or explains anything, and it must NOT give a cause for any number.",
  "You must NOT present any figure here as this organization's own fact, and you must NOT put any of these figures in the work title.",
  "If this observation and the grounding context disagree, the grounding context is this organization's record and this block is an outside number. Neither corrects the other and you must not resolve them.",
  'Proposing nothing is still a correct answer. If this observation gives you no honest reason to ask for work, reply with kind "none".',
] as const;

/**
 * Claims that must never appear in the RENDERED FACTS of a growth observation block.
 *
 * Deliberately the same discipline as the released list, and deliberately its own constant: the
 * two fences may diverge, and a shared list would make one phase's edit silently rewrite the
 * other's guarantee. A test asserts both lists are read over the same facts and both hold.
 */
export const GROWTH_OBSERVATION_FORBIDDEN_CLAIMS: readonly string[] = Object.freeze([
  "performed well",
  "performed best",
  "top performing",
  "best performing",
  "underperformed",
  "successful",
  "success",
  "winner",
  "viral",
  "trending",
  "engagement rate",
  "you should",
  "we recommend",
  "recommended",
  "optimize",
  "publishing",
  "schedule",
]);

/**
 * Render one observation as the supplement appended AFTER the released origination candidates.
 *
 * The FACTS are the released renderer's, byte for byte. This module contributes a fence and
 * nothing else — it cannot round a number, reorder a video, or add an adjective, because it never
 * touches the numbers at all.
 */
export function growthObservationSupplementFor(observation: YouTubeChannelObservation): string {
  return [...GROWTH_OBSERVATION_FENCE, "", observationFactsFor(observation)].join("\n");
}

export { OBSERVATION_FACTS_HEADER };
