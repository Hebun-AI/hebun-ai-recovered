import { Lock } from "lucide-react";
import type { KnowledgeWorkspaceModel } from "@/features/knowledge/workspace-model";
import { KnowledgeRegion } from "./knowledge-region";

/*
 * Classification & Access (Phase 9 §20) — governance is first-class in Knowledge.
 *
 * Shows the REAL sensitivity classification (MemorySensitivity). The governance
 * rule is explicit: restricted content is WITHHELD where required — not displayed
 * and merely tagged "restricted". Confidence is shown as a separate, ordinal
 * declared trust level (never authority, never truth).
 */

export function ClassificationAccess({ model }: { model: KnowledgeWorkspaceModel }) {
  return (
    <KnowledgeRegion variant="plain" eyebrow="Governance" title="Classification & Access">
      <div className="flex min-w-0 flex-col gap-4">
        <div>
          <p className="mb-2 text-meta uppercase tracking-wide text-fg-muted">Sensitivity — withheld where required</p>
          <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border bg-surface">
            {model.sensitivityLevels.map((level) => (
              <li key={level.sensitivity} className="flex items-center gap-2.5 p-3">
                {level.withheldWhereRequired ? (
                  <Lock className="size-3.5 shrink-0 text-fg-muted" aria-hidden="true" />
                ) : (
                  <span className="size-3.5 shrink-0" aria-hidden="true" />
                )}
                <span className="w-24 shrink-0 text-sm font-medium text-fg">{level.label}</span>
                <span className="min-w-0 flex-1 text-meta leading-5 text-fg-muted">{level.describes}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-meta leading-5 text-fg-muted">
            Restricted means withheld — the workspace does not show restricted content and label it. Access is
            enforced server-side by tenant, organization, and authority.
          </p>
        </div>

        <div>
          <p className="mb-2 text-meta uppercase tracking-wide text-fg-muted">Confidence — declared, not authority</p>
          <ol className="flex flex-wrap items-center gap-1.5">
            {model.confidenceLevels.map((level) => (
              <li
                key={level.level}
                className="inline-flex items-center rounded-md border border-border bg-surface px-2 py-1 text-xs text-fg-secondary"
              >
                {level.label}
              </li>
            ))}
          </ol>
          <p className="mt-2 text-meta uppercase tracking-wide text-fg-muted">Admitted under authority</p>
          <ol className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {model.authorityTypes.map((authority) => (
              <li
                key={authority.authority}
                className="inline-flex items-center rounded-md border border-border bg-surface px-2 py-1 text-xs text-fg-secondary"
              >
                {authority.label}
              </li>
            ))}
          </ol>
          <p className="mt-2 text-meta leading-5 text-fg-muted">
            Confidence is how strongly knowledge is trusted; authority is who admitted it. One never implies the
            other.
          </p>
        </div>
      </div>
    </KnowledgeRegion>
  );
}
