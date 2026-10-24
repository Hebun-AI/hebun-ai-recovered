/*
 * ORGANIZATION-READINESS-1 — "what does this organization still need before Hebun can work for it?"
 *
 * Renders rows already decided on the server by `readOrganizationReadiness`. Read-only: no control,
 * no action. A step only a platform operator can take is said plainly instead of being offered.
 */
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReadinessActor, ReadinessRow, ReadinessState } from "@/features/organization-readiness/organization-readiness";

const STATE_WORDING: Record<ReadinessState, string> = {
  ready: "Ready",
  "not-ready": "Not ready",
  unknown: "Unknown",
};

const ACTOR_WORDING: Record<ReadinessActor, string> = {
  you: "Next (you)",
  "governance-authority": "Next (Governance authority)",
  "platform-operator": "Next (platform operator)",
};

export function OrganizationReadinessCard({ rows }: { readonly rows: readonly ReadinessRow[] }) {
  return (
    /* `organization-readiness` is the anchor the Command overview's readiness line links to. */
    <Card id="organization-readiness" className="scroll-mt-20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck aria-hidden className="size-4" />
          Organization readiness
        </CardTitle>
        <CardDescription>
          What this organization has in place, read from the authority that owns each part. Read-only:
          nothing here changes anything.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.key} className="flex min-w-0 flex-col gap-1 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{row.label}</span>
                <span
                  className={
                    row.state === "ready"
                      ? "rounded px-1.5 py-0.5 text-xs font-medium ring-1 ring-border-strong"
                      : "rounded px-1.5 py-0.5 text-xs text-fg-muted ring-1 ring-border-subtle"
                  }
                >
                  {STATE_WORDING[row.state]}
                </span>
              </div>
              <p className="break-words text-fg-muted">{row.facts}</p>
              {row.next ? (
                <p className="text-xs text-fg-muted">
                  <span className="font-medium text-fg-secondary">{ACTOR_WORDING[row.next.actor]}: </span>
                  {row.next.text}
                  {row.next.href ? (
                    <>
                      {" "}
                      <Link href={row.next.href} className="underline underline-offset-2">
                        Open
                      </Link>
                    </>
                  ) : null}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
