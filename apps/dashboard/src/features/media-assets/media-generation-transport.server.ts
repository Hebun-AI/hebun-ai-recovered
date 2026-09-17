/*
 * media-assets/media-generation-transport.server.ts — the runtime generation transport resolver.
 *
 * MEDIA-1 answered `unavailable` unconditionally. MEDIA-2A allows exactly one live transport — OpenAI
 * GPT Image, text-to-image — and returns it ONLY when every condition below holds, checked in order:
 *
 *   1. HEBUN_MEDIA_GENERATION_TRANSPORT is set          absent          → no-generation-provider
 *   2. it names `live`, and HEBUN_OPENAI_IMAGE_API_KEY
 *      is present and credential-shaped                 otherwise       → generation-misconfigured
 *   3. the Director connectivity control
 *      `openai-image-generation` is ON (fail-closed)    OFF/absent/err  → generation-disabled
 *
 * A CREDENTIAL IS NOT A CAPABILITY. A key alone reaches at most step 3 and stops there, and the control
 * defaults OFF with no in-app writer. "Available" here means "Hebun may attempt a call", never that the
 * provider is reachable, healthy, or that the key works — no health is claimed and none is probed.
 *
 * Storage is checked by the Media Asset authority BEFORE this resolver runs, so a transport is never
 * resolved for an image that could not be kept.
 *
 * The fake transport is not resolvable here: it lives under `tests/helpers` and enters only through
 * deps. Values are never echoed, logged or returned.
 *
 * Server-only.
 */
import type { MediaGenerationTransportResolution } from "./media-generation-transport";
import { resolveDirectorEnabled } from "@/features/heby-provider-ops/provider-connectivity-control.server";
import { getProcessLiveSpendBudget } from "@/features/heby-model-live/live-spend-budget.server";
import { OPENAI_IMAGE_GENERATION_CONTROL_KEY } from "@/features/media-generation-live/openai-image-control";
import { createOpenAiImageTransport } from "@/features/media-generation-live/openai-image-transport.server";

export const MEDIA_GENERATION_ENV = Object.freeze({
  transport: "HEBUN_MEDIA_GENERATION_TRANSPORT",
  openAiApiKey: "HEBUN_OPENAI_IMAGE_API_KEY",
});

const CREDENTIAL_RE = /^[\x21-\x7e]{20,512}$/;

export interface MediaGenerationTransportDeps {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly resolveDirectorEnabled?: (providerKey: string) => Promise<boolean>;
}

export async function resolveMediaGenerationTransport(
  deps: MediaGenerationTransportDeps = {},
): Promise<MediaGenerationTransportResolution> {
  if (typeof window !== "undefined") {
    throw new Error("Media generation transport resolution is server-only.");
  }
  const env = deps.env ?? process.env;
  const selection = env[MEDIA_GENERATION_ENV.transport]?.trim() ?? "";
  if (!selection) return { status: "unavailable", reason: "no-generation-provider" };

  const apiKey = env[MEDIA_GENERATION_ENV.openAiApiKey] ?? "";
  if (selection !== "live" || !CREDENTIAL_RE.test(apiKey)) {
    return { status: "unavailable", reason: "generation-misconfigured" };
  }

  const enabled = await (deps.resolveDirectorEnabled ?? resolveDirectorEnabled)(OPENAI_IMAGE_GENERATION_CONTROL_KEY).catch(
    () => false,
  );
  if (enabled !== true) return { status: "unavailable", reason: "generation-disabled" };

  return {
    status: "available",
    transport: createOpenAiImageTransport({ apiKey, spendBudget: getProcessLiveSpendBudget() }),
  };
}
