/*
 * Integrations · Instagram — the narrow surface this ceremony owns.
 *
 * A SEPARATE PAGE, following the convention `/integrations/google` established. `/integrations` is
 * a released read-only surface whose whole contract is "no connect control", and bolting one on
 * would break a released pin that exists for a good reason. This page reads the real authority and
 * says only what it knows.
 *
 * IT EXISTS BECAUSE THE CEREMONY HAS TO LAND SOMEWHERE. Both routes redirect here with an
 * `outcome`, so without this page a completed authorization would end at a 404 — which is not a
 * smaller surface, it is a broken one.
 *
 * NO NAVIGATION ENTRY IS ADDED. Navigation is a concurrent workstream this phase must not touch, so
 * the surface is reachable by URL, exactly as the Google page still is. Recorded as debt rather than
 * solved by editing a shell file.
 *
 * NO CREDENTIAL AUTHORITY IS IMPORTED HERE and none can be: a surface that could see a secret would
 * eventually render one. `configured` arrives as a boolean.
 *
 * ── IT ALSO SHOWS THE LATEST STORED OBSERVATION, AND ONLY THAT ──────────────
 *
 * The page reads the released provider-observation read authority for ONE row and renders what
 * Instagram said at that instant. It is a CONSUMER: it creates no authority, holds no table, adds
 * no capability and cannot cause a read. Nothing on this page contacts Meta, decrypts a credential,
 * revalidates an authorization or schedules anything — a human opening a page is not an event that
 * may reach a provider.
 *
 * AND IT DERIVES NOTHING. No delta, no rate, no direction, no verdict about whether the observation
 * is recent. The instant is shown; what it means is not this surface's to say.
 */
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import { listConnections } from "@/features/integration-authority/integration-repository.server";
import { isInstagramOAuthConfigured } from "@/features/provider-instagram/instagram-environment.server";
import {
  INSTAGRAM_ACCOUNT_PUBLIC_READ_CAPABILITY,
  INSTAGRAM_MEDIA_PUBLIC_READ_CAPABILITY,
  INSTAGRAM_PROVIDER_KEY,
} from "@/features/provider-instagram/contracts";
import { readProviderObservations } from "@/features/provider-observation-history/read-provider-observations.server";
import {
  buildInstagramConnectionModel,
  INSTAGRAM_STATE_SENTENCES,
} from "@/features/instagram-connection-surface/model";
import {
  describeInstagramObservation,
  projectLatestInstagramObservation,
  INSTAGRAM_OBSERVATION_ABSENCE,
  INSTAGRAM_OBSERVATION_HEADING,
  INSTAGRAM_OBSERVATION_MEANING,
} from "@/features/instagram-connection-surface/latest-observation";
import {
  describeMediaCounts,
  projectLatestInstagramMediaObservation,
  windowStateOf,
  INSTAGRAM_MEDIA_ABSENCE,
  INSTAGRAM_MEDIA_HEADING,
  INSTAGRAM_MEDIA_MEANING,
  INSTAGRAM_MEDIA_NO_CAPTION,
  INSTAGRAM_MEDIA_NO_PUBLISHED_AT,
  INSTAGRAM_MEDIA_NO_TYPE,
  INSTAGRAM_MEDIA_WINDOW,
} from "@/features/instagram-connection-surface/latest-media-observation";

export const metadata = { title: "Instagram — Integrations — Hebun AI" };
export const dynamic = "force-dynamic";

/**
 * Outcomes the ceremony may hand back. Anything unrecognized is shown as a plain refusal.
 *
 * NOTE WHAT IS NOT DISTINGUISHED: every state failure arrives as one `invalid-state`, because
 * telling a caller which check refused it is a free oracle. The list below cannot become more
 * specific than the routes are.
 */
const OUTCOMES: Readonly<Record<string, string>> = Object.freeze({
  connected: "Instagram confirmed the account and the connection is live.",
  declined: "The authorization was declined at Instagram. Nothing was stored.",
  "invalid-state": "That authorization could not be matched to this session, so it was refused.",
  "missing-code": "Instagram returned no authorization code, so nothing was exchanged.",
  "insufficient-scope":
    "Instagram granted less than this connection needs, so nothing was stored.",
  "not-configured": "Instagram is not configured for this deployment.",
  "not-authenticated": "The session ended before the authorization came back.",
  "instagram-error": "Instagram refused the authorization. Nothing was stored.",
  "exchange-malformed": "Instagram's answer could not be understood, so nothing was stored.",
});

