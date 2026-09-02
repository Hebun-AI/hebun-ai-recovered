/*
 * APP-2 — THE DECISION SURFACE FIREWALL.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "`/approvals` states the same truth as the authorities behind it — and it reached that state by
 *    PROJECTING what was already stored, not by inventing anything, and by COLLAPSING structural
 *    material without erasing a single declared absence."
 *
 * The order is the phase. Truth first, layering second: a collapsed false claim is still false, so
 * every repair below is asserted before any assertion about disclosure.
 *
 * Structural, plus a real exercise of the projection functions against constructed rows. Nothing
 * here renders a component, opens a database, or contacts anything.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { WORKSPACES, getWorkspace } from "../../src/config/workspace-nav";
import {
  lockLabel,
  splitPayload,
  toEvidence,
} from "../../src/features/action-authorization/decision-projection";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const SURFACE = "src/components/decision-workspace";
const READER = "src/features/action-authorization/read-action-authorizations.server.ts";
const CARD = `${SURFACE}/action-authorizations.tsx`;
const WORKSPACE = `${SURFACE}/decision-workspace.tsx`;
const EVIDENCE_REGION = `${SURFACE}/decision-evidence-advisory.tsx`;
const CONSEQUENCES_REGION = `${SURFACE}/decision-consequences-governance.tsx`;
const HANDOFF_REGION = `${SURFACE}/decision-handoff-boundary.tsx`;
const ROUTE = "src/app/(dashboard)/approvals/page.tsx";
const MODEL = "src/features/decisions/workspace-model.ts";
const PROJECTION = "src/features/action-authorization/decision-projection.ts";

function walk(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir)).flatMap((entry) => {
    const rel = path.join(dir, entry);
    return statSync(path.join(ROOT, rel)).isDirectory() ? walk(rel) : /\.tsx?$/.test(rel) ? [rel] : [];
  });
}

const surfaceFiles = (): string[] => walk(SURFACE);

/*
 * WHAT THE SURFACE SAYS TO A HUMAN — comments stripped, then whitespace-normalised.
 *
 * BOTH halves are load-bearing, and the first was learned the hard way here. Every repair in this
 * phase carries a comment QUOTING the false sentence it replaced, so that a future reader knows what
 * was wrong and why. Asserting over raw source therefore finds the old denial in the very comment
 * explaining its removal, and a correct repair fails its own test. The rendered surface is the code,
 * never the commentary about it.
 *
 * Normalising whitespace matters for the opposite reason: these sentences live in JSX and wrap at
 * the formatter's column, so a literal-space pattern would pass or fail on where a line break
 * happens to fall — a property of the formatter, not of what the surface says.
 */
const said = (file: string): string => codeOf(read(file)).replace(/\s+/g, " ");

