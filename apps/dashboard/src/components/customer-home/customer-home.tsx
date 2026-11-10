import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleDashed,
  History,
  Info,
  ListChecks,
  ShieldCheck,
  Sparkles,
  SquarePen,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CUSTOMER_NAV } from "@/config/customer-nav";
import type {
  WaitingOnYouState,
  WorkInMotionState,
} from "@/features/command-overview/workspace-model";
import type { LiveMapAwareness } from "@/features/live-map/awareness";
import type { SecurityRecordedActObservation } from "@/features/security-center/contracts";

/*
 * P3 Customer Dashboard — presentation only. Every number on this page is read from a released,
 * tenant-scoped seam by the route; a source that could not be read says so and is never shown as
 * zero. No metric, task, agent or activity is invented here.
 */

export interface CustomerHomeProps {
  name: string | null;
  organization: LiveMapAwareness;
  waiting: WaitingOnYouState;
  work: WorkInMotionState;
  activity: SecurityRecordedActObservation;
  evaluatedAt: string;
}

const SHOWN = 4;

/*
 * What a customer reads when a source could not be read. The reader's own reason (codes such as
 * `no-authorized-tenant-context`, service sentences) is internal: it stays in the read result the
 * route receives and is not rendered. One sentence for every panel, because the page cannot tell an
 * access problem from an outage without guessing.
 */
export const UNAVAILABLE_MESSAGE = "This information is currently unavailable.";

/** Rows a customer reaches in one step. Each is a route with a runtime behind it. */
export const QUICK_ACTIONS: readonly { label: string; detail: string; href: string; icon: LucideIcon }[] = [
  { label: "Ask Heby", detail: "Plan, prepare and ask", href: "/heby", icon: Sparkles },
  { label: "AI Agents", detail: "Your recorded agents", href: "/agents", icon: Bot },
  { label: "Content Studio", detail: "Drafts, media, packages", href: "/operations", icon: SquarePen },
  { label: "Approvals", detail: "Decisions waiting on you", href: "/approvals", icon: ShieldCheck },
];

/** One honest line per module in the workspace overview. */
const MODULE_DETAIL: Readonly<Record<string, string>> = {
  "/heby": "Your assistant, grounded in your organization",
  "/agents": "Identity, status and mandate of each agent",
  "/operations": "Content preparation, media and publication",
  "/intelligence/social": "What connected platforms reported",
  "/live-map": "Your organization as Hebun can vouch for it",
  "/approvals": "Requests that need a human decision",
  "/director/governance/security": "Recorded governed acts and security evidence",
  "/integrations": "Connected services and what they enable",
  "/account": "Profile, plan and preferences",
};

/** A short, honest elapsed label. `null` for an unusable or future instant. */
function since(instant: string, evaluatedAt: string): string | null {
  const ms = Date.parse(evaluatedAt) - Date.parse(instant);
  if (!Number.isFinite(ms) || ms < 0) return null;
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 30 ? `${days}d ago` : new Date(instant).toISOString().slice(0, 10);
}

function Panel({
  title,
  icon: Icon,
  href,
  hrefLabel,
  children,
}: {
  title: string;
  icon: LucideIcon;
  href: string;
  hrefLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="flex min-w-0 flex-col rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
          <Icon aria-hidden="true" className="size-4 text-fg-muted" />
          {title}
        </h2>
        <Link
          href={href}
          className="-mr-2 inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm font-medium text-primary hover:bg-primary-subtle focus-visible:outline-2 focus-visible:outline-primary-ring"
        >
          {hrefLabel}
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </Link>
      </header>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  );
}

/** Empty and unreadable are different statements; both are said plainly. */
function Quiet({ tone, title, detail }: { tone: "empty" | "unavailable"; title: string; detail?: string | null }) {
  const Icon = tone === "empty" ? CheckCircle2 : CircleDashed;
  return (
    <div className="flex items-start gap-3 rounded-xl bg-surface-sunken px-4 py-3.5">
      <Icon aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", tone === "empty" ? "text-success" : "text-fg-muted")} />
      <div className="min-w-0">
        <p className="text-sm font-medium text-fg">{title}</p>
        {detail ? <p className="mt-0.5 text-meta text-fg-muted text-pretty">{detail}</p> : null}
      </div>
    </div>
  );
}

function Row({ title, meta, dot }: { title: string; meta: string; dot: "warning" | "primary" | "muted" }) {
  return (
    <li className="flex min-w-0 items-center gap-3 py-2.5">
      <span
        aria-hidden="true"
        className={cn("size-2 shrink-0 rounded-full", dot === "warning" ? "bg-warning" : dot === "primary" ? "bg-primary" : "bg-border-control")}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-fg">{title}</span>
        <span className="block truncate text-meta text-fg-muted">{meta}</span>
      </span>
    </li>
  );
}

