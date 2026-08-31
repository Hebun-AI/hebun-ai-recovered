/*
 * SELF-IMPROVING-AGENTS-3.1 — FILING IS A TRANSPORT, NOT AN AUTHORITY.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "An authenticated human can now reach SIA-3's released authorities through exactly two server
 *    actions — one that files, one that decides — and neither of them became an authority. The
 *    filing seam holds no gate, writes no row of its own, cannot decide, cannot approve, cannot
 *    apply, cannot mutate an agent, and cannot be told the tenant, the author or the evidence. The
 *    decision seam holds no filing capability. No third route reaches either."
 *
 * The pins this phase adds to SIA-3's:
 *
 *   PREPARED   ≠ FILED
 *   FILED      ≠ APPROVED
 *   APPROVED   ≠ AUTHORIZED APPLICATION
 *   AUTHORIZED ≠ APPLIED
 *   APPLIED    ≠ IMPROVED
 *   TRANSPORT  ≠ AUTHORITY
 *
 * Structural assertions run over comment-stripped source, so this phase's own honest prose about
 * what it refuses to do can neither satisfy nor trip a check about what it does — the R6D lesson.
 * Pure: no database, no network, no model.
 */
import "../../src/db/schema";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { performsDurableWrite, codeOf } from "../helpers/durable-write-detector";
import {
  EVIDENCE_FINDING_KEYS,
  IMPROVEMENT_HYPOTHESIS_SUBJECT_TYPE,
  IMPROVEMENT_TARGETS,
} from "../../src/features/agent-improvement-hypothesis/contracts";
import {
  FILING_MAX_CANDIDATE_CHANGE,
  FILING_MAX_EXPECTED_EFFECT,
  FILING_MAX_LIMITATIONS,
  FILING_MIN_PROSE,
  HYPOTHESIS_DECISION_REFUSAL_TEXT,
  HYPOTHESIS_DECISION_WORDING,
  HYPOTHESIS_FILING_REFUSAL_TEXT,
  HYPOTHESIS_FILING_WORDING,
} from "../../src/features/agent-improvement-hypothesis/filing-wording";
import {
  MAX_CANDIDATE_CHANGE_CHARACTERS,
  MAX_EXPECTED_EFFECT_CHARACTERS,
  MAX_LIMITATIONS_CHARACTERS,
  MIN_PROSE_CHARACTERS,
} from "../../src/features/agent-improvement-hypothesis/write-improvement-hypothesis.server";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");

const FEATURE = "src/features/agent-improvement-hypothesis";
const WRITER = `${FEATURE}/write-improvement-hypothesis.server.ts`;
const DECIDER = `${FEATURE}/decide-improvement-hypothesis.server.ts`;
const WORDING = `${FEATURE}/filing-wording.ts`;

/** The two transports, and nothing else. */
const FILING_ACTION = "src/app/(dashboard)/agents/actions.ts";
const DECISION_ACTION = "src/app/(dashboard)/governance/authority/actions.ts";

/** The two controls SIA-3.1 adds. The SIA-3 READ surface is deliberately not among them. */
const FILING_CONTROL = "src/components/agents/agent-improvement-hypothesis-filing.tsx";
const DECISION_CONTROL = "src/components/governance-authority/undecided-hypothesis-card.tsx";
const SIA3_READ_SURFACE = "src/components/agents/agent-improvement-hypothesis.tsx";

const AGENTS_PAGE = "src/app/(dashboard)/agents/page.tsx";
const GOVERNANCE_PAGE = "src/app/(dashboard)/governance/authority/page.tsx";

const MIGRATIONS = "src/db/migrations";

