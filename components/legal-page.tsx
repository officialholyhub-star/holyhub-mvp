import type { ReactNode } from "react";
import { HOLYHUB_LEGAL } from "@/lib/legal";

export function LegalPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <article className="legal-page">
      <header className="legal-hero">
        <p className="eyebrow">HolyHub legal</p>
        <h1>{title}</h1>
        <p className="lead">{intro}</p>
        <p className="legal-updated">Last updated: {HOLYHUB_LEGAL.lastUpdated}</p>
      </header>
      <div className="legal-content">{children}</div>
    </article>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="legal-section"><h2>{title}</h2>{children}</section>;
}

export function LegalBusinessDetails() {
  return (
    <div className="legal-contact-card">
      <strong>{HOLYHUB_LEGAL.operator}</strong>
      <span>{HOLYHUB_LEGAL.address}</span>
      <a href={`mailto:${HOLYHUB_LEGAL.email}`}>{HOLYHUB_LEGAL.email}</a>
      <small>This is HolyHub&apos;s business contact address, not a product returns address.</small>
    </div>
  );
}
