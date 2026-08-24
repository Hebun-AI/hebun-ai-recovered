/*
 * Integrations · GitHub — the narrow surface GITHUB-2 owns.
 *
 * A SEPARATE PAGE, for the same reason `/integrations/google` is one: `/integrations` is a
 * released read-only surface that reports what the tenant is connected to and offers no connect
 * control. This page owns the ACT — starting an installation — and reads the same authority for
 * the state.
 *
 * ── WHAT IT DOES NOT SHOW ───────────────────────────────────────────────────
 *
 * No repository count. No pull-request count. No "last sync". No engineering signal. GITHUB-2
 * connects and reads NO repository data whatsoever — the transport knows one endpoint, and it is
 * the installation record. A figure here would be the exact seeded-truth defect the navigation
 * phase just removed, reintroduced one screen away.
 *
 * ── NO NAVIGATION ENTRY IS ADDED ────────────────────────────────────────────
 *
 * The navigation phase deliberately left the Integrations section with one destination, and its
 * comment records why `/integrations/google` is not listed: it STARTS an authorization rather than
 * stating that one exists, and an act does not belong in navigation beside a read. The same
 * applies here, so this surface is reachable by URL exactly as Google's is.
 */
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import { listConnections } from "@/features/integration-authority/integration-repository.server";
import { isGitHubAppConfigured } from "@/features/provider-github/github-environment.server";
import {
  buildGitHubConnectionModel,
  describeGitHubGrantedAccess,
  GITHUB_STATE_SENTENCES,
} from "@/features/github-connection-surface/model";
import { discoverInstallationRepositories } from "@/features/provider-github/discover-installation-repositories.server";

export const metadata = { title: "GitHub — Integrations — Hebun AI" };
export const dynamic = "force-dynamic";

/**
 * Outcomes the setup callback may hand back.
 *
 * Each one is a DIFFERENT ACTION for the human. "Suspended" and "not enough permissions" both mean
 * not connected, and a tenant who cannot tell them apart cannot fix either.
 */
const OUTCOMES: Readonly<Record<string, string>> = Object.freeze({
  connected: "GitHub confirmed the installation and the connection is live.",
  "invalid-request":
    "That installation could not be matched to this session, so it was refused. Start again from this page.",
  "not-configured": "GitHub is not configured for this deployment.",
  "not-authenticated": "The session ended before the installation came back.",
  "app-credential-refused":
    "GitHub refused Hebun's own application credential. This is a deployment problem, not an organization one.",
  "installation-not-found":
    "GitHub has no record of that installation. It may have been removed before it came back.",
  "provider-unreachable": "GitHub could not be reached. Nothing about the installation is known.",
  "installation-not-understood": "GitHub's answer did not describe an installation Hebun can bind to.",
  "not-an-organization":
    "That installation is on a personal account. Hebun connects to GitHub organizations only.",
  "installation-suspended": "That installation is suspended at GitHub, so it grants nothing.",
  "repository-selection-too-broad":
    "That installation covers every repository. Hebun requires an installation limited to selected repositories.",
  "insufficient-granted-permissions":
    "The organization granted less access than the connection requires, so nothing was connected.",
  "connection-refused": "The connection record could not be updated, so nothing was connected.",
});

