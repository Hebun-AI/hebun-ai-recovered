/*
 * heby-evidence.tsx — how organizational evidence looks under a Heby answer (KR4).
 *
 * ── WHAT THIS RENDERS, AND WHAT IT REFUSES TO ───────────────────────────────
 *
 * Every value here is a field the retrieval layer derived from records the organization actually
 * holds. Nothing is computed in this file, nothing is inferred, and no sentence is generated: the
 * copy is FIXED TEXT arranged around derived facts. A reason written by a model would be a reason
 * wearing the runtime's authority.
 *
 * There is no confidence, no trust level, no quality figure, no star rating and no score. The
 * retrieval blend that ordered these records stays inside the retrieval layer, because a number
 * printed beside a policy is read as a verdict on the policy, and Hebun computes no such verdict.
 * Ordering already carries the match.
 *
 * ── THREE STANDING FACTS, NEVER ONE BADGE ───────────────────────────────────
 *
 * `authoritative`, `ratified` and `current` are different claims about a record and are rendered
 * separately. Merging them into one word would let a provisional draft that happens to be current
 * borrow the appearance of an approved policy — and RATIFIED IS NOT TRUE either way: it means the
 * organization's Governance approved this version, not that reality agrees with it.
 *
 * ── ABSENT IS NOT EMPTY ─────────────────────────────────────────────────────
 *
 * A missing field is omitted, never filled with a placeholder. A missing evidence SET is not the
 * same as an empty one, and the two produce different notices — "we did not retain this" and "we
 * searched and found nothing" are different facts about the answer above.
 *
 * Presentation only. No fetch, no state, no authority, no database id rendered as a link.
 */

import type {
  RetrievalEvidenceItem,
  RetrievalEvidenceSet,
} from "@/features/knowledge-retrieval";

/* ── standing ─────────────────────────────────────────────────────────────── */

type Tone = "neutral" | "info" | "warn";

const TONE: Record<Tone, string> = {
  neutral: "border-border text-fg-muted",
  info: "border-info/30 text-info",
  warn: "border-warning/35 text-warning",
};

function Chip({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.65rem] font-medium ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}

/**
 * The standing chips for one record.
 *
 * `null` authority and `null` lifecycle are rendered as "not stated" rather than guessed. K1
 * established that these are NEVER defaulted, and a UI that quietly prints "provisional" for an
 * unstated authority would be inventing the very field the writer refused to invent.
 */
function Standing({ item }: { item: RetrievalEvidenceItem }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Chip tone={item.authorityClass === "authoritative" ? "info" : "neutral"}>
        {item.authorityClass ?? "authority not stated"}
      </Chip>
      <Chip>{item.lifecycleStatus ?? "lifecycle not stated"}</Chip>
      <Chip tone={item.ratified ? "info" : "neutral"}>
        {item.ratified ? "ratified" : "no ratification recorded"}
      </Chip>
      {/*
        The canonical freshness vocabulary, not a paraphrase of it. `review-overdue` and `expired`
        are the two states a reader should notice; `unknown` is warned on too, because "we do not
        know whether this is current" is exactly the thing a confident-looking card would hide.
      */}
      <Chip
        tone={
          item.freshness === "review-overdue" || item.freshness === "expired" || item.freshness === "unknown"
            ? "warn"
            : "neutral"
        }
      >
        freshness: {item.freshness}
      </Chip>
    </div>
  );
}

/**
 * Why this record is here — derived facts only.
 *
 * An empty `matchedTerms` prints nothing rather than "matched". The database matched on a stemmed
 * form this literal check cannot see, and claiming a term the reader cannot find in the excerpt
 * would be an explanation they could disprove with their own eyes.
 */
function WhyThis({ item }: { item: RetrievalEvidenceItem }) {
  const reasons: string[] = [];
  if (item.explanation.matchedTerms.length > 0) {
    reasons.push(`Matched terms: ${item.explanation.matchedTerms.join(", ")}`);
  }
  if (item.explanation.domainMatched) reasons.push(`Domain matched: ${item.domainKey}`);
  if (item.explanation.scopeMatched) reasons.push(`Scope matched: ${item.scope}`);
  if (item.explanation.activeVersion) reasons.push("Current active Knowledge version");
  if (item.explanation.diversityAffected) reasons.push("Source diversity applied to this set");
  if (reasons.length === 0) return null;

  return (
    <p className="mt-1.5 text-[0.68rem] leading-5 text-fg-muted" data-heby-evidence-why="">
      {reasons.join(" · ")}
    </p>
  );
}

