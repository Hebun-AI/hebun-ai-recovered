/*
 * RA-PREP-1 — the research preparation seam's boundaries, read from the source. Pure: no database, no
 * model, no network.
 *
 *   F1 research-report write authority: the research writer is imported by the research seam alone, and
 *      its input has no type field — the type is the writer's constant
 *   F2 every reviser refuses a research report, from the type read under the artifact lock
 *   F3 the seam reaches only these authorities; it reaches no proposal, permit, decision, execution,
 *      evidence-link, provider-transport or web-search module
 *   F4 the purpose: the seam's input names none; it is the capability's declaration; only this seam sets
 *      the gateway's purpose option, which admits research alone and grounds research on nothing
 *   F5 order: every authority is asked before the model
 *   F6 no route, action or component reaches the seam — nothing in production can call it yet
 *   F7 unsourced: the brief forbids citations and links; the label and the classification say so;
 *      the capability declares only the question as input
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { agentWorkCapability } from "../../src/features/agent-work/capabilities";
import { RESEARCH_REPORT_PREPARATION_BRIEF } from "../../src/features/agent-work/assign-research-report.server";
import { RESEARCH_REPORT_SOURCING } from "../../src/features/work-artifacts/contracts";
import { ARTIFACT_TYPE_LABELS } from "../../src/components/layout/heby/heby-work-draft-affordance";

const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const files = (dir: string): string[] =>
  readdirSync(path.join(ROOT, dir)).flatMap((entry) => {
    const rel = path.join(dir, entry);
    return statSync(path.join(ROOT, rel)).isDirectory() ? files(rel) : /\.(ts|tsx)$/.test(entry) ? [rel] : [];
  });
const SRC = files("src");
const naming = (needle: RegExp) => SRC.filter((f) => needle.test(read(f))).sort();

const SEAM = "src/features/agent-work/assign-research-report.server.ts";
const WRITER = "src/features/work-artifacts/write-work-artifacts.server.ts";
const seam = read(SEAM);
const writer = read(WRITER);

/* ── F1 ── */
assert.deepEqual(naming(/import \{[^}]*\bcreateResearchReportFromResearchPreparation\b[^}]*\} from/), [SEAM], "F1: only the research seam imports the research writer");
assert.deepEqual(naming(/(?<!function )createResearchReportFromResearchPreparation\(/), [SEAM], "F1: and only it calls it");
const researchInput = writer.match(/export interface CreateResearchReportInput \{([\s\S]*?)\}/)?.[1] ?? "";
assert.ok(researchInput && !/artifactType/.test(researchInput), "F1: the research writer's input carries no type");
assert.match(writer, /artifactType: RESEARCH_REPORT_ARTIFACT_TYPE \},[\s\S]{0,120}validateResearchReportInput,/, "F1: the writer fixes the type and chooses its own validator");
assert.match(writer, /validate: typeof validateWorkArtifactInput = validateWorkArtifactInput,/, "F1: every other entry point meets the general validator");

/* ── F2 ── */
assert.match(writer, /artifactType: workArtifacts\.artifactType,\s*\}\)\s*\.from\(workArtifacts\)[\s\S]*?\.for\("update"\)/, "F2: the type is read under the artifact lock");
assert.match(writer, /if \(!isWorkArtifactType\(artifact\.artifactType\)\) return refused\("artifact-type-not-revisable"\);/, "F2: and a research report takes no revision");

