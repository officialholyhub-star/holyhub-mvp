import "server-only";

import { assertCrmDatabaseEnvironment, getCrmPool } from "@/lib/crm/db/client";
import { getCrmEnvironment } from "@/lib/crm/env";
import { completeCrmAction } from "@/lib/crm/services/actions";
import { transitionRelationshipStage } from "@/lib/crm/services/relationships";
import {
  assessSyntheticEligibility, isFictionalOrganisation, isFictionalRoute, normaliseRoute, type SafetyMatch,
} from "@/lib/crm/safety/rules";

type SqlRow = Record<string, unknown>;
type SqlClient = { query: (sql: string, values?: unknown[]) => Promise<{ rows: SqlRow[] }> };
type RequestData = Record<string, unknown>;
export class CrmInputError extends Error { constructor(message: string) { super(message); this.name = "CrmInputError"; } }

function validId(v: unknown, optional = false): string | null {
  if ((v === null || v === undefined || v === "") && optional) return null;
  if (typeof v !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) {
    throw new CrmInputError("A valid record ID is required.");
  }
  return v;
}
function field(v: unknown, name: string, max = 240, optional = false): string {
  if ((v === null || v === undefined || v === "") && optional) return "";
  if (typeof v !== "string" || !v.trim() || v.trim().length > max) throw new CrmInputError(name + " is required (maximum " + max + " characters).");
  return v.trim();
}
function choice(v: unknown, choices: string[], label: string): string {
  if (typeof v !== "string" || !choices.includes(v)) throw new CrmInputError("Invalid " + label + ".");
  return v;
}
function syntheticOnly(): void {
  if (getCrmEnvironment() === "production") throw new CrmInputError("N18 2A writes are sandbox-only.");
}
async function withTx<T>(fn: (client: SqlClient) => Promise<T>): Promise<T> {
  syntheticOnly();
  await assertCrmDatabaseEnvironment();
  const client = await getCrmPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client as unknown as SqlClient);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
async function audit(c: SqlClient, entityType: string, entityId: string, actor: string, fieldName: string, oldValue: unknown, newValue: unknown, reason: string) {
  await c.query(
    `INSERT INTO crm_audit.field_change_audit (entity_type,entity_id,field_name,old_value,new_value,actor_internal_user_id,source,reason)
     VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6,'n18_synthetic_2a',$7)`,
    [entityType,entityId,fieldName,JSON.stringify(oldValue ?? null),JSON.stringify(newValue ?? null),actor,reason],
  );
}
async function activity(c: SqlClient, actor: string, activityType: string, summary: string, ids: { organisationId?: string | null; contactId?: string | null; relationshipId?: string | null } = {}) {
  await c.query(
    `INSERT INTO crm_audit.activity (organisation_id,contact_id,relationship_id,activity_type,actor_internal_user_id,source_system,summary)
     VALUES ($1,$2,$3,$4,$5,'n18_synthetic_2a',$6)`,
    [ids.organisationId ?? null,ids.contactId ?? null,ids.relationshipId ?? null,activityType,actor,summary],
  );
}
function queryText(q: string): string { return q.slice(0,120).trim(); }

