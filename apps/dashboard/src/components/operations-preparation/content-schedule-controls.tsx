"use client";

/*
 * V1-STAGE-2 — schedule a READY draft, and act on a schedule in the calendar.
 *
 * A schedule records WHEN a human means to publish. It publishes nothing: when the moment comes, the
 * calendar offers "Propose publication", which files the same governed request the package panel files
 * by hand — it still needs a Governance approval, and an executor, before anything leaves Hebun.
 *
 * The viewer's zone is read only after mount, so server and browser render the same markup first.
 */
import Link from "next/link";
import { useState, useSyncExternalStore, useTransition } from "react";
import {
  cancelContentScheduleAction,
  createContentScheduleAction,
  proposeScheduledPublicationAction,
  rescheduleContentScheduleAction,
} from "@/app/(dashboard)/operations/schedule-actions";
import type { ScheduleRefusal } from "@/features/content-schedule/contracts";

const REFUSAL_WORDING: Record<ScheduleRefusal, string> = {
  unauthenticated: "Your session could not be confirmed. Sign in again.",
  "persistence-unavailable": "Hebun could not read or record this right now. Nothing was changed.",
  "invalid-input": "The schedule was incomplete. Check the fields and try again.",
  "invalid-time-zone": "That time zone is not recognised.",
  "invalid-local-time": "Enter a date and a time.",
  "nonexistent-local-time": "That time does not exist in this zone (the clocks skip it). Choose another.",
  "too-soon": "Choose a moment at least five minutes from now.",
  "too-far": "Choose a moment within the next year.",
  "not-found": "This draft or schedule could not be found.",
  "not-current-revision": "A newer revision exists. Refresh and schedule the current one.",
  "destination-not-publishable": "Only Instagram and YouTube drafts can be scheduled.",
  "package-not-ready": "The package is not approved and READY, so it cannot be scheduled.",
  "already-scheduled": "This revision is already scheduled. Move or cancel that schedule instead.",
  "not-scheduled": "This schedule is no longer open.",
  "stale-version": "This schedule changed since you loaded it. Refresh and try again.",
  "not-due": "Its moment has not come yet.",
};

const noSubscription = () => () => {};
/* "UTC" on the server and during hydration; the viewer's own zone once mounted. */
function useViewerZone(): string {
  return useSyncExternalStore(
    noSubscription,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    () => "UTC",
  );
}

function ZoneSelect({ value, onChange }: { readonly value: string; readonly onChange: (z: string) => void }) {
  /* The full zone list only after the first interaction, so the first render is the same everywhere. */
  const [zones, setZones] = useState<readonly string[] | null>(null);
  const listed = zones ?? [value];
  const load = () => {
    if (zones) return;
    const all = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
    setZones(all.includes(value) ? all : [value, ...all]);
  };
  return (
    <select aria-label="Time zone" value={value} onFocus={load} onPointerDown={load} onChange={(e) => onChange(e.target.value)} className="max-w-48 rounded border border-border-subtle bg-transparent px-1 py-0.5">
      {(listed.includes(value) ? listed : [value, ...listed]).map((z) => (
        <option key={z} value={z}>
          {z}
        </option>
      ))}
    </select>
  );
}

function YesNo({ label, value, onChange, name }: { readonly label: string; readonly value: string; readonly onChange: (v: string) => void; readonly name: string }) {
  return (
    <fieldset className="flex items-center gap-2">
      <legend className="sr-only">{label}</legend>
      <span className="min-w-24 text-fg-muted">{label}</span>
      {(["yes", "no"] as const).map((v) => (
        <label key={v} className="flex items-center gap-1">
          <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} />
          {v}
        </label>
      ))}
    </fieldset>
  );
}

