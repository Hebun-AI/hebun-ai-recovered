/*
 * TRH-19 — WHAT THE RATIONALE IS NOT ALLOWED TO BECOME.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "One rationale, one owner, one writer, one parse. The human entry points have no parameter for
 *    it, no second rationale authority was created, no raw provider output became durable, the
 *    digest input set is unchanged, no UPDATE writer can reach the column, and Governance
 *    justification is untouched."
 *
 * Pure. Reads released source, released contracts and the migration ledger. No database, no
 * provider, no network.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { MAX_ORIGINATION_REASON_LENGTH } from "../../src/features/agent-origination/contracts";

const ROOT = process.cwd();
const read = (f: string): string => readFileSync(path.join(ROOT, f), "utf8");

const WRITER = "src/features/action-authorization/record-action-request.server.ts";
const SCHEMA = "src/db/schema/action-authorization.ts";
const ORIGINATION = "src/features/agent-origination/originate-action.server.ts";
const PARSER = "src/features/agent-origination/structured-output.ts";
const RECORD_WORK_INLET = "src/features/heby-action-inlet/record-work-proposal.server.ts";
const SEND_INLET = "src/features/heby-action-inlet/send-proposal.server.ts";
const READ_SEAM = "src/features/action-authorization/read-action-authorizations.server.ts";
const SURFACE = "src/components/decision-workspace/action-authorizations.tsx";
const DECIDE = "src/features/action-authorization/decide-action-request.server.ts";
const DECLARE_PURPOSE = "src/features/action-authorization/declare-action-purpose.server.ts";
const PROVENANCE = "src/features/agent-origination/invocation-provenance.server.ts";
const CANONICAL = "src/features/action-authorization/canonical-payload.ts";
const MIGRATIONS = "src/db/migrations";

/** Source with block comments and comment lines removed, so a claim in prose proves nothing. */
function codeOf(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("*") && !line.trim().startsWith("//"))
    .join("\n");
}

