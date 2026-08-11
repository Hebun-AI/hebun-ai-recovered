/*
 * heby-voice/recognition-locality.ts — WHERE speech becomes text, decided from a MEASUREMENT rather
 * than from an assumption.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT CHANGED BETWEEN VOICE V1 AND VOICE V1.1
 * ─────────────────────────────────────────────────────────────────────────────
 * Voice V1 could only say one thing about the browser recognizer, and it said it conservatively:
 * "if recognition exists, assume the audio leaves the device." That was correct for the API as it
 * stood — nothing distinguished a local recognizer from a remote one, so Hebun refused to claim the
 * flattering case.
 *
 * The Web Speech API has since grown the missing distinction, and Hebun now uses it:
 *
 *   SpeechRecognition.available({ langs, processLocally: true })
 *       asks the browser whether it can recognize THESE languages entirely on the device, and
 *       answers "available" / "downloadable" / "downloading" / "unavailable".
 *   SpeechRecognition.install({ langs })
 *       downloads the language pack that makes "downloadable" become "available".
 *   recognition.processLocally = true
 *       REQUIRES local processing for that recognition. It is an instruction, not a hint: where the
 *       language pack is missing, `start()` fails rather than quietly falling back to the network.
 *
 * Shipped in Chrome 139 on desktop (Windows/macOS/Linux). Absent from Chrome on Android, from Safari
 * (which has `webkitSpeechRecognition` since 14.1 but none of these members), and from Firefox
 * (recognition itself is still behind a flag there).
 *
 * SO LOCALITY IS NOW A FACT WITH TWO HONEST VALUES, AND THE CONSERVATIVE ONE IS STILL THE DEFAULT:
 *
 *   "on-device"  PROVEN and ENFORCED. The browser reported the language pack as available AND the
 *                recognizer was told `processLocally = true`. Audio does not leave the machine.
 *   "cloud"      NOT PROVEN. The browser cannot be asked, or answered that it cannot keep this
 *                language local. Hebun assumes the audio reaches the browser vendor's speech
 *                service and says so, exactly as Voice V1 always did.
 *
 * There is deliberately no third "probably local" value. A privacy claim is either measured or it is
 * the conservative one.
 *
 * Pure: the availability answer is obtained by the CALLER and passed in as a fact, so this file has
 * no DOM access, performs no detection, and is fully testable under plain Node.
 */

/**
 * What the browser answered about keeping a language local — the four spec values, plus the case
 * where the question cannot be asked at all because this browser has no on-device members.
 */
export type HebyOnDeviceAvailability =
  /** This browser exposes no on-device recognition API, so the question has no answer here. */
  | "unsupported"
  /** Asked, and answered: this language cannot be recognized locally on this machine. */
  | "unavailable"
  /** Asked, and answered: a language pack exists and could be installed. Not local YET. */
  | "downloadable"
  /** A language pack is being installed right now. Not local YET. */
  | "downloading"
  /** Asked, and answered: this language IS available locally. */
  | "available";

/** Where recognition actually happens. Two values, because a privacy claim is measured or it is not. */
export type HebyRecognitionLocality = "on-device" | "cloud";

/**
 * Decide locality from the browser's own answer.
 *
 * ONLY "available" earns "on-device", and only because the runtime pairs it with
 * `processLocally = true`. "downloadable" and "downloading" are explicitly NOT local yet: a pack that
 * could exist is not a pack that does, and Hebun will not describe an intention as a guarantee.
 */
export function resolveRecognitionLocality(availability: HebyOnDeviceAvailability): HebyRecognitionLocality {
  return availability === "available" ? "on-device" : "cloud";
}

/** The single fact the disclosure turns into a sentence. */
export function recognitionLeavesDevice(locality: HebyRecognitionLocality): boolean {
  return locality === "cloud";
}

/**
 * Whether the operator can DO something about a cloud locality — the one case where Hebun offers to
 * improve its own privacy posture instead of merely reporting it.
 *
 * "downloading" is deliberately excluded: an install is already in flight, and offering the button
 * again would invite a second one.
 */
export function canInstallOnDeviceRecognition(availability: HebyOnDeviceAvailability): boolean {
  return availability === "downloadable";
}

/**
 * The sentence describing where this session's speech is processed. It is the load-bearing line of
 * the disclosure, so it states the mechanism rather than a reassurance, and it never claims the
 * favourable case without the measurement behind it.
 */
export function recognitionLocalityLine(
  locality: HebyRecognitionLocality,
  availability: HebyOnDeviceAvailability,
): string {
  if (locality === "on-device") {
    return "Speech is turned into text by your browser on this device. The audio does not leave your machine.";
  }
  if (availability === "downloadable") {
    return "Speech is turned into text by your browser's own speech service, which may send the audio to the browser vendor. Your browser can do this on-device instead once the language pack is installed.";
  }
  if (availability === "downloading") {
    return "Speech is turned into text by your browser's own speech service, which may send the audio to the browser vendor. The on-device language pack is still downloading.";
  }
  return "Speech is turned into text by your browser's own speech service, which may send the audio to the browser vendor. Hebun cannot see or prevent that.";
}

/**
 * The short badge shown while voice is in use, so the operator is never more than a glance away from
 * knowing where their voice is going. Deliberately plain: no shield, no reassurance, no marketing.
 */
export function recognitionLocalityLabel(locality: HebyRecognitionLocality): string {
  return locality === "on-device" ? "On-device speech" : "Browser speech service";
}

/* ── V1.3 — THE INSTALL REQUEST, AS AN OBSERVABLE THING ─────────────────────
 *
 * The Director pressed "Keep speech on this device" and nothing visibly happened. That was not a
 * download failure — it was a REPORTING failure: the offer disappears as soon as availability stops
 * being `downloadable`, and every outcome, including a rejection, removed it. From the outside, a
 * successful install, a silent failure and an unchanged availability all looked identical.
 *
 * So an install now has a status of its own, separate from availability, and each value produces a
 * sentence. Nothing here claims a pack is installed: `resolved` only means the browser's promise
 * settled, and whether that changed anything is decided by RE-ASKING `available()`.
 */
export type HebyInstallStatus =
  /** No install has been requested this session. */
  | "idle"
  /** The browser accepted the request and is working. There is no progress API, so none is shown. */
  | "requested"
  /** The request settled AND a re-check proved the language is now available locally. */
  | "installed"
  /** The request settled but a re-check says the language is still not local. Reported, not hidden. */
  | "no-change"
  /** The request itself failed. */
  | "failed";

/**
 * The sentence for an install status, or null while there is nothing to say.
 *
 * No percentage, no spinner text pretending to be progress, and no claim of success that a re-check
 * did not confirm — Chrome exposes no progress for this and Hebun will not invent one.
 */
export function installStatusLine(status: HebyInstallStatus): string | null {
  switch (status) {
    case "requested":
      return "Installing on-device speech support. This can take a few minutes, and you can keep using voice meanwhile.";
    case "installed":
      return "On-device speech support is installed. Speech now stays on this machine.";
    case "no-change":
      return "The browser finished the request but still reports this language as not available on-device. Speech continues to use the browser's speech service.";
    case "failed":
      return "The on-device speech pack could not be installed. Speech continues to use the browser's speech service.";
    case "idle":
      return null;
  }
}
