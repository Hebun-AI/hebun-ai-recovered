/*
 * knowledge-graph-surface.tsx — read-only Knowledge Graph inspection (Hebun UI Phase 21C).
 *
 * Presents the honest state of the REAL canonical knowledge read layer plus the graph
 * semantics. It renders NO seeded graph nodes, NO fabricated relationship strength,
 * confidence %, graph health, coverage %, density, centrality, freshness, or counts,
 * and NO network visualisation. There are no create / update / delete controls — the
 * surface is inspection-only and asserts no causality as fact.
 *
 * Server component — no client state.
 */

import type { LucideIcon } from "lucide-react";
import {
  CircleDot,
  Clock,
  Fingerprint,
  GitBranch,
  Network,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { KnowledgeGraphReadModel } from "@/features/knowledge-graph-surface";

/* Graph vocabulary with the distinctions the architecture keeps explicit (§5). */
const SEMANTICS: ReadonlyArray<{ icon: LucideIcon; term: string; describes: string; distinction: string }> = [
  { icon: CircleDot, term: "Node", describes: "A thing the organization knows about.", distinction: "A node is not a fact." },
  { icon: ScrollText, term: "Fact", describes: "An asserted statement about nodes.", distinction: "A fact is not its evidence." },
  { icon: GitBranch, term: "Relationship", describes: "A typed link between two nodes.", distinction: "An edge is not causality." },
  { icon: ShieldCheck, term: "Evidence", describes: "A reference that supports a fact.", distinction: "Minted only at retrieval — never invented." },
  { icon: Fingerprint, term: "Provenance", describes: "How a fact or relationship was derived.", distinction: "Derived is not admitted memory." },
  { icon: Clock, term: "Lifecycle", describes: "Effective, superseded, or retired standing.", distinction: "Graph presence is not truth." },
];

interface ConnectionPresentation {
  readonly icon: LucideIcon;
  readonly badge: BadgeVariant;
  readonly badgeLabel: string;
  readonly title: string;
  readonly body: string;
}

function presentConnection(model: KnowledgeGraphReadModel): ConnectionPresentation {
  switch (model.connection) {
    case "not-connected":
      return {
        icon: ShieldOff,
        badge: "neutral",
        badgeLabel: "Not connected",
        title: "No canonical knowledge graph data is available",
        body:
          model.reason === "missing_database_url"
            ? "The canonical knowledge read layer (HEBUN_CANONICAL_READ_DATABASE_URL) is not configured, so no canonical relationships can be read. The legacy derived graph — seeded from registry mock data and hand-authored relationship weights — is no longer presented as organizational truth."
            : "The canonical knowledge read layer is not reachable, so no canonical relationships can be read. No seeded or derived graph is shown in its place.",
      };
    case "requires-authorized-context":
      return {
        icon: ShieldAlert,
        badge: "warning",
        badgeLabel: "Authorized context required",
        title: "Reading the knowledge graph requires an authorized organization context",
        body: "The canonical read layer is available, but relationships are read under an authorized organization context. None is available on this request, so nothing is read — the surface fails closed rather than listing relationships across organizations.",
      };
    case "connected-empty":
      return {
        icon: ShieldCheck,
        badge: "info",
        badgeLabel: "Connected",
        title: "No relationships to enumerate here",
        body: "The governed canonical read resolves knowledge facts by explicit identity; it does not dump a whole graph. Nothing is listed, and no relationship is fabricated to fill the space.",
      };
    case "read-failed":
      return {
        icon: ShieldAlert,
        badge: "error",
        badgeLabel: "Read failed",
        title: "The canonical knowledge graph could not be read",
        body: "The availability probe did not return a result. No graph is shown; no seeded graph is substituted.",
      };
  }
}

export function KnowledgeGraphSurface({ model }: { model: KnowledgeGraphReadModel }) {
  const connection = presentConnection(model);
  const ConnectionIcon = connection.icon;

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex items-center gap-2 text-sm text-fg-secondary">
        <Network className="size-4 text-primary" aria-hidden="true" />
        Read from the canonical knowledge layer — relationships and evidence, not a seeded network map.
      </div>

      {/* Honest connection / availability state */}
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-start">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-sunken">
            <ConnectionIcon className="size-4 text-fg-secondary" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-fg">{connection.title}</h2>
              <Badge variant={connection.badge}>{connection.badgeLabel}</Badge>
              <Badge variant="neutral">canonical · postgres</Badge>
            </div>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-fg-secondary">{connection.body}</p>
          </div>
        </CardContent>
      </Card>

      {/* Graph semantics — makes the empty surface intentional, keeps the distinctions explicit */}
      <Card>
        <CardHeader>
          <CardTitle>What the graph means</CardTitle>
          <span className="text-xs text-fg-muted">
            The organizational relationship model, with the distinctions it keeps explicit. Read-only.
          </span>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SEMANTICS.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.term} className="rounded-md border border-border bg-surface-sunken p-3">
                <div className="flex items-center gap-1.5">
                  <Icon className="size-3.5 text-fg-muted" aria-hidden="true" />
                  <p className="text-sm font-semibold text-fg">{item.term}</p>
                </div>
                <p className="mt-0.5 text-xs leading-5 text-fg-secondary">{item.describes}</p>
                <p className="mt-1 text-[0.7rem] font-medium uppercase tracking-wide text-fg-muted">
                  {item.distinction}
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <p className="flex items-center gap-2 text-xs text-fg-muted">
        <Network className="size-3.5" aria-hidden="true" />
        Knowledge Graph is read-only. It inspects relationships and evidence; it never creates nodes, edges, or evidence, and never asserts causality as fact.
      </p>
    </div>
  );
}
