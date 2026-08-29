import { Building2 } from "lucide-react";
import type { OrganizationAuthorityRead } from "@/features/organization-authority/contracts";

/*
 * L3 — the ONE panel on this page that states organizational truth.
 *
 * Everything below it on `/director/organization` is the released mock projection, disclosed since
 * L1. This section is the opposite: every value is a durable row read through the Organization
 * Authority, and when that authority cannot answer, this says so in a sentence instead of rendering
 * an organization with an empty name and zero members.
 *
 *   UNAVAILABLE != EMPTY ORGANIZATION
 *
 * It renders no role, no permission and no member name, because the seam carries none — and it
 * spells no ceremony vocabulary either. The origin SENTENCE is resolved by the authority, which
 * takes the vocabulary from the schema module that declares it, so a surface can never become a
 * second place that decides what a provisioning source means.
 */

const UNAVAILABLE_SENTENCE: Record<string, string> = {
  "no-tenant":
    "No organization is resolved for this session, so Hebun did not establish which organization you are viewing.",
  "persistence-not-configured":
    "Durable storage is not configured for this deployment, so Hebun holds no organization record to read.",
  "organization-not-found":
    "This session names an organization Hebun cannot find as a live record. Nothing was substituted for it.",
  "read-failed":
    "Hebun could not read your organization. That is a read failure, not an empty organization.",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-[10rem] flex-1 basis-[10rem] bg-surface p-4">
      <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-fg-muted">{label}</p>
      <div className="mt-1 text-sm font-medium text-fg">{children}</div>
    </div>
  );
}

export function AuthoritativeOrganizationPanel({ read }: { read: OrganizationAuthorityRead }) {
  return (
    <section aria-labelledby="authoritative-organization-title">
      <div className="mb-3">
        <h2 id="authoritative-organization-title" className="text-lg font-semibold text-fg">
          The organization Hebun knows
        </h2>
        <p className="mt-1 text-sm text-fg-secondary">
          Read from durable records through the Organization Authority. Nothing here is illustrative.
        </p>
      </div>

      {read.status === "unavailable" ? (
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="flex items-start gap-2 text-sm leading-6 text-fg-secondary">
            <Building2 className="mt-0.5 size-4 shrink-0 text-fg-muted" aria-hidden="true" />
            <span>{UNAVAILABLE_SENTENCE[read.reason] ?? "Hebun could not establish your organization."}</span>
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-px overflow-hidden rounded-xl border border-border bg-border">
            <Field label="Organization">{read.organization.name}</Field>
            <Field label="Identifier">
              <span className="font-mono text-xs">{read.organization.slug}</span>
            </Field>
            <Field label="Lifecycle">{read.organization.lifecycleStatus}</Field>
            <Field label="Tenant status">{read.organization.tenantStatus ?? "none recorded"}</Field>
            <Field label="Human members">
              <span className="tabular-nums">{read.organization.humanMemberCount}</span>
            </Field>
          </div>
          <p className="text-xs leading-5 text-fg-secondary">
            <strong className="text-fg-secondary">Origin.</strong>{" "}
            {read.organization.provenanceDetail}
          </p>
          <p className="text-xs leading-5 text-fg-secondary">
            <strong className="text-fg-secondary">Internal structure is unavailable.</strong>{" "}
            {read.organization.structure.detail}
          </p>
        </div>
      )}
    </section>
  );
}
