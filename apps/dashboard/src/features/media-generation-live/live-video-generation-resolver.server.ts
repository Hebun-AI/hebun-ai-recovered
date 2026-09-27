/*
 * media-generation-live/live-video-generation-resolver.server.ts — selects the ONE live video
 * generation transport (MV-6), for the provider-neutral resolver in `media-assets`.
 *
 * MV-4 answered `unavailable` unconditionally. MV-6 allows exactly one live transport — Higgsfield,
 * one pinned text-to-video model — and returns it ONLY when every condition below holds, checked in
 * order, exactly as MEDIA-2A did for images:
 *
 *   1. HEBUN_VIDEO_GENERATION_TRANSPORT is set              absent     → no-video-generation-provider
 *   2. it names `live`, and HEBUN_HIGGSFIELD_API_KEY — ONE
 *      opaque key, used verbatim — is credential-shaped       otherwise  → video-generation-misconfigured
 *   3. the Director connectivity control
 *      `higgsfield-video-generation` is ON (fail-closed)      OFF/absent/err → video-generation-disabled
 *
 * A CREDENTIAL IS NOT A CAPABILITY. A key alone reaches at most step 3 and stops there, and the
 * control defaults OFF with no in-app writer and no production-reachable ceremony. "Available" means
 * "Hebun may attempt a call", never that Higgsfield is reachable or that the key works — no health is
 * claimed and none is probed.
 *
 * There is NO fallback. Any other selection value, including `fake`, is misconfiguration, never a
 * simulated provider: the simulated transport lives only in the test helpers and enters only through
 * deps. Values are never echoed, logged or returned.
 *
 * It lives here, and not in `media-assets`, because the Media Asset authority names no generation
 * provider and reads no provider configuration (pinned by the MEDIA-1 firewall).
 *
 * Server-only.
 */
import type {
  MediaAsyncGenerationTransportResolution,
  MediaAsyncTransportRequest,
} from "@/features/media-assets/async-generation-transport";
import { resolveDirectorEnabled } from "@/features/heby-provider-ops/provider-connectivity-control.server";
import { getProcessLiveSpendBudget } from "@/features/heby-model-live/live-spend-budget.server";
import { HIGGSFIELD_IMAGE_TO_VIDEO_CONTROL_KEY, HIGGSFIELD_VIDEO_GENERATION_CONTROL_KEY } from "./higgsfield-video-control";
import {
  HIGGSFIELD_IMAGE_TO_VIDEO_PROFILE,
  createHiggsfieldVideoTransport,
  isHiggsfieldCredentialShaped,
} from "./higgsfield-video-transport.server";

export const VIDEO_GENERATION_ENV = Object.freeze({
  transport: "HEBUN_VIDEO_GENERATION_TRANSPORT",
  /* One opaque key (open.higgsfield.ai). The retired id + secret pair is not read anywhere. */
  higgsfieldApiKey: "HEBUN_HIGGSFIELD_API_KEY",
});

export interface LiveVideoGenerationResolverDeps {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly resolveDirectorEnabled?: (providerKey: string) => Promise<boolean>;
}

/*
 * IMAGE → VIDEO: an `image` request is the same three steps with a DIFFERENT step 3 — the separate
 * `higgsfield-image-to-video` control — and yields the one image profile. A `text` request (the
 * default, and every caller before IMAGE → VIDEO) is unchanged: the pinned text profile, its control.
 */
export async function resolveLiveVideoGenerationTransport(
  deps: LiveVideoGenerationResolverDeps = {},
  request: MediaAsyncTransportRequest = { inputMode: "text" },
): Promise<MediaAsyncGenerationTransportResolution> {
  if (typeof window !== "undefined") {
    throw new Error("Video generation transport resolution is server-only.");
  }
  const env = deps.env ?? process.env;
  const selection = env[VIDEO_GENERATION_ENV.transport]?.trim() ?? "";
  if (!selection) return { status: "unavailable", reason: "no-video-generation-provider" };

  const credential = { apiKey: env[VIDEO_GENERATION_ENV.higgsfieldApiKey] ?? "" };
  if (selection !== "live" || !isHiggsfieldCredentialShaped(credential)) {
    return { status: "unavailable", reason: "video-generation-misconfigured" };
  }

  const image = request.inputMode === "image";
  const controlKey = image ? HIGGSFIELD_IMAGE_TO_VIDEO_CONTROL_KEY : HIGGSFIELD_VIDEO_GENERATION_CONTROL_KEY;
  const enabled = await (deps.resolveDirectorEnabled ?? resolveDirectorEnabled)(controlKey).catch(() => false);
  if (enabled !== true) return { status: "unavailable", reason: "video-generation-disabled" };

  return {
    status: "available",
    transport: createHiggsfieldVideoTransport({
      credential,
      spendBudget: getProcessLiveSpendBudget(),
      ...(image ? { profile: HIGGSFIELD_IMAGE_TO_VIDEO_PROFILE } : {}),
    }),
  };
}
