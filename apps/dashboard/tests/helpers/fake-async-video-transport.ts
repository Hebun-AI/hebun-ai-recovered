/*
 * tests/helpers/fake-async-video-transport.ts — SIMULATED asynchronous video provider (MV-4).
 *
 * TEST-ONLY. `transport: 'fake'`, a provider name that says "simulated", and it is never resolvable by
 * `resolveMediaAsyncGenerationTransport` — it enters only through deps. Nothing it answers is provider
 * truth. It carries a marker string that stands in for a credential so tests can prove no transport
 * secret ever reaches a row, a result or a read model; the marker resembles no real key format.
 */
import type {
  MediaAsyncDispatchOutcome,
  MediaAsyncGenerationTransport,
  MediaAsyncPollOutcome,
} from "../../src/features/media-assets/async-generation-transport";

export const SIMULATED_VIDEO_PROVIDER = "hebun-simulated-video-provider";
export const SIMULATED_VIDEO_MODEL = "simulated-video-v1";
export const SIMULATED_SECRET_MARKER = "SIMULATED-NOT-A-CREDENTIAL-mv4";

export type FakeDispatch = "accept" | "reject" | "unknown" | "throw" | "accept-without-job";

export interface FakeAsyncVideoTransport extends MediaAsyncGenerationTransport {
  dispatchBehaviour: FakeDispatch;
  /** Answers handed out in order; when empty, `pending`. An Error entry is thrown. */
  readonly pollScript: (MediaAsyncPollOutcome | Error)[];
  readonly dispatchCalls: string[];
  readonly pollCalls: string[];
  /** Optional gate so a test can hold a poll open and overlap two observations. */
  pollGate: Promise<void> | null;
}

export function createFakeAsyncVideoTransport(dispatchBehaviour: FakeDispatch = "accept"): FakeAsyncVideoTransport {
  const secret = SIMULATED_SECRET_MARKER; // held, never returned
  const t: FakeAsyncVideoTransport = {
    transport: "fake",
    provider: SIMULATED_VIDEO_PROVIDER,
    model: SIMULATED_VIDEO_MODEL,
    outputMediaKind: "video",
    dispatchBehaviour,
    pollScript: [],
    dispatchCalls: [],
    pollCalls: [],
    pollGate: null,
    async dispatch(input): Promise<MediaAsyncDispatchOutcome> {
      void secret;
      t.dispatchCalls.push(input.invocationId);
      const n = t.dispatchCalls.length;
      switch (t.dispatchBehaviour) {
        case "accept":
          return { status: "accepted", providerJobId: `sim-job-${n}` };
        case "accept-without-job":
          return { status: "accepted", providerJobId: "" };
        case "reject":
          return { status: "rejected", failure: "moderation-blocked" };
        case "unknown":
          return { status: "unknown" };
        case "throw":
          throw new Error("simulated socket timeout after request was written");
      }
    },
    async poll(input): Promise<MediaAsyncPollOutcome> {
      t.pollCalls.push(input.providerJobId);
      const next = t.pollScript.shift();
      if (t.pollGate) await t.pollGate;
      if (next instanceof Error) throw next;
      return next ?? { status: "pending" };
    },
  };
  return t;
}
