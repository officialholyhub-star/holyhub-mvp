import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { businessFields, type Business } from "@/lib/businesses";
import { BusinessForm } from "@/components/business-form";

export const metadata = { title: "Your business" };
export default async function MyBusinessPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const { supabase, user } = await requireUser("/account/business");
  const { data, error } = await supabase.from("businesses").select(businessFields).eq("owner_id", user.id).maybeSingle();
  if (error) throw new Error("Business profile unavailable");
  const business = data as Business | null;
  const { message } = await searchParams;
  return <section className="content-narrow">
    <Link href="/account" className="text-link">← My account</Link>
    <div className="section-heading"><p className="eyebrow">For Christian businesses</p><h1 className="page-title">{business ? "Your business, on HolyHub." : "Give your business a home."}</h1><p>Share what you do with a community that wants to discover you.</p></div>
    {message && <p className="notice notice-success" role="status">{message}</p>}
    {business && <div className="notice notice-info"><strong className="status-label">{business.status === "pending" ? "In review" : business.status === "approved" ? "Live on HolyHub" : "Needs another look"}</strong><p>{business.status === "pending" ? "Your profile is saved and waiting for HolyHub to review it." : business.status === "approved" ? "People can now discover your business. Changes will need another review." : "Your listing hasn’t been approved. Please check your details and contact us if you need help before resubmitting."}</p>{business.status === "approved" && <Link href={`/businesses/${business.id}`} className="text-link">View public listing →</Link>}{business.status === "rejected" && <a href="mailto:Official.holyhub@gmail.com" className="text-link">Contact HolyHub</a>}</div>}
    <div className="card"><BusinessForm key={business?.updated_at ?? "new"} business={business} /></div>
  </section>;
}
