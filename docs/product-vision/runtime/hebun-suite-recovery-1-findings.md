# SUITE-RECOVERY-1 — Findings Record

A working record for SUITE-RECOVERY-1, not a closure record. It holds findings the phase measured
but does not resolve. When the phase closes, its closure record takes these findings over.

## SR1-INT5A-M11-SURVIVOR-1 — INT-5A M11 mutation survives (pre-existing)

**Category.** Security-test coverage. **Disposition.** DEFERRED. **Not a B1 regression.**

**The guarantee at risk.** INT-5A bite-proof M11 unwires the real tenant-scoped integrations read
in Heby's answer flow (`src/features/heby-answer/model-answer.server.ts`):

    - const integrationResolutions = await withIntegrations(governanceResolutions, tenant, deps);
    + const integrationResolutions = governanceResolutions;

`tests/int5a-flow/connection-grounding.ts` is the suite that must fail against that mutation
(expected reason: `withIntegrations is not wired`). It passes instead, so the suite no longer
proves that Heby's answer is grounded in the tenant-scoped connection read.

**Evidence (2026-10-18).**

- In the B1 tree (`fix/suite-recovery-1` at `ee5b5874` plus the uncommitted B1 diff),
  `tests/int5a-flow/bite-proofs.ts` exits 1 with `M11 ... the mutation SURVIVED`.
- Reproduced independently on a clean detached worktree at `ee5b5874` (published `origin/main`,
  no B1 change): unmutated `connection-grounding` passes; with the M11 mutation applied it still
  passes. The file was restored and its sha256 re-verified.
- At the earlier baseline the same bite-proof file stopped at M10 (`the suite failed, but not for
  the intended reason`), which masked M11. B1 repaired the RC-A reachability that caused M10, which
  is why M11 is now reached and visible.
- The B1 diff does not touch `model-answer.server.ts`, `connection-grounding.ts` or
  `int5a-flow/bite-proofs.ts`.

**Not done in B1.** No fix, no change to M11's expectation, no relaxation of the bite-proof. The
cause (why the grounding suite no longer observes the unwired seam) is not diagnosed here.

**Acceptance dependency.** A Director-selected repair in which `connection-grounding` fails, for
the intended reason, when `withIntegrations` is unwired, and `int5a-flow/bite-proofs.ts` passes.
