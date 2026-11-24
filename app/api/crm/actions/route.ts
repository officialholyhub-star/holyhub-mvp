import { NextRequest, NextResponse } from "next/server";
import { CrmAuthorizationError, requireCrmUser } from "@/lib/crm/auth";
import { CrmInputError, runOperatorMutation } from "@/lib/crm/services/operator";
import { CrmRequestError, parseCrmBoundedRequest } from "@/lib/crm/tools/request-contract";

export const dynamic = "force-dynamic";

/**
 * Compatibility route for the original CRM action API.
 * Uses the SAME synthetic-only, audited operator boundary as /api/crm/operate.
 * No separate unguarded CRM action write path is permitted under N18 2B.
 */
export async function POST(request: NextRequest) {
  try {
    const { crmUser } = await requireCrmUser(["crm_admin", "crm_operator"]);
    const fields = parseCrmBoundedRequest({
      operation: "createAction",
      data: await request.json(),
    });
    const action = await runOperatorMutation(
      fields.operation, fields.data, crmUser.id, crmUser.crmRole,
    );
    // Idempotent duplicate-retry: report existing action without inventing a new send or audit.
    const replayed = !!(action && typeof action === "object" && "replayed" in action && action.replayed);
    return NextResponse.json({ ok: true, action }, { status: replayed ? 200 : 201 });
  } catch (error) {
    if (error instanceof CrmAuthorizationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    }
    if (error instanceof CrmInputError || error instanceof CrmRequestError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    console.error("N18 synthetic CRM action API failed", error);
    return NextResponse.json({ ok: false, error: "CRM action could not be created." }, { status: 503 });
  }
}
