# PHASE B2 — Primary Tree Reconciliation · closure record · VERIFIED

Phase A (`hebun-phase-a-development-continuity-closure.md` §6–§7) left the primary working tree on a
stale `main`, so a session opened there loaded an outdated `CLAUDE.md`. Phase B1
(`hebun-phase-b1-knowledge-preservation-closure.md`) preserved the tree's stranded knowledge first. B2
brings the primary tree forward and classifies what it holds outside Git. It moves, deletes, stages or
rewrites none of those files.

## 1 · Scope, as the Director approved it (2026-10-17)

No acceptance criteria for B2 were written before the work (B1 §7 named its subject only: stale
`main`, the three bite-proof mutations, untracked scratch files). The Director selected B2, authorized
one fast-forward of the primary tree, and then approved this scope for a VERIFIED closure:

1. Primary tree fast-forward completed.
2. Every untracked file preserved.
3. Dependency compatibility verified statically.
4. Remaining risks explicitly deferred.

The Director also approved one root-anchored ignore rule for the API-key-bearing `.mcp.json`.

## 2 · What was measured

| Fact | Value | How |
|---|---|---|
| Published baseline | `origin/main` = `7c52b7393324cfcc54461e17b746b68b32678c86` | `git ls-remote origin refs/heads/main`, before and after |
| Primary tree before | `main` at `b18cb693`, ancestor of the target, 37 commits behind; tracked tree and index clean; no `.git` lock | `git merge-base --is-ancestor`, `git rev-list --count`, `git diff --quiet`, `git diff --cached --quiet` |
| The three bite-proof mutations (B1 §1) | **absent** before B2 started; who reverted them is not known | `git diff --quiet` on the tracked tree |
| Fast-forward | `git merge --ff-only 7c52b739` → reflog `merge 7c52b739…: Fast-forward`, one parent, no merge commit; 231 tracked paths changed | `git reflog`, `git diff --name-only b18cb693 7c52b739` |
| Untracked files | 16 entries, 134 files; none collides with a path in `7c52b739` (ignored paths also scanned); **134/134 identical by SHA-256** before and after | `git ls-files --others --exclude-standard` + `shasum -a 256`, diffed |
| Instructions | `CLAUDE.md`, `hebun-loop.md`, `docs/MASTER-ROADMAP.md` in the primary tree equal `7c52b739` (the `CLAUDE.md` step-1 staleness check passes) | `git diff --quiet <sha> -- …` |
| Dependencies | no `package.json`, lockfile or Node-version file changed in `b18cb693..7c52b739`; installed `node_modules/.package-lock.json` matches `package-lock.json` (0 version mismatches, 0 missing non-optional packages) | `git diff --stat`; JSON comparison |
| Concurrent sessions | one other Claude Code process with its working directory in the primary tree (pid 3581), sleeping, no child shell; that directory's other transcripts last written 2026-10-16 14:06Z. One in another repository. No dev server, build, git operation or watcher. Director: one session in use | `ps`, `lsof -d cwd`, transcript mtimes |
| Other worktrees | unchanged (141 including this phase's two) | `git worktree list`; spot checks clean |

**Runtime acceptance: NOT PERFORMED.** Nothing was installed, built, served or migrated. **Production:
NOT APPLICABLE** — a local fast-forward deploys nothing; `origin/main` was already `7c52b739`.

## 3 · The untracked files, classified (contents not modified; secrets not read)

| Path | Class | Note |
|---|---|---|
| `.mcp.json` | security-sensitive | MCP config with an `x-api-key` header (value not read); was not ignored. This commit adds `/.mcp.json` to the root `.gitignore` |
| `.claude/settings.local.json.bak` | security-sensitive | still holds the two allow rules removed from the live settings on 2026-10-17 (token print, env decrypt); not read by Claude Code |
| `apps/dashboard/rung1-acceptance.mts`, `rung1-origination.mts` | legacy acceptance script | production ceremony tooling; `execute-once` carries a deny rule |
| `apps/dashboard/scripts/k2-acceptance-read.ts`, `k2-stranded-credential-repair.ts` | legacy script, Director review | the second repairs credentials; no secret pattern found |
| `apps/dashboard/scripts/soc-ui1-local-acceptance-fixture.ts`, `scripts/kr2-benchmark/` (3) | historical development artifact | local fixture and benchmark |
| `docs/product-vision/runtime/hebun-p3-*.md` (3) | potentially important evidence | uncommitted P3 ceremony and gate records; a tracked document refers to them |
| `docs/inventory/exports/*.pdf` (2), `apps/dashboard/.shots/` (116 PNG) | generated artifact | exports and acceptance screenshots |
| `apps/dashboard/.claude/` | local configuration | preview launch config and local settings |
| `apps/dashboard/node`, `apps/dashboard/dashboard@0.1.0` | accidental artifact | 0 bytes |

`tsconfig.json` includes `**/*.ts` and `**/*.mts`, so a local `tsc` in the primary tree compiles the
untracked scripts; whether they still compile against the current `src` is **UNKNOWN** (not run:
`incremental` writes a build-info file). Vercel builds from Git and never sees them.

## 4 · Not done here

No artifact was deleted, moved, staged or committed; no worktree was cleaned; `MEMORY.md` was not
compacted; the GOOGLE-PICKER-1 addendum and the Brain catch-up stay as B1 left them. `.mcp.json` is
protected only once this commit reaches the primary tree.

## Closure Contract (v1)

- Phase: PHASE-B2-PRIMARY-TREE-RECONCILIATION
- Owner: the primary working tree's Git state under CLAUDE.md (Faz Sözleşmesi, Eşzamanlı Oturumlar) + root .gitignore + docs/MASTER-ROADMAP.md §21/§22 + this record
- Reached state: VERIFIED
- Implementation commit: THIS COMMIT
- Verification level: V0 — documentation plus one ignore rule; no runtime, schema, provider, authority or test change; the fast-forward itself moved no code that was not already on `main`
- Verification evidence: primary `git merge --ff-only 7c52b739` exit 0, reflog Fast-forward, HEAD = origin/main = 7c52b739; 37 commits, 231 tracked paths; tracked tree and index clean after; 134/134 untracked SHA-256 identical; dependency manifests unchanged and installed lock matches (0 mismatches); `node --import tsx tests/development-continuity/closure-contract.ts` PASS before and after the fast-forward and on this change; `git check-ignore -v --no-index .mcp.json` → `.gitignore:10:/.mcp.json`, `apps/dashboard/.mcp.json` not matched, 0 tracked files newly ignored, of the primary's untracked paths only `.mcp.json` newly ignored; `git diff --check` exit 0
- Test environment: primary tree `~/Developer/Hebun AI` (fast-forward and measurements) and worktree `.claude/worktrees/phase-b2-primary-tree` at 7c52b739 (this change); macOS (Darwin 25.2.0); tsx from the primary `apps/dashboard/node_modules`; no database, network beyond `git ls-remote`, or credentials
- Deployment evidence: N/A — not deployed
- Production acceptance evidence: N/A — a local working-tree reconciliation; runtime acceptance not performed
- Deferred risks: CONTINUITY-STALE-PRIMARY-TREE-1 (DEFERRED); B2-SECRET-BEARING-UNTRACKED-1 (DEFERRED); B2-P3-UNCOMMITTED-EVIDENCE-1 (DEFERRED); B2-LEGACY-ACCEPTANCE-SCRIPTS-1 (DEFERRED); B2-UNTRACKED-ARTIFACTS-1 (DEFERRED); B2-LOCAL-TSC-UNKNOWN-1 (DEFERRED)
- Director approvals: Phase B2 selected and one primary-tree fast-forward authorized 2026-10-17 (executed); B2 scope approved for a VERIFIED closure 2026-10-17; the root-anchored `/.mcp.json` ignore rule approved 2026-10-17; preparation of this closure documentation 2026-10-17; commit NOT yet approved; push NOT approved; deploy NOT approved

### Deferred risk detail

- **CONTINUITY-STALE-PRIMARY-TREE-1 (DEFERRED).** Registered by Phase A; that record is not edited.
  Narrowed here: the primary tree now carries the current `CLAUDE.md`. Still open: about 135 older
  worktrees carry older instructions, and a running session (for example pid 3581, opened in the
  primary tree before the fast-forward) does not reload `CLAUDE.md`. Acceptance dependency: sessions
  restarted or opened fresh, and a Director decision on worktree cleanup.
- **B2-SECRET-BEARING-UNTRACKED-1 (DEFERRED).** The primary tree holds `.mcp.json` with an API key and
  `.claude/settings.local.json.bak` with the two removed secret-printing allow rules. The ignore rule
  protects `.mcp.json` from staging only after this commit is in the primary tree; the key itself is
  unrotated and on disk. Acceptance dependency: a Director decision on the backup file and on the key.
- **B2-P3-UNCOMMITTED-EVIDENCE-1 (DEFERRED).** Three uncommitted P3 records under
  `docs/product-vision/runtime/` exist only in the primary tree. Acceptance dependency: a B1-style
  preservation decision (commit verbatim, or record why not).
- **B2-LEGACY-ACCEPTANCE-SCRIPTS-1 (DEFERRED).** `rung1-*.mts` and `scripts/k2-*.ts` (one repairs
  credentials) are untracked production-capable tooling. Acceptance dependency: a Director decision to
  commit, archive or remove them.
- **B2-UNTRACKED-ARTIFACTS-1 (DEFERRED).** Screenshots, inventory PDFs, a benchmark, a local fixture
  and two 0-byte files. Acceptance dependency: a Director decision; none is required by `main`.
- **B2-LOCAL-TSC-UNKNOWN-1 (DEFERRED).** A local `tsc` in the primary tree type-checks the untracked
  scripts; current compatibility is unknown. Acceptance dependency: a primary-tree type-check run, or
  B2-LEGACY-ACCEPTANCE-SCRIPTS-1 resolved.

**Weekly three.** *Learned:* fingerprint untracked files before moving a tree, and check the ignore
rules for secret-bearing files first — an unignored key is one `git add` from public history.
*Turkish Rug House:* every session that works on TRH from the primary tree now starts on released code
and current safety rules. *Hebun AI:* the primary tree is a trustworthy starting point again, without
any stranded work being discarded.
