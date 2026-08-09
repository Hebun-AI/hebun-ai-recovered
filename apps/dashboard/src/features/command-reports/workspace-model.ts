/*
 * command-reports/workspace-model.ts — the read model for Command · Reports
 * (Hebun UI Phase 20B).
 *
 * PROVENANCE CONTRACT (no-fake-data, Phase 20A honesty rules):
 *
 *   Reports answers: "What formal views of organizational state can be generated or
 *   reviewed?" Phase 20B implements NO reporting engine, NO PDF/export runtime, NO
 *   scheduled report runtime, and fabricates NO report instance, timestamp, or period.
 *
 *   No report definition or instance source is connected: there is no report generation
 *   service and no persisted report record. So the report list is ALWAYS empty and export
 *   is honestly unavailable. This model surfaces only the structural facets a real report
 *   would carry, and calls no model.
 */

/** A structural facet a real report definition/instance would carry. Copy only. */
export interface ReportFacetView {
  readonly key: string;
  readonly label: string;
  readonly describes: string;
}

const REPORT_FACETS: readonly ReportFacetView[] = [
  { key: "definition", label: "Report definition", describes: "What the report covers and who it is for." },
  { key: "scope", label: "Source scope", describes: "The real surfaces a report would draw from — never invented content." },
  { key: "evidence", label: "Evidence", describes: "Each figure traces to a source; nothing is asserted without provenance." },
  { key: "generated", label: "Generated state", describes: "Whether an instance has been generated, and from which snapshot." },
  { key: "freshness", label: "Freshness", describes: "How current the underlying state is. Unknown until a source connects." },
  { key: "authority", label: "Authority", describes: "Who may generate, view, or share the report." },
  { key: "export", label: "Export availability", describes: "Whether export is connected. It is not in this phase." },
];

export interface CommandReportsModel {
  readonly facets: readonly ReportFacetView[];
  /** Live report definitions/instances. Always empty — no report source is connected. */
  readonly reports: readonly never[];
  /** Whether a report generation/definition source is connected. Always false in this phase. */
  readonly reportingConnected: false;
  /** Whether export is connected. Always false — there is no export runtime. */
  readonly exportAvailable: false;
}

/** Build the Reports model. Pure; runs no engine; fabricates nothing. */
export function getCommandReportsModel(): CommandReportsModel {
  return {
    facets: REPORT_FACETS,
    reports: [],
    reportingConnected: false,
    exportAvailable: false,
  };
}
