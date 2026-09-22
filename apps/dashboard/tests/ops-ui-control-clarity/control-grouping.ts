/*
 * OPS-UI-CLARITY — the human control and the Hebun control are told apart by STRUCTURE.
 *
 * ── THE DEFECT THIS CLOSES ──────────────────────────────────────────────────
 *
 * A content-draft card offered two bare textareas in adjacent flat rows. They shared a border, a
 * background, a text size and a shape; the only thing distinguishing them was placeholder text,
 * which disappears the instant anyone types. On 2026-09-22 a CONTENT-GROUND-1 acceptance attempt
 * put a Hebun instruction into the manual box. It was stored verbatim as draft content, became the
 * current revision, and the released preparation path was never exercised at all.
 *
 * ── WHY THIS IS ASSERTED FROM SOURCE ────────────────────────────────────────
 *
 * The same style as the CGO-9 surface suite, for the same reason: these are structural facts about
 * the component tree, not behaviours of a running page. A renderer would prove the markup; what
 * failed here was that two sections were never sections, and that is visible in the source.
 *
 * NOTHING BELOW ASSERTS AUTHORITY. Grouping is presentation. Every seam, action, contract and
 * refusal this suite touches is unchanged, and the CGO-9 and CONTENT-GROUND-1 suites still own
 * them — this one only proves a human can see which hand writes.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (f: string): string => readFileSync(path.join(ROOT, f), "utf8");
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

const SECTION = "src/components/operations-preparation/prepared-work-section.tsx";
const HEBUN = "src/components/operations-preparation/prepare-with-hebun.tsx";

/** The source of ONE component's revision form, from its marker attribute to its closing tag. */
function formBody(file: string, marker: string): string {
  const code = codeOf(read(file));
  const start = code.indexOf(marker);
  assert.ok(start >= 0, `${file} still contains ${marker}`);
  const open = code.lastIndexOf("<form", start);
  const end = code.indexOf("</form>", start);
  assert.ok(open >= 0 && end > open, `${marker} sits inside a <form>`);
  return code.slice(open, end);
}

function theManualControlIsGroupedAndNamedAsHuman(): void {
  const manual = formBody(SECTION, 'data-manual-revision="section"');

  assert.ok(
    /<p className="text-xs font-medium text-fg-primary">Manual revision<\/p>/.test(manual),
    "the human control carries the heading 'Manual revision'",
  );
  assert.ok(
    manual.includes("authored by you, not by Hebun"),
    "its helper text says the revision is human-authored",
  );
  assert.ok(
    /<span className="block text-xs text-fg-secondary">Revision text<\/span>/.test(manual),
    "its textarea carries a visible label",
  );
  assert.ok(
    manual.includes('placeholder="Write the new revision text"'),
    "and the conceptual placeholder is kept",
  );
  assert.ok(manual.includes('"Save manual revision"'), "its action says what it saves and whose it is");

  /*
   * THE LOAD-BEARING ONE. The manual section must not name Hebun anywhere except in the sentence
   * that disclaims it, because the whole failure was a human reading this box as Hebun's.
   */
  const mentions = manual.match(/Hebun/g) ?? [];
  assert.equal(mentions.length, 1, "the manual section names Hebun exactly once, to disown it");
  assert.equal(
    manual.includes("useOwnContentGrounding") || manual.includes("voice reference"),
    false,
    "no grounding control lives in the manual section",
  );
  assert.equal(
    manual.includes("prepareWorkArtifactAction"),
    false,
    "the manual section calls only the human revision action",
  );
  assert.ok(manual.includes("reviseWorkArtifactAction"), "which is the released human revision action");
}

function theHebunControlIsItsOwnLabelledSection(): void {
  const hebun = formBody(HEBUN, 'data-hebun-preparation="revision"');

  /* A bordered section, not a row sharing a line with whatever preceded it. */
  assert.ok(
    /className="mt-3 space-y-2 rounded border border-border-subtle bg-surface-sunken px-3 py-3"/.test(hebun),
    "the Hebun control is a bordered, filled section of its own",
  );
  assert.ok(
    /<p className="text-xs font-medium text-fg-primary">Prepare with Hebun<\/p>/.test(hebun),
    "headed 'Prepare with Hebun'",
  );
  assert.ok(
    hebun.includes("writes a NEW revision") && hebun.includes("left byte-identical"),
    "its helper text says a new agent-authored revision is written and the current one is not overwritten",
  );
  assert.ok(
    hebun.includes("still awaits Governance review"),
    "and that Governance review is still owed",
  );

  assert.ok(
    /<span className="block text-xs text-fg-secondary">Instruction for Hebun<\/span>/.test(hebun),
    "THE INSTRUCTION FIELD IS LABELLED, and labelled as Hebun's",
  );
  assert.ok(
    hebun.includes('placeholder="What should Hebun change in a new revision?"'),
    "with the released placeholder unchanged",
  );
  assert.ok(hebun.includes('"Prepare revision with Hebun"'), "and the released action wording unchanged");
}

function theInstructionAndTheGroundingOptionAreBothInsideIt(): void {
  const hebun = formBody(HEBUN, 'data-hebun-preparation="revision"');

  assert.ok(hebun.includes("setInstruction(event.target.value)"), "the instruction field is inside the Hebun form");
  assert.ok(
    hebun.includes("setUseOwnContent(event.target.checked)"),
    "the grounding checkbox is inside the Hebun form",
  );
  assert.ok(
    hebun.includes("Use our own recent Instagram captions as a voice reference"),
    "with its released wording",
  );
  assert.ok(hebun.includes("GROUNDING_NON_CLAIMS[0]"), "and the non-claim rendered beside it");

  /* Neither may appear anywhere in the section file that hosts the manual control. */
  const section = codeOf(read(SECTION));
  for (const foreign of ["useOwnContentGrounding", "setUseOwnContent", "Instruction for Hebun"]) {
    assert.equal(section.includes(foreign), false, `the artifact card itself holds no "${foreign}"`);
  }
}