/* ── F3 ── */
const imports = [...seam.matchAll(/from "([^"]+)"/g)].map((m) => m[1]).sort();
assert.deepEqual(
  imports,
  [
    "./assign-work-draft.server",
    "./capabilities",
    "@/features/agent-identity/read-durable-agent-identity.server",
    "@/features/agent-mandate/read-agent-mandate.server",
    "@/features/auth/tenant/tenant-context",
    "@/features/external-ai-data-use/authorize-external-ai-disclosure.server",
    "@/features/governance-decision/authority-read.server",
    "@/features/heby-answer/model-answer.server",
    "@/features/heby-model/model-connectivity-environment.server",
    "@/features/heby-provider-ops/provider-connectivity-control.server",
    "@/features/heby-runtime/contracts",
    "@/features/heby-runtime/instruction-channel",
    "@/features/work-artifacts/agent-authorship.server",
    "@/features/work-artifacts/prepare-work-artifact.server",
    "@/features/work-artifacts/write-work-artifacts.server",
  ],
  "F3: the seam reaches only these authorities (a new reach is a deliberate edit here)",
);
assert.doesNotMatch(
  seam,
  /heby-action-inlet|action-authorization\/decide|governed-machine-execution|standing-mutation|organizational-work\/write-work|declareWorkEvidenceReference|heby-model-live|claude-http-transport|web_search|webSearch|fetch\(/,
  "F3: no proposal, decision, execution, evidence link, transport or web search",
);

/* ── F4 ── */
const inputShape = seam.match(/export interface AssignResearchReportInput \{([\s\S]*?)\}/)?.[1] ?? "";
assert.deepEqual([...inputShape.matchAll(/readonly (\w+)/g)].map((m) => m[1]), ["workItemId", "agentId", "question", "title"], "F4: ids and words only — no purpose, tenant or class");
assert.match(seam, /const declared = CAPABILITY\.dataUse;\s*if \(declared\.purpose !== "research"\) throw/, "F4: the purpose is the capability's, and a non-research declaration is a broken contract");
assert.match(seam, /purpose: DATA_USE\.purpose, dataClasses: DATA_USE\.dataClasses/, "F4: the preflight declares exactly the capability's purpose and classes");
assert.match(seam, /dataUsePurpose: DATA_USE\.purpose,/, "F4: and so does the model request");
assert.deepEqual(naming(/dataUsePurpose:/), [SEAM], "F4: only the research seam sets the gateway's purpose option");
const answer = read("src/features/heby-answer/model-answer.server.ts");
assert.match(answer, /readonly dataUsePurpose\?: "research";/, "F4: the option admits research alone");
assert.match(answer, /resolveSources\(options\.dataUsePurpose === "research" \? \[\] : workspaceSourceClasses\(context\), overview\)/, "F4: research grounds on nothing");
assert.match(seam, /\{ prompt: question, route: `\/\$\{WORK_ARTIFACT_OWNER_WORKSPACE\}` \}/, "F4: the question alone — no earlier conversation is carried");

/* ── F5 ── */
const at = (needle: string) => {
  const i = seam.indexOf(needle);
  assert.ok(i > 0, `F5: ${needle} is present`);
  return i;
};
const model = at("(deps.answer ?? answerHebyModelRequest)(");
for (const step of ["readTarget(tenant", "resolveGovernanceAuthority)(tenant)", "eligibleAgents(tenant, workScope, deps, CAPABILITY)", "resolveAgentAuthorship(tenant", "resolveClaudeDirectorEnabled)()", "authorizeExternalAiDisclosure(d, o, m)"]) {
  assert.ok(at(step) < model, `F5: ${step} is asked before the model`);
}
assert.ok(at("refuseOutsideAgentWorkCapability(CAPABILITY, mandate, workScope)") > model, "F5: the capability is asked again after the model");
assert.ok(at("LINK.test(content)") < at("createResearchReportFromResearchPreparation("), "F5: a linked reply is refused before filing");

/* ── F6 ── */
assert.deepEqual(
  SRC.filter((f) => /from "[^"]*assign-research-report[^"]*"/.test(read(f))),
  [],
  "F6: no route, server action or component reaches the research seam",
);

/* ── F7 ── */
assert.equal(RESEARCH_REPORT_SOURCING, "UNSOURCED RESEARCH DRAFT");
assert.equal(ARTIFACT_TYPE_LABELS["research-report"], "Unsourced research draft", "F7: the label says what it is");
const brief = RESEARCH_REPORT_PREPARATION_BRIEF.join(" ");
assert.match(brief, /UNSOURCED RESEARCH DRAFT/);
assert.match(brief, /Do not cite sources/);
assert.match(brief, /any link or web address/);
assert.match(brief, /no source was searched or read/);
const capability = agentWorkCapability("prepare-research-report");
assert.deepEqual([...capability.input], ["your research question, in your words"], "F7: the question is the only input");
assert.ok(capability.cannot.some((line) => /search the web/.test(line) && /unsourced/.test(line)), "F7: says it cannot search or cite");
assert.equal(capability.sideEffect, "PREPARATION_ONLY");
assert.equal(capability.authorizationRequired, false);

console.log("ra-prep-1/research-firewall: F1–F7 PASS");
