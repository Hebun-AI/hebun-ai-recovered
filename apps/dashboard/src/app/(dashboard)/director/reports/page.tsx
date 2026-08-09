import { CommandReports } from "@/components/command-reports/command-reports";
import { getCommandReportsModel } from "@/features/command-reports/workspace-model";

export const metadata = { title: "Reports — Hebun AI" };

/*
 * Command · Reports (Phase 20B rebuild) — an honest enterprise reporting surface. It no longer
 * imports `@/features/director/mock`. Phase 20B implements no reporting engine, no export, and
 * fabricates no report or timestamp: the catalog is an explained empty state and export is
 * honestly disabled. It surfaces only the structural facets a real report carries.
 */

export default function ExecutiveReportsPage() {
  return <CommandReports model={getCommandReportsModel()} />;
}
