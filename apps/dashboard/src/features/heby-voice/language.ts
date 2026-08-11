/*
 * heby-voice/language.ts — WHICH language Heby is listening for, chosen rather than guessed.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS
 * ─────────────────────────────────────────────────────────────────────────────
 * Voice V1 handed the recognizer `navigator.language`. That is a browser-UI preference, not a
 * statement about what the operator is about to say, and Hebun's operators work in Turkish and
 * English in the same session. A recognizer pointed at the wrong language does not fail loudly — it
 * returns confident nonsense, which is the worst possible failure for text that a human is about to
 * read quickly and send.
 *
 * So Voice V1.1 makes it an EXPLICIT CHOICE with a visible control, seeded once from the browser's
 * own preference and never re-guessed per utterance.
 *
 * WHY NOT AUTOMATIC LANGUAGE DETECTION. It would be a guess dressed as a feature. The browser
 * recognizer takes exactly one BCP 47 tag per recognition and offers no reliable detection; guessing
 * it silently would mean Hebun deciding what language the operator spoke and being wrong sometimes,
 * with no signal to the operator that it had decided anything at all.
 *
 * WHY NOT AN ORGANIZATIONAL LANGUAGE AUTHORITY. There isn't one. Hebun has no tenant-level or
 * operator-level language record, and inventing one here would be a new authority smuggled in behind
 * a microphone button. The choice below is a LOCAL PREFERENCE for this session: it is not persisted,
 * not written to any record, and it claims nothing about the organization.
 *
 * Pure: no React, no DOM, no I/O, no storage.
 */

/** The two languages Hebun operators actually work in. Not a locale list — a deliberate short one. */
export type HebyVoiceLanguage = "tr" | "en";

export const HEBY_VOICE_LANGUAGES: readonly HebyVoiceLanguage[] = ["tr", "en"];

/**
 * The default when the browser tells us nothing useful. English, because it is the language the rest
 * of the product surface is written in — not because it is more likely to be spoken.
 */
export const HEBY_VOICE_LANGUAGE_FALLBACK: HebyVoiceLanguage = "en";

/**
 * The BCP 47 tag handed to the recognizer, and to the on-device availability question.
 *
 * Region-qualified on purpose: `tr` alone is accepted by some recognizers and rejected by others,
 * while `tr-TR` and `en-US` are the tags the language packs are actually published under.
 */
const RECOGNITION_TAG: Record<HebyVoiceLanguage, string> = {
  tr: "tr-TR",
  en: "en-US",
};

export function hebyVoiceRecognitionTag(language: HebyVoiceLanguage): string {
  return RECOGNITION_TAG[language];
}

/**
 * The tag a spoken answer is synthesized with. The same tags: an answer read aloud in the language
 * the question was asked in is the only behaviour that is not a surprise.
 */
export function hebyVoiceSynthesisTag(language: HebyVoiceLanguage): string {
  return RECOGNITION_TAG[language];
}

/** The operator-facing name, in that language — a Turkish speaker should not have to find "Turkish". */
const LANGUAGE_LABEL: Record<HebyVoiceLanguage, string> = {
  tr: "Türkçe",
  en: "English",
};

export function hebyVoiceLanguageLabel(language: HebyVoiceLanguage): string {
  return LANGUAGE_LABEL[language];
}

/**
 * SEED the preference once, from the browser's own language setting.
 *
 * This is the one place a browser value influences the choice, and it is a SEED rather than a guess:
 * it runs once when the runtime appears, the result is shown in a control the operator can change,
 * and nothing re-reads it afterwards. An unrecognized or absent value falls back rather than being
 * passed to the recognizer as-is.
 */
export function resolveInitialVoiceLanguage(browserLanguage: string | null | undefined): HebyVoiceLanguage {
  const normalized = (browserLanguage ?? "").trim().toLowerCase();
  if (normalized.length === 0) return HEBY_VOICE_LANGUAGE_FALLBACK;
  const primary = normalized.split("-")[0];
  return HEBY_VOICE_LANGUAGES.find((language) => language === primary) ?? HEBY_VOICE_LANGUAGE_FALLBACK;
}
