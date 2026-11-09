"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionShell } from "@/components/director-dashboard/section-shell";
import { ExecutiveOverviewSection } from "@/components/director-dashboard/executive-overview-section";
import { ExecutiveInsightsSection } from "@/components/director-dashboard/executive-insights-section";
import { SectionDetailList } from "@/components/director-dashboard/section-detail-list";
import { RecordDetailPanel } from "@/components/director-dashboard/record-detail-view";
import {
  createDefaultCommandRegistry,
  CommandAuditEventBuilder,
  CommandEnvelopeBus,
  CommandExecutionEngine,
  createDirectorCommandCenterModel,
  createRecordCommandView,
  UNRESOLVED_COMMAND_AUTHORITY,
} from "@/features/director-command";
import {
  createRecordDetailView,
  createSectionListView,
  NAVIGABLE_SECTION_IDS,
  type SectionListQuery,
} from "@/features/director-dashboard-navigation";
import {
  createExecutiveInsights,
  type ExecutiveInsight,
} from "@/features/director-dashboard-executive-insights";
import {
  createExecutiveOverview,
  type ExecutiveOverview,
} from "@/features/director-dashboard-executive-overview";
import {
  createDefaultWidgetRegistry,
  WidgetRefreshEngine,
  type DashboardWidgetId,
  type WidgetRuntimeSnapshot,
  type WidgetRuntimeState,
} from "@/features/director-dashboard-widget-runtime";
import type { DashboardSnapshot } from "@/features/director-dashboard-data";
import { DASHBOARD_SCOPE as dashboardScope } from "@/features/director-dashboard-ui/scope";
import { scheduleFrame } from "@/lib/frame-scheduler";
import { utcInstant } from "@/lib/format";

const widgetOrder: readonly DashboardWidgetId[] = [
  "runtime-overview", "active-agents", "active-workflows", "monitoring-summary",
  "health-summary", "diagnostics-summary", "evaluation-summary", "authentication-summary",
];

function stateCopy(state: WidgetRuntimeState): { readonly title: string; readonly description: string } {
  if (state.state === "loading") return { title: "Loading dashboard data", description: "Preparing the latest immutable dashboard snapshot." };
  if (state.state === "empty") return { title: "No data is currently available", description: "This widget has no records in the current dashboard snapshot." };
  if (state.state === "unavailable") return { title: "Data source unavailable", description: "The current dashboard snapshot cannot provide this widget safely." };
  return { title: "Widget unavailable", description: "This widget could not be prepared. Other dashboard widgets remain available." };
}

function titleFor(widgetId: DashboardWidgetId): string {
  return widgetId.split("-").map((word) => word[0]?.toUpperCase() + word.slice(1)).join(" ");
}

export function WidgetRuntimeCard({ state }: { readonly state: WidgetRuntimeState }) {
  const model = state.viewModel;
  const copy = stateCopy(state);
  return (
    <SectionShell title={model?.title ?? titleFor(state.widgetId)} description={model ? `${model.primaryValue} records in the current snapshot.` : copy.description} eyebrow="Dashboard Data">
      {state.state === "ready" ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-2xl font-semibold text-fg">{model?.primaryValue}</p>
            <Badge variant="info">{model?.displayStatus}</Badge>
          </div>
          <div className="divide-y divide-border">
            {model?.items.slice(0, 5).map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <p className="min-w-0 truncate text-sm text-fg">{item.label}</p>
                <span className="shrink-0 text-xs font-medium text-fg-secondary">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      ) : state.state === "loading" ? (
        <div className="flex min-h-32 flex-col justify-center gap-1 text-sm text-fg-secondary">
          <p className="font-medium text-fg">{copy.title}</p>
          <p>{copy.description}</p>
        </div>
      ) : (
        <EmptyState title={copy.title} description={copy.description} eyebrow={state.state} className="min-h-32 p-4" />
      )}
    </SectionShell>
  );
}

