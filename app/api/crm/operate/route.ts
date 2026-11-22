import { NextRequest, NextResponse } from "next/server";
import { CrmAuthorizationError, requireCrmUser } from "@/lib/crm/auth";
import { CrmInputError, listOperatorView, runOperatorMutation } from "@/lib/crm/services/operator";

export const dynamic = "force-dynamic";
function handleError(error: unknown) {
  if (error instanceof CrmAuthorizationError) return NextResponse.json({ok:false,error:error.message},{status:403});
  if (error instanceof CrmInputError) return NextResponse.json({ok:false,error:error.message},{status:400});
  if (typeof error==="object"&&error!==null&&"code" in error&&error.code==="23505") {
    return NextResponse.json({ok:false,error:"A duplicate record already exists."},{status:409});
  }
  console.error("N18 synthetic CRM operator error",error);
  return NextResponse.json({ok:false,error:"The synthetic CRM operation is unavailable."},{status:503});
}
export async function GET(request:NextRequest) {
  try {
    await requireCrmUser();
    const url=new URL(request.url);
    const data=await listOperatorView(url.searchParams.get("view")||"organisations",url.searchParams.get("q")||"",url.searchParams.get("id")||undefined);
    return NextResponse.json({ok:true,data});
  } catch(error) {return handleError(error);}
}
export async function POST(request:NextRequest) {
  try {
    const {crmUser}=await requireCrmUser(["crm_admin","crm_operator"]);
    const body=await request.json() as unknown;
    if(!body||typeof body!=="object"||Array.isArray(body))throw new CrmInputError("A CRM operation is required.");
    const fields=body as Record<string,unknown>;
    if(typeof fields.operation!=="string"||!fields.data||typeof fields.data!=="object"||Array.isArray(fields.data))
      throw new CrmInputError("Invalid bounded CRM request.");
    if(fields.operation==="clearSafety"&&crmUser.crmRole!=="crm_admin")
      return NextResponse.json({ok:false,error:"CRM administrator required for safety clearance."},{status:403});
    const result=await runOperatorMutation(fields.operation,fields.data as Record<string,unknown>,crmUser.id,crmUser.crmRole);
    return NextResponse.json({ok:true,data:result});
  }catch(error){return handleError(error);}
}
