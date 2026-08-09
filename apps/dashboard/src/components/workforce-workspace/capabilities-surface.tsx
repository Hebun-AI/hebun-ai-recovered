import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import type {
  CapabilitiesModel,
  CapabilityAggregate,
  CapabilityLadderStage,
  LadderState,
} from "@/features/workforce/capabilities-model";

/*
 * Capabilities surface (UI Phase 25C). What the workforce is structurally DECLARED capable of —
 * aggregated from seeded agent definitions. It keeps declaration, tool connection, permission
 * grant, authorization, execution, and success strictly separate, names the owning workspace for
 * each, and shows counts/categories only — never a fake health/activity/performance score. It
 * carries NO grant/revoke/approve/authorize/enable/connect/execute/dispatch control.
 */

const LADDER_VARIANT: Record<LadderState, BadgeVariant> = {
  reached: "success",
  "not-reached": "neutral",
};

function AggregateList({
  title,
  subtitle,
  tag,
  tagTone,
  items,
}: {
  title: string;
  subtitle: string;
  tag: string;
  tagTone: BadgeVariant;
  items: readonly CapabilityAggregate[];
}) {
  return (
    <Card>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          <span className="text-xs text-fg-muted">{subtitle}</span>
        </div>
        <Badge variant={tagTone}>{tag}</Badge>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {items.length === 0 ? (
          <p className="text-sm text-fg-muted">None declared.</p>
        ) : (
          items.map((item) => (
            <span
              key={item.name}
              className="inline-flex items-center gap-1.5 rounded-md border bg-surface-sunken px-2.5 py-1 text-xs"
            >
              <span className="font-medium text-fg">{item.name}</span>
              <span className="tabular-nums text-fg-muted">×{item.declaredBy}</span>
            </span>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function CapabilitiesSurface({ model }: { model: CapabilitiesModel }) {
  return (
    <div className="flex flex-col gap-6">
      {/* Provenance — how to read every value. */}
      <Card>
        <CardHeader>
          <CardTitle>Declared, not able</CardTitle>
          <Badge variant="warning">runtime {model.runtimeMode}</Badge>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6 text-fg-secondary">{model.provenanceNote}</p>
        </CardContent>
      </Card>

      {/* The capability ladder — declaration is not ability. */}
      <Card>
        <CardHeader>
          <CardTitle>Capability ladder</CardTitle>
          <span className="text-xs text-fg-muted">Declaration → connection → permission → authorization → execution → success</span>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {model.capabilityLadder.map((stage: CapabilityLadderStage) => (
            <div key={stage.key} className="flex items-start justify-between gap-3 border-b py-2 last:border-0">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-fg">{stage.label}</p>
                <p className="text-xs leading-5 text-fg-muted">{stage.detail}</p>
              </div>
              <Badge variant={LADDER_VARIANT[stage.state]} className="shrink-0">
                {stage.state === "reached" ? "reached" : "not reached"}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <AggregateList
        title="Declared Capabilities"
        subtitle={`Across ${model.definitionCount} seeded definitions. A declaration of intent, not an ability.`}
        tag="declared · seeded"
        tagTone="info"
        items={model.declaredCapabilities}
      />
      <AggregateList
        title="Referenced Tools"
        subtitle="Offline descriptors owned by Platform. Referenced by a definition — not connected."
        tag="referenced · not connected"
        tagTone="neutral"
        items={model.referencedTools}
      />
      <AggregateList
        title="Declared Permissions"
        subtitle="Declared on definitions. Not granted — Governance applies, Decisions authorizes."
        tag="declared · not granted"
        tagTone="neutral"
        items={model.declaredPermissions}
      />

      {/* Authority ownership — Workforce declares; it owns nothing downstream. */}
      <Card>
        <CardHeader>
          <CardTitle>Who owns what</CardTitle>
          <span className="text-xs text-fg-muted">Workforce declares capability; it grants, connects, and executes nothing.</span>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {model.authorityOwnership.map((row) => (
            <div key={row.concept} className="flex flex-col gap-1 border-b py-2 last:border-0 sm:flex-row sm:items-center sm:gap-4">
              <span className="text-sm font-semibold text-fg sm:w-44 sm:shrink-0">{row.concept}</span>
              <Badge variant="primary" className="w-fit shrink-0">{row.owner}</Badge>
              <p className="min-w-0 flex-1 text-xs leading-5 text-fg-muted">{row.note}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
