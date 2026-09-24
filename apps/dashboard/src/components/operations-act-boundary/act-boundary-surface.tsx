/*
 * act-boundary-surface.tsx — Band 2 of Operations: the act boundary.
 *
 * Renders the five words kept apart — prepared, authorized, executable, executed, successful —
 * each beside the released reader that answered it. Two of the five decline to answer and say so;
 * see the model's header for why answering them here would create a second count.
 *
 * SERVER COMPONENT. It resolves the tenant SERVER-SIDE, exactly as the Providers surface does, and
 * never accepts a tenant from a prop, a URL or a request body. With no authenticated context the
 * arming projection reads `not-established` and the composite blocks — an absence of context is
 * never rendered as a decision somebody made.
 *
 * READ-ONLY. No button, no form, no server action, no execution control.
 */

import { ArrowUpRight, ShieldAlert, SignalHigh } from "lucide-react";
import Link from "next/link";
import { readExternalSendOpsView } from "@/features/action-execution/execution-arming-projection.server";
import { readExecutionAttempts } from "@/features/action-execution/read-execution-attempts.server";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import {
  buildActBoundaryModel,
  type ActStageEvidence,
  type ActStageView,
} from "@/features/operations-act-boundary/model";

const EVIDENCE_META: Record<ActStageEvidence, { label: string; text: string; dot: string }> = {
  observed: { label: "Observed", text: "text-success", dot: "bg-success" },
  "not-surfaced-here": { label: "Owned elsewhere", text: "text-fg-muted", dot: "bg-fg-muted" },
  unavailable: { label: "Unavailable", text: "text-warning", dot: "bg-warning" },
};

/*
 * ONE STEP OF THE PIPELINE.
 *
 * It renders the stage, the one-or-two-word answer, and WHO answered — in organizational words. It
 * does NOT render the question, the caveat or the repository path; those are the same facts at a
 * lower level of the hierarchy and are disclosed together beneath the strip, where a reader who
 * wants them finds all five at once instead of five paragraphs they must read to scan the row.
 *
 * THE STRIP IS A PROJECTION, NOT A LIFECYCLE. Nothing here advances, transitions or causes a stage;
 * each cell is an independent answer from an independent owner, and two of the five decline to
 * answer and say so. The connector between them is a rule, not a state machine.
 */
function StageStep({ stage, blocked }: { stage: ActStageView; blocked: boolean }) {
  const meta = EVIDENCE_META[stage.evidence];
  /* The one cell that carries a refusal colours itself, and only when the arming actually blocks. */
  const emphatic = stage.stage === "executable" && blocked;
  return (
    <li className="flex min-w-0 flex-col gap-0.5">
      <span className="flex items-center gap-1.5">
        <span
          className={`size-2 shrink-0 rounded-full ${emphatic ? "bg-error" : meta.dot}`}
          aria-hidden="true"
        />
        <span className="truncate text-[0.6rem] font-semibold uppercase tracking-wider text-fg-muted">
          {stage.label}
        </span>
      </span>
      <span
        className={`truncate text-base font-semibold leading-6 ${emphatic ? "text-error" : "text-fg"}`}
      >
        {stage.short}
      </span>
      <span className="truncate text-[0.65rem] leading-4 text-fg-muted">{stage.owner}</span>
    </li>
  );
}

