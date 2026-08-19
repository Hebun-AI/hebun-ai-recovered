/*
 * G6D — SOURCE-TRUTH CONSISTENCY.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 *
 * G6C connected the `governance` source class to `decision_records`. Two sentences in the pure
 * resolver were written before that connection existed and were left describing the old world:
 *
 *   `governance`       "Governance structural vocabulary only; no live policy instances connected."
 *                      False after G6C — and this is ALSO the resolution `withGovernance` falls
 *                      back to when the real read THROWS, so a transient read failure was reported
 *                      to the reader as a permanent absence of connection.
 *
 *   `decision-records` "No persisted decision records are connected."
 *                      Locally true — this class has no reader — but on `/approvals`, which
 *                      declares BOTH classes, it printed beside an authoritative item that this
 *                      organization's `decision_records` had just supplied.
 *
 * K1 set the precedent for the repair: when Knowledge gained a server seam, the pure resolver's
 * sentence was rewritten to explain the seam rather than to claim non-connection. This file pins
 * that G6C's connection carries the same obligation, and that the repair did not quietly become a
 * capability change.
 *
 * ── ASSERTED AGAINST COMMENT-STRIPPED CODE ───────────────────────────────────
 *
 * The repair's own comments QUOTE the sentences they replaced, which is the G6C failure mode in
 * reverse: a prose ban would trip on the explanation of why the prose is gone. Every claim below
 * is therefore made against `codeOf(...)`, never against raw source.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { resolveSource, resolveSources } from "../../src/features/heby-runtime/source-resolver";
import { buildResponse } from "../../src/features/heby-runtime/response-builder";
import type { SourceResolution } from "../../src/features/heby-runtime/contracts";
import { HEBY_SOURCE_CLASSES } from "../../src/features/heby-integration/contracts";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const RESOLVER = "src/features/heby-runtime/source-resolver.ts";
const GROUNDING = "src/features/governance-grounding/heby-governance-source.server.ts";

/** Every act that mutates Governance. Reaching one from Heby is forbidden (G6C). */
const GOVERNANCE_WRITERS = [
  "establishGovernanceAuthority",
  "recordGovernanceDecision",
  "writeGovernanceDecisionWithin",
  "delegateGovernanceAuthority",
  "revokeGovernanceAuthority",
  "provisionMemberRole",
  "authorizeMembership",
  "issueInvitation",
  "revokeInvitation",
  "decideIdentityEnrollment",
  "ratifyKnowledgeVersion",
  "rejectKnowledgeVersion",
  "consumeActionPermit",
  "executeAuthorizedAction",
] as const;

const HEBY_ROOTS = [
  "src/features/heby-answer/model-answer.server.ts",
  "src/features/heby-commands/read-commands.server.ts",
];

function resolveImport(spec: string, from: string): string | null {
  const base = spec.startsWith("@/")
    ? path.join("src", spec.slice(2))
    : spec.startsWith(".")
      ? path.join(path.dirname(from), spec)
      : null;
  if (!base) return null;
  for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const candidate = base + ext;
    if (existsSync(path.join(ROOT, candidate)) && statSync(path.join(ROOT, candidate)).isFile()) {
      return candidate;
    }
  }
  return null;
}

function reachableFrom(entry: string): Set<string> {
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length > 0) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const match of codeOf(read(file)).matchAll(/from\s+"([^"]+)"/g)) {
      const target = resolveImport(match[1]!, file);
      if (target) stack.push(target);
    }
  }
  return seen;
}

function collect(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    return e.isDirectory() ? collect(rel) : /\.tsx?$/.test(e.name) ? [rel] : [];
  });
}

