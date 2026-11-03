import { NextResponse } from "next/server";
// Fail closed until delivery/tax rules, stock reservations and Connect are implemented and tested.
// Browser-provided prices or a return to /checkout can never create a charge or mark an order paid.
export async function POST(){return NextResponse.json({code:"CHECKOUT_NOT_ENABLED",error:"Payments are not enabled. No charge has been made."},{status:503});}
