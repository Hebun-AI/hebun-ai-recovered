import { ChevronDown } from "lucide-react";
import { AdapterWidget } from "@/components/adapters/adapter-widget";
import { CostSummary } from "@/components/dashboard/cost-summary";
import { EventTimeline } from "@/components/dashboard/event-timeline";
import { FinanceAlerts } from "@/components/dashboard/finance-alerts";
import { FinanceOverview } from "@/components/dashboard/finance-overview";
import { HrOverview } from "@/components/dashboard/hr-overview";
import { LegalOverview } from "@/components/dashboard/legal-overview";
import { OperationsOverview } from "@/components/dashboard/operations-overview";
import { SalesOverview } from "@/components/dashboard/sales-overview";
import { CashFlowPanel } from "@/components/dashboard/cash-flow-panel";
import { BudgetPanel } from "@/components/dashboard/budget-panel";
import { DataStateBadge } from "@/components/dashboard/data-state-badge";
import { KnowledgeGraphWidget } from "@/components/dashboard/knowledge-graph-widget";
import { RegistryWidget } from "@/components/dashboard/registry-widget";
import { ExecutiveSummaryPanel } from "@/components/director/executive-summary-panel";
import { MemoryWidget } from "@/components/memory/memory-widget";
import { PolicyWidget } from "@/components/policy/policy-widget";
import { InvocationWidget } from "@/components/provider-invocation/invocation-widget";
import { ProviderFrameworkWidget } from "@/components/provider-framework/provider-framework-widget";
import { ProviderMatrixWidget } from "@/components/provider-matrix/provider-matrix-widget";
import { RoutingWidget } from "@/components/provider-routing/routing-widget";
import { BrowserWidget } from "@/components/providers/browser/browser-widget";
import { ClaudeWidget } from "@/components/providers/claude/claude-widget";
import { ClaudeLiveWidget } from "@/components/providers/claude-live/claude-live-widget";
import { CodexWidget } from "@/components/providers/codex/codex-widget";
import { CommunicationWidget } from "@/components/providers/communication/communication-widget";
import { ComputerUseWidget } from "@/components/providers/computer-use/computer-use-widget";
import { GitHubWidget } from "@/components/providers/github/github-widget";
import { ReasoningWidget } from "@/components/reasoning/reasoning-widget";
import { RuntimeWidget } from "@/components/runtime-boundary/runtime-widget";
import { ActivationWidget } from "@/components/runtime-activation/activation-widget";
import { events } from "@/features/events/mock";

function DetailsSection({
  title,
  description,
  badges,
  defaultOpen = false,
  children,
}: {
  title: string;
  description: string;
  badges: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group overflow-hidden rounded-xl border bg-surface shadow-sm"
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 p-5 sm:p-6">
        <div className="space-y-1">
          <h4 className="text-base font-semibold leading-6 text-fg">{title}</h4>
          <p className="max-w-3xl text-sm leading-6 text-fg-secondary">{description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden flex-wrap justify-end gap-2 sm:flex">{badges}</div>
          <ChevronDown className="size-4 text-fg-muted transition-transform duration-(--dur-fast) group-open:rotate-180" />
        </div>
      </summary>
      <div className="border-t border-border/70 p-5 pt-4 sm:p-6 sm:pt-5">{children}</div>
    </details>
  );
}

export function SystemDetailsPanel() {
  return (
    <div className="space-y-4">
      <DetailsSection
        title="Cognitive and control layers"
        description="Reasoning, governance, planning, orchestration, and execution foundations."
        badges={
          <>
            <DataStateBadge state="DERIVED" />
            <DataStateBadge state="SIMULATION" />
          </>
        }
        defaultOpen
      >
        <div className="grid gap-5 xl:grid-cols-2 xl:gap-6">
          <ReasoningWidget />
          <PolicyWidget />
        </div>
      </DetailsSection>

      <DetailsSection
        title="Registry, memory, and provider infrastructure"
        description="Tertiary platform structure, catalogs, routing intelligence, and audit scaffolding."
        badges={
          <>
            <DataStateBadge state="DERIVED" />
            <DataStateBadge state="MOCK" />
          </>
        }
      >
        <div className="grid gap-5 xl:grid-cols-2 xl:gap-6">
          <RegistryWidget />
          <KnowledgeGraphWidget />
          <MemoryWidget />
          <ProviderMatrixWidget />
          <ProviderFrameworkWidget />
          <AdapterWidget />
          <RoutingWidget />
          <InvocationWidget />
        </div>
      </DetailsSection>

      <DetailsSection
        title="Provider and runtime foundations"
        description="Provider-specific simulation, dry-run, and runtime-readiness surfaces."
        badges={
          <>
            <DataStateBadge state="SIMULATION" />
            <DataStateBadge state="DRY RUN" />
            <DataStateBadge state="PLACEHOLDER" />
          </>
        }
      >
        <div className="grid gap-5 xl:grid-cols-2 xl:gap-6">
          <RuntimeWidget />
          <ActivationWidget />
          <ClaudeLiveWidget />
          <ClaudeWidget />
          <CodexWidget />
          <GitHubWidget />
          <BrowserWidget />
          <ComputerUseWidget />
          <CommunicationWidget />
        </div>
      </DetailsSection>

      <DetailsSection
        title="Business and department detail"
        description="Broader operating views, financial context, and event history when deeper inspection is needed."
        badges={
          <>
            <DataStateBadge state="MOCK" />
            <DataStateBadge state="DERIVED" />
          </>
        }
      >
        <div className="grid gap-5 xl:grid-cols-2 xl:gap-6">
          <SalesOverview />
          <OperationsOverview />
          <FinanceOverview />
          <FinanceAlerts />
          <CashFlowPanel />
          <BudgetPanel />
          <HrOverview />
          <LegalOverview />
          <div className="xl:col-span-2">
            <EventTimeline events={events.slice(0, 7)} />
          </div>
          <CostSummary />
          <ExecutiveSummaryPanel />
        </div>
      </DetailsSection>
    </div>
  );
}