function main(): void {
  /* ═══════════════════════════════════════════════════════════════════════
   * 1. ONE PARSE, ONE VALUE, ONE OWNER.
   *
   * The rationale that is filed must be the one the released parser admitted. A second validator,
   * a regeneration, a summarizer or a fallback string would each be a second authority on what the
   * agent said — and the record would no longer be the agent's words.
   * ═════════════════════════════════════════════════════════════════════ */
  {
    const origination = codeOf(read(ORIGINATION));
    assert.equal(
      (origination.match(/chosen\.reason/g) ?? []).length,
      3,
      "the selection's reason is used exactly three times: two filings and the returned result",
    );
    for (const banned of ["summariz", "rationaleFrom", "buildRationale", "defaultRationale"]) {
      assert.ok(!origination.includes(banned), `the origination contains no ${banned}`);
    }
    /* The raw response is not retained past the generator seam. */
    assert.ok(
      !origination.includes("proposalRationale: text") && !origination.includes("rationale: text"),
      "THE RAW MODEL TEXT IS NEVER WHAT IS FILED — only the parsed selection's reason is",
    );

    const writer = codeOf(read(WRITER));
    assert.ok(
      !writer.includes("MAX_ORIGINATION_REASON_LENGTH") && !writer.includes("trim("),
      "the writer does not re-validate or repair the rationale — the parser is its only bound",
    );
    assert.ok(
      MAX_ORIGINATION_REASON_LENGTH > 0 && codeOf(read(PARSER)).includes("MAX_ORIGINATION_REASON_LENGTH"),
      "and that bound still lives in the parser, where the value is admitted",
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * 2. THE HUMAN PATH HAS NO PARAMETER FOR IT.
   *
   * The firewall is the SHAPE OF THE CALL, exactly as PBGA-1 made the agent path unable to declare
   * a purpose. A human cannot say "Heby said this because…" by supplying a field, because no field
   * exists to supply.
   * ═════════════════════════════════════════════════════════════════════ */
  {
    const writer = read(WRITER);
    const humanEntry = writer.slice(
      writer.indexOf("export function recordActionRequest("),
      writer.indexOf("export async function recordAgentOriginatedActionRequest("),
    );
    assert.ok(humanEntry.length > 0, "the human entry point is still where this test reads it");
    assert.ok(
      !humanEntry.includes("proposalRationale"),
      "THE HUMAN WRITER ENTRY POINT HAS NO RATIONALE PARAMETER",
    );

    /* And the value is gated on the RESOLVED pair, not on the argument being absent. */
    assert.ok(
      codeOf(writer).includes('proposer.actorType === "agent" ? (proposalRationale ?? null) : null'),
      "the insert writes a rationale only for an agent-resolved proposer",
    );

    for (const inlet of [RECORD_WORK_INLET, SEND_INLET]) {
      const source = read(inlet);
      const humanFn =
        inlet === RECORD_WORK_INLET
          ? "export function proposeRecordWorkAction("
          : "export function proposeSendAction(";
      const start = source.indexOf(humanFn);
      assert.ok(start > 0, `${inlet} still exposes its human entry point`);
      const body = source.slice(start, source.indexOf("}", source.indexOf("return", start)) + 1);
      assert.ok(
        !body.includes("proposalRationale"),
        `${inlet}'s HUMAN entry point has no rationale parameter`,
      );
      assert.ok(
        source.includes("proposalRationale?: string,"),
        `${inlet}'s AGENT entry point threads it`,
      );
    }

    /*
     * NO CLIENT-CROSSING INPUT CARRIES IT. The inlet input types are what a caller supplies; the
     * rationale is a positional server-side value, so it can never arrive from a browser.
     */
    const inletContracts = read("src/features/heby-action-inlet/contracts.ts");
    assert.ok(
      !inletContracts.includes("proposalRationale") && !inletContracts.includes("rationale"),
      "no proposal INPUT type gained a rationale field — it is not client-suppliable",
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * 3. IT IS NOT PART OF THE ACT.
   *
   * The digest input set is `{actionKind, toolId, targetKind, targetRef, payload}`. If a rationale
   * ever appeared in it, approving a proposal would bind a human's authorization to model prose.
   * ═════════════════════════════════════════════════════════════════════ */
  {
    const canonical = read(CANONICAL);
    assert.ok(
      !canonical.includes("rationale"),
      "the canonical payload module knows nothing about a rationale",
    );
    assert.ok(
      canonical.includes("or free model prose is"),
      "and its released claim about model prose is still standing, unweakened",
    );

    const writer = codeOf(read(WRITER));
    const digestCall = writer.slice(
      writer.indexOf("const payloadDigest = digestCanonicalAction({"),
      writer.indexOf("});", writer.indexOf("const payloadDigest = digestCanonicalAction({")),
    );
    assert.ok(digestCall.length > 0, "the digest call is still where this test reads it");
    assert.ok(
      !digestCall.includes("proposalRationale"),
      "THE DIGEST INPUT SET DOES NOT INCLUDE THE RATIONALE",
    );

    /* And it is not smuggled in through the payload either. */
    const insertBlock = writer.slice(writer.indexOf(".values({"), writer.indexOf(".returning("));
    assert.ok(
      insertBlock.includes("canonicalPayload: payload"),
      "the payload written is the prepared payload and nothing else",
    );
    assert.ok(
      !insertBlock.includes("...payload") && !insertBlock.includes("rationale, ...")  ,
      "nothing is spread into the payload on the way to storage",
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * 4. IMMUTABLE BY CONSTRUCTION — every UPDATE writer inspected.
   * ═════════════════════════════════════════════════════════════════════ */
  {
    const mutators = readdirSync(path.join(ROOT, "src/features/action-authorization"))
      .filter((f) => f.endsWith(".ts"))
      .filter((f) => codeOf(read(`src/features/action-authorization/${f}`)).includes("update(hebyActionRequests)"));
    assert.deepEqual(
      mutators.sort(),
      ["decide-action-request.server.ts", "declare-action-purpose.server.ts"],
      "the set of UPDATE writers on the proposal table is unchanged by this phase",
    );
    for (const file of [DECIDE, DECLARE_PURPOSE]) {
      assert.ok(
        !codeOf(read(file)).includes("proposalRationale"),
        `${file} cannot write a rationale — no later-rationale seam exists`,
      );
    }
    /* Exactly one INSERT, and it is the one that writes the rationale. */
    const inserters = readdirSync(path.join(ROOT, "src/features/action-authorization"))
      .filter((f) => f.endsWith(".ts"))
      .filter((f) => codeOf(read(`src/features/action-authorization/${f}`)).includes("insert(hebyActionRequests)"));
    assert.deepEqual(inserters, ["record-action-request.server.ts"], "one writer, one place");
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * 5. GOVERNANCE IS UNTOUCHED.
   *
   * RATIONALE != AUTHORIZATION. This is the load-bearing separation: an agent's explanation must
   * never become, seed or prefill the human's justification for deciding.
   * ═════════════════════════════════════════════════════════════════════ */
  {
    for (const file of [DECIDE, "src/app/(dashboard)/approvals/actions.ts"]) {
      const source = codeOf(read(file));
      assert.ok(
        !source.includes("proposalRationale"),
        `${file} never reads the agent's rationale`,
      );
    }
    const decide = read(DECIDE);
    assert.ok(
      decide.includes("justification"),
      "the Governance justification is still supplied on the decision path",
    );
    /* No decision predicate consults it. */
    const surface = read(SURFACE);
    assert.ok(
      !/defaultValue=\{[^}]*proposalRationale/.test(codeOf(surface)) &&
        !/value=\{[^}]*proposalRationale/.test(codeOf(surface)),
      "THE RATIONALE DOES NOT PREFILL OR POPULATE ANY INPUT — it is displayed, never proposed as an answer",
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * 6. NO SECOND RATIONALE AUTHORITY. No raw provider output became durable.
   * ═════════════════════════════════════════════════════════════════════ */
  {
    const provenance = read(PROVENANCE);
    assert.ok(
      !codeOf(provenance).includes("rationale"),
      "the invocation provenance authority did NOT also start holding a rationale — one truth, one owner",
    );
    assert.ok(
      provenance.includes("NO PROMPT, NO RESPONSE, NO SECRET"),
      "and its released no-response rule is unweakened",
    );

    const schema = read(SCHEMA);
    assert.equal(
      (schema.match(/text\("proposal_rationale"\)/g) ?? []).length,
      1,
      "exactly ONE column holds this truth",
    );
    assert.ok(
      !schema.includes("record_work_rationale") && !schema.includes("send_rationale"),
      "and it is action-kind-independent — no per-kind rationale column exists",
    );
    assert.ok(
      !schema.includes('index("heby_action_requests_proposal_rationale'),
      "NO INDEX was added — nothing queries by a rationale",
    );
    assert.ok(
      schema.includes("heby_action_requests_agent_rationale_chk") &&
        schema.includes("heby_action_requests_proposal_rationale_chk"),
      "both storage rules are declared in the schema this repository reads",
    );
    assert.ok(
      !/char_length\([^)]*proposalRationale[^)]*\)\s*<=/.test(schema),
      "and NO maximum-length CHECK duplicates the parser's bound in SQL",
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * 7. THE MIGRATION IS ADDITIVE, AND THE LEDGER MOVED BY EXACTLY ONE.
   * ═════════════════════════════════════════════════════════════════════ */
  {
    const files = readdirSync(path.join(ROOT, MIGRATIONS)).filter((f) => f.endsWith(".sql")).sort();
    /*
     * "TRH-19 authored migration 49" is a FACT ABOUT HISTORY and stays true forever. The COUNT is
     * a live measurement and moves whenever any later phase authors one, so the two are stated
     * separately rather than folded into a sentence that would become false the first time the
     * ledger grew.
     */
    assert.ok(
      files.some((f) => f.includes("trh19_agent_proposal_rationale")),
      "TRH-19 authored migration 49, and it is still on disk",
    );
    assert.equal(files.length, 50, "the ledger is at 50 — 48 at TRH-18, +1 for TRH-19, +1 for TRH-21");
    const journal = JSON.parse(read(`${MIGRATIONS}/meta/_journal.json`)) as {
      entries: readonly { tag: string }[];
    };
    assert.equal(journal.entries.length, 50, "and the journal agrees with the files");
    /*
     * IT IS IN THE JOURNAL — which is what TRH-19 owns. Being LAST was only ever true until the
     * next phase authored one, and pinning it there would make every later migration fail a test
     * about a released phase that did nothing wrong.
     */
    assert.ok(
      journal.entries.some((entry) => entry.tag.includes("trh19_agent_proposal_rationale")),
      "TRH-19's migration is in the journal",
    );
    assert.equal(
      journal.entries.at(-1)!.tag,
      "20260907124912_trh21_provider_observation_history",
      "and TRH-21 holds the newest line — TRH-19 held it before",
    );

    /* TRH-19's OWN sql, found by name — not "the newest file", which is now another phase's. */
    const sql = read(`${MIGRATIONS}/${files.find((f) => f.includes("trh19_agent_proposal_rationale"))}`);
    assert.ok(sql.includes('ADD COLUMN "proposal_rationale" text'), "one nullable text column");
    assert.ok(!/\bNOT NULL\b/i.test(sql), "nullable — every historical row stays valid, unbackfilled");
    for (const destructive of ["DROP ", "ALTER COLUMN", "UPDATE ", "DELETE ", "CREATE INDEX"]) {
      assert.ok(!sql.includes(destructive), `the migration is additive only — it contains no ${destructive.trim()}`);
    }
    assert.ok(sql.includes("heby_action_requests_agent_rationale_chk"), "with the agent-only rule");
    assert.ok(sql.includes("heby_action_requests_proposal_rationale_chk"), "and the non-blank rule");
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * 8. THE SURFACE SAYS UNAVAILABLE, NEVER "NO REASON GIVEN".
   * ═════════════════════════════════════════════════════════════════════ */
  {
    const surface = read(SURFACE);
    /* Comments are stripped: what a component RENDERS is what a Director reads. */
    const rendered = codeOf(surface);
    assert.ok(
      rendered.includes("Proposal rationale unavailable"),
      "a null rationale renders as UNAVAILABLE",
    );
    for (const forbidden of ["No reason", "no rationale given", "Heby did not explain"]) {
      assert.ok(
        !rendered.includes(forbidden),
        `the surface never claims "${forbidden}" — the record cannot support it`,
      );
    }
    /*
     * "gave no reason" IS present, and it must be — the caption DENIES that reading beside the
     * unavailable state, which is the repository's rule that a denial belongs adjacent to the fact
     * it corrects. So the assertion is not that the phrase is absent; it is that every occurrence
     * of it is negated. An affirmative one would slip past a bare-substring ban either way.
     */
    for (const at of [...rendered.matchAll(/gave no reason/g)].map((m) => m.index ?? 0)) {
      assert.ok(
        rendered.slice(Math.max(0, at - 60), at).includes("not that the agent"),
        "every mention of the agent giving no reason is a DENIAL, never a claim",
      );
    }
    assert.ok(
      rendered.includes("not that the agent gave no reason"),
      "and the denial is actually on the surface, adjacent to the unavailable state",
    );
    assert.ok(
      rendered.includes('item.proposedByActorType === "agent" ?'),
      "and the block renders only for an agent proposal, so a human one shows no empty slot",
    );
    assert.ok(
      !rendered.includes("dangerouslySetInnerHTML"),
      "MODEL-AUTHORED TEXT IS ESCAPED, NEVER INTERPRETED",
    );
    assert.ok(
      !/<(input|textarea)[^>]*proposalRationale/.test(rendered),
      "and it is not editable",
    );

    /* The read seam exposes the admitted value and nothing adjacent to it. */
    const seam = codeOf(read(READ_SEAM));
    assert.ok(
      seam.includes("proposalRationale: row.proposalRationale"),
      "the seam returns the stored value, unsubstituted",
    );
    for (const leak of ["providerRequestId", "systemInstructions", "userPrompt", "rawResponse"]) {
      assert.ok(!seam.includes(leak), `the pending view carries no ${leak}`);
    }
  }

  console.log("PASS trh19-agent-proposal-rationale firewall");
}

main();
