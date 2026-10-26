/*
 * EAI-SYSTEM-COPY-INTO-CONVERSATION-1 — bite-proofs. Each mutation re-adds one way system data can
 * reach the instruction; the contract's checker must refuse every one. In memory only: no source is
 * written, so this runs anywhere.
 *
 *   B1 the released CONTENT-AGENT-2 copy handler, verbatim
 *   B2 the released HEBY-WORKFLOW-1 copy button, verbatim
 *   B3 the instruction initialised from the reason
 *   B4 an effect that fills the instruction from a read
 *   B5 the prompt built from the justification at submit
 *   B6 the work title copied in
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { systemCopyViolations } from "../helpers/system-copy";

const read = (f: string) => readFileSync(path.join(process.cwd(), f), "utf8");
const CA2 = read("src/components/operations-preparation/prepare-with-hebun.tsx");
const HW1 = read("src/components/layout/heby/heby-work-draft-affordance.tsx");

const ANCHOR_CA2 = 'onClick={() => setFromReview({ revisionNo: reason.revisionNo, decisionId: reason.decisionId })}';
const ANCHOR_HW1 = '<p className="text-fg-muted">Write your own instruction below; the reason is not sent to the agent.</p>';
assert.ok(CA2.includes(ANCHOR_CA2) && HW1.includes(ANCHOR_HW1), "the mutation anchors exist");

const mutations: readonly { readonly label: string; readonly source: string }[] = [
  {
    label: "B1",
    source: CA2.replace(
      ANCHOR_CA2,
      "onClick={() => {\n setInstruction(reason.justification);\n setFromReview({ revisionNo: reason.revisionNo, decisionId: reason.decisionId });\n }}",
    ),
  },
  {
    label: "B2",
    source: HW1.replace(ANCHOR_HW1, '<button type="button" onClick={() => setInstruction(basis.justification)}>Use this reason as my instruction</button>'),
  },
  { label: "B3", source: HW1.replace('const [instruction, setInstruction] = useState("");', "const [instruction, setInstruction] = useState(basis?.justification ?? \"\");") },
  { label: "B4", source: CA2.replace(ANCHOR_CA2, `${ANCHOR_CA2}\n{void useEffect(() => { if (reason?.status === "requested") setInstruction(reason.justification ?? ""); })}`) },
  { label: "B5", source: HW1.replace("prompt: instruction,", "prompt: `${instruction}\\n${basis.justification}`,") },
  { label: "B6", source: CA2.replace(ANCHOR_CA2, `onClick={() => setInstruction(title)}`) },
];

for (const { label, source } of mutations) {
  assert.ok(source !== CA2 && source !== HW1, `${label}: the mutation applied`);
  assert.ok(systemCopyViolations(source).length > 0, `${label}: the checker catches the re-added copy`);
}

console.log(`PASS eai-system-copy-1 bite-proofs (${mutations.length} bit)`);
