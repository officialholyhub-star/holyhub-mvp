"use client";

import { useEffect, useState } from "react";

type Row = Record<string, unknown>;
type InputDefinition = { key: string; label: string; hint?: string; options?: string[]; required?: boolean };
type View = "organisations" | "contacts" | "routes" | "relationships" | "actions" | "safety" | "reviews";
const tabs: Array<{key:View;label:string}> = [
  {key:"organisations",label:"Organisations"}, {key:"contacts",label:"Contacts"},
  {key:"routes",label:"Contact routes"}, {key:"relationships",label:"Relationships"},
  {key:"actions",label:"Follow-ups"}, {key:"safety",label:"Contact safety"}, {key:"reviews",label:"Needs Review"},
];
const columns: Record<View, Array<[string,string]>> = {
  organisations:[["name","Organisation"],["domain","Domain"],["category","Category"],["state","Status"]],
  contacts:[["name","Contact"],["organisation","Organisation"],["jobTitle","Role"],["state","Status"]],
  routes:[["owner","Owner"],["channel","Channel"],["routeValue","Fictional route"],["health","Health"]],
  relationships:[["organisation","Organisation"],["relationshipType","Type"],["stage","Stage"],["priority","Priority"]],
  actions:[["title","Action"],["organisation","Organisation"],["status","Status"],["dueAt","Due"]],
  safety:[["safetyType","Control"],["scopeType","Scope"],["routeNormalisedValue","Route"],["organisationKey","Organisation"],["status","Status"]],
  reviews:[["summary","Issue"],["kind","Type"],["status","Status"],["createdAt","Received"]],
};
const forms: Partial<Record<View,{action:string;title:string;fields:InputDefinition[]}>> = {
  organisations:{action:"saveOrganisation",title:"Create or edit a fictional organisation",fields:[
    {key:"name",label:"Name",hint:"Example Studio",required:true},
    {key:"domain",label:"Fictional domain",hint:"studio.example"},
    {key:"category",label:"Category",hint:"Christian brand"}]},
  contacts:{action:"saveContact",title:"Create or edit a fictional contact",fields:[
    {key:"name",label:"Name",hint:"Example Person",required:true},
    {key:"organisationId",label:"Organisation ID (optional)"},
    {key:"jobTitle",label:"Role"}]},
  routes:{action:"saveRoute",title:"Create or update a fictional contact route",fields:[
    {key:"contactId",label:"Contact ID (or organisation ID)"},
    {key:"organisationId",label:"Organisation ID (or contact ID)"},
    {key:"channel",label:"Channel",options:["email","phone","whatsapp"],required:true},
    {key:"routeValue",label:"Fictional route",hint:"someone@fictional.test",required:true},
    {key:"health",label:"Route health",options:["unknown","valid","failed","held"],required:true}]},
  relationships:{action:"transitionStage",title:"Change an existing synthetic relationship stage",fields:[
    {key:"relationshipId",label:"Relationship ID",required:true},
    {key:"newStageId",label:"Next stage ID (from stage list)",required:true},
    {key:"reason",label:"Reason",hint:"Synthetic operator stage review"}]},
  actions:{action:"createAction",title:"Add a fictional follow-up",fields:[
    {key:"relationshipId",label:"Relationship ID",required:true},
    {key:"actionType",label:"Action type",options:["follow_up","reply","call","needs_review"],required:true},
    {key:"title",label:"Fictional action",hint:"Example follow-up on application",required:true},
    {key:"dueAt",label:"Due at (ISO time, optional)",hint:"2026-12-02T15:00:00Z"}]},
  safety:{action:"applySafety",title:"Apply evidence-backed synthetic contact safety",fields:[
    {key:"scopeType",label:"Scope",options:["route","contact","organisation"],required:true},
    {key:"safetyType",label:"Control",options:["marketing_objection","failed_route","temporary_hold"],required:true},
    {key:"channel",label:"Channel",options:["email","phone","whatsapp"],required:true},
    {key:"purpose",label:"Purpose",options:["marketing","outreach","all"],required:true},
    {key:"routeValue",label:"Fictional route",hint:"held@fictional.test"},
    {key:"organisationId",label:"Organisation ID (organisation scope)"},
    {key:"organisationKey",label:"Persistent fictional organisation domain",hint:"brand.example"},
    {key:"contactId",label:"Contact ID (contact scope)"},
    {key:"contactRouteId",label:"Route ID (route scope)"},
    {key:"reason",label:"Reason with evidence",required:true},
    {key:"sourceReference",label:"Evidence reference",hint:"synthetic:test-case-01",required:true}]},
};
const defaults:Record<string,string>={channel:"email",health:"unknown",scopeType:"route",purpose:"marketing",safetyType:"failed_route",actionType:"follow_up"};
const cell=(value:unknown)=> value==null||value===""?"—":typeof value==="object"?JSON.stringify(value):String(value);

