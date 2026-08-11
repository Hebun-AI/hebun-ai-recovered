/*
 * VOICE V1.2 — the Turkish speech-recognition QUALITY HARNESS.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS IS, AND WHAT IT DELIBERATELY IS NOT
 * ─────────────────────────────────────────────────────────────────────────────
 * It is a fixed corpus plus a deterministic scorer, so that "browser Turkish recognition is good
 * enough / not good enough" becomes a number the Director can look at instead of an impression
 * formed from one unlucky sentence.
 *
 * It is NOT a benchmark that measures recognition by itself. Nothing here can hear anything. A human
 * reads a sentence aloud into the real product, copies what landed in the composer, and this scores
 * the pair. Every number it produces is downstream of a real microphone and a real recognizer.
 *
 * IT IS NOT A PRODUCT FEATURE. It lives under `tests/`, ships in no bundle, is imported by no
 * surface, and has no route. It records TEXT the operator can already read on screen — no audio is
 * captured, written, uploaded or referenced anywhere in this file.
 *
 * ── Usage ────────────────────────────────────────────────────────────────────
 *   node --import tsx tests/voice-quality/turkish-stt-harness.ts
 *       Self-verifies the scorer against known pairs. This is what the suite runs.
 *
 *   node --import tsx tests/voice-quality/turkish-stt-harness.ts --list
 *       Prints the corpus to read aloud, one numbered sentence at a time.
 *
 *   node --import tsx tests/voice-quality/turkish-stt-harness.ts --score results.json
 *       Scores a results file of  [{ "id": "s1", "heard": "…" }, …]
 *       and prints a per-sentence and overall report.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/* ── The corpus ───────────────────────────────────────────────────────────────
 *
 * Ten sentences an actual Hebun operator would say, not tongue-twisters chosen to make a recognizer
 * look bad. Coverage is deliberate: conversational Turkish, each read surface Heby actually has,
 * a command-shaped utterance, the full set of Turkish-specific characters, one very short sentence
 * and one long one — plus the exact sentence from the first real acceptance run, so the failure that
 * started this phase stays in the measurement.
 */
export type CorpusMode =
  /** Scored for accuracy. A word error rate is meaningful here. */
  | "accuracy"
  /** Recorded, not scored. What a recognizer does with command-shaped speech is a finding, not a grade. */
  | "observation";

export interface CorpusEntry {
  readonly id: string;
  readonly category: string;
  readonly text: string;
  readonly mode: CorpusMode;
}

export const TURKISH_STT_CORPUS: readonly CorpusEntry[] = [
  {
    id: "s1",
    category: "the first real acceptance sentence",
    text: "Heby, şu anda operasyonlarda dikkat etmem gereken şeyleri özetle.",
    mode: "accuracy",
  },
  { id: "s2", category: "short", text: "Bugünkü durum nedir?", mode: "accuracy" },
  { id: "s3", category: "operations", text: "Operasyonlarda açık kalan riskleri listele.", mode: "accuracy" },
  {
    id: "s4",
    category: "security",
    text: "Güvenlik merkezinde çözülmemiş uyarı var mı?",
    mode: "accuracy",
  },
  {
    id: "s5",
    category: "knowledge",
    text: "Bilgi tabanında müşteri sözleşmeleri hakkında ne kaydedilmiş?",
    mode: "accuracy",
  },
  {
    id: "s6",
    category: "Hebun terminology",
    text: "Hebun yönetişim panelinde bekleyen onayları göster.",
    mode: "accuracy",
  },
  {
    id: "s7",
    category: "Turkish-specific characters",
    text: "İzmir, Iğdır ve Çorum şubelerindeki üç şubat görüşmesini özetle.",
    mode: "accuracy",
  },
  {
    id: "s8",
    category: "longer sentence",
    text:
      "Geçen hafta operasyonlarda tamamlanan işlerle bu hafta bekleyen işleri karşılaştır ve hangi ekibin daha fazla desteğe ihtiyacı olduğunu söyle.",
    mode: "accuracy",
  },
  { id: "s9", category: "short", text: "Bekleyen onaylar kaç tane?", mode: "accuracy" },
  {
    id: "s10",
    category: "command-shaped speech",
    text: "slash güvenlik",
    mode: "observation",
  },
];