export function waitingCount(waiting: WaitingOnYouState): string | null {
  if (waiting.status === "none-waiting") return "0";
  if (waiting.status !== "waiting") return null;
  if (waiting.awaitingCount !== null) return String(waiting.awaitingCount);
  return `${waiting.items.length}${waiting.boundReached ? "+" : ""}`;
}

export function workCount(work: WorkInMotionState): string | null {
  if (work.status === "empty") return "0";
  if (work.status !== "recorded") return null;
  return `${work.inServiceShown}${work.truncated ? "+" : ""}`;
}

export function agentCount(organization: LiveMapAwareness): string | null {
  if (organization.agents.status === "known-empty") return "0";
  return organization.agents.status === "counted" ? String(organization.agents.count) : null;
}

export interface WorkspaceStat {
  readonly label: string;
  readonly value: string;
  readonly href: string;
}

/**
 * The status row: only counts that were actually read. An unreadable source is left out — never
 * shown as zero, never as its own error card — and named in `unavailable` so the page can say, once,
 * that some information is missing.
 */
export function workspaceStatus(input: {
  waiting: WaitingOnYouState;
  work: WorkInMotionState;
  organization: LiveMapAwareness;
}): { stats: readonly WorkspaceStat[]; unavailable: readonly string[] } {
  const all = [
    { label: "Decisions waiting", value: waitingCount(input.waiting), href: "/approvals" },
    { label: "Work in progress", value: workCount(input.work), href: "/operations" },
    { label: "AI agents", value: agentCount(input.organization), href: "/agents" },
  ];
  return {
    stats: all.flatMap((s) => (s.value === null ? [] : [{ ...s, value: s.value }])),
    unavailable: all.filter((s) => s.value === null).map((s) => s.label),
  };
}

function Stat({ value, label, href }: WorkspaceStat) {
  return (
    <Link
      href={href}
      className="flex min-w-0 flex-col gap-1 rounded-2xl border border-border bg-surface px-3 py-3 transition-colors duration-(--dur-fast) hover:border-border-strong hover:bg-fg/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring sm:px-5 sm:py-4"
    >
      <span className="line-clamp-2 text-meta font-medium text-fg-muted">{label}</span>
      <span className="text-title font-semibold leading-none tabular-nums text-fg sm:text-display">{value}</span>
    </Link>
  );
}

