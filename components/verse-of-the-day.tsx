import Link from "next/link";
import { HolyHubIcon } from "@/components/holyhub-icon";
import { getVerseOfTheDay } from "@/lib/verse-of-day";

type VerseOfTheDayProps = {
  compact?: boolean;
  hero?: boolean;
};

export function VerseOfTheDay({ compact = false, hero = false }: VerseOfTheDayProps) {
  const verse = getVerseOfTheDay();
  const className = hero
    ? "daily-verse daily-verse-hero"
    : compact
      ? "daily-verse daily-verse-compact"
      : "daily-verse";
  const headingId = hero ? "hero-daily-verse" : compact ? "home-daily-verse" : "hub-daily-verse";

  return (
    <section className={className} aria-labelledby={headingId}>
      <div className="daily-verse-top">
        <div className="daily-verse-label">
          <span className="daily-verse-icon"><HolyHubIcon name="bible" /></span>
          <div>
            <p className="eyebrow">Verse of the day</p>
            <span>Changes daily</span>
          </div>
        </div>
        {!compact && !hero && <span className="soft-pill">TODAY</span>}
      </div>

      <blockquote id={headingId}>
        “{verse.text}”
      </blockquote>

      <div className="daily-verse-footer">
        <div>
          <strong>{verse.reference}</strong>
          <span>{verse.translation}</span>
        </div>
        <Link href="/hub/bible">{hero || compact ? "The Hub" : "Explore Bible"} <span aria-hidden="true">→</span></Link>
      </div>
    </section>
  );
}
