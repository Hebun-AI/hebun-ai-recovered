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
 */
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import { listConnections } from "@/features/integration-authority/integration-repository.server";
import { isInstagramOAuthConfigured } from "@/features/provider-instagram/instagram-environment.server";
import {
  buildInstagramConnectionModel,
  INSTAGRAM_STATE_SENTENCES,
} from "@/features/instagram-connection-surface/model";

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
      </section>
    </>
  );
}
