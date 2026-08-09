import { Sparkles, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { HebyWhy } from "@/components/command-center/heby-why";
import type { CandidatesModel } from "@/features/intelligence-surfaces/workspace-model";

/*
 * Intelligence · Candidates (Hebun UI Phase 20C) — the candidate review surface. Emerging
 * intelligence under validation, preserving kind, evidence basis, provenance, uncertainty,
 * lifecycle, and restriction status. The Runtime surfaces no candidate instances, so the queue
 * is an honest empty state — no sample candidate is created. Candidate ≠ insight ≠ truth ≠
 * recommendation ≠ decision. Restrictions are never hidden; confidence is ordinal, never a score.
 * Heby advisory only — it may explain and compare, never promote a candidate to truth.
 */

export function Candidates({ model }: { model: CandidatesModel }) {
  return (
    <>
      <PageHeader
        title="Candidates"
        context="Emerging intelligence being considered but not yet validated — with its evidence, provenance, uncertainty, and restrictions intact."
        action={<Badge variant="neutral">Under validation</Badge>}
      />

      {/* Honest queue state */}
      <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border bg-surface-sunken px-4 py-2.5">
        <span className="inline-flex items-center gap-2">
          <span className="text-[0.7rem] uppercase tracking-wide text-fg-muted">Candidate queue</span>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-fg-secondary">
            <span className="size-2 rounded-full bg-fg-muted" aria-hidden="true" />
            No candidates — Runtime not connected
          </span>
        </span>
        <span className="hidden h-4 w-px bg-border sm:inline-block" aria-hidden="true" />
        <span className="text-xs text-fg-muted">Candidate ≠ validated. Validated ≠ decision.</span>
        <span className="ml-auto">
          <HebyWhy label="Assess uncertainty" variant="icon" region={{ key: "candidates", label: "Candidates" }} intent="ASSESS_UNCERTAINTY" />
        </span>
      </div>

      {/* Candidate lifecycle */}
      <Card className="mb-6">
        <CardContent>
          <p className="mb-3 text-sm font-semibold text-fg">Candidate lifecycle</p>
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-2">
            {model.lifecycle.map((stage, index, arr) => (
              <li key={stage.stage} className="flex items-center gap-2">
                <span className="rounded-md border border-border bg-surface-sunken px-2 py-1 text-[0.7rem] font-medium text-fg-secondary">
                  {stage.label}
                </span>
                {index < arr.length - 1 && <ArrowRight className="size-3 text-fg-muted" aria-hidden="true" />}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* Empty candidate queue */}
      <Card className="mb-6">
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <Sparkles className="size-6 text-fg-muted" />
          <p className="text-sm font-medium text-fg">No intelligence candidates are available</p>
          <p className="max-w-md text-xs leading-5 text-fg-muted">
            The runtime generates no candidate here — its settled inputs are not connected. Each future
            candidate carries its evidence basis, provenance, and declared uncertainty; none is invented.
          </p>
        </CardContent>
      </Card>

      {/* Candidate kinds */}
      <h2 className="mb-3 text-sm font-semibold text-fg">Candidate kinds</h2>
      <section aria-label="Candidate kinds" className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {model.kinds.map((kind) => (
          <Card key={kind.kind} className="h-full">
            <CardContent className="flex h-full flex-col gap-2">
              <span className="text-sm font-semibold text-fg">{kind.label}</span>
              <p className="text-xs leading-5 text-fg-secondary">{kind.describes}</p>
              <div className="mt-auto pt-1">
                <Badge variant="neutral">{kind.requiresBasis ? "Requires evidence" : "Structural"}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Restrictions + confidence — never hidden, always ordinal */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-fg">Restrictions (never hidden)</p>
            <div className="flex flex-wrap gap-2">
              {model.restrictions.map((r) => (
                <span key={r.kind} className="rounded-md border border-border bg-surface-sunken px-2 py-1 text-[0.7rem] font-medium text-fg-secondary" title={r.describes}>
                  {r.label}
                </span>
              ))}
            </div>
            <p className="text-[0.7rem] leading-5 text-fg-muted">A restricted candidate never silently becomes an insight or a recommendation.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-fg">Confidence (ordinal — not a score)</p>
            <div className="flex flex-wrap gap-2">
              {model.confidenceLevels.map((c) => (
                <span key={c.level} className="rounded-md border border-border bg-surface-sunken px-2 py-1 text-[0.7rem] font-medium text-fg-secondary">
                  {c.label}
                </span>
              ))}
            </div>
            <p className="text-[0.7rem] leading-5 text-fg-muted">Confidence is a declared ordinal level, never a percentage. Confidence ≠ truth.</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
