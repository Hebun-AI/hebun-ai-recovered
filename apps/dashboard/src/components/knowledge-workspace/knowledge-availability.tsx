import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type {
  KnowledgeAvailabilityState,
  KnowledgeAvailabilityView,
  KnowledgeWorkspaceModel,
} from "@/features/knowledge/workspace-model";

/*
 * Knowledge Availability (UI Phase 21B) — the Overview's orientation map. It states,
 * honestly, what organizational knowledge is available, where it comes from, and how
 * available/trustworthy each area is. Every value is a structural fact or an explicit
 * unavailable/derived state from the model — no count, freshness, or aggregate score.
 */

const STATE_META: Record<
  KnowledgeAvailabilityState,
  { readonly label: string; readonly dot: string; readonly text: string }
> = {
  "authority-connected": { label: "Connected", dot: "bg-success", text: "text-success" },
  "requires-authorized-context": {
    label: "Authorized context required",
    dot: "bg-warning",
    text: "text-warning",
  },
  "not-connected": { label: "Not connected", dot: "bg-fg-muted", text: "text-fg-muted" },
  "derived-nonauthoritative": {
    label: "Derived · non-authoritative",
    dot: "bg-warning",
    text: "text-warning",
  },
  "reference-data": { label: "Reference data", dot: "bg-info", text: "text-info" },
  "contract-only": { label: "Contract-only", dot: "bg-fg-muted", text: "text-fg-muted" },
};

function AvailabilityRow({ item }: { item: KnowledgeAvailabilityView }) {
  const meta = STATE_META[item.state];
  return (
    <li className="flex flex-col gap-1.5 p-3 sm:flex-row sm:items-start sm:gap-4">
      <div className="flex min-w-0 items-center gap-2 sm:w-44 sm:shrink-0">
        <span className={`size-1.5 shrink-0 rounded-full ${meta.dot}`} aria-hidden="true" />
        <span className="truncate text-sm font-medium text-fg">{item.area}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-fg-secondary">{item.question}</p>
        <p className="mt-0.5 text-[0.7rem] leading-5 text-fg-muted">{item.detail}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className={`text-[0.7rem] font-medium uppercase tracking-wide ${meta.text}`}>
          {meta.label}
        </span>
        {item.href && (
          <Link
            href={item.href}
            className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
          >
            Open
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
        )}
      </div>
    </li>
  );
}

export function KnowledgeAvailability({ model }: { model: KnowledgeWorkspaceModel }) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold text-fg">Knowledge availability</h2>
        <p className="text-[0.7rem] text-fg-muted">
          What is available, where it comes from, and how trustworthy it is — honest state only.
        </p>
      </div>
      <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border bg-surface">
        {model.availability.map((item) => (
          <AvailabilityRow key={item.area} item={item} />
        ))}
      </ul>
    </section>
  );
}
