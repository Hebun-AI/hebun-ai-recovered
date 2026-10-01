"use client";

import { useEffect, useRef, useState, useTransition, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock3, FileText, Search, Send, ShieldCheck, TriangleAlert } from "lucide-react";
import { ActionAuthorizations, RequestCard, PermitRow } from "@/components/decision-workspace/action-authorizations";
import { approveActionRequestAction, rejectActionRequestAction } from "@/app/(dashboard)/approvals/actions";
import { acceptArtifactRevisionAction, requestArtifactRevisionChangesAction } from "@/app/(dashboard)/operations/actions";
import { elapsedSince } from "@/features/attention-observation/contracts";
import { PERMIT_DEFAULT_TTL_SECONDS, PERMIT_TTL_CHOICES } from "@/features/action-authorization/contracts";
import type { ApprovalsDashboardRead } from "@/features/approvals-dashboard/read-dashboard.server";
import { buildQueue, filterQueue, canDecide, decideVisibleItems, type QueueItem, type Filter, type Intent, type DecisionOutcome } from "@/features/approvals-dashboard/model";
import { InstagramApprovalPreview } from "@/components/decision-workspace/instagram-approval-preview";
import { PUBLISH_INSTAGRAM_MEDIA_ACTION_KIND } from "@/features/instagram-publishing/contracts";
import { ContentDetails, AssetPreview } from "./content-detail";

type Props = ComponentProps<typeof ActionAuthorizations> & { data: ApprovalsDashboardRead; requestsAvailable: boolean; permitsAvailable: boolean };
const filters: readonly Filter[] = ["All", "Pending", "Approved", "Published", "Failed", "Drafts"];
const tabs = ["Details", "Analysis", "Channel Preview", "History"] as const;
const button = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-fg transition hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40";
const primary = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-primary bg-primary px-3 py-2 text-xs font-medium text-on-primary transition hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";
const field = "rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus-visible:outline-2 focus-visible:outline-primary";
function Channel({ name }: { name: string | null }) {
  return <span className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
    {name === "youtube" ? <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M23 7s-.2-1.6-.9-2.3c-.9-.9-1.8-.9-2.2-1C16.8 3.5 12 3.5 12 3.5s-4.8 0-7.9.2c-.4.1-1.3.1-2.2 1C1.2 5.4 1 7 1 7S.8 8.9.8 10.8v1.8c0 1.9.2 3.8.2 3.8s.2 1.6.9 2.3c.9.9 2.1.9 2.6 1 1.9.2 7.5.3 7.5.3s4.8 0 7.9-.3c.4 0 1.3-.1 2.2-1 .7-.7.9-2.3.9-2.3s.2-1.9.2-3.8v-1.8C23.2 8.9 23 7 23 7ZM9.7 15.1V8.5l6.4 3.3-6.4 3.3Z" /></svg> : name === "instagram" ? <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none" /></svg> : <FileText size={14} aria-hidden="true" />}
    {name ?? "Internal / other"}</span>;
}
function Badge({ children, warning = false }: { children: React.ReactNode; warning?: boolean }) {
  return <span className={`inline-flex rounded-md px-2 py-1 text-[11px] font-medium ${warning ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"}`}>{children}</span>;
}
function ItemContext({ item }: { item: QueueItem }) {
  return <div className="space-y-1 text-xs text-fg-muted"><p>{item.work.join(" · ")}</p><p>No separate project relationship is exposed by this record.</p></div>;
}

