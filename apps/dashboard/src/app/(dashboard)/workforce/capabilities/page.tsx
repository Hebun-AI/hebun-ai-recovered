import { PageHeader } from "@/components/layout/page-header";
import { CapabilitiesSurface } from "@/components/workforce-workspace/capabilities-surface";
import { getCapabilitiesModel } from "@/features/workforce/capabilities-model";

export const metadata = { title: "Capabilities — Hebun AI" };

/*
 * Capabilities — authoritative Workforce surface (UI Phase 25C).
 *
 * What the workforce is structurally DECLARED capable of, aggregated from seeded agent
 * definitions. Declaration, tool connection, permission grant, authorization, execution, and
 * success are kept strictly separate, each owned by its real workspace. Counts and categories
 * only — no fake score. No grant/approve/connect/execute control, no secret.
 */

export default function CapabilitiesPage() {
  const model = getCapabilitiesModel();

  return (
    <>
      <PageHeader
        title="Capabilities"
        context={`${model.declaredCapabilities.length} declared capabilities · ${model.referencedTools.length} referenced tools · execution ${model.executionAvailable ? "available" : "unavailable"}`}
      />
      <CapabilitiesSurface model={model} />
    </>
  );
}
