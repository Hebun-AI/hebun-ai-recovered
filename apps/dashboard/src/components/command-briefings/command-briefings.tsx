import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { HebyWhy } from "@/components/command-center/heby-why";
import type { CommandBriefingsModel } from "@/features/command-briefings/workspace-model";

/*
 * Command · Briefings (Hebun UI Phase 20B) — the executive briefing reading surface. It
 * presents the real Director Briefing contract (Organizational Intelligence Runtime, Phase 8):
 * a briefing ORGANIZES bound artifacts and terminates at the Director; it is not a decision or
 * recommendation. The Runtime is contract-only, so no briefing instance exists and the surface
 * renders an honest empty state — no fabricated summary, change, or timestamp. Heby advisory only.
 */

export function CommandBriefings({ model }: { model: CommandBriefingsModel }) {
  return (
    <>
      <PageHeader
        title="Briefings"
        context="What the Director should understand right now — a preserved, attributable synthesis, never a decision."
        action={<Badge variant="neutral">Advisory</Badge>}
      />

      {/* Contract truth + honest state */}
      <Card className="mb-6">
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-primary">
              <Sparkles className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm leading-6 text-fg-secondary">{model.contract.statement}</p>
              <p className="mt-1 text-xs text-fg-muted">
                A briefing is not {model.contract.isNot.join(", ")}.
              </p>
            </div>
            <span className="ml-auto">
              <HebyWhy
                label="What would a briefing contain?"
                variant="icon"
                region={{ key: "command-briefings", label: "Briefings" }}
                intent="SUMMARIZE"
              />
            </span>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-border/70 pt-3">
            {model.contract.dependencies.map((dep) => (
              <span key={dep.label} className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
                <span className="size-2 rounded-full bg-fg-muted" aria-hidden="true" />
                {dep.label}: not connected
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Empty briefing */}
      <Card className="mb-6">
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <Sparkles className="size-6 text-fg-muted" />
          <p className="text-sm font-medium text-fg">No executive briefing is available yet</p>
          <p className="max-w-md text-xs leading-5 text-fg-muted">
            The Organizational Intelligence Runtime is contract-only — no artifacts are bound, so no
            briefing is assembled. A briefing appears here only when real bound intelligence exists.
          </p>
        </CardContent>
      </Card>

      {/* Structural composition a real briefing would organize */}
      <section aria-label="Briefing sections" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {model.sections.map((section) => (
          <Card key={section.key} className="h-full">
            <CardContent className="flex h-full flex-col gap-2">
              <span className="text-sm font-semibold text-fg">{section.label}</span>
              <p className="text-xs leading-5 text-fg-secondary">{section.describes}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </>
  );
}
