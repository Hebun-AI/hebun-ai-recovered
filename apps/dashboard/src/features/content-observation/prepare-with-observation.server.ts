/*
 * content-observation/prepare-with-observation.server.ts — ONE bounded live public observation,
 * spent on ONE content-draft preparation (CGO-7).
 *
 * ── THE COMPOSITION, AND WHY IT LIVES HERE ──────────────────────────────────
 *
 * Two released seams, composed, with nothing new underneath either of them:
 *
 *   readPublicChannelObservation   CGO-5. Three `list` calls, three quota units, one page, no
 *                                  persistence, gated first by the capability authority.
 *   prepareWorkArtifact            R3W/CGO-3/CGO-4/CGO-6. The one seam that produces a durable
 *                                  artifact, authored by the tenant's durable agent.
 *
 * It is a THIRD module rather than a line inside either, and that is the whole structural point.
 * `src/features/work-artifacts/` reaches no provider today and must keep not reaching one: R3W's
 * firewall says so, CGO-3's says so, and CGO-6's acceptance rests on the grounding context being
 * free of provider material. So the provider read happens HERE, and what crosses into preparation
 * is a STRING the preparation seam appends to its brief. `prepare-work-artifact.server.ts` gained
 * one optional field and not one import.
 *
 * ── THE OBSERVATION IS NEVER REQUIRED, AND NEVER SILENT ─────────────────────
 *
 * A failed or refused observation does NOT fail the preparation. Preparing without it is exactly
 * what CGO-6 released and is a legitimate outcome, so YouTube being unreachable must not cost a
 * human their draft. What it must never do is happen QUIETLY: the disposition is returned beside
 * the preparation result, saying in classified terms what was asked for and what came back, so a
 * human is never left believing a draft was informed by an observation that never arrived.
 *
 * The model is told nothing about an absent observation. A brief describing what is missing would
 * invite writing about the absence, and the released brief already instructs the model to name what
 * it lacks rather than invent it.
 *
 * ── WHAT THIS MODULE DOES NOT DO ────────────────────────────────────────────
 *
 * It stores no observation, writes no Knowledge, creates no metric record, keeps no history, makes
 * no second call, compares nothing across time, ranks nothing, and recommends nothing. It spends at
 * most one observation — three quota units — per preparation, and asking again re-observes.
 *
 * Server-only.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { OBSERVATION_QUOTA_UNITS, type YouTubeChannelObservation } from "@/features/provider-youtube/contracts";
import {
  readPublicChannelObservation,
  type ReadChannelObservationDeps,
  type ReadChannelObservationOutcome,
} from "@/features/provider-youtube/read-channel-observation.server";
import {
  prepareWorkArtifact,
  type PrepareWorkArtifactDeps,
  type PrepareWorkArtifactInput,
  type PrepareWorkArtifactResult,
} from "@/features/work-artifacts/prepare-work-artifact.server";
import type { HebyModelAnswerDeps } from "@/features/heby-answer/model-answer.server";
import { CONTENT_DRAFT_TYPE } from "@/features/work-artifacts/contracts";
import { observationSupplementFor } from "./observation-brief";

/** Quota one preparation may spend on observation. One observation, never a second. */
export const MAX_OBSERVATIONS_PER_PREPARATION = 1 as const;
export const OBSERVATION_QUOTA_UNITS_PER_PREPARATION = OBSERVATION_QUOTA_UNITS;

/** How long the whole observation half may take before preparation proceeds without it. */
export const OBSERVATION_BUDGET_MS = 10_000 as const;

/**
 * What became of the observation half. Every value is a FACT about what happened; none of them is
 * a judgement about a channel, a number, or the draft.
 */
