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
  projectLatestInstagramMediaObservation,
  windowStateOf,
  INSTAGRAM_MEDIA_ABSENCE,
  INSTAGRAM_MEDIA_HEADING,
  INSTAGRAM_MEDIA_MEANING,
  INSTAGRAM_MEDIA_WINDOW,
} from "@/features/instagram-connection-surface/latest-media-observation";
import { InstagramMediaCards } from "@/components/platform-integrations/instagram-media-cards";
import { disconnectInstagramAction } from "./actions";

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
  /*
   * DISCONNECT OUTCOMES. The success sentence states the boundary in the same breath as the fact,
   * because "disconnected" is exactly the word a reader will over-read: Hebun's access ended, and
   * Meta was not asked to forget anything.
   */
  disconnected:
    "Hebun's access token was revoked and this connection was ended. Hebun may still be listed " +
    "among the authorized apps in your Instagram settings — ending it there is a separate step.",
  "disconnect-nothing-to-do": "There was no live Instagram connection to end.",
  "disconnect-unavailable":
    "Hebun could not read its own connection records just now, so nothing was changed.",
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

          {/*
            ── THE THREE LIFECYCLE CONTROLS ──────────────────────────────────
            Connect and "connect a different account" are the SAME released ceremony; the only
            difference is that the second asks Meta to re-authenticate, because without that Meta
            silently reuses whichever Instagram account the browser is already signed in to. They
            are rendered as different sentences because they answer different questions, not
            because they run different code.
          */}
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

          {model.disconnectable ? (
            <div className="space-y-3 pt-1">
              <p>
                <Link
                  href="/api/integrations/instagram/start?switch=1"
                  prefetch={false}
                  className="underline underline-offset-4"
                >
                  Connect a different account
                </Link>
                <span className="block text-xs text-fg-muted">
                  Instagram will ask you to sign in again so you can choose which professional
                  account to connect. The account above stays connected until the new one is
                  verified.
                </span>
              </p>

              {/*
                DESTRUCTIVE, AND SAID SO BEFORE THE CLICK. `formNoValidate` is not used and the
                control is a real submit rather than a link: a GET that ends a grant would be
                followed by a crawler, a prefetch or a back button.

                THE FORM CARRIES NO FIELDS. The action takes no arguments at all — the tenant comes
                from the session and the connection is re-derived server-side — so there is nothing
                here for anyone to forge.
              */}
              <form action={disconnectInstagramAction} className="space-y-2">
                <p className="text-xs text-fg-muted">
                  Disconnecting revokes the access token Hebun holds and ends this connection.
                  Observations Hebun already stored are kept — Instagram did report them, and ending
                  a grant does not make that untrue.{" "}
                  <strong className="font-medium">
                    This does not remove Hebun from your Instagram account&rsquo;s authorized apps.
                  </strong>{" "}
                  To do that as well, remove it in Instagram under Settings → Apps and websites.
                </p>
                <button
                  type="submit"
                  className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm font-medium text-fg hover:bg-surface-sunken"
                >
                  Disconnect Instagram
                </button>
              </form>
            </div>
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
         *
         * ── THE FRAMING IS SHORTER THAN IT WAS, AND SAYS THE SAME THING ─────────
         *
         * The long paragraph belonged to an acceptance, where every clause had to be defended. On a
         * finished surface the same truth fits in a heading and one line: these are posts from a
         * STORED observation, taken at a stated instant. The full sentence is still carried — as the
         * section's own title text — so nothing was traded away for brevity.
         */}
        <div className="rounded-md border border-[var(--line)] px-4 py-4 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="font-semibold" title={INSTAGRAM_MEDIA_MEANING}>
              {INSTAGRAM_MEDIA_HEADING}
            </p>
            {latestMedia.status === "observed" ? (
              <p className="text-xs text-fg-muted">
                Observed by Hebun at{" "}
                <span className="font-mono">{latestMedia.observation.observedAt}</span>
              </p>
            ) : null}
          </div>

          {latestMedia.status === "observed" ? (
            <>
              <p className="text-xs leading-5 text-fg-secondary">
                Posts from the latest stored Instagram observation — what the provider reported at
                that instant, not a live view of the account.
              </p>

              <InstagramMediaCards items={latestMedia.observation.items} />

              {/*
               * THE WINDOW EDGE, KEPT PROPORTIONATE. A clipped or unknown window is a real caveat and
               * is stated in full; a complete one needs no paragraph on every render, so it is a
               * quiet footer line.
               */}
              <p className="text-xs leading-5 text-fg-muted">
                {latestMedia.observation.recentMediaCount ?? latestMedia.observation.items.length}{" "}
                media in this observation.{" "}
                {INSTAGRAM_MEDIA_WINDOW[windowStateOf(latestMedia.observation)]}
              </p>
            </>
          ) : (
            <p className="text-sm text-fg-secondary">
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
