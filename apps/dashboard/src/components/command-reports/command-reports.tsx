import { FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HebyWhy } from "@/components/command-center/heby-why";
import type { CommandReportsModel } from "@/features/command-reports/workspace-model";

/*
 * Command · Reports (Hebun UI Phase 20B) — an honest enterprise reporting surface. It replaces
 * the retired `director/mock` report list. Phase 20B implements NO reporting engine, NO export,
 * and fabricates NO report or timestamp: the catalog is an explained empty state and export is
 * honestly disabled. It surfaces only the structural facets a real report carries. Heby advisory only.
 */

export function CommandReports({ model }: { model: CommandReportsModel }) {
  return (
    <>
      <PageHeader
        title="Reports"
        context="Formal views of organizational state that can be generated or reviewed — each traceable to a real source."
        action={<Badge variant="neutral">No engine</Badge>}
      />

      {/* Empty catalog + honest export state */}
      <Card className="mb-6">
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <FileText className="size-6 text-fg-muted" />
          <p className="text-sm font-medium text-fg">No reports are available yet</p>
          <p className="max-w-md text-xs leading-5 text-fg-muted">
            No report definition or generation source is connected. No report engine, export, or schedule
            runs in this phase — this is not an export failure.
          </p>
          <div className="mt-1 flex items-center gap-2">
            <Button variant="ghost" size="sm" disabled title="Export is not connected — no report generation runtime exists yet">
              Export unavailable
            </Button>
            <HebyWhy
              label="Explain report scope"
              variant="icon"
              region={{ key: "command-reports", label: "Reports" }}
              intent="EXPLAIN"
            />
          </div>
        </CardContent>
      </Card>

      {/* Structural report facets */}
      <section aria-label="Report facets" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {model.facets.map((facet) => (
          <Card key={facet.key} className="h-full">
            <CardContent className="flex h-full flex-col gap-2">
              <span className="text-sm font-semibold text-fg">{facet.label}</span>
              <p className="text-xs leading-5 text-fg-secondary">{facet.describes}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </>
  );
}
