/*
 * company-memory-surface.tsx — read-only Company Memory inspection (Hebun UI Phase 21B).
 *
 * Presents admitted organizational memory read from the REAL Enterprise Memory
 * authority. It renders ONLY what the read model contains: an honest connection
 * state, and — only when the real authority returns records — a governed memory
 * inspector. There are no admit / approve / reject / create / edit controls, no
 * forms, and no write actions. Nothing is fabricated: no memory, count, evidence,
 * provenance, timestamp, score, or freshness is invented here.
 *
 * Server component — no client state, no interactivity beyond native disclosure.
 */

import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  Fingerprint,
  GitBranch,
  Gauge,
  Lock,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  CompanyMemoryReadModel,
  CompanyMemoryRecordView,
} from "@/features/company-memory";

/* The five separated metadata dimensions plus classification — the governed model. */
const DIMENSIONS: ReadonlyArray<{ label: string; question: string; note: string }> = [
  { label: "Origin", question: "Where did it come from?", note: "The source the knowledge originated from." },
  { label: "Authority", question: "Who admitted it?", note: "The explicit authority under which it was admitted." },
  { label: "Provenance", question: "How was it derived?", note: "The method that produced it and what it was derived from." },
  { label: "Confidence", question: "How strongly is it trusted?", note: "A declared trust level — not authority, not truth." },
  { label: "Sensitivity", question: "Who may read it?", note: "Classification; restricted content is withheld." },
  { label: "Lifecycle", question: "What is its standing?", note: "From candidate to admitted to archived." },
];

interface ConnectionPresentation {
  readonly icon: LucideIcon;
  readonly badge: BadgeVariant;
  readonly badgeLabel: string;
  readonly title: string;
  readonly body: string;
}

function presentConnection(model: CompanyMemoryReadModel): ConnectionPresentation {
  switch (model.connection) {
    case "authority-unavailable":
      return {
        icon: ShieldOff,
        badge: "neutral",
        badgeLabel: "Not available",
        title: "Enterprise Memory requires an authorized organization context",
        body: "Company Memory reads durable memory under an authorized organization context. None is available on this request, so nothing is read and nothing is shown — the surface fails closed rather than listing memory across organizations.",
      };
    case "connected-empty":
      return {
        icon: ShieldCheck,
        badge: "info",
        badgeLabel: "Connected",
        title: "No admitted organizational memory is available",
        body: "The Enterprise Memory authority was read under an authorized context and returned no admitted memory. Nothing has been admitted yet — no record is invented to fill the space.",
      };
    case "connected-populated":
      return {
        icon: BadgeCheck,
        badge: "success",
        badgeLabel: "Connected",
        title: "Admitted organizational memory",
        body: "Durable memory admitted into Enterprise Memory under explicit authority, read-only.",
      };
    case "read-failed":
      return {
        icon: ShieldAlert,
        badge: "error",
        badgeLabel: "Read failed",
        title: "Enterprise Memory could not be read",
        body: "The Enterprise Memory read path did not return a result. No memory is shown; no placeholder is substituted.",
      };
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[0.7rem] font-medium uppercase tracking-wide text-fg-muted">{label}</span>
      <span className="text-sm text-fg">{children}</span>
    </div>
  );
}

const sensitivityBadge: Record<CompanyMemoryRecordView["classification"]["sensitivity"], BadgeVariant> = {
  public: "neutral",
  internal: "info",
  confidential: "warning",
  restricted: "error",
};

const lifecycleBadge: Record<CompanyMemoryRecordView["lifecycle"]["state"], BadgeVariant> = {
  candidate: "info",
  approved: "success",
  rejected: "error",
  archived: "warning",
};

