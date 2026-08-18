import { WorkspaceRegion, WorkspaceEmptyState } from "./workspace-region";
import type { GovernanceActivityObservationResult } from "@/features/governance-activity/contracts";

/*
 * Governance Activity (R7.1) — the first region of this workspace backed by REAL durable evidence.
 *
 * Everything else on this page is the frozen Runtime vocabulary with honest empty states, because
 * no candidate instance exists. This region is different: it renders counts derived from
 * `audit_log`, the append-only ledger the seven governance-audit writers append to.
 *
 * ── WHAT THIS REGION CLAIMS, AND WHAT IT REFUSES TO ──────────────────────────
 *
 * It claims: "Hebun durably recorded these governance acts for this organization."
 *
 * It does NOT claim the organization is well governed, healthy, mature, efficient or at risk, and
 * it shows no score, percentage, confidence, grade or recommendation. A count is an observation;
 * a verdict is not R7.1. The copy below states that in the product, not only in a comment, because
 * a reader who sees "16" needs to know what it is a count OF.
 *
 * Read-only by construction: no button, no form, no action, nothing that mutates.
 */

/** Raw ledger keys are shown verbatim — R7.1 maps nothing to a friendly label or a category. */
function LedgerKey({ value }: { value: string }) {
  return (
    <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[0.7rem] text-fg">
      {value}
    </code>
  );
}

function TallyRow({ label, count }: { label: React.ReactNode; count: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border py-1.5 last:border-b-0">
      <div className="min-w-0 truncate">{label}</div>
      <span className="shrink-0 font-mono text-[0.75rem] tabular-nums text-fg">{count}</span>
    </div>
  );
}

function formatInstant(iso: string): string {
  /* Fixed locale + UTC: a server-rendered timestamp must not depend on ambient locale or zone. */
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(iso));
}

const UNAVAILABLE_COPY: Record<string, { title: string; detail: string }> = {
  "no-authorized-tenant-context": {
    title: "No authorized organization",
    detail:
      "Governance activity is scoped to one organization and read only for an authorized session. Sign in to an organization to see what Hebun has recorded for it.",
  },
  "persistence-not-configured": {
    title: "Durable records not reachable",
    detail:
      "Hebun cannot reach the durable governance record right now, so no count is shown. This says nothing about whether activity exists — an unreadable ledger is not an empty one.",
  },
  "read-failed": {
    title: "Governance record could not be read",
    detail:
      "The read did not complete, so no count is shown rather than a partial one. A partial count would read as a total.",
  },
};

export function GovernanceActivity({ result }: { result: GovernanceActivityObservationResult }) {
  if (result.status === "unavailable") {
    const copy = UNAVAILABLE_COPY[result.reason] ?? UNAVAILABLE_COPY["read-failed"];
    return (
      <WorkspaceRegion
        eyebrow="Recorded · derived"
        title="Governance activity"
      >
        <WorkspaceEmptyState title={copy.title} detail={copy.detail} tone="blocked" />
      </WorkspaceRegion>
    );
  }

  const { observation } = result;

  return (
    <WorkspaceRegion eyebrow="Recorded · derived" title="Governance activity">
      <div className="flex flex-col gap-4">
        <p className="text-[0.7rem] leading-5 text-fg-muted">
          These are governance acts Hebun <strong className="font-semibold text-fg">durably recorded</strong>{" "}
          for this organization, counted from the append-only governance record. The counts are{" "}
          <strong className="font-semibold text-fg">derived</strong> — recomputed on each read and stored
          nowhere. They describe recorded activity only. They are not a score, a grade, or a judgement
          about how this organization is governed.
        </p>

        {observation.totalRecordedActs === 0 ? (
          <WorkspaceEmptyState
            title="No recorded governance activity yet"
            detail="Hebun has no recorded governance activity for this organization. That means Hebun's record is empty — not that the organization has no governance and not that nothing happened."
            tone="calm"
          />
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
              <div>
                <p className="font-mono text-lg tabular-nums text-fg">{observation.totalRecordedActs}</p>
                <p className="text-[0.65rem] uppercase tracking-[0.12em] text-fg-muted">
                  Recorded acts
                </p>
              </div>
              {observation.latestOccurredAt && (
                <div>
                  <p className="font-mono text-[0.8rem] tabular-nums text-fg">
                    {formatInstant(observation.latestOccurredAt)} UTC
                  </p>
                  <p className="text-[0.65rem] uppercase tracking-[0.12em] text-fg-muted">
                    Most recent recorded act
                  </p>
                </div>
              )}
            </div>

            <div className="grid min-w-0 gap-x-6 gap-y-4 lg:grid-cols-2">
              <div className="min-w-0">
                <p className="mb-1 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-fg-muted">
                  By recorded action
                </p>
                <div className="text-[0.75rem]">
                  {observation.actions.map((tally) => (
                    <TallyRow
                      key={tally.action}
                      label={<LedgerKey value={tally.action} />}
                      count={tally.count}
                    />
                  ))}
                </div>
              </div>

              <div className="min-w-0 lg:border-l lg:border-border lg:pl-6">
                <p className="mb-1 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-fg-muted">
                  By recorded outcome
                </p>
                <div className="text-[0.75rem]">
                  {observation.results.map((tally) => (
                    <TallyRow
                      key={tally.result}
                      label={<LedgerKey value={tally.result} />}
                      count={tally.count}
                    />
                  ))}
                </div>
                <p className="mt-1.5 text-[0.65rem] leading-4 text-fg-muted">
                  A refused act is history, not a failure: it records that a governed rule declined a
                  change and nothing was written.
                </p>
              </div>

              <div className="min-w-0">
                <p className="mb-1 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-fg-muted">
                  By recorded authority source
                </p>
                <div className="text-[0.75rem]">
                  {observation.authoritySources.map((tally) => (
                    <TallyRow
                      key={
                        tally.authoritySource === null
                          ? "authority-source:none"
                          : `authority-source:${tally.authoritySource}`
                      }
                      label={
                        tally.authoritySource ? (
                          <LedgerKey value={tally.authoritySource} />
                        ) : (
                          <span className="text-fg-muted">Recorded without an authority source</span>
                        )
                      }
                      count={tally.count}
                    />
                  ))}
                </div>
              </div>

              <div className="min-w-0 lg:border-l lg:border-border lg:pl-6">
                <p className="mb-1 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-fg-muted">
                  Live versus simulated
                </p>
                <div className="text-[0.75rem]">
                  <TallyRow label="Recorded under a live posture" count={observation.simulation.nonSimulatedCount} />
                  <TallyRow label="Recorded as simulated" count={observation.simulation.simulatedCount} />
                </div>
                <p className="mt-1.5 text-[0.65rem] leading-4 text-fg-muted">
                  A simulated act was recorded under a non-live posture, so no real effect occurred.
                </p>
              </div>
            </div>
          </>
        )}

        <p className="text-[0.65rem] leading-4 text-fg-muted">
          Action, outcome and authority-source values are shown exactly as the governance record holds
          them. Hebun does not group them into categories or rate them, because that would assert a
          judgement no authority published.
        </p>
      </div>
    </WorkspaceRegion>
  );
}
