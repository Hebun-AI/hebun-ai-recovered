/*
 * integrations-surface.tsx — the Integrations truth surface.
 *
 * ── IT RENDERS A MODEL; IT RESOLVES NOTHING ─────────────────────────────────
 *
 * The model arrives as a prop, already built from an authorized read the PAGE performed. This
 * component holds no database handle, no tenant, no catalog lookup and no fetch, so it cannot
 * become a second opinion about what is connected — it has nothing to have an opinion with.
 *
 * ── TWO SECTIONS THAT MUST NEVER BLUR ───────────────────────────────────────
 *
 *   Connected integrations        real rows from integration-authority.
 *   Available / offline descriptors   provider-matrix simulation definitions.
 *
 * They are rendered by different markup with different vocabulary on purpose. A descriptor never
 * receives a connection badge, a health word, an account label, a scope list or a verified
 * timestamp — not because a filter excludes it, but because `IntegrationView` has no such fields to
 * render.
 *
 * ── NO SECRET, AND NO HINT OF ONE ───────────────────────────────────────────
 *
 * Nothing here prints a credential, a token, a ciphertext, an expiry or the fact that a credential
 * exists. The model does not carry any of them.
 *
 * Server component — no client state, no mutation affordance, no connect control.
 */

import { Plug, ShieldOff } from "lucide-react";
import type { IntegrationsModel } from "@/features/platform-integrations";

export function IntegrationsSurface({ model }: { model: IntegrationsModel }) {
  const hasConnected = model.connected.length > 0;

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex items-center gap-2 text-sm text-fg-secondary">
        <Plug className="size-4 text-primary" aria-hidden="true" />
        Connection state is read from this organization&rsquo;s integration authority. Offline provider
        descriptors are listed separately and are not connections.
      </div>

      <section
        className={
          hasConnected
            ? "flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-surface p-4"
            : "flex min-w-0 flex-col gap-2 rounded-xl border border-warning/40 bg-warning/5 p-4"
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={
              hasConnected
                ? "inline-flex items-center rounded-md bg-primary/15 px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-primary"
                : "inline-flex items-center rounded-md bg-warning/15 px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-warning"
            }
          >
            {model.state.headline}
          </span>
          <h2 className="text-sm font-semibold text-fg">Integrations</h2>
        </div>
        <p className="max-w-3xl text-xs leading-5 text-fg-muted">{model.state.note}</p>
      </section>

      <section className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-fg">Connected integrations</h2>

        {model.connected.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-fg-muted">
            {model.readiness === "authority-read"
              ? "None. The connection authority reports no connected integration for this organization."
              : "Not readable. The connection authority was not reached for this request, so no connection state is shown."}
          </p>
        ) : null}

        <ul className="flex flex-col gap-3">
          {model.connected.map((c) => (
            <li key={c.integrationId} className="flex min-w-0 flex-col gap-2 rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-fg">{c.providerLabel}</span>
                <span className="inline-flex items-center rounded-md bg-primary/15 px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-primary">
                  Connected
                </span>
                <span
                  className={
                    c.healthUsable
                      ? "inline-flex items-center rounded-md bg-success/15 px-2 py-0.5 text-[0.7rem] font-medium uppercase tracking-wide text-success"
                      : "inline-flex items-center rounded-md bg-warning/15 px-2 py-0.5 text-[0.7rem] font-medium uppercase tracking-wide text-warning"
                  }
                >
                  Health: {c.health}
                </span>
              </div>

              <p className="text-xs leading-5 text-fg-secondary">{c.stateStatement}</p>

              {c.accountLabel ? (
                <p className="text-xs text-fg-secondary">
                  Verified account: <span className="font-medium text-fg">{c.accountLabel}</span>
                </p>
              ) : null}

              <p className="text-xs leading-5 text-fg-muted">{c.accountKindStatement}</p>

              {c.lastVerifiedAt ? (
                <p className="text-xs text-fg-muted">Last verified: {c.lastVerifiedAt}</p>
              ) : null}

              <div>
                <p className="text-xs text-fg-secondary">
                  Access the provider granted ({c.scopeCount}):
                </p>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {c.scopes.map((scope) => (
                    <li key={scope} className="font-mono text-[0.7rem] leading-5 text-fg-muted">
                      {scope}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="text-xs leading-5 text-fg-muted">{c.capabilityStatement}</p>

              {c.capabilities.length > 0 ? (
                <ul className="flex flex-col gap-1">
                  {c.capabilities.map((cap) => (
                    <li key={cap.capability} className="flex flex-col gap-0.5">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-fg">{cap.label}</span>
                        <span
                          className={
                            cap.available
                              ? "inline-flex items-center rounded-md bg-success/15 px-2 py-0.5 text-[0.7rem] font-medium uppercase tracking-wide text-success"
                              : "inline-flex items-center rounded-md bg-warning/15 px-2 py-0.5 text-[0.7rem] font-medium uppercase tracking-wide text-warning"
                          }
                        >
                          {cap.available ? "available" : "not granted"}
                        </span>
                      </span>
                      <span className="text-[0.7rem] leading-5 text-fg-muted">{cap.statement}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>

        {model.recordedNotConnected.length > 0 ? (
          <div className="rounded-lg border border-dashed border-border p-3">
            <p className="text-[0.7rem] font-medium uppercase tracking-wide text-fg-muted">
              Recorded, not connected
            </p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {model.recordedNotConnected.map((r) => (
                <li key={r.integrationId} className="text-xs text-fg-muted">
                  {r.providerLabel} — {r.connectionState}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-fg">Available / offline descriptors</h2>
        <p className="text-[0.7rem] text-fg-muted">
          Offline provider descriptors from the simulation catalog. A descriptor is not a connection,
          holds no credential, and nothing below is authenticated.
        </p>
        <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border bg-surface">
          {model.candidates.map((c) => (
            <li key={c.id} className="flex flex-col gap-1.5 p-3 sm:flex-row sm:items-start sm:gap-4">
              <div className="flex min-w-0 items-center gap-2 sm:w-44 sm:shrink-0">
                <span className="size-1.5 shrink-0 rounded-full bg-fg-muted" aria-hidden="true" />
                <span className="truncate text-sm font-medium text-fg">{c.name}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[0.7rem] text-fg-secondary">{c.providerType}</p>
                <p className="text-[0.7rem] leading-5 text-fg-muted">{c.note}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[0.7rem] font-medium uppercase tracking-wide text-fg-muted">{c.connectionState}</p>
                <p className="text-[0.7rem] text-fg-muted">Credentials: {c.credentialStatus}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <ul className="flex max-w-3xl flex-col gap-1">
        {model.distinctions.map((d) => (
          <li key={d} className="text-xs leading-5 text-fg-muted">— {d}</li>
        ))}
      </ul>

      <p className="flex items-center gap-2 text-xs text-fg-muted">
        <ShieldOff className="size-3.5" aria-hidden="true" />
        Read-only. No connect, authenticate, OAuth, sync, or secret control on this page.
      </p>
    </div>
  );
}
