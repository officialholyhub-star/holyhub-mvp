import { VerseOfTheDay } from "@/components/verse-of-the-day";

export const dynamic = "force-dynamic";

export default function HubPage() {
  return (
    <div className="hub-minimal">
      <div className="compact-coming-soon"><span className="availability-badge">COMING SOON</span><span>The Hub is being prepared.</span></div>
      <VerseOfTheDay />
    </div>
  );
}
