import { NextResponse } from "next/server";
import { CrmAuthorizationError, requireCrmUser } from "@/lib/crm/auth";
import { getCrmDashboardCounts } from "@/lib/crm/services/dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { crmUser } = await requireCrmUser();
    const counts = await getCrmDashboardCounts();
    return NextResponse.json({
      ok: true,
      actor: { id: crmUser.id, displayName: crmUser.displayName, role: crmUser.crmRole },
      counts,
    });
  } catch (error) {
    if (error instanceof CrmAuthorizationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    }
    console.error("CRM dashboard API failed", error);
    return NextResponse.json({ ok: false, error: "CRM dashboard is unavailable." }, { status: 503 });
  }
}
