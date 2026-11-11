import { PageHeader } from "@/components/layout/page-header";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import { readByokKeyStatus } from "@/features/provider-anthropic/byok-key.server";
import { revokeAnthropicKeyAction, saveAnthropicKeyAction } from "./actions";

export const metadata = { title: "Anthropic key — Hebun AI" };
export const dynamic = "force-dynamic";

/*
 * P5 BYOK slice 1. Shows only whether a key is stored and when — never the key or any part of it.
 * Honest about scope: a stored key is not used yet; Heby still runs on Hebun's key.
 */
const OUTCOMES: Readonly<Record<string, string>> = {
  verified: "Your key was checked with Anthropic and stored, encrypted.",
  unverified: "Your key was stored, encrypted, but Anthropic could not be reached to check it. Try replacing it later.",
  rejected: "Anthropic did not accept that key. Nothing was stored; your previous key, if any, is unchanged.",
  revoked: "Your key was revoked.",
  "invalid-key": "That does not look like an Anthropic API key (it should start with sk-ant-). Nothing was stored.",
  "no-key": "There is no stored key to revoke.",
  unavailable: "This could not be completed right now. Nothing was changed.",
};

export default async function AnthropicKeyPage({
  searchParams,
}: {
  searchParams: Promise<{ outcome?: string | string[] }>;
}) {
  const tenant = await resolveTenantContext();
  const status = await readByokKeyStatus(tenant);
  const raw = (await searchParams).outcome;
  const message = typeof raw === "string" ? OUTCOMES[raw] : undefined;

  return (
    <>
      <PageHeader
        title="Anthropic — your own key"
        context="Connect your organization's own Anthropic API key. Hebun stores it encrypted for this organization only and never shows it again."
      />
      <div className="max-w-2xl space-y-6">
        {message ? (
          <p role="status" className="rounded-xl border border-border bg-surface-sunken p-4 text-sm text-fg">
            {message}
          </p>
        ) : null}

        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold text-fg">Status</h2>
          <p className="mt-2 text-sm text-fg-secondary">
            {status.status === "stored"
              ? `A key is stored (since ${status.storedAt.slice(0, 10)}). ${status.verified ? "Anthropic accepted it." : "It has not been confirmed with Anthropic."}`
              : status.status === "none"
                ? "No key is stored."
                : "This information is currently unavailable."}
          </p>
          <p className="mt-2 text-sm text-fg-muted">
            Not in use yet: Heby still runs on Hebun&apos;s own Anthropic account. Using your key for Heby
            is a later step.
          </p>
        </section>

        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold text-fg">{status.status === "stored" ? "Replace the key" : "Add a key"}</h2>
          <form action={saveAnthropicKeyAction} className="mt-3 flex flex-col gap-3 sm:flex-row">
            <label className="sr-only" htmlFor="apiKey">Anthropic API key</label>
            <input
              id="apiKey"
              name="apiKey"
              type="password"
              autoComplete="off"
              spellCheck={false}
              required
              placeholder="sk-ant-…"
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-fg"
            />
            <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary">
              {status.status === "stored" ? "Replace" : "Store key"}
            </button>
          </form>
        </section>

        {status.status === "stored" ? (
          <section className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold text-fg">Revoke</h2>
            <p className="mt-1 text-sm text-fg-secondary">Revoking takes effect immediately.</p>
            <form action={revokeAnthropicKeyAction} className="mt-3">
              <button type="submit" className="rounded-lg border border-border px-4 py-2 text-sm text-fg hover:bg-surface-sunken">
                Revoke key
              </button>
            </form>
          </section>
        ) : null}
      </div>
    </>
  );
}
