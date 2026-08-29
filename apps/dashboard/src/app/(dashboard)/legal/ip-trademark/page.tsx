import { Copyright, Globe, FileBadge, KeyRound } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { LegacyDomainNotice } from "@/components/workforce-workspace/legacy-domain";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { ipSummary, ipAssets } from "@/features/legal/mock";
import type { IpAsset, IpStatus } from "@/types";

const statusVariant: Record<IpStatus, BadgeVariant> = {
  registered: "success",
  pending: "warning",
  expiring: "error",
  active: "info",
  filed: "primary",
  approved: "success",
};

const kindIcon: Record<IpAsset["kind"], React.ReactNode> = {
  trademark: <Copyright className="size-4" />,
  domain: <Globe className="size-4" />,
  patent: <FileBadge className="size-4" />,
  license: <KeyRound className="size-4" />,
};

export default function IpTrademarkPage() {
  const stats = [
    { label: "Registered Trademarks", value: `${ipSummary.registeredTrademarks}` },
    { label: "Pending Trademarks", value: `${ipSummary.pendingTrademarks}` },
    { label: "Active Domains", value: `${ipSummary.activeDomains}` },
    { label: "Expiring Domains", value: `${ipSummary.expiringDomains}` },
    { label: "License Coverage", value: `${ipSummary.licenseCoverage}%` },
    { label: "IP Risk Score", value: `${ipSummary.ipRiskScore}` },
  ];

  return (
    <>
      <PageHeader
        title="IP & Trademark Center"
        context="Intellectual assets managed by the IP & Trademark Agent."
      />

      <div className="mb-6">
        <LegacyDomainNotice domain="Legal" />
      </div>

      <div className="grid grid-cols-12 gap-6">
        {stats.map((s) => (
          <div key={s.label} className="col-span-6 sm:col-span-4 xl:col-span-2">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-fg-secondary">
                  {s.label}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{s.value}</p>
              </CardContent>
            </Card>
          </div>
        ))}

        {/* Asset registry */}
        <div className="col-span-12">
          <Card>
            <CardHeader>
              <CardTitle>Intellectual Asset Registry</CardTitle>
              <span className="text-xs text-fg-muted">preview</span>
            </CardHeader>
            <CardContent className="flex flex-col divide-y divide-border">
              {ipAssets.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-raised text-fg-secondary">
                      {kindIcon[a.kind]}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-fg">{a.name}</p>
                      <p className="text-xs text-fg-muted">
                        {a.kind} · {a.detail}
                      </p>
                    </div>
                  </div>
                  <Badge variant={statusVariant[a.status]}>{a.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