function main(): void {
  /* ═══ PART ONE — TRUTH ═══════════════════════════════════════════════════ */

  /* ── 1 · THE THREE FALSE DENIALS ARE GONE, EXACTLY AS WRITTEN ────────────
   * Asserted as the literal sentences that were false on the live page, so a future edit that
   * reintroduces any of them fails here rather than in production.
   */
  {
    assert.ok(
      !/No decision item is connected, so no evidence is shown/.test(said(EVIDENCE_REGION)),
      "the evidence region must not deny evidence that a connected request stores",
    );
    assert.ok(
      !/No decision item is connected, so no stated consequences are shown/.test(
        said(CONSEQUENCES_REGION),
      ),
      "the consequences region must not deny consequences the card renders",
    );
    assert.ok(
      !/this surface starts nothing/.test(said(HANDOFF_REGION)),
      "the handoff region must not deny the execute control this surface holds",
    );
    /*
     * The marker was false in the same way the body was. `No trigger here` sat on a region whose
     * page holds a permit-bound trigger.
     */
    assert.ok(
      !/No trigger here/.test(said(HANDOFF_REGION)),
      "and its marker must not claim there is no trigger on this surface",
    );
  }

  /* ── 2 · EACH REGION DEFERS TO THE LIVE ITEM RATHER THAN DUPLICATING IT ──
   * One decision fact, one source. A second authoritative-looking list could drift from the one a
   * human actually authorizes.
   */
  {
    assert.ok(
      /Evidence appears on the action being authorized/.test(said(EVIDENCE_REGION)),
      "the evidence region points at where live evidence appears",
    );
    assert.ok(
      /Consequences appear on the action being authorized/.test(said(CONSEQUENCES_REGION)),
      "the consequences region points at where live consequences appear",
    );
    /* Neither may grow its own copy of the live data. */
    for (const region of [EVIDENCE_REGION, CONSEQUENCES_REGION, HANDOFF_REGION]) {
      const code = codeOf(read(region));
      for (const banned of [
        "PendingActionRequestView", "readPendingActionRequests", "item.consequences",
        "item.evidence", "useState", "props",
      ]) {
        assert.ok(!code.includes(banned), `${path.basename(region)} must not reach "${banned}"`);
      }
    }
  }

  /* ── 3 · EXECUTION SEMANTICS RESTATED, NOT WEAKENED ──────────────────────
   * The sentence was corrected; the boundary it describes was not touched.
   */
  {
    const handoff = said(HANDOFF_REGION);
    for (const clause of [
      "Authorizing issues a bounded, revocable, single-spend permit. It does not execute.",
      "a second, separate human act, never automatic",
      "Spending a permit is not success",
      "not connected is a handoff INTO Operations",
    ]) {
      assert.ok(handoff.includes(clause), `the handoff region must still say: "${clause}"`);
    }
    /* And the card still says it beside the control, where the decision is actually made. */
    assert.ok(
      /Authorizing does not execute — it issues a bounded, revocable permit\./.test(said(CARD)),
      "the card still states that authorizing does not execute, next to the control",
    );
  }

  /* ── 4 · THE PROJECTION EXISTS AND IS EXERCISED, NOT MERELY DECLARED ─────
   * Asserted by running the real module against constructed rows. A type that names a field proves
   * nothing about what the mapping does with it.
   */
  {
    const reader = codeOf(read(READER));
    for (const field of ["proposedByActorType", "evidence", "locks", "sideEffect"]) {
      assert.ok(reader.includes(field), `the reader projects "${field}"`);
    }
    /* Projected from the row, never defaulted to a literal the row cannot contradict. */
    assert.ok(
      /proposedByActorType: row\.proposedByActorType/.test(reader),
      "the proposer type comes from the row",
    );
    assert.ok(/evidence: toEvidence\(row\.evidence\)/.test(reader), "evidence comes from the row");
    assert.ok(
      !/proposedByActorType:\s*"(human|agent)"/.test(reader),
      "the proposer type is never a literal in the reader — that is the defect A1a repaired",
    );

    /* THE REAL PAYLOAD `/send` WRITES, through the real splitter. */
    const { parameters, locks } = splitPayload({
      recipientRef: "external-recipient/487c64be",
      recipientEndpointDigest: "aa11",
      draftRef: "work-artifact/a45229f8@1",
      draftRevisionDigest: "bb22",
    });
    assert.deepEqual(
      parameters.map((p) => p.name),
      ["draftRef", "recipientRef"],
      "the decision facts stay as parameters",
    );
    assert.deepEqual(
      locks.map((l) => l.name),
      ["draftRevisionDigest", "recipientEndpointDigest"],
      "and every digest is moved out of them",
    );
    assert.deepEqual(
      locks.map((l) => l.label),
      ["Draft revision locked", "Recipient endpoint locked"],
      "each lock is named by what it means",
    );
    /* The raw value survives the move — a lock is re-presented, never discarded. */
    assert.equal(locks[0]?.value, "bb22", "the integrity value is still carried");
    assert.equal(lockLabel("Digest"), "Locked", "a degenerate key still yields a phrase");
  }

  /* ── 5 · ABSENT, UNREADABLE AND ATTACHED ARE THREE ANSWERS ───────────────
   * UNKNOWN must never become empty. APP-2 exists because an absence was asserted without being
   * established, so the projection that repairs it may not collapse the same distinction.
   */
  {
    const projection = codeOf(read(PROJECTION));
    for (const state of ["attached", "none", "unreadable"]) {
      assert.ok(projection.includes(`"${state}"`), `the evidence projection can answer "${state}"`);
    }
    /* A partially-parseable set is unreadable, never a silently truncated attachment. */
    assert.ok(
      /return \{ status: "unreadable" \};/.test(projection),
      "a malformed entry yields unreadable rather than a shorter list",
    );
    /* EXECUTED, not merely declared — this is the distinction the whole phase turns on. */
    assert.deepEqual(toEvidence(null), { status: "none" }, "NULL evidence is an absence");
    assert.deepEqual(toEvidence([]), { status: "none" }, "and so is an empty set");
    assert.deepEqual(toEvidence("nonsense"), { status: "unreadable" }, "a non-array is unknown");
    assert.deepEqual(
      toEvidence([{ sourceClass: "work-artifacts", recordRef: "r", lifecycle: "settled" }]),
      { status: "attached", items: [{ sourceClass: "work-artifacts", recordRef: "r", lifecycle: "settled" }] },
      "a well-formed set is attached",
    );
    /* THE DANGEROUS CASE. One bad entry must not yield a shorter list presented as the whole one. */
    assert.deepEqual(
      toEvidence([{ sourceClass: "work-artifacts", recordRef: "r", lifecycle: "settled" }, { nope: 1 }]),
      { status: "unreadable" },
      "a partially-parseable set is unreadable, never silently truncated",
    );
    assert.equal(
      (toEvidence([{ sourceClass: "s", recordRef: "r" }]) as unknown as { items: { lifecycle: string }[] }).items[0]?.lifecycle,
      "unknown",
      "a missing lifecycle is unknown, never assumed settled",
    );

    /* And the card says all three differently. */
    const card = said(CARD);
    assert.ok(/recorded no evidence/.test(card), "the card says absent evidence is absent");
    assert.ok(
      /could not be interpreted, so it is unknown rather than absent/.test(card),
      "and says unreadable evidence is unknown, not empty",
    );
  }

  /* ── 6 · PROPOSER ATTRIBUTION IS RENDERED, AND AGENT IS VISIBLY DIFFERENT ─
   * Today this always reads "human". The distinction is built now so the FIRST agent-originated
   * proposal is legible, rather than indistinguishable from a person's.
   */
  {
    const card = codeOf(read(CARD));
    /*
     * AGENT-PROPOSAL-2 BUILT THE SEAM THIS PIN SAID DID NOT EXIST.
     *
     * APP-2 banned the string `agentName` from this card and explained why: the class was all it
     * could honestly show, because "no identity display seam exists" to turn an actor id into a
     * name. That sentence is now false — `resolveAgentProposerDisplays` reads the released
     * AGENT-ID-0.1 authority server-side — and a green test asserting the old ban would be green
     * BECAUSE a stale claim survived.
     *
     * What APP-2 actually guaranteed, and what is asserted now, is STRICTER than the string ban:
     * the name may come only from the reader's projected field, the card falls back to the actor
     * CLASS rather than to an identifier, and no agent simulation is consulted to find a name.
     */
    /*
     * THE ID BAN IS ASSERTED FIRST, ON PURPOSE. A mutation that swaps the class fallback for the
     * raw id also changes the render expression, so a shape assertion placed above this one would
     * fire first and report a rendering defect rather than the LEAK it actually is.
     */
    assert.ok(
      !/proposedByActorId/.test(card),
      "the card never renders a raw actor id, not even as a fallback label",
    );
    const flat = card.replace(/\s+/g, " ");
    assert.ok(
      /proposed by \{item\.proposedByAgentName \?\? item\.proposedByActorType\}/.test(flat),
      "the card renders the proposer — the resolved name, falling back to the actor class",
    );
    assert.ok(
      /item\.proposedByActorType === "human"/.test(card),
      "and distinguishes human from every other actor class visually",
    );
    /* No name is invented for a class, and no agent subsystem is consulted to find one. */
    for (const banned of ["agent-runtime", "agent-crud", "@/features/agents", "agents/mock"]) {
      assert.ok(!codeOf(card).includes(banned), `the card must not reach "${banned}"`);
    }
    /*
     * AND IT NEVER CLAIMS THE ACT HAPPENED. A pending agent proposal sits beside an approve control;
     * wording that said Heby "will send" or "sent" would assert an authorization nobody granted.
     */
    for (const forbidden of ["will send", "has sent", "Heby sent", "executed by", "performed by"]) {
      assert.ok(!card.includes(forbidden), `the card must not say "${forbidden}"`);
    }
  }

  /* ── 7 · DIGESTS ARE LOCKS, AND THE BINDING IS UNTOUCHED ─────────────────
   * Presentation only. The permit binds a server-computed digest over the whole payload; how a card
   * renders one ingredient of that payload cannot loosen it.
   */
  {
    const projection = codeOf(read(PROJECTION));
    assert.ok(/DIGEST_KEY = \/Digest\$\//.test(projection), "digest keys are matched by suffix");
    assert.ok(
      !/recipientEndpointDigest|draftRevisionDigest/.test(projection),
      "and by CONVENTION, not by a per-action allow-list that the next action kind would escape",
    );
    /* The pure module stays pure: no I/O, no authority, no state. */
    for (const banned of ["@/db/", "drizzle-orm", "fetch(", "resolveGovernance", "async "]) {
      assert.ok(!projection.includes(banned), `the projection module must not reach "${banned}"`);
    }
    /* The card shows the meaning first; the raw values stay reachable, behind a disclosure. */
    const card = read(CARD);
    assert.ok(/item\.locks\.map/.test(card), "locks are rendered");
    assert.ok(/Show the integrity values/.test(card), "and the raw values remain inspectable");
    assert.ok(
      /Authorization binds/.test(said(CARD)) && /payloadDigest/.test(card),
      "the card explains what actually binds",
    );

    /* THE BINDING ITSELF. Read from the writer, not from this phase's own files. */
    const decide = read("src/features/action-authorization/decide-action-request.server.ts");
    assert.ok(
      /boundPayloadDigest: request\.payloadDigest/.test(decide),
      "a permit still binds the request's whole-payload digest",
    );
    for (const file of surfaceFiles()) {
      assert.ok(
        !/boundPayloadDigest|payloadDigest\s*=/.test(codeOf(read(file))),
        `${path.basename(file)} must not compute or assign a binding digest`,
      );
    }
  }

  /* ═══ PART TWO — LAYERING ════════════════════════════════════════════════ */

  /* ── 8 · COLLAPSING IS ALLOWED; ERASING IS NOT ───────────────────────────
   * The whole risk of this half of the phase. A disclosure whose summary said only "More detail"
   * would hide an unavailable subsystem behind a chevron, which is exactly the failure the discovery
   * rejected candidate E for.
   */
  {
    const workspace = read(WORKSPACE);
    assert.ok(/<details/.test(workspace), "structural material is collapsed");
    assert.ok(!/<details[^>]*\bopen\b/.test(workspace), "and starts closed");

    const summary = workspace.slice(workspace.indexOf("<summary"), workspace.indexOf("</summary>"));
    const flat = summary.replace(/\s+/g, " ");
    for (const absence of [
      "Not connected", "prepared review material", "standalone evidence instances",
      "recommendation producer", "chronological decision history", "Operations handoff",
      "no selectable item",
    ]) {
      assert.ok(flat.includes(absence), `the CLOSED summary still declares: "${absence}"`);
    }
  }

  /* ── 9 · THE DECISION ITSELF IS NEVER BEHIND A DISCLOSURE ────────────────
   * The one thing that may not be collapsed. Asserted positionally: the live slot is rendered before
   * the disclosure opens, so no edit can quietly move the act inside it.
   */
  {
    const workspace = read(WORKSPACE);
    const slot = workspace.indexOf("{actionAuthorizations}");
    const details = workspace.indexOf("<details");
    assert.ok(slot > 0 && details > slot, "the authorization slot renders BEFORE the disclosure");
    const card = read(CARD);
    const consequences = card.indexOf("item.consequences.map");
    const authorize = card.indexOf("Authorize this action");
    assert.ok(consequences > 0 && authorize > consequences, "consequences precede the control");

    /*
     * NOTHING REQUIRED MAY SIT INSIDE A DISCLOSURE — asserted by DELETING every `<details>` block
     * from the card and checking what survives.
     *
     * An earlier form of this test asked that no disclosure appear before the consequences, and it
     * failed against a correct card: the locks disclosure does precede them, and legitimately, since
     * it holds only raw integrity values that are explicitly not primary decision facts while their
     * MEANINGS render unhidden above it. Position was the wrong question. Containment is the right
     * one, and it is the property that actually matters.
     */
    const withoutDisclosures = card.replace(/<details[\s\S]*?<\/details>/g, "");
    for (const required of [
      "item.consequences.map", "Authorize this action", "Refuse",
      "item.proposedByActorType", "item.evidence.status", "item.locks.map",
      "Authorizing does not execute",
    ]) {
      assert.ok(
        withoutDisclosures.includes(required),
        `"${required}" must render outside every disclosure on the card`,
      );
    }
    /* And what IS disclosed is only the raw integrity values. */
    const disclosed = card.match(/<details[\s\S]*?<\/details>/g) ?? [];
    for (const block of disclosed) {
      assert.ok(
        !/Authorize this action|item\.consequences\.map|item\.evidence\.status/.test(block),
        "no disclosure on the card may contain a required decision fact",
      );
    }
  }

  /* ═══ PART THREE — WHAT APP-2 IS NOT ═════════════════════════════════════ */

  /* ── 10 · NO NEW AUTHORITY, NO SECOND STORE, NO WRITER ───────────────────── */
  {
    const reader = codeOf(read(READER));
    /* APP-1's pin, re-asserted: the reader resolves no authority. */
    assert.ok(!/resolveGovernanceAuthority\s*\(/.test(reader), "the reader resolves no authority");
    for (const banned of [
      ".insert(", ".update(", ".delete(", "transaction(", "recordActionRequest",
      "decideActionRequest", "executeAuthorizedAction", "@/features/knowledge",
      "heby-model", "fetch(",
    ]) {
      assert.ok(!reader.includes(banned), `the reader must not reach "${banned}"`);
    }
    /* The surface holds no store, no model and no provider of its own. */
    for (const file of surfaceFiles()) {
      const code = codeOf(read(file));
      for (const banned of [
        "@/db/", "drizzle-orm", "getControlPlaneDb", "@/features/knowledge",
        "heby-model", "recommendation-engine", "fetch(", "generateText",
      ]) {
        assert.ok(!code.includes(banned), `${path.basename(file)} must not reach "${banned}"`);
      }
    }
    /*
     * ONE SEAM, AND A PINNED CALLER CENSUS.
     *
     * An earlier form of this asserted the route was the ONLY caller, and it was simply wrong about
     * the repository: Command and Heby have read this same seam since CMD-B1, to say what is waiting
     * on the Director. That is the property APP-2 wants — three surfaces reading ONE seam rather than
     * three surfaces growing three stores — so the pin is the census, not a monopoly. A new caller
     * is not forbidden; an unnoticed one is.
     */
    const readers = walk("src")
      .filter((f) => f !== READER && /readPendingActionRequests\s*\(/.test(codeOf(read(f))))
      .sort();
    assert.deepEqual(
      readers,
      [
        "src/app/(dashboard)/approvals/page.tsx",
        "src/app/(dashboard)/command/page.tsx",
        "src/app/(dashboard)/heby/page.tsx",
      ],
      "the pending-request seam has exactly these three known readers",
    );
    assert.ok(readers.includes(ROUTE), "and the decision route is one of them");
  }

  /* ── 11 · NO RECOMMENDATION IS EVER GENERATED ────────────────────────────
   * The one region APP-2 deliberately did NOT touch: "no recommendation producer" is still true, so
   * rewording it would have been the defect this phase repairs, inverted.
   */
  {
    assert.ok(
      /No recommendation instance is connected, and none is generated/.test(said(EVIDENCE_REGION)),
      "the recommendation absence is still stated, because it is still true",
    );
    /*
     * AND THE ABSENCE CANNOT BE OUTFLANKED. A bite-proof that inserted "Hebun suggests you approve
     * this" SURVIVED an earlier form of this test: the denial sentence was still there, word for
     * word, with fabricated advice sitting in front of it. Keeping a true sentence is not the
     * guarantee — the guarantee is that no surface file gives the human a view on what to decide.
     */
    for (const file of surfaceFiles()) {
      const prose = said(file).toLowerCase();
      for (const advice of [
        "suggests you", "we recommend", "recommends approving", "recommends refusing",
        "you should approve", "you should refuse", "hebun advises", "recommended action",
      ]) {
        assert.ok(
          !prose.includes(advice),
          `${path.basename(file)} must not advise the human ("${advice}") — nothing here recommends`,
        );
      }
    }
  }

  /* ── 12 · HUMAN SUPREMACY, FROM APPLIED DDL ──────────────────────────────
   * Asked of the migration SQL, not the schema module: the constraints that matter are the ones the
   * database enforces. A future agent may propose; it may not approve or authorize.
   */
  {
    const dir = "src/db/migrations";
    const sql = readdirSync(path.join(ROOT, dir))
      .filter((f) => f.endsWith(".sql"))
      .map((f) => read(path.join(dir, f)))
      .join("\n");
    assert.ok(
      /action_permits_human_authorizer_chk[\s\S]{0,200}authorized_by_actor_type[\s\S]{0,40}=\s*'human'/.test(sql),
      "a permit's authorizer is constrained to human at the storage layer",
    );
    assert.ok(
      /heby_action_requests_human_approver_chk[\s\S]{0,240}approved_by_actor_type[\s\S]{0,80}'human'/.test(sql),
      "and an approval's approver is constrained to human",
    );
    /*
     * SCOPED TO THE TABLE IT WAS ALWAYS ABOUT (repaired by SIA-3).
     *
     * This read `!/proposed_by_actor_type[^;]{0,400}CHECK/`, over every migration concatenated —
     * a claim about a COLUMN NAME anywhere in the corpus, when the invariant it defends is about
     * ONE table: an agent may one day propose an ACTION, so `heby_action_requests` must not
     * constrain its proposer to human.
     *
     * SIA-3 added `agent_improvement_hypotheses`, which also has a `proposed_by_actor_type` — and
     * DOES constrain it to human, deliberately, because only a human may file a hypothesis about
     * an agent. That is a different table making a different claim, and it takes nothing away from
     * an agent's ability to propose an action.
     *
     * The repair is STRICTER, not weaker: it now names the exact qualified column, so a CHECK
     * added to `heby_action_requests.proposed_by_actor_type` fails here however it is worded —
     * whereas the old regex could be evaded by more than 400 characters of distance.
     */
    assert.ok(
      !/CHECK[^;]{0,600}"heby_action_requests"\."proposed_by_actor_type"/i.test(sql),
      "while the ACTION proposer column stays open, so a real agent may propose one day",
    );
    /*
     * And the exception is ENUMERATED rather than left as a hole: exactly one other table
     * constrains a proposer to human, it is SIA-3's, and it is named here so a THIRD one fails.
     */
    assert.deepEqual(
      [...sql.matchAll(/CONSTRAINT "([a-z0-9_]+)" CHECK \("([a-z0-9_]+)"\."proposed_by_actor_type"/g)].map(
        (m) => m[1]!,
      ),
      ["agent_improvement_hypotheses_human_author_chk"],
      "and exactly one table constrains a proposer to human — SIA-3's hypothesis author",
    );
  }

  /* ── 13 · DATA MINIMIZATION ──────────────────────────────────────────────
   * This view crosses into a client component, so every field on it is serialized to the browser.
   * The actor id is an internal identifier that nothing renders and no seam can turn into a name.
   */
  {
    const reader = codeOf(read(READER));
    /*
     * THE GUARANTEE IS THAT THE ID DOES NOT REACH THE BROWSER — not that the server never looks at
     * it. APP-2 spelled this as a substring ban because nothing on the server had any reason to
     * read the column; AGENT-PROPOSAL-2 gave it one, and resolves it into a NAME here. So the claim
     * is asserted where it actually lives: not on the view, and not in the projected row.
     */
    assert.ok(
      !/readonly proposedByActorId/.test(reader),
      "the proposer's raw actor id is not a field on the view that crosses to the client",
    );
    assert.ok(
      !/^\s*proposedByActorId\s*:/m.test(reader),
      "and it is not projected into the row the client receives",
    );
    for (const file of surfaceFiles()) {
      const code = codeOf(read(file));
      for (const withheld of ["tenantId", "proposedByActorId", "createdByType", "sessionContextId"]) {
        assert.ok(!code.includes(withheld), `${path.basename(file)} must not render "${withheld}"`);
      }
    }
  }

  /* ── 14 · NO NEW ROUTE, NO NEW WORKSPACE, NO NAV CHANGE ──────────────────── */
  {
    assert.equal(WORKSPACES.length, 7, "no eighth workspace appeared");
    assert.deepEqual(
      getWorkspace("operations").destinations.map((d) => d.label),
      ["Overview", "Execution", "Runtime & Signals", "Execution Substrate"],
      "the Operations L2 is untouched",
    );
    for (const file of [...surfaceFiles(), ROUTE]) {
      assert.ok(
        !/sidebar\.config|workspace-nav/.test(codeOf(read(file))),
        `${path.basename(file)} must not touch navigation`,
      );
    }
  }

  /* ── 15 · THE STRUCTURAL MODEL STAYED VOCABULARY ─────────────────────────
   * APP-1 retired two stale literals from it. APP-2 must not reintroduce a connection flag under a
   * new name, and must not make the model a reader.
   */
  {
    const model = read(MODEL);
    assert.ok(
      !/readonly\s+\w*[Cc]onnected\w*\s*:\s*(false|true)\b/.test(model),
      "no literal connection flag may be declared in the model",
    );
    assert.ok(!/await |async /.test(codeOf(model)), "the model reads nothing");
  }

  /* ── 16 · NO SCHEMA, NO MIGRATION ────────────────────────────────────────── */
  {
    const journal = JSON.parse(read("src/db/migrations/meta/_journal.json")) as {
      entries: readonly unknown[];
    };
    assert.equal(journal.entries.length, 44, "APP-2 adds no migration — the ledger carries none of its authoring"); /* GIA-1 grew the ledger 43 -> 44: the `record-work` mandate-scope CHECK. */
  }

  console.log("app2-decision-truth/decision-surface-firewall: OK");
}

main();
