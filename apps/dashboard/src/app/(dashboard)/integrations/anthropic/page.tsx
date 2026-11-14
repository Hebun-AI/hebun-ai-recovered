import { PageHeader } from "@/components/layout/page-header";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import { readByokKeyStatus } from "@/features/provider-anthropic/byok-key.server";
import { readByokDataUse } from "@/features/provider-anthropic/byok-account-terms.server";
import {
  recordByokDataUseAction,
  revokeAnthropicKeyAction,
  saveAnthropicKeyAction,
  stopUsingOwnKeyAction,
} from "./actions";

export const metadata = { title: "Anthropic key — Hebun AI" };
export const dynamic = "force-dynamic";

/*
 * P5 BYOK. Shows only whether a key is stored and when — never the key or any part of it — the data
 * use stated for the organization's own account, and the way back to Hebun's key.
 */
const OUTCOMES: Readonly<Record<string, string>> = {
  verified: "Your key was checked with Anthropic and stored, encrypted.",
  unverified: "Your key was stored, encrypted, but Anthropic could not be reached to check it. Try replacing it later.",
  rejected: "Anthropic did not accept that key. Nothing was stored; your previous key, if any, is unchanged.",
  revoked: "Your key was revoked.",
  "invalid-key": "That does not look like an Anthropic API key (it should start with sk-ant-). Nothing was stored.",
  "no-key": "There is no stored key to revoke.",
  unavailable: "This could not be completed right now. Nothing was changed.",
  "data-use-recorded": "Your account's terms were recorded and Heby may now use your key for assistance.",
  "data-use-unchanged": "Nothing changed: this is already what is authorized.",
  "data-use-invalid": "Choose each term and give a reason. Terms Hebun does not accept (for example training on your data) cannot be authorized.",
  "not-the-governance-authority": "Only your organization's Governance authority can do this.",
  "no-byok-connection": "There is no Anthropic key connection for this organization.",
  stopped: "Your key was revoked and disconnected. Heby uses Hebun's Anthropic account again.",
  "platform-not-authorized":
    "Nothing was changed: your organization has not authorized assistance on Hebun's Anthropic account, so Heby could not fall back to it. Authorize it in Governance first.",
};

const TRAINING: Record<string, string> = { none: "No training on our data", "customer-opt-in": "Only if we opt in", "provider-default": "Anthropic's default" };
const RETENTION: Record<string, string> = { "zero-data-retention": "Zero data retention", "bounded-30-days": "Up to 30 days", extended: "Longer than 30 days" };
const ZDR: Record<string, string> = { enabled: "Zero data retention is enabled", "not-enabled": "Zero data retention is not enabled" };
const SELECT = "rounded-lg border border-border bg-background px-3 py-2 text-sm text-fg";

function Choice({ name, label, options }: { name: string; label: string; options: Record<string, string> }) {
  return (
    <label className="flex flex-col gap-1 text-sm text-fg-secondary">
      {label}
      <select name={name} required defaultValue="" className={SELECT}>
        <option value="" disabled>Choose…</option>
        {Object.entries(options).map(([v, text]) => (
          <option key={v} value={v}>{text}</option>
        ))}
      </select>
    </label>
  );
}

export default async function AnthropicKeyPage({
  searchParams,
}: {
  searchParams: Promise<{ outcome?: string | string[] }>;
}) {
  const tenant = await resolveTenantContext();
  const [status, dataUse] = await Promise.all([readByokKeyStatus(tenant), readByokDataUse(tenant)]);
  const ownKeyUsable = status.status === "stored" && status.verified && dataUse.status === "read" && dataUse.authorized;
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
            {status.status === "none" && dataUse.status !== "read"
              ? "Heby runs on Hebun's own Anthropic account."
              : ownKeyUsable
                ? "Heby uses your key. Hebun's key is never used in its place."
                : "Heby does not answer with a model until your key is confirmed and its data use is authorized below. Hebun's key is not used in its place."}
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

        {dataUse.status === "read" ? (
          <section className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold text-fg">Data use on your Anthropic account</h2>
            <p className="mt-1 text-sm text-fg-secondary">
              {dataUse.attestation
                ? `Recorded terms: ${TRAINING[dataUse.attestation.training] ?? dataUse.attestation.training}; ${RETENTION[dataUse.attestation.retentionClass] ?? dataUse.attestation.retentionClass}; ${ZDR[dataUse.attestation.zdr] ?? dataUse.attestation.zdr}. ${dataUse.authorized ? "Assistance is authorized under them." : "Assistance is not authorized."}`
                : "No terms are recorded for your account yet, so Heby cannot use your key."}
            </p>
            {dataUse.viewerIsGovernanceAuthority ? (
              <form action={recordByokDataUseAction} className="mt-3 flex flex-col gap-3">
                <p className="text-sm text-fg-muted">
                  State the terms of your organization&apos;s agreement with Anthropic. Hebun records what you state; it does not verify it.
                </p>
                <Choice name="training" label="Training on your data" options={TRAINING} />
                <Choice name="retentionClass" label="Retention" options={RETENTION} />
                <Choice name="zdr" label="Zero data retention" options={ZDR} />
                <label className="flex flex-col gap-1 text-sm text-fg-secondary">
                  Reason for this decision
                  <textarea name="justification" required rows={2} className={SELECT} />
                </label>
                <button type="submit" className="self-start rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary">
                  Record terms and authorize assistance
                </button>
              </form>
            ) : (
              <p className="mt-3 text-sm text-fg-muted">Only your organization&apos;s Governance authority can record this.</p>
            )}
          </section>
        ) : null}

        {dataUse.status === "read" ? (
          <section className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold text-fg">Stop using your own key</h2>
            <p className="mt-1 text-sm text-fg-secondary">
              Revokes your key and disconnects it. Heby then uses Hebun&apos;s Anthropic account — only if your
              organization has authorized assistance there.
              {dataUse.platformAuthorized ? "" : " It has not, so this is not available yet."}
            </p>
            <form action={stopUsingOwnKeyAction} className="mt-3">
              <button
                type="submit"
                disabled={!dataUse.platformAuthorized}
                className="rounded-lg border border-border px-4 py-2 text-sm text-fg hover:bg-surface-sunken disabled:opacity-50"
              >
                Stop using my key
              </button>
            </form>
          </section>
        ) : null}

        {status.status === "stored" ? (
          <section className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold text-fg">Revoke</h2>
            <p className="mt-1 text-sm text-fg-secondary">
              Revoking takes effect immediately. Heby stops using a model until you add a new key or stop using your own key.
            </p>
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