function main(): void {
  /* ── 1. THE CONTRADICTION IS GONE, AND GONE TRUTHFULLY ───────────────────── */
  {
    const governance = resolveSource("governance");
    const decisions = resolveSource("decision-records");

    /*
     * Both remain UNAVAILABLE in the pure resolver. The repair is a truthfulness repair, not a
     * connection: nothing here gained a reader, and a test that let `governance` resolve here
     * would be pinning a capability this phase did not build.
     */
    assert.equal(governance.state, "unavailable", "the pure resolver still reads no Governance");
    assert.equal(decisions.state, "unavailable", "decision-records still has no reader");
    assert.equal(governance.items.length, 0);
    assert.equal(decisions.items.length, 0);

    /*
     * THE DEFECT ITSELF: `decision-records` may no longer report that persisted decision records
     * are unconnected, because `decision_records` IS connected — through the `governance` class.
     */
    const decisionsReason = decisions.unavailableReason ?? "";
    assert.ok(
      !/no persisted decision records are connected/i.test(decisionsReason),
      `decision-records must not claim the Governance decision record is unconnected: ${decisionsReason}`,
    );
    /* It must say what it IS about, and disown the collision by naming the other class. */
    assert.match(decisionsReason, /decision-preparation/i);
    assert.match(decisionsReason, /governance source class/i);

    /*
     * And `governance` may no longer describe the pre-G6C world. It follows the K1 sentence: the
     * read is tenant-scoped and server-side, and none was supplied to a pure caller.
     */
    const governanceReason = governance.unavailableReason ?? "";
    assert.ok(
      !/structural vocabulary/i.test(governanceReason),
      `governance must not describe the pre-G6C world: ${governanceReason}`,
    );
    assert.match(governanceReason, /tenant-scoped on the server/i);

    /* The K1 precedent this follows still exists, and is still phrased the same way. */
    assert.match(resolveSource("knowledge").unavailableReason ?? "", /tenant-scoped on the server/i);
  }

  /* ── 2. NO CLASS LOST ITS HONEST UNAVAILABLE REASON ──────────────────────── */
  {
    /*
     * A rewrite that silently emptied a reason would read as "resolved with nothing" rather than
     * "not connected". Every unavailable class must still explain itself, in its own words.
     */
    const reasons = new Map<string, string>();
    for (const cls of HEBY_SOURCE_CLASSES) {
      const resolution = resolveSource(cls);
      if (resolution.state !== "unavailable") continue;
      const reason = resolution.unavailableReason ?? "";
      assert.ok(reason.trim().length > 0, `${cls} must state why it is unavailable`);
      reasons.set(cls, reason);
    }
    /*
     * No two classes share one sentence — a generic reason explains nothing — with ONE legitimate
     * exception measured rather than assumed: `operations` and `platform` are both projections of
     * the SAME Executive Overview, so when it is absent the reason genuinely is identical for both.
     * Every other pair sharing a sentence would mean a real reason was lost.
     */
    const OVERVIEW_BACKED = new Set(["operations", "platform"]);
    const distinct = new Set([...reasons].filter(([cls]) => !OVERVIEW_BACKED.has(cls)).map(([, r]) => r));
    assert.equal(
      distinct.size,
      reasons.size - OVERVIEW_BACKED.size,
      "each unavailable class states its own reason, never a shared generic one",
    );
    assert.equal(
      new Set([...reasons].filter(([cls]) => OVERVIEW_BACKED.has(cls)).map(([, r]) => r)).size,
      1,
      "the two overview-backed classes share one reason because they share one source",
    );

    /*
     * The K1 SEAM SENTENCE is a family, not a one-off: Knowledge (K1), prepared work (R3W),
     * recorded recipients (R3R) and now Governance (G6D) all say the same thing, because all four
     * are read tenant-scoped on the server and the pure resolver holds no tenant.
     */
    const seamClasses = ["knowledge", "work-artifacts", "external-recipients", "governance"];
    for (const cls of seamClasses) {
      assert.match(
        reasons.get(cls) ?? "",
        /read tenant-scoped on the server; no authorized server read was supplied here/,
        `${cls} is server-seam backed and must say so`,
      );
    }
  }

  /* ── 3. THE DETERMINISTIC FALLBACK STILL WORKS ───────────────────────────── */
  {
    /*
     * The `decisions` workspace is the one that showed the contradiction: it declares BOTH classes.
     * With neither connected the answer must be an honest UNAVAILABLE, not an empty explanation.
     */
    const context = { workspace: "decisions", route: "/approvals", overview: undefined } as const;
    const resolutions = resolveSources(["decision-records", "governance", "knowledge"], undefined);
    const response = buildResponse("INVESTIGATE", context as never, resolutions);
    assert.equal(response.origin, "deterministic");
    assert.equal(response.modelUsed, false, "no model is used, and none is available");
    assert.ok(response.body.length > 0, "an unbacked workspace still answers, honestly");

    /*
     * THE REPAIR IS PROVED WHERE IT MATTERS: these reasons are not internal state. The unresolved
     * branch prints them INTO the answer body, and `persistExchange` stores `body.join("\n")` as
     * the assistant message — so the sentence a reader sees, and the one a reload replays, is this
     * one. The false claim was reaching production prose; its absence is asserted the same way.
     */
    const spoken = response.body.join("\n");
    assert.ok(
      !/no persisted decision records are connected/i.test(spoken),
      `the answer body must not claim the Governance decision record is unconnected:\n${spoken}`,
    );
    assert.ok(
      !/structural vocabulary/i.test(spoken),
      `the answer body must not describe the pre-G6C Governance world:\n${spoken}`,
    );
    assert.ok(spoken.includes("decision-records:"), "the answer names the class it could not read");
    assert.ok(spoken.includes("governance:"), "the answer names Governance as unread, not unconnected");
  }

  /* ── 4. AUTHORITATIVE IS NOT FLATTENED, AND IS NOT CALLER-SUPPLIED ───────── */
  {
    /*
     * The response builder reports what the resolved sources actually are (G6C). Pin all three
     * outcomes here so the repair above cannot have disturbed the classification.
     */
    const authoritative: SourceResolution = {
      sourceClass: "governance",
      state: "resolved",
      provenance: "Governance decision record.",
      authoritative: true,
      items: [{ recordRef: "d-1", label: "Governance authority", detail: "established", lifecycle: "settled" }],
    };
    const derived: SourceResolution = {
      sourceClass: "operations",
      state: "resolved",
      provenance: "Executive Overview read model.",
      authoritative: false,
      items: [{ recordRef: "o-1", label: "Operations", detail: "ready", lifecycle: "settled" }],
    };
    const context = { workspace: "operations", route: "/operations", overview: undefined } as const;

    const pure = buildResponse("INVESTIGATE", context as never, [authoritative]);
    assert.ok(
      pure.body.some((line) => /authoritative organizational records/i.test(line)),
      "an all-authoritative answer says so",
    );
    assert.ok(
      !pure.limitations.some((l) => /derived and non-authoritative/i.test(l)),
      "an authoritative answer is never flattened to derived",
    );

    const mixed = buildResponse("INVESTIGATE", context as never, [authoritative, derived]);
    assert.ok(
      mixed.limitations.some((l) => /mixed/i.test(l)),
      "a mixed answer reports the mix rather than rounding to one class",
    );

    const onlyDerived = buildResponse("INVESTIGATE", context as never, [derived]);
    assert.ok(
      onlyDerived.limitations.some((l) => /derived and non-authoritative/i.test(l)),
      "a derived-only answer keeps the original wording",
    );

    /*
     * `authoritative` is a property of the RESOLUTION, produced by the owning read. No request
     * shape carries it, so a client cannot mark its own evidence authoritative — the parameter
     * does not exist to supply.
     */
    const inletCode = codeOf(read("src/app/(dashboard)/heby/actions.ts"));
    assert.ok(!/authoritative/.test(inletCode), "no Heby server action accepts an authoritative flag");
    assert.ok(!/tenantId/.test(inletCode), "no Heby server action accepts a tenant id");
  }

  /* ── 5. EXACTLY ONE CONNECTED READER OF THE GOVERNANCE RECORD ────────────── */
  {
    /*
     * The repair above must not have created a second reader of `decision_records` for Heby.
     * G6C's projection remains the only module Heby reaches that reads the Governance record, and
     * `resolveGovernanceAuthority` remains defined exactly once in the repository.
     */
    const definitions = collect("src").filter((f) =>
      /export\s+async\s+function\s+resolveGovernanceAuthority\b/.test(codeOf(read(f))),
    );
    assert.deepEqual(definitions, ["src/features/governance-decision/authority-read.server.ts"]);

    const graph = new Set<string>();
    for (const root of HEBY_ROOTS) reachableFrom(root).forEach((f) => graph.add(f));
    const groundingReaders = [...graph].filter((f) =>
      /readAuthorityRoster|readGovernanceAuthority/.test(codeOf(read(f))),
    );
    assert.ok(groundingReaders.includes(GROUNDING), "the G6C projection is reachable and is a reader");
    for (const file of groundingReaders) {
      assert.ok(
        file === GROUNDING || file.startsWith("src/features/governance-decision/"),
        `only Governance itself and its one projection may read the roster — found ${file}`,
      );
    }

    /* The pure resolver gained no database, no tenant and no Governance import. */
    const resolverCode = codeOf(read(RESOLVER));
    for (const forbidden of ["governance-decision", "governance-grounding", "@/db", "drizzle"]) {
      assert.ok(!resolverCode.includes(forbidden), `the pure resolver must not import ${forbidden}`);
    }
  }

  /* ── 6. THE G6C AND R5.1 FIREWALLS STILL HOLD ────────────────────────────── */
  {
    const graph = new Set<string>();
    for (const root of HEBY_ROOTS) reachableFrom(root).forEach((f) => graph.add(f));

    const writerOffenders: string[] = [];
    for (const file of graph) {
      const code = codeOf(read(file));
      for (const writer of GOVERNANCE_WRITERS) {
        if (new RegExp(`export\\s+(?:async\\s+)?function\\s+${writer}\\b`).test(code)) {
          writerOffenders.push(`${writer} <- ${file}`);
        }
      }
    }
    assert.deepEqual(writerOffenders.sort(), [], "no Governance writer is reachable from Heby");

    /* R5.1 — no file in src/ writes the provider connectivity control, reachable or not. */
    const providerWriters = collect("src").filter((f) =>
      /\.(insert|update|delete)\s*\(\s*providerConnectivityControls/.test(codeOf(read(f))),
    );
    assert.deepEqual(providerWriters, [], "no src/ module writes the provider connectivity control");

    /* And no arming function exists for Heby to reach in the first place. */
    const armers = collect("src").filter((f) =>
      /export\s+(?:async\s+)?function\s+setDirectorEnabled\b/.test(codeOf(read(f))),
    );
    assert.deepEqual(armers, [], "no provider-arming writer exists in src/");
  }

  console.log("PASS g6d source-truth consistency");
}

main();