function theTwoFormsCannotBeConfusedBySTRUCTURE(): void {
  const section = codeOf(read(SECTION));
  const hebun = codeOf(read(HEBUN));

  /* Each form is addressable by a marker of its own, so no test and no reader has to guess. */
  assert.equal((section.match(/data-manual-revision="section"/g) ?? []).length, 1);
  assert.equal((hebun.match(/data-hebun-preparation="revision"/g) ?? []).length, 1);
  assert.equal(section.includes('data-hebun-preparation'), false, "the markers do not overlap");

  /* The placeholders are disjoint: neither box can be read as the other's. */
  const manual = formBody(SECTION, 'data-manual-revision="section"');
  const hebunForm = formBody(HEBUN, 'data-hebun-preparation="revision"');
  assert.equal(manual.includes("What should Hebun"), false);
  assert.equal(hebunForm.includes("Write the new revision text"), false);

  /*
   * NO FLAT ROW SURVIVES. `sm:flex-row` on either revision form is what put the two textareas on
   * adjacent lines of the same visual band; both are now vertical, labelled blocks.
   */
  assert.equal(manual.includes("sm:flex-row"), false, "the manual form is no longer a flat row");
  assert.equal(hebunForm.includes("sm:flex-row"), false, "nor is the Hebun form");
  assert.equal(hebunForm.includes("sm:basis-full"), false, "and nothing in it relies on row wrapping");
}

function theSubmittedCONTRACTSAreUnchanged(): void {
  const manual = formBody(SECTION, 'data-manual-revision="section"');
  assert.ok(
    /reviseWorkArtifactAction\(\{\s*artifactId: artifact\.id,\s*content: revisionText,\s*\}\)/.test(manual),
    "the manual form still submits { artifactId, content } and nothing more",
  );

  const hebun = formBody(HEBUN, 'data-hebun-preparation="revision"');
  for (const field of [
    "prompt: instruction,",
    'route: "/operations",',
    "artifactType: CONTENT_DRAFT_TYPE,",
    "title,",
    "artifactId,",
    "useOwnContentGrounding: useOwnContent,",
  ]) {
    assert.ok(hebun.includes(field), `the Hebun form still submits ${field}`);
  }
  /* CONTENT-GROUND-1's firewall, restated where the grouping could have quietly reopened it. */
  assert.equal(
    codeOf(read(HEBUN)).includes("observationSupplement"),
    false,
    "no grounding TEXT leaves the surface; the boolean is still the whole ask",
  );
}

function theStatusBLOCKStillReadsAtTheHeader(): void {
  const section = codeOf(read(SECTION));
  const header = section.slice(section.indexOf("<li className="), section.indexOf('data-manual-revision="section"'));

  for (const line of [
    "workArtifactAuthorLabel(artifact.currentRevisionAuthoredByActorType)",
    "Governance review of revision {artifact.currentRevision}",
    "CONTENT_DESTINATION_LABELS[artifact.intendedDestination]",
    "<ReferenceChip reference={artifact.currentRef} />",
  ]) {
    assert.ok(header.includes(line), `authorship/destination/status stay above the controls: ${line}`);
  }
  /* History and Retire are preserved, and still above both revision controls. */
  for (const label of ["History", "Retire"]) {
    assert.ok(
      new RegExp(`>\\s*${label}\\s*</button>`).test(header),
      `${label} is preserved above the controls`,
    );
  }

  /* OPS-P1's withheld set is untouched: no internal identifier became dominant UI. */
  for (const withheld of ["artifact.id}</", "contentDigest", "authoredByActorId", "sourceMessageId", "tenantId"]) {
    assert.equal(section.includes(withheld), false, `the card still withholds "${withheld}"`);
  }
}

function theSemANTICSStayValid(): void {
  for (const [file, marker] of [
    [SECTION, 'data-manual-revision="section"'],
    [HEBUN, 'data-hebun-preparation="revision"'],
  ] as const) {
    const body = formBody(file, marker);
    /*
     * ACCESSIBILITY: every control this change touched is WRAPPED by its <label>, which associates
     * them without an id and cannot drift the way a htmlFor/id pair can.
     */
    const labelled = body.match(/<label[^>]*>[\s\S]*?<\/label>/g) ?? [];
    assert.ok(labelled.length >= 1, `${marker} labels its controls`);
    for (const group of labelled) {
      assert.ok(
        /<textarea|<input/.test(group),
        `${marker}: every label wraps the control it names`,
      );
    }
    /* RESPONSIVE: vertical stacks with real spacing, so narrow and wide read the same order. */
    assert.ok(body.includes("space-y-2"), `${marker} stacks its children with spacing`);
    assert.ok(/className="w-full /.test(body), `${marker}'s field spans the section at every width`);
  }
}

theManualControlIsGroupedAndNamedAsHuman();
theHebunControlIsItsOwnLabelledSection();
theInstructionAndTheGroundingOptionAreBothInsideIt();
theTwoFormsCannotBeConfusedBySTRUCTURE();
theSubmittedCONTRACTSAreUnchanged();
theStatusBLOCKStillReadsAtTheHeader();
theSemANTICSStayValid();
console.log("PASS ops-ui-control-clarity control grouping");
