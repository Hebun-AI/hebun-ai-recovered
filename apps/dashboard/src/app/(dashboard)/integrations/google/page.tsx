/*
 * Integrations · Google — the narrow surface INT-3 owns.
 *
 * A SEPARATE PAGE, deliberately. `/integrations` is a released read-only surface whose whole
 * contract is "nothing is connected, no connect control", and whose model reads the offline
 * provider-matrix simulation. Bolting a real Connect button onto it would mix a simulation
 * catalog with the real connection authority on one screen, and would break a released pin that
 * exists for a good reason. This page reads the real authority and says only what it knows.
 *
 * NO NAVIGATION ENTRY IS ADDED. Navigation is a concurrent workstream this phase must not touch,
 * so the surface is reachable by URL. Recorded as debt rather than solved by editing a shell file.
 */
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import { listConnections } from "@/features/integration-authority/integration-repository.server";
import { isGoogleOAuthConfigured } from "@/features/provider-google/google-environment.server";
import {
  buildGoogleConnectionModel,
  GOOGLE_STATE_SENTENCES,
  describeGoogleGrantedAccess,
} from "@/features/google-connection-surface/model";

export const metadata = { title: "Google — Integrations — Hebun AI" };
export const dynamic = "force-dynamic";

/** Outcomes the callback may hand back. Anything unrecognized is shown as a plain refusal. */
const OUTCOMES: Readonly<Record<string, string>> = Object.freeze({
  connected: "Google confirmed the account and the connection is live.",
  declined: "The authorization was declined at Google. Nothing was stored.",
  "invalid-state": "That authorization could not be matched to this session, so it was refused.",
  "insufficient-scope":
    "Google granted less access than identity verification needs, so nothing was connected.",
  "not-configured": "Google is not configured for this deployment.",
  "not-authenticated": "The session ended before the authorization came back.",
});

export default async function GoogleIntegrationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const outcomeParam = typeof params.outcome === "string" ? params.outcome : null;

  const tenant = await resolveTenantContext();
  const configured = isGoogleOAuthConfigured();
  const listing = tenant ? await listConnections(tenant) : null;
  const connections = listing?.status === "read" ? listing.connections : [];
  const model = buildGoogleConnectionModel(connections, configured);

  return (
    <>
      <PageHeader
        title="Google"
        context="The Google account this organization connected, and exactly what Google granted."
      />

      <section className="space-y-4 text-sm">
        {outcomeParam ? (
          <p className="rounded-md border border-[var(--line)] px-4 py-3">
            {OUTCOMES[outcomeParam] ??
              `The last authorization attempt did not complete (${outcomeParam}).`}
          </p>
        ) : null}

        <div className="rounded-md border border-[var(--line)] px-4 py-4 space-y-3">
          <p className="font-semibold">Google Workspace</p>
          <p>{GOOGLE_STATE_SENTENCES[model.state]}</p>

          {/*
            * The lifecycle sentence above says whether Google confirmed the account. What that
            * account may be used for is a different fact with a different source, so it is derived
            * from `grantedScopes` rather than from the state the sentence is keyed by.
            */}
          {model.grantedScopes.length > 0
            ? describeGoogleGrantedAccess(model.grantedScopes).map((line) => (
                <p key={line}>{line}</p>
              ))
            : null}

          {model.accountLabel ? (
            <p>
              Account: <span className="font-medium">{model.accountLabel}</span>
            </p>
          ) : null}

          {model.lastVerifiedAt ? <p>Last verified: {model.lastVerifiedAt}</p> : null}

          {model.grantedScopes.length > 0 ? (
            <div>
              <p>Access Google granted:</p>
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
                href="/api/integrations/google/start"
                prefetch={false}
                className="underline underline-offset-4"
              >
                Connect Google
              </Link>
            </p>
          ) : null}
        </div>
      </section>
    </>
  );
}
