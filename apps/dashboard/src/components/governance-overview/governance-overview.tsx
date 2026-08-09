/*
 * governance-overview.tsx — the Governance Overview truth surface (Hebun UI Phase 23B).
 *
 * States what governance capabilities and boundaries actually exist: an honest availability map
 * with authority owner and mutation boundary per area. It renders NO fabricated compliance %,
 * governance/audit health, risk %, explainability score, or policy/violation/approval count, and
 * NO mutation / approve / reject controls. It links to Security Center; it does not duplicate it.
 *
 * Server component — no client state, no mutation affordance.
 */

import Link from "next/link";
import { ArrowUpRight, ShieldCheck, ShieldOff } from "lucide-react";
import {
  getGovernanceOverviewModel,
  type GovernanceAreaStatus,
  type GovernanceAreaView,
} from "@/features/governance-overview";

const STATUS_META: Record<GovernanceAreaStatus, { label: string; dot: string; text: string }> = {
  "authoritative-real": { label: "Authoritative", dot: "bg-success", text: "text-success" },
  "derived-seeded": { label: "Derived · seeded input", dot: "bg-warning", text: "text-warning" },
  "not-connected": { label: "Not connected", dot: "bg-fg-muted", text: "text-fg-muted" },
  "external-authority": { label: "External authority", dot: "bg-info", text: "text-info" },
  restricted: { label: "Restricted", dot: "bg-fg-muted", text: "text-fg-muted" },
};

function AreaRow({ item }: { item: GovernanceAreaView }) {
  const meta = STATUS_META[item.status];
  return (
    <li className="flex flex-col gap-1.5 p-3 sm:flex-row sm:items-start sm:gap-4">
      <div className="flex min-w-0 items-center gap-2 sm:w-52 sm:shrink-0">
        <span className={`size-1.5 shrink-0 rounded-full ${meta.dot}`} aria-hidden="true" />
        <span className="truncate text-sm font-medium text-fg">{item.area}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-fg-secondary">{item.question}</p>
        <p className="mt-0.5 text-[0.7rem] leading-5 text-fg-muted">{item.detail}</p>
        <p className="mt-1 text-[0.7rem] text-fg-muted">
          Owner: <span className="text-fg-secondary">{item.authorityOwner}</span> · Backing: {item.backing} · Mutation: none
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className={`text-[0.7rem] font-medium uppercase tracking-wide ${meta.text}`}>{meta.label}</span>
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

export function GovernanceOverview() {
  const model = getGovernanceOverviewModel();

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex items-center gap-2 text-sm text-fg-secondary">
        <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
        Governance holds the rules — and states honestly what is real, what is derived from seeded input, and what is not connected.
      </div>

      <section className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="text-sm font-semibold text-fg">Governance availability</h2>
          <p className="text-[0.7rem] text-fg-muted">Authority owner and mutation boundary per area — honest state only.</p>
        </div>
        <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border bg-surface">
          {model.availability.map((item) => (
            <AreaRow key={item.area} item={item} />
          ))}
        </ul>
      </section>

      <p className="max-w-3xl text-xs leading-5 text-fg-muted">{model.note}</p>

      <p className="flex items-center gap-2 text-xs text-fg-muted">
        <ShieldOff className="size-3.5" aria-hidden="true" />
        Governance is read-only here. It explains policy and posture; it never approves, authorizes, decides, enforces, or executes.
      </p>
    </div>
  );
}