/** Provenance, rendered only from what the record actually carries. */
function Provenance({ item }: { item: RetrievalEvidenceItem }) {
  const lines: string[] = [];
  if (item.origin) lines.push(item.origin === "human-ingested" ? "Ingested by a person" : "Authored by a person");
  if (item.sourceTitle) lines.push(`Source: ${item.sourceTitle}`);
  if (item.sourceType) lines.push(`Source type: ${item.sourceType}`);
  if (item.ingestedAt) lines.push(`Ingested: ${item.ingestedAt}`);
  if (item.chunkIndex !== null && item.chunkCount !== null) {
    lines.push(`Part ${item.chunkIndex} of ${item.chunkCount}`);
  }
  lines.push(`Knowledge version v${item.knowledgeVersion} · fact revision ${item.factVersion}`);
  if (item.effectiveFrom) lines.push(`Effective from: ${item.effectiveFrom}`);
  if (item.effectiveUntil) lines.push(`Effective until: ${item.effectiveUntil}`);
  if (item.nextReviewAt) lines.push(`Next review: ${item.nextReviewAt}`);
  if (item.ratifiedAt) lines.push(`Ratified: ${item.ratifiedAt}`);
  /*
   * The most honest line on the card. Hebun knows a person submitted the text; it does not know
   * whether they wrote it. Only shown when the record actually carries the flag — `null` means this
   * projection did not read provenance, which is not the same as "origin verified".
   */
  if (item.textOriginUnverified === true) {
    lines.push("Text origin not verified — Hebun records who submitted it, not who wrote it");
  }

  return (
    <ul className="mt-1.5 flex flex-col gap-0.5 text-[0.66rem] leading-5 text-fg-muted">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}

function Card({ item }: { item: RetrievalEvidenceItem }) {
  return (
    <li
      className="rounded-lg border border-border bg-surface-sunken/30 p-2.5"
      data-heby-evidence-card=""
      data-heby-evidence-domain={item.domainKey}
    >
      <p className="text-[0.78rem] font-semibold text-fg">{item.title}</p>
      <p className="mt-0.5 text-[0.65rem] text-fg-muted">
        {item.domainKey} · {item.scope}
      </p>

      {item.excerpt ? (
        <p className="mt-1.5 text-[0.72rem] leading-5 text-fg-secondary">
          {item.excerpt}
          {item.excerptTruncated ? <span className="text-fg-muted"> … (excerpt)</span> : null}
        </p>
      ) : (
        <p className="mt-1.5 text-[0.7rem] italic text-fg-muted">This record carries no statement.</p>
      )}

      <div className="mt-2">
        <Standing item={item} />
      </div>

      <WhyThis item={item} />

      <details className="mt-1.5">
        <summary className="cursor-pointer text-[0.66rem] text-fg-muted">Details</summary>
        <Provenance item={item} />
      </details>
    </li>
  );
}

/* ── set-level notices ────────────────────────────────────────────────────── */

/**
 * The set-level facts KR3 computed and then discarded before the UI.
 *
 * Each is a separate sentence because each is a separate fact. Collapsing truncation, diversity
 * pruning and withheld records into one "some results omitted" line would tell the reader that
 * something is missing without telling them WHICH kind of missing — and those have different
 * remedies.
 */
function SetNotices({ set }: { set: RetrievalEvidenceSet }) {
  const notices: string[] = [];

  if (set.multipleRelevantSources) {
    notices.push(
      "Multiple relevant organizational sources were found. Review their standing if they disagree — Hebun does not check whether they agree.",
    );
  }
  if (set.truncated) {
    notices.push("More eligible Knowledge exists than was swept for this question.");
  }
  if (set.diversityPruned > 0) {
    notices.push(
      `${set.diversityPruned} further passage(s) from an already-represented source were left out to keep the evidence varied.`,
    );
  }
  if (set.excludedCount > 0) {
    notices.push(
      `${set.excludedCount} record(s) matched this question but were not shown because they are no longer in force.`,
    );
  }
  if (set.degradedReason) notices.push(set.degradedReason);

  if (notices.length === 0) return null;

  return (
    <ul className="mt-2 flex flex-col gap-1 text-[0.68rem] leading-5 text-fg-muted" data-heby-evidence-notices="">
      {notices.map((notice) => (
        <li key={notice}>{notice}</li>
      ))}
    </ul>
  );
}

/**
 * The five retrieval outcomes, as five different sentences.
 *
 * "Your organization holds nothing", "your organization holds knowledge but not about this", "your
 * question had no searchable word" and "the read failed" are four different facts, and telling
 * someone the first when the second is true is a false claim about their organization. This is the
 * defect KR3 fixed in the prose; rendering them all as "No data" here would reintroduce it.
 */
function EmptyState({ set }: { set: RetrievalEvidenceSet }) {
  const text =
    set.status === "empty-corpus"
      ? "Your organization currently holds no Knowledge records. This is your organization's real state, not a read failure."
      : set.status === "no-match"
        ? "Your organization holds Knowledge, but nothing in it matched this question."
        : set.status === "empty-query"
          ? "No searchable term was found in the question, so no Knowledge was retrieved. This says nothing about what your organization knows."
          : `Knowledge could not be read for this answer.${set.unavailableReason ? ` ${set.unavailableReason}` : ""}`;

  return (
    <div data-heby-evidence-empty={set.status}>
      <p className="text-[0.7rem] leading-5 text-fg-muted">{text}</p>
      <SetNotices set={set} />
    </div>
  );
}

/* ── entry point ──────────────────────────────────────────────────────────── */

export function HebyEvidencePanel({
  set,
  historical = false,
}: {
  readonly set: RetrievalEvidenceSet;
  /** KR5 — this set was RECORDED WITH an earlier answer, rather than produced for the live one. */
  readonly historical?: boolean;
}) {
  return (
    <div
      className="mt-1.5"
      data-heby-evidence={set.status}
      {...(historical ? { "data-heby-evidence-historical": "" } : {})}
    >
      {historical ? <HistoricalNotice /> : null}
      {set.status === "matched" ? (
        <>
          <ul className="flex flex-col gap-1.5">
            {set.items.map((item) => (
              <Card key={item.recordRef} item={item} />
            ))}
          </ul>
          <SetNotices set={set} />
          <p className="mt-2 text-[0.64rem] leading-4 text-fg-muted">
            Records are ordered by how closely their text matches your question. That ordering is not a
            measure of truth, approval or currency — each record states its own standing above.
          </p>
        </>
      ) : (
        <EmptyState set={set} />
      )}
    </div>
  );
}

/**
 * The frame that keeps a preserved snapshot from being read as a current-state claim.
 *
 * Everything below this notice is what one earlier answer was given and shown — the title, the
 * excerpt, the version, the standing, all as they were AT THAT TIME. Knowledge may have moved on:
 * a record here may since have been superseded, ratified, retired or expired, and this panel will
 * keep showing the older reading because that is what the answer used.
 *
 * It deliberately does NOT compare against current Knowledge or link to it. A comparison would need
 * a live re-read this panel must not perform, and a link would quietly turn a historical reference
 * back into a current-state one — the exact substitution the stored snapshot exists to prevent.
 */
function HistoricalNotice() {
  return (
    <p
      className="mb-1.5 text-[0.64rem] leading-4 text-fg-muted"
      data-heby-evidence-historical-notice=""
    >
      Evidence recorded with this answer, as it stood at the time. Your organization&rsquo;s current
      knowledge may have changed since.
    </p>
  );
}

/**
 * What a reloaded answer can honestly say when it has NO recorded evidence.
 *
 * Since KR5 an answer that ran a retrieval stores what it was given, so this is no longer the
 * normal reloaded case — it is what remains true for answers produced BEFORE that record existed,
 * and for any turn whose retrieval never ran. Re-running retrieval now would produce today's
 * records, after supersessions, ratifications and expiries the original answer never saw, and
 * presenting those as "the evidence behind this answer" would be a fabricated history. For those
 * turns, saying so plainly is still the only truthful option available.
 */
export function HebyEvidenceNotRetained() {
  return (
    <span className="text-[0.68rem] text-fg-muted" data-heby-evidence-not-retained="">
      Evidence details were not retained for this earlier response.
    </span>
  );
}