export default function CrmConsole({role}:{role:string}) {
  const [tab,setTab]=useState<View>("organisations");
  const [search,setSearch]=useState("");
  const [records,setRecords]=useState<Row[]>([]);
  const [form,setForm]=useState<Record<string,string>>(defaults);
  const [editId,setEditId]=useState("");
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [timeline,setTimeline]=useState<Row[]>([]);
  const [stageList,setStageList]=useState<Row[]>([]);
  const [checkRoute,setCheckRoute]=useState("");
  const [checkResult,setCheckResult]=useState<Row|null>(null);
  const [reviewReason,setReviewReason]=useState("");
  const [clearReason,setClearReason]=useState("");
  const [clearEvidence,setClearEvidence]=useState("");
  const editable=role==="crm_admin"||role==="crm_operator";

  async function getView(view:string,q="",id=""):Promise<Row> {
    const params=new URLSearchParams({view,q});
    if(id)params.set("id",id);
    const response=await fetch("/api/crm/operate?"+params.toString(),{cache:"no-store"});
    const body=await response.json() as {ok:boolean;error?:string;data?:Row};
    if(!body.ok||!body.data)throw new Error(body.error||"CRM read unavailable");
    return body.data;
  }
  async function refresh(view:View=tab,q=search) {
    setBusy(true);setError("");
    try {
      const result=await getView(view,q);
      setRecords(Array.isArray(result.rows)?result.rows as Row[]:[]);
    }catch(e){setError(e instanceof Error?e.message:"Unable to load CRM records");}
    finally{setBusy(false);}
  }
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      try {
        const result=await getView(tab,"");
        if(!cancelled){setRecords(Array.isArray(result.rows)?result.rows as Row[]:[]);setError("");}
      } catch(e) { if(!cancelled)setError(e instanceof Error?e.message:"CRM unavailable"); }
    })();
    return ()=>{cancelled=true;};
  },[tab]);
  useEffect(()=>{
    let cancelled=false;
    getView("stages").then(r=>{if(!cancelled)setStageList(Array.isArray(r.rows)?r.rows as Row[]:[]);}).catch(()=>{});
    return ()=>{cancelled=true;};
  },[]);
  function changeTab(next:View) {
    setTab(next);setSearch("");setRecords([]);setForm(defaults);setEditId("");setTimeline([]);setCheckResult(null);setMessage("");setError("");
  }
  function edit(row:Row) {
    const mapped:Record<string,string>={...defaults};
    for(const field of forms[tab]?.fields??[]) {
      const raw=row[field.key];
      if(raw!==undefined&&raw!==null)mapped[field.key]=String(raw);
    }
    if(tab==="organisations")mapped.name=String(row.name||"");
    if(tab==="contacts")mapped.name=String(row.name||"");
    if(tab==="relationships")mapped.relationshipId=String(row.id||"");
    if(tab==="routes")mapped.routeValue=String(row.routeValue||"");
    setForm(mapped);
    setEditId(["organisations","contacts","routes"].includes(tab)?String(row.id):"");
    setMessage("Record selected. Edit the fields below; no changes until you save.");
  }
  async function mutate(operation:string,data:Record<string,string>) {
    if(!editable)return;
    setBusy(true);setError("");setMessage("");
    try{
      const response=await fetch("/api/crm/operate",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({operation,data}),
      });
      const result=await response.json() as {ok:boolean;error?:string;data?:Row};
      if(!result.ok)throw new Error(result.error||"Operation failed");
      setMessage(result.data?.replayed?"Existing active control reused; no duplicate created.":"Synthetic change saved and audited.");
      setForm(defaults);setEditId("");await refresh();
    }catch(e){setError(e instanceof Error?e.message:"Unable to save");}
    finally{setBusy(false);}
  }
  async function showTimeline(id:string) {
    setBusy(true);setError("");
    try {
      const result=await getView("timeline","",id);
      setTimeline(Array.isArray(result.rows)?result.rows as Row[]:[]);
      setMessage("Correspondence and activity timeline (synthetic evidence only).");
    }catch(e){setError(e instanceof Error?e.message:"Timeline unavailable");}
    finally{setBusy(false);}
  }
  async function checkEligibility() {
    setBusy(true);setError("");setCheckResult(null);
    try{setCheckResult(await getView("eligibility",checkRoute));}
    catch(e){setError(e instanceof Error?e.message:"Eligibility check failed");}
    finally{setBusy(false);}
  }
  const formDefinition=forms[tab];
  return (
    <section style={{marginTop:32}}>
      <div className="admin-workspace-header">
        <div>
          <p className="eyebrow">N18 · Implementation 2A</p>
          <h2>CRM operator workspace</h2>
          <p className="muted-small">Synthetic records only. No live inbox connection, real identities, email sending or CRM cutover.</p>
        </div>
        <span className="admin-summary">{role==="crm_viewer"?"Read-only access":role==="crm_admin"?"Administrator":"Operator"}</span>
      </div>
      <nav aria-label="CRM operator areas" style={{display:"flex",gap:8,flexWrap:"wrap",margin:"16px 0"}}>
        {tabs.map(item=><button key={item.key} type="button" aria-current={tab===item.key?"page":undefined}
          onClick={()=>changeTab(item.key)}
          style={{padding:"9px 13px",borderRadius:9,border:"1px solid #b9cad6",
            background:tab===item.key?"#dceff8":"transparent",color:"inherit",cursor:"pointer"}}>{item.label}</button>)}
      </nav>
      {error&&<p role="alert" style={{color:"#a52b2b"}}>{error}</p>}
      {message&&<p role="status">{message}</p>}
      <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"end",marginBottom:14}}>
        <label style={{display:"grid",gap:5,flex:"1 1 230px"}}>Search current area
          <input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search synthetic records"
            style={{padding:10,border:"1px solid #cbd6dd",borderRadius:7}}/>
        </label>
        <button type="button" disabled={busy} onClick={()=>void refresh()} style={{padding:11}}>Search / refresh</button>
      </div>
      <div style={{overflowX:"auto",border:"1px solid #d2dce3",borderRadius:10}}>
        <table style={{width:"100%",borderCollapse:"collapse",textAlign:"left"}}>
          <thead><tr>{columns[tab].map(([key,label])=><th key={key} style={{padding:10,borderBottom:"1px solid #d2dce3"}}>{label}</th>)}<th style={{padding:10,borderBottom:"1px solid #d2dce3"}}>Actions</th></tr></thead>
          <tbody>{records.map(row=><tr key={String(row.id)}>{columns[tab].map(([key])=>
            <td key={key} style={{padding:10,borderBottom:"1px solid #e8edf1",fontSize:13}}>{cell(row[key])}</td>)}
            <td style={{padding:10,borderBottom:"1px solid #e8edf1"}}>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {editable&&formDefinition&&<button type="button" onClick={()=>edit(row)}>Select</button>}
                {tab==="relationships"&&<button type="button" onClick={()=>void showTimeline(String(row.id))}>Timeline</button>}
                {tab==="actions"&&editable&&row.status==="open"&&<button type="button" disabled={busy}
                  onClick={()=>void mutate("completeAction",{id:String(row.id)})}>Complete</button>}
                {tab==="reviews"&&editable&&<button type="button" disabled={busy||reviewReason.trim().length<8}
                  onClick={()=>void mutate("resolveReview",{id:String(row.id),kind:String(row.kind),reason:reviewReason})}>Resolve</button>}
                {tab==="safety"&&role==="crm_admin"&&row.status==="active"&&
                  <button type="button" disabled={busy||clearReason.trim().length<8||!clearEvidence.startsWith("synthetic:review-")}
                    onClick={()=>void mutate("clearSafety",{id:String(row.id),reason:clearReason,evidenceReference:clearEvidence})}>Clear after review</button>}
              </div>
            </td></tr>)}
            {records.length===0&&<tr><td colSpan={columns[tab].length+1} style={{padding:18}}>{busy?"Loading…":"No matching synthetic records."}</td></tr>}
          </tbody>
        </table>
      </div>
      {tab==="relationships"&&<section style={{marginTop:16}}>
        <h3>Activity and correspondence</h3>
        <p className="muted-small">Select Timeline on a relationship. No live messages are imported.</p>
        {timeline.map((item,i)=><p key={String(item.id||i)} style={{padding:"7px 0",borderBottom:"1px solid #e9edf1"}}>
          <strong>{cell(item.type)}</strong> — {cell(item.summary)} <small>({cell(item.occurredAt)})</small></p>)}
      </section>}
      {tab==="relationships"&&stageList.length>0&&<details style={{marginTop:12}}>
        <summary>Available stage IDs</summary>{stageList.map(s=><p key={String(s.id)}><strong>{cell(s.name)}</strong> · {cell(s.id)} · pipeline {cell(s.pipelineId)}</p>)}
      </details>}
      {tab==="reviews"&&editable&&<label style={{display:"grid",gap:5,marginTop:16}}>
        Evidence-backed review outcome (minimum eight characters)
        <textarea value={reviewReason} rows={2} onChange={e=>setReviewReason(e.target.value)} placeholder="Synthetic review decision" />
      </label>}
      {tab==="safety"&&<>
        <section style={{marginTop:18,padding:12,border:"1px solid #d2dce3",borderRadius:10}}>
          <h3>Fail-closed route check</h3>
          <p className="muted-small">Testing a fictional address never authorises sending. Objections and failed-route holds apply regardless of sender mailbox.</p>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <input value={checkRoute} onChange={e=>setCheckRoute(e.target.value)} aria-label="Fictional email route" placeholder="someone@fictional.test" />
            <button type="button" disabled={busy} onClick={()=>void checkEligibility()}>Check route</button>
          </div>
          {checkResult&&<p role="status">Delivery: BLOCKED · Safety: {String((checkResult.assessment as Row)?.safetyBlocked?"active control":"no matched control")} ·
            Reasons: {cell((checkResult.assessment as Row)?.reasons)}</p>}
        </section>
        {role==="crm_admin"&&<section style={{marginTop:18}}>
          <h3>Restricted safety clearance</h3>
          <p className="muted-small">Clearance never deletes the old safety evidence. Enter documented fictional review evidence before using a row’s Clear button.</p>
          <div style={{display:"grid",gap:10,maxWidth:540}}>
            <label>Review reason<input value={clearReason} onChange={e=>setClearReason(e.target.value)} placeholder="Evidence from synthetic review"/></label>
            <label>Review reference<input value={clearEvidence} onChange={e=>setClearEvidence(e.target.value)} placeholder="synthetic:review-case-01"/></label>
          </div>
        </section>}
      </>}
      {formDefinition&&editable&&<form onSubmit={e=>{e.preventDefault();void mutate(formDefinition.action,{...form,...(editId?{id:editId}:{})});}}
        style={{marginTop:24,padding:16,border:"1px solid #d2dce3",borderRadius:10}}>
        <h3>{formDefinition.title}</h3>
        <p className="muted-small">Use only Example/Synthetic/Test people and organisations; fictional .example/.test/.invalid addresses.</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(215px,1fr))",gap:12}}>
          {formDefinition.fields.map(f=><label key={f.key} style={{display:"grid",gap:5,fontSize:13}}>{f.label}
            {f.options?<select required={f.required} value={form[f.key]||f.options[0]} onChange={e=>setForm(old=>({...old,[f.key]:e.target.value}))}
                style={{padding:9,border:"1px solid #cad6dd"}}>{f.options.map(v=><option key={v} value={v}>{v.replaceAll("_"," ")}</option>)}</select>:
              <input required={f.required} value={form[f.key]||""} placeholder={f.hint} onChange={e=>setForm(old=>({...old,[f.key]:e.target.value}))}
                style={{padding:9,border:"1px solid #cad6dd"}}/>}
          </label>)}
        </div>
        <div style={{display:"flex",gap:10,marginTop:16}}>
          <button type="submit" disabled={busy} style={{padding:"10px 16px"}}>{editId?"Save changes":"Save synthetic record"}</button>
          <button type="button" onClick={()=>{setForm(defaults);setEditId("");}}>Reset</button>
        </div>
      </form>}
    </section>
  );
}
