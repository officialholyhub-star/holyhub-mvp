import Link from "next/link";
import { HolyHubIcon } from "@/components/holyhub-icon";
import { getVerseOfTheDay } from "@/lib/verse-of-day";

export function VerseOfTheDay({ compact = false }: { compact?: boolean }) {
  const verse = getVerseOfTheDay();

  return (
    <section className={compact ? "daily-verse daily-verse-compact" : "daily-verse"} aria-labelledby={compact ? "home-daily-verse" : "hub-daily-verse"}>
      <div className="daily-verse-top">
        <div className="daily-verse-label">
          <span className="daily-verse-icon"><HolyHubIcon name="bible" /></span>
          <div>
            <p className="eyebrow">Verse of the day</p>
            <span>Changes daily</span>
          </div>
        </div>
        {!compact && <span className="soft-pill">TODAY</span>}
      </div>

      <blockquote id={compact ? "home-daily-verse" : "hub-daily-verse"}>
        “{verse.text}”
      </blockquote>

      <div className="daily-verse-footer">
        <div>
          <strong>{verse.reference}</strong>
          <span>{verse.translation}</span>
        </div>
        <Link href="/hub/bible">{compact ? "Visit The Hub" : "Explore Bible"} <span aria-hidden="true">→</span></Link>
      </div>
    </section>
  );
}
