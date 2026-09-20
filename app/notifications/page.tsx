import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { safeNextPath } from "@/lib/auth/redirects";
import { MarketNav } from "@/components/market-nav";
import { SubmitButton } from "@/components/submit-button";
import { markRead } from "./actions";
export default async function Notifications(){const {supabase,user}=await requireUser("/notifications");const {data,error}=await supabase.from("notifications").select("*").eq("user_id",user.id).order("created_at",{ascending:false}).limit(100);if(error)throw new Error("Notifications unavailable");return <><MarketNav/><div className="split-heading"><h1 className="page-title">Your updates.</h1><form action={markRead}><SubmitButton className="button button-quiet">Mark all as read</SubmitButton></form></div><p>Updates appear here in your account. Email notifications are not connected yet.</p><div className="record-list">{data.map(n=><Link className="record-row" href={safeNextPath(n.href)} key={n.id}><div><h2>{n.message}</h2><span className="muted-small">{new Date(n.created_at).toLocaleDateString("en-GB",{timeZone:"UTC"})}</span></div>{!n.read_at&&<span className="status-pill">New</span>}<span aria-hidden="true">→</span></Link>)}</div>{!data.length&&<div className="empty-state card"><h2>You’re all caught up.</h2><p>Your order and refund updates will appear here.</p></div>}</>;}