export function ApprovalsDashboard(props: Props) {
  const { data, requests, permits, workOptions = [], instagramPreviews = null } = props;
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("All");
  const [channel, setChannel] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focused, setFocused] = useState<string | null>(null);
  const [tab, setTab] = useState<(typeof tabs)[number]>("Details");
  const [review, setReview] = useState<{ intent: Intent; ids: string[] } | null>(null);
  const [justification, setJustification] = useState("");
  const [reason, setReason] = useState("");
  const [ttl, setTtl] = useState<number>(PERMIT_DEFAULT_TTL_SECONDS);
  const [acknowledged, setAcknowledged] = useState(false);
  const [outcomes, setOutcomes] = useState<DecisionOutcome[]>([]);
  const [pending, start] = useTransition();
  const running = useRef(false);
  const reviewPanel = useRef<HTMLElement>(null);
  const inspector = useRef<HTMLElement>(null);
  useEffect(() => {
    if (review) { reviewPanel.current?.focus(); reviewPanel.current?.scrollIntoView({ block: "start", behavior: "smooth" }); }
  }, [review]);
  function focusItem(id: string) {
    setFocused(id); setTab("Details");
    inspector.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }
  const items = buildQueue(data, requests, permits);
  const visible = filterQueue(items, filter, channel, query, sort);
  const current = visible.find((item) => item.id === focused) ?? visible[0] ?? null;
  const selectable = visible.filter((item) => canDecide(item, data.authorized, "reject"));
  const picked = selectable.filter((item) => selected.has(item.id));
  const approvable = visible.filter((item) => canDecide(item, data.authorized, "approve"));
  const targets = review ? items.filter((item) => review.ids.includes(item.id)) : [];
  const hasRequests = targets.some((item) => item.kind === "request");
  const countsKnown = data.contentAvailable && data.reviewsAvailable && data.publicationsAvailable && props.requestsAvailable && props.permitsAvailable;
  function openReview(intent: Intent, targetItems: readonly QueueItem[]) {
    setReview({ intent, ids: targetItems.map((item) => item.id) });
    setAcknowledged(false); setJustification(""); setReason("");
  }
  function resetSelection() { setSelected(new Set()); setReview(null); }
  function toggle(id: string) { setSelected((before) => { const after = new Set(before); if (after.has(id)) after.delete(id); else after.add(id); return after; }); }
  async function confirm() {
    if (!review || running.current || !acknowledged || justification.trim().length < 24) return;
    running.current = true;
    try {
      const result = await decideVisibleItems(targets, data.authorized, review.intent, async (item) => {
        if (item.kind === "request") {
          const answer = review.intent === "approve" ? await approveActionRequestAction({ requestId: item.request.requestId, justification, requestedTtlSeconds: ttl }) :
            await rejectActionRequestAction({ requestId: item.request.requestId, justification, rejectionReason: reason });
          return { ok: answer.status !== "refused", detail: answer.status === "refused" ? answer.reason : answer.status === "authorized" ? `Authorized; permit expires ${answer.expiresAt}.` : "Request rejected." };
        }
        if (item.kind !== "content" || !item.content.revision) return { ok: false, detail: "Revision unavailable." };
        const input = { artifactId: item.content.artifact.id, revisionId: item.content.revision.id, justification };
        const answer = await (review.intent === "approve" ? acceptArtifactRevisionAction : requestArtifactRevisionChangesAction)(input);
        return { ok: answer.status === "reviewed", detail: answer.status === "reviewed" ? answer.decision : answer.reason };
      });
      setOutcomes(result); setReview(null); setSelected(new Set()); router.refresh();
    } finally { running.current = false; }
  }
  return <section aria-label="Approvals dashboard" className="min-w-0 space-y-5">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {([ ["Pending Review", "Pending", Clock3], ["Approved", "Approved", ShieldCheck], ["Published", "Published", Send], ["Drafts", "Drafts", FileText], ["Failed", "Failed", TriangleAlert] ] as const).map(([label, value, Icon]) =>
        <button type="button" key={label} aria-pressed={filter === value} disabled={pending} onClick={() => { setFilter(value); resetSelection(); }} className={`rounded-xl border bg-surface p-4 text-left transition hover:border-primary/50 ${filter === value ? "border-primary ring-1 ring-primary/20" : "border-border"}`}>
          <span className="flex items-center justify-between text-xs text-fg-muted">{label}<Icon size={17} aria-hidden="true" /></span>
          <span className="mt-3 block text-3xl font-semibold tracking-tight text-fg">{countsKnown ? items.filter((item) => item.filters.includes(value)).length : "—"}</span>
          <span className="mt-1 block text-[11px] text-fg-muted">{value === "Published" ? "Provider-accepted revisions" : value === "Approved" ? "Accepted reviews / issued permits" : value === "Drafts" ? "Stored draft lifecycle" : "In loaded records"}</span>
        </button>)}
    </div>
    <details className="text-xs leading-5 text-fg-muted"><summary className="cursor-pointer">Count scope · loaded records, overlapping stages, provider-accepted publications</summary><p className="mt-2">Counts cover loaded requests, permits and current artifact revisions, not unique projects or tenant-wide totals. Categories can overlap. Published means the provider accepted a publication and returned an identity; it does not confirm public visibility. Drafts reflects the stored artifact lifecycle.</p></details>
    <div className="flex flex-wrap gap-2 text-xs text-fg-muted">
      <span>Content: {data.contentAvailable ? data.contentTruncated ? "latest 50 artifacts · older records omitted" : "current revisions loaded" : "unavailable"}</span>
      <span>· Pending requests: {props.requestsAvailable ? `${requests.length} loaded (up to 50)` : "unavailable"}</span>
      <span>· Permits: {props.permitsAvailable ? `${permits.length} loaded (up to 50)` : "unavailable"}</span>
      {props.oldestWaiting && <span>· Oldest pending action: {props.oldestWaiting.label}</span>}
      {props.awaitingCount !== null && props.awaitingCount !== undefined && <span>· All pending action requests: {props.awaitingCount}</span>}
    </div>
    {!data.authorized && <p role="status" className="rounded-lg border border-border bg-surface-sunken p-3 text-sm text-fg-muted">Review access only. This session has no resolved Governance authority; decision controls are disabled.</p>}
    <div className="rounded-xl border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3">
        <div className="flex flex-wrap gap-1" aria-label="Status filters">{filters.map((value) => <button type="button" key={value} disabled={pending} aria-pressed={filter === value} onClick={() => { setFilter(value); resetSelection(); }} className={`rounded-lg px-3 py-2 text-xs font-medium ${filter === value ? "bg-primary/10 text-primary" : "text-fg-muted hover:bg-surface-sunken"}`}>{value}</button>)}</div>
        <button type="button" className={primary} disabled={pending || !approvable.length} onClick={() => openReview("approve", approvable)}><Check size={14} aria-hidden="true" />Approve All ({approvable.length})</button>
      </div>
      <div className="flex flex-wrap gap-2 p-3">
        <label className="relative min-w-40 flex-1"><span className="sr-only">Search title, channel or work</span><Search size={16} className="absolute left-3 top-3 text-fg-muted" aria-hidden="true" /><input value={query} disabled={pending} onChange={(e) => { setQuery(e.target.value); resetSelection(); }} placeholder="Search title, channel or work…" className={`${field} w-full pl-9`} /></label>
        <label><span className="sr-only">Channel</span><select value={channel} disabled={pending} onChange={(e) => { setChannel(e.target.value); resetSelection(); }} className={field}><option value="all">All channels</option>{[...new Set(items.flatMap((item) => item.channel ? [item.channel] : []))].sort().map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
        <label><span className="sr-only">Sort</span><select value={sort} disabled={pending} onChange={(e) => setSort(e.target.value as "newest" | "oldest")} className={field}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border bg-surface-sunken px-4 py-3">
        <label className="mr-auto flex items-center gap-2 text-xs"><input type="checkbox" aria-label="Select all eligible visible items" disabled={pending || !selectable.length} checked={selectable.length > 0 && picked.length === selectable.length} onChange={() => setSelected(picked.length === selectable.length ? new Set() : new Set(selectable.map((item) => item.id)))} />{picked.length} selected · {visible.length} visible</label>
        <button type="button" className={button} disabled={pending || !picked.some((item) => canDecide(item, data.authorized, "approve"))} onClick={() => openReview("approve", picked)}>Approve Selected</button>
        <button type="button" className={button} disabled={pending || !picked.some((item) => canDecide(item, data.authorized, "changes"))} onClick={() => openReview("changes", picked)}>Request Changes</button>
        <button type="button" className={button} disabled={pending || !picked.length} onClick={() => openReview("reject", picked)}>Reject</button>
      </div>
      <p className="px-4 pb-3 text-xs text-fg-muted">Approve All covers only eligible records in the current filtered list. Every decision is checked separately. It never publishes. Request Changes applies to content revisions; unsupported items are skipped.</p>
    </div>
    {outcomes.length > 0 && <div role="status" aria-live="polite" className="rounded-xl border border-border bg-surface p-4">
      <p className="text-sm font-medium">{outcomes.filter((o) => o.status === "success").length} recorded · {outcomes.filter((o) => o.status === "refused").length} refused · {outcomes.filter((o) => o.status === "unknown").length} unknown · {outcomes.filter((o) => o.status === "skipped").length} skipped</p>
      <ul className="mt-2 space-y-1 text-xs text-fg-secondary">{outcomes.map((o) => <li key={o.id}>{o.title} — {o.status}: {o.detail}</li>)}</ul>
    </div>}
    {review && <section ref={reviewPanel} tabIndex={-1} aria-label="Confirm decisions" className="space-y-4 rounded-xl border border-primary/40 bg-surface p-4">
      <div className="flex items-center justify-between gap-2"><h2 className="font-semibold">Review {targets.length} records · {review.intent === "approve" ? "Approve" : review.intent === "changes" ? "Request Changes" : "Reject"}</h2><button type="button" disabled={pending} onClick={() => setReview(null)} className={button}>Cancel</button></div>
      <p className="text-sm text-fg-muted">Read the exact content and consequences below before confirming. Content rejection uses Governance’s existing “changes requested” decision. Authorizing an external act issues a permit only; an agent-proposed internal act may be delivered by the existing machine runtime.</p>
      <div className="max-h-[28rem] space-y-4 overflow-y-auto rounded-lg border border-border p-3">{targets.map((item) => <div key={item.id} className="space-y-2"><h3 className="font-medium">{item.title}</h3>{!canDecide(item, data.authorized, review.intent) ? <p className="text-sm text-warning">Will be skipped: this decision is not supported for this item.</p> : item.kind === "request" ? <><RequestSummary item={item} />{item.request.actionKind === PUBLISH_INSTAGRAM_MEDIA_ACTION_KIND && <InstagramApprovalPreview requestId={item.request.requestId} preview={instagramPreviews?.[item.request.requestId]} />}</> : item.kind === "content" ? <ContentDetails content={item.content} tab="Details" /> : null}</div>)}</div>
      <label className="flex flex-col gap-1 text-xs">Justification recorded for each decision (at least 24 characters)<textarea disabled={pending} value={justification} onChange={(e) => setJustification(e.target.value)} className={field} rows={3} /></label>
      {hasRequests && review.intent === "approve" && <label className="flex flex-col gap-1 text-xs">Permit lifetime<select disabled={pending} className={field} value={ttl} onChange={(e) => setTtl(Number(e.target.value))}>{PERMIT_TTL_CHOICES.map((choice) => <option key={choice.seconds} value={choice.seconds}>{choice.label}</option>)}</select></label>}
      {hasRequests && review.intent === "reject" && <label className="flex flex-col gap-1 text-xs">Rejection reason<input disabled={pending} value={reason} onChange={(e) => setReason(e.target.value)} className={field} /></label>}
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" disabled={pending} checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />I reviewed these records and their individual consequences.</label>
      <button type="button" className={primary} disabled={pending || !acknowledged || justification.trim().length < 24 || (hasRequests && review.intent === "reject" && !reason.trim()) || !targets.length} onClick={() => start(confirm)}>{pending ? "Recording each decision…" : "Confirm decisions"}</button>
    </section>}
    <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <section aria-label="Review queue" className="min-w-0 space-y-3">
        {!visible.length && <div className="rounded-xl border border-border bg-surface p-10 text-center"><FileText className="mx-auto mb-3 text-fg-muted" aria-hidden="true" /><h2 className="text-sm font-medium">{countsKnown ? "No records match this view" : "No readable records in this view"}</h2><p className="mt-2 text-xs text-fg-muted">{countsKnown ? "Change the filters or prepare content in Operations." : "One or more data sources are unavailable. This does not establish an empty queue."}</p></div>}
        {visible.map((item) => <article key={item.id} className={`rounded-xl border bg-surface p-4 ${current?.id === item.id ? "border-primary ring-1 ring-primary/15" : "border-border"}`}>
          <div className="flex items-start gap-3">
            <input type="checkbox" className="mt-1" aria-label={`Select ${item.title}`} checked={selected.has(item.id)} disabled={pending || !canDecide(item, data.authorized, "reject")} onChange={() => toggle(item.id)} />
            <button type="button" className="min-w-0 flex-1 text-left" aria-pressed={current?.id === item.id} onClick={() => focusItem(item.id)}><span className="mb-2 flex items-center justify-between gap-2"><Channel name={item.channel} /><span className="text-[11px] text-fg-muted">{item.kind === "content" ? "Content review" : item.kind === "request" ? "Action request" : "Issued permit"}</span></span><h3 className="break-words text-sm font-semibold text-fg">{item.title}</h3></button>
          </div>
          <div className="mt-3 space-y-2"><ItemContext item={item} /><CardPublication item={item} /><div className="flex flex-wrap gap-2"><Badge warning={item.status.includes("unknown") || item.filters.includes("Failed")}>{item.status}</Badge>{item.kind === "content" && item.filters.includes("Published") && <Badge>Provider accepted publication</Badge>}</div><p className="text-[11px] text-fg-muted">Created {item.createdAt.replace("T", " ").slice(0, 16)} UTC</p></div>
          {item.kind === "content" && item.content.package.status === "read" && item.content.package.package.selected[0] && <details className="mt-3"><summary className="cursor-pointer text-xs text-fg-muted">Preview selected media</summary><AssetPreview key={item.content.package.package.selected[0].mediaAssetId} asset={item.content.package.package.selected[0]} /></details>}
          <div className="mt-4 flex flex-wrap gap-2">{item.kind !== "permit" ? <><button type="button" disabled={pending || !canDecide(item, data.authorized, "approve")} className={primary} onClick={() => openReview("approve", [item])}>Approve</button><button type="button" disabled={pending || !canDecide(item, data.authorized, "changes")} className={button} title={item.kind === "request" ? "Action requests do not support a changes-requested decision" : undefined} onClick={() => openReview("changes", [item])}>Request Changes</button><button type="button" disabled={pending || !canDecide(item, data.authorized, "reject")} className={button} onClick={() => openReview("reject", [item])}>Reject</button></> : <button type="button" className={button} onClick={() => focusItem(item.id)}>Inspect permit / execution</button>}</div>
        </article>)}
      </section>
      <aside ref={inspector} aria-label="Selected item detail" className="min-w-0 rounded-xl border border-border bg-surface xl:sticky xl:top-4">
        {current ? <><div className="space-y-2 border-b border-border p-5"><Channel name={current.channel} /><h2 className="break-words text-lg font-semibold">{current.title}</h2><ItemContext item={current} /><Badge>{current.status}</Badge></div>
          <div className="flex flex-wrap gap-1 border-b border-border p-2" role="tablist" aria-label="Item details">{tabs.map((value) => <button type="button" key={value} role="tab" aria-selected={tab === value} aria-controls="approval-detail-panel" id={`approval-tab-${value.replaceAll(" ", "-")}`} tabIndex={tab === value ? 0 : -1} onKeyDown={(event) => {
              const index = tabs.indexOf(value);
              const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null;
              if (next === null) return;
              event.preventDefault(); setTab(tabs[next]);
              (event.currentTarget.parentElement?.children[next] as HTMLButtonElement | undefined)?.focus();
            }} className={`rounded-lg px-3 py-2 text-xs ${tab === value ? "bg-primary/10 font-medium text-primary" : "text-fg-muted"}`} onClick={() => setTab(value)}>{value}</button>)}</div>
          <div role="tabpanel" id="approval-detail-panel" aria-labelledby={`approval-tab-${tab.replaceAll(" ", "-")}`} className="min-w-0 p-4" key={current.id}>
            {current.kind === "content" ? <ContentDetails content={current.content} tab={tab} /> : current.kind === "request" && (tab === "Details" || tab === "Channel Preview") ? <>{data.authorized && !pending ? <ul><RequestCard key={current.id} item={current.request} waitingFor={props.evaluatedAt ? elapsedSince(current.request.proposedAt, props.evaluatedAt, "action-request.created_at") : null} workOptions={workOptions} instagramPreviews={instagramPreviews} /></ul> : <RequestSummary item={current} />}</> : current.kind === "permit" && (tab === "Details" || tab === "History") ? <ul className={pending ? "pointer-events-none opacity-60" : ""}><PermitRow key={current.id} item={current.permit} controlsDisabled={!data.authorized || pending} /></ul> : <p className="text-sm text-fg-muted">No {tab.toLowerCase()} read is connected to this record. Content measurements are shown on the corresponding revision.</p>}
          </div></> : <p className="p-8 text-center text-sm text-fg-muted">Select a record to inspect its content and recorded state.</p>}
      </aside>
    </div>
  </section>;
}

