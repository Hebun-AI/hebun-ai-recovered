/*
 * scripts/lib/mv6-generation-acceptance.ts — ONE real-provider generation through the RELEASED MV-4
 * lifecycle (MV-6 acceptance, stage 2).
 *
 * It is an ORCHESTRATOR, not an authority. It calls the three existing lifecycle seams —
 * `registerAsyncMediaGeneration`, `dispatchAsyncMediaGeneration`, `pollAsyncMediaGeneration` — with a
 * transport it is handed, and reads back what the one CAS writer recorded. It writes no row itself,
 * never names `media_assets` for writing, downloads nothing, admits nothing, and holds no Governance,
 * control or retry authority.
 *
 * ONE DISPATCH. `dispatchAsyncMediaGeneration` is called exactly once. If it does not reach
 * `provider-pending` — `dispatch-unknown`, `provider-failed`, a refusal — the run STOPS and reports;
 * there is no second dispatch on any path, and the transport it is handed should itself hold a
 * one-unit spend budget so a second POST is impossible below this module too.
 *
 * BOUNDED POLLING. Status reads follow Higgsfield's documented strategy — start at 2 s, grow ×1.5 to
 * 10 s, add jitter — until the lifecycle records a terminal state, the deadline passes, or too many
 * consecutive reads are unreadable. A status read spends nothing and changes nothing but counters.
 *
 * WHAT ITS RESULT MAY CLAIM. `provider-succeeded` means the provider reported `completed` WITH a video
 * URL (the transport refuses to record completion without one) — the provider's completion contract,
 * nothing more. It is not Media admission, not verified bytes, not a playable video.
 */
import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import type { ControlPlaneDatabase } from "../../src/db/client.server";
import { mediaGenerationInvocations } from "../../src/db/schema/media-asset";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import type { MediaAsyncGenerationTransport } from "../../src/features/media-assets/async-generation-transport";
import {
  dispatchAsyncMediaGeneration,
  pollAsyncMediaGeneration,
  readAsyncMediaGeneration,
  registerAsyncMediaGeneration,
} from "../../src/features/media-assets/async-generation-lifecycle.server";

export const MV6_GENERATION_POLL = Object.freeze({
  firstDelayMs: 2_000,
  growth: 1.5,
  maxDelayMs: 10_000,
  jitterMs: 500,
  deadlineMs: 15 * 60_000,
  maxConsecutiveUnreadable: 10,
});

export interface GenerationAcceptanceInput {
  readonly tenant: TenantContext;
  readonly artifactId: string;
  readonly revisionNo: number;
  readonly promptText: string;
  readonly requestKey: string;
  readonly getDb: () => ControlPlaneDatabase;
  readonly transport: MediaAsyncGenerationTransport;
  /** Counts `media_assets` rows; read before and after to prove none was created. */
  readonly countMediaAssets: () => Promise<number>;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly now?: () => number;
  readonly random?: () => number;
  readonly poll?: Partial<Record<keyof typeof MV6_GENERATION_POLL, number>>;
}

export type GenerationAcceptanceStop =
  | "registration-refused"
  | "dispatch-not-pending"
  | "terminal"
  | "deadline"
  | "unreadable-streak"
  | "poll-refused";

export interface GenerationAcceptanceEvidence {
  readonly stop: GenerationAcceptanceStop;
  readonly invocationId: string | null;
  readonly dispatchCalls: number;
  readonly finalState: string | null;
  readonly providerJobId: string | null;
  readonly providerFailure: string | null;
  readonly outputRefIsJobId: boolean | null;
  readonly admissionOutcome: string | null;
  readonly polls: number;
  readonly unreadableObservations: number;
  readonly elapsedMs: number;
  readonly mediaAssetsBefore: number;
  readonly mediaAssetsAfter: number;
  readonly detail: string | null;
}

const TERMINAL = new Set(["provider-succeeded", "provider-failed", "dispatch-unknown", "dispatch-failed"]);

