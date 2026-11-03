import Link from "next/link";
import { requireSeller } from "@/lib/seller";
import { MarketNav } from "@/components/market-nav";
export const metadata={title:"Seller hub"};
export default async function SellerPage(){
 const {supabase,business}=await requireSeller();
 const [{count:products,error:pError},{count:orders,error:oError}]=await Promise.all([supabase.from("products").select("id",{count:"exact",head:true}).eq("business_id",business.id),supabase.from("seller_orders").select("id",{count:"exact",head:true}).eq("business_id",business.id)]);
 if(pError||oError) throw new Error("Seller hub unavailable");
 return <><MarketNav area="seller"/><div className="section-heading"><p className="eyebrow">Your business, your people</p><h1 className="page-title">Welcome, {business.name}.</h1><p>One place to look after your products, orders and community.</p></div>{business.status!=="approved"&&<p className="notice notice-info">Your application is {business.status}. You can prepare drafts, but only approved listers can publish products.</p>}<div className="stats-grid"><div className="card"><span>Products</span><strong>{products??0}</strong></div><div className="card"><span>Seller orders</span><strong>{orders??0}</strong></div><div className="card"><span>Storefront</span><strong className="stat-text">{business.status==="approved"?"Approved":"In review"}</strong></div></div><div className="listing-invite"><div><h2>Something worth discovering?</h2><p>Add your next product and tell its story.</p></div><Link className="button button-primary" href="/seller/products/new">Add a product →</Link></div><p className="notice notice-info top-space">Payments and automatic payouts are not enabled. No bank or card details are collected by this app.</p></>;
}