function RequestSummary({ item }: { item: Extract<QueueItem, { kind: "request" }> }) {
  const request = item.request;
  return <div className="space-y-3 text-sm">
    <p>{request.expectedEffect}</p><p>{request.actionKind} · {request.sideEffect} · {request.reversibility}</p>
    <p className="break-all">Target: {request.targetLabel ?? request.targetRef ?? "Not recorded"}</p>
    <dl className="space-y-2">{request.parameters.map((p) => <div key={p.name}><dt className="text-xs text-fg-muted">{p.name}</dt><dd className="whitespace-pre-wrap break-all">{p.value}</dd></div>)}</dl>
    <div className="rounded-lg border border-warning/30 bg-warning/5 p-3"><h4 className="font-medium">Consequences</h4><ul className="mt-2 list-disc space-y-1 pl-5">{request.consequences.map((consequence) => <li key={consequence}>{consequence}</li>)}</ul></div>
    <div className="text-xs text-fg-muted"><p>Evidence: {request.evidence.status}</p>{request.evidence.status === "attached" && request.evidence.items.map((e) => <p key={`${e.sourceClass}:${e.recordRef}`} className="break-all">{e.sourceClass} · {e.recordRef} · {e.lifecycle}</p>)}</div>
    <p className="text-xs text-fg-muted">{request.proposalRationale ?? "Proposal rationale unavailable."}</p>
  </div>;
}