export function WidgetRuntimeBoard({ initialSnapshot, initialRuntime, initialOverview, initialInsights }: {
  readonly initialSnapshot?: DashboardSnapshot;
  readonly initialRuntime: WidgetRuntimeSnapshot;
  readonly initialOverview: ExecutiveOverview;
  readonly initialInsights: readonly ExecutiveInsight[];
}) {
  const [engine] = useState(() => new WidgetRefreshEngine(createDefaultWidgetRegistry(), "1.0.0"));
  const [commandRegistry] = useState(createDefaultCommandRegistry);
  const [commandCenterDependencies] = useState(() => ({
    registry: commandRegistry,
    authority: UNRESOLVED_COMMAND_AUTHORITY,
    commandBus: new CommandEnvelopeBus({
      now: () => new Date(),
      createCorrelationId: () => "dashboard-command-correlation",
    }),
    executionEngine: new CommandExecutionEngine({ registry: commandRegistry }),
    auditBuilder: new CommandAuditEventBuilder({
      now: () => new Date(),
      createEventId: () => "dashboard-command-audit-event",
    }),
  }));
  const [runtime, setRuntime] = useState(initialRuntime);
  const [overview, setOverview] = useState(initialOverview);
  const [insights, setInsights] = useState(initialInsights);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | undefined>(initialSnapshot);
  // Read-only drill-down state. Holding the section id rather than a built list
  // means every refresh re-derives the list from the newest snapshot.
  const [openSectionId, setOpenSectionId] = useState<string | undefined>(undefined);
  const [openRecordId, setOpenRecordId] = useState<string | undefined>(undefined);
  const [listQuery, setListQuery] = useState<SectionListQuery>({});
  // Monotonic token: only the most recent refresh may publish its result, so a
  // superseded refresh can never overwrite newer state with a stale snapshot.
  const refreshToken = useRef(0);

  /*
   * One immutable runtime snapshot fans out to every layer in a single commit:
   * widgets, then the overview derived from it, then the insights derived from
   * that overview. No layer can observe a different snapshot.
   */
  const applyRuntime = (next: WidgetRuntimeSnapshot) => {
    const nextOverview = createExecutiveOverview({ runtime: next, evaluatedAt: new Date() });
    setRuntime(next);
    setOverview(nextOverview);
    setInsights(createExecutiveInsights(nextOverview));
  };
  useEffect(() => {
    const token = (refreshToken.current += 1);
    return scheduleFrame(() => {
      if (refreshToken.current !== token) return;
      setSnapshot(initialSnapshot);
      applyRuntime(initialSnapshot
        ? engine.switchSnapshot({ snapshot: initialSnapshot, authorityScope: dashboardScope })
        : engine.manualRefresh({ authorityScope: dashboardScope }));
    });
  }, [engine, initialSnapshot]);
  const refresh = () => {
    const token = (refreshToken.current += 1);
    applyRuntime(engine.beginRefresh());
    scheduleFrame(() => {
      if (refreshToken.current !== token) return;
      applyRuntime(engine.manualRefresh({ snapshot, authorityScope: dashboardScope }));
    });
  };
  const openSection = (sectionId: string) => {
    setOpenSectionId(sectionId);
    setOpenRecordId(undefined);
    setListQuery({});
  };
  const backToDashboard = () => {
    setOpenSectionId(undefined);
    setOpenRecordId(undefined);
  };
  /*
   * Both views are derived, never stored: the open section and record ids are
   * the only navigation state, so every refresh re-derives the list and the
   * detail from the newest snapshot. The list query survives a record visit,
   * which keeps the list where the user left it on the way back.
   */
  const listView = openSectionId
    ? createSectionListView({ overview, runtime, sectionId: openSectionId, query: listQuery })
    : undefined;
  const recordDetail = openSectionId && openRecordId
    ? createRecordDetailView({ overview, runtime, sectionId: openSectionId, recordId: openRecordId })
    : undefined;
  /*
   * Commands are derived for display only. The authority presented is empty
   * because no identity model exists yet, so every command reports what it
   * would require rather than claiming to be runnable.
   */
  const recordCommands = recordDetail
    ? createRecordCommandView({
        registry: commandRegistry,
        detail: recordDetail,
        authority: UNRESOLVED_COMMAND_AUTHORITY,
      })
    : undefined;
  const commandCenter = recordDetail
    ? createDirectorCommandCenterModel(recordDetail, commandCenterDependencies)
    : undefined;

  return (
    <div className="space-y-6">
      <ExecutiveOverviewSection
        overview={overview}
        navigableSectionIds={NAVIGABLE_SECTION_IDS}
        onOpenSection={openSection}
      />
      {recordDetail ? (
        <RecordDetailPanel
          detail={recordDetail}
          commands={recordCommands}
          commandCenter={commandCenter}
          onBackToList={() => setOpenRecordId(undefined)}
          onBackToDashboard={backToDashboard}
        />
      ) : listView ? (
        <SectionDetailList
          view={listView}
          query={listQuery}
          onQueryChange={setListQuery}
          onClose={backToDashboard}
          onOpenRecord={setOpenRecordId}
        />
      ) : null}
      <ExecutiveInsightsSection insights={insights} />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-fg-secondary">
          <Badge variant={snapshot ? "success" : "warning"}>{snapshot ? "Snapshot Ready" : "Snapshot Unavailable"}</Badge>
          <span>{snapshot ? `Generated ${utcInstant(snapshot.generatedAt)}` : "No dashboard snapshot is available."}</span>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={widgetOrder.some((widgetId) => runtime.states[widgetId].state === "loading")}>
          <RefreshCw className="size-4" /> Refresh
        </Button>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        {widgetOrder.map((widgetId) => <WidgetRuntimeCard key={widgetId} state={runtime.states[widgetId]} />)}
      </div>
    </div>
  );
}