export default async function GitHubIntegrationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const outcomeParam = typeof params.outcome === "string" ? params.outcome : null;

  const tenant = await resolveTenantContext();
  const configured = isGitHubAppConfigured();
  const listing = tenant ? await listConnections(tenant) : null;
  const connections = listing?.status === "read" ? listing.connections : [];
  const model = buildGitHubConnectionModel(connections, configured);

  /*
   * ── THE FIRST REAL GITHUB DATA READ ON A HEBUN SCREEN ──────────────────────
   *
   * Attempted only when the connection is live, because asking otherwise would mint a token for a
   * question the authority has already answered. The seam refuses on its own terms as well — this
   * check saves a round trip, it is not the gate.
   *
   * Whatever comes back is LIVE. Nothing is stored, so nothing here can be stale, and there is no
   * count to show before a successful read: a failure renders the refusal, never a zero.
   */
  const discovery =
    model.state === "connected" ? await discoverInstallationRepositories(tenant) : null;

  return (
    <>
      <PageHeader
        title="GitHub"
        context="The GitHub organization this organization installed Hebun on, and exactly what GitHub granted."
      />

      <section className="space-y-4 text-sm">
        {outcomeParam ? (
          <p className="rounded-md border border-[var(--line)] px-4 py-3">
            {OUTCOMES[outcomeParam] ??
              `The last installation attempt did not complete (${outcomeParam}).`}
          </p>
        ) : null}

        <div className="rounded-md border border-[var(--line)] px-4 py-4 space-y-3">
          <p className="font-semibold">GitHub</p>
          <p>{GITHUB_STATE_SENTENCES[model.state]}</p>

          {model.unconfigured ? (
            <p>
              This deployment has no GitHub App configured, so an installation cannot be started
              here.
            </p>
          ) : null}

          {/*
            * The lifecycle sentence above says whether GitHub confirmed the installation. What the
            * installation may be used for is a different fact with a different source, so it is
            * derived from the granted permissions rather than from the state.
            */}
          {model.grantedPermissions.length > 0
            ? describeGitHubGrantedAccess(model.grantedPermissions).map((line) => (
                <p key={line}>{line}</p>
              ))
            : null}

          {model.organizationLabel ? (
            <p>
              Organization: <span className="font-medium">{model.organizationLabel}</span>
            </p>
          ) : null}

          {model.installationId ? <p>Installation: {model.installationId}</p> : null}

          {model.lastVerifiedAt ? <p>Last verified: {model.lastVerifiedAt}</p> : null}

          {model.grantedPermissions.length > 0 ? (
            <div>
              <p>Access GitHub granted:</p>
              <ul className="mt-1 space-y-0.5">
                {model.grantedPermissions.map((permission) => (
                  <li key={permission} className="font-mono text-xs">
                    {permission}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {model.failureReason ? <p>Last failure: {model.failureReason}</p> : null}

          {model.connectable ? (
            <p>
              <Link
                href="/api/integrations/github/start"
                prefetch={false}
                className="underline underline-offset-4"
              >
                Install on a GitHub organization
              </Link>
            </p>
          ) : null}
        </div>

        {discovery ? (
          <div className="rounded-md border border-[var(--line)] px-4 py-4 space-y-3">
            <p className="font-semibold">Repositories this installation covers</p>

            {discovery.ok ? (
              <>
                <p>
                  Read from GitHub just now. Hebun stores no repository list, so this is what the
                  installation covers at this moment rather than what it covered when it was
                  installed.
                </p>

                {discovery.value.repositories.length === 0 ? (
                  <p>
                    GitHub returned no repositories for this installation. The organization scoped
                    the grant to selected repositories and has selected none that Hebun can see.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {discovery.value.repositories.map((repository) => (
                      <li key={repository.repositoryId} className="font-mono text-xs">
                        {/* Provider text, rendered as data. The id is the identity; the name is the label. */}
                        {repository.fullName}
                        {repository.isPrivate ? " · private" : " · public"}
                        {repository.isArchived ? " · archived" : ""}
                      </li>
                    ))}
                  </ul>
                )}

                {discovery.value.truncated ? (
                  <p>
                    GitHub reports {discovery.value.totalReportedByProvider} repositories for this
                    installation. This read is bounded, so the list above is not all of them.
                  </p>
                ) : null}
              </>
            ) : (
              <p>
                {/*
                  * An honest refusal, never an empty list. "Nothing was read" and "there is
                  * nothing" are different facts and a zero would collapse them.
                  */}
                Hebun could not read this installation&apos;s repositories:{" "}
                <span className="font-mono text-xs">
                  {"refusal" in discovery ? discovery.refusal : discovery.reason}
                </span>
                . Nothing about the repositories is claimed.
              </p>
            )}
          </div>
        ) : null}
      </section>
    </>
  );
}