export type ObservationDisposition =
  /** No channel was named, so nothing was read and no quota was spent. */
  | { readonly status: "not-requested" }
  /** Read, and handed to the model as a fenced supplement. */
  | { readonly status: "observed"; readonly observation: YouTubeChannelObservation }
  /** The read was refused before YouTube was contacted — capability, tenant, or a bad handle. */
  | { readonly status: "refused"; readonly reason: string }
  /** YouTube was contacted and produced no observation. */
  | { readonly status: "failed"; readonly failure: string; readonly reason: string }
  /** The observation budget elapsed. NOTHING IS KNOWN about the channel from this. */
  | { readonly status: "timed-out"; readonly budgetMs: number };

export interface PrepareWithObservationInput extends PrepareWorkArtifactInput {
  /**
   * The public channel to observe, as a handle. A RUNTIME ARGUMENT exactly as CGO-5 made it: no
   * row learns it, no connection carries it, and naming it asserts nothing about who owns it.
   * Absent means observe nothing and spend nothing.
   */
  readonly observeChannelHandle?: string;
}

export interface PrepareWithObservationDeps extends HebyModelAnswerDeps, PrepareWorkArtifactDeps {
  /** Injectable so the composition is provable with no key, no network and no database. */
  readonly observe?: (
    tenant: TenantContext | null,
    handle: string,
    deps: ReadChannelObservationDeps,
  ) => Promise<ReadChannelObservationOutcome>;
  readonly prepare?: typeof prepareWorkArtifact;
  readonly observationBudgetMs?: number;
}

export interface PrepareWithObservationResult {
  readonly observation: ObservationDisposition;
  readonly preparation: PrepareWorkArtifactResult;
}

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Observed content preparation is server-only.");
  }
}

async function withinBudget<T>(work: Promise<T>, ms: number): Promise<{ timedOut: boolean; value?: T }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<{ timedOut: boolean; value?: T }>((resolve) => {
    timer = setTimeout(() => resolve({ timedOut: true }), ms);
  });
  try {
    return await Promise.race([work.then((value) => ({ timedOut: false, value })), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Observe one public channel, if one was named, and prepare the content draft with what came back.
 *
 * ONLY A CONTENT DRAFT IS OBSERVED FOR. `operational-plan` and `message-draft` carry no preparation
 * brief at all (CGO-4), so a supplement would have nothing to attach to and a provider call made
 * for them would be quota spent on nothing. Naming a channel for either is refused before any read.
 */
export async function prepareContentDraftWithObservation(
  input: PrepareWithObservationInput,
  deps: PrepareWithObservationDeps,
): Promise<PrepareWithObservationResult> {
  assertServerOnly();

  const { observeChannelHandle, ...preparationInput } = input;
  const prepare = deps.prepare ?? prepareWorkArtifact;

  if (!observeChannelHandle) {
    return { observation: { status: "not-requested" }, preparation: await prepare(preparationInput, deps) };
  }
  if (input.artifactType !== CONTENT_DRAFT_TYPE) {
    return {
      observation: { status: "refused", reason: "observation-is-content-draft-only" },
      preparation: await prepare(preparationInput, deps),
    };
  }

  const tenant = await deps.resolveTenant();
  const observe = deps.observe ?? readPublicChannelObservation;
  const budgetMs = deps.observationBudgetMs ?? OBSERVATION_BUDGET_MS;

  const timed = await withinBudget(observe(tenant, observeChannelHandle, { timeoutMs: budgetMs }), budgetMs);

  let disposition: ObservationDisposition;
  let supplement: string | undefined;

  if (timed.timedOut || timed.value === undefined) {
    disposition = { status: "timed-out", budgetMs };
  } else if (timed.value.ok) {
    disposition = { status: "observed", observation: timed.value.value };
    supplement = observationSupplementFor(timed.value.value);
  } else if ("refusal" in timed.value) {
    disposition = { status: "refused", reason: timed.value.refusal };
  } else {
    disposition = { status: "failed", failure: timed.value.failure, reason: timed.value.reason };
  }

  return {
    observation: disposition,
    preparation: await prepare({ ...preparationInput, observationSupplement: supplement }, deps),
  };
}
