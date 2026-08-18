/*
 * Recorded provider usage card (R2F.1) — Platform → Providers & Models.
 *
 * A READ-ONLY presentation of `readRecordedProviderUsage`. It holds no state, calls no action,
 * and offers no control: there is nothing here to turn on, no budget to set, and no limit to
 * raise, because R2F.1 ships none of those.
 *
 * ── WHAT IT IS CAREFUL NOT TO SAY ────────────────────────────────────────────
 *
 * No currency, no price, no cost, no budget, no quota, no percentage-of-anything. Hebun holds
 * no pricing for any model, so a money figure here could only be invented. Every label says
 * RECORDED, and the footer states the two ways the number is a floor rather than a fact — a
 * provider call whose local record never landed is invisible to this surface, and a call the
 * provider did not fully report is counted apart instead of summed as zero.
 *
 * A server component on purpose: the numbers are derived server-side from durable rows, so
 * there is no reason for any of this to reach the client as behaviour.
 */
import { Gauge } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  hasNoRecordedUsage,
  type RecordedProviderUsageRead,
} from "@/features/heby-provider-ops/usage-contracts";

/**
 * How many recent UTC days the card shows. The aggregation seam returns every day it found;
 * truncation happens HERE and is stated in the caption, so a reader is never shown a window
 * silently trimmed to look complete.
 */
const RECENT_DAYS_SHOWN = 7;

function n(value: number): string {
  return value.toLocaleString("en-US");
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface-raised/40 p-3">
      <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-fg-muted">
        {label}
      </span>
      <span className="text-lg font-semibold tabular-nums text-fg">{value}</span>
      {hint ? <span className="text-[0.7rem] leading-4 text-fg-muted">{hint}</span> : null}
    </div>
  );
}

export function RecordedUsageCard({ read }: { read: RecordedProviderUsageRead }) {
  if (read.status === "unavailable") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Gauge className="size-4 text-primary" aria-hidden="true" />
            Recorded provider usage
          </CardTitle>
          <CardDescription>
            {read.reason === "persistence-not-configured"
              ? "Durable storage is not configured, so no provider usage has ever been recorded to read."
              : "Recorded provider usage could not be read. Nothing was substituted for it."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-fg-muted">Reason: {read.reason}.</p>
        </CardContent>
      </Card>
    );
  }

  const { totals, byModel, byDay } = read.usage;
  const recentDays = byDay.slice(0, RECENT_DAYS_SHOWN);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Gauge className="size-4 text-primary" aria-hidden="true" />
          Recorded provider usage
        </CardTitle>
        <CardDescription>
          Provider-reported token counts this organization has durably recorded. Not a bill, not a
          charge, and not an account balance.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {hasNoRecordedUsage(read.usage) ? (
          <p className="text-xs leading-5 text-fg-secondary">
            No provider usage has been recorded for this organization. That is the real state, not
            a read failure — no model request from here has been durably recorded, so there is
            nothing to total.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <Metric label="Recorded calls" value={n(totals.recordedCalls)} />
              <Metric label="Recorded input tokens" value={n(totals.inputTokens)} />
              <Metric label="Recorded output tokens" value={n(totals.outputTokens)} />
              <Metric
                label="Recorded tokens"
                value={n(totals.totalTokens)}
                hint="Lower bound — see below."
              />
            </div>

            <Metric
              label="Calls the provider did not fully report"
              value={n(totals.unknownTokenRows)}
              hint={
                totals.unknownTokenRows === 0
                  ? "Every recorded call carries both an input and an output count."
                  : "Counted here and deliberately left out of the token sums — an unreported count is not a zero."
              }
            />

            <div className="flex min-w-0 flex-col gap-2">
              <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-fg-muted">
                By model ({byModel.length})
              </span>
              <ul className="flex flex-col gap-1">
                {byModel.map((group) => (
                  <li
                    key={group.key}
                    className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-lg border border-border bg-surface-raised/40 px-3 py-2"
                  >
                    <span className="min-w-0 break-words text-xs font-medium text-fg">
                      {group.key}
                    </span>
                    <span className="text-xs tabular-nums text-fg-secondary">
                      {n(group.recordedCalls)} call{group.recordedCalls === 1 ? "" : "s"} ·{" "}
                      {n(group.totalTokens)} recorded token{group.totalTokens === 1 ? "" : "s"}
                      {group.unknownTokenRows > 0
                        ? ` · ${n(group.unknownTokenRows)} not fully reported`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {recentDays.length > 0 ? (
              <div className="flex min-w-0 flex-col gap-2">
                <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-fg-muted">
                  {recentDays.length === byDay.length
                    ? `By day (${byDay.length}, UTC)`
                    : `By day — ${recentDays.length} most recent of ${byDay.length} (UTC)`}
                </span>
                <ul className="flex flex-col gap-1">
                  {recentDays.map((group) => (
                    <li
                      key={group.key}
                      className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-lg border border-border bg-surface-raised/40 px-3 py-2"
                    >
                      <span className="text-xs font-medium tabular-nums text-fg">{group.key}</span>
                      <span className="text-xs tabular-nums text-fg-secondary">
                        {n(group.recordedCalls)} call{group.recordedCalls === 1 ? "" : "s"} ·{" "}
                        {n(group.totalTokens)} recorded token{group.totalTokens === 1 ? "" : "s"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </CardContent>

      <CardFooter className="flex flex-col items-start gap-1 text-[0.7rem] leading-4 text-fg-muted">
        <p>
          These totals are a lower bound. A provider request that succeeded while its local record
          failed to persist consumed real resources and left no row, and nothing here can recover
          it.
        </p>
        <p>
          Hebun holds no pricing for any model, so no monetary cost is shown or derivable from
          these numbers. No budget or limit is attached to them.
        </p>
      </CardFooter>
    </Card>
  );
}
