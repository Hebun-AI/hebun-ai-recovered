/*
 * scripts/lib/higgsfield-estimate.ts — ask Higgsfield what a generation WOULD cost, and nothing else
 * (MV-6 real-provider acceptance, stage 1).
 *
 * Higgsfield publishes no per-model price. Its billing guide documents an authenticated
 * `POST /estimate/<model path>` that takes the same parameters as the generation endpoint and answers
 * `{ credits, usd }` for the calling account. This module calls ONLY that endpoint. It never names a
 * generation, status or cancel URL, so it cannot submit, observe or cancel a job.
 *
 * Whether an estimate call is itself free is NOT documented. The call count is therefore bounded to
 * one per candidate, with no retry, and the Director runs it.
 *
 * THE CANDIDATES. The pinned MV-6 model with its exact pinned parameters, plus two text-to-video
 * comparators at their documented minimum durations, all text-only. The comparison exists so the
 * model choice rests on the account's own price evidence; this module decides nothing — it reports.
 *
 * WHAT NEVER LEAVES. The API key and the Authorization header are never printed or
 * returned. A refusal reports its HTTP status only, never the provider's message.
 *
 * Deployment possession only: `src/` cannot import `scripts/`.
 */
import {
  HIGGSFIELD_API_ORIGIN,
  HIGGSFIELD_VIDEO_MODEL,
  HIGGSFIELD_VIDEO_MODEL_PATH,
  HIGGSFIELD_VIDEO_REQUEST_PARAMETERS,
  type HiggsfieldCredential,
  type HiggsfieldFetch,
} from "../../src/features/media-generation-live/higgsfield-video-transport.server";

/** Synthetic, non-sensitive. No tenant or organizational content ever enters an estimate. */
export const MV6_SYNTHETIC_PROMPT = "A slow camera pan across an empty wooden table in soft daylight.";

export interface EstimateCandidate {
  readonly label: string;
  readonly modelPath: string;
  readonly body: Readonly<Record<string, unknown>>;
  /** True for the model the MV-6 transport actually pins. */
  readonly pinned: boolean;
}

export const MV6_ESTIMATE_CANDIDATES: readonly EstimateCandidate[] = Object.freeze([
  {
    label: HIGGSFIELD_VIDEO_MODEL,
    modelPath: HIGGSFIELD_VIDEO_MODEL_PATH,
    body: { prompt: MV6_SYNTHETIC_PROMPT, ...HIGGSFIELD_VIDEO_REQUEST_PARAMETERS },
    pinned: true,
  },
  {
    label: "kling-video/v2.5-turbo/pro/text-to-video@5s",
    modelPath: "kling-video/v2.5-turbo/pro/text-to-video",
    body: { prompt: MV6_SYNTHETIC_PROMPT, duration: 5 },
    pinned: false,
  },
  {
    label: "minimax/hailuo-2.3/standard/text-to-video@6s",
    modelPath: "minimax/hailuo-2.3/standard/text-to-video",
    body: { prompt: MV6_SYNTHETIC_PROMPT, duration: 6, prompt_optimizer: false },
    pinned: false,
  },
]);

/*
 * SEEDANCE COMPARISON (MV-6, Director-approved). Measurement only: none of these is the pinned model,
 * and nothing here can change the pin. Two things are measured, per model: the minimum-cost setting
 * (4 s, 480p) and a quality class nearer Hailuo's fixed 768P (4 s, 720p). Audio is off throughout so
 * the comparison matches the silent baseline. Seedance 2.5 pins `output_format: "mp4"` — `mov` is
 * not what MV-3 admission and MV-5 normalization expect — and `bitrate_mode: "standard"`.
 */