export async function ActBoundarySurface() {
  /* Server-side, from the session. Never a prop, never a query parameter. */
  const tenant = await resolveTenantContext();
  const [arming, attempts] = await Promise.all([
    readExternalSendOpsView({ tenantId: tenant?.tenantId ?? null }),
    readExecutionAttempts(tenant),
  ]);
  const model = buildActBoundaryModel({ arming, attempts });
  const tally = model.attempts;
  const blocked = model.blockers.length > 0;

  return (
    <section className="mt-6 flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
          <SignalHigh className="size-4 text-primary" aria-hidden="true" />
          The act boundary
        </h2>
        <p className="text-[0.7rem] text-fg-muted">
          Prepared ≠ authorized ≠ executable ≠ executed ≠ successful.
        </p>
      </div>

      {/*
        THE PIPELINE STRIP. Five independent answers, side by side, read in the order work passes
        through them. The rule behind them is a visual separator and nothing more: no stage here
        causes, advances or implies the next, and the two that another authority owns still say so
        in their own cell.
      */}
      <ul className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-3 rounded-lg border border-border-subtle bg-surface-sunken px-3 py-3 sm:grid-cols-3 lg:grid-cols-5 lg:divide-x lg:divide-border-subtle">
        {model.stages.map((stage) => (
          <StageStep key={stage.stage} stage={stage} blocked={blocked} />
        ))}
      </ul>

      <div className="grid min-w-0 grid-cols-1 items-start gap-3 lg:grid-cols-2">
        {/*
          THE BLOCKER PANEL. Shown only when the arming projection actually blocks, and it names
          EVERY missing half at once — a Director told only the first fixes it, reloads, and is told
          the next. The wording is the projection's own; nothing is summarized away, and
          `not-established` is still never worded as a refusal somebody made.
        */}
        {blocked && (
          <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-error/40 bg-error/5 p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-error">
                <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
                Action blocked
              </h3>
              <span className="text-[0.7rem] tabular-nums text-fg-secondary">
                {model.blockers.length} unresolved
              </span>
            </div>
            <ul className="flex flex-col gap-1">
              {model.blockers.map((blocker) => (
                <li key={blocker} className="text-xs leading-5 text-fg-secondary">
                  • {blocker}
                </li>
              ))}
            </ul>
            <Link
              href="/director/provider-matrix"
              className="inline-flex w-fit items-center gap-0.5 text-xs font-medium text-primary hover:text-primary-hover"
            >
              Open Providers
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        )}

        {/*
          THE LEDGER. Five counters, this organization's own rows and never another tenant's. An
          unreadable ledger renders no counter at all — a zero would be a claim nobody established.
        */}
        <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-border-subtle bg-surface-sunken p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="text-sm font-semibold text-fg">Execution ledger</h3>
            <span className="text-[0.7rem] text-fg-muted">This organization&apos;s own rows.</span>
          </div>
          {tally ? (
            <dl className="grid grid-cols-3 gap-x-3 gap-y-2 sm:grid-cols-5">
              {[
                { label: "Attempts", value: tally.total },
                { label: "Accepted", value: tally.accepted },
                { label: "Refused", value: tally.refused },
                { label: "Failed", value: tally.failed },
                { label: "Needs a human", value: tally.unreconciled },
              ].map((stat) => (
                <div key={stat.label} className="min-w-0">
                  <dt className="truncate text-[0.6rem] font-medium uppercase tracking-wide text-fg-muted">
                    {stat.label}
                  </dt>
                  <dd className="text-lg font-semibold tabular-nums leading-6 text-fg">
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-xs leading-5 text-fg-secondary">
              The execution ledger could not be read ({model.attemptsUnavailableReason}). No count
              is shown, because an unreadable ledger is not an empty one.
            </p>
          )}
        </div>
      </div>

      {/*
        LEVEL 3. What each stage means, what its answer must not be mistaken for, and which released
        reader produced it. Every word that used to sit on the face of the band is still here — the
        five questions, the five caveats, the five provenance strings and the three standing notes —
        one disclosure below the answers they explain.
      */}
      <details className="min-w-0">
        <summary className="cursor-pointer select-none text-[0.7rem] text-fg-muted">
          What each stage means, and which authority answered
        </summary>
        <div className="flex flex-col gap-2 pt-2">
          <dl className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {model.stages.map((stage) => (
              <div
                key={stage.stage}
                className="min-w-0 rounded-md border border-border-subtle bg-surface-sunken p-2.5"
              >
                <dt className="flex items-baseline justify-between gap-2">
                  <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-fg-secondary">
                    {stage.label}
                  </span>
                  <span
                    className={`shrink-0 text-[0.6rem] font-medium uppercase tracking-wide ${EVIDENCE_META[stage.evidence].text}`}
                  >
                    {EVIDENCE_META[stage.evidence].label}
                  </span>
                </dt>
                <dd className="mt-1 space-y-1">
                  <p className="text-[0.7rem] leading-4 text-fg-secondary">{stage.question}</p>
                  <p className="text-[0.7rem] leading-4 text-fg">{stage.value}</p>
                  {stage.caveat && (
                    <p className="text-[0.65rem] leading-4 text-fg-muted">{stage.caveat}</p>
                  )}
                  <p className="break-words text-[0.6rem] leading-4 text-fg-muted">
                    {stage.provenance}
                  </p>
                </dd>
              </div>
            ))}
          </dl>
          <ul className="flex flex-col gap-1">
            {model.notes.map((note) => (
              <li key={note} className="text-[0.65rem] leading-4 text-fg-muted">
                {note}
              </li>
            ))}
          </ul>
        </div>
      </details>
    </section>
  );
}
