/*
 * registries-directory.tsx — the honest Registries reference directory (Hebun UI Phase 21C).
 *
 * Presents the organizational registries as a read-only ownership/authority directory:
 * which registries exist, who owns their authority, and their honest connection state.
 * It renders NO fabricated record count, daily growth, health %, synchronization %,
 * coverage %, freshness timestamp, or sample record, and NO create / edit / delete
 * controls. Knowledge is a reference map here — not a second authority. Mock-backed
 * legacy detail is labelled, not presented as authoritative.
 *
 * Server component — no client state.
 */

import { Layers, ShieldOff } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  REGISTRY_DIRECTORY,
  type RegistryConnection,
  type RegistryDescriptor,
  type RegistryDetailStatus,
  type RegistryPersistence,
} from "@/features/registry-directory";

const persistenceLabel: Record<RegistryPersistence, { label: string; variant: BadgeVariant }> = {
  "mock-static": { label: "Simulated", variant: "warning" },
  "in-memory-engine": { label: "In-memory", variant: "info" },
  "canonical-postgres": { label: "Canonical", variant: "success" },
  none: { label: "None", variant: "neutral" },
};

const connectionLabel: Record<RegistryConnection, { label: string; variant: BadgeVariant }> = {
  "reference-not-connected": { label: "Reference · not connected", variant: "neutral" },
  connected: { label: "Connected", variant: "success" },
  "not-available": { label: "Not available", variant: "neutral" },
};

const detailLabel: Record<RegistryDetailStatus, { label: string; variant: BadgeVariant }> = {
  "mock-backed-legacy": { label: "Legacy · simulated", variant: "warning" },
  "no-detail": { label: "No detail", variant: "neutral" },
  authoritative: { label: "Authoritative", variant: "success" },
};

function DirectoryRow({ registry }: { registry: RegistryDescriptor }) {
  const persistence = persistenceLabel[registry.persistence];
  const connection = connectionLabel[registry.connection];
  const detail = detailLabel[registry.detailStatus];

  return (
    <tr className="border-b border-border/60 align-top last:border-0">
      <td className="px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-fg">{registry.title}</span>
          <span className="text-xs text-fg-muted">{registry.entityType}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-fg">{registry.authoritativeOwner}</span>
          <span className="text-xs text-fg-muted">{registry.ownerSubsystem}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <Badge variant={persistence.variant}>{persistence.label}</Badge>
      </td>
      <td className="px-4 py-3">
        <Badge variant={connection.variant}>{connection.label}</Badge>
      </td>
      <td className="px-4 py-3 text-sm text-fg-secondary">{registry.mutationOwner}</td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <Badge variant={detail.variant}>{detail.label}</Badge>
          {registry.route && (
            <span className="font-mono text-[0.7rem] text-fg-muted">{registry.route}</span>
          )}
        </div>
      </td>
    </tr>
  );
}

export function RegistriesDirectory() {
  const withNotes = REGISTRY_DIRECTORY.filter((registry) => registry.note);

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {/* Honest framing — a directory, not a metrics catalogue */}
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-start">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-sunken">
            <Layers className="size-4 text-fg-secondary" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-fg">Organizational registry directory</h2>
              <Badge variant="neutral">{REGISTRY_DIRECTORY.length} registries</Badge>
            </div>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-fg-secondary">
              A read-only reference map of the organizational registries and who owns their authority.
              Knowledge is a directory here, not a second authority. Record counts, growth, health, and
              freshness are not surfaced — no authoritative feed is connected, and no value is fabricated.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registries</CardTitle>
          <span className="text-xs text-fg-muted">
            Structural facts only. Detail surfaces marked “legacy · simulated” are not authoritative.
          </span>
        </CardHeader>
        <CardContent>
          <div className="ui-table-wrap">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-fg-muted">
                  <th className="px-4 py-3 font-medium">Registry</th>
                  <th className="px-4 py-3 font-medium">Authoritative owner</th>
                  <th className="px-4 py-3 font-medium">Persistence</th>
                  <th className="px-4 py-3 font-medium">Connection</th>
                  <th className="px-4 py-3 font-medium">Mutation owner</th>
                  <th className="px-4 py-3 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {REGISTRY_DIRECTORY.map((registry) => (
                  <DirectoryRow key={registry.id} registry={registry} />
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {withNotes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Where authority actually lives</CardTitle>
            <span className="text-xs text-fg-muted">
              Registries whose management is owned by another workspace.
            </span>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {withNotes.map((registry) => (
              <div key={registry.id} className="rounded-md border border-border bg-surface-sunken p-3">
                <p className="text-sm font-semibold text-fg">{registry.title}</p>
                <p className="mt-0.5 text-xs leading-5 text-fg-muted">{registry.note}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <p className="flex items-center gap-2 text-xs text-fg-muted">
        <ShieldOff className="size-3.5" aria-hidden="true" />
        Registries is read-only in Knowledge. It never creates, edits, or deletes registry records, and it
        is not a second authority for goals, policies, agents, or any other entity.
      </p>
    </div>
  );
}
