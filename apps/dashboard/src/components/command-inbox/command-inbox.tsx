import { Inbox as InboxIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { HebyWhy } from "@/components/command-center/heby-why";
import type { CommandInboxModel } from "@/features/command-attention/workspace-model";

/*
 * Command · Inbox (Hebun UI Phase 20B) — the unified Director attention surface. It absorbs
 * the former standalone Alerts (Phase 20A decision D2): an alert is one TYPE of attention;
 * the Inbox is the SURFACE. Every attention source is honestly not connected, so the queue is
 * an explained empty state — no fabricated alert, decision, failure, count, or timestamp.
 * Ambient Heby is advisory only. Alert ≠ incident ≠ decision ≠ finding.
 */

export function CommandInbox({ model }: { model: CommandInboxModel }) {
  return (
    <>
      <PageHeader
        title="Inbox"
        context="What requires your attention — alerts, decision pressure, briefings, failures, and requests, unified in one queue."
        action={<Badge variant="neutral">Attention</Badge>}
      />

      {/* Honest queue state */}
      <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border bg-surface-sunken px-4 py-2.5">
        <span className="inline-flex items-center gap-2">
          <span className="text-[0.7rem] uppercase tracking-wide text-fg-muted">Attention queue</span>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-fg-secondary">
            <span className="size-2 rounded-full bg-fg-muted" aria-hidden="true" />
            No source connected
          </span>
        </span>
        <span className="hidden h-4 w-px bg-border sm:inline-block" aria-hidden="true" />
        <span className="text-xs text-fg-muted">No attention items — this is not the same as nothing happening.</span>
        <span className="ml-auto">
          <HebyWhy
            label="Why is nothing here?"
            variant="icon"
            region={{ key: "command-inbox", label: "Inbox" }}
            intent="EXPLAIN"
          />
        </span>
      </div>

      {/* Empty queue */}
      <Card className="mb-6">
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <InboxIcon className="size-6 text-fg-muted" />
          <p className="text-sm font-medium text-fg">Your inbox is empty</p>
          <p className="max-w-md text-xs leading-5 text-fg-muted">
            No unified attention source is connected yet. When alerts, decision pressure, and briefings
            are wired in, only real surfaced records appear here — never fabricated ones.
          </p>
        </CardContent>
      </Card>

      {/* Structural attention-kind vocabulary */}
      <section aria-label="Attention kinds" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {model.kinds.map((kind) => (
          <Card key={kind.kind} className="h-full">
            <CardContent className="flex h-full flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-fg">{kind.label}</span>
                <Badge variant="neutral">Not connected</Badge>
              </div>
              <p className="text-xs leading-5 text-fg-secondary">{kind.describes}</p>
              <p className="mt-auto text-[0.7rem] uppercase tracking-wide text-fg-muted">From {kind.origin}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </>
  );
}