const SEEDANCE_20 = "bytedance/seedance-2.0/text-to-video";
const SEEDANCE_25 = "bytedance/seedance-2.5/text-to-video";
const seedance20 = (resolution: "480p" | "720p"): EstimateCandidate => ({
  label: `${SEEDANCE_20}@4s-${resolution}-16x9-silent`,
  modelPath: SEEDANCE_20,
  body: { prompt: MV6_SYNTHETIC_PROMPT, duration: 4, resolution, aspect_ratio: "16:9", generate_audio: false },
  pinned: false,
});
const seedance25 = (resolution: "480p" | "720p"): EstimateCandidate => ({
  label: `${SEEDANCE_25}@4s-${resolution}-16x9-silent-standard-mp4`,
  modelPath: SEEDANCE_25,
  body: { prompt: MV6_SYNTHETIC_PROMPT, duration: 4, resolution, aspect_ratio: "16:9", bitrate_mode: "standard", output_format: "mp4", generate_audio: false },
  pinned: false,
});

export const MV6_SEEDANCE_ESTIMATE_CANDIDATES: readonly EstimateCandidate[] = Object.freeze([
  seedance20("480p"),
  seedance20("720p"),
  seedance25("480p"),
  seedance25("720p"),
]);

/** The named sets the CLI can run. Each run is one call per candidate of ONE set. */
export const MV6_ESTIMATE_SETS: Readonly<Record<string, readonly EstimateCandidate[]>> = Object.freeze({
  baseline: MV6_ESTIMATE_CANDIDATES,
  seedance: MV6_SEEDANCE_ESTIMATE_CANDIDATES,
});

export const HIGGSFIELD_ESTIMATE_TIMEOUT_MS = 30_000;
const MAX_BODY_BYTES = 16 * 1024;
const DECIMAL_RE = /^\d{1,12}(\.\d{1,6})?$/;

export function higgsfieldEstimateUrl(modelPath: string): string {
  if (!/^[a-z0-9][a-z0-9.-]*(\/[a-z0-9][a-z0-9.-]*){1,4}$/.test(modelPath)) throw new Error("Not a model path.");
  return `${HIGGSFIELD_API_ORIGIN}/estimate/${modelPath}`;
}

export type EstimateResult =
  | { readonly label: string; readonly pinned: boolean; readonly status: "estimated"; readonly credits: string; readonly usd: string }
  | { readonly label: string; readonly pinned: boolean; readonly status: "refused"; readonly httpStatus: number }
  | { readonly label: string; readonly pinned: boolean; readonly status: "unreadable" }
  | { readonly label: string; readonly pinned: boolean; readonly status: "unreachable" };

/** One estimate call per candidate, sequentially, with no retry. */
export async function estimateCandidates(
  credential: HiggsfieldCredential,
  fetchImpl: HiggsfieldFetch,
  candidates: readonly EstimateCandidate[] = MV6_ESTIMATE_CANDIDATES,
): Promise<EstimateResult[]> {
  const results: EstimateResult[] = [];
  for (const c of candidates) {
    const base = { label: c.label, pinned: c.pinned };
    let response: Response;
    try {
      response = await fetchImpl(higgsfieldEstimateUrl(c.modelPath), {
        method: "POST",
        headers: {
          authorization: `Key ${credential.apiKey}`,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify(c.body),
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(HIGGSFIELD_ESTIMATE_TIMEOUT_MS),
      });
    } catch {
      results.push({ ...base, status: "unreachable" });
      continue;
    }
    if (response.status < 200 || response.status >= 300) {
      await response.body?.cancel().catch(() => undefined);
      results.push({ ...base, status: "refused", httpStatus: response.status });
      continue;
    }
    let body: unknown;
    try {
      const text = await response.text();
      body = text.length <= MAX_BODY_BYTES ? JSON.parse(text) : undefined;
    } catch {
      body = undefined;
    }
    const credits = body && typeof body === "object" ? (body as Record<string, unknown>).credits : undefined;
    const usd = body && typeof body === "object" ? (body as Record<string, unknown>).usd : undefined;
    const asDecimal = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? String(v) : v);
    const cr = asDecimal(credits);
    const us = asDecimal(usd);
    if (typeof cr === "string" && DECIMAL_RE.test(cr) && typeof us === "string" && DECIMAL_RE.test(us)) {
      results.push({ ...base, status: "estimated", credits: cr, usd: us });
    } else {
      results.push({ ...base, status: "unreadable" });
    }
  }
  return results;
}
