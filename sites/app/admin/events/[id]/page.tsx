import { notFound } from "next/navigation";
import { admin } from "@/lib/admin";
import { one, type Event } from "@/lib/data";
import { AdminNav, Saved } from "@/components/page-ui";
import { EventForm, HiddenRecord } from "@/components/forms";
import { ActionForm } from "@/components/action-form";
export const dynamic="force-dynamic";
export default async function EventAdmin({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{saved?:string}>}){const {id}=await params,query=await searchParams;await admin(`/admin/events/${id}`);const event=id==="new"?null:await one<Event>("SELECT * FROM hh_events WHERE id=?",id);if(id!=="new"&&!event)notFound();return <><AdminNav/><div className="content-narrow"><Saved value={query.saved}/><h1 className="page-title">{event?"Make it a meaningful gathering.":"Create an event."}</h1><section className="card top-space"><EventForm event={event}/></section>{event&&<section className="card top-space"><h2>Publication</h2><ActionForm action="event.status"><HiddenRecord record={event}/><div className="field"><label htmlFor="status">Event status</label><select id="status" name="status" defaultValue={event.status}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></div><button className="button button-primary">Update event status</button></ActionForm></section>}</div></>;}
