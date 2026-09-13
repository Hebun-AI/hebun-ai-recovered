"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import {
  COMMAND_HERO_PRESENTATIONS,
  dailyPresentationIndex,
  firstNameOf,
  greetingForHour,
  localDayKey,
} from "@/features/command-overview/executive-presentation";

const TURKISH_DATE = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const TURKISH_WEEKDAY = new Intl.DateTimeFormat("tr-TR", { weekday: "long" });

export function ExecutivePresentation({ humanName, organizationName }: { readonly humanName?: string | null; readonly organizationName?: string | null }) {
  const [localNow, setLocalNow] = useState<Date | null>(null);
  const firstName = firstNameOf(humanName);

  useEffect(() => {
    const update = () => setLocalNow(new Date());
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const presentation = useMemo(() => {
    if (!localNow) return null;
    const key = localDayKey(localNow);
    const index = dailyPresentationIndex(key, COMMAND_HERO_PRESENTATIONS.length);
    return index < 0 ? null : COMMAND_HERO_PRESENTATIONS[index];
  }, [localNow]);

  const greeting = localNow ? greetingForHour(localNow.getHours()) : "İyi günler";
  const date = localNow ? TURKISH_DATE.format(localNow) : null;
  const weekday = localNow ? TURKISH_WEEKDAY.format(localNow) : null;

  return (
    <div className="cmd-executive-presentation absolute inset-0 overflow-hidden rounded-[inherit]" aria-hidden="true">
      {presentation ? (
        <Image
          src={presentation.src}
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) calc(100vw - 19rem), 100vw"
          className="cmd-hero-image object-cover"
          style={{ objectPosition: presentation.objectPosition }}
        />
      ) : null}
      <div className="cmd-hero-wash absolute inset-0" style={{ opacity: presentation?.overlayStrength ?? 1 }} />
      <div className="cmd-hero-layout absolute inset-0 z-10 grid min-w-0">
        <div className="cmd-greeting flex min-w-0 flex-col justify-center px-5 sm:px-6">
          <p className="cmd-context-eyebrow text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-primary">Command Center</p>
          <h1 className="cmd-greeting-title mt-1 min-w-0 font-bold leading-none tracking-tight text-fg text-balance">
            {greeting}{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-2 text-meta font-semibold text-fg">
            Şirketini daha ileriye taşımak için her şey hazır.{organizationName ? <span className="font-medium text-fg-secondary"> · {organizationName}</span> : null}
          </p>
        </div>
        {presentation?.quote ? (
          <p className="cmd-hero-quote max-w-60 text-center text-meta font-semibold italic leading-5 text-fg">
            “{presentation.quote}” <span className="block font-medium not-italic text-fg-secondary">— Hebun AI</span>
          </p>
        ) : null}
        <div className="cmd-local-date text-right">
          {date ? <p className="max-w-36 text-meta font-bold capitalize leading-5 text-fg">{date}</p> : <span className="block h-5 w-28" />}
          <p className="mt-0.5 text-label font-semibold capitalize text-fg">{weekday ?? "Yerel saat"}</p>
        </div>
      </div>
    </div>
  );
}