/** In the package panel of a READY Instagram/YouTube draft. */
export function ScheduleContentPublication({
  artifactId,
  revisionNo,
  destination,
}: {
  readonly artifactId: string;
  readonly revisionNo: number;
  readonly destination: "instagram" | "youtube";
}) {
  const viewerZone = useViewerZone();
  const [zone, setZone] = useState<string | null>(null);
  const [local, setLocal] = useState("");
  const [privacyStatus, setPrivacyStatus] = useState("private");
  const [categoryId, setCategoryId] = useState("");
  const [madeForKids, setMadeForKids] = useState("");
  const [syntheticMedia, setSyntheticMedia] = useState("");
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const timeZone = zone ?? viewerZone;
  const youtubeComplete = /^[0-9]{1,4}$/.test(categoryId) && madeForKids !== "" && syntheticMedia !== "";
  const canSubmit = !pending && local !== "" && (destination === "instagram" || youtubeComplete);

  function schedule() {
    start(async () => {
      const r = await createContentScheduleAction({
        artifactId,
        revisionNo,
        local,
        timeZone,
        ...(destination === "youtube" ? { youtube: { privacyStatus, categoryId, madeForKids, syntheticMedia } } : {}),
      });
      if (r.status === "refused") setMessage(REFUSAL_WORDING[r.reason]);
      else {
        setDone(true);
        setMessage(null);
      }
    });
  }

  if (done) {
    return (
      <p className="text-[11px] text-fg-secondary">
        Scheduled for {local.replace("T", " ")} {timeZone}. It appears in the content calendar; nothing is published until it is proposed,
        approved and executed.
      </p>
    );
  }
  return (
    <div className="min-w-0 space-y-2 text-[11px]">
      <h5 className="font-medium text-fg-secondary">Schedule publishing</h5>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="datetime-local"
          aria-label="Publish at"
          value={local}
          onChange={(e) => setLocal(e.target.value.slice(0, 16))}
          className="rounded border border-border-subtle bg-transparent px-1 py-0.5"
        />
        <ZoneSelect value={timeZone} onChange={setZone} />
      </div>
      {destination === "youtube" ? (
        <div className="grid gap-1.5 sm:grid-cols-2">
          <label className="flex items-center gap-2">
            <span className="min-w-24 text-fg-muted">Privacy</span>
            <select value={privacyStatus} onChange={(e) => setPrivacyStatus(e.target.value)} className="rounded border border-border-subtle bg-transparent px-1 py-0.5">
              <option value="private">private</option>
              <option value="unlisted">unlisted</option>
              <option value="public">public</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="min-w-24 text-fg-muted">Category id</span>
            <input value={categoryId} onChange={(e) => setCategoryId(e.target.value.trim())} inputMode="numeric" placeholder="e.g. 22" className="w-20 rounded border border-border-subtle bg-transparent px-1 py-0.5" />
          </label>
          <YesNo label="Made for kids" value={madeForKids} onChange={setMadeForKids} name={`schedule-kids-${artifactId}`} />
          <YesNo label="Synthetic media" value={syntheticMedia} onChange={setSyntheticMedia} name={`schedule-synthetic-${artifactId}`} />
        </div>
      ) : null}
      <button type="button" onClick={schedule} disabled={!canSubmit} aria-busy={pending} className="rounded border border-border-subtle px-2 py-0.5 text-fg-primary disabled:opacity-50">
        {pending ? "Scheduling…" : "Schedule"}
      </button>
      {message ? <p role="status" className="text-fg-muted">{message}</p> : null}
    </div>
  );
}

/** Actions on one open schedule in the calendar. */
export function ScheduleRowActions({
  scheduleId,
  version,
  due,
  stale,
  timeZone,
}: {
  readonly scheduleId: string;
  readonly version: number;
  readonly due: boolean;
  readonly stale: boolean;
  readonly timeZone: string;
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [local, setLocal] = useState("");
  const [zone, setZone] = useState(timeZone);

  const run = (body: () => Promise<{ status: string; reason?: ScheduleRefusal } & Record<string, unknown>>) =>
    start(async () => {
      const r = await body();
      if (r.status === "refused" && r.reason) setMessage(REFUSAL_WORDING[r.reason]);
      else if (r.status === "proposal-refused") setMessage("The governed proposal was refused — open the draft's package panel to see why. The schedule stays open.");
      else if (r.status === "requested" || r.status === "already-requested") setRequestId(String(r.requestId));
      else setMessage(null);
    });

  if (requestId) {
    return (
      <span className="text-fg-secondary">
        Proposed — waiting for approval. <Link href="/approvals" className="underline underline-offset-2">Open Approvals</Link>
      </span>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {due && !stale ? (
        <button type="button" disabled={pending} onClick={() => run(() => proposeScheduledPublicationAction({ scheduleId }))} className="rounded border border-border-subtle px-2 py-0.5 text-fg-primary disabled:opacity-50">
          Propose publication
        </button>
      ) : null}
      {moving ? (
        <>
          <input type="datetime-local" aria-label="New time" value={local} onChange={(e) => setLocal(e.target.value.slice(0, 16))} className="rounded border border-border-subtle bg-transparent px-1 py-0.5" />
          <ZoneSelect value={zone} onChange={setZone} />
          <button type="button" disabled={pending || local === ""} onClick={() => run(() => rescheduleContentScheduleAction({ scheduleId, expectedVersion: version, local, timeZone: zone }))} className="rounded border border-border-subtle px-2 py-0.5 disabled:opacity-50">
            Save
          </button>
        </>
      ) : (
        <button type="button" disabled={pending} onClick={() => setMoving(true)} className="rounded border border-border-subtle px-2 py-0.5 disabled:opacity-50">
          Reschedule
        </button>
      )}
      <button type="button" disabled={pending} onClick={() => run(() => cancelContentScheduleAction({ scheduleId, expectedVersion: version }))} className="rounded border border-border-subtle px-2 py-0.5 text-fg-muted disabled:opacity-50">
        Cancel
      </button>
      {message ? <span role="status" className="text-fg-muted">{message}</span> : null}
    </div>
  );
}
