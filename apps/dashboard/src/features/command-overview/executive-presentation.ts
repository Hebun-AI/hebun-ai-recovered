/** Decorative Command presentation. These values are not organizational facts. */
export interface CommandHeroPresentation {
  readonly src: string;
  readonly quote: string;
  readonly objectPosition?: string;
  readonly overlayStrength?: number;
}

/** A manifest keeps selection explicit; the runtime never enumerates the public directory. */
export const COMMAND_HERO_PRESENTATIONS: readonly CommandHeroPresentation[] = Object.freeze([
  Object.freeze({
    src: "/command/hero/mountain-mist-01.png",
    quote: "Daha net kararlar, daha güçlü sonuçlar.",
    objectPosition: "60% 48%",
    overlayStrength: 0.5,
  }),
  Object.freeze({
    src: "/command/hero/coastal-dawn-02.png",
    quote: "Netlik, doğru anda doğru soruyla başlar.",
    objectPosition: "66% 42%",
    overlayStrength: 0.46,
  }),
  Object.freeze({
    src: "/command/hero/forest-mist-03.png",
    quote: "İlerleme, görünür olduğunda yönetilebilir.",
    objectPosition: "64% 46%",
    overlayStrength: 0.48,
  }),
]);

export function greetingForHour(hour: number): string {
  if (hour >= 5 && hour < 11) return "Günaydın";
  if (hour >= 11 && hour < 18) return "İyi günler";
  if (hour >= 18 && hour < 23) return "İyi akşamlar";
  return "İyi geceler";
}

export function firstNameOf(name: string | null | undefined): string | null {
  const first = name?.trim().split(/\s+/u)[0]?.trim();
  return first ? first : null;
}

export function localDayKey(date: Date): string {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part, index) => index === 0 ? String(part) : String(part).padStart(2, "0"))
    .join("-");
}

export function dailyPresentationIndex(dayKey: string, count: number): number {
  if (count < 1) return -1;
  let hash = 0;
  for (const character of dayKey) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash % count;
}