function CardPublication({ item }: { item: QueueItem }) {
  if (item.kind === "permit") return item.permit.providerMessageId ? <p className="break-all text-xs text-fg-muted">Provider identity: {item.permit.providerMessageId}</p> : null;
  if (item.kind !== "content") return null;
  const publication = item.content.publication;
  const entries = publication?.status === "recorded" ? publication.entries : [];
  const accepted = entries.filter((entry) => entry.attempt?.status === "accepted").at(-1);
  const measurement = item.content.measurement;
  const youtube = measurement?.status === "read" ? [...measurement.youtube].filter((m) => m.status === "measured").sort((a, b) => b.latestObservedAt.localeCompare(a.latestObservedAt))[0] : null;
  const instagram = measurement?.status === "read" ? [...measurement.instagram].filter((m) => m.status === "observed").sort((a, b) => b.latestObservedAt.localeCompare(a.latestObservedAt))[0] : null;
  return <div className="space-y-1 text-xs text-fg-muted">
    {accepted?.attempt?.providerResultId && <p className="break-all">Provider accepted · {accepted.attempt.providerResultId} · {accepted.attempt.completedAt ?? accepted.attempt.startedAt}</p>}
    {youtube && <p>Stored YouTube · {youtube.viewCount ?? "unreported"} views · {youtube.likeCount ?? "unreported"} likes · {youtube.commentCount ?? "unreported"} comments · as of {youtube.latestObservedAt}</p>}
    {instagram && <p>Stored Instagram · {instagram.latestLikeCount ?? "unreported"} likes · {instagram.latestCommentCount ?? "unreported"} comments · as of {instagram.latestObservedAt}</p>}
  </div>;
}