/* ── Turkish-aware normalization ──────────────────────────────────────────────
 *
 * Scoring must not punish a recognizer for punctuation or casing, and must not accidentally punish
 * Turkish itself. JavaScript's default lowercase is wrong for this language in both directions:
 * "I" must become "ı" and "İ" must become "i". Doing it explicitly avoids the combining-dot mess
 * that `toLocaleLowerCase("tr")` produces for "İ".
 */
export function turkishLower(value: string): string {
  return value.replace(/İ/g, "i").replace(/I/g, "ı").toLowerCase();
}

/** Words only: casing folded the Turkish way, punctuation dropped, whitespace collapsed. */
export function tokenize(value: string): readonly string[] {
  return turkishLower(value)
    .replace(/[.,;:!?"'`´“”‘’()\[\]{}…]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

/** Levenshtein distance over WORDS. Substitution, insertion and deletion all cost one. */
export function wordDistance(expected: readonly string[], heard: readonly string[]): number {
  const rows = expected.length;
  const cols = heard.length;
  if (rows === 0) return cols;
  if (cols === 0) return rows;

  let previous = Array.from({ length: cols + 1 }, (_, i) => i);
  for (let r = 1; r <= rows; r++) {
    const current = [r, ...Array.from({ length: cols }, () => 0)];
    for (let c = 1; c <= cols; c++) {
      const cost = expected[r - 1] === heard[c - 1] ? 0 : 1;
      current[c] = Math.min(previous[c]! + 1, current[c - 1]! + 1, previous[c - 1]! + cost);
    }
    previous = current;
  }
  return previous[cols]!;
}

/**
 * Word error rate, clamped to 1.
 *
 * Clamped because a recognizer that hallucinates thirty words for a five-word sentence is not
 * "600% wrong" in any useful sense — it is simply wrong, and letting one bad row dominate the
 * average would make the corpus report less honest, not more.
 */
export function wordErrorRate(expected: string, heard: string): number {
  const e = tokenize(expected);
  const h = tokenize(heard);
  if (e.length === 0) return h.length === 0 ? 0 : 1;
  return Math.min(1, wordDistance(e, h) / e.length);
}

/** Every character Turkish has and English does not. Each must survive a round trip untouched. */
export const TURKISH_CHARACTERS = ["ç", "Ç", "ğ", "Ğ", "ı", "İ", "ö", "Ö", "ş", "Ş", "ü", "Ü"] as const;

/**
 * Did the transcript mangle Turkish characters?
 *
 * Deliberately narrow: this asks whether characters the RECOGNIZER produced are well-formed Turkish,
 * not whether it produced the right word. A recognizer that hears the wrong word has an accuracy
 * problem; a pipeline that turns "ş" into "s" or "?" has an encoding problem, and the two must not
 * be reported as the same failure.
 */
export function characterIntegrity(heard: string): {
  readonly turkishCharactersPresent: readonly string[];
  readonly replacementCharacters: number;
  readonly mojibake: boolean;
} {
  const present = TURKISH_CHARACTERS.filter((character) => heard.includes(character));
  const replacements = [...heard].filter((character) => character === "�").length;
  // The classic UTF-8-read-as-Latin-1 signature. If this appears, the transcript was corrupted in
  // transport rather than misheard.
  const mojibake = /Ã§|Ä|Ä±|Ã¶|Å|Ã¼|Ä°/.test(heard);
  return { turkishCharactersPresent: present, replacementCharacters: replacements, mojibake };
}

/* ── Scoring a run ────────────────────────────────────────────────────────── */

export interface RunResult {
  readonly id: string;
  readonly heard: string;
  /** What the product reported while capturing. Recorded, never assumed. */
  readonly locality?: string;
  /** Wall-clock milliseconds from pressing stop to the transcript appearing, if measured. */
  readonly latencyMs?: number;
  readonly completedNormally?: boolean;
}

export interface ScoredRow {
  readonly id: string;
  readonly category: string;
  readonly mode: CorpusMode;
  readonly expected: string;
  readonly heard: string;
  readonly wer: number | null;
  readonly exact: boolean;
  readonly integrity: ReturnType<typeof characterIntegrity>;
  readonly locality: string | null;
  readonly latencyMs: number | null;
}

export function scoreRun(results: readonly RunResult[]): {
  readonly rows: readonly ScoredRow[];
  readonly scoredCount: number;
  readonly meanWer: number | null;
  readonly exactCount: number;
  readonly encodingFailures: number;
  readonly localities: readonly string[];
} {
  const byId = new Map(results.map((r) => [r.id, r]));
  const rows: ScoredRow[] = [];

  for (const entry of TURKISH_STT_CORPUS) {
    const result = byId.get(entry.id);
    if (!result) continue;
    const integrity = characterIntegrity(result.heard);
    rows.push({
      id: entry.id,
      category: entry.category,
      mode: entry.mode,
      expected: entry.text,
      heard: result.heard,
      wer: entry.mode === "accuracy" ? wordErrorRate(entry.text, result.heard) : null,
      exact: tokenize(entry.text).join(" ") === tokenize(result.heard).join(" "),
      integrity,
      locality: result.locality ?? null,
      latencyMs: result.latencyMs ?? null,
    });
  }

  const scored = rows.filter((row) => row.wer !== null);
  return {
    rows,
    scoredCount: scored.length,
    meanWer: scored.length === 0 ? null : scored.reduce((sum, row) => sum + row.wer!, 0) / scored.length,
    exactCount: rows.filter((row) => row.exact).length,
    encodingFailures: rows.filter((row) => row.integrity.mojibake || row.integrity.replacementCharacters > 0).length,
    localities: [...new Set(rows.map((row) => row.locality).filter((l): l is string => l !== null))],
  };
}

/* ── CLI ──────────────────────────────────────────────────────────────────── */

function printCorpus(): void {
  console.log("\nTurkish STT corpus — read each aloud into Heby, then copy the composer text.\n");
  for (const [index, entry] of TURKISH_STT_CORPUS.entries()) {
    const tag = entry.mode === "observation" ? "  [observation only — not graded]" : "";
    console.log(`${String(index + 1).padStart(2)}. ${entry.id}  (${entry.category})${tag}`);
    console.log(`    ${entry.text}\n`);
  }
  console.log('Results file format:  [{ "id": "s1", "heard": "…", "locality": "cloud", "latencyMs": 900 }]\n');
}

function printScore(path: string): void {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as RunResult[];
  const report = scoreRun(parsed);

  console.log("\nTurkish STT run report\n");
  for (const row of report.rows) {
    const wer = row.wer === null ? "  n/a" : `${(row.wer * 100).toFixed(0).padStart(4)}%`;
    console.log(`${row.id.padEnd(4)} WER ${wer}  ${row.exact ? "EXACT" : "     "}  ${row.category}`);
    console.log(`     expected: ${row.expected}`);
    console.log(`     heard:    ${row.heard}`);
    if (row.integrity.mojibake) console.log("     !! MOJIBAKE — transcript corrupted in transport, not misheard");
    if (row.integrity.replacementCharacters > 0) {
      console.log(`     !! ${row.integrity.replacementCharacters} replacement character(s)`);
    }
    if (row.locality) console.log(`     locality: ${row.locality}`);
    if (row.latencyMs !== null) console.log(`     latency:  ${row.latencyMs}ms`);
    console.log("");
  }
  console.log(`scored:            ${report.scoredCount}`);
  console.log(`mean WER:          ${report.meanWer === null ? "n/a" : (report.meanWer * 100).toFixed(1) + "%"}`);
  console.log(`exact matches:     ${report.exactCount}`);
  console.log(`encoding failures: ${report.encodingFailures}`);
  console.log(`localities seen:   ${report.localities.join(", ") || "(none recorded)"}\n`);
}

/* ── Self-verification. The scorer must be trustworthy before its numbers are. ── */

function selfTest(): void {
  // The corpus covers what it claims to.
  assert.equal(TURKISH_STT_CORPUS.length, 10, "the corpus is ten sentences");
  assert.equal(new Set(TURKISH_STT_CORPUS.map((e) => e.id)).size, 10, "ids are unique");
  assert.ok(
    TURKISH_STT_CORPUS.some((e) => e.text === "Heby, şu anda operasyonlarda dikkat etmem gereken şeyleri özetle."),
    "the first real acceptance sentence stays in the corpus",
  );
  for (const required of ["operations", "security", "knowledge", "Hebun terminology", "longer sentence"]) {
    assert.ok(TURKISH_STT_CORPUS.some((e) => e.category === required), `the corpus covers "${required}"`);
  }
  // Every Turkish-specific character appears somewhere in the corpus, so a pipeline that mangles one
  // cannot pass unnoticed.
  const all = TURKISH_STT_CORPUS.map((e) => e.text).join(" ");
  for (const character of TURKISH_CHARACTERS) {
    assert.ok(all.includes(character) || all.includes(turkishLower(character)), `corpus exercises "${character}"`);
  }

  // Turkish casing, both directions — the trap that ordinary lowercasing gets wrong.
  assert.equal(turkishLower("İSTANBUL"), "istanbul");
  assert.equal(turkishLower("IĞDIR"), "ığdır");
  assert.equal(turkishLower("Işık"), "ışık");

  // Tokenization drops punctuation, not letters.
  assert.deepEqual([...tokenize("Bugünkü durum nedir?")], ["bugünkü", "durum", "nedir"]);
  assert.deepEqual([...tokenize("Heby, şu anda…")], ["heby", "şu", "anda"]);

  // The scorer on known pairs.
  assert.equal(wordErrorRate("bir iki üç", "bir iki üç"), 0, "identical is zero");
  assert.equal(wordErrorRate("bir iki üç", "bir iki dört"), 1 / 3, "one substitution in three words");
  assert.equal(wordErrorRate("bir iki üç", ""), 1, "nothing heard is total error");
  assert.equal(wordErrorRate("bir", "bir iki üç dört beş"), 1, "runaway output is clamped to 1");
  // Casing and punctuation must not count as errors.
  assert.equal(wordErrorRate("Bugünkü durum nedir?", "bugünkü durum nedir"), 0);

  // The real observed failure scores as a real failure, and is not silently forgiven.
  const observed = wordErrorRate(
    "Heby, şu anda operasyonlarda dikkat etmem gereken şeyleri özetle.",
    "şu anda operasyonlarda arka kapaktan gelirken söylediği laflar",
  );
  assert.ok(observed > 0.5, `the first real run must score as poor, got ${observed}`);

  // Encoding failures are distinguished from mishearing.
  assert.equal(characterIntegrity("şu anda").mojibake, false);
  assert.equal(characterIntegrity("Ã§ok gÃ¼zel").mojibake, true, "Latin-1 corruption is detected");
  assert.equal(characterIntegrity("bir�iki").replacementCharacters, 1);
  assert.deepEqual(
    [...characterIntegrity("İzmir Çorum şubesi").turkishCharactersPresent],
    ["Ç", "İ", "ş"],
    "present Turkish characters are reported",
  );

  // Scoring a run: observation rows are recorded, never graded.
  const report = scoreRun([
    { id: "s2", heard: "Bugünkü durum nedir?", locality: "cloud", latencyMs: 800 },
    { id: "s10", heard: "slash güvenlik" },
  ]);
  assert.equal(report.scoredCount, 1, "only accuracy rows are scored");
  assert.equal(report.rows.find((r) => r.id === "s10")?.wer, null, "command-shaped speech is observed, not graded");
  assert.equal(report.meanWer, 0);
  assert.equal(report.exactCount, 2);
  assert.deepEqual([...report.localities], ["cloud"], "locality is recorded from the run, never assumed");

  // A run with nothing in it produces no score rather than a flattering zero.
  assert.equal(scoreRun([]).meanWer, null, "an empty run has no mean, not a perfect one");

  console.log("voice-quality turkish STT harness self-test passed");
}

const [flag, argument] = process.argv.slice(2);
if (flag === "--list") printCorpus();
else if (flag === "--score" && argument) printScore(argument);
else selfTest();