function collect(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    return e.isDirectory() ? collect(rel) : /\.tsx?$/.test(e.name) ? [rel] : [];
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. THE TRANSPORT IS TRANSPORT.
 *
 * It calls an authority and returns what the authority said. It holds no gate of its own, so it
 * cannot drift from the rules it fronts — and it writes nothing, so SIA-3's "exactly one writer"
 * census is untouched by its existence.
 * ═════════════════════════════════════════════════════════════════════════ */
function theTransportHoldsNoAuthority(): void {
  for (const action of [FILING_ACTION, DECISION_ACTION]) {
    const source = read(action);
    const code = codeOf(source);

    assert.ok(
      !performsDurableWrite(source),
      `${action} performs no durable write — the authority it calls does`,
    );
    assert.ok(
      !/\.\s*(?:insert|update|delete)\s*\(/.test(code),
      `${action} contains no INSERT, UPDATE or DELETE of its own`,
    );

    /*
     * NO DATABASE HANDLE. A transport that could open a connection could eventually query around
     * the authority it is supposed to be fronting.
     */
    for (const forbidden of ["db/client.server", "drizzle-orm", "db/schema"]) {
      assert.ok(
        !code.includes(forbidden),
        `${action} does not import ${forbidden} — it has no way to reach the database directly`,
      );
    }

    /*
     * THE TENANT COMES FROM THE SESSION AND FROM NOWHERE ELSE. `resolveTenantContext` is the one
     * producer; a transport that could mint or accept a context could impersonate an organization.
     */
    assert.ok(
      code.includes("resolveTenantContext"),
      `${action} resolves the tenant from the authenticated session`,
    );
    assert.ok(
      !code.includes("asHumanTenantContext"),
      `${action} cannot mint a tenant context — only the session runtime may`,
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. WHAT THE CLIENT MAY SAY, AND WHAT IT HAS NO WORDS FOR.
 *
 * The strongest property of this phase, and it is a property of the TYPES rather than of a check:
 * there is no parameter through which a tenant, an author, an evidence count, an instant or a
 * Governance outcome could be supplied. Fabrication is unrepresentable, not rejected.
 * ═════════════════════════════════════════════════════════════════════════ */
function theClientCannotSayWhatItMustNotSay(): void {
  const filing = codeOf(read(FILING_ACTION));
  const inputBlock = filing.slice(
    filing.indexOf("export async function fileImprovementHypothesisAction"),
    filing.indexOf("const tenant = await resolveTenantContext();", filing.indexOf("fileImprovementHypothesisAction")),
  );
  assert.ok(inputBlock.length > 0, "the filing action's input block was located");

  /*
   * ── THE NAMED BAN RUNS FIRST, AND THE CENSUS SECOND ───────────────────────
   *
   * Both catch a forged field; only the named one SAYS WHICH. Running the exhaustive census first
   * made every one of these defects report the same generic sentence, so a reader (and a
   * bite-proof) could not tell a smuggled `tenantId` from a smuggled evidence count. The census
   * stays, immediately after, because it is the guard that catches a field nobody thought to ban.
   */

  /* Each of these would be an authority the client does not hold. None has a parameter. */
  const FORBIDDEN_FIELDS = [
    "tenantId",
    "userId",
    "actorId",
    "proposedBy",
    "proposedByActorId",
    "proposedByActorType",
    "createdBy",
    "updatedBy",
    "evidenceObservedValue",
    "evidenceObservedTotal",
    "evidenceObservedAt",
    "evidenceSource",
    "filedAt",
    "decisionId",
    "outcome",
    "accepted",
    "authority",
    "bootstrap",
    "version",
    "lifecycleStatus",
  ];
  for (const forbidden of FORBIDDEN_FIELDS) {
    assert.ok(
      !new RegExp(`readonly\\s+${forbidden}\\s*[?]?\\s*:`).test(inputBlock),
      `the filing action has no \`${forbidden}\` parameter — it is server-derived, so a forged one is unrepresentable`,
    );
  }

  /*
   * ENUMERATED, NOT SAMPLED. The exact set of client-supplied fields, so a field nobody thought to
   * ban still fails here rather than arriving unnoticed.
   */
  const fields = [...inputBlock.matchAll(/readonly\s+([A-Za-z][A-Za-z0-9]*)\s*[?]?\s*:/g)].map(
    (m) => m[1]!,
  );
  assert.deepEqual(
    [...fields].sort(),
    [
      "agentId",
      "candidateChange",
      "evidenceFindingKey",
      "expectedEffect",
      "improvementTarget",
      "limitations",
      "supersedesHypothesisId",
    ],
    "the client supplies a subject, two closed vocabulary keys, three pieces of prose and an optional predecessor — and nothing else",
  );

  /* And the decision action takes exactly which, which way, and why. */
  const decision = codeOf(read(DECISION_ACTION));
  const decisionBlock = decision.slice(
    decision.indexOf("export async function decideImprovementHypothesisAction"),
    decision.indexOf(
      "const tenant = await resolveTenantContext();",
      decision.indexOf("decideImprovementHypothesisAction"),
    ),
  );
  assert.ok(decisionBlock.length > 0, "the decision action's input block was located");
  const decisionFields = [...decisionBlock.matchAll(/^\s*([A-Za-z][A-Za-z0-9]*)\s*:/gm)].map(
    (m) => m[1]!,
  );
  assert.deepEqual(
    [...decisionFields].sort(),
    ["decision", "hypothesisId", "justification"],
    "the decision action takes which hypothesis, which way, and a justification — nothing else",
  );
  for (const forbidden of ["tenantId", "actorId", "outcome", "decisionId", "sessionId", "authority"]) {
    assert.ok(
      !new RegExp(`\\b${forbidden}\\s*:`).test(decisionBlock),
      `the decision action has no \`${forbidden}\` parameter`,
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. FILING CANNOT DECIDE, AND DECIDING CANNOT FILE.
 *
 * The separation is the whole reason the two actions live on two surfaces. A single route holding
 * both would put an author one click from accepting their own argument.
 * ═════════════════════════════════════════════════════════════════════════ */
function theTwoActsStayApart(): void {
  const filing = codeOf(read(FILING_ACTION));
  const decision = codeOf(read(DECISION_ACTION));

  assert.ok(
    !filing.includes("decideImprovementHypothesis"),
    "the filing seam cannot decide — the decider is not reachable from it",
  );
  assert.ok(
    !decision.includes("fileImprovementHypothesis"),
    "the decision seam cannot file — the writer is not reachable from it",
  );

  /*
   * AND THE FILING SEAM REACHES NO GOVERNANCE MODULE AT ALL. Filing writes no `decision_records`
   * row, so a filed hypothesis is UNDECIDED — which is a legitimate resting state, not a defect.
   */
  for (const forbidden of [
    "governance-decision",
    "governance-audit",
    "writeGovernanceDecisionWithin",
    "resolveGovernanceAuthority",
    "recordGovernanceDecision",
  ]) {
    assert.ok(
      !filing.includes(forbidden),
      `the filing seam does not reach ${forbidden} — filing asks, it does not answer`,
    );
  }

  /* The same census SIA-3 holds, re-run here so this phase owns its own copy of the claim. */
  const routes = collect("src/app");
  assert.deepEqual(
    routes.filter((r) => codeOf(read(r)).includes("fileImprovementHypothesis")).sort(),
    [FILING_ACTION],
    "exactly one route can file a hypothesis",
  );
  assert.deepEqual(
    routes.filter((r) => codeOf(read(r)).includes("decideImprovementHypothesis")).sort(),
    [DECISION_ACTION],
    "exactly one route can decide a hypothesis",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. NOTHING SIA-3.1 ADDS CAN MUTATE AN AGENT, EXECUTE, OR MINT A PERMIT.
 *
 * A census over everything this phase authored, so the claim is about the phase rather than about
 * the files a reviewer happened to look at.
 * ═════════════════════════════════════════════════════════════════════════ */
function nothingThisPhaseAddedCanAct(): void {
  /*
   * SCOPED TO WHAT THIS PHASE OWNS OUTRIGHT, AND THEN TO THE FUNCTION BODY.
   *
   * The two action files are SHARED with earlier phases: `agents/actions.ts` has held
   * AGENT-ID-0.1's identity ceremony since that release, and `governance/authority/actions.ts` is
   * the G2 boundary for six subsystems. A whole-file import ban over either would be FALSE — it
   * would forbid a released capability on the grounds that a later phase moved in next door, and
   * the first version of this test failed exactly that way.
   *
   * So the ban runs over the three files SIA-3.1 authored end to end, and the shared files are
   * checked on the BODY of the action this phase added — the R6D lesson, that an assertion scoped
   * to a module hits imports it was never about.
   */
  const PHASE_FILES = [FILING_CONTROL, DECISION_CONTROL, WORDING];

  const FORBIDDEN_IMPORTS = [
    "action-execution",
    "action-authorization",
    "agent-crud",
    "create-durable-agent-identity",
    "retire-durable-agent-identity",
    "provider",
    "credential",
    "memory",
    "learning",
    "telemetry",
    "knowledge",
  ];
  for (const file of PHASE_FILES) {
    const code = codeOf(read(file));
    const imports = [...code.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);
    for (const forbidden of FORBIDDEN_IMPORTS) {
      assert.ok(
        !imports.some((i) => i.includes(forbidden)),
        `${file} does not import ${forbidden} — that capability is unreachable, not merely unused`,
      );
    }
  }

  /*
   * AND NO MUTABLE AGENT COLUMN IS REFERENCED ANYWHERE IN THIS PHASE. Reading a prompt is how a
   * feature starts to have an opinion about one, so the ban covers a READ as well as a write.
   */
  const MUTABLE_AGENT_COLUMNS = [
    "systemPrompt",
    "prompt",
    "preferredModel",
    "model",
    "tools",
    "toolPermissions",
    "permissions",
    "policy",
    "autonomyLevel",
    "temperature",
    "configuration",
  ];
  for (const file of PHASE_FILES) {
    const code = codeOf(read(file));
    for (const column of MUTABLE_AGENT_COLUMNS) {
      assert.ok(
        !new RegExp(`\\bagents\\s*\\.\\s*${column}\\b`).test(code),
        `${file} never references \`agents.${column}\``,
      );
    }
  }

  /* No execution verb has a representation in this phase. */
  const EXECUTION_VERBS = [
    "executeAuthorizedAction",
    "mintPermit",
    "issuePermit",
    "applyHypothesis",
    "applyImprovement",
    "updateAgent",
    "mutateAgent",
  ];
  for (const file of PHASE_FILES) {
    const code = codeOf(read(file));
    for (const verb of EXECUTION_VERBS) {
      assert.ok(!code.includes(verb), `${file} contains no \`${verb}\``);
    }
  }

  /*
   * ── THE SHARED ACTION FILES, CHECKED ON THIS PHASE'S OWN FUNCTION BODY ────
   *
   * Each SIA-3.1 action must reach exactly ONE authority and nothing else. Sliced from the
   * function's opening to its closing brace at column zero, so a neighbouring released action
   * cannot satisfy the check and cannot trip it.
   */
  /*
   * DELIMITED BY THE NEXT TOP-LEVEL `export`, NOT BY THE FIRST `\n}`.
   *
   * The first attempt used `\n}` and produced an EMPTY body every time, because these actions
   * declare their input as an inline object type — so the first `}` at column zero closes the
   * PARAMETER, several lines before the function body starts. An empty slice makes every
   * assertion over it vacuously true, which is the failure mode this repository keeps meeting: a
   * check that cannot fail is not a check. It failed loudly here only because one assertion was
   * written as a positive `deepEqual` against a non-empty list.
   */
  const bodyOf = (file: string, fn: string): string => {
    const code = codeOf(read(file));
    const start = code.indexOf(`export async function ${fn}`);
    assert.ok(start >= 0, `${fn} exists in ${file}`);
    const next = code.indexOf("\nexport ", start + 1);
    const body = code.slice(start, next === -1 ? code.length : next);
    assert.ok(body.includes("await"), `${fn}'s body in ${file} was delimited and is non-empty`);
    return body;
  };

  const filingBody = bodyOf(FILING_ACTION, "fileImprovementHypothesisAction");
  const decisionBody = bodyOf(DECISION_ACTION, "decideImprovementHypothesisAction");

  for (const [label, body, permitted] of [
    ["the filing action", filingBody, "fileImprovementHypothesis"],
    ["the decision action", decisionBody, "decideImprovementHypothesis"],
  ] as const) {
    /* Exactly one authority call, and it is the expected one. */
    const authorityCalls = [...body.matchAll(/await\s+([A-Za-z][A-Za-z0-9]*)\s*\(/g)]
      .map((m) => m[1]!)
      .filter((name) => name !== "resolveTenantContext");
    assert.deepEqual(
      authorityCalls,
      [permitted],
      `${label} calls exactly one authority, and it is ${permitted}`,
    );

    /* And it never reaches for a capability of its own. */
    for (const verb of [...EXECUTION_VERBS, "createDurableAgentIdentity", "retireDurableAgentIdentity"]) {
      assert.ok(!body.includes(verb), `${label} contains no \`${verb}\``);
    }
    assert.ok(
      !/\.\s*(?:insert|update|delete)\s*\(/.test(body),
      `${label} writes nothing of its own`,
    );
    assert.ok(
      body.includes("resolveTenantContext"),
      `${label} takes its tenant from the authenticated session`,
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. THE SIA-3 READ SURFACE IS UNCHANGED, AND STILL OFFERS NOTHING.
 *
 * SIA-3.1 deliberately did NOT amend it. Its released proof — a server component with no client
 * boundary and nothing imported that could mutate — is worth more intact than a single file would
 * have been, so the write control is a separate component and this re-asserts the old claim.
 * ═════════════════════════════════════════════════════════════════════════ */
function theReadSurfaceStayedARead(): void {
  const code = codeOf(read(SIA3_READ_SURFACE));
  assert.ok(!code.includes('"use client"'), "the SIA-3 read surface is still a server component");
  for (const control of ["<button", "<form", "<input", "onClick", "onSubmit", "useState", "action="]) {
    assert.ok(!code.includes(control), `the SIA-3 read surface still renders no ${control}`);
  }
  for (const forbidden of [
    "fileImprovementHypothesis",
    "decideImprovementHypothesis",
    "agent-improvement-hypothesis-filing",
  ]) {
    assert.ok(!code.includes(forbidden), `the SIA-3 read surface still cannot reach ${forbidden}`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6. NEITHER NEW CONTROL OFFERS TO APPLY ANYTHING.
 *
 * The ban SIA-3 held over its read surface, extended to the two surfaces where such a control
 * would look most natural — the one that files a change proposal, and the one that accepts it.
 * ═════════════════════════════════════════════════════════════════════════ */
function noControlOffersToApply(): void {
  for (const control of [FILING_CONTROL, DECISION_CONTROL]) {
    const source = read(control);

    /* No affordance is worded as carrying the change out. */
    for (const verb of ["Apply", "Retry", "Tune", "Retrain", "Enable", "Disable", "Execute", "Run"]) {
      assert.ok(
        !new RegExp(`>\\s*${verb}\\b`).test(source),
        `${control} offers no '${verb}' affordance`,
      );
    }

    /*
     * AND NO CONTROL LABEL CLAIMS AN IMPROVEMENT HAPPENED. Asserted against the wording contract's
     * VALUES, because that is what a reader actually sees.
     */
    assert.ok(
      !/\bhas been improved\b|\bagent improved\b|\bwas applied\b|\bnow applies\b/i.test(source),
      `${control} never states that an agent was improved or a change applied`,
    );
  }

  /* The filing control says, before its button, that filing changes no agent. */
  const filing = codeOf(read(FILING_CONTROL));
  assert.ok(
    filing.includes("filingIsNotImproving"),
    "the filing control renders the sentence that separates filing from improving",
  );
  assert.ok(
    filing.includes("filingIsNotApproving"),
    "and the sentence that separates filing from approval",
  );
  assert.ok(
    filing.includes("preparedIsNotFiled"),
    "and the sentence that separates a live projection from a stored record",
  );

  /* The decision control says, before its buttons, that accepting applies nothing. */
  const deciding = codeOf(read(DECISION_CONTROL));
  assert.ok(
    deciding.includes("acceptingIsNotApplying"),
    "the decision control renders the sentence that separates acceptance from application",
  );
  assert.ok(
    deciding.includes("decisionIsFinal"),
    "and the sentence that says a hypothesis is decided once",
  );

  /* The accept control is not worded "Approve", which is the word a reader completes as "so it was done". */
  assert.ok(
    !/^Approve/.test(HYPOTHESIS_DECISION_WORDING.acceptControl),
    "the accept control is not worded 'Approve'",
  );
  assert.ok(
    /pursu/i.test(HYPOTHESIS_DECISION_WORDING.acceptControl),
    "it says what acceptance actually means — that this is worth pursuing",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 7. THE WORDING IS HONEST, AND ITS BOUNDS ARE PINNED TO THE AUTHORITY'S.
 *
 * A client-side bound that drifts from the server's is a form that promises a length the writer
 * will refuse. The two are pinned to each other so widening either alone fails — the repair SIA-3's
 * own bite-proof taught, applied here before the defect could exist.
 * ═════════════════════════════════════════════════════════════════════════ */
function theWordingIsHonest(): void {
  assert.equal(FILING_MAX_CANDIDATE_CHANGE, MAX_CANDIDATE_CHANGE_CHARACTERS, "candidate-change bound");
  assert.equal(FILING_MAX_EXPECTED_EFFECT, MAX_EXPECTED_EFFECT_CHARACTERS, "expected-effect bound");
  assert.equal(FILING_MAX_LIMITATIONS, MAX_LIMITATIONS_CHARACTERS, "limitations bound");
  assert.equal(FILING_MIN_PROSE, MIN_PROSE_CHARACTERS, "minimum prose bound");

  /*
   * EVERY REFUSAL THE AUTHORITY CAN PRODUCE HAS A SENTENCE. A refusal a reader cannot distinguish
   * from a silent success is the defect this repository has repaired repeatedly, so the map is
   * asserted EXHAUSTIVE against the authority's own union — read from its source, so adding a
   * refusal without adding its sentence fails here.
   */
  const writerSource = read(WRITER);
  const filingUnion = writerSource.slice(
    writerSource.indexOf("export type HypothesisRefusal ="),
    writerSource.indexOf("export type HypothesisResult"),
  );
  const filingReasons = [...filingUnion.matchAll(/\|\s*"([a-z-]+)"/g)].map((m) => m[1]!);
  assert.ok(filingReasons.length >= 10, "the filing refusal union was parsed");
  for (const reason of filingReasons) {
    assert.ok(
      typeof HYPOTHESIS_FILING_REFUSAL_TEXT[reason] === "string",
      `the filing refusal '${reason}' has a sentence a reader can act on`,
    );
  }
  assert.deepEqual(
    Object.keys(HYPOTHESIS_FILING_REFUSAL_TEXT).sort(),
    [...filingReasons].sort(),
    "and the map explains exactly the refusals that exist — no more, no fewer",
  );

  const deciderSource = read(DECIDER);
  const decisionUnion = deciderSource.slice(
    deciderSource.indexOf("export type HypothesisDecisionRefusal ="),
    deciderSource.indexOf("export type HypothesisDecisionResult"),
  );
  const decisionReasons = [...decisionUnion.matchAll(/\|?\s*"([a-z-]+)"/g)]
    .map((m) => m[1]!)
    .filter((r) => r !== "approve" && r !== "reject");
  assert.ok(decisionReasons.length >= 8, "the decision refusal union was parsed");
  assert.deepEqual(
    Object.keys(HYPOTHESIS_DECISION_REFUSAL_TEXT).sort(),
    [...new Set(decisionReasons)].sort(),
    "the decision refusal map explains exactly the refusals that exist",
  );

  /*
   * EVERY REFUSAL SENTENCE SAYS WHAT DID NOT HAPPEN. "Nothing was written" / "nothing was
   * recorded" — because a refusal that only names a cause leaves the reader to guess whether a
   * partial write occurred.
   */
  for (const [reason, sentence] of Object.entries(HYPOTHESIS_FILING_REFUSAL_TEXT)) {
    assert.ok(
      /nothing was written/i.test(sentence) || /this is not a statement/i.test(sentence),
      `the filing refusal '${reason}' states that nothing was written`,
    );
  }
  for (const [reason, sentence] of Object.entries(HYPOTHESIS_DECISION_REFUSAL_TEXT)) {
    assert.ok(
      /nothing was recorded/i.test(sentence) || /no decision can be recorded/i.test(sentence),
      `the decision refusal '${reason}' states that nothing was recorded`,
    );
  }

  /*
   * THE DUPLICATE POLICY IS STATED, NOT LEFT TO BE DISCOVERED. Filing twice writes two
   * hypotheses; that is deliberate, and a reader is told so before they click.
   */
  assert.ok(
    /two filings are two hypotheses/i.test(HYPOTHESIS_FILING_WORDING.filingTwiceWritesTwo),
    "the surface states that filing twice writes two records",
  );
  assert.ok(
    /not withdrawn|withdraws nothing|records lineage only/i.test(
      HYPOTHESIS_FILING_WORDING.supersedingWithdrawsNothing,
    ),
    "and that naming a predecessor withdraws nothing",
  );

  /* The confirmation lists consequences, and one of them is the absence of a decision. */
  assert.ok(
    HYPOTHESIS_FILING_WORDING.confirmationConsequences.length >= 4,
    "the confirmation states several consequences before the click",
  );
  assert.ok(
    HYPOTHESIS_FILING_WORDING.confirmationConsequences.some((line) =>
      /undecided is not rejected/i.test(line),
    ),
    "and it says that the hypothesis begins undecided, which is not rejected",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 8. THE PAGES OFFER THE CONTROLS ONLY WHERE THEY WOULD BE HONEST.
 * ═════════════════════════════════════════════════════════════════════════ */
function thePagesGateTheControls(): void {
  const agents = codeOf(read(AGENTS_PAGE));
  assert.ok(
    agents.includes("AgentImprovementHypothesisFiling"),
    "the Agents page renders the filing control",
  );
  assert.ok(
    !agents.includes("UndecidedHypothesisCard") && !agents.includes("decideImprovementHypothesis"),
    "and the Agents page offers no way to decide — /agents files, Governance decides",
  );

  const governance = codeOf(read(GOVERNANCE_PAGE));
  assert.ok(
    governance.includes("UndecidedHypothesisCard"),
    "the Governance Authority page renders the decision control",
  );
  assert.ok(
    !governance.includes("AgentImprovementHypothesisFiling") &&
      !governance.includes("fileImprovementHypothesis"),
    "and the Governance page offers no way to file — an authority does not author what it decides",
  );

  /*
   * THE DECISION CONTROL IS GATED ON HOLDING THE AUTHORITY. A control that always refuses is a
   * false affordance, and this one would refuse every non-authority.
   */
  /*
   * MEASURED IN A TIGHT WINDOW IMMEDIATELY BEFORE THE CARD, and that is the whole difficulty.
   *
   * The first version searched for `viewerIsGovernanceAuthority ... UndecidedHypothesisCard` within
   * 600 characters, and its bite-proof PASSED with the gate deleted — because this page renders
   * `PendingEnrollmentCard` behind its OWN authority gate a little further up, and the loose regex
   * happily spanned from the neighbour's gate to this card. A guard a sibling can satisfy is not a
   * guard. The window is now shorter than the distance to any other gate on the page.
   */
  /* Anchored to the ELEMENT, not the identifier — the import statement is the first match. */
  const cardAt = governance.indexOf("<UndecidedHypothesisCard");
  assert.ok(cardAt > 0, "the decision control is rendered on the Governance page");
  const gateWindow = governance.slice(Math.max(0, cardAt - 150), cardAt);
  assert.ok(
    gateWindow.includes("viewerIsGovernanceAuthority"),
    "the decision control is offered only to this tenant's Governance authority",
  );

  /*
   * AND THE GOVERNANCE PAGE ADDS NO READER OF ITS OWN. It reaches SIA-3's released read seam, so
   * there is no second projection that could disagree with the one /agents renders.
   */
  assert.ok(
    governance.includes("readImprovementHypotheses"),
    "the Governance page reads through SIA-3's released seam",
  );
  for (const forbidden of ["agentImprovementHypotheses", "drizzle-orm", "db/client.server"]) {
    assert.ok(
      !governance.includes(forbidden),
      `the Governance page does not query hypotheses itself (${forbidden})`,
    );
  }

  /* An unreadable list is never rendered as an empty one. */
  assert.ok(
    /unavailable=\{hypotheses\.status !== "read"\}/.test(governance),
    "an unreadable hypothesis list is reported as unavailable, never as none awaiting a decision",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 9. THE CLOSED VOCABULARIES ARE STILL CLOSED, AND THE CLIENT PICKS FROM THEM.
 * ═════════════════════════════════════════════════════════════════════════ */
function theVocabulariesStayClosed(): void {
  assert.deepEqual(
    [...IMPROVEMENT_TARGETS],
    ["selection-behaviour"],
    "the improvement target vocabulary is still one entry — SIA-3.1 widened nothing",
  );
  assert.equal(EVIDENCE_FINDING_KEYS.length, 8, "the evidence vocabulary is still eight entries");
  assert.equal(
    IMPROVEMENT_HYPOTHESIS_SUBJECT_TYPE,
    "agent_improvement_hypothesis",
    "the Governance subject is unchanged",
  );

  /*
   * THE CONTROL OFFERS NO TARGET CHOICE. A vocabulary with one entry is not a dropdown, and
   * offering one would imply the other targets exist. It sends the contract's single value.
   */
  const filing = codeOf(read(FILING_CONTROL));
  assert.ok(
    /improvementTarget:\s*IMPROVEMENT_TARGETS\[0\]/.test(filing),
    "the control sends the contract's target rather than a string of its own",
  );
  for (const absent of ["prompt", "preferredModel", "toolPermission", "policy"]) {
    assert.ok(
      !new RegExp(`"${absent}"`).test(filing),
      `the control offers no '${absent}' target — those are mutations with their own owners`,
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 10. NO SCHEMA, NO MIGRATION.
 *
 * SIA-3 already owned the persistence. A transport that needed a column would be a transport that
 * had become an authority.
 * ═════════════════════════════════════════════════════════════════════════ */
function noSchemaChanged(): void {
  const sqlCount = readdirSync(path.join(ROOT, MIGRATIONS)).filter((f) => f.endsWith(".sql")).length;
  assert.equal(sqlCount, 40, "SIA-3.1 authored no migration — a product seam needs none");
  const journal = JSON.parse(read(path.join(MIGRATIONS, "meta/_journal.json"))) as {
    entries: readonly unknown[];
  };
  assert.equal(journal.entries.length, sqlCount, "and the journal agrees with the files on disk");
  /*
   * THE INDEX FOLLOWS THE LENGTH RATHER THAN A LITERAL. Pinning `entries[38]` meant "the newest"
   * only until a later phase authored one; AMA-1 did, and the literal then named the
   * second-newest while the message still said "newest". Deriving the index from the count keeps
   * the assertion about the same FACT under every future migration.
   */
  assert.equal(
    (journal.entries[journal.entries.length - 1] as { tag: string }).tag,
    "20260831110423_ama1_agent_mandate_authority",
    "the newest migration is AMA-1's — SIA-3 held this line before it",
  );

  /* And the human-author CHECK that decides this phase's authorship model is untouched. */
  const allMigrations = readdirSync(path.join(ROOT, MIGRATIONS))
    .filter((f) => f.endsWith(".sql"))
    .map((f) => read(path.join(MIGRATIONS, f)))
    .join("\n");
  assert.ok(
    /CONSTRAINT "agent_improvement_hypotheses_human_author_chk" CHECK \("agent_improvement_hypotheses"\."proposed_by_actor_type" = 'human'\)/.test(
      allMigrations,
    ),
    "a hypothesis author is still constrained to human by the database — SIA-3.1 weakened nothing to look more autonomous",
  );

  /*
   * AND THE WRITER STILL STAMPS `human` FROM THE SESSION. The CHECK and the writer are two
   * independent statements of the same rule; a transport that let either drift would be the
   * autonomy this phase deliberately did not build.
   */
  const writer = codeOf(read(WRITER));
  assert.ok(
    /proposedByActorType:\s*"human"/.test(writer),
    "the writer stamps a human author, and takes no parameter for it",
  );
  assert.ok(
    /proposedByActorId:\s*tenant\.userId/.test(writer),
    "and attributes it to the authenticated human from the resolved session",
  );
}

function main(): void {
  theTransportHoldsNoAuthority();
  theClientCannotSayWhatItMustNotSay();
  theTwoActsStayApart();
  nothingThisPhaseAddedCanAct();
  theReadSurfaceStayedARead();
  noControlOffersToApply();
  theWordingIsHonest();
  thePagesGateTheControls();
  theVocabulariesStayClosed();
  noSchemaChanged();
  console.log("sia31-hypothesis-filing/filing-firewall: OK");
}

main();
