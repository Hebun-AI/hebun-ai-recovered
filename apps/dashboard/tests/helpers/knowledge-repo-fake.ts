/*
 * The retrieval half of a fake DurableKnowledgeRepository.
 *
 * KR3 widened the repository interface with `searchFacts` and `hasTrigram`; R6B widened it again
 * with `countFactsByDomain`. The K1 fakes exist to prove things about LISTING — tenant scoping,
 * ambiguity, injection inertness — and none of them has an opinion about retrieval or coverage.
 * Spreading this into those fakes says so explicitly: neither is exercised here, and both return
 * nothing rather than a convenient stand-in that a later assertion might mistake for a real result.
 *
 * A test that actually cares about retrieval must not use this. `tests/kr3-flow/` runs against a
 * real PostgreSQL database, because ranking, the Turkish configuration and `ts_rank_cd` are
 * PostgreSQL behaviours and a hand-written fake of them would only prove the fake. The same holds
 * for coverage: `tests/r6b-flow/` counts against a real database, because `count(*) filter` and the
 * effective-window comparisons are PostgreSQL behaviours.
 */
import type {
  KnowledgeDomainCounts,
  KnowledgeSearchRow,
} from "../../src/features/knowledge/durable-knowledge-repository.server";
import type { KnowledgeSourceRecord, KnowledgeSourceStub } from "../../src/features/knowledge/contracts";

export interface FakeRetrievalHalf {
  searchFacts(): Promise<{
    readonly rows: readonly KnowledgeSearchRow[];
    readonly incomplete: readonly KnowledgeSourceStub[];
    readonly truncated: boolean;
    readonly trigramAvailable: boolean;
  }>;
  hasTrigram(): Promise<boolean>;
  countFactsByDomain(): Promise<readonly KnowledgeDomainCounts[]>;
}

export function noRetrieval(): FakeRetrievalHalf {
  return {
    async searchFacts() {
      return { rows: [], incomplete: [], truncated: false, trigramAvailable: false };
    },
    async hasTrigram() {
      return false;
    },
    /*
     * Empty, never a stand-in. A fake that invented domain counts would let a coverage assertion
     * pass against numbers no database produced — and coverage is the one thing R6B claims.
     */
    async countFactsByDomain() {
      return [];
    },
  };
}

/**
 * A retrieval half that MATCHES, for tests whose subject is downstream of retrieval.
 *
 * Some K1 tests assert what happens AFTER a record is selected — that its provenance survives into
 * the grounding context, that its authority class is preserved, that hostile content stays inert.
 * Those need a record to come back, and they are not about ranking, so a deliberately dumb
 * substring match is the right stand-in: it is obviously not the real scorer, so nobody can mistake
 * a passing assertion here for evidence that ranking works.
 *
 * The real ranking, the real Turkish configuration and the real `ts_rank_cd` are proven against a
 * real database in `tests/kr3-flow/`, because they are PostgreSQL behaviours and a fake of them
 * would only ever prove the fake.
 */
export function retrievalOver(records: readonly KnowledgeSourceRecord[]): FakeRetrievalHalf {
  return {
    async searchFacts(...args: unknown[]) {
      const orQuery = String(args[1] ?? "");
      const terms = orQuery
        .split(/\s+or\s+/i)
        .map((term) => term.trim().toLowerCase())
        .filter((term) => term.length > 0);
      const rows = records
        .filter((record) => {
          const haystack = `${record.title} ${record.statement ?? ""}`.toLowerCase();
          return terms.length === 0 || terms.some((term) => haystack.includes(term));
        })
        .map((record, index) => ({ record, lexicalRank: records.length - index, trigram: null }));
      return { rows, incomplete: [], truncated: false, trigramAvailable: false };
    },
    async hasTrigram() {
      return false;
    },
    /* Retrieval is the subject here; coverage is not. See `noRetrieval`. */
    async countFactsByDomain() {
      return [];
    },
  };
}
