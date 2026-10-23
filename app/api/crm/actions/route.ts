import { NextRequest, NextResponse } from "next/server";
import { CrmAuthorizationError, requireCrmUser } from "@/lib/crm/auth";
import { createCrmAction } from "@/lib/crm/services/actions";

export const dynamic = "force-dynamic";

type ActionRequestBody = {
  relationshipId?: unknown;
  actionType?: unknown;
  title?: unknown;
  dueAt?: unknown;
};

export async function POST(request: NextRequest) {
  try {
    const { crmUser } = await requireCrmUser(["crm_admin", "crm_operator"]);
    const body = (await request.json()) as ActionRequestBody;

    if (typeof body.relationshipId !== "string" || typeof body.actionType !== "string" || typeof body.title !== "string") {
      return NextResponse.json({ ok: false, error: "relationshipId, actionType and title are required." }, { status: 400 });
    }
    if (!body.title.trim() || body.title.length > 240) {
      return NextResponse.json({ ok: false, error: "Action title is invalid." }, { status: 400 });
    }

    let dueAt: Date | null = null;
    if (typeof body.dueAt === "string") {
      dueAt = new Date(body.dueAt);
      if (Number.isNaN(dueAt.getTime())) {
        return NextResponse.json({ ok: false, error: "dueAt must be a valid ISO date-time." }, { status: 400 });
      }
    }

    const action = await createCrmAction(
      {
        relationshipId: body.relationshipId,
        actionType: body.actionType,
        title: body.title.trim(),
        dueAt,
      },
      crmUser.id,
    );

    return NextResponse.json({ ok: true, action }, { status: 201 });
  } catch (error) {
    if (error instanceof CrmAuthorizationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    }
    console.error("CRM action API failed", error);
    return NextResponse.json({ ok: false, error: "CRM action could not be created." }, { status: 503 });
  }
}
