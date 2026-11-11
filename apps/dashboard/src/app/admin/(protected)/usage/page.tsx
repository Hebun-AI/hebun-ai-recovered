import Link from "next/link";
import { requireAdminAccess } from "@/features/operator-authority/require-admin.server";
import { adminReadContext, settleAdminRead } from "@/features/admin-views/admin-view.server";
import {
  USAGE_TOP_ORGANIZATIONS,
  readPlatformAiUsage,
  type PlatformAiUsage,
  type UsageGroup,
} from "@/features/admin-views/platform-readers.server";
import {
  ADMIN_AUDIT_FAILED,
  ADMIN_UNAVAILABLE,
  AdminNotice,
  AdminPageHeader,
  DataTable,
  MetricCard,
  Panel,
  formatCount,
  formatDate,
} from "@/components/admin-views/admin-parts";

export const metadata = { title: "AI Usage — Platform Admin" };

/*
 * Recorded provider usage only: live calls on assistant messages and the token counts the provider
 * itself reported. No estimate, no cost (no billing source exists), no prompt or output text.
 */
export default async function AdminUsagePage() {
  await requireAdminAccess();
  const result = settleAdminRead(await readPlatformAiUsage(await adminReadContext()));

  return (
    <>
      <AdminPageHeader
        title="AI Usage"
        description="Recorded provider calls and provider-reported tokens. Costs are not shown: no billing source exists."
      />
      {result.status !== "read" ? (
        <AdminNotice
          tone={result.status === "audit-failed" ? "warning" : "neutral"}
          message={result.status === "audit-failed" ? ADMIN_AUDIT_FAILED : ADMIN_UNAVAILABLE}
        />
      ) : result.data.totals.recordedCalls === 0 ? (
        <AdminNotice message="No provider call has been recorded yet." />
      ) : (
        <UsageView {...result.data} />
      )}
    </>
  );
}

function UsageView({ totals, byProvider, byOrganization }: PlatformAiUsage) {
  const unmeasured = totals.recordedCalls - totals.measuredCalls;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Requests" value={formatCount(totals.recordedCalls)} note="Recorded live provider calls" />
        <MetricCard
          label="Tokens"
          value={formatCount(totals.inputTokens + totals.outputTokens)}
          note={`${formatCount(totals.inputTokens)} in · ${formatCount(totals.outputTokens)} out`}
        />
        <MetricCard
          label="Calls without token counts"
          value={formatCount(unmeasured)}
          note="Not counted as zero tokens"
        />
        <MetricCard
          label="Usage period"
          value={`${formatDate(totals.firstRecordedAt)} – ${formatDate(totals.lastRecordedAt)}`}
          note="All recorded history, UTC"
        />
      </div>
      <Panel title="By provider" description="Same period as above.">
        <UsageTable groups={byProvider} first="Provider" />
      </Panel>
      <Panel
        title="By organization"
        description={`The ${USAGE_TOP_ORGANIZATIONS} organizations with the most recorded calls. Same period as above.`}
      >
        <UsageTable groups={byOrganization} first="Organization" link />
      </Panel>
    </div>
  );
}

function UsageTable({ groups, first, link = false }: { groups: readonly UsageGroup[]; first: string; link?: boolean }) {
  return (
    <DataTable head={[first, "Requests", "Tokens", "Last call"]}>
      {groups.map((g) => (
        <tr key={g.key}>
          <td className="max-w-[16rem] truncate px-4 py-2.5 font-medium">
            {link ? (
              <Link href={`/admin/organizations/${g.key}`} className="hover:text-primary">{g.label}</Link>
            ) : (
              g.label
            )}
          </td>
          <td className="px-4 py-2.5 text-right tabular-nums">{formatCount(g.recordedCalls)}</td>
          <td className="px-4 py-2.5 text-right tabular-nums">
            {g.measuredCalls > 0 ? formatCount(g.inputTokens + g.outputTokens) : "Not reported"}
          </td>
          <td className="px-4 py-2.5 text-right tabular-nums text-fg-secondary">{formatDate(g.lastRecordedAt)}</td>
        </tr>
      ))}
    </DataTable>
  );
}