function MemoryRecordCard({ record }: { record: CompanyMemoryRecordView }) {
  return (
    <details className="group rounded-lg border border-border bg-surface">
      <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-2 p-4 marker:content-none">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-fg">
            {record.contentWithheld ? "Restricted — content withheld" : record.statement}
          </span>
          <span className="block truncate font-mono text-xs text-fg-muted">
            {record.memoryId} · v{record.version} · {record.namespace}
          </span>
        </span>
        <Badge variant={lifecycleBadge[record.lifecycle.state]}>{record.lifecycle.state}</Badge>
        <Badge variant={sensitivityBadge[record.classification.sensitivity]}>
          {record.classification.sensitivity}
        </Badge>
        {record.contentWithheld && <Lock className="size-3.5 text-fg-muted" aria-hidden="true" />}
      </summary>

      <div className="grid gap-4 border-t border-border p-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Origin">
          {record.origin.kind} · {record.origin.reference}
        </Field>
        <Field label="Authority">
          {record.authority.authorityType} · {record.authority.admittedByType}:{record.authority.admittedById}
        </Field>
        <Field label="Provenance">
          {record.provenance.method}
          {record.provenance.derivedFrom.length > 0
            ? ` · derived from ${record.provenance.derivedFrom.length}`
            : " · not derived"}
        </Field>
        <Field label="Confidence">
          {record.confidence.level}
          {record.confidence.score !== null ? ` · ${record.confidence.score}` : ""}
        </Field>
        <Field label="Category">{record.classification.category}</Field>
        <Field label="Admitted at">{record.authority.admittedAt}</Field>

        <div className="sm:col-span-2 lg:col-span-3">
          <Field label="Relationships">
            {record.relationships.length === 0 ? (
              <span className="text-fg-muted">None</span>
            ) : (
              <span className="flex flex-wrap gap-2">
                {record.relationships.map((relationship, index) => (
                  <span
                    key={`${relationship.type}-${relationship.target.memoryId}-${index}`}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-sunken px-2 py-0.5 text-xs"
                  >
                    <GitBranch className="size-3 text-fg-muted" aria-hidden="true" />
                    {relationship.type} → <span className="font-mono">{relationship.target.memoryId}</span>
                  </span>
                ))}
              </span>
            )}
          </Field>
        </div>

        {record.supersededBy && (
          <div className="sm:col-span-2 lg:col-span-3">
            <Field label="Superseded">
              by v{record.supersededBy.supersededByVersion} · {record.supersededBy.supersededAt}
            </Field>
          </div>
        )}
      </div>
    </details>
  );
}

export function CompanyMemorySurface({ model }: { model: CompanyMemoryReadModel }) {
  const connection = presentConnection(model);
  const ConnectionIcon = connection.icon;
  const populated = model.connection === "connected-populated";

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {/* Honest connection / authority state */}
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-start">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-sunken">
            <ConnectionIcon className="size-4 text-fg-secondary" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-fg">{connection.title}</h2>
              <Badge variant={connection.badge}>{connection.badgeLabel}</Badge>
              {populated && (
                <Badge variant="neutral">{model.records.length} admitted</Badge>
              )}
            </div>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-fg-secondary">{connection.body}</p>
          </div>
        </CardContent>
      </Card>

      {/* Records — only when the real authority returned them */}
      {populated && (
        <div className="flex flex-col gap-3">
          {model.records.map((record) => (
            <MemoryRecordCard key={`${record.memoryId}:${record.version}`} record={record} />
          ))}
        </div>
      )}

      {/* The governed memory model — makes the empty surface intentional, not blank */}
      <Card>
        <CardHeader>
          <CardTitle>The governed memory model</CardTitle>
          <span className="text-xs text-fg-muted">
            Enterprise Memory keeps these dimensions independent — none implies another. Read-only; admission happens under explicit authority elsewhere.
          </span>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DIMENSIONS.map((dimension) => (
            <div key={dimension.label} className="rounded-md border border-border bg-surface-sunken p-3">
              <div className="flex items-center gap-1.5">
                <Fingerprint className="size-3.5 text-fg-muted" aria-hidden="true" />
                <p className="text-sm font-semibold text-fg">{dimension.label}</p>
              </div>
              <p className="mt-0.5 text-xs font-medium text-fg-secondary">{dimension.question}</p>
              <p className="mt-1 text-xs leading-5 text-fg-muted">{dimension.note}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="flex items-center gap-2 text-xs text-fg-muted">
        <Gauge className="size-3.5" aria-hidden="true" />
        Company Memory is read-only. It inspects the Enterprise Memory authority; it never admits, edits, or persists memory.
      </p>
    </div>
  );
}
