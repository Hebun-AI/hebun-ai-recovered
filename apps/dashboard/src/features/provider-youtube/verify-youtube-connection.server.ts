/*
 * provider-youtube/verify-youtube-connection.server.ts — ONE real call that proves the key (CGO-5).
 *
 * Verification asks YouTube for its own channel (`@YouTube`, `part=id`, 1 unit). A 200 with an
 * item proves three things at once: the key is accepted, the Data API is enabled on its project,
 * and the project has quota. It proves NOTHING about any account — there is none — which is why
 * the facts it produces name no external account and the label says so.
 *
 * It does not write. The route or ceremony that called it records the outcome through the
 * lifecycle authority, exactly as the Google callback does.
 *
 * Server-only.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import type { VerifiedConnectionFacts } from "@/features/integration-authority/integration-repository.server";
import {
  YOUTUBE_CONNECTION_LABEL,
  YOUTUBE_VERIFICATION_PROBE_HANDLE,
  type YouTubeFailure,
  type YouTubeFailureClass,
} from "./contracts";
import { withYouTubeApiKey, type YouTubeApiKeyCallDeps } from "./youtube-api-key-call.server";
import { listChannelByHandle } from "./youtube-transport.server";

export type VerifyYouTubeDeps = YouTubeApiKeyCallDeps;

export type YouTubeVerificationOutcome =
  | { readonly ok: true; readonly facts: VerifiedConnectionFacts; readonly probedChannelId: string }
  | YouTubeFailure;

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("YouTube verification is server-only.");
  }
}

/**
 * How each failure reaches the connection lifecycle.
 *
 *   auth        the key is rejected — the grant is unusable: `expired`, health unknown
 *   disabled    the key is fine, the API is switched off on its project — health `degraded`, the
 *               lifecycle untouched; an operator enables the API and the same key works
 *   quota       the key is fine, today's units are spent — `degraded`, lifecycle untouched
 *   not-found   YouTube's own channel was not found: the answer is unusable — `degraded`
 *   transport   nothing is known — `unreachable`, lifecycle untouched
 *   malformed   `degraded`
 */
export function lifecycleClassFor(failure: YouTubeFailureClass): "auth" | "degraded" | "unreachable" {
  if (failure === "auth") return "auth";
  if (failure === "transport") return "unreachable";
  return "degraded";
}

export async function verifyYouTubeConnection(
  tenant: TenantContext,
  integrationId: string,
  deps: VerifyYouTubeDeps = {},
): Promise<YouTubeVerificationOutcome> {
  assertServerOnly();
  const outcome = await withYouTubeApiKey(
    tenant,
    integrationId,
    (apiKey) => listChannelByHandle(apiKey, YOUTUBE_VERIFICATION_PROBE_HANDLE, deps),
    deps,
  );
  if (!outcome.ok) return outcome;
  return {
    ok: true,
    facts: {
      /* No account exists behind an API key. NULL is the fact, not a placeholder. */
      externalAccountId: null,
      externalAccountLabel: YOUTUBE_CONNECTION_LABEL,
      grantedScopes: [],
    },
    probedChannelId: outcome.value.channel.channelId,
  };
}