export async function listOperatorView(view: string, query: string, relatedId?: string, subjectOrganisationId?: string, subjectContactId?: string) {
  await assertCrmDatabaseEnvironment();
  if (getCrmEnvironment() === "production") throw new CrmInputError("N18 2A console is sandbox-only.");
  const q = queryText(query);
  const db = getCrmPool();
  let sql: string, args: unknown[] = [q];
  switch (view) {
    case "organisations":
      sql = `SELECT id,canonical_name AS "name",canonical_domain AS "domain",category,legal_classification AS "classification",
        lifecycle_state AS "state",source_confidence AS "confidence" FROM crm.organisations
        WHERE canonical_name ILIKE '%'||$1||'%' OR coalesce(canonical_domain,'') ILIKE '%'||$1||'%'
        ORDER BY updated_at DESC LIMIT 50`; break;
    case "contacts":
      sql = `SELECT c.id,c.organisation_id AS "organisationId",c.display_name AS "name",c.job_title AS "jobTitle",
        o.canonical_name AS "organisation",c.lifecycle_state AS "state" FROM crm.contacts c
        LEFT JOIN crm.organisations o ON o.id=c.organisation_id
        WHERE c.display_name ILIKE '%'||$1||'%' OR coalesce(o.canonical_name,'') ILIKE '%'||$1||'%'
        ORDER BY c.updated_at DESC LIMIT 50`; break;
    case "routes":
      sql = `SELECT r.id,r.contact_id AS "contactId",r.organisation_id AS "organisationId",r.channel,
        r.route_value AS "routeValue",r.health,r.normalised_value AS "normalisedValue",
        coalesce(c.display_name,o.canonical_name,'Unlinked') AS "owner"
        FROM crm.contact_routes r LEFT JOIN crm.contacts c ON c.id=r.contact_id
        LEFT JOIN crm.organisations o ON o.id=r.organisation_id
        WHERE r.route_value ILIKE '%'||$1||'%' OR coalesce(c.display_name,o.canonical_name,'') ILIKE '%'||$1||'%'
        ORDER BY r.updated_at DESC LIMIT 50`; break;
    case "relationships":
      sql = `SELECT r.id,r.organisation_id AS "organisationId",o.canonical_name AS "organisation",
        r.relationship_type AS "relationshipType",r.pipeline_id AS "pipelineId",r.current_stage_id AS "stageId",
        s.name AS "stage",r.priority,r.freshness_state AS "freshness"
        FROM crm.relationships r JOIN crm.organisations o ON o.id=r.organisation_id
        LEFT JOIN crm_config.pipeline_stages s ON s.id=r.current_stage_id
        WHERE o.canonical_name ILIKE '%'||$1||'%' OR r.relationship_type ILIKE '%'||$1||'%'
        ORDER BY r.updated_at DESC LIMIT 50`; break;
    case "stages":
      sql = `SELECT s.id,s.pipeline_id AS "pipelineId",s.name,s.stage_order AS "order"
        FROM crm_config.pipeline_stages s WHERE s.active=true ORDER BY s.pipeline_id,s.stage_order LIMIT 100`;
      args=[]; break;
    case "actions":
      sql = `SELECT a.id,a.relationship_id AS "relationshipId",a.action_type AS "actionType",
        a.title,a.status,a.due_at AS "dueAt",a.assigned_to_internal_user_id AS "assigneeId",
        o.canonical_name AS "organisation" FROM crm.actions a
        JOIN crm.relationships r ON r.id=a.relationship_id
        JOIN crm.organisations o ON o.id=r.organisation_id
        WHERE a.title ILIKE '%'||$1||'%' OR o.canonical_name ILIKE '%'||$1||'%'
        ORDER BY (a.status='open') DESC,a.due_at NULLS LAST LIMIT 50`; break;
    case "safety":
      sql = `SELECT id,scope_type AS "scopeType",organisation_id AS "organisationId",contact_id AS "contactId",
        contact_route_id AS "contactRouteId",channel,purpose,safety_type AS "safetyType",status,reason,
        route_normalised_value AS "routeNormalisedValue",organisation_key AS "organisationKey",
        source_system AS "sourceSystem",source_reference AS "sourceReference",
        evidence_recorded_at AS "evidenceRecordedAt",clearance_evidence AS "clearanceEvidence"
        FROM crm.safety WHERE
        coalesce(route_normalised_value,'') ILIKE '%'||$1||'%' OR coalesce(organisation_key,'') ILIKE '%'||$1||'%'
        OR reason ILIKE '%'||$1||'%' ORDER BY created_at DESC LIMIT 75`; break;
    case "reviews":
      sql = `SELECT a.id::text AS id,'action' AS kind,a.title AS summary,a.status,
        a.created_at AS "createdAt" FROM crm.actions a
        WHERE a.status='open' AND a.action_type='needs_review' AND a.title ILIKE '%'||$1||'%'
        UNION ALL SELECT e.id::text AS id,'event' AS kind,e.event_type AS summary,e.status,
        e.received_at AS "createdAt" FROM crm_ops.integration_events e
        WHERE e.status='needs_review' AND e.source_system='synthetic' AND e.event_type ILIKE '%'||$1||'%'
        ORDER BY "createdAt" DESC LIMIT 50`; break;
    case "timeline":
      args=[validId(relatedId)];
      sql = `SELECT id,activity_type AS "type",summary,source_system AS "source",
        channel,occurred_at AS "occurredAt" FROM crm_audit.activity
        WHERE relationship_id=$1 ORDER BY occurred_at DESC LIMIT 100`; break;
    case "eligibility": {
      let normal: string;
      try { normal = normaliseRoute("email", q); } catch { throw new CrmInputError("A fictional email route is required."); }
      if (!isFictionalRoute("email",normal)) throw new CrmInputError("Only fictional .test/.example/.invalid routes are allowed.");
      let organisationId=validId(subjectOrganisationId,true);
      let contactId=validId(subjectContactId,true);
      const linked=await db.query(`SELECT contact_id,organisation_id,health FROM crm.contact_routes
        WHERE channel='email' AND normalised_value=$1 LIMIT 1`,[normal]);
      if(linked.rows.length) {
        contactId=contactId??(linked.rows[0].contact_id?String(linked.rows[0].contact_id):null);
        organisationId=organisationId??(linked.rows[0].organisation_id?String(linked.rows[0].organisation_id):null);
      }
      if(contactId&&!organisationId){
        const linkedContact=await db.query("SELECT organisation_id FROM crm.contacts WHERE id=$1",[contactId]);
        organisationId=linkedContact.rows[0]?.organisation_id?String(linkedContact.rows[0].organisation_id):null;
      }
      let organisationKey:string|null=null;
      if(organisationId) {
        const org=await db.query("SELECT canonical_domain,canonical_name FROM crm.organisations WHERE id=$1",[organisationId]);
        organisationKey=org.rows.length?String(org.rows[0].canonical_domain||org.rows[0].canonical_name).trim().toLowerCase():null;
      }
      const results = await db.query(`SELECT status,scope_type AS "scopeType",safety_type AS "safetyType",
         channel,purpose,route_normalised_value AS "routeNormalisedValue",organisation_key AS "organisationKey",
         organisation_id AS "organisationId",contact_id AS "contactId" FROM crm.safety
         WHERE status='active' AND (route_normalised_value=$1
           OR (organisation_key IS NOT NULL AND organisation_key=$2)
           OR (organisation_id IS NOT NULL AND organisation_id=$3)
           OR (contact_id IS NOT NULL AND contact_id=$4))`,[normal,organisationKey,organisationId,contactId]);
      const controls=results.rows as SafetyMatch[];
      const assessment=assessSyntheticEligibility({
        channel:"email",routeValue:normal,purpose:"marketing",organisationId,organisationKey,contactId,
      },controls);
      const health=linked.rows[0]?.health;
      if(health==="failed"||health==="held"){
        assessment.safetyBlocked=true;
        assessment.reasons=[...new Set([...assessment.reasons,"route_health_"+health])];
      }
      return { assessment,controls };
    }
    default: throw new CrmInputError("Unknown CRM view.");
  }
  const result = await db.query(sql,args);
  return { rows: result.rows };
}

