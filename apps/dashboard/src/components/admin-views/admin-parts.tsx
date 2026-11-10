import { cn } from "@/lib/utils";

/*
 * Platform Admin presentation parts. No data is read here; every value comes from an audited admin
 * reader. A value that could not be read is shown as unavailable — never as zero.
 */

export const ADMIN_UNAVAILABLE = "This information is currently unavailable.";
export const ADMIN_AUDIT_FAILED =
  "This view could not be recorded in the audit log, so it is not shown. Try again shortly.";

const numberFormat = new Intl.NumberFormat("en-US");
export const formatCount = (n: number) => numberFormat.format(n);

/** UTC calendar date, or a dash for a missing instant. */
export const formatDate = (iso: string | null) => (iso ? iso.slice(0, 10) : "—");
export const formatDateTime = (iso: string | null) =>
  iso ? `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC` : "—";

export function AdminPageHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6 space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
      <p className="text-sm text-fg-secondary">{description}</p>
    </div>
  );
}

export function MetricCard({
  label,
  value,
  note,
  muted = false,
}: {
  label: string;
  value: string;
  note?: string;
  muted?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-surface p-4">
      <p className="text-meta font-medium text-fg-muted">{label}</p>
      <p className={cn("mt-1 truncate text-2xl font-semibold tabular-nums", muted ? "text-base text-fg-muted" : "text-fg")}>
        {value}
      </p>
      {note ? <p className="mt-1 text-meta text-fg-muted">{note}</p> : null}
    </div>
  );
}

export function AdminNotice({ message, tone = "neutral" }: { message: string; tone?: "neutral" | "warning" }) {
  return (
    <div
      role="status"
      className={cn(
        "rounded-xl border p-4 text-sm",
        tone === "warning"
          ? "border-warning/40 bg-warning/10 text-fg"
          : "border-dashed border-border-strong bg-surface-sunken text-fg-secondary",
      )}
    >
      {message}
    </div>
  );
}

export function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
        {description ? <p className="mt-0.5 text-meta text-fg-muted">{description}</p> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

/** A table that scrolls inside its own box on narrow screens; the page never scrolls sideways. */
export function DataTable({ head, children }: { head: readonly string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-meta text-fg-muted">
            {head.map((h, i) => (
              <th key={h} scope="col" className={cn("px-4 py-2 font-medium", i > 0 && "text-right")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

export function StatusPill({ status }: { status: string | null }) {
  const tone =
    status === "active"
      ? "bg-success/15 text-success"
      : status === "suspended" || status === "deleting" || status === "deleted"
        ? "bg-warning/15 text-warning"
        : "bg-surface-sunken text-fg-muted";
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-meta font-medium", tone)}>
      {status ?? "not recorded"}
    </span>
  );
}
