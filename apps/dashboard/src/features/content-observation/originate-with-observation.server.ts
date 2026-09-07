/*
 * content-observation/originate-with-observation.server.ts — ONE bounded live public observation,
 * spent on ONE agent origination (TRH-20).
 *
 * ── THE COMPOSITION, AND WHY IT LIVES HERE ──────────────────────────────────
 *
 * Two released seams, composed, with nothing new underneath either of them:
 *
 *   readPublicChannelObservation   CGO-5. Three `list` calls, three quota units, one page, no
 *                                  persistence, gated FIRST by the capability authority.
 *   originateAgentAction           AGENT-PROPOSAL-1/2, TRH-17/18/19. The one seam through which a
 *                                  durable agent may propose a bounded action for a human to
 *                                  decide — and which stops there, by construction.
 *
 * It is a THIRD module rather than a line inside either, for exactly the reason CGO-7 gave when it
 * did this the first time. `src/features/agent-origination/` reaches no provider today and must
 * keep not reaching one: its firewall proves it holds no credential, no transport and no provider
 * import. So the provider read happens HERE, and what crosses into origination is a STRING the
 * origination seam appends to its grounding. `originate-action.server.ts` gained one optional dep
 * and not one import.
 *
 * ── WHAT MAKES THIS A GROWTH CAPABILITY AND NOT A GROWTH AUTHORITY ──────────
 *
 * Nothing here owns a fact. It reads a provider that already exists, fences what came back with a
 * brief that is pure, and hands the result to an authority that already decides who may propose
 * what. It stores no observation, writes no Knowledge, creates no metric record, keeps no history,
 * compares nothing across time, ranks nothing, and mints nothing. There is no second source of
 * truth here because there is no source of truth here at all.
 *
 * ── THE OBSERVATION IS NEVER REQUIRED, AND NEVER SILENT ─────────────────────
 *
 * A failed or refused observation does NOT fail the origination — asking Heby for a proposal
 * without one is exactly what AGENT-PROPOSAL-2 released, so YouTube being unreachable must not
 * cost a human their answer. What it must never do is happen QUIETLY: the disposition is returned
 * beside the origination result, so nobody is left believing a proposal was informed by an
 * observation that never arrived.
 *
 * The model is told NOTHING about an absent observation. A sentence describing what is missing
 * would invite reasoning about the absence, and an absence is not evidence of anything.
 *
 * Server-only.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  originateAgentAction,
  type OriginateActionDeps,
  type OriginateActionResult,
} from "@/features/agent-origination/originate-action.server";
import { OBSERVATION_QUOTA_UNITS } from "@/features/provider-youtube/contracts";
import {
  readPublicChannelObservation,
  type ReadChannelObservationDeps,
  type ReadChannelObservationOutcome,
} from "@/features/provider-youtube/read-channel-observation.server";
import { growthObservationSupplementFor } from "./growth-origination-brief";
import type { ObservationDisposition } from "./prepare-with-observation.server";

/** Quota one origination may spend on observation. One observation, never a second. */
export const MAX_OBSERVATIONS_PER_ORIGINATION = 1 as const;
export const OBSERVATION_QUOTA_UNITS_PER_ORIGINATION = OBSERVATION_QUOTA_UNITS;

/**
 * How long the observation half may take before origination proceeds without it.
 *
 * The SAME budget CGO-7 released, imported rather than retyped would be circular (that module
 * imports nothing from this one and must not start), so it is stated here with its own name and a
 * test asserts the two agree. A model call is downstream of this wait, so a longer budget would be
 * a human staring at a spinner while a provider decides whether to answer.
 */
export const ORIGINATION_OBSERVATION_BUDGET_MS = 10_000 as const;

export interface OriginateWithObservationInput {
  /** The human's goal. Forwarded verbatim to the released validator; never inspected here. */
  readonly goal: unknown;
  /**
   * The public channel to observe, as a handle. A RUNTIME ARGUMENT exactly as CGO-5 made it: no
   * row learns it, no connection carries it, and naming it asserts nothing about who owns it.
   * Absent means observe nothing and spend nothing.
   */
  readonly observeChannelHandle?: string;
}

export interface OriginateWithObservationDeps extends OriginateActionDeps {
  /** Injectable so the composition is provable with no key, no network and no database. */
  readonly observe?: (
    tenant: TenantContext | null,
    handle: string,
    deps: ReadChannelObservationDeps,
  ) => Promise<ReadChannelObservationOutcome>;
  readonly originate?: typeof originateAgentAction;
  readonly observationBudgetMs?: number;
}

export interface OriginateWithObservationResult {
  readonly observation: ObservationDisposition;
  readonly origination: OriginateActionResult;
}

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Observed agent origination is server-only.");
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
 * Observe one public channel, if one was named, and let the durable agent originate with what came
 * back.
 *
 * THE ORDER IS THE SAFETY PROPERTY. The observation is read first and fenced before the model sees
 * anything, so provider text can never arrive as a candidate — the membership check downstream is
 * still reading a list this module never touched.
 *
 * A CALLER MAY NOT SUPPLY THE SUPPLEMENT. `deps` is spread onto the origination call with the
 * supplement written LAST, so any value a caller put there is replaced by the one this module
 * composed — including with `undefined` when there is nothing to say.
 */
export async function originateAgentActionWithObservation(
  input: OriginateWithObservationInput,
  deps: OriginateWithObservationDeps,
): Promise<OriginateWithObservationResult> {
  assertServerOnly();

  const originate = deps.originate ?? originateAgentAction;
  const { observeChannelHandle } = input;

  if (!observeChannelHandle) {
    return {
      observation: { status: "not-requested" },
      origination: await originate({ goal: input.goal }, { ...deps, observationSupplement: undefined }),
    };
  }

  const tenant = await deps.resolveTenant();
  const observe = deps.observe ?? readPublicChannelObservation;
  const budgetMs = deps.observationBudgetMs ?? ORIGINATION_OBSERVATION_BUDGET_MS;

  const timed = await withinBudget(observe(tenant, observeChannelHandle, { timeoutMs: budgetMs }), budgetMs);

  let observation: ObservationDisposition;
  let supplement: string | undefined;

  if (timed.timedOut || timed.value === undefined) {
    observation = { status: "timed-out", budgetMs };
  } else if (timed.value.ok) {
    observation = { status: "observed", observation: timed.value.value };
    supplement = growthObservationSupplementFor(timed.value.value);
  } else if ("refusal" in timed.value) {
    observation = { status: "refused", reason: timed.value.refusal };
  } else {
    observation = { status: "failed", failure: timed.value.failure, reason: timed.value.reason };
  }

  return {
    observation,
    origination: await originate({ goal: input.goal }, { ...deps, observationSupplement: supplement }),
  };
}
