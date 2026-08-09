import Link from "next/link";
import { ArrowLeft, Construction } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { ResolvedModule } from "@/config/sidebar.config";

/*
 * Catch-all module placeholder. Renders for any sidebar.config route without a real page.
 *
 * UI Phase 25D: the seeded-AgentCard side panel was removed. It only ever rendered for the legacy
 * `/workforce/{dept}/{agent}` shadow tree (the sole source of `agentId`), which Phase 25D retired
 * to a redirect to `/agents` — so this placeholder no longer surfaces any fabricated live agent
 * activity. The AgentCard component itself is deleted (zero live reach).
 */

export function ModulePlaceholder({ module }: { module: ResolvedModule }) {
  const { section, group, item } = module;

  return (
    <>
      <PageHeader
        title={item.label}
        context={[section.label, group.label].filter(Boolean).join(" · ")}
        action={
          <Badge variant={section.placeholder ? "warning" : "info"}>
            {section.placeholder ? "planned" : "placeholder"}
          </Badge>
        }
      />

      <div className="grid grid-cols-12 gap-5 lg:gap-6">
        <div className="col-span-12 xl:col-span-8">
          <div className="space-y-4">
            <EmptyState
              eyebrow="Module Placeholder"
              title={`${item.label} is not populated yet`}
              description={
                item.description ??
                section.description ??
                "This module exists in the Hebun AI architecture map. Its page content will appear when the module is implemented."
              }
              icon={<Construction className="size-5" />}
              action={
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors duration-(--dur-fast) hover:text-primary-hover"
                >
                  <ArrowLeft className="size-4" />
                  Back to Director Dashboard
                </Link>
              }
            />
          </div>
        </div>
      </div>
    </>
  );
}
