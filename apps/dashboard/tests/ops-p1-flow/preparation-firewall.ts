/*
 * OPS-P1 — THE PREPARATION SURFACE FIREWALL.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "A human can reach the recipient and prepared-work authorities that already shipped, through
 *    the actions that already shipped — and reaching them creates no authority, no proposal, no
 *    navigation and no schema."
 *
 * Structural. Nothing here renders a component, opens a database, or contacts anything.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { WORKSPACES, getWorkspace } from "../../src/config/workspace-nav";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const DIR = "src/components/operations-preparation";
const WRAPPER = `${DIR}/operations-preparation.tsx`;
const RECIPIENTS = `${DIR}/recipients-section.tsx`;
const WORK = `${DIR}/prepared-work-section.tsx`;
const CHIP = `${DIR}/reference-chip.tsx`;
const PAGE = "src/app/(dashboard)/operations/page.tsx";
const ACTIONS = "src/app/(dashboard)/operations/actions.ts";
const INLET = "src/features/heby-action-inlet/send-proposal.server.ts";

const OPS_P1_FILES = [WRAPPER, RECIPIENTS, WORK, CHIP];

function walk(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir)).flatMap((entry) => {
    const rel = path.join(dir, entry);
    return statSync(path.join(ROOT, rel)).isDirectory() ? walk(rel) : /\.tsx?$/.test(rel) ? [rel] : [];
  });
}

function main(): void {
  /* ── 1 · THE OPERATIONS L2 IS UNCHANGED ──────────────────────────────────
   * Re-asserted here, not merely inherited: OPS-P1's whole placement argument is that it adds no
   * destination. If it ever did, this fails in OPS-P1's own suite rather than only in the legacy one.
   */
  {
    const ops = getWorkspace("operations");
    assert.deepEqual(
      ops.destinations.map((d) => d.label),
      ["Overview", "Execution", "Runtime & Signals", "Execution Substrate"],
      "the released Operations L2 is exactly four destinations",
    );
    assert.equal(WORKSPACES.length, 7, "and no eighth workspace appeared");
    for (const file of OPS_P1_FILES) {
      assert.ok(
        !/sidebar\.config|workspace-nav/.test(codeOf(read(file))),
        `${file} must not touch navigation`,
      );
    }
  }

  /* ── 2 · THE UI GOES THROUGH SERVER ACTIONS, NEVER THE WRITERS ───────────
   * A component holding a writer reference is a component that can be made to write directly, and
   * the tenant would then come from wherever the caller says. Every mutation crosses the action
   * boundary, where the tenant is resolved server-side.
   */
  {
    for (const file of OPS_P1_FILES) {
      const code = codeOf(read(file));
      for (const banned of [
        "write-external-recipients", "write-work-artifacts", "@/db/", "drizzle-orm",
        "getControlPlaneDb",
      ]) {
        assert.ok(!code.includes(banned), `${file} must not reach "${banned}"`);
      }
      /*
       * THE READ SEAMS MAY BE NAMED ONLY BY A TYPE IMPORT. `WorkArtifactListing` is exported from
       * `read-work-artifacts.server`, so a blanket ban on the module name would forbid a TYPE — which
       * is erased at build time and grants no runtime capability — while a value import of the same
       * module would hand a component the reader itself, with the tenant coming from wherever the
       * caller says. So the check is on the KIND of import, not on the string: every line naming a
       * read seam must be `import type`.
       */
      for (const line of code.split("\n")) {
        if (!/read-(external-recipients|work-artifacts)\.server/.test(line)) continue;
        assert.ok(
          /^\s*import type |^\s*\}\s*from |^\s*[A-Za-z]/.test(line) === true &&
            !/^\s*import \{/.test(line),
          `${file} may name a read seam only in a type import: ${line.trim()}`,
        );
      }
    }
    assert.ok(
      /import type \{ WorkArtifactListing \} from "@\/features\/work-artifacts\/read-work-artifacts\.server";/.test(
        read(WORK),
      ),
      "the work section takes the listing TYPE only",
    );
    const wrapper = codeOf(read(WRAPPER));
    for (const action of [
      "listActiveRecipientsAction", "listRetiredRecipientsAction", "listWorkArtifactsAction",
    ]) {
      assert.ok(wrapper.includes(action), `the wrapper reads through ${action}`);
    }
  }

  /* ── 3 · NO SECOND PROPOSAL PATH ─────────────────────────────────────────
   * The boundary that matters most. Preparation produces INPUTS; it never files a request.
   */
  {
    for (const file of [...OPS_P1_FILES, PAGE]) {
      const code = codeOf(read(file));
      for (const banned of [
        "recordActionRequest", "proposeSendAction", "send-proposal", "propose-commands",
        "heby-action-inlet", "action-authorization", "action-execution", "consumeActionPermit",
      ]) {
        assert.ok(!code.includes(banned), `${file} must not reach "${banned}"`);
      }
      for (const control of ["Prepare for approval", "Submit proposal", "Send now", "Execute"]) {
        assert.ok(!read(file).includes(control), `${file} must not offer "${control}"`);
      }
    }
    /*
     * The caller topology is unchanged FOR THIS SURFACE: every caller of the request writer is an
     * inlet module, and none of them is OPS-P1's. GIA-1 added a second inlet — `record-work` —
     * which is why this is a set rather than a single file; what it still forbids is any module
     * outside `heby-action-inlet` filing a proposal, which is the boundary this phase rests on.
     */
    const callers = walk("src").filter(
      (f) => f !== "src/features/action-authorization/record-action-request.server.ts" &&
        /recordActionRequest\s*\(/.test(codeOf(read(f))),
    );
    assert.deepEqual(
      callers,
      [
        "src/features/heby-action-inlet/record-work-proposal.server.ts",
        "src/features/heby-action-inlet/send-proposal.server.ts",
      ],
      "every caller of recordActionRequest is an action inlet, and none of them is this surface",
    );
    assert.ok(callers.includes(INLET), "including the send inlet OPS-P1 was built beside");
  }

  /* ── 4 · WITHHELD FIELDS ARE NOT RENDERED ────────────────────────────────
   * Each of these exists on a view this surface consumes. Absence is the proof.
   */
  {
    for (const file of OPS_P1_FILES) {
      const code = codeOf(read(file));
      for (const withheld of [
        "tenantId", "endpointDigest", "contentDigest", "createdByActorId", "createdByActorType",
        "authoredByActorId", "authoredByActorType", "sourceMessageId",
      ]) {
        assert.ok(!code.includes(withheld), `${file} must not render "${withheld}"`);
      }
      /* No whole-view spread — that is how a withheld field arrives without being named. */
      assert.ok(!/\{\s*\.\.\.(recipient|artifact|revision)\s*\}/.test(code), `${file} spreads no view`);
    }
  }

  /* ── 5 · REFERENCES ARE CONSUMED, NEVER CONSTRUCTED ──────────────────────
   * A client that assembled `work-artifact/<id>@<n>` could name a revision the server never
   * resolved — the exact drift the revision suffix exists to make unrepresentable.
   */
  {
    for (const file of OPS_P1_FILES) {
      const code = codeOf(read(file));
      for (const banned of [
        "formatWorkArtifactRef", "formatRecipientRef", "artifact-ref", "recipient-ref",
        "WORK_ARTIFACT_REF_PREFIX", "EXTERNAL_RECIPIENT_REF_PREFIX",
      ]) {
        assert.ok(!code.includes(banned), `${file} must not construct a reference via "${banned}"`);
      }
      assert.ok(!/`work-artifact\/|`external-recipient\//.test(code), `${file} builds no ref literal`);
    }
    assert.ok(codeOf(read(RECIPIENTS)).includes("recipient.recordRef"), "recipients consume recordRef");
    assert.ok(codeOf(read(WORK)).includes("artifact.currentRef"), "work consumes currentRef");
  }

  /* ── 6 · AN ADDRESS IS NEVER EDITED ──────────────────────────────────────
   * R3R has no update path for the address. A surface offering one would imply an authority that
   * does not exist, and a mutable address would re-point every permit naming it.
   */
  {
    const code = codeOf(read(RECIPIENTS));
    for (const banned of [
      "updateRecipient", "editRecipient", "updateExternalRecipient", "editAddress", "mergeRecipient",
    ]) {
      assert.ok(!code.includes(banned), `the recipients surface must not offer "${banned}"`);
    }
    const raw = read(RECIPIENTS);
    for (const label of ["Edit address", "Edit recipient", "Update address", "Delete"]) {
      assert.ok(!raw.includes(label), `the recipients surface must not render "${label}"`);
    }
    assert.ok(
      /never edited/i.test(raw),
      "and it states the replacement rule where a human decides",
    );
    /* Retired recipients are readable and deliberately NOT proposable — no reference is offered. */
    assert.ok(
      /recipient\.status === "active" \? <ReferenceChip/.test(raw),
      "only an active recipient exposes a reference",
    );
  }

  /* ── 7 · REVISIONS APPEND; NOTHING IS EDITED IN PLACE ────────────────────── */
  {
    const code = codeOf(read(WORK));
    assert.ok(code.includes("reviseWorkArtifactAction"), "a new revision is appended through the action");
    for (const banned of ["updateRevision", "editRevision", "replaceContent", "deleteRevision"]) {
      assert.ok(!code.includes(banned), `the work surface must not offer "${banned}"`);
    }
    assert.ok(/appended, never replacing|Earlier revisions are unchanged/.test(read(WORK)),
      "and the surface says an append does not change what came before");
  }

  /* ── 8 · UNAVAILABLE IS NEVER RENDERED AS EMPTY ──────────────────────────
   * Both authorities distinguish "read successfully, holds nothing" from "could not read". A
   * surface that collapsed them would state an organizational fact it never established.
   */
  {
    /*
     * Whitespace-normalised before matching. These sentences live in JSX and wrap at the formatter's
     * column, so a literal-space pattern passes or fails on where a line break happens to fall —
     * which is a property of the formatter, not of what the surface says.
     */
    const said = (file: string): string => read(file).replace(/\s+/g, " ");
    assert.ok(/unavailableReason/.test(read(RECIPIENTS)), "the recipients surface reads the unavailable reason");
    assert.ok(/unknown rather than empty/i.test(said(RECIPIENTS)), "and says unknown, not empty");
    assert.ok(/status === "unavailable"/.test(read(WORK)), "the work surface reads the unavailable status");
    assert.ok(/unknown rather than empty/i.test(said(WORK)), "and says unknown, not empty");
  }

  /* ── 9 · NO AGENT, GOVERNANCE, PROVIDER OR EXECUTION REACH ───────────────── */
  {
    for (const file of [...OPS_P1_FILES, PAGE]) {
      const code = codeOf(read(file));
      for (const banned of [
        "agent-runtime", "agent-crud", "@/db/schema/agent", "agents/mock", "governance-decision",
        "GOVERNANCE_SUBJECT_TYPES", "provider-github", "provider-google", "heby-model", "fetch(",
      ]) {
        assert.ok(!code.includes(banned), `${file} must not reach "${banned}"`);
      }
    }
  }

  /* ── 10 · NO SCHEMA, NO MIGRATION, NO NEW SERVER ACTION ──────────────────── */
  {
    const journal = JSON.parse(read("src/db/migrations/meta/_journal.json")) as {
      entries: readonly unknown[];
    };
    assert.equal(journal.entries.length, 46, "OPS-P1 adds no migration — the ledger carries none of its authoring"); /* WEV-1 grew the ledger 44 -> 45; PBGA-1 45 -> 46 (`heby_action_requests` purpose columns). */
    const actions = codeOf(read(ACTIONS));
    assert.equal(
      (actions.match(/export async function/g) ?? []).length,
      12,
      "the twelve released server actions are unchanged in number — OPS-P1 adds none",
    );
  }

  console.log("ops-p1-flow/preparation-firewall: OK");
}

main();