export async function runOperatorMutation(operation: string, data: RequestData, actor: string, role: string) {
  syntheticOnly();
  switch (operation) {
    case "saveOrganisation": return withTx(async c => {
      const id=validId(data.id,true);
      const name=field(data.name,"Fictional organisation name");
      const domain=field(data.domain,"Fictional domain",200,true).toLowerCase()||null;
      if (!isFictionalOrganisation(name,domain)) throw new CrmInputError("Use Example/Synthetic/Test names and fictional domains only.");
      const category=field(data.category,"Category",80,true)||null;
      const old=id ? (await c.query("SELECT * FROM crm.organisations WHERE id=$1",[id])).rows[0] : null;
      if (id&&!old) throw new CrmInputError("Organisation not found.");
      const result=await c.query(id
        ? `UPDATE crm.organisations SET canonical_name=$2,canonical_domain=$3,category=$4,updated_at=now() WHERE id=$1 RETURNING *`
        : `INSERT INTO crm.organisations(canonical_name,canonical_domain,category,source_confidence) VALUES($1,$2,$3,'synthetic') RETURNING *`,
        id?[id,name,domain,category]:[name,domain,category]);
      const row=result.rows[0];
      await audit(c,"organisation",String(row.id),actor,id?"record_updated":"record_created",old,row,"Synthetic operator edit");
      await activity(c,actor,"organisation_saved","Synthetic organisation saved",{organisationId:String(row.id)});
      return row;
    });
    case "saveContact": return withTx(async c => {
      const id=validId(data.id,true);
      const displayName=field(data.name,"Fictional contact name");
      if (!/^(example|synthetic|test)(?:\s|\s*[-:])/i.test(displayName)) throw new CrmInputError("Contact must have an Example/Synthetic/Test name.");
      const organisationId=validId(data.organisationId,true);
      const jobTitle=field(data.jobTitle,"Job title",120,true)||null;
      const old=id?(await c.query("SELECT * FROM crm.contacts WHERE id=$1",[id])).rows[0]:null;
      if (id&&!old) throw new CrmInputError("Contact not found.");
      const row=(await c.query(id
        ? `UPDATE crm.contacts SET display_name=$2,organisation_id=$3,job_title=$4,updated_at=now() WHERE id=$1 RETURNING *`
        : `INSERT INTO crm.contacts(display_name,organisation_id,job_title,source_confidence) VALUES($1,$2,$3,'synthetic') RETURNING *`,
        (id?[id,displayName,organisationId,jobTitle]:[displayName,organisationId,jobTitle]))).rows[0];
      await audit(c,"contact",String(row.id),actor,id?"record_updated":"record_created",old,row,"Synthetic operator edit");
      await activity(c,actor,"contact_saved","Synthetic contact saved",{contactId:String(row.id),organisationId});
      return row;
    });
    case "saveRoute": return withTx(async c => {
      const id=validId(data.id,true);
      const contactId=validId(data.contactId,true);
      const organisationId=validId(data.organisationId,true);
      if (!contactId&&!organisationId) throw new CrmInputError("Select a contact or organisation owner.");
      const channel=choice(data.channel,["email","phone","whatsapp"],"channel");
      let normal: string;
      try {normal=normaliseRoute(channel,field(data.routeValue,"Fictional route"));} catch {throw new CrmInputError("Invalid fictional route.");}
      if (!isFictionalRoute(channel,normal)) throw new CrmInputError("Only reserved fictional addresses/numbers are allowed.");
      const health=choice(data.health,["unknown","valid","failed","held"],"route health");
      const old=id?(await c.query("SELECT * FROM crm.contact_routes WHERE id=$1",[id])).rows[0]:null;
      if(id&&!old)throw new CrmInputError("Route not found.");
      const row=(await c.query(id
        ? `UPDATE crm.contact_routes SET contact_id=$2,organisation_id=$3,channel=$4,route_value=$5,normalised_value=$6,health=$7,updated_at=now() WHERE id=$1 RETURNING *`
        : `INSERT INTO crm.contact_routes (contact_id,organisation_id,channel,route_value,normalised_value,health)
           VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
        (id?[id,contactId,organisationId,channel,normal,normal,health]:[contactId,organisationId,channel,normal,normal,health]))).rows[0];
      await audit(c,"contact_route",String(row.id),actor,id?"record_updated":"record_created",old,row,"Synthetic contact route edit");
      if(health==="failed"||health==="held") {
        const controlType=health==="failed"?"failed_route":"temporary_hold";
        const held=await c.query(`INSERT INTO crm.safety
          (scope_type,contact_route_id,channel,purpose,safety_type,reason,source_system,source_reference,route_normalised_value)
          VALUES ('route',$1,$2,'marketing',$3,$4,'n18_synthetic_2a',$5,$6)
          ON CONFLICT DO NOTHING RETURNING id`,
          [row.id,channel,controlType,"Synthetic route health set to "+health,"synthetic:route-health:"+row.id,normal]);
        if(held.rows.length)await audit(c,"safety",String(held.rows[0].id),actor,"status",null,"active","Synthetic route health hold");
      }
      await activity(c,actor,"route_saved","Synthetic contact route saved",{contactId,organisationId});
      return row;
    });
    case "transitionStage": {
      return transitionRelationshipStage({relationshipId:validId(data.relationshipId)!,newStageId:validId(data.newStageId)!,
        actorInternalUserId:actor,reason:field(data.reason,"Reason",500,true)||"Synthetic operator stage transition",source:"n18_synthetic_2a"});
    }
    case "createAction": {
      const actionType=choice(data.actionType,["reply","follow_up","call","needs_review"],"action type");
      const title=field(data.title,"Action title");
      if(!/^(example|synthetic|test)(?:\s|\s*[-:])/i.test(title))throw new CrmInputError("Action must use a fictional title.");
      let dueAt:Date|null=null;
      if(data.dueAt){dueAt=new Date(field(data.dueAt,"Due date",60));if(Number.isNaN(dueAt.getTime()))throw new CrmInputError("Invalid due date.");}
      const relationshipId=validId(data.relationshipId)!;
      return withTx(async c=>{
        await c.query("SELECT pg_advisory_xact_lock(hashtext($1))",[relationshipId+"|"+actionType+"|"+title.toLowerCase()]);
        const existing=(await c.query(`SELECT * FROM crm.actions
          WHERE relationship_id=$1 AND action_type=$2 AND lower(title)=lower($3) AND status='open'
          ORDER BY created_at DESC LIMIT 1`,[relationshipId,actionType,title])).rows[0];
        if(existing)return {...existing,replayed:true};
        const relationship=(await c.query("SELECT organisation_id FROM crm.relationships WHERE id=$1",[relationshipId])).rows[0];
        if(!relationship)throw new CrmInputError("Relationship not found.");
        const row=(await c.query(`INSERT INTO crm.actions
          (relationship_id,organisation_id,action_type,title,due_at,status,assigned_to_internal_user_id,source)
          VALUES($1,$2,$3,$4,$5,'open',$6,'n18_synthetic_2a') RETURNING *`,
          [relationshipId,relationship.organisation_id,actionType,title,dueAt,actor])).rows[0];
        await activity(c,actor,"action_created","Synthetic action created: "+title,{
          relationshipId,organisationId:String(relationship.organisation_id),
        });
        return {...row,replayed:false};
      });
    }
    case "completeAction": return completeCrmAction(validId(data.id)!,actor);
    case "applySafety": return withTx(async c => {
      const scope=choice(data.scopeType,["route","contact","organisation"],"safety scope");
      const safetyType=choice(data.safetyType,["marketing_objection","failed_route","temporary_hold"],"safety type");
      const channel=choice(data.channel,["email","phone","whatsapp"],"channel");
      if(safetyType==="failed_route"&&(scope!=="route"||channel!=="email"))throw new CrmInputError("Failed-route controls apply only to email routes.");
      const purpose=choice(data.purpose,["marketing","outreach","all"],"purpose");
      const reason=field(data.reason,"Evidence-based reason",500);
      if(reason.length<8)throw new CrmInputError("A more specific reason is required.");
      const sourceReference=field(data.sourceReference,"Synthetic evidence reference",240);
      if(!sourceReference.startsWith("synthetic:"))throw new CrmInputError("2A only accepts synthetic: evidence references.");
      const contactId=scope==="contact"?validId(data.contactId,true):null;
      const organisationId=scope==="organisation"?validId(data.organisationId,true):null;
      const routeId=scope==="route"?validId(data.contactRouteId,true):null;
      let route=field(data.routeValue,"Fictional route",240,true);
      if(routeId){
        const match=(await c.query("SELECT channel,normalised_value FROM crm.contact_routes WHERE id=$1",[routeId])).rows[0];
        if(!match)throw new CrmInputError("Contact route not found.");
        if(match.channel!==channel)throw new CrmInputError("Contact route channel mismatch.");
        route=String(match.normalised_value);
      }
      let normal: string|null=null;
      if(route) {
        try {normal=normaliseRoute(channel,route);} catch {throw new CrmInputError("Invalid contact route.");}
        if(!isFictionalRoute(channel,normal))throw new CrmInputError("Only fictional routes are allowed.");
      }
      let key=field(data.organisationKey,"Fictional organisation key",200,true).toLowerCase()||null;
      if(organisationId){
        const org=(await c.query("SELECT canonical_name,canonical_domain FROM crm.organisations WHERE id=$1",[organisationId])).rows[0];
        if(!org)throw new CrmInputError("Organisation not found.");
        key=String(org.canonical_domain||org.canonical_name).trim().toLowerCase();
      }
      if(key&&!/(?:^|\.)(?:example|test|invalid)$/.test(key))throw new CrmInputError("Only fictional organisation keys are allowed.");
      if(scope==="organisation"&&!key)throw new CrmInputError("Organisation requires a persistent fictional domain/key.");
      if(scope==="route"&&!normal)throw new CrmInputError("Route safety requires a persistent fictional route.");
      if(scope==="contact"&&(!contactId||!normal))throw new CrmInputError("Contact objection requires contact ID and durable fictional route.");
      if((safetyType==="marketing_objection"||safetyType==="failed_route")&&!normal&&!key)throw new CrmInputError("Safety control requires durable matching evidence.");
      const params=[scope,organisationId,contactId,routeId,channel,purpose,safetyType,reason,"n18_synthetic_2a",sourceReference,normal,key];
      const created=await c.query(`INSERT INTO crm.safety
        (scope_type,organisation_id,contact_id,contact_route_id,channel,purpose,safety_type,reason,source_system,
         source_reference,route_normalised_value,organisation_key)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        ON CONFLICT DO NOTHING RETURNING *`,params);
      let row=created.rows[0];
      if(!row)row=(await c.query(`SELECT * FROM crm.safety
        WHERE status='active' AND scope_type=$1 AND safety_type=$2 AND coalesce(channel,'')=$3
          AND coalesce(purpose,'')=$4 AND coalesce(route_normalised_value,'')=$5
          AND coalesce(organisation_key,'')=$6 AND coalesce(organisation_id::text,'')=$7
          AND coalesce(contact_id::text,'')=$8 LIMIT 1`,
          [scope,safetyType,channel,purpose,normal??"",key??"",organisationId??"",contactId??""])).rows[0];
      if(!row)throw new Error("Safety record could not be resolved.");
      if(created.rows.length) {
        await audit(c,"safety",String(row.id),actor,"status",null,"active","Synthetic safety evidence recorded");
        await activity(c,actor,"safety_applied","Synthetic "+safetyType+" applied",{contactId,organisationId});
      }
      return {control:row,replayed:created.rows.length===0};
    });
    case "clearSafety": return withTx(async c => {
      if(role!=="crm_admin")throw new CrmInputError("Administrator review is required for clearance.");
      const id=validId(data.id)!;
      const reason=field(data.reason,"Clearance reason",500);
      const evidence=field(data.evidenceReference,"Synthetic clearance evidence",240);
      if(reason.length<8||!evidence.startsWith("synthetic:review-"))throw new CrmInputError("Documented synthetic review evidence is required.");
      const old=(await c.query("SELECT * FROM crm.safety WHERE id=$1 AND status='active' FOR UPDATE",[id])).rows[0];
      if(!old)throw new CrmInputError("Active safety control not found; already cleared or invalid.");
      const row=(await c.query(`UPDATE crm.safety SET status='cleared',cleared_at=now(),
        cleared_by_internal_user_id=$2,clearance_evidence=$3 WHERE id=$1 RETURNING *`,[id,actor,evidence])).rows[0];
      await audit(c,"safety",id,actor,"status","active","cleared",reason+" | "+evidence);
      await activity(c,actor,"safety_cleared","Synthetic safety clearance after documented review",{
        organisationId:old.organisation_id?String(old.organisation_id):null,contactId:old.contact_id?String(old.contact_id):null,
      });
      return row;
    });
    case "resolveReview": {
      const kind=choice(data.kind,["action","event"],"review type");
      const id=validId(data.id)!;
      const reason=field(data.reason,"Review outcome",500);
      if(reason.length<8)throw new CrmInputError("Review outcome must contain evidence.");
      if(kind==="action")return withTx(async c=>{
        const existing=(await c.query(`SELECT a.*,r.organisation_id FROM crm.actions a
          JOIN crm.relationships r ON r.id=a.relationship_id
          WHERE a.id=$1 AND a.status='open' AND a.action_type='needs_review' FOR UPDATE OF a`,[id])).rows[0];
        if(!existing)throw new CrmInputError("Open synthetic Needs Review action not found.");
        const row=(await c.query(`UPDATE crm.actions SET status='completed',completed_at=now(),
          updated_at=now() WHERE id=$1 RETURNING *`,[id])).rows[0];
        await audit(c,"action",id,actor,"status","open","completed",reason);
        await activity(c,actor,"review_resolved","Synthetic Needs Review resolved: "+reason,{
          relationshipId:String(existing.relationship_id),
          organisationId:existing.organisation_id?String(existing.organisation_id):null,
        });
        return row;
      });
      return withTx(async c=>{
        const old=(await c.query(`SELECT * FROM crm_ops.integration_events
          WHERE id=$1 AND status='needs_review' AND source_system='synthetic' FOR UPDATE`,[id])).rows[0];
        if(!old)throw new CrmInputError("Synthetic review event not found.");
        const row=(await c.query(`UPDATE crm_ops.integration_events SET status='resolved',
          validation=coalesce(validation,'{}'::jsonb)||jsonb_build_object('resolution',$2,'actor',$3),
          verified_at=now(),updated_at=now() WHERE id=$1 RETURNING *`,[id,reason,actor])).rows[0];
        await audit(c,"integration_event",id,actor,"status","needs_review","resolved",reason);
        await activity(c,actor,"review_resolved","Synthetic integration review resolved");
        return row;
      });
    }
    default:throw new CrmInputError("Unsupported CRM operation.");
  }
}