export async function runGenerationAcceptance(input: GenerationAcceptanceInput): Promise<GenerationAcceptanceEvidence> {
  const sleep = input.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = input.now ?? (() => Date.now());
  const random = input.random ?? Math.random;
  const cfg = { ...MV6_GENERATION_POLL, ...input.poll };
  const deps = { getDb: input.getDb, resolveTransport: () => ({ status: "available" as const, transport: input.transport }) };
  const started = now();
  const mediaAssetsBefore = await input.countMediaAssets();

  let dispatchCalls = 0;
  let polls = 0;
  let unreadable = 0;
  let consecutiveUnreadable = 0;

  const finish = async (stop: GenerationAcceptanceStop, invocationId: string | null, detail: string | null = null): Promise<GenerationAcceptanceEvidence> => {
    const read = invocationId ? await readAsyncMediaGeneration(input.tenant, invocationId, { getDb: input.getDb }) : null;
    const g = read && read.status === "read" ? read.generation : null;
    /* The read model hides the provider's identifiers on purpose; evidence reads them, tenant-scoped, read-only. */
    const ids = invocationId
      ? (
          await input
            .getDb()
            .select({ jobId: mediaGenerationInvocations.providerJobId, outputRef: mediaGenerationInvocations.providerOutputRef })
            .from(mediaGenerationInvocations)
            .where(and(eq(mediaGenerationInvocations.tenantId, input.tenant.tenantId), eq(mediaGenerationInvocations.id, invocationId)))
            .limit(1)
        )[0] ?? null
      : null;
    return {
      stop,
      invocationId,
      dispatchCalls,
      finalState: g?.state ?? null,
      providerJobId: ids?.jobId ?? null,
      providerFailure: g?.providerFailure ?? null,
      outputRefIsJobId: ids && ids.outputRef !== null ? ids.outputRef === ids.jobId : null,
      admissionOutcome: g?.admissionOutcome ?? null,
      polls,
      unreadableObservations: unreadable,
      elapsedMs: now() - started,
      mediaAssetsBefore,
      mediaAssetsAfter: await input.countMediaAssets(),
      detail,
    };
  };

  const registered = await registerAsyncMediaGeneration(
    input.tenant,
    { artifactId: input.artifactId, revisionNo: input.revisionNo, promptText: input.promptText, requestKey: input.requestKey },
    deps,
  );
  if (registered.status !== "registered") return finish("registration-refused", null, registered.reason);
  const invocationId = registered.invocationId;

  /* THE one dispatch. Nothing below this line can call it again. */
  dispatchCalls += 1;
  const dispatched = await dispatchAsyncMediaGeneration(input.tenant, invocationId, deps);
  if (dispatched.status !== "transitioned" || dispatched.state !== "provider-pending") {
    return finish("dispatch-not-pending", invocationId, dispatched.status === "refused" ? dispatched.reason : dispatched.state);
  }

  let delay: number = cfg.firstDelayMs;
  for (;;) {
    if (now() - started >= cfg.deadlineMs) return finish("deadline", invocationId);
    await sleep(delay + Math.floor(random() * cfg.jitterMs));
    delay = Math.min(delay * cfg.growth, cfg.maxDelayMs);
    polls += 1;
    const observed = await pollAsyncMediaGeneration(input.tenant, invocationId, deps);
    if (observed.status === "refused") return finish("poll-refused", invocationId, observed.reason);
    if (observed.status === "transitioned" || (observed.status === "no-transition" && TERMINAL.has(observed.state))) {
      return finish("terminal", invocationId);
    }
    if (observed.status === "observation-unreadable") {
      unreadable += 1;
      consecutiveUnreadable += 1;
      if (consecutiveUnreadable >= cfg.maxConsecutiveUnreadable) return finish("unreadable-streak", invocationId);
    } else {
      consecutiveUnreadable = 0;
    }
  }
}

/** The claim a run may make, and nothing stronger. */
export function describeGenerationAcceptance(e: GenerationAcceptanceEvidence): string {
  assert.ok(e.dispatchCalls <= 1, "never more than one dispatch");
  if (e.stop === "terminal" && e.finalState === "provider-succeeded" && e.outputRefIsJobId && e.mediaAssetsAfter === e.mediaAssetsBefore) {
    return "Higgsfield real-provider lifecycle VERIFIED in the disposable acceptance environment (provider completion contract only; no Media admission, no byte verification)";
  }
  return `NOT VERIFIED: stopped at ${e.stop}${e.finalState ? ` with state ${e.finalState}` : ""}`;
}
