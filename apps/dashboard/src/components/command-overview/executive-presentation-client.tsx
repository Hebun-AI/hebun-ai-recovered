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
      <div className="cmd-hero-wash absolute inset-0" />
      <div className="absolute left-6 right-6 top-5 z-10 min-w-0 sm:left-8 lg:right-[26rem]">
        <p className="text-label font-bold uppercase tracking-[0.16em] text-primary">Command Center</p>
        <h1 className="cmd-greeting-title mt-1 min-w-0 truncate font-bold leading-none tracking-tight text-fg">
          {greeting}{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="mt-2 truncate text-meta text-fg-secondary">
          {organizationName ? <span className="font-semibold text-fg">{organizationName}</span> : null}
          {date ? <span>{organizationName ? " · " : ""}<span className="capitalize">{date}, {weekday}</span></span> : null}
        </p>
      </div>
    </div>
  );
}