export default async function InstagramIntegrationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const outcomeParam = typeof params.outcome === "string" ? params.outcome : null;

  const tenant = await resolveTenantContext();
  const configured = isInstagramOAuthConfigured();
  const listing = tenant ? await listConnections(tenant) : null;
  const connections = listing?.status === "read" ? listing.connections : [];
  const model = buildInstagramConnectionModel(connections, configured);

  /*
   * STORED HISTORY, NOT A LOOK. This reads rows Hebun already holds through the released
   * observation read authority — which contacts no provider, decrypts no credential and writes
   * nothing. Rendering a page has never been, and must not become, a reason to ask Instagram
   * anything.
   *
   * THE TENANT IS THE SESSION'S. It is handed to the seam as the seam requires and is not
   * derivable from the connection, the account or the URL; a null session is answered as
   * unavailable by the seam itself, which is why it is passed rather than branched on here.
   *
   * ONE ROW. `limit: 1` asks for the newest and nothing more, so no page render can pull a history
   * this surface has no way to show.
   */
  const latestObservation = projectLatestInstagramObservation(
    await readProviderObservations(tenant, {
      providerKey: INSTAGRAM_PROVIDER_KEY,
      /*
       * NAMING THE CAPABILITY IS NOT OPTIONAL HERE, AND THE OMISSION WAS A REAL DEFECT.
       *
       * This section understands ONE fact vocabulary — the account's five facts. When Instagram
       * gained a second capability, the unscoped query started returning the newest MEDIA row, whose
       * keys are entirely different, and this surface reported five facts as unreported that the
       * provider had actually reported. A consumer that understands one vocabulary must ask for it.
       */
      capabilityKey: INSTAGRAM_ACCOUNT_PUBLIC_READ_CAPABILITY,
      limit: 1,
    }),
  );

  /*
   * THE SECOND STORED CAPABILITY, READ THE SAME WAY. Same released authority, same tenant, one row —
   * the only difference is which capability's vocabulary this section understands.
   */
  const latestMedia = projectLatestInstagramMediaObservation(
    await readProviderObservations(tenant, {
      providerKey: INSTAGRAM_PROVIDER_KEY,
      capabilityKey: INSTAGRAM_MEDIA_PUBLIC_READ_CAPABILITY,
      limit: 1,
    }),
  );

  return (
    <>
      <PageHeader
        title="Instagram"
        context="The Instagram professional account this organization connected, and exactly what Instagram granted."
      />

      <section className="space-y-4 text-sm">
        {outcomeParam ? (
          <p className="rounded-md border border-[var(--line)] px-4 py-3">
            {OUTCOMES[outcomeParam] ??
              `The last authorization attempt did not complete (${outcomeParam}).`}
          </p>
        ) : null}

        <div className="rounded-md border border-[var(--line)] px-4 py-4 space-y-3">
          <p className="font-semibold">Instagram</p>
          <p>{INSTAGRAM_STATE_SENTENCES[model.state]}</p>

          {model.accountLabel ? (
            <p>
              Account: <span className="font-medium">{model.accountLabel}</span>
            </p>
          ) : null}

          {model.lastVerifiedAt ? <p>Last verified: {model.lastVerifiedAt}</p> : null}

          {model.grantedScopes.length > 0 ? (
            <div>
              <p>Access Instagram granted:</p>
              <ul className="mt-1 space-y-0.5">
                {model.grantedScopes.map((scope) => (
                  <li key={scope} className="font-mono text-xs">
                    {scope}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {model.failureReason ? <p>Last failure: {model.failureReason}</p> : null}

          {model.connectable ? (
            <p>
              <Link
                href="/api/integrations/instagram/start"
                prefetch={false}
                className="underline underline-offset-4"
              >
                Connect Instagram
              </Link>
            </p>
          ) : null}
        </div>

        {/*
         * A SUBORDINATE SECTION, AND INDEPENDENT OF THE CONNECTION'S LIFECYCLE. A stored
         * observation stays true after a grant ends: Instagram did say it, at that instant. So
         * this renders on its own evidence rather than being hidden when the connection can no
         * longer be exercised — the sentence is historical either way.
         */}
        <div className="rounded-md border border-[var(--line)] px-4 py-4 space-y-3">
          <p className="font-semibold">{INSTAGRAM_OBSERVATION_HEADING}</p>

          {latestObservation.status === "observed" ? (
            <>
              <p>{INSTAGRAM_OBSERVATION_MEANING}</p>
              <p>
                Hebun observed Instagram at{" "}
                <span className="font-mono text-xs">
                  {latestObservation.observation.observedAt}
                </span>
              </p>
              <ul className="space-y-0.5">
                {describeInstagramObservation(latestObservation.observation).map((row) => (
                  <li key={row.label}>
                    {row.label}: <span className="font-medium">{row.value}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>
              {latestObservation.status === "none"
                ? INSTAGRAM_OBSERVATION_ABSENCE.none
                : INSTAGRAM_OBSERVATION_ABSENCE[latestObservation.reason]}
            </p>
          )}
        </div>

        {/*
         * A THIRD SUBORDINATE SECTION, INDEPENDENT OF THE CONNECTION'S LIFECYCLE for the same reason
         * the account observation is: Instagram did say these things, at that instant, and a grant
         * ending later does not un-say them.
         */}
        <div className="rounded-md border border-[var(--line)] px-4 py-4 space-y-3">
          <p className="font-semibold">{INSTAGRAM_MEDIA_HEADING}</p>

          {latestMedia.status === "observed" ? (
            <>
              <p>{INSTAGRAM_MEDIA_MEANING}</p>
              <p>
                Hebun observed Instagram at{" "}
                <span className="font-mono text-xs">{latestMedia.observation.observedAt}</span>
              </p>
              <p>
                Instagram reported{" "}
                <span className="font-medium">
                  {latestMedia.observation.recentMediaCount ?? latestMedia.observation.items.length}
                </span>{" "}
                media in this observation. {INSTAGRAM_MEDIA_WINDOW[windowStateOf(latestMedia.observation)]}
              </p>

              <ul className="space-y-3">
                {latestMedia.observation.items.map((item, index) => (
                  <li
                    key={item.permalink ?? `${item.publishedAt ?? "unknown"}-${index}`}
                    className="rounded-md border border-[var(--line)] px-3 py-3 space-y-1"
                  >
                    <p className="text-xs">
                      {item.mediaType ?? INSTAGRAM_MEDIA_NO_TYPE}
                      {" · published "}
                      <span className="font-mono">
                        {item.publishedAt ?? INSTAGRAM_MEDIA_NO_PUBLISHED_AT}
                      </span>
                    </p>
                    {/*
                     * THE CAPTION IS PROVIDER-WRITTEN TEXT. React escapes it; nothing here parses
                     * it, and `whitespace-pre-wrap` only preserves the line breaks the author typed.
                     */}
                    <p className="whitespace-pre-wrap break-words">
                      {item.caption ?? INSTAGRAM_MEDIA_NO_CAPTION}
                    </p>
                    <ul className="space-y-0.5">
                      {describeMediaCounts(item).map((row) => (
                        <li key={row.label} className="text-xs">
                          {row.label}: <span className="font-medium">{row.value}</span>
                        </li>
                      ))}
                    </ul>
                    {/* A LINK ONLY WHEN THE PERMALINK PASSED THE POLICY. Never fetched, never previewed. */}
                    {item.permalink ? (
                      <p className="text-xs">
                        <a
                          href={item.permalink}
                          target="_blank"
                          rel="noreferrer noopener nofollow"
                          className="underline underline-offset-4"
                        >
                          Open this post on Instagram
                        </a>
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>
              {latestMedia.status === "none"
                ? INSTAGRAM_MEDIA_ABSENCE.none
                : INSTAGRAM_MEDIA_ABSENCE[latestMedia.reason]}
            </p>
          )}
        </div>
      </section>
    </>
  );
}