export function CustomerHome({ name, organization, waiting, work, activity, evaluatedAt }: CustomerHomeProps) {
  const orgName = organization.organization.status === "named" ? organization.organization.name : null;
  const modules = CUSTOMER_NAV.flatMap((group) => group.items).filter((item) => item.href !== "/home");
  const status = workspaceStatus({ waiting, work, organization });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 lg:gap-8">
      {/* ── 1. Welcome ─────────────────────────────────────────────── */}
      <header className="min-w-0">
        <h1 className="text-display font-semibold tracking-tight text-fg text-balance">
          {name ? `Welcome back, ${name}` : "Welcome to Hebun"}
        </h1>
        <p className="mt-1 text-sm text-fg-secondary">
          {orgName ? `Here is where ${orgName} stands today.` : "Here is where your workspace stands today."}
        </p>
      </header>

      {/* ── 2. Heby — the primary action. A doorway to /heby, not a composer. ── */}
      <section
        aria-labelledby="home-heby"
        className="relative overflow-hidden rounded-2xl border border-primary/25 bg-primary-subtle p-5 sm:p-6"
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-(image:--gradient-ambient)" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-(image:--gradient-primary) text-on-primary shadow-sm">
            <Sparkles aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="home-heby" className="text-title font-semibold text-fg">Heby</h2>
            <p className="mt-0.5 text-sm text-fg-secondary text-pretty">
              Plan work, prepare content or understand what is happening in your organization. Heby proposes, you decide.
            </p>
          </div>
          <Link
            href="/heby"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-on-primary shadow-xs transition-colors duration-(--dur-fast) hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
          >
            Open Heby
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </section>

      {/* ── 3. Workspace status — read counts only, or one plain notice ── */}
      <section aria-label="Workspace status" className="flex flex-col gap-2">
        {status.stats.length > 0 ? (
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {status.stats.map((stat) => (
              <Stat key={stat.href} {...stat} />
            ))}
          </div>
        ) : null}
        {status.unavailable.length > 0 ? (
          <p className="flex items-center gap-2 rounded-xl bg-surface-sunken px-4 py-3 text-sm text-fg-secondary">
            <Info aria-hidden="true" className="size-4 shrink-0 text-fg-muted" />
            {status.stats.length === 0
              ? "Workspace information is unavailable in this session."
              : "Some workspace information is unavailable in this session."}
          </p>
        ) : null}
      </section>

      {/* ── 4. Quick actions ───────────────────────────────────────── */}
      <nav aria-label="Quick actions" className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {QUICK_ACTIONS.map(({ label, detail, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex min-h-14 min-w-0 items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 transition-colors duration-(--dur-fast) hover:border-border-strong hover:bg-fg/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring sm:px-4"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-primary">
              <Icon aria-hidden="true" className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold leading-tight text-fg">{label}</span>
              <span className="hidden truncate text-meta text-fg-muted sm:block">{detail}</span>
            </span>
          </Link>
        ))}
      </nav>

      {/* ── 5. Activity & tasks ────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Panel title="Pending approvals" icon={ShieldCheck} href="/approvals" hrefLabel="All approvals">
          {waiting.status === "unavailable" ? (
            <Quiet tone="unavailable" title={UNAVAILABLE_MESSAGE} />
          ) : waiting.status === "none-waiting" ? (
            <Quiet tone="empty" title="Nothing is waiting on you" />
          ) : (
            <ul className="divide-y divide-border">
              {waiting.items.slice(0, SHOWN).map((item) => (
                <Row
                  key={item.requestId}
                  dot="warning"
                  title={item.actionKind}
                  meta={[item.targetLabel, item.waitingFor ? `waiting ${item.waitingFor.label}` : null].filter(Boolean).join(" · ") || item.expectedEffect}
                />
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Active work" icon={ListChecks} href="/operations" hrefLabel="Content Studio">
          {work.status === "unavailable" ? (
            <Quiet tone="unavailable" title={UNAVAILABLE_MESSAGE} />
          ) : work.status === "empty" ? (
            <Quiet tone="empty" title="No work recorded yet" detail="Work your organization records appears here." />
          ) : work.items.length === 0 ? (
            <Quiet tone="empty" title="No work in progress" detail={`${work.retiredShown} retired item(s) are not shown.`} />
          ) : (
            <ul className="divide-y divide-border">
              {work.items.slice(0, SHOWN).map((item) => (
                <Row
                  key={item.workItemId}
                  dot="primary"
                  title={item.title}
                  meta={[item.declaredState, item.departmentName].filter(Boolean).join(" · ")}
                />
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="AI agents" icon={Bot} href="/agents" hrefLabel="View agents">
          {organization.agents.status === "unavailable" ? (
            <Quiet tone="unavailable" title={UNAVAILABLE_MESSAGE} />
          ) : organization.agents.status === "known-empty" ? (
            <Quiet tone="empty" title="No agents recorded yet" detail="Agents your organization records appear here." />
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-fg-secondary">
                <span className="text-title font-semibold tabular-nums text-fg">{organization.agents.count}</span>{" "}
                {organization.agents.count === 1 ? "agent" : "agents"} recorded for {orgName ?? "your organization"}.
              </p>
              {organization.intelligence.status === "available" ? (
                <p className="text-meta text-fg-muted">
                  {organization.intelligence.unresolvedAgentProposals === 0
                    ? "No agent proposals are waiting for a decision."
                    : `${organization.intelligence.unresolvedAgentProposals} agent proposal(s) waiting for a decision.`}
                </p>
              ) : null}
            </div>
          )}
        </Panel>

        <Panel title="Recent activity" icon={History} href="/director/governance/security" hrefLabel="Full record">
          {activity.state === "unavailable" ? (
            <Quiet tone="unavailable" title={UNAVAILABLE_MESSAGE} />
          ) : activity.state === "known-empty" ? (
            <Quiet tone="empty" title="No recorded activity yet" detail="Governed actions in your organization appear here." />
          ) : (
            <ul className="divide-y divide-border">
              {activity.acts.slice(0, SHOWN).map((act, i) => (
                <Row
                  key={`${act.occurredAt}-${i}`}
                  dot="muted"
                  title={act.action}
                  meta={[act.entityType, act.result, since(act.occurredAt, evaluatedAt)].filter(Boolean).join(" · ")}
                />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* ── E. Workspace overview ──────────────────────────────────── */}
      <section aria-labelledby="home-modules">
        <h2 id="home-modules" className="mb-3 text-sm font-semibold text-fg">Your workspace</h2>
        <ul className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map(({ label, href, icon: Icon }) => (
            <li key={href} className="border-b border-border">
              <Link
                href={href}
                className="group flex min-h-14 items-center gap-3 rounded-lg px-1 py-2 focus-visible:outline-2 focus-visible:outline-primary-ring"
              >
                <Icon aria-hidden="true" className="size-4.5 shrink-0 text-fg-muted group-hover:text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-fg group-hover:text-primary">
                    {label}
                  </span>
                  <span className="block truncate text-meta text-fg-muted">{MODULE_DETAIL[href]}</span>
                </span>
                <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-fg-muted opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
