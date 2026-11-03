import Link from "next/link";
import type { Business } from "@/lib/businesses";

export function BusinessCard({ business }: { business: Business }) {
  return (
    <article className="business-card">
      <div className="business-mark" aria-hidden="true">{business.name.slice(0, 1).toUpperCase()}</div>
      <div className="business-card-body">
        <span className="category-chip">{business.category}</span>
        <h2><Link href={`/businesses/${business.id}`}>{business.name}</Link></h2>
        <p>{business.summary}</p>
        <div className="business-card-footer"><span>{business.location}</span><Link href={`/businesses/${business.id}`} aria-label={`Discover ${business.name}`}>Discover <span aria-hidden="true">→</span></Link></div>
      </div>
    </article>
  );
}
